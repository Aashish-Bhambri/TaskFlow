import { prisma } from '../src/db.js';
import { validateApiKey, createApiKey } from '../src/auth/apiKey.js';
import { authorizeUser } from '../src/rbac.js';
import { transitionTaskStatus } from '../src/stateMachine.js';
import { generateUserCalendarFeed } from '../src/calendar.js';
import { Role, TaskStatus, Priority } from '@prisma/client';

async function runTests() {
  console.log('🧪 Starting TaskFlow SaaS Core & Collaboration Automated Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Setup test organization and test users
    // -------------------------------------------------------------
    const org = await prisma.organization.upsert({
      where: { slug: 'acme-test' },
      update: {},
      create: { name: 'Acme Test Corp', slug: 'acme-test' }
    });

    const admin = await prisma.user.upsert({
      where: { email: 'admin-test@acme.local' },
      update: { organizationId: org.id },
      create: {
        id: 'admin-test-1',
        name: 'Admin Tester',
        email: 'admin-test@acme.local',
        role: Role.ADMIN,
        organizationId: org.id
      }
    });

    const dev = await prisma.user.upsert({
      where: { email: 'dev-test@acme.local' },
      update: { organizationId: org.id },
      create: {
        id: 'dev-test-1',
        name: 'Dev Tester',
        email: 'dev-test@acme.local',
        role: Role.CONTRIBUTOR,
        organizationId: org.id
      }
    });

    // -------------------------------------------------------------
    // Test 1: API Key Generation & User Binding Validation
    // -------------------------------------------------------------
    const newKey = await createApiKey(org.id, admin.id, 'Test CI Key');
    assert(newKey.apiKey.startsWith('tf_live_'), 'Generated API Key format is tf_live_...');

    const validAuth = await validateApiKey(newKey.apiKey);
    assert(validAuth !== null && validAuth.organizationId === org.id && validAuth.userId === admin.id, 'Valid API key resolves correct organization and bound user');

    const invalidAuth = await validateApiKey('tf_live_fakefakefakefake1234');
    assert(invalidAuth === null, 'Invalid API key is rejected');

    // -------------------------------------------------------------
    // Test 2: Multi-Tenant RBAC Permissions
    // -------------------------------------------------------------
    const adminAuth = await authorizeUser(admin.id, [Role.ADMIN], org.id);
    assert(adminAuth.authorized === true, 'Admin user authorized for ADMIN actions');

    const devAuth = await authorizeUser(dev.id, [Role.ADMIN], org.id);
    assert(devAuth.authorized === false, 'Contributor user denied for ADMIN actions');

    // -------------------------------------------------------------
    // Test 3: DAG Dependency & Blocker Prevention
    // -------------------------------------------------------------
    const taskA = await prisma.task.create({
      data: {
        title: 'Backend Database Migration',
        organizationId: org.id,
        createdById: admin.id,
        status: TaskStatus.BACKLOG,
        priority: Priority.HIGH
      }
    });

    const taskB = await prisma.task.create({
      data: {
        title: 'GraphQL API Deployment',
        organizationId: org.id,
        createdById: admin.id,
        status: TaskStatus.BACKLOG,
        priority: Priority.HIGH
      }
    });

    await prisma.taskDependency.create({
      data: { taskId: taskB.id, dependsOnTaskId: taskA.id }
    });

    await prisma.task.update({ where: { id: taskB.id }, data: { status: TaskStatus.TODO } });
    
    let blockerCaught = false;
    try {
      await transitionTaskStatus(taskB.id, TaskStatus.IN_PROGRESS, org.id, admin.id);
    } catch (err: any) {
      blockerCaught = err.message.includes('BLOCKED');
    }
    assert(blockerCaught, 'State machine blocked Task B because Task A is not DONE');

    // Complete Task A and transition Task B
    await prisma.task.update({ where: { id: taskA.id }, data: { status: TaskStatus.DONE } });
    await prisma.task.update({ where: { id: taskB.id }, data: { status: TaskStatus.TODO } });
    
    const transitionedB = await transitionTaskStatus(taskB.id, TaskStatus.IN_PROGRESS, org.id, admin.id);
    assert(transitionedB.status === TaskStatus.IN_PROGRESS, 'Task B successfully transitioned after prerequisite completed');

    // -------------------------------------------------------------
    // Test 4: Task Comments & Activity Audit Logs
    // -------------------------------------------------------------
    const comment = await prisma.comment.create({
      data: {
        taskId: taskB.id,
        userId: admin.id,
        content: 'Deployment pipeline passed unit tests.'
      }
    });
    assert(comment.content.includes('pipeline passed'), 'Task comment created and linked');

    const activityLogs = await prisma.activityLog.findMany({ where: { taskId: taskB.id } });
    assert(activityLogs.length > 0, 'Activity audit logs recorded on status change');

    // -------------------------------------------------------------
    // Test 5: Sprints & Project Association
    // -------------------------------------------------------------
    const sprint = await prisma.sprint.create({
      data: {
        name: 'Sprint 4 - Core API',
        goal: 'Deliver high availability GraphQL endpoints',
        organizationId: org.id
      }
    });
    await prisma.task.update({ where: { id: taskB.id }, data: { sprintId: sprint.id } });

    const sprintTasks = await prisma.task.findMany({ where: { sprintId: sprint.id } });
    assert(sprintTasks.length === 1 && sprintTasks[0].id === taskB.id, 'Sprint successfully linked to task');

    // -------------------------------------------------------------
    // Test 6: Calendar Feed Generation (.ics)
    // -------------------------------------------------------------
    await prisma.task.update({
      where: { id: taskB.id },
      data: {
        assigneeId: dev.id,
        dueDate: new Date(Date.now() + 86400000),
        estimatedHours: 3
      }
    });

    const icsContent = await generateUserCalendarFeed(dev.id);
    assert(icsContent.includes('BEGIN:VCALENDAR') && icsContent.includes(taskB.title), 'iCalendar feed contains scheduled task events');

  } catch (err: any) {
    console.error('Fatal Test Exception:', err);
    failed++;
  } finally {
    console.log(`\n========================================`);
    console.log(`🏁 Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);
    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
