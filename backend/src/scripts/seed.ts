import { prisma } from "../lib/prisma.js";

async function main() {
  const orders = [
    { orderNumber: "ORD-1001", customerName: "Aarav Sharma", orderAmount: 2499, currency: "INR" },
    { orderNumber: "ORD-1002", customerName: "Priya Mehta", orderAmount: 1599, currency: "INR" },
    { orderNumber: "ORD-1003", customerName: "Rohan Verma", orderAmount: 3999, currency: "INR" },
    { orderNumber: "ORD-1004", customerName: "Ananya Singh", orderAmount: 2999, currency: "INR" },
    { orderNumber: "ORD-1005", customerName: "Kabir Das", orderAmount: 1999, currency: "INR" }
  ];

  for (const order of orders) {
    await prisma.order.upsert({
      where: { orderNumber: order.orderNumber },
      update: { orderAmount: order.orderAmount },
      create: order
    });
  }

  await prisma.rateCard.upsert({
    where: { gatewayName: "Demo Gateway" },
    update: {},
    create: {
      gatewayName: "Demo Gateway",
      feePercent: 2,
      fixedFee: 0,
      tcsPercent: 0.1,
      tdsPercent: 0.1
    }
  });

  console.log("Seeded 5 demo orders and Demo Gateway rate card.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
