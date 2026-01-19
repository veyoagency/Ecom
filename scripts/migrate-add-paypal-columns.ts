import "dotenv/config";
import { sequelize } from "../lib/models";

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("orders");

  if (!("paypal_order_id" in table)) {
    await queryInterface.addColumn("orders", "paypal_order_id", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("paypal_capture_id" in table)) {
    await queryInterface.addColumn("orders", "paypal_capture_id", {
      type: "TEXT",
      allowNull: true,
    });
  }
}

main()
  .catch((error) => {
    console.error("Failed to migrate orders:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
