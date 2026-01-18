import "dotenv/config";
import { sequelize } from "../lib/models";

async function main() {
  await sequelize.sync({ alter: true });
  await sequelize.close();
}

main().catch((error) => {
  console.error("Failed to sync database:", error);
  process.exitCode = 1;
});
