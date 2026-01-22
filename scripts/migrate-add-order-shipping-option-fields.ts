import "dotenv/config";

import { sequelize } from "../lib/models";

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("orders");

  if (!("shipping_option_title" in table)) {
    await queryInterface.addColumn("orders", "shipping_option_title", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("shipping_option_carrier" in table)) {
    await queryInterface.addColumn("orders", "shipping_option_carrier", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("shipping_option_type" in table)) {
    await queryInterface.addColumn("orders", "shipping_option_type", {
      type: "TEXT",
      allowNull: true,
    });
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
