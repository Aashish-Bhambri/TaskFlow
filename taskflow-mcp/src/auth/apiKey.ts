import crypto from 'crypto';
import { prisma } from '../db.js';

export interface AuthContext {
  organizationId: string;
  organizationName: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  apiKeyId: string;
}

/**
 * Hashes an API key using SHA-256 for secure database storage.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Generates a new live API key bound to a specific user and organization (e.g. tf_live_...).
 */
export async function createApiKey(organizationId: string, userId?: string, name: string = 'Default Key') {
  const rawKeyBytes = crypto.randomBytes(24).toString('hex');
  const apiKey = `tf_live_${rawKeyBytes}`;
  const keyHash = hashApiKey(apiKey);
  const prefix = apiKey.substring(0, 12) + '...';

  // Verify that userId actually exists in database before setting foreign key
  let validUserId: string | undefined = undefined;
  if (userId) {
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (existingUser) {
      validUserId = existingUser.id;
    }
  }

  const record = await prisma.apiKey.create({
    data: {
      name,
      keyHash,
      prefix,
      organizationId,
      userId: validUserId
    }
  });

  return {
    id: record.id,
    apiKey, // Only returned once upon creation
    prefix,
    name: record.name,
    userId: record.userId,
    organizationId: record.organizationId
  };
}

/**
 * Validates a raw Bearer token against stored API key hashes and returns full tenant/user context.
 */
export async function validateApiKey(rawKey: string): Promise<AuthContext | null> {
  if (!rawKey || !rawKey.startsWith('tf_live_')) {
    return null;
  }

  const keyHash = hashApiKey(rawKey);
  const apiKeyRecord = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { organization: true, user: true }
  });

  if (!apiKeyRecord) {
    return null;
  }

  // Update lastUsedAt asynchronously
  prisma.apiKey.update({
    where: { id: apiKeyRecord.id },
    data: { lastUsedAt: new Date() }
  }).catch(() => {});

  return {
    organizationId: apiKeyRecord.organizationId,
    organizationName: apiKeyRecord.organization.name,
    userId: apiKeyRecord.userId || apiKeyRecord.user?.id,
    userName: apiKeyRecord.user?.name || undefined,
    userEmail: apiKeyRecord.user?.email || undefined,
    apiKeyId: apiKeyRecord.id,
  };
}
