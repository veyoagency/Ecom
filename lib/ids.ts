import { randomBytes } from "crypto";

export function generatePublicId() {
  return randomBytes(6).toString("hex");
}

export function generateSessionToken() {
  return randomBytes(32).toString("hex");
}
