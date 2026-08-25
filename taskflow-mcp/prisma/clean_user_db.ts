import { PrismaClient, Role, PlanTier } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning up dummy test data from database...');

  // Delete all tasks, projects, comments, activity logs, dependencies
  await prisma.activityLog.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.taskDependency.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});

  console.log('✨ All dummy projects and tasks removed!');

  // Create clean Organization & User for Aashish Bhambri
  const org = await prisma.organization.create({
    data: {
      name: 'TaskFlow Workspace',
      slug: 'taskflow-workspace',
      plan: PlanTier.PRO,
    },
  });

  const user = await prisma.user.create({
    data: {
      name: 'Aashish Bhambri',
      email: 'aashish@taskflow.local',
      role: Role.ADMIN,
      organizationId: org.id,
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: 'My Projects Workspace',
      slug: 'my-projects',
      description: 'Personal and team initiatives.',
      organizationId: org.id,
    },
  });

  console.log('✅ Clean user account created:', user.name);
  console.log('✅ Clean workspace ready:', workspace.name);
  console.log('🎉 Database is now 100% clean and ready for user data!');
}

main()
  .catch((e) => {
    console.error('Error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
