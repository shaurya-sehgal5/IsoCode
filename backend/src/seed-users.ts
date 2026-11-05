import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma.js";

async function main() {
  const accounts = [
    {
      name: "Demo Finance Executive",
      email: "finance@settleflow.demo",
      password: "Finance@123",
      role: "FINANCE_EXECUTIVE" as const
    },
    {
      name: "Demo Co-founder",
      email: "founder@settleflow.demo",
      password: "Founder@123",
      role: "CO_FOUNDER" as const
    }
  ];

  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);

    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        passwordHash,
        role: account.role
      },
      create: {
        name: account.name,
        email: account.email,
        passwordHash,
        role: account.role
      }
    });

    console.log(`Created/updated ${account.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
