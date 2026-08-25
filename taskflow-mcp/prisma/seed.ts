import { PrismaClient, Role, PlanTier, Priority, TaskStatus, TaskType } from '@prisma/client';
import { hashApiKey } from '../src/auth/apiKey.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding TaskFlow SaaS Database with Full Projects & Tasks...');

  // 1. Create Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'acme' },
    update: {},
    create: {
      id: 'org_acme',
      name: 'Acme Corporation',
      slug: 'acme',
      plan: PlanTier.PRO,
    },
  });
  console.log('✅ Organization:', org.name);

  // 2. Create Users
  const usersData = [
    {
      id: 'user_1',
      name: 'Alex Johnson',
      email: 'alex.johnson@acme.corp',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: Role.ADMIN,
    },
    {
      id: 'user_2',
      name: 'Sarah Miller',
      email: 'sarah.miller@acme.corp',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      role: Role.CONTRIBUTOR,
    },
    {
      id: 'user_3',
      name: 'David Chen',
      email: 'david.chen@acme.corp',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      role: Role.CONTRIBUTOR,
    },
    {
      id: 'user_4',
      name: 'Elena Rostova',
      email: 'elena.r@acme.corp',
      image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      role: Role.CONTRIBUTOR,
    },
    {
      id: 'user_5',
      name: 'Marcus Vance',
      email: 'marcus.v@acme.corp',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      role: Role.VIEWER,
    },
  ];

  for (const u of usersData) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, image: u.image, role: u.role, organizationId: org.id },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        role: u.role,
        organizationId: org.id,
      },
    });
  }
  console.log(`✅ Created ${usersData.length} Users`);

  // 3. Create Workspaces
  const ws1 = await prisma.workspace.upsert({
    where: { id: 'ws_1' },
    update: { name: 'TaskFlow Core Workspace', organizationId: org.id },
    create: {
      id: 'ws_1',
      name: 'TaskFlow Core Workspace',
      slug: 'taskflow-core',
      description: 'Main workspace for TaskFlow protocol engine and developer tooling.',
      organizationId: org.id,
    },
  });

  const ws2 = await prisma.workspace.upsert({
    where: { id: 'ws_2' },
    update: { name: 'Acme Enterprise Platform', organizationId: org.id },
    create: {
      id: 'ws_2',
      name: 'Acme Enterprise Platform',
      slug: 'acme-enterprise',
      description: 'Enterprise SaaS deployment with custom SLAs and audit logs.',
      organizationId: org.id,
    },
  });
  console.log('✅ Created Workspaces: TaskFlow Core & Acme Enterprise');

  // 4. Create Projects
  const proj1 = await prisma.project.upsert({
    where: { id: 'proj_1' },
    update: { progress: 68, status: 'ACTIVE' },
    create: {
      id: 'proj_1',
      name: 'MCP Protocol Server 2.0',
      description: 'High-throughput JSON-RPC server with dual SSE/stdio transports and multi-tenant RBAC.',
      priority: Priority.HIGH,
      status: 'ACTIVE',
      progress: 68,
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-05-15'),
      workspaceId: ws1.id,
      teamLeadId: 'user_1',
      members: {
        connect: [{ id: 'user_1' }, { id: 'user_2' }, { id: 'user_3' }],
      },
    },
  });

  const proj2 = await prisma.project.upsert({
    where: { id: 'proj_2' },
    update: { progress: 82, status: 'ACTIVE' },
    create: {
      id: 'proj_2',
      name: 'Design System & UI Components',
      description: 'Dark-mode first, keyboard-navigable component library built with Tailwind CSS v4 and React 19.',
      priority: Priority.MEDIUM,
      status: 'ACTIVE',
      progress: 82,
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-04-30'),
      workspaceId: ws1.id,
      teamLeadId: 'user_2',
      members: {
        connect: [{ id: 'user_2' }, { id: 'user_4' }, { id: 'user_5' }],
      },
    },
  });

  const proj3 = await prisma.project.upsert({
    where: { id: 'proj_3' },
    update: { progress: 25, status: 'PLANNING' },
    create: {
      id: 'proj_3',
      name: 'Security & Cloud Infrastructure',
      description: 'Zero-trust API key hashing with SHA-256, rate limiting, and automated webhook retries.',
      priority: Priority.HIGH,
      status: 'PLANNING',
      progress: 25,
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-06-30'),
      workspaceId: ws1.id,
      teamLeadId: 'user_3',
      members: {
        connect: [{ id: 'user_1' }, { id: 'user_3' }],
      },
    },
  });
  console.log('✅ Created Projects: Proj 1, 2, 3');

  // 5. Create Tasks
  const task1 = await prisma.task.upsert({
    where: { id: 'task_101' },
    update: { status: TaskStatus.IN_PROGRESS },
    create: {
      id: 'task_101',
      title: 'Implement DAG Cycle Detection in State Machine',
      description: 'Build robust topological sort to prevent circular task dependencies in workflow transitions.',
      status: TaskStatus.IN_PROGRESS,
      type: TaskType.FEATURE,
      priority: Priority.HIGH,
      assigneeId: 'user_1',
      createdById: 'user_1',
      organizationId: org.id,
      workspaceId: ws1.id,
      projectId: proj1.id,
      estimatedHours: 6,
      dueDate: new Date(Date.now() + 86400000 * 5),
    },
  });

  const task2 = await prisma.task.upsert({
    where: { id: 'task_102' },
    update: { status: TaskStatus.TODO },
    create: {
      id: 'task_102',
      title: 'Fix Token Expiration Memory Leak in SSE Transports',
      description: 'Active client connections are retaining references to expired bearer tokens.',
      status: TaskStatus.TODO,
      type: TaskType.BUG,
      priority: Priority.HIGH,
      assigneeId: 'user_2',
      createdById: 'user_1',
      organizationId: org.id,
      workspaceId: ws1.id,
      projectId: proj1.id,
      estimatedHours: 4,
      dueDate: new Date(Date.now() - 86400000 * 2), // Overdue for testing
    },
  });

  const task3 = await prisma.task.upsert({
    where: { id: 'task_103' },
    update: { status: TaskStatus.DONE },
    create: {
      id: 'task_103',
      title: 'Dynamic iCalendar (.ics) Feed Generator',
      description: 'Export user scheduled tasks and milestones into standard RFC 5545 format.',
      status: TaskStatus.DONE,
      type: TaskType.TASK,
      priority: Priority.MEDIUM,
      assigneeId: 'user_3',
      createdById: 'user_1',
      organizationId: org.id,
      workspaceId: ws1.id,
      projectId: proj1.id,
      estimatedHours: 3,
      dueDate: new Date(Date.now() + 86400000 * 2),
    },
  });

  const task4 = await prisma.task.upsert({
    where: { id: 'task_104' },
    update: { status: TaskStatus.IN_PROGRESS },
    create: {
      id: 'task_104',
      title: 'Optimize Prisma Query Latency with Indexes',
      description: 'Add composite indexes on [organizationId, status] for sub-5ms query response times.',
      status: TaskStatus.IN_PROGRESS,
      type: TaskType.IMPROVEMENT,
      priority: Priority.MEDIUM,
      assigneeId: 'user_1',
      createdById: 'user_1',
      organizationId: org.id,
      workspaceId: ws1.id,
      projectId: proj1.id,
      estimatedHours: 5,
      dueDate: new Date(Date.now() + 86400000 * 10),
    },
  });

  // Link DAG Dependency: Task 102 depends on Task 101 being completed
  await prisma.taskDependency.upsert({
    where: {
      taskId_dependsOnTaskId: {
        taskId: task2.id,
        dependsOnTaskId: task1.id,
      },
    },
    update: {},
    create: {
      taskId: task2.id,
      dependsOnTaskId: task1.id,
    },
  });
  console.log('✅ Linked DAG Dependency: Task 102 blocked by Task 101');

  // 6. Comments
  await prisma.comment.createMany({
    data: [
      {
        id: 'comm_1',
        taskId: task1.id,
        userId: 'user_2',
        content: "I ran into an issue with self-referencing nodes during unit testing. Let's make sure taskId !== dependsOnTaskId is strictly checked.",
        createdAt: new Date(Date.now() - 3600000 * 2),
      },
      {
        id: 'comm_2',
        taskId: task1.id,
        userId: 'user_1',
        content: 'Good catch Sarah! Added validation middleware for that in the latest commit.',
        createdAt: new Date(Date.now() - 1800000),
      },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Seeded Comments');

  // 7. API Key
  const rawKey = 'tf_live_demo1234567890abcdef12345678';
  const keyHash = hashApiKey(rawKey);

  await prisma.apiKey.upsert({
    where: { keyHash },
    update: { organizationId: org.id },
    create: {
      name: 'Production Cloud Key',
      keyHash,
      prefix: 'tf_live_demo...',
      organizationId: org.id,
    },
  });
  console.log('✅ Test API Key:', rawKey);
  console.log('🎉 Seeding Complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
