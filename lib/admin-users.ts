import { getAdminEmails, hasAdminAllowlist } from "@/lib/admin-config";
import { getPgPool } from "@/lib/postgres";

export async function hasAdminUser() {
  const pool = getPgPool();

  if (hasAdminAllowlist()) {
    const allowedEmails = getAdminEmails();
    if (allowedEmails.length === 0) {
      return false;
    }

    const result = await pool.query(
      'select 1 from "user" where lower(email) = any($1) limit 1',
      [allowedEmails],
    );
    return result.rowCount > 0;
  }

  const result = await pool.query('select 1 from "user" limit 1');
  return result.rowCount > 0;
}
