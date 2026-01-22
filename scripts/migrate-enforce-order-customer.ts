import "dotenv/config";
import { DataTypes, QueryTypes } from "sequelize";

import { sequelize } from "../lib/models";

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("orders");

  if (!("customer_id" in columns)) {
    throw new Error("orders.customer_id is missing. Run migrate-add-customers.ts first.");
  }

  const results = await sequelize.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM "orders" WHERE customer_id IS NULL',
    { type: QueryTypes.SELECT },
  );
  const missing = Number(results[0]?.count ?? 0);
  if (missing > 0) {
    throw new Error(
      `Cannot enforce NOT NULL on orders.customer_id: ${missing} orders have no customer.`,
    );
  }

  await queryInterface.changeColumn("orders", "customer_id", {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: "customers",
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "RESTRICT",
  });
}

main()
  .catch((error) => {
    console.error("Failed to enforce customer_id NOT NULL:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
