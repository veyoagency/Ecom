import "dotenv/config";

import { sequelize } from "../lib/models";

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("orders");

  if (!("sendcloud_shipment_id" in table)) {
    await queryInterface.addColumn("orders", "sendcloud_shipment_id", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("sendcloud_tracking_number" in table)) {
    await queryInterface.addColumn("orders", "sendcloud_tracking_number", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("sendcloud_tracking_url" in table)) {
    await queryInterface.addColumn("orders", "sendcloud_tracking_url", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("sendcloud_parcel_id" in table)) {
    await queryInterface.addColumn("orders", "sendcloud_parcel_id", {
      type: "BIGINT",
      allowNull: true,
    });
  }

  if (!("shipping_label_reference" in table)) {
    await queryInterface.addColumn("orders", "shipping_label_reference", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("shipping_label_url" in table)) {
    await queryInterface.addColumn("orders", "shipping_label_url", {
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
