import "dotenv/config";
import { sequelize } from "../lib/models";

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("products");

  if (!("weight_kg" in table)) {
    await queryInterface.addColumn("products", "weight_kg", {
      type: "DECIMAL(10,3)",
      allowNull: true,
    });
  }
}

main()
  .catch((error) => {
    console.error("Failed to migrate products:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
