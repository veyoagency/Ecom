import "dotenv/config";

import { sequelize } from "../lib/models";

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("product_option_values");

  if (!("image_url" in table)) {
    await queryInterface.addColumn("product_option_values", "image_url", {
      type: "TEXT",
      allowNull: true,
    });
  }
}

main()
  .catch((error) => {
    console.error("Failed to update product option values:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
