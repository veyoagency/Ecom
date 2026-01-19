import "dotenv/config";
import { QueryTypes } from "sequelize";
import { sequelize } from "../lib/models";

async function main() {
  const queryInterface = sequelize.getQueryInterface();

  await sequelize.query(
    "CREATE SEQUENCE IF NOT EXISTS orders_order_number_seq START WITH 1001",
  );

  const table = await queryInterface.describeTable("orders");
  if (!("order_number" in table)) {
    await sequelize.query("ALTER TABLE orders ADD COLUMN order_number bigint");
  }

  await sequelize.query(
    "ALTER TABLE orders ALTER COLUMN order_number SET DEFAULT nextval('orders_order_number_seq')",
  );

  await sequelize.query(
    "UPDATE orders SET order_number = nextval('orders_order_number_seq') WHERE order_number IS NULL",
  );

  const maxRows = (await sequelize.query(
    "SELECT MAX(order_number) AS max FROM orders",
    { type: QueryTypes.SELECT },
  )) as Array<{ max: number | null }>;
  const currentMax = maxRows?.[0]?.max;
  const nextValue = currentMax ? Number(currentMax) + 1 : 1001;

  await sequelize.query(
    `SELECT setval('orders_order_number_seq', ${nextValue}, false)`,
  );

  await sequelize.query(
    "ALTER TABLE orders ALTER COLUMN order_number SET NOT NULL",
  );
}

main()
  .catch((error) => {
    console.error("Failed to migrate orders:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
