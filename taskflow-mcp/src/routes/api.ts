import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { Role, Priority, TaskStatus, TaskType } from '@prisma/client';
import { transitionTaskStatus } from '../stateMachine.js';
import { eventBus } from '../eventBus.js';
import { generateUserCalendarFeed } from '../calendar.js';

export const apiRouter = Router();

// Set of active SSE client response streams for live real-time UI updates
const activeSseClients = new Set<Response>();

// -------------------------------------------------------------
// Real-time Event Stream (SSE)
// -------------------------------------------------------------
apiRouter.get('/events/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  activeSseClients.add(res);

  // Send initial connected heartbeat
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    activeSseClients.delete(res);
  });
});

// Broadcast helper for event bus
function broadcastEvent(eventType: string, payload: any) {
  const message = `data: ${JSON.stringify({ type: eventType, data: payload, timestamp: new Date().toISOString() })}\n\n`;
  for (const client of activeSseClients) {
    try {
      client.write(message);
    } catch {
      activeSseClients.delete(client);
    }
  }
}

eventBus.on('TASK_ASSIGNED', (data) => broadcastEvent('TASK_ASSIGNED', data));
eventBus.on('TASK_BLOCKED', (data) => broadcastEvent('TASK_BLOCKED', data));

// -------------------------------------------------------------
// Workspaces
// -------------------------------------------------------------
apiRouter.get('/workspaces', async (req: Request, res: Response) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      include: {
        projects: {
          include: {
            teamLead: true,
            members: true,
            tasks: {
              include: {
                assignee: true,
                comments: { include: { user: true } },
                dependencies: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const users = await prisma.user.findMany();

    // Format to match frontend structure
    const formatted = workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      slug: ws.slug || ws.name.toLowerCase().replace(/\s+/g, '-'),
      description: ws.description || '',
      organizationId: ws.organizationId,
      createdAt: ws.createdAt.toISOString(),
      updatedAt: ws.updatedAt.toISOString(),
      members: users.map((u) => ({
        id: `m_${u.id}`,
        userId: u.id,
        workspaceId: ws.id,
        role: u.role === Role.ADMIN ? 'ADMIN' : 'MEMBER',
        user: u,
      })),
      projects: ws.projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priority: p.priority,
        status: p.status,
        progress: p.progress,
        start_date: p.startDate ? p.startDate.toISOString().split('T')[0] : undefined,
        end_date: p.endDate ? p.endDate.toISOString().split('T')[0] : undefined,
        workspaceId: p.workspaceId,
        team_lead: p.teamLead,
        members: p.members,
        tasks: p.tasks.map((t) => ({
          id: t.id,
          projectId: t.projectId,
          title: t.title,
          description: t.description,
          status: t.status,
          type: t.type,
          priority: t.priority,
          assigneeId: t.assigneeId,
          assignee: t.assignee,
          due_date: t.dueDate ? t.dueDate.toISOString().split('T')[0] : undefined,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          comments: t.comments.map((c) => ({
            id: c.id,
            user: c.user,
            content: c.content,
            createdAt: c.createdAt.toISOString(),
          })),
        })),
      })),
    }));

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/workspaces', async (req: Request, res: Response) => {
  try {
    const { name, slug, description, organizationSlug } = req.body;

    let org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({
        data: { name: 'Acme Corporation', slug: organizationSlug || 'acme' },
      });
    }

    const ws = await prisma.workspace.create({
      data: {
        name: name || 'New Workspace',
        slug: slug || name?.toLowerCase().replace(/\s+/g, '-') || 'workspace',
        description,
        organizationId: org.id,
      },
    });

    res.status(201).json(ws);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Projects
