const fs = require("fs");
const file = "src/App.tsx";
let s = fs.readFileSync(file, "utf8");

const anchor = '  const [liveRateCards, setLiveRateCards] = useState<any[]>([]);';

if (!s.includes("const [liveReturns")) {
  if (!s.includes(anchor)) throw new Error("Rate card state not found");
  s = s.replace(anchor, anchor + `
  const [liveReturns, setLiveReturns] = useState<any[]>([]);
`);
}

if (!s.includes('fetch("http://localhost:5000/api/returns")')) {
  const effect = `
  useEffect(() => {
    async function loadReturns() {
      try {
        const response = await fetch("http://localhost:5000/api/returns");
        const data = await response.json();
        if (response.ok) setLiveReturns(data.returns || []);
      } catch (error) {
        console.error("Returns loading error:", error);
      }
    }
    loadReturns();
  }, []);

`;
  s = s.replace('  useEffect(() => {', effect + '  useEffect(() => {');
}

const oldReturns = `<div className="empty-state"><RotateCcw size={30}/><h3>No return records imported yet</h3><p>Return and refund records will appear here when you import a returns file.</p><button className="btn-primary" onClick={()=>setPage("Imports")}><Plus size={16}/> Import returns file</button></div>`;

const newReturns = `
              <div className="recon-stats">
                <div><span>Total returns</span><b>{liveReturns.length}</b></div>
                <div><span>Requested</span><b>{liveReturns.filter(r => r.status === "REQUESTED").length}</b></div>
                <div><span>Approved</span><b>{liveReturns.filter(r => r.status === "APPROVED").length}</b></div>
                <div><span>Refunded</span><b className="green-text">{liveReturns.filter(r => r.status === "REFUNDED").length}</b></div>
              </div>
              <div className="panel-heading">
                <div><h3>Returns register</h3><p>Track refund requests and settlement impact</p></div>
                <button className="btn-primary" onClick={() => {
                  const orderReference = window.prompt("Order reference (e.g. ORD-1001):");
                  if (!orderReference) return;
                  const refundAmount = window.prompt("Refund amount in INR:");
                  if (!refundAmount) return;
                  const reason = window.prompt("Reason for return:", "Customer return");
                  fetch("http://localhost:5000/api/returns", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orderReference, refundAmount, reason })
                  }).then(async response => {
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message || "Could not create return");
                    setLiveReturns(old => [data.return, ...old]);
                  }).catch(error => alert(error.message));
                }}><Plus size={16}/> Add return</button>
              </div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>RETURN ID</th><th>ORDER</th><th>REASON</th><th>REFUND AMOUNT</th><th>DATE</th><th>STATUS</th></tr></thead>
                  <tbody>
                    {liveReturns.map(record => <tr key={record.id}>
                      <td className="id-cell">{record.returnNumber}</td>
                      <td>{record.orderReference}</td>
                      <td>{record.reason || "—"}</td>
                      <td className="amount-cell">{money(Number(record.refundAmount))}</td>
                      <td>{new Date(record.createdAt).toLocaleDateString("en-IN")}</td>
                      <td>
                        <select value={record.status} onChange={async e => {
                          const response = await fetch("http://localhost:5000/api/returns/" + record.id + "/status", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: e.target.value })
                          });
                          const data = await response.json();
                          if (response.ok) setLiveReturns(old => old.map(item => item.id === record.id ? data.return : item));
                          else alert(data.message || "Could not update status");
                        }}>
                          <option value="REQUESTED">Requested</option>
                          <option value="APPROVED">Approved</option>
                          <option value="REFUNDED">Refunded</option>
                          <option value="REJECTED">Rejected</option>
                        </select>
                      </td>
                    </tr>)}
                    {liveReturns.length === 0 && <tr><td colSpan={6} className="no-results">No returns recorded yet. Add your first return.</td></tr>}
                  </tbody>
                </table>
              </div>`;

if (s.includes(oldReturns)) {
  s = s.replace(oldReturns, newReturns);
} else if (!s.includes("liveReturns.map(record")) {
  throw new Error("Could not locate existing Returns empty state");
}

fs.writeFileSync(file, s, "utf8");
console.log("Returns screen connected to API.");
