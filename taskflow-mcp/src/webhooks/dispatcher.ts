import crypto from 'crypto';
import { prisma } from '../db.js';

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
  organizationId: string;
}

/**
 * Dispatches signed webhook events to all active registered webhooks for an organization.
 */
export async function dispatchWebhookEvent(event: string, data: any, organizationId: string) {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        organizationId,
        active: true
      }
    });

    if (!webhooks || webhooks.length === 0) return;

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      organizationId
    };

    const payloadString = JSON.stringify(payload);

    for (const webhook of webhooks) {
      // If webhook subscribes to specific events, check inclusion
      if (webhook.events && webhook.events.length > 0 && !webhook.events.includes('*') && !webhook.events.includes(event)) {
        continue;
      }

      // Check if it is a Slack/Discord webhook URL
      const isSlack = webhook.url.includes('hooks.slack.com');
      const isDiscord = webhook.url.includes('discord.com/api/webhooks');

      let bodyToSend: string = payloadString;
      let contentType = 'application/json';

      if (isSlack) {
        bodyToSend = JSON.stringify({
          text: `🔔 *TaskFlow Event: ${event}*\n> ${formatEventSummary(event, data)}`
        });
      } else if (isDiscord) {
        bodyToSend = JSON.stringify({
          content: `🔔 **TaskFlow Event: ${event}**\n${formatEventSummary(event, data)}`
        });
      }

      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'User-Agent': 'TaskFlow-Webhook-Dispatcher/2.1.0'
      };

      if (webhook.secret) {
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(payloadString)
          .digest('hex');
        headers['X-TaskFlow-Signature'] = `sha256=${signature}`;
      }

      // Fire and forget with timeout
      fetch(webhook.url, {
        method: 'POST',
        headers,
        body: bodyToSend,
        signal: AbortSignal.timeout(5000)
      }).catch(err => {
        console.error(`[Webhook] Delivery failed to ${webhook.url}:`, err.message);
      });
    }
  } catch (err: any) {
    console.error('[Webhook] Dispatcher error:', err.message);
  }
}

function formatEventSummary(event: string, data: any): string {
  switch (event) {
    case 'TASK_CREATED':
      return `New Task Created: *${data.title || data.task?.title || 'Untitled'}* (Priority: ${data.priority || data.task?.priority || 'MEDIUM'})`;
    case 'TASK_STATUS_UPDATED':
      return `Task Status Transition: *${data.taskId}* is now *${data.status}*`;
    case 'TASK_UNBLOCKED':
      return `🚀 Task Unblocked: *${data.taskTitle || data.taskId}* is now ready for work!`;
    case 'COMMENT_ADDED':
      return `Comment added on Task *${data.taskId}*: "${data.comment?.content || ''}"`;
    case 'EPIC_DECOMPOSED':
      return `Auto-Epic Decomposed: *${data.epicTitle}* (${data.subtasksCount} subtasks created)`;
    default:
      return JSON.stringify(data);
  }
}
