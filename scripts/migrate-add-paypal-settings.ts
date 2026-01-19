import "dotenv/config";
import { sequelize } from "../lib/models";

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("website_settings");

  if (!("paypal_client_id_encrypted" in table)) {
    await queryInterface.addColumn("website_settings", "paypal_client_id_encrypted", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("paypal_client_id_hint" in table)) {
    await queryInterface.addColumn("website_settings", "paypal_client_id_hint", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("paypal_client_secret_encrypted" in table)) {
    await queryInterface.addColumn(
      "website_settings",
      "paypal_client_secret_encrypted",
      {
        type: "TEXT",
        allowNull: true,
      },
    );
  }

  if (!("paypal_client_secret_hint" in table)) {
    await queryInterface.addColumn("website_settings", "paypal_client_secret_hint", {
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