// -------------------------------------------------------------
apiRouter.get('/projects', async (req: Request, res: Response) => {
  try {
    const { workspaceId, status, priority, search } = req.query;

    const where: any = {};
    if (workspaceId) where.workspaceId = workspaceId as string;
    if (status && status !== 'ALL') where.status = status as string;
    if (priority && priority !== 'ALL') where.priority = priority as Priority;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        teamLead: true,
        members: true,
        tasks: {
          include: {
            assignee: true,
            comments: { include: { user: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/projects/:id', async (req: Request, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        teamLead: true,
        members: true,
        tasks: {
          include: {
            assignee: true,
            comments: { include: { user: true } },
            dependencies: true,
          },
        },
      },
    });

    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/projects', async (req: Request, res: Response) => {
  try {
    const { name, description, priority, status, start_date, end_date, teamLeadId, memberIds, workspaceId } = req.body;

    let wsId = workspaceId;
    if (!wsId) {
      const defaultWs = await prisma.workspace.findFirst();
      wsId = defaultWs?.id;
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        priority: priority || Priority.MEDIUM,
        status: status || 'PLANNING',
        progress: 0,
        startDate: start_date ? new Date(start_date) : undefined,
        endDate: end_date ? new Date(end_date) : undefined,
        workspaceId: wsId,
        teamLeadId,
        members: memberIds && memberIds.length > 0 ? { connect: memberIds.map((id: string) => ({ id })) } : undefined,
      },
      include: {
        teamLead: true,
        members: true,
        tasks: true,
      },
    });

    broadcastEvent('PROJECT_CREATED', { projectId: project.id, name: project.name });
    res.status(201).json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/projects/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, priority, status, progress, start_date, end_date } = req.body;

    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(progress !== undefined ? { progress: Number(progress) } : {}),
        ...(start_date !== undefined ? { startDate: start_date ? new Date(start_date) : null } : {}),
        ...(end_date !== undefined ? { endDate: end_date ? new Date(end_date) : null } : {}),
      },
      include: {
        teamLead: true,
        members: true,
        tasks: true,
      },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/projects/:id/members', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        members: { connect: { id: userId } },
      },
      include: { members: true },
    });

    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Tasks & State Machine
// -------------------------------------------------------------
apiRouter.get('/tasks', async (req: Request, res: Response) => {
  try {
    const { projectId, workspaceId, status, priority, type, assigneeId } = req.query;

    const where: any = {};
    if (projectId) where.projectId = projectId as string;
    if (workspaceId) where.workspaceId = workspaceId as string;
    if (status && status !== 'ALL') where.status = status as TaskStatus;
    if (priority && priority !== 'ALL') where.priority = priority as Priority;
    if (type && type !== 'ALL') where.type = type as TaskType;
    if (assigneeId && assigneeId !== 'ALL') where.assigneeId = assigneeId as string;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: true,
        project: true,
        comments: { include: { user: true } },
        dependencies: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        assignee: true,
        project: true,
        comments: { include: { user: true }, orderBy: { createdAt: 'asc' } },
        dependencies: { include: { dependsOnTask: true } },
      },
    });

    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/tasks', async (req: Request, res: Response) => {
  try {
    const { title, description, priority, status, type, estimatedHours, dueDate, projectId, assigneeId, callerId } = req.body;

    let org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({ data: { name: 'Acme Corporation', slug: 'acme' } });
    }

    const defaultUser = await prisma.user.findFirst();
    const creatorId = callerId || defaultUser?.id || 'user_1';

    let wsId: string | undefined;
    if (projectId) {
      const proj = await prisma.project.findUnique({ where: { id: projectId } });
      wsId = proj?.workspaceId;
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority: priority || Priority.MEDIUM,
        status: status || TaskStatus.TODO,
        type: type || TaskType.FEATURE,
        estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        projectId,
        workspaceId: wsId,
        organizationId: org.id,
        createdById: creatorId,
        assigneeId,
      },
      include: {
        assignee: true,
        project: true,
        comments: true,
      },
    });

    if (assigneeId) {
      eventBus.emit('TASK_ASSIGNED', {
        taskId: task.id,
        taskTitle: task.title,
        assigneeId,
        organizationId: org.id,
      });
    }

    broadcastEvent('TASK_CREATED', task);
    res.status(201).json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/tasks/:id/status', async (req: Request, res: Response) => {
  try {
    const { newStatus } = req.body;
    if (!newStatus) return res.status(400).json({ error: 'newStatus is required' });

    // Enforce DAG state machine validation
    const updated = await transitionTaskStatus(req.params.id, newStatus as TaskStatus);

    broadcastEvent('TASK_STATUS_UPDATED', { taskId: updated.id, status: updated.status });
    res.json(updated);
  } catch (err: any) {
    // Return 400 with blocker or invalid transition error message
    res.status(400).json({ error: err.message, isBlockerError: err.message.includes('BLOCKED') });
  }
});

