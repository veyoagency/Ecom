import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const KEY_LENGTH = 32;
const IV_LENGTH = 12;

function getEncryptionKey() {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY?.trim() ?? "";
  if (!raw) {
    return null;
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const base64 = Buffer.from(raw, "base64");
  if (base64.length === KEY_LENGTH) {
    return base64;
  }

  return null;
}

export function encryptSecret(value: string) {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error("Missing SETTINGS_ENCRYPTION_KEY.");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string) {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error("Missing SETTINGS_ENCRYPTION_KEY.");
  }

  const [ivPart, tagPart, dataPart] = payload.split(":");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Invalid encrypted payload.");
  }

  const iv = Buffer.from(ivPart, "base64");
  const tag = Buffer.from(tagPart, "base64");
  const data = Buffer.from(dataPart, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
