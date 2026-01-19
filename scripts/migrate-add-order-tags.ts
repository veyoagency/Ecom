import "dotenv/config";
import { sequelize } from "../lib/models";

async function main() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS order_tags (
      id bigserial PRIMARY KEY,
      name text NOT NULL UNIQUE,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS order_tag_assignments (
      id bigserial PRIMARY KEY,
      order_id bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      tag_id bigint NOT NULL REFERENCES order_tags(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now()
    )
  `);

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS order_tag_assignments_unique
    ON order_tag_assignments(order_id, tag_id)
  `);
}

main()
  .catch((error) => {
    console.error("Failed to migrate order tags:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
