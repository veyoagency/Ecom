const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

export function hasAdminAllowlist() {
  return ADMIN_EMAILS.size > 0;
}

export function getAdminEmails() {
  return Array.from(ADMIN_EMAILS);
}

export function isAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  if (!hasAdminAllowlist()) {
    return true;
  }

  return ADMIN_EMAILS.has(email.toLowerCase());
}
