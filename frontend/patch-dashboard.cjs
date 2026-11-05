const fs = require("fs");
const file = "src/App.tsx";
let s = fs.readFileSync(file, "utf8");

const stateAnchor = '  const [liveClaims, setLiveClaims] = useState<any[]>([]);';

const states = `
  const [liveRateCards, setLiveRateCards] = useState<any[]>([]);
  const [rateCardBusy, setRateCardBusy] = useState(false);
`;

if (!s.includes("const [liveRateCards")) {
  if (!s.includes(stateAnchor)) throw new Error("Claims state not found");
  s = s.replace(stateAnchor, stateAnchor + states);
}

const effectAnchor = '  useEffect(() => {';

if (!s.includes('fetch("http://localhost:5000/api/rate-cards")')) {
  const effect = `
  useEffect(() => {
    async function loadRateCards() {
      try {
        const response = await fetch("http://localhost:5000/api/rate-cards");
        const data = await response.json();
        if (response.ok) setLiveRateCards(data.rateCards || []);
      } catch (error) {
        console.error("Rate card loading error:", error);
      }
    }
    loadRateCards();
  }, []);

`;
  s = s.replace(effectAnchor, effect + effectAnchor);
}

const functionsAnchor = '  function createClaim(id: string)';

const functions = `
  async function addRateCard() {
    const gatewayName = window.prompt("Gateway name (e.g. Razorpay):");
    if (!gatewayName) return;

    const feePercent = window.prompt("Gateway fee percentage:", "2");
    if (feePercent === null) return;
    const fixedFee = window.prompt("Fixed fee in INR:", "0");
    if (fixedFee === null) return;
    const tcsPercent = window.prompt("TCS percentage:", "0.1");
    if (tcsPercent === null) return;
    const tdsPercent = window.prompt("TDS percentage:", "0.1");
    if (tdsPercent === null) return;

    setRateCardBusy(true);
    try {
      const response = await fetch("http://localhost:5000/api/rate-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatewayName, feePercent, fixedFee, tcsPercent, tdsPercent })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not create rate card");
      setLiveRateCards(old => [data.rateCard, ...old]);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Rate card creation failed");
    } finally {
      setRateCardBusy(false);
    }
  }

  async function editRateCard(card: any) {
    const feePercent = window.prompt("Gateway fee percentage:", String(card.feePercent));
    if (feePercent === null) return;
    const fixedFee = window.prompt("Fixed fee in INR:", String(card.fixedFee));
    if (fixedFee === null) return;
    const tcsPercent = window.prompt("TCS percentage:", String(card.tcsPercent));
    if (tcsPercent === null) return;
    const tdsPercent = window.prompt("TDS percentage:", String(card.tdsPercent));
    if (tdsPercent === null) return;

    try {
      const response = await fetch("http://localhost:5000/api/rate-cards/" + card.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feePercent, fixedFee, tcsPercent, tdsPercent })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Update failed");
      setLiveRateCards(old => old.map(item => item.id === card.id ? data.rateCard : item));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Rate card update failed");
    }
  }

`;

if (!s.includes("async function addRateCard()")) {
  if (!s.includes(functionsAnchor)) throw new Error("Could not find function insertion point");
  s = s.replace(functionsAnchor, functions + functionsAnchor);
}

const oldRateCards = `{page === "Rate Cards" && <section className="panel table-panel"><div className="panel-heading"><div><h3>Gateway rate cards</h3><p>Configure expected transaction fees for reconciliation</p></div><button className="btn-primary"><Plus size={16}/> Add rate card</button></div><div className="table-scroll"><table><thead><tr><th>GATEWAY</th><th>PAYMENT METHOD</th><th>PLATFORM FEE</th><th>GST</th><th>FIXED FEE</th><th>STATUS</th></tr></thead><tbody>{[["Razorpay","UPI","0.00%","0%","₹0"],["Razorpay","Credit card","2.00%","18%","₹0"],["Cashfree","UPI","0.00%","0%","₹0"],["Cashfree","Credit card","1.90%","18%","₹0"],["PayU","Credit card","2.00%","18%","₹0"]].map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v}</td>)}<td><Status value="Active"/></td></tr>)}</tbody></table></div></section>}`;

const newRateCards = `{page === "Rate Cards" && <section className="panel table-panel">
            <div className="panel-heading">
              <div><h3>Gateway rate cards</h3><p>Configure expected transaction fees and tax deductions</p></div>
              <button className="btn-primary" disabled={rateCardBusy} onClick={addRateCard}><Plus size={16}/> Add rate card</button>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>GATEWAY</th><th>PLATFORM FEE</th><th>FIXED FEE</th><th>TCS</th><th>TDS</th><th>STATUS</th><th>ACTION</th></tr></thead>
                <tbody>
                  {liveRateCards.map(card => <tr key={card.id}>
                    <td><b>{card.gatewayName}</b></td>
                    <td>{Number(card.feePercent).toFixed(2)}%</td>
                    <td>{money(Number(card.fixedFee))}</td>
                    <td>{Number(card.tcsPercent).toFixed(2)}%</td>
                    <td>{Number(card.tdsPercent).toFixed(2)}%</td>
                    <td><Status value={card.isActive ? "Active" : "Inactive"}/></td>
                    <td><button className="btn-plain" onClick={() => editRateCard(card)}>Edit</button></td>
                  </tr>)}
                  {liveRateCards.length === 0 && <tr><td colSpan={7} className="no-results">No rate cards found. Add your first gateway rate card.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>}`;

if (s.includes(oldRateCards)) {
  s = s.replace(oldRateCards, newRateCards);
} else if (!s.includes("liveRateCards.map(card")) {
  throw new Error("Could not find existing Rate Cards JSX");
}

// Replace Overview's static metric values with live values.
s = s.replace(
  'value="2,846" change="+12.8%" positive detail="vs. previous 30 days"',
  'value={String(new Set(transactions.map(t => t.order)).size)} change="Live data" detail="Orders in imported reconciliation"'
);
s = s.replace(
  'value="₹18.42L" change="+8.2%" positive detail="vs. previous 30 days"',
  'value={money(transactions.reduce((sum, t) => sum + t.actual, 0))} change="Live data" detail="Received in imported records"'
);
s = s.replace(
  'value="124" change="-4.3%" positive detail="vs. previous 30 days"',
  'value={String(transactions.filter(t => t.status !== "Matched").length)} change="Live data" detail="Transactions needing review"'
);

fs.writeFileSync(file, s, "utf8");
console.log("Rate Cards and Overview integration added.");
