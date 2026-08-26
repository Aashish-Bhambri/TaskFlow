import { EventEmitter } from 'events';
import { prisma } from './db.js';
import type { Response } from 'express';

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

/**
 * Dispatches an event payload to registered active organization webhooks (e.g. Slack, Discord).
 */
async function dispatchWebhooks(organizationId: string, eventType: string, payload: any) {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { organizationId, active: true }
    });

    for (const webhook of webhooks) {
      fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: eventType,
          timestamp: new Date().toISOString(),
          data: payload,
        })
      }).catch(err => {
        console.error(`Failed to dispatch webhook to ${webhook.url}:`, err.message);
      });
    }
  } catch (err: any) {
    console.error('Error fetching webhooks:', err.message);
  }
}

// Listen for Task Created Event
eventBus.on('TASK_CREATED', async ({ task, organizationId }) => {
  broadcastLiveEvent('TASK_CREATED', task);
  dispatchWebhooks(organizationId, 'task.created', task);
});

// Listen for Task Status Changed Event
eventBus.on('TASK_STATUS_CHANGED', async ({ taskId, oldStatus, newStatus, task, organizationId }) => {
  broadcastLiveEvent('TASK_STATUS_CHANGED', { taskId, oldStatus, newStatus, task });
  dispatchWebhooks(organizationId, 'task.status_changed', { taskId, oldStatus, newStatus });
});

// Listen for Task Assigned Event
eventBus.on('TASK_ASSIGNED', async ({ taskId, taskTitle, assigneeId, organizationId }) => {
  if (!assigneeId || !organizationId) return;

  await prisma.notification.create({
    data: {
      userId: assigneeId,
      organizationId,
      message: `You were assigned to task "${taskTitle}" (${taskId}).`
    }
  }).catch(() => {});

  broadcastLiveEvent('TASK_ASSIGNED', { taskId, taskTitle, assigneeId });
  dispatchWebhooks(organizationId, 'task.assigned', { taskId, taskTitle, assigneeId });
});

// Listen for Blocker Alert
eventBus.on('TASK_BLOCKED', async ({ taskId, taskTitle, organizationId, blockerIds }) => {
  if (!organizationId) return;

  // Notify all Admins and Managers in this organization
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
        organizationId,
        message: `ALERT: Task "${taskTitle}" (${taskId}) is BLOCKED by prerequisite(s): [${blockerIds.join(', ')}].`
      }
    }).catch(() => {});
  }

  broadcastLiveEvent('TASK_BLOCKED', { taskId, taskTitle, blockerIds });
  dispatchWebhooks(organizationId, 'task.blocked', { taskId, taskTitle, blockerIds });
});

// Listen for Comment Added
eventBus.on('COMMENT_ADDED', async ({ taskId, comment, organizationId }) => {
  broadcastLiveEvent('COMMENT_ADDED', { taskId, comment });
  dispatchWebhooks(organizationId, 'comment.added', { taskId, comment });
});