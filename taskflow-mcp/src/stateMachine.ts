import { TaskStatus, ActorType } from '@prisma/client';
import { prisma } from './db.js';
import { eventBus } from './eventBus.js';

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.BACKLOG]: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.BACKLOG],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.REVIEW, TaskStatus.BLOCKED, TaskStatus.TODO, TaskStatus.DONE],
  [TaskStatus.BLOCKED]: [TaskStatus.IN_PROGRESS, TaskStatus.TODO, TaskStatus.BACKLOG],
  [TaskStatus.REVIEW]: [TaskStatus.DONE, TaskStatus.IN_PROGRESS],
  [TaskStatus.DONE]: [TaskStatus.BACKLOG, TaskStatus.TODO], // Reopening
};

export async function transitionTaskStatus(
  taskId: string,
  targetStatus: TaskStatus,
  organizationId?: string,
  userId?: string,
  actorType: ActorType = ActorType.HUMAN,
  actorName?: string
) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      ...(organizationId ? { organizationId } : {}),
    },
    include: {
      dependencies: {
        include: { dependsOnTask: true }
      },
      assignee: { select: { name: true, email: true } }
    }
  });

  if (!task) {
    throw new Error(`Task with ID "${taskId}" not found or does not belong to your organization.`);
  }

  const oldStatus = task.status;

  // 1. Validate State Flow
  const allowed = VALID_TRANSITIONS[task.status] || [];
  if (!allowed.includes(targetStatus)) {
    throw new Error(`Invalid transition: Cannot move from ${task.status} to ${targetStatus}.`);
  }

  // 2. Check for Unresolved Blockers
  if (targetStatus === TaskStatus.IN_PROGRESS) {
    const unfinishedBlockers = task.dependencies.filter(
      dep => dep.dependsOnTask.status !== TaskStatus.DONE
    );

    if (unfinishedBlockers.length > 0) {
      // Auto-flag as blocked
      await prisma.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.BLOCKED }
      });
      const blockerIds = unfinishedBlockers.map(b => b.dependsOnTaskId);
      
      eventBus.emit('TASK_BLOCKED', {
        taskId,
        taskTitle: task.title,
        organizationId: task.organizationId,
        blockerIds
      });

      throw new Error(`Task is BLOCKED by unfinished prerequisites: [${blockerIds.join(', ')}]`);
    }
  }

  // 3. Update Database Status
  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: { status: targetStatus },
    include: {
      assignee: { select: { name: true, email: true } },
      dependencies: { select: { dependsOnTaskId: true } }
    }
  });

  // 4. Record Activity Log with Actor Attribution (Human vs AI vs System)
  if (userId) {
    await prisma.activityLog.create({
      data: {
        taskId,
        userId,
        action: 'STATUS_CHANGED',
        actorType,
        actorName: actorName || (actorType === ActorType.AI_AGENT ? 'AI Assistant' : undefined),
        details: `Moved from ${oldStatus} to ${targetStatus}`
      }
    }).catch(() => {});
  }

  // 5. Emit Event for live Web UI and webhooks
  eventBus.emit('TASK_STATUS_CHANGED', {
    taskId,
    oldStatus,
    newStatus: targetStatus,
    task: updatedTask,
    organizationId: task.organizationId
  });

  // 6. Automatic Cascade Unblock: If a task becomes DONE, check all tasks blocked by this task
  if (targetStatus === TaskStatus.DONE) {
    const blockedDependents = await prisma.taskDependency.findMany({
      where: { dependsOnTaskId: taskId },
      include: {
        task: {
          include: {
            dependencies: {
              include: { dependsOnTask: true }
            }
          }
        }
      }
    });

    for (const dep of blockedDependents) {
      const dependentTask = dep.task;
      if (dependentTask.status === TaskStatus.BLOCKED) {
        // Check if all other prerequisites are now DONE
        const remainingBlockers = dependentTask.dependencies.filter(
          d => d.dependsOnTaskId !== taskId && d.dependsOnTask.status !== TaskStatus.DONE
        );

        if (remainingBlockers.length === 0) {
          await prisma.task.update({
            where: { id: dependentTask.id },
            data: { status: TaskStatus.TODO }
          });

          eventBus.emit('TASK_UNBLOCKED', {
            taskId: dependentTask.id,
            taskTitle: dependentTask.title,
            organizationId: dependentTask.organizationId
          });
        }
      }
    }
  }

  return updatedTask;
}