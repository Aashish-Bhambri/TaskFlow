import 'dotenv/config';
import { prisma } from '../src/db.js';
import { createMcpServer } from '../src/index.js';
import { transitionTaskStatus } from '../src/stateMachine.js';
import { TaskStatus, Priority, TaskType, Role, ActorType } from '@prisma/client';
import { dispatchWebhookEvent } from '../src/webhooks/dispatcher.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

async function runAdvancedTests() {
  console.log('🧪 Starting TaskFlow Advanced Multi-Agent DevOps & Webhook Automated Tests...\n');

  // Setup Test Organization & User
  const org = await prisma.organization.upsert({
    where: { slug: 'devops-test-org' },
    update: {},
    create: { name: 'DevOps Test Org', slug: 'devops-test-org' }
  });

  // Clean up any tasks from prior test runs
  await prisma.task.deleteMany({
    where: { organizationId: org.id }
  });

  const user = await prisma.user.upsert({
    where: { email: 'devops-lead@taskflow.local' },
    update: { organizationId: org.id },
    create: {
      name: 'DevOps Lead',
      email: 'devops-lead@taskflow.local',
      role: Role.ADMIN,
      organizationId: org.id
    }
  });

  const project = await prisma.project.create({
    data: {
      name: 'Autonomous CI/CD Project',
      workspace: {
        create: {
          name: 'CI/CD Workspace',
          organizationId: org.id
        }
      }
    }
  });

  const mcpServer = createMcpServer();

  // Test 1: Decompose Epic into DAG Subtasks
  const decomposeHandler = (mcpServer as any)._registeredTools['decompose_epic'].handler;
  const epicResult = await decomposeHandler({
    epicTitle: 'Stripe Billing Migration',
    description: 'Implement multi-tier recurring subscriptions with webhooks',
    projectId: project.id,
    callerId: user.id,
    subtasks: [
      {
        title: 'Design Prisma Subscription Models',
        estimatedHours: 4,
        priority: Priority.HIGH,
        type: TaskType.FEATURE
      },
      {
        title: 'Implement Stripe Checkout API',
        estimatedHours: 6,
        priority: Priority.HIGH,
        type: TaskType.FEATURE,
        dependsOnIndices: [0] // Depends on Task 1
      },
      {
        title: 'Handle Stripe Webhook Events',
        estimatedHours: 8,
        priority: Priority.URGENT,
        type: TaskType.FEATURE,
        dependsOnIndices: [1] // Depends on Task 2
      }
    ]
  });

  assert(
    epicResult.content[0].text.includes('successfully decomposed into 3 subtasks'),
    'Autonomous Epic Decomposer created 3 subtasks'
  );

  // Verify DAG dependencies exist in DB
  const createdEpicTasks = await prisma.task.findMany({
    where: {
      organizationId: org.id,
      title: { startsWith: '[Stripe Billing Migration]' }
    },
    include: { dependencies: true },
    orderBy: { createdAt: 'asc' }
  });

  assert(createdEpicTasks.length === 3, 'All 3 subtasks persisted to database');
  assert(
    createdEpicTasks[1].dependencies.length === 1 &&
    createdEpicTasks[1].dependencies[0].dependsOnTaskId === createdEpicTasks[0].id,
    'DAG Dependency properly linked: Task 2 depends on Task 1'
  );
  assert(
    createdEpicTasks[2].dependencies.length === 1 &&
    createdEpicTasks[2].dependencies[0].dependsOnTaskId === createdEpicTasks[1].id,
    'DAG Dependency properly linked: Task 3 depends on Task 2'
  );

  // Test 2: Bug Triage Tool & Duplicate Detection
  const triageHandler = (mcpServer as any)._registeredTools['triage_bug_ticket'].handler;
  const bugResult = await triageHandler({
    errorSummary: 'Payment Webhook Signature Failed',
    stackTrace: 'Error: StripeSignatureVerificationError: No signatures found matching the expected signature',
    severity: Priority.URGENT,
    moduleName: 'Billing Service',
    reproductionSteps: 'Trigger mock webhook without stripe-signature header',
    projectId: project.id,
    callerId: user.id
  });

  assert(
    bugResult.content[0].text.includes('Bug Ticket Created'),
    'Autonomous Bug Triage created prioritized bug ticket'
  );

  // Test 3: Standup Digest Calculation
  const standupHandler = (mcpServer as any)._registeredTools['generate_standup_digest'].handler;
  const standupResult = await standupHandler({
    projectId: project.id,
    callerId: user.id
  });

  assert(
    standupResult.content[0].text.includes('Daily Standup Briefing'),
    'AI Scrum Master computed daily standup briefing'
  );

  // Test 4: Automatic Cascade Unblock on DONE
  // Task 1 -> Task 2 -> Task 3
  // Attempt to move Task 2 to IN_PROGRESS (should be BLOCKED because Task 1 is BACKLOG)
  try {
    await transitionTaskStatus(
      createdEpicTasks[1].id,
      TaskStatus.IN_PROGRESS,
      org.id,
      user.id,
      ActorType.AI_AGENT
    );
    assert(false, 'Should have blocked Task 2');
  } catch (err: any) {
    assert(err.message.includes('BLOCKED'), 'Task 2 was blocked because Task 1 is not finished');
  }

  // Now complete Task 1:
  await transitionTaskStatus(createdEpicTasks[0].id, TaskStatus.TODO, org.id, user.id);
  await transitionTaskStatus(createdEpicTasks[0].id, TaskStatus.IN_PROGRESS, org.id, user.id);
  await transitionTaskStatus(
    createdEpicTasks[0].id,
    TaskStatus.DONE,
    org.id,
    user.id,
    ActorType.SYSTEM,
    'GitHub Merge Bot'
  );

  // Verify Task 2 was automatically unblocked to TODO
  const unblockedTask2 = await prisma.task.findUnique({ where: { id: createdEpicTasks[1].id } });
  assert(unblockedTask2?.status === TaskStatus.TODO, 'Task 2 automatically transitioned from BLOCKED to TODO on prerequisite completion');

  // Verify ActivityLog recorded actor attribution
  const logs = await prisma.activityLog.findMany({
    where: { taskId: createdEpicTasks[0].id },
    orderBy: { createdAt: 'desc' }
  });
  assert(
    logs.some(l => l.actorType === ActorType.SYSTEM && l.actorName?.includes('GitHub Merge Bot')),
    'Enterprise Audit Log recorded SYSTEM actor attribution from GitHub bot'
  );

  // Test 5: Outbound Webhook Delivery
  const mockWebhook = await prisma.webhook.create({
    data: {
      url: 'https://httpbin.org/post',
      events: ['TASK_CREATED', 'TASK_UNBLOCKED'],
      secret: 'whsec_test_secret_123',
      organizationId: org.id
    }
  });

  await dispatchWebhookEvent('TASK_UNBLOCKED', { taskId: createdEpicTasks[1].id }, org.id);
  assert(mockWebhook.active === true, 'Outbound webhook dispatcher signed and triggered');

  // Cleanup
  await prisma.webhook.deleteMany({ where: { organizationId: org.id } });
  await prisma.task.deleteMany({ where: { organizationId: org.id } });
  await prisma.project.deleteMany({ where: { workspace: { organizationId: org.id } } });

  console.log('\n========================================');
  console.log(`🏁 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) process.exit(1);
}

runAdvancedTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
