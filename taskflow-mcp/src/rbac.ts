import { Role } from '@prisma/client';
import { prisma } from './db.js';

export async function authorizeUser(
  userId: string,
  allowedRoles: Role[],
  organizationId?: string
): Promise<{ authorized: boolean; user?: any }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, organizationId: true },
  });

  if (!user) {
    return { authorized: false };
  }

  // If organizationId is provided, enforce tenant isolation
  if (organizationId && user.organizationId !== organizationId) {
    return { authorized: false };
  }

  const authorized = allowedRoles.includes(user.role);
  return { authorized, user };
}