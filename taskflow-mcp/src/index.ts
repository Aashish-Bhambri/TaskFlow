import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { prisma } from './db.js';
import { Role, Priority, TaskStatus, TaskType } from '@prisma/client';
import { authorizeUser } from './rbac.js';
import { transitionTaskStatus } from './stateMachine.js';
import { eventBus } from './eventBus.js';
import { generateUserCalendarFeed } from './calendar.js';

export const server = new McpServer({
  name: 'taskflow-mcp-server',
  version: '2.1.0'
});

// ==========================================
// TOOL 1: Register User (with Organization)
// ==========================================
server.tool(
  'create_user',
  'Registers a new team member and assigns them to an organization',
  {
    name: z.string().min(2),
    email: z.string().email(),
    role: z.nativeEnum(Role).default(Role.CONTRIBUTOR),
    organizationSlug: z.string().default('default-org').describe('Organization slug/identifier')
  },
  async ({ name, email, role, organizationSlug }) => {
    let org = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
    if (!org) {
      org = await prisma.organization.create({
        data: { name: organizationSlug.toUpperCase(), slug: organizationSlug }
      });
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, role, organizationId: org.id },
      create: {
        name,
        email,
        role,
        organizationId: org.id
      }
    });

    return {
      content: [{ type: 'text', text: `Success: User created with ID "${user.id}" (Role: ${user.role}, Org: ${org.name}).` }]
    };
  }
);

// ==========================================
// TOOL 2: Create Task (Multi-Tenant & RBAC)
// ==========================================
server.tool(
  'create_task',
  'Creates a new task within the caller organization with priority, estimate, and assignee',
  {
    callerId: z.string().describe('The user ID of the person making this request'),
    title: z.string().min(3),
    description: z.string().optional(),
    priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
    type: z.nativeEnum(TaskType).default(TaskType.TASK),
    assigneeId: z.string().optional(),
    estimatedHours: z.number().positive().optional(),
    dueDate: z.string().datetime().optional(),
    sprintId: z.string().optional()
  },
  async ({ callerId, title, description, priority, type, assigneeId, estimatedHours, dueDate, sprintId }) => {
    const { authorized, user } = await authorizeUser(callerId, [Role.ADMIN, Role.PROJECT_MANAGER, Role.CONTRIBUTOR]);
    if (!authorized || !user) {
      return { content: [{ type: 'text', text: `Permission Denied: User "${callerId}" not found or unauthorized.` }] };
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority,
        type,
        assigneeId,
        createdById: callerId,
        organizationId: user.organizationId,
        sprintId,
        estimatedHours,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        status: TaskStatus.BACKLOG
      },
      include: {
        assignee: { select: { name: true, email: true } }
      }
    });

    // Record Activity
    await prisma.activityLog.create({
      data: {
        taskId: task.id,
        userId: callerId,
        action: 'CREATED',
        details: `Task "${title}" created by ${user.name}`
      }
    }).catch(() => {});

    eventBus.emit('TASK_CREATED', { task, organizationId: user.organizationId });

    if (assigneeId) {
      eventBus.emit('TASK_ASSIGNED', {
        taskId: task.id,
        taskTitle: task.title,
        assigneeId,
        organizationId: user.organizationId
      });
    }

    return {
      content: [{ type: 'text', text: `Success: Task "${task.title}" created with ID "${task.id}" in BACKLOG.` }]
    };
  }
);

