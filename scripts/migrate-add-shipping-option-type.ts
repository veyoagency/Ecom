import "dotenv/config";

import { sequelize } from "../lib/models";

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("shipping_options");

  if (!("shipping_type" in table)) {
    await queryInterface.addColumn("shipping_options", "shipping_type", {
      type: "TEXT",
      allowNull: false,
      defaultValue: "shipping",
    });
  }
}

main()
  .catch((error) => {
    console.error("Failed to update shipping options:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
