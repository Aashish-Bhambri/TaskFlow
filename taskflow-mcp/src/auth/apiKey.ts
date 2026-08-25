import crypto from 'crypto';
import { prisma } from '../db.js';

export interface AuthContext {
  organizationId: string;
  organizationName: string;
  apiKeyId: string;
}

/**
 * Hashes an API key using SHA-256 for secure database storage.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Generates a new live API key for an organization (e.g. tf_live_...).
 */
export async function createApiKey(organizationId: string, name: string = 'Default Key') {
  const rawKeyBytes = crypto.randomBytes(24).toString('hex');
  const apiKey = `tf_live_${rawKeyBytes}`;
  const keyHash = hashApiKey(apiKey);
  const prefix = apiKey.substring(0, 12) + '...';

  const record = await prisma.apiKey.create({
    data: {
      name,
      keyHash,
      prefix,
      organizationId,
    }
  });

  return {
    id: record.id,
    apiKey, // Only returned once upon creation
    prefix,
    name: record.name,
  };
}

/**
 * Validates a raw Bearer token against stored API key hashes.
 */
export async function validateApiKey(rawKey: string): Promise<AuthContext | null> {
  if (!rawKey || !rawKey.startsWith('tf_live_')) {
    return null;
  }

  const keyHash = hashApiKey(rawKey);
  const apiKeyRecord = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { organization: true }
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
    apiKeyId: apiKeyRecord.id,
  };
}
