import 'dotenv/config';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { prisma } from './db.js';
import { Role, Priority, TaskStatus, TaskType, ActorType } from '@prisma/client';
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

  // ==========================================
  // TOOL 2: Create Task
  // ==========================================
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
          actorType: ActorType.AI_AGENT,
          actorName: 'Antigravity MCP Agent',
          details: `Task "${title}" created by ${user.name || user.email}`
        }
      }).catch(() => {});

      eventBus.emit('TASK_CREATED', { task, organizationId: user.organizationId });

      return {
        content: [{ type: 'text', text: `Success: Task "${task.title}" created with ID "${task.id}" in your workspace!` }]
      };
    }
  );

  // ==========================================
  // TOOL 3: List Tasks
  // ==========================================
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

  // ==========================================
  // TOOL 4: Get Task Details
  // ==========================================
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

  // ==========================================
  // TOOL 5: Add Comment to Task
  // ==========================================
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
          actorType: ActorType.AI_AGENT,
          actorName: 'Antigravity MCP Agent',
          details: `Comment added by ${user.name || user.email}: "${content.substring(0, 50)}..."`
        }
      });

      eventBus.emit('COMMENT_ADDED', { taskId, comment, organizationId: user.organizationId });

      return {
        content: [{ type: 'text', text: `Success: Comment added to task "${taskId}".` }]
      };
    }
  );

  // ==========================================
  // TOOL 6: Update Task Status
  // ==========================================
  server.tool(
    'update_task_status',
    'Transitions task through the DAG workflow state machine with automatic prerequisite validation',
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
        const updated = await transitionTaskStatus(
          taskId,
          newStatus,
          user.organizationId,
          user.id,
          ActorType.AI_AGENT,
          'Antigravity MCP Agent'
        );
        return {
          content: [{ type: 'text', text: `Success: Task "${taskId}" transitioned to state "${updated.status}".` }]
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Workflow Error: ${err.message}` }] };
      }
    }
  );

  // ==========================================
  // TOOL 7: Set Task Dependency
  // ==========================================
  server.tool(
    'set_task_dependency',
    'Defines that task A depends on task B being completed first (DAG Directed Acyclic Graph)',
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
          actorType: ActorType.AI_AGENT,
          actorName: 'Antigravity MCP Agent',
          details: `Linked dependency on Task ${dependsOnTaskId}`
        }
      }).catch(() => {});

      return {
        content: [{ type: 'text', text: `Dependency linked: Task ${taskId} is now blocked by Task ${dependsOnTaskId}.` }]
      };
    }
  );

  // ==========================================
  // TOOL 8: Generate Project Analytics Report
  // ==========================================
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

  // ==========================================
  // TOOL 9: Manage Sprints
  // ==========================================
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

  // ==========================================
  // TOOL 10: Export iCal Calendar Feed
  // ==========================================
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

  // ==========================================
  // TOOL 11: Auto-Epic Decomposer (Autonomous DevOps)
  // ==========================================
  server.tool(
    'decompose_epic',
    'Autonomous Epic Decomposer: Automatically decomposes a complex technical epic or feature into subtasks with DAG dependency chains and effort estimates',
    {
      epicTitle: z.string().describe('Title of the epic or feature brief'),
      description: z.string().describe('Detailed technical requirements and architecture goals'),
      projectId: z.string().optional().describe('Optional project ID'),
      subtasks: z.array(z.object({
        title: z.string().describe('Subtask title'),
        description: z.string().optional().describe('Subtask implementation details'),
        estimatedHours: z.number().positive().describe('Estimated hours of effort'),
        priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
        type: z.nativeEnum(TaskType).default(TaskType.FEATURE),
        dependsOnIndices: z.array(z.number()).optional().describe('0-based indices of prerequisite subtasks in this list')
      })).min(1).describe('Array of subtasks with dependency indices'),
      callerId: z.string().optional().describe('Optional caller user ID or email')
    },
    async ({ epicTitle, description, projectId, subtasks, callerId }) => {
      const user = await resolveEffectiveUser(callerId);
      if (!user) return { content: [{ type: 'text', text: 'User account not found.' }] };

      let targetProjectId = projectId;
      if (!targetProjectId) {
        const firstProj = await prisma.project.findFirst({
          where: { workspace: { organizationId: user.organizationId } }
        });
        targetProjectId = firstProj?.id;
      }

      const createdTasks: any[] = [];

      // 1. Create all subtasks sequentially
      for (const st of subtasks) {
        const task = await prisma.task.create({
          data: {
            title: `[${epicTitle}] ${st.title}`,
            description: st.description || `Part of Epic: ${epicTitle}\n\n${description}`,
            priority: st.priority,
            type: st.type,
            estimatedHours: st.estimatedHours,
            projectId: targetProjectId,
            organizationId: user.organizationId,
            createdById: user.id,
            assigneeId: user.id,
            status: TaskStatus.BACKLOG
          }
        });
        createdTasks.push(task);
      }

      // 2. Link DAG dependencies using indices
      const linkedDependencies: Array<{ task: string; dependsOn: string }> = [];
      for (let i = 0; i < subtasks.length; i++) {
        const subtask = subtasks[i];
        if (subtask.dependsOnIndices && subtask.dependsOnIndices.length > 0) {
          const currentTaskId = createdTasks[i].id;
          for (const depIdx of subtask.dependsOnIndices) {
            if (depIdx >= 0 && depIdx < createdTasks.length && depIdx !== i) {
              const prereqTaskId = createdTasks[depIdx].id;
              await prisma.taskDependency.create({
                data: {
                  taskId: currentTaskId,
                  dependsOnTaskId: prereqTaskId
                }
              }).catch(() => {});
              linkedDependencies.push({
                task: createdTasks[i].title,
                dependsOn: createdTasks[depIdx].title
              });
            }
          }
        }
      }

      eventBus.emit('EPIC_DECOMPOSED', {
        epicTitle,
        subtasksCount: createdTasks.length,
        organizationId: user.organizationId,
        tasks: createdTasks
      });

      return {
        content: [{
          type: 'text',
          text: `🚀 Epic "${epicTitle}" successfully decomposed into ${createdTasks.length} subtasks!\n\n` +
                `### 📋 Created Subtasks:\n` +
                createdTasks.map((t, idx) => `${idx + 1}. **${t.title}** (${t.estimatedHours}h, ${t.priority}) - ID: \`${t.id}\``).join('\n') +
                (linkedDependencies.length > 0 ? `\n\n### 🔗 DAG Dependency Chain:\n` + linkedDependencies.map(d => `* *${d.task}* ➜ blocked by *${d.dependsOn}*`).join('\n') : '')
        }]
      };
    }
  );

  // ==========================================
  // TOOL 12: Autonomous Bug Triage Tool
  // ==========================================
  server.tool(
    'triage_bug_ticket',
    'Autonomous Bug Triage: Ingests error logs, telemetry or stack traces, creates a prioritized bug ticket, checks for existing related issues, and links blockers',
    {
      errorSummary: z.string().describe('Error message or exception headline'),
      stackTrace: z.string().optional().describe('Stack trace or console error log'),
      severity: z.nativeEnum(Priority).default(Priority.HIGH).describe('Severity assessment'),
      moduleName: z.string().optional().describe('Affected subsystem or component'),
      reproductionSteps: z.string().optional().describe('Observed steps or context'),
      projectId: z.string().optional().describe('Optional project ID'),
      callerId: z.string().optional().describe('Optional caller user ID or email')
    },
    async ({ errorSummary, stackTrace, severity, moduleName, reproductionSteps, projectId, callerId }) => {
      const user = await resolveEffectiveUser(callerId);
      if (!user) return { content: [{ type: 'text', text: 'User account not found.' }] };

      let targetProjectId = projectId;
      if (!targetProjectId) {
        const firstProj = await prisma.project.findFirst({
          where: { workspace: { organizationId: user.organizationId } }
        });
        targetProjectId = firstProj?.id;
      }

      // Check for possible duplicate bugs
      const existingBugs = await prisma.task.findMany({
        where: {
          organizationId: user.organizationId,
          type: TaskType.BUG,
          status: { not: TaskStatus.DONE }
        },
        select: { id: true, title: true, status: true }
      });

      const possibleDuplicates = existingBugs.filter(b =>
        b.title.toLowerCase().includes(errorSummary.toLowerCase().substring(0, 20))
      );

      const taskDescription = `### 🐛 Production Crash / Bug Report\n\n` +
        `**Component:** ${moduleName || 'Core Service'}\n\n` +
        (reproductionSteps ? `**Reproduction Steps:**\n${reproductionSteps}\n\n` : '') +
        (stackTrace ? `**Stack Trace:**\n\`\`\`\n${stackTrace}\n\`\`\`\n` : '') +
        (possibleDuplicates.length > 0 ? `\n> ⚠️ *Possible duplicate active tickets:* ${possibleDuplicates.map(d => `\`${d.id}\` (${d.title})`).join(', ')}` : '');

      const bugTask = await prisma.task.create({
        data: {
          title: `[BUG] ${errorSummary}`,
          description: taskDescription,
          priority: severity,
          type: TaskType.BUG,
          projectId: targetProjectId,
          organizationId: user.organizationId,
          createdById: user.id,
          assigneeId: user.id,
          status: TaskStatus.BACKLOG
        }
      });

      await prisma.activityLog.create({
        data: {
          taskId: bugTask.id,
          userId: user.id,
          action: 'BUG_TRIAGED',
          actorType: ActorType.AI_AGENT,
          actorName: 'Antigravity Sentry Telemetry Agent',
          details: `Ingested automated bug triage for "${errorSummary}"`
        }
      }).catch(() => {});

      eventBus.emit('TASK_CREATED', { task: bugTask, organizationId: user.organizationId });

      return {
        content: [{
          type: 'text',
          text: `🚨 Bug Ticket Created: **[BUG] ${errorSummary}** (ID: \`${bugTask.id}\`, Priority: ${bugTask.priority})\n` +
                (possibleDuplicates.length > 0 ? `⚠️ Found ${possibleDuplicates.length} possible related active bug tickets.` : `✅ No duplicate active bugs detected.`)
        }]
      };
    }
  );

  // ==========================================
  // TOOL 13: AI Scrum Master / Daily Standup Reporter
  // ==========================================
  server.tool(
    'generate_standup_digest',
    'AI Scrum Master: Computes a structured 3-bullet standup briefing covering deliverables in the last 24h, active in-progress items, and critical path blockers',
    {
      projectId: z.string().optional().describe('Optional project ID filter'),
      callerId: z.string().optional().describe('Optional caller user ID or email')
    },
    async ({ projectId, callerId }) => {
      const user = await resolveEffectiveUser(callerId);
      if (!user) return { content: [{ type: 'text', text: 'User account not found.' }] };

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [completed24h, inProgress, blocked, overdue] = await Promise.all([
        prisma.task.findMany({
          where: {
            organizationId: user.organizationId,
            status: TaskStatus.DONE,
            updatedAt: { gte: oneDayAgo },
            ...(projectId ? { projectId } : {})
          },
          include: { assignee: { select: { name: true } } }
        }),
        prisma.task.findMany({
          where: {
            organizationId: user.organizationId,
            status: TaskStatus.IN_PROGRESS,
            ...(projectId ? { projectId } : {})
          },
          include: { assignee: { select: { name: true } } }
        }),
        prisma.task.findMany({
          where: {
            organizationId: user.organizationId,
            status: TaskStatus.BLOCKED,
            ...(projectId ? { projectId } : {})
          },
          include: {
            assignee: { select: { name: true } },
            dependencies: { include: { dependsOnTask: { select: { title: true } } } }
          }
        }),
        prisma.task.findMany({
          where: {
            organizationId: user.organizationId,
            status: { not: TaskStatus.DONE },
            dueDate: { lt: new Date() },
            ...(projectId ? { projectId } : {})
          },
          select: { title: true, dueDate: true }
        })
      ]);

      const standupBriefing = `### ☀️ Daily Standup Briefing (${new Date().toLocaleDateString()})\n\n` +
        `#### 1. ✅ Delivered in the Last 24 Hours:\n` +
        (completed24h.length > 0
          ? completed24h.map(t => `* **${t.title}** (Closed by ${t.assignee?.name || 'Team'})`).join('\n')
          : '* No completed tasks in the last 24h cycle.') + '\n\n' +
        `#### 2. ⚡ Currently In Progress:\n` +
        (inProgress.length > 0
          ? inProgress.map(t => `* **${t.title}** (Assigned to: ${t.assignee?.name || 'Unassigned'})`).join('\n')
          : '* No tasks currently marked IN_PROGRESS.') + '\n\n' +
        `#### 3. 🚨 Critical Blockers & Overdue:\n` +
        (blocked.length > 0
          ? blocked.map(t => `* 🛑 **${t.title}** is blocked by *${t.dependencies.map(d => d.dependsOnTask.title).join(', ')}*`).join('\n')
          : '* No active blockers! Clean sailing.') +
        (overdue.length > 0 ? `\n* ⚠️ *${overdue.length} overdue task(s) require attention.*` : '');

      return {
        content: [{ type: 'text', text: standupBriefing }]
      };
    }
  );

  // ==========================================
  // MCP DYNAMIC RESOURCES (Live Real-Time Data)
  // ==========================================

  // Resource 1: Project Timeline Summary
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

  // Resource 2: Current Sprint Burndown Live Stream
  server.resource(
    'sprint_burndown',
    'taskflow://sprint/current/burndown',
    async (uri) => {
      const activeSprint = await prisma.sprint.findFirst({
        where: { status: 'ACTIVE' },
        include: { tasks: true }
      });

      const totalTasks = activeSprint?.tasks.length || 0;
      const completed = activeSprint?.tasks.filter(t => t.status === TaskStatus.DONE).length || 0;
      const totalHours = activeSprint?.tasks.reduce((s, t) => s + (t.estimatedHours || 0), 0) || 0;
      const remainingHours = activeSprint?.tasks.filter(t => t.status !== TaskStatus.DONE).reduce((s, t) => s + (t.estimatedHours || 0), 0) || 0;

      const burndown = {
        sprint: activeSprint?.name || 'Default Sprint',
        status: activeSprint?.status || 'ACTIVE',
        totalTasks,
        completedTasks: completed,
        totalHours,
        remainingHours,
        burnPercentage: totalHours > 0 ? `${Math.round(((totalHours - remainingHours) / totalHours) * 100)}%` : '0%'
      };

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(burndown, null, 2),
          mimeType: 'application/json'
        }]
      };
    }
  );

  // Resource 3: Team Workload Distribution
  server.resource(
    'team_workload',
    'taskflow://team/workload-distribution',
    async (uri) => {
      const users = await prisma.user.findMany({
        include: {
          assignedTasks: {
            where: { status: { not: TaskStatus.DONE } }
          }
        }
      });

      const distribution = users.map(u => ({
        user: u.name || u.email,
        activeTasksCount: u.assignedTasks.length,
        totalEstimatedHours: u.assignedTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
      }));

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(distribution, null, 2),
          mimeType: 'application/json'
        }]
      };
    }
  );

  // ==========================================
  // MCP PROMPTS (Slash Command Prompt Templates)
  // ==========================================

  // Prompt 1: Daily Standup Digest
  server.prompt(
    'daily_standup_digest',
    'Generates an automated daily standup summary of delivered, in-progress, and blocked tasks',
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

  // Prompt 2: Sprint Planning Assistant
  server.prompt(
    'sprint_planning',
    'Guides the team through sprint capacity estimation and backlog grooming',
    {
      sprintGoal: z.string().describe('Target objective of this upcoming sprint')
    },
    async ({ sprintGoal }) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `We are planning our upcoming sprint with the goal: "${sprintGoal}".\n` +
                    `Please inspect the team workload via taskflow://team/workload-distribution, evaluate current BACKLOG items using list_tasks, and propose a prioritized sprint backlog with effort estimations and dependency ordering.`
            }
          }
        ]
      };
    }
  );

  // Prompt 3: Blocker Triage & Circular Dependency Resolver
  server.prompt(
    'blocker_triage',
    'Diagnoses critical path blockers and recommends unblocking sequences',
    {},
    async () => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please fetch all BLOCKED tasks using list_tasks(status: "BLOCKED"). For each blocked task, trace its dependencies via get_task_details, identify root prerequisite bottlenecks, and recommend the exact step-by-step resolution order to unblock the team.`
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
    version: '2.2.0'
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