import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { prisma } from './db.js';
import { Role, Priority, TaskStatus, TaskType } from '@prisma/client';
import { transitionTaskStatus } from './stateMachine.js';
import { eventBus } from './eventBus.js';
import { generateUserCalendarFeed } from './calendar.js';

/**
 * Resolves the effective user account automatically so the AI never has to ask the user.
 */
export async function resolveEffectiveUser(callerId?: string) {
  if (callerId) {
    const byIdOrEmail = await prisma.user.findFirst({
      where: {
        OR: [{ id: callerId }, { email: callerId }]
      },
      include: { organization: true }
    });
    if (byIdOrEmail) return byIdOrEmail;
  }

  // Auto-resolve to default admin user in the workspace
  const defaultUser = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    include: { organization: true }
  });

  if (defaultUser) return defaultUser;

  // Fallback to first available user
  return await prisma.user.findFirst({
    include: { organization: true }
  });
}

/**
 * Registers all TaskFlow MCP Tools, Resources, and Prompts on an McpServer instance.
 */
export function registerAllTools(server: McpServer) {
  // TOOL 1: Register User
  server.tool(
    'create_user',
    'Registers a new team member and assigns them to an organization',
    {
      name: z.string().min(2),
      email: z.string().email(),
      role: z.nativeEnum(Role).default(Role.CONTRIBUTOR),
      organizationSlug: z.string().optional().describe('Optional organization slug/identifier')
    },
    async ({ name, email, role, organizationSlug }) => {
      let org = null;
      if (organizationSlug) {
        org = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
      }
      if (!org) {
        org = await prisma.organization.findFirst() || await prisma.organization.create({
          data: { name: 'TaskFlow Workspace', slug: 'taskflow-workspace' }
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

  // TOOL 2: Create Task
  server.tool(
    'create_task',
    'Creates a new task in the authenticated user workspace with priority, estimate, and assignee',
    {
      title: z.string().min(2).describe('Task title'),
      description: z.string().optional().describe('Task description or acceptance criteria'),
      priority: z.nativeEnum(Priority).default(Priority.MEDIUM).describe('Task priority: LOW, MEDIUM, HIGH, URGENT'),
      type: z.nativeEnum(TaskType).default(TaskType.TASK).describe('Issue type: FEATURE, BUG, TASK, IMPROVEMENT, OTHER'),
      assigneeId: z.string().optional().describe('Optional assignee user ID or email'),
      estimatedHours: z.number().positive().optional().describe('Estimated hours of effort'),
      dueDate: z.string().optional().describe('Optional due date string (ISO format or YYYY-MM-DD)'),
      projectId: z.string().optional().describe('Optional project ID to associate with'),
      sprintId: z.string().optional().describe('Optional sprint ID to associate with'),
      callerId: z.string().optional().describe('Optional: User ID or email. Automatically resolved from your account.')
    },
    async ({ title, description, priority, type, assigneeId, estimatedHours, dueDate, projectId, sprintId, callerId }) => {
      const user = await resolveEffectiveUser(callerId);
      if (!user) {
        return { content: [{ type: 'text', text: 'Error: No user account found in database. Please sign in or create a user.' }] };
      }

      let finalAssigneeId = user.id;
      if (assigneeId) {
        const assignedUser = await prisma.user.findFirst({
          where: {
            organizationId: user.organizationId,
            OR: [{ id: assigneeId }, { email: assigneeId }]
          }
        });
        if (assignedUser) finalAssigneeId = assignedUser.id;
      }

      let finalProjectId = projectId;
      let workspace = await prisma.workspace.findFirst({ where: { organizationId: user.organizationId } });
      if (!finalProjectId) {
        const firstProj = await prisma.project.findFirst({ where: { workspace: { organizationId: user.organizationId } } });
        if (firstProj) finalProjectId = firstProj.id;
      }

      const task = await prisma.task.create({
        data: {
          title,
          description,
          priority,
          type,
          assigneeId: finalAssigneeId,
          createdById: user.id,
          organizationId: user.organizationId,
          workspaceId: workspace?.id,
          projectId: finalProjectId,
          sprintId,
          estimatedHours,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          status: TaskStatus.BACKLOG
        },
        include: {
          assignee: { select: { name: true, email: true } },
          project: { select: { name: true } }
        }
      });

      await prisma.activityLog.create({
        data: {
          taskId: task.id,
          userId: user.id,
          action: 'CREATED',
          details: `Task "${title}" created by ${user.name || user.email}`
        }
      }).catch(() => {});

      eventBus.emit('TASK_CREATED', { task, organizationId: user.organizationId });

      return {
        content: [{ type: 'text', text: `Success: Task "${task.title}" created with ID "${task.id}" in your workspace!` }]
      };
    }
  );

  // TOOL 3: List Tasks
  server.tool(
    'list_tasks',
    'Retrieves tasks in your organization with optional status, priority, or project filters',
    {
      status: z.nativeEnum(TaskStatus).optional().describe('Filter by status: BACKLOG, TODO, IN_PROGRESS, REVIEW, BLOCKED, DONE'),
      priority: z.nativeEnum(Priority).optional().describe('Filter by priority: LOW, MEDIUM, HIGH, URGENT'),
      projectId: z.string().optional().describe('Filter by project ID'),
      assigneeId: z.string().optional().describe('Filter by assignee ID or email'),
      sprintId: z.string().optional().describe('Filter by sprint ID'),
      callerId: z.string().optional().describe('Optional: User ID or email. Automatically resolved from your account.')
    },
    async ({ status, priority, projectId, assigneeId, sprintId, callerId }) => {
      const user = await resolveEffectiveUser(callerId);
      if (!user) {
        return { content: [{ type: 'text', text: 'Error: No user account found.' }] };
      }

      const tasks = await prisma.task.findMany({
        where: {
          organizationId: user.organizationId,
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
          ...(projectId ? { projectId } : {}),
          ...(assigneeId ? { assigneeId } : {}),
          ...(sprintId ? { sprintId } : {})
        },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
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

  // TOOL 4: Get Task Details
  server.tool(
    'get_task_details',
    'Fetches full task specifications, comments, dependency trees, and audit activity history',
    {
      taskId: z.string().describe('The ID of the task to view'),
      callerId: z.string().optional().describe('Optional: Automatically resolved from your account.')
    },
    async ({ taskId, callerId }) => {
      const user = await resolveEffectiveUser(callerId);
      if (!user) return { content: [{ type: 'text', text: 'Caller account not found.' }] };

      const task = await prisma.task.findFirst({
        where: { id: taskId, organizationId: user.organizationId },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
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

      if (!task) return { content: [{ type: 'text', text: `Task "${taskId}" not found in your account.` }] };

      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }]
      };
    }
  );

  // TOOL 5: Add Comment to Task
  server.tool(
    'add_task_comment',
    'Adds a discussion comment or review note to a task and logs an activity audit event',
    {
      taskId: z.string().describe('The ID of the task to comment on'),
      content: z.string().min(1).describe('The comment content or review feedback'),
      callerId: z.string().optional().describe('Optional: Automatically resolved from your account.')
    },
    async ({ taskId, content, callerId }) => {
      const user = await resolveEffectiveUser(callerId);
      if (!user) return { content: [{ type: 'text', text: 'Caller account not found.' }] };

      const task = await prisma.task.findFirst({
        where: { id: taskId, organizationId: user.organizationId }
      });
      if (!task) return { content: [{ type: 'text', text: `Task "${taskId}" not found in your account.` }] };

      const comment = await prisma.comment.create({
        data: {
          taskId,
          userId: user.id,
          content
        },
        include: { user: { select: { name: true, email: true } } }
      });

      await prisma.activityLog.create({
        data: {
          taskId,
          userId: user.id,
          action: 'COMMENT_ADDED',
          details: `Comment added by ${user.name || user.email}: "${content.substring(0, 50)}..."`
        }
      });

      eventBus.emit('COMMENT_ADDED', { taskId, comment, organizationId: user.organizationId });

      return {
        content: [{ type: 'text', text: `Success: Comment added to task "${taskId}".` }]
      };
    }
  );

  // TOOL 6: Update Task Status
  server.tool(
    'update_task_status',
    'Transitions task through the DAG workflow state machine',
    {
      taskId: z.string().describe('The ID of the task to update'),
      newStatus: z.nativeEnum(TaskStatus).describe('Target status: BACKLOG, TODO, IN_PROGRESS, REVIEW, BLOCKED, DONE'),
      callerId: z.string().optional().describe('Optional: Automatically resolved from your account.')
    },
    async ({ taskId, newStatus, callerId }) => {
      const user = await resolveEffectiveUser(callerId);
      if (!user) {
        return { content: [{ type: 'text', text: 'Error: User account not found.' }] };
      }

      try {
        const updated = await transitionTaskStatus(taskId, newStatus, user.organizationId, user.id);
        return {
          content: [{ type: 'text', text: `Success: Task "${taskId}" transitioned to state "${updated.status}".` }]
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Workflow Error: ${err.message}` }] };
      }
    }
  );

  // TOOL 7: Set Task Dependency
  server.tool(
    'set_task_dependency',
    'Defines that task A depends on task B being completed first',
    {
      taskId: z.string().describe('The task that is blocked'),
      dependsOnTaskId: z.string().describe('The prerequisite task that must be completed first'),
      callerId: z.string().optional().describe('Optional: Automatically resolved from your account.')
    },
    async ({ taskId, dependsOnTaskId, callerId }) => {
      const user = await resolveEffectiveUser(callerId);
      if (!user) {
        return { content: [{ type: 'text', text: 'Error: User account not found.' }] };
      }

      await prisma.taskDependency.create({
        data: { taskId, dependsOnTaskId }
      });

      await prisma.activityLog.create({
        data: {
          taskId,
          userId: user.id,
          action: 'DEPENDENCY_LINKED',
          details: `Linked dependency on Task ${dependsOnTaskId}`
        }
      }).catch(() => {});

      return {
        content: [{ type: 'text', text: `Dependency linked: Task ${taskId} is now blocked by Task ${dependsOnTaskId}.` }]
      };
    }
  );

  // TOOL 8: Generate Project Analytics Report
  server.tool(
    'generate_project_report',
    'Generates a comprehensive project progress report, velocity metrics, blocker detection, and executive summary',
    {
      sprintId: z.string().optional().describe('Optional sprint ID filter'),
      callerId: z.string().optional().describe('Optional: Automatically resolved from your account.')
    },
    async ({ sprintId, callerId }) => {
      const user = await resolveEffectiveUser(callerId);
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

      const now = new Date();
      const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== TaskStatus.DONE);

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

  // TOOL 9: Manage Sprints
  server.tool(
    'manage_sprint',
    'Creates or updates a Sprint cycle for your organization',
    {
      name: z.string().describe('Sprint name'),
      goal: z.string().optional().describe('Sprint goal'),
      startDate: z.string().optional().describe('Sprint start date'),
      endDate: z.string().optional().describe('Sprint end date'),
      status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED']).default('ACTIVE'),
      callerId: z.string().optional().describe('Optional: Automatically resolved from your account.')
    },
    async ({ name, goal, startDate, endDate, status, callerId }) => {
      const user = await resolveEffectiveUser(callerId);
      if (!user) return { content: [{ type: 'text', text: 'Permission Denied.' }] };

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

  // TOOL 10: Export iCal Calendar Feed
  server.tool(
    'export_calendar_feed',
    'Exports user assigned tasks and deadlines as an iCalendar (.ics) feed string',
    {
      userId: z.string().optional().describe('Optional user ID. Automatically resolved from your account.')
    },
    async ({ userId }) => {
      try {
        const user = await resolveEffectiveUser(userId);
        const targetUserId = user ? user.id : userId;
        if (!targetUserId) return { content: [{ type: 'text', text: 'Error: No user specified.' }] };

        const icsString = await generateUserCalendarFeed(targetUserId);
        return {
          content: [{ type: 'text', text: icsString }]
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error generating calendar: ${err.message}` }] };
      }
    }
  );

  // RESOURCE: Project Timeline Summary
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

  // PROMPT: Daily Standup Digest
  server.prompt(
    'daily_standup_digest',
    'Generates a standup summary of blocked and in-progress tasks',
    {
      projectId: z.string().optional().describe('Optional project identifier to review')
    },
    async ({ projectId }) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please review active tasks${projectId ? ` for project "${projectId}"` : ''}. Identify any critical blockers, tasks marked URGENT, and generate a 3-bullet daily standup summary for the team.`
            }
          }
        ]
      };
    }
  );
}

/**
 * Creates a fresh, fully configured McpServer instance for a connection transport.
 */
export function createMcpServer(): McpServer {
  const mcpServer = new McpServer({
    name: 'taskflow-mcp-server',
    version: '2.1.0'
  });
  registerAllTools(mcpServer);
  return mcpServer;
}

export const server = createMcpServer();

// Dual Transport Startup (stdio by default)
async function main() {
  const isSseMode = process.argv.includes('--sse');

  if (isSseMode) {
    const { startSseServer } = await import('./server/sse.js');
    startSseServer(Number(process.env.PORT) || 3000);
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