import fs from "node:fs";

const file = fs.readFileSync("./sample-settlement.csv");

const form = new FormData();
form.append(
  "file",
  new Blob([file], { type: "text/csv" }),
  "sample-settlement.csv"
);

form.append("mapping", JSON.stringify({
  orderReference: "Order ID",
  transactionId: "Transaction ID",
  grossAmount: "Gross Amount",
  fees: "Fees",
  netAmount: "Net Amount",
  paymentDate: "Payment Date"
}));

const response = await fetch("http://localhost:5000/api/uploads/confirm", {
  method: "POST",
  body: form
});

console.log("HTTP Status:", response.status);
console.log(await response.text());
