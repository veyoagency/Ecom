import "dotenv/config";
import { sequelize } from "../lib/models";

async function main() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("orders");

  if (!("stripe_risk_score" in table)) {
    await queryInterface.addColumn("orders", "stripe_risk_score", {
      type: "INTEGER",
      allowNull: true,
    });
  }

  if (!("stripe_risk_level" in table)) {
    await queryInterface.addColumn("orders", "stripe_risk_level", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("stripe_risk_reason" in table)) {
    await queryInterface.addColumn("orders", "stripe_risk_reason", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("stripe_risk_rule" in table)) {
    await queryInterface.addColumn("orders", "stripe_risk_rule", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("stripe_seller_message" in table)) {
    await queryInterface.addColumn("orders", "stripe_seller_message", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("stripe_outcome_type" in table)) {
    await queryInterface.addColumn("orders", "stripe_outcome_type", {
      type: "TEXT",
      allowNull: true,
    });
  }

  if (!("stripe_network_status" in table)) {
    await queryInterface.addColumn("orders", "stripe_network_status", {
      type: "TEXT",
      allowNull: true,
    });
  }
}

main()
  .catch((error) => {
    console.error("Failed to migrate orders:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
