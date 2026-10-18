import crypto from 'node:crypto';
import ApiError from './ApiError.js';

function encryptionKey() {
  if (!process.env.SETTINGS_ENCRYPTION_KEY || process.env.SETTINGS_ENCRYPTION_KEY.length < 32) {
    throw new ApiError(503, 'Set SETTINGS_ENCRYPTION_KEY to at least 32 characters before saving a workspace AI key.');
  }
  return crypto.createHash('sha256').update(process.env.SETTINGS_ENCRYPTION_KEY).digest();
}

export function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptSecret(value) {
  if (!value) return '';
  try {
    const [iv, tag, ciphertext] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}
