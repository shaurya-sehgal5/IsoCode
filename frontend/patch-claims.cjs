const fs = require("fs");
const file = "src/App.tsx";
let s = fs.readFileSync(file, "utf8");

const anchor = '  const [transactions, setTransactions] = useState(initialTransactions);';

if (!s.includes("const [liveClaims")) {
  s = s.replace(anchor, anchor + `
  const [liveClaims, setLiveClaims] = useState<any[]>([]);
`);
}

if (!s.includes('fetch("http://localhost:5000/api/claims")')) {
  const effectAnchor = '  useEffect(() => {';
  const claimsEffect = `
  useEffect(() => {
    async function loadClaims() {
      try {
        const response = await fetch("http://localhost:5000/api/claims");
        const data = await response.json();
        if (response.ok) setLiveClaims(data.claims || []);
      } catch (error) {
        console.error("Claims loading error:", error);
      }
    }
    loadClaims();
  }, []);

`;
  s = s.replace(effectAnchor, claimsEffect + effectAnchor);
}

const oldCreate = `  function createClaim(id: string) {
    setTransactions(old => old.map(t => t.id === id ? { ...t, status: "Claim created" } : t));
  }`;

const newCreate = `  async function createClaim(id: string) {
    try {
      const response = await fetch("http://localhost:5000/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentRecordId: id })
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.message || "Could not create claim");
        return;
      }
      setTransactions(old => old.map(t => t.id === id ? { ...t, status: "Claim created" } : t));
      setLiveClaims(old => [data.claim, ...old]);
      alert("Claim created successfully");
    } catch {
      alert("Could not connect to the claims API");
    }
  }`;

if (s.includes(oldCreate)) s = s.replace(oldCreate, newCreate);

s = s.replace(
  '{claims.map(c=><tr key={c.id}>',
  '{liveClaims.map(c=><tr key={c.id}>'
);
s = s.replace(
  '<td className="id-cell">{c.id}</td><td>{c.order}</td><td>{c.gateway}</td><td>{c.reason}</td><td className="amount-cell">{money(c.amount)}</td><td><Status value={c.status}/></td>',
  '<td className="id-cell">{c.claimNumber}</td><td>{c.reconciliationResult?.order?.orderNumber || c.reconciliationResult?.paymentRecord?.orderReference || "—"}</td><td>Demo Gateway</td><td>{c.title}</td><td className="amount-cell">{money(Number(c.amount))}</td><td><select value={c.status} onChange={async e => { const response = await fetch("http://localhost:5000/api/claims/" + c.id + "/status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: e.target.value }) }); if (response.ok) setLiveClaims(old => old.map(item => item.id === c.id ? { ...item, status: e.target.value } : item)); }}><option value="OPEN">Open</option><option value="UNDER_REVIEW">Under review</option><option value="RESOLVED">Resolved</option><option value="REJECTED">Rejected</option></select></td>'
);

s = s.replace(
  '<div><span>Total claims</span><b>24</b></div><div><span>Open</span><b className="red-text">12</b></div><div><span>Under review</span><b>8</b></div><div><span>Recovered</span><b className="green-text">₹24,850</b></div>',
  '<div><span>Total claims</span><b>{liveClaims.length}</b></div><div><span>Open</span><b className="red-text">{liveClaims.filter(c => c.status === "OPEN").length}</b></div><div><span>Under review</span><b>{liveClaims.filter(c => c.status === "UNDER_REVIEW").length}</b></div><div><span>Resolved</span><b className="green-text">{liveClaims.filter(c => c.status === "RESOLVED").length}</b></div>'
);

fs.writeFileSync(file, s, "utf8");
console.log("Claims frontend integration added.");
