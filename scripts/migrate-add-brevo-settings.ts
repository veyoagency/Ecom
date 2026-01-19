import "dotenv/config";
import { sequelize } from "../lib/models";

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("website_settings");

  if (!("brevo_api_key_encrypted" in table)) {
    await queryInterface.addColumn("website_settings", "brevo_api_key_encrypted", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("brevo_api_key_hint" in table)) {
    await queryInterface.addColumn("website_settings", "brevo_api_key_hint", {
      type: "TEXT",
      allowNull: true,
    });
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
