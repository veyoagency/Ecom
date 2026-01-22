import "dotenv/config";

import { sequelize } from "../lib/models";

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("orders");

  if (!("service_point_id" in table)) {
    await queryInterface.addColumn("orders", "service_point_id", {
      type: "BIGINT",
      allowNull: true,
    });
  }

  if (!("service_point_name" in table)) {
    await queryInterface.addColumn("orders", "service_point_name", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("service_point_street" in table)) {
    await queryInterface.addColumn("orders", "service_point_street", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("service_point_house_number" in table)) {
    await queryInterface.addColumn("orders", "service_point_house_number", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("service_point_postal_code" in table)) {
    await queryInterface.addColumn("orders", "service_point_postal_code", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("service_point_city" in table)) {
    await queryInterface.addColumn("orders", "service_point_city", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("service_point_distance" in table)) {
    await queryInterface.addColumn("orders", "service_point_distance", {
      type: "INTEGER",
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
