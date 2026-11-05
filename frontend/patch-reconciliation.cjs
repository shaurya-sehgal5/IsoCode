const fs = require("fs");
const file = "src/App.tsx";
let s = fs.readFileSync(file, "utf8");

s = s.replace(
  'import { useMemo, useState } from "react";',
  'import { useEffect, useMemo, useState } from "react";'
);

const anchor = '  const [transactions, setTransactions] = useState(initialTransactions);';

const effect = `
  useEffect(() => {
    async function loadReconciliation() {
      try {
        const response = await fetch("http://localhost:5000/api/reconciliation/");
        if (!response.ok) throw new Error("Could not load reconciliation data");

        const data = await response.json();

        const liveTransactions = (data.results || []).map((item: any) => {
          const expected = Number(item.expectedAmount ?? 0);
          const actual = Number(item.actualAmount ?? 0);
          const difference = Number(item.difference ?? 0);
          const rawStatus = item.matchStatus;

          let status = "Missing";
          if (rawStatus === "MATCHED") status = "Matched";
          else if (rawStatus === "PARTIAL") {
            status = difference < 0 ? "Short paid" : "Overpaid";
          }

          return {
            id: item.paymentRecord?.externalTransactionId || item.paymentRecordId || item.id,
            order: item.order?.orderNumber || item.paymentRecord?.orderReference || "Unlinked",
            customer: item.order?.customerName || "—",
            gateway: "Demo Gateway",
            expected,
            actual,
            difference,
            date: item.paymentRecord?.paymentDate
              ? new Date(item.paymentRecord.paymentDate).toLocaleDateString("en-IN")
              : "—",
            status
          };
        });

        setTransactions(liveTransactions as typeof initialTransactions);
      } catch (error) {
        console.error("Reconciliation loading error:", error);
      }
    }

    loadReconciliation();
  }, []);
`;

if (!s.includes("async function loadReconciliation()")) {
  if (!s.includes(anchor)) throw new Error("Transaction state anchor not found");
  s = s.replace(anchor, anchor + effect);
}

s = s.replace(
  '{t.difference===0?"—":"-"+money(t.difference)}',
  '{t.difference===0?"—":(t.difference<0?"-":"+")+money(t.difference)}'
);

fs.writeFileSync(file, s, "utf8");
console.log("Live reconciliation integration added.");
