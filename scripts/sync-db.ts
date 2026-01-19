import "dotenv/config";
import { sequelize } from "../lib/models";

async function main() {
  await sequelize.query(
    "CREATE SEQUENCE IF NOT EXISTS orders_order_number_seq START WITH 1001",
  );
  await sequelize.sync({ alter: true });
  await sequelize.close();
}

main().catch((error) => {
  console.error("Failed to sync database:", error);
  process.exitCode = 1;
});
