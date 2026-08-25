import { TaskStatus } from '@prisma/client';
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
  userId?: string
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

  // 4. Record Activity Log
  if (userId) {
    await prisma.activityLog.create({
      data: {
        taskId,
        userId,
        action: 'STATUS_CHANGED',
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

  return updatedTask;
}