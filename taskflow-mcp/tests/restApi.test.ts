import { startSseServer } from '../src/server/sse.js';
import { prisma } from '../src/db.js';

async function runApiTests() {
  console.log('🧪 Starting TaskFlow REST API & Gateway Integration Tests...\n');
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

  // Start test server on port 3001
  const serverInstance = startSseServer(3001);
  const BASE_URL = 'http://localhost:3001/api/v1';

  try {
    // 1. Workspaces
    const wsRes = await fetch(`${BASE_URL}/workspaces`);
    const workspaces = await wsRes.json();
    assert(wsRes.status === 200 && Array.isArray(workspaces) && workspaces.length > 0, 'GET /api/v1/workspaces returns populated workspaces');

    const firstWs = workspaces[0];
    assert(firstWs.projects && firstWs.projects.length > 0, 'Workspace contains projects tree');

    // 2. Projects
    const projRes = await fetch(`${BASE_URL}/projects?workspaceId=${firstWs.id}`);
    const projects = await projRes.json();
    assert(projRes.status === 200 && Array.isArray(projects), 'GET /api/v1/projects returns filtered projects');

    // 3. Create Project
    const newProjRes = await fetch(`${BASE_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'REST API Test Project',
        description: 'Automated integration testing',
        priority: 'HIGH',
        status: 'ACTIVE',
        workspaceId: firstWs.id,
        teamLeadId: 'user_1',
      }),
    });
    const createdProj = await newProjRes.json();
    assert(newProjRes.status === 201 && createdProj.id, 'POST /api/v1/projects creates project');

    // 4. Create Task
    const newTaskRes = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'CI Automated Task',
        description: 'Testing task creation endpoint',
        priority: 'HIGH',
        status: 'TODO',
        type: 'FEATURE',
        projectId: createdProj.id,
        assigneeId: 'user_1',
      }),
    });
    const createdTask = await newTaskRes.json();
    assert(newTaskRes.status === 201 && createdTask.id, 'POST /api/v1/tasks creates task');

    // 5. Post Comment
    const commentRes = await fetch(`${BASE_URL}/tasks/${createdTask.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Automated test comment payload',
        userId: 'user_1',
      }),
    });
    const createdComment = await commentRes.json();
    assert(commentRes.status === 201 && createdComment.content === 'Automated test comment payload', 'POST /api/v1/tasks/:id/comments posts comment');

    // 6. Test DAG Blocker State Transition (Task 102 depends on Task 101 which is IN_PROGRESS)
    // Moving Task 102 to IN_PROGRESS directly should fail with 400 and isBlockerError: true
    const blockerRes = await fetch(`${BASE_URL}/tasks/task_102/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus: 'IN_PROGRESS' }),
    });
    const blockerData = await blockerRes.json();
    assert(
      blockerRes.status === 400 && (blockerData.isBlockerError || blockerData.error?.includes('BLOCKED')),
      'PATCH /api/v1/tasks/:id/status returns 400 Blocker Error when prerequisites are unfinished'
    );

    // 7. Calendar Feed (.ics)
    const calRes = await fetch(`${BASE_URL}/calendar/user_1/feed.ics`);
    const icsText = await calRes.text();
    assert(calRes.status === 200 && icsText.includes('BEGIN:VCALENDAR'), 'GET /api/v1/calendar/:userId/feed.ics generates valid RFC 5545 feed');

    // 8. Dashboard Stats
    const statsRes = await fetch(`${BASE_URL}/dashboard/stats?workspaceId=${firstWs.id}`);
    const stats = await statsRes.json();
    assert(statsRes.status === 200 && typeof stats.totalProjects === 'number', 'GET /api/v1/dashboard/stats returns calculated KPI metrics');

  } catch (err: any) {
    console.error('Fatal API Test Error:', err);
    failed++;
  } finally {
    serverInstance.close();
    await prisma.$disconnect();
    console.log(`\n========================================`);
    console.log(`🏁 API Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runApiTests();
