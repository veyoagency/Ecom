import "dotenv/config";
import { DataTypes } from "sequelize";

import { sequelize } from "../lib/models";

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("orders");

  if (!("payment_status" in table)) {
    await queryInterface.addColumn("orders", "payment_status", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  }

  if (!("refunded_cents" in table)) {
    await queryInterface.addColumn("orders", "refunded_cents", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
  }

  await sequelize.query(`
    UPDATE orders
    SET payment_status = CASE
      WHEN status IN ('paid', 'fulfilled') THEN 'paid'
      ELSE 'unpaid'
    END
    WHERE payment_status IS NULL
  `);

  await sequelize.query(`
    UPDATE orders
    SET refunded_cents = 0
    WHERE refunded_cents IS NULL
  `);
}

main()
  .catch((error) => {
    console.error("Failed to migrate order refunds:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
