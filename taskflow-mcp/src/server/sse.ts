import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { validateApiKey, createApiKey } from '../auth/apiKey.js';
import { server } from '../index.js';
import { prisma } from '../db.js';
import { transitionTaskStatus } from '../stateMachine.js';
import { registerLiveWebClient, eventBus } from '../eventBus.js';
import { generateUserCalendarFeed } from '../calendar.js';
import { TaskStatus, Priority, TaskType, Role } from '@prisma/client';

const app = express();
app.use(cors());
app.use(express.json());

// Locate Frontend Static Build directory
const possibleFrontendPaths = [
  path.join(process.cwd(), 'dist-frontend'),
  path.join(process.cwd(), '../frontend/dist'),
  path.join(process.cwd(), 'public'),
];

let activeFrontendDir = possibleFrontendPaths.find(p => fs.existsSync(p)) || path.join(process.cwd(), 'public');
app.use(express.static(activeFrontendDir));

// Custom Cloud SSE Transport that preserves the full absolute URL
class CloudSSEServerTransport extends SSEServerTransport {
  private _fullOrigin: string;

  constructor(endpoint: string, res: Response, fullOrigin: string) {
    super(endpoint, res);
    this._fullOrigin = fullOrigin;
  }

  async start() {
    if ((this as any)._sseResponse) {
      throw new Error('SSEServerTransport already started!');
    }
    this.res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const fullEndpointUrl = `${this._fullOrigin}/mcp/messages?sessionId=${this.sessionId}`;
    this.res.write(`event: endpoint\ndata: ${fullEndpointUrl}\n\n`);
    (this as any)._sseResponse = this.res;
    this.res.on('close', () => {
      (this as any)._sseResponse = undefined;
      this.onclose?.();
    });
  }
}

// Map to track active SSE transports by sessionId
const transports = new Map<string, SSEServerTransport>();

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    server: 'TaskFlow SaaS Platform & MCP Server (Production)',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Helper to get authenticated user & their private organization/workspace
async function getUserContext(req: Request) {
  const userEmail = (req.headers['x-user-email'] as string) || (req.query.email as string);
  const userName = (req.headers['x-user-name'] as string) || 'User';
  const userId = req.headers['x-user-id'] as string;

  if (!userEmail && !userId) {
    return null;
  }

  let user = await prisma.user.findFirst({
    where: userEmail ? { email: userEmail } : { id: userId },
    include: { organization: { include: { workspaces: true } } }
  });

  if (!user) {
    const slug = (userEmail || 'user').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
    const org = await prisma.organization.create({
      data: {
        name: `${userName}'s Workspace`,
        slug: `${slug}-${Date.now().toString(36)}`,
        workspaces: {
          create: {
            name: `${userName}'s Projects`,
            slug: `ws-${slug}`
          }
        }
      },
      include: { workspaces: true }
    });

    user = await prisma.user.create({
      data: {
        ...(userId ? { id: userId } : {}),
        name: userName,
        email: userEmail || `${userId}@taskflow.local`,
        role: Role.ADMIN,
        organizationId: org.id
      },
      include: { organization: { include: { workspaces: true } } }
    });
  }

  const org = user.organization;
  let workspace = org.workspaces[0];
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: { name: `${user.name}'s Projects`, organizationId: org.id }
    });
  }

  return { org, workspace, user };
}

// =========================================================================
// REST API ENDPOINTS (Multi-Tenant User Isolated)
// =========================================================================