apiRouter.patch('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const { title, description, priority, type, estimatedHours, dueDate, assigneeId } = req.body;

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(estimatedHours !== undefined ? { estimatedHours: Number(estimatedHours) } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(assigneeId !== undefined ? { assigneeId } : {}),
      },
      include: {
        assignee: true,
        project: true,
        comments: { include: { user: true } },
      },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/tasks/batch-delete', async (req: Request, res: Response) => {
  try {
    const { taskIds } = req.body;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'taskIds array is required' });
    }

    const result = await prisma.task.deleteMany({
      where: { id: { in: taskIds } },
    });

    broadcastEvent('TASKS_DELETED', { taskIds });
    res.json({ success: true, count: result.count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Comments
// -------------------------------------------------------------
apiRouter.post('/tasks/:id/comments', async (req: Request, res: Response) => {
  try {
    const { content, userId } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Comment content is required' });

    let authorId = userId;
    if (!authorId) {
      const firstUser = await prisma.user.findFirst();
      authorId = firstUser?.id || 'user_1';
    }

    const comment = await prisma.comment.create({
      data: {
        taskId: req.params.id,
        userId: authorId,
        content: content.trim(),
      },
      include: { user: true },
    });

    broadcastEvent('COMMENT_ADDED', { taskId: req.params.id, comment });
    res.status(201).json(comment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Calendar Feed (.ics)
// -------------------------------------------------------------
apiRouter.get('/calendar/:userId/feed.ics', async (req: Request, res: Response) => {
  try {
    const icsContent = await generateUserCalendarFeed(req.params.userId);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="taskflow-schedule.ics"`);
    res.send(icsContent);
  } catch (err: any) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// -------------------------------------------------------------
// Dashboard Stats
// -------------------------------------------------------------
apiRouter.get('/dashboard/stats', async (req: Request, res: Response) => {
  try {
    const { workspaceId, userId } = req.query;

    const projectWhere: any = workspaceId ? { workspaceId: workspaceId as string } : {};
    const taskWhere: any = workspaceId ? { workspaceId: workspaceId as string } : {};

    const totalProjects = await prisma.project.count({ where: projectWhere });
    const completedProjects = await prisma.project.count({ where: { ...projectWhere, status: 'COMPLETED' } });

    const targetUserId = (userId as string) || 'user_1';
    const myTasks = await prisma.task.count({
      where: { ...taskWhere, assigneeId: targetUserId, status: { not: TaskStatus.DONE } },
    });

    const overdueTasks = await prisma.task.count({
      where: {
        ...taskWhere,
        dueDate: { lt: new Date() },
        status: { not: TaskStatus.DONE },
      },
    });

    res.json({
      totalProjects,
      completedProjects,
      myTasks,
      overdueTasks,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Members & Invites
// -------------------------------------------------------------
apiRouter.get('/workspaces/:id/members', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/workspaces/:id/invites', async (req: Request, res: Response) => {
  try {
    const { email, role } = req.body;
    let org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({ data: { name: 'Acme Corporation', slug: 'acme' } });
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { role: role === 'ADMIN' ? Role.ADMIN : Role.CONTRIBUTOR },
      create: {
        email,
        name: email.split('@')[0],
        role: role === 'ADMIN' ? Role.ADMIN : Role.CONTRIBUTOR,
        image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
        organizationId: org.id,
      },
    });

    broadcastEvent('MEMBER_INVITED', { user });
    res.status(201).json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
