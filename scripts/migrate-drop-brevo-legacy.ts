import "dotenv/config";
import { sequelize } from "../lib/models";

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("website_settings");

  if ("brevo_api_key" in table) {
    await queryInterface.removeColumn("website_settings", "brevo_api_key");
  }
}

main()
  .catch((error) => {
    console.error("Failed to migrate settings:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