// ==========================================
// TOOL 3: List Tasks (Multi-Tenant Filtered)
// ==========================================
server.tool(
  'list_tasks',
  'Retrieves tasks in the organization with optional status, priority, or assignee filters',
  {
    callerId: z.string().describe('The user ID of the caller to scope organization'),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(Priority).optional(),
    assigneeId: z.string().optional(),
    sprintId: z.string().optional()
  },
  async ({ callerId, status, priority, assigneeId, sprintId }) => {
    const user = await prisma.user.findUnique({ where: { id: callerId } });
    if (!user) {
      return { content: [{ type: 'text', text: `Error: Caller ID "${callerId}" not found.` }] };
    }

    const tasks = await prisma.task.findMany({
      where: {
        organizationId: user.organizationId,
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(assigneeId ? { assigneeId } : {}),
        ...(sprintId ? { sprintId } : {})
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        dependencies: { select: { dependsOnTaskId: true } },
        comments: { select: { id: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }]
    };
  }
);

// ==========================================
// TOOL 4: Get Task Details & Activity History
// ==========================================
server.tool(
  'get_task_details',
  'Fetches full task specifications, comments, dependency trees, and audit activity history',
  {
    callerId: z.string(),
    taskId: z.string()
  },
  async ({ callerId, taskId }) => {
    const user = await prisma.user.findUnique({ where: { id: callerId } });
    if (!user) return { content: [{ type: 'text', text: 'Caller not found.' }] };

    const task = await prisma.task.findFirst({
      where: { id: taskId, organizationId: user.organizationId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        dependencies: {
          include: { dependsOnTask: { select: { id: true, title: true, status: true } } }
        },
        blockedTasks: {
          include: { task: { select: { id: true, title: true, status: true } } }
        },
        comments: {
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: 'asc' }
        },
        activityLogs: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!task) return { content: [{ type: 'text', text: `Task "${taskId}" not found.` }] };

    return {
      content: [{ type: 'text', text: JSON.stringify(task, null, 2) }]
    };
  }
);

// ==========================================
// TOOL 5: Add Comment to Task
// ==========================================
server.tool(
  'add_task_comment',
  'Adds a discussion comment or review note to a task and logs an activity audit event',
  {
    callerId: z.string(),
    taskId: z.string(),
    content: z.string().min(1)
  },
  async ({ callerId, taskId, content }) => {
    const user = await prisma.user.findUnique({ where: { id: callerId } });
    if (!user) return { content: [{ type: 'text', text: 'Caller not found.' }] };

    const task = await prisma.task.findFirst({
      where: { id: taskId, organizationId: user.organizationId }
    });
    if (!task) return { content: [{ type: 'text', text: `Task "${taskId}" not found.` }] };

    const comment = await prisma.comment.create({
      data: {
        taskId,
        userId: callerId,
        content
      },
      include: { user: { select: { name: true, email: true } } }
    });

    // Record Activity
    await prisma.activityLog.create({
      data: {
        taskId,
        userId: callerId,
        action: 'COMMENT_ADDED',
        details: `Comment added by ${user.name}: "${content.substring(0, 50)}..."`
      }
    });

    eventBus.emit('COMMENT_ADDED', { taskId, comment, organizationId: user.organizationId });

    return {
      content: [{ type: 'text', text: `Success: Comment added to task "${taskId}".` }]
    };
  }
);

// ==========================================
// TOOL 6: Update Task Status & DAG Resolver
// ==========================================
server.tool(
  'update_task_status',
  'Transitions task through the DAG workflow state machine',
  {
    callerId: z.string(),
    taskId: z.string(),
    newStatus: z.nativeEnum(TaskStatus)
  },
  async ({ callerId, taskId, newStatus }) => {
    const { authorized, user } = await authorizeUser(callerId, [Role.ADMIN, Role.PROJECT_MANAGER, Role.CONTRIBUTOR]);
    if (!authorized || !user) {
      return { content: [{ type: 'text', text: 'Permission Denied: User not found or unauthorized.' }] };
    }

    try {
      const updated = await transitionTaskStatus(taskId, newStatus, user.organizationId, callerId);
      return {
        content: [{ type: 'text', text: `Success: Task "${taskId}" transitioned to state "${updated.status}".` }]
      };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Workflow Error: ${err.message}` }] };
    }
  }
);

// ==========================================
// TOOL 7: Set Task Dependency (DAG)
// ==========================================
server.tool(
  'set_task_dependency',
  'Defines that task A depends on task B being completed first',
  {
    callerId: z.string(),
    taskId: z.string(),
    dependsOnTaskId: z.string()
  },
  async ({ callerId, taskId, dependsOnTaskId }) => {
    const { authorized, user } = await authorizeUser(callerId, [Role.ADMIN, Role.PROJECT_MANAGER]);
    if (!authorized || !user) {
      return { content: [{ type: 'text', text: 'Permission Denied: Only Admins or Managers can set dependencies.' }] };
    }

    await prisma.taskDependency.create({
      data: { taskId, dependsOnTaskId }
    });

    await prisma.activityLog.create({
      data: {
        taskId,
        userId: callerId,
        action: 'DEPENDENCY_LINKED',
        details: `Linked dependency on Task ${dependsOnTaskId}`
      }
    }).catch(() => {});

    return {
      content: [{ type: 'text', text: `Dependency linked: Task ${taskId} now blocked by Task ${dependsOnTaskId}.` }]
    };
  }
);

// ==========================================
// TOOL 8: Generate Project & Sprint Analytics Report
// ==========================================
server.tool(
  'generate_project_report',
  'Generates a comprehensive project progress report, velocity metrics, blocker detection, and executive summary',
  {
    callerId: z.string(),
    sprintId: z.string().optional()
  },
  async ({ callerId, sprintId }) => {
    const user = await prisma.user.findUnique({ where: { id: callerId } });
    if (!user) return { content: [{ type: 'text', text: 'Caller not found.' }] };

    const tasks = await prisma.task.findMany({
      where: {
        organizationId: user.organizationId,
        ...(sprintId ? { sprintId } : {})
      },
      include: {
        assignee: { select: { name: true } },
        dependencies: { include: { dependsOnTask: { select: { id: true, title: true, status: true } } } }
      }
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === TaskStatus.DONE);
    const inProgressTasks = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS);
    const blockedTasks = tasks.filter(t => t.status === TaskStatus.BLOCKED);
    const backlogTasks = tasks.filter(t => t.status === TaskStatus.BACKLOG || t.status === TaskStatus.TODO);

    const totalHours = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const deliveredHours = completedTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

    // Check overdue
    const now = new Date();
    const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== TaskStatus.DONE);

    // Workload breakdown
    const workload: Record<string, number> = {};
    for (const t of tasks) {
      const name = t.assignee?.name || 'Unassigned';
      workload[name] = (workload[name] || 0) + (t.estimatedHours || 1);
    }

    const report = {
      summary: {
        totalTasks,
        completed: completedTasks.length,
        inProgress: inProgressTasks.length,
        blocked: blockedTasks.length,
        backlog: backlogTasks.length,
        completionPercentage: `${completionRate}%`,
        totalEstimatedHours: totalHours,
        deliveredHours,
        overdueCount: overdueTasks.length
      },
      criticalBlockers: blockedTasks.map(t => ({
        taskId: t.id,
        title: t.title,
        blockedBy: t.dependencies.filter(d => d.dependsOnTask.status !== TaskStatus.DONE).map(d => d.dependsOnTask.title)
      })),
      overdueTasks: overdueTasks.map(t => ({ taskId: t.id, title: t.title, dueDate: t.dueDate })),
      teamWorkloadHours: workload
    };

    return {
      content: [{
        type: 'text',
        text: `### 📊 Project Health & Sprint Report\n\n` +
              `* **Completion Rate:** ${completionRate}% (${completedTasks.length}/${totalTasks} tasks done)\n` +
              `* **Delivered Effort:** ${deliveredHours}h / ${totalHours}h estimated\n` +
              `* **Active Tasks:** ${inProgressTasks.length} In Progress, ${backlogTasks.length} Backlog\n` +
              `* **Blockers:** ${blockedTasks.length} tasks blocked\n` +
              `* **Overdue Deadlines:** ${overdueTasks.length} tasks\n\n` +
              `#### 👥 Team Workload Distribution (Hours):\n` +
              Object.entries(workload).map(([name, hours]) => `* **${name}**: ${hours}h`).join('\n') + '\n\n' +
              `\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\``
      }]
    };
  }
);

// ==========================================
// TOOL 9: Manage Sprints
// ==========================================
server.tool(
  'manage_sprint',
  'Creates or updates a Sprint cycle for the organization',
  {
    callerId: z.string(),
    name: z.string(),
    goal: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED']).default('ACTIVE')
  },
  async ({ callerId, name, goal, startDate, endDate, status }) => {
    const { authorized, user } = await authorizeUser(callerId, [Role.ADMIN, Role.PROJECT_MANAGER]);
    if (!authorized || !user) return { content: [{ type: 'text', text: 'Permission Denied.' }] };

    const sprint = await prisma.sprint.create({
      data: {
        name,
        goal,
        status,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        organizationId: user.organizationId
      }
    });

    return {
      content: [{ type: 'text', text: `Success: Sprint "${sprint.name}" created with ID "${sprint.id}" (${sprint.status}).` }]
    };
  }
);

// ==========================================
// TOOL 10: Export iCal Calendar Feed
// ==========================================
server.tool(
  'export_calendar_feed',
  'Exports user assigned tasks and deadlines as an iCalendar (.ics) feed string',
  {
    userId: z.string()
  },
  async ({ userId }) => {
    try {
      const icsString = await generateUserCalendarFeed(userId);
      return {
        content: [{ type: 'text', text: icsString }]
      };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error generating calendar: ${err.message}` }] };
    }
  }
);

// ==========================================
// RESOURCE: Project Timeline Summary
// ==========================================
server.resource(
  'timeline',
  'project://timeline/summary',
  async (uri) => {
    const tasks = await prisma.task.findMany({
      include: { assignee: true, dependencies: true }
    });

    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(tasks, null, 2),
        mimeType: 'application/json'
      }]
    };
  }
);

// ==========================================
// PROMPT: Daily Standup Digest
// ==========================================
server.prompt(
  'daily_standup_digest',
  'Generates a standup summary of blocked and in-progress tasks',
  {
    projectId: z.string().describe('The project identifier to review')
  },
  async ({ projectId }) => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please review all tasks for project "${projectId}". Identify any critical blockers, tasks marked URGENT, and generate a 3-bullet daily standup summary for the team.`
          }
        }
      ]
    };
  }
);

// ==========================================
// Dual Transport Startup (stdio by default)
// ==========================================
async function main() {
  const isSseMode = process.argv.includes('--sse');

  if (isSseMode) {
    const { startSseServer } = await import('./server/sse.js');
    startSseServer(3000);
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("TaskFlow MCP Server running on stdio (PostgreSQL SaaS Core).");
  }
}

main().catch(err => {
  console.error("Fatal Server Error:", err);
  process.exit(1);
});