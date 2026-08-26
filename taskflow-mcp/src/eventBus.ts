import { EventEmitter } from 'events';
import { prisma } from './db.js';
import type { Response } from 'express';
import { dispatchWebhookEvent } from './webhooks/dispatcher.js';

class ProjectEventBus extends EventEmitter {}
export const eventBus = new ProjectEventBus();

// Connected live web UI clients (SSE on /api/v1/events/live)
const liveWebClients = new Set<Response>();

export function registerLiveWebClient(res: Response) {
  liveWebClients.add(res);
  res.on('close', () => {
    liveWebClients.delete(res);
  });
}

export function broadcastLiveEvent(eventType: string, data: any) {
  const payload = JSON.stringify({ event: eventType, timestamp: new Date().toISOString(), data });
  for (const client of liveWebClients) {
    try {
      client.write(`event: task_update\ndata: ${payload}\n\n`);
    } catch {
      liveWebClients.delete(client);
    }
  }
}

// Listen for Task Created Event
eventBus.on('TASK_CREATED', async ({ task, organizationId }) => {
  broadcastLiveEvent('TASK_CREATED', task);
  if (organizationId) {
    dispatchWebhookEvent('TASK_CREATED', task, organizationId);
  }
});

// Listen for Task Status Changed Event
eventBus.on('TASK_STATUS_CHANGED', async ({ taskId, oldStatus, newStatus, task, organizationId }) => {
  broadcastLiveEvent('TASK_STATUS_CHANGED', { taskId, oldStatus, newStatus, task });
  if (organizationId) {
    dispatchWebhookEvent('TASK_STATUS_UPDATED', { taskId, oldStatus, newStatus, task }, organizationId);
  }
});

// Listen for Task Assigned Event
eventBus.on('TASK_ASSIGNED', async ({ taskId, taskTitle, assigneeId, organizationId }) => {
  if (!assigneeId || !organizationId) return;

  await prisma.notification.create({
    data: {
      userId: assigneeId,
      message: `You were assigned to task "${taskTitle}" (${taskId}).`
    }
  }).catch(() => {});

  broadcastLiveEvent('TASK_ASSIGNED', { taskId, taskTitle, assigneeId });
  dispatchWebhookEvent('TASK_ASSIGNED', { taskId, taskTitle, assigneeId }, organizationId);
});

// Listen for Blocker Alert
eventBus.on('TASK_BLOCKED', async ({ taskId, taskTitle, organizationId, blockerIds }) => {
  if (!organizationId) return;

  const managers = await prisma.user.findMany({
    where: {
      organizationId,
      role: { in: ['ADMIN', 'PROJECT_MANAGER'] }
    }
  });

  for (const manager of managers) {
    await prisma.notification.create({
      data: {
        userId: manager.id,
        message: `ALERT: Task "${taskTitle}" (${taskId}) is BLOCKED by prerequisite(s): [${blockerIds.join(', ')}].`
      }
    }).catch(() => {});
  }

  broadcastLiveEvent('TASK_BLOCKED', { taskId, taskTitle, blockerIds });
  dispatchWebhookEvent('TASK_BLOCKED', { taskId, taskTitle, blockerIds }, organizationId);
});

// Listen for Task Unblocked Event
eventBus.on('TASK_UNBLOCKED', async ({ taskId, taskTitle, organizationId }) => {
  if (!organizationId) return;
  broadcastLiveEvent('TASK_UNBLOCKED', { taskId, taskTitle });
  dispatchWebhookEvent('TASK_UNBLOCKED', { taskId, taskTitle }, organizationId);
});

// Listen for Comment Added
eventBus.on('COMMENT_ADDED', async ({ taskId, comment, organizationId }) => {
  broadcastLiveEvent('COMMENT_ADDED', { taskId, comment });
  if (organizationId) {
    dispatchWebhookEvent('COMMENT_ADDED', { taskId, comment }, organizationId);
  }
});

// Listen for Epic Decomposed
eventBus.on('EPIC_DECOMPOSED', async ({ epicTitle, subtasksCount, organizationId, tasks }) => {
  broadcastLiveEvent('EPIC_DECOMPOSED', { epicTitle, subtasksCount, tasks });
  if (organizationId) {
    dispatchWebhookEvent('EPIC_DECOMPOSED', { epicTitle, subtasksCount, tasks }, organizationId);
  }
});