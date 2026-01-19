import "dotenv/config";
import { sequelize } from "../lib/models";

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("orders");

  if (!("stripe_payment_intent_id" in table)) {
    await queryInterface.addColumn("orders", "stripe_payment_intent_id", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("stripe_charge_id" in table)) {
    await queryInterface.addColumn("orders", "stripe_charge_id", {
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
