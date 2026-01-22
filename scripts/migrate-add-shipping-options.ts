import "dotenv/config";

import { sequelize } from "../lib/models";

type TableDescriptor = { tableName?: string };

function hasTable(tables: unknown[], name: string) {
  return tables.some((table) => {
    if (typeof table === "string") {
      return table === name;
    }
    if (table && typeof table === "object") {
      return (table as TableDescriptor).tableName === name;
    }
    return false;
  });
}

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();

  if (!hasTable(tables, "shipping_options")) {
    await queryInterface.createTable("shipping_options", {
      id: {
        type: "BIGINT",
        autoIncrement: true,
        primaryKey: true,
      },
      carrier: {
        type: "TEXT",
        allowNull: false,
      },
      shipping_type: {
        type: "TEXT",
        allowNull: false,
        defaultValue: "shipping",
      },
      title: {
        type: "TEXT",
        allowNull: false,
      },
      description: {
        type: "TEXT",
        allowNull: true,
      },
      price: {
        type: "DECIMAL(10,2)",
        allowNull: false,
      },
      min_order_total: {
        type: "DECIMAL(10,2)",
        allowNull: true,
      },
      max_order_total: {
        type: "DECIMAL(10,2)",
        allowNull: true,
      },
      position: {
        type: "INTEGER",
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: "DATE",
      },
      updated_at: {
        type: "DATE",
      },
    });
  }
}

main()
  .catch((error) => {
    console.error("Failed to create shipping options table:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
