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

  if (hasTable(tables, "shipping_list")) {
    await queryInterface.dropTable("shipping_list");
  }

  if (hasTable(tables, "sendcloud_carriers")) {
    await queryInterface.dropTable("sendcloud_carriers");
  }
}

main()
  .catch((error) => {
    console.error("Failed to drop shipping tables:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