app.get('/api/v1/workspaces', async (req: Request, res: Response) => {
  try {
    const ctx = await getUserContext(req);
    if (!ctx) return res.json([]);

    const workspaces = await prisma.workspace.findMany({
      where: { organizationId: ctx.org.id },
      include: {
        projects: {
          include: {
            tasks: true,
            members: { select: { id: true, name: true, email: true } },
            teamLead: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    res.json(workspaces);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/workspaces', async (req: Request, res: Response) => {
  try {
    const ctx = await getUserContext(req);
    if (!ctx) return res.status(401).json({ error: 'Unauthorized: User not signed in' });

    const { name, slug, description } = req.body;

    const workspace = await prisma.workspace.create({
      data: {
        name: name || 'New Workspace',
        slug,
        description,
        organizationId: ctx.org.id
      }
    });

    res.status(201).json(workspace);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/projects', async (req: Request, res: Response) => {
  try {
    const ctx = await getUserContext(req);
    if (!ctx) return res.json([]);

    const { workspaceId } = req.query;

    const projects = await prisma.project.findMany({
      where: {
        workspace: { organizationId: ctx.org.id },
        ...(workspaceId ? { workspaceId: String(workspaceId) } : {})
      },
      include: {
        tasks: {
          include: {
            assignee: { select: { id: true, name: true, email: true } },
            dependencies: { select: { dependsOnTaskId: true } }
          }
        },
        members: { select: { id: true, name: true, email: true } },
        teamLead: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/projects/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        tasks: {
          include: {
            assignee: { select: { id: true, name: true, email: true } },
            dependencies: { select: { dependsOnTaskId: true } }
          }
        },
        members: { select: { id: true, name: true, email: true } },
        teamLead: { select: { id: true, name: true, email: true } }
      }
    });

    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/projects', async (req: Request, res: Response) => {
  try {
    const ctx = await getUserContext(req);
    if (!ctx) return res.status(401).json({ error: 'Unauthorized: User not signed in' });

    const { name, description, priority, startDate, endDate, workspaceId } = req.body;

    const project = await prisma.project.create({
      data: {
        name,
        description,
        priority: priority || Priority.MEDIUM,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        workspaceId: workspaceId || ctx.workspace.id,
        teamLeadId: ctx.user.id,
        members: { connect: [{ id: ctx.user.id }] }
      },
      include: {
        members: true,
        tasks: true
      }
    });

    res.status(201).json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/dashboard/stats', async (req: Request, res: Response) => {
  try {
    const ctx = await getUserContext(req);
    if (!ctx) {
      return res.json({
        totalProjects: 0,
        completedProjects: 0,
        myTasks: 0,
        overdueTasks: 0,
        projects: [],
        recentActivity: []
      });
    }

    const [projects, tasks, activities] = await Promise.all([
      prisma.project.findMany({
        where: { workspace: { organizationId: ctx.org.id } },
        include: { tasks: true, members: true }
      }),
      prisma.task.findMany({
        where: { organizationId: ctx.org.id },
        include: { assignee: true, project: true }
      }),
      prisma.activityLog.findMany({
        where: { task: { organizationId: ctx.org.id } },
        include: { user: true, task: { include: { project: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8
      })
    ]);

    const totalProjects = projects.length;
    const completedProjects = projects.filter(p => p.status === 'COMPLETED' || p.progress === 100).length;
    const myTasks = tasks.filter(t => t.assigneeId === ctx.user.id && t.status !== TaskStatus.DONE).length;
    
    const now = new Date();
    const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== TaskStatus.DONE).length;

    res.json({
      totalProjects,
      completedProjects,
      myTasks,
      overdueTasks,
      projects,
      recentActivity: activities
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/tasks', async (req: Request, res: Response) => {
  try {
    const ctx = await getUserContext(req);
    if (!ctx) return res.json([]);

    const { projectId, assigneeId, status } = req.query;

    const tasks = await prisma.task.findMany({
      where: {
        organizationId: ctx.org.id,
        ...(projectId ? { projectId: String(projectId) } : {}),
        ...(assigneeId ? { assigneeId: String(assigneeId) } : {}),
        ...(status ? { status: status as TaskStatus } : {})
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        dependencies: { include: { dependsOnTask: { select: { id: true, title: true, status: true } } } },
        comments: { select: { id: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/tasks', async (req: Request, res: Response) => {
  try {
    const ctx = await getUserContext(req);
    if (!ctx) return res.status(401).json({ error: 'Unauthorized: User not signed in' });

    const { title, description, priority, type, estimatedHours, dueDate, assigneeId, projectId } = req.body;

    const task = await prisma.task.create({
      data: {
        title: title || 'New Task',
        description,
        priority: priority || Priority.MEDIUM,
        type: type || TaskType.TASK,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        assigneeId: assigneeId || ctx.user.id,
        createdById: ctx.user.id,
        organizationId: ctx.org.id,
        workspaceId: ctx.workspace.id,
        projectId: projectId || undefined,
        status: TaskStatus.BACKLOG
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } }
      }
    });

    eventBus.emit('TASK_CREATED', { task, organizationId: ctx.org.id });

    res.status(201).json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/v1/tasks/:id/status', async (req: Request, res: Response) => {
  try {
    const ctx = await getUserContext(req);
    if (!ctx) return res.status(401).json({ error: 'Unauthorized: User not signed in' });

    const { id } = req.params;
    const { newStatus, status } = req.body;
    const targetStatus = (newStatus || status) as TaskStatus;

    const updated = await transitionTaskStatus(id, targetStatus, ctx.org.id, ctx.user.id);

    res.json(updated);
  } catch (err: any) {
    const isBlocker = err.message.includes('BLOCKED');
    res.status(400).json({ error: err.message, isBlockerError: isBlocker });
  }
});

app.get('/api/v1/tasks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        dependencies: { include: { dependsOnTask: { select: { id: true, title: true, status: true } } } },
        blockedTasks: { include: { task: { select: { id: true, title: true, status: true } } } },
        comments: {
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: 'asc' }
        },
        activityLogs: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/tasks/:id/comments', async (req: Request, res: Response) => {
  try {
    const ctx = await getUserContext(req);
    if (!ctx) return res.status(401).json({ error: 'Unauthorized: User not signed in' });

    const { id } = req.params;
    const { content } = req.body;

    const comment = await prisma.comment.create({
      data: {
        taskId: id,
        userId: ctx.user.id,
        content
      },
      include: { user: { select: { name: true, email: true } } }
    });

    eventBus.emit('COMMENT_ADDED', { taskId: id, comment, organizationId: ctx.org.id });

    res.status(201).json(comment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/calendar/:userId/feed.ics', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const icsString = await generateUserCalendarFeed(userId);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="taskflow-schedule.ics"`);
    res.send(icsString);
  } catch (err: any) {
    res.status(500).send(`Error generating calendar: ${err.message}`);
  }
});

const sseHandler = (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  registerLiveWebClient(res);

  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: new Date().toISOString() })}\n\n`);
};

app.get('/api/v1/events/stream', sseHandler);
app.get('/api/v1/events/live', sseHandler);

// =========================================================================
// REMOTE MCP SSE ENDPOINTS (For AI Clients & Remote Agents)
// =========================================================================

app.post('/api/v1/auth/keys', async (req: Request, res: Response) => {
  try {
    const ctx = await getUserContext(req);
    const orgId = ctx?.org.id || req.body.organizationId;
    const userId = ctx?.user.id || req.body.userId;

    if (!orgId) {
      const firstOrg = await prisma.organization.findFirst();
      if (!firstOrg) return res.status(400).json({ error: 'No organization found' });
      const result = await createApiKey(firstOrg.id, userId, req.body.name || 'Live AI Agent Key');
      return res.status(201).json(result);
    }

    const keyName = req.body.name || (ctx ? `${ctx.user.name || 'User'} AI Client Key` : 'Live AI Agent Key');
    const result = await createApiKey(orgId, userId, keyName);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/mcp/sse', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const rawKey = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7).trim()
    : ((req.query.apiKey as string) || (req.query.key as string) || (req.query.token as string));

  if (!rawKey) {
    return res.status(401).json({ error: 'Unauthorized: Missing API Key (Authorization: Bearer tf_live_... or ?apiKey=tf_live_...)' });
  }

  const authContext = await validateApiKey(rawKey);
  if (!authContext) {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired API Key' });
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const fullOrigin = host ? `${proto}://${host}` : 'http://localhost:3000';
  const endpoint = `${fullOrigin}/mcp/messages`;

  const transport = new CloudSSEServerTransport(endpoint, res, fullOrigin);
  transports.set(transport.sessionId, transport);

  transport.onclose = () => {
    transports.delete(transport.sessionId);
  };

  await server.connect(transport);
});

app.post('/mcp/messages', async (req: Request, res: Response) => {
  const sessionId = (req.query.sessionId as string) || (req.headers['x-session-id'] as string);
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId query parameter' });
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  await transport.handlePostMessage(req, res, req.body);
});

// React Router SPA fallback (all non-API routes serve index.html)
app.use((req: Request, res: Response, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/mcp') && !req.path.startsWith('/health')) {
    const indexPath = path.join(activeFrontendDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

export function startSseServer(port: number = Number(process.env.PORT) || 3000) {
  return app.listen(port, () => {
    console.error(`🚀 TaskFlow SaaS Unified Platform running at http://localhost:${port}`);
    console.error(`📡 Remote MCP SSE Endpoint active at http://localhost:${port}/mcp/sse`);
  });
}
