import "dotenv/config";

import { sequelize } from "../lib/models";

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("orders");

  if ("shipping_carrier_name" in table) {
    await queryInterface.removeColumn("orders", "shipping_carrier_name");
  }
}

main()
  .catch((error) => {
    console.error("Failed to update orders:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
