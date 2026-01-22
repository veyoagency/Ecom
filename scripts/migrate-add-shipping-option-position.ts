import "dotenv/config";

import { sequelize } from "../lib/models";

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("shipping_options");

  if (!("position" in table)) {
    await queryInterface.addColumn("shipping_options", "position", {
      type: "INTEGER",
      allowNull: false,
      defaultValue: 0,
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
