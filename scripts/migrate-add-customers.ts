import "dotenv/config";
import { DataTypes } from "sequelize";

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

async function ensureCustomerColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("customers");

  if (!("first_name" in columns)) {
    await queryInterface.addColumn("customers", "first_name", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  }
  if (!("last_name" in columns)) {
    await queryInterface.addColumn("customers", "last_name", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  }
  if (!("email" in columns)) {
    await queryInterface.addColumn("customers", "email", {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    });
  }
  if (!("phone" in columns)) {
    await queryInterface.addColumn("customers", "phone", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  }
  if (!("address1" in columns)) {
    await queryInterface.addColumn("customers", "address1", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  }
  if (!("address2" in columns)) {
    await queryInterface.addColumn("customers", "address2", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  }
  if (!("postal_code" in columns)) {
    await queryInterface.addColumn("customers", "postal_code", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  }
  if (!("city" in columns)) {
    await queryInterface.addColumn("customers", "city", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  }
  if (!("country" in columns)) {
    await queryInterface.addColumn("customers", "country", {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  }
  if (!("created_at" in columns)) {
    await queryInterface.addColumn("customers", "created_at", {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }
  if (!("updated_at" in columns)) {
    await queryInterface.addColumn("customers", "updated_at", {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }
}

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();

  if (!hasTable(tables, "customers")) {
    await queryInterface.createTable("customers", {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      first_name: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      last_name: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      email: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
      },
      phone: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      address1: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      address2: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      postal_code: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      city: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      country: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    });
  } else {
    await ensureCustomerColumns();
  }

  const ordersTable = await queryInterface.describeTable("orders");
  if (!("customer_id" in ordersTable)) {
    await queryInterface.addColumn("orders", "customer_id", {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: "customers",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  }

  if ("email" in ordersTable) {
    await sequelize.query(`
      INSERT INTO customers (
        first_name,
        last_name,
        email,
        phone,
        address1,
        address2,
        postal_code,
        city,
        country,
        created_at,
        updated_at
      )
      SELECT DISTINCT
        NULLIF(TRIM(first_name), '') AS first_name,
        NULLIF(TRIM(last_name), '') AS last_name,
        LOWER(email) AS email,
        NULLIF(TRIM(phone), '') AS phone,
        NULLIF(TRIM(address1), '') AS address1,
        NULLIF(TRIM(address2), '') AS address2,
        NULLIF(TRIM(postal_code), '') AS postal_code,
        NULLIF(TRIM(city), '') AS city,
        NULLIF(TRIM(country), '') AS country,
        NOW() AS created_at,
        NOW() AS updated_at
      FROM orders
      WHERE email IS NOT NULL AND TRIM(email) <> ''
      ON CONFLICT (email) DO UPDATE SET
        first_name = COALESCE(EXCLUDED.first_name, customers.first_name),
        last_name = COALESCE(EXCLUDED.last_name, customers.last_name),
        phone = COALESCE(EXCLUDED.phone, customers.phone),
        address1 = COALESCE(EXCLUDED.address1, customers.address1),
        address2 = COALESCE(EXCLUDED.address2, customers.address2),
        postal_code = COALESCE(EXCLUDED.postal_code, customers.postal_code),
        city = COALESCE(EXCLUDED.city, customers.city),
        country = COALESCE(EXCLUDED.country, customers.country),
        updated_at = NOW()
    `);

    await sequelize.query(`
      UPDATE orders
      SET customer_id = customers.id
      FROM customers
      WHERE orders.customer_id IS NULL
        AND orders.email IS NOT NULL
        AND LOWER(orders.email) = customers.email
    `);
  }

  const orderColumns = await queryInterface.describeTable("orders");
  const columnsToDrop = [
    "first_name",
    "last_name",
    "email",
    "phone",
    "address1",
    "address2",
    "postal_code",
    "city",
    "country",
  ];
  for (const column of columnsToDrop) {
    if (column in orderColumns) {
      await queryInterface.removeColumn("orders", column);
    }
  }
}

main()
  .catch((error) => {
    console.error("Failed to migrate customers:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
