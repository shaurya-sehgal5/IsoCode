import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, ArrowLeftRight, Upload, FileText, CreditCard,
  RotateCcw, Settings, Search, Bell, ChevronDown, Plus,
  TrendingUp, TrendingDown, Wallet, CircleDollarSign, Clock3,
  CheckCircle2, AlertCircle, MoreHorizontal, Download,
  ArrowUpRight, ArrowDownRight, Menu, X, Sparkles, FileSpreadsheet,
  Filter, CalendarDays, Eye, CircleHelp
} from "lucide-react";
import "./index.css";
import Returns from "./Returns";
import { apiFetch } from "./api";
import { canManageRateCards } from "./permissions";

type Page = "Overview" | "Reconciliation" | "Imports" | "Claims" | "Rate Cards" | "Returns";

const initialTransactions = [
  { id: "TXN-82941", order: "ORD-2026-1042", customer: "Aarav Mehta", gateway: "Razorpay", expected: 1249, actual: 1212, difference: -37, date: "Nov 05, 2026", status: "Short paid" },
  { id: "TXN-82940", order: "ORD-2026-1041", customer: "Isha Kapoor", gateway: "Cashfree", expected: 2899, actual: 2899, difference: 0, date: "Nov 05, 2026", status: "Matched" },
  { id: "TXN-82939", order: "ORD-2026-1040", customer: "Rohan Sharma", gateway: "Razorpay", expected: 5499, actual: 5324, difference: -175, date: "Nov 05, 2026", status: "Short paid" },
  { id: "TXN-82938", order: "ORD-2026-1039", customer: "Ananya Rao", gateway: "PayU", expected: 1799, actual: 1799, difference: 0, date: "Nov 04, 2026", status: "Matched" },
  { id: "TXN-82937", order: "ORD-2026-1038", customer: "Kabir Singh", gateway: "Cashfree", expected: 3499, actual: 0, difference: -3499, date: "Nov 04, 2026", status: "Missing" },
  { id: "TXN-82936", order: "ORD-2026-1037", customer: "Meera Joshi", gateway: "Razorpay", expected: 899, actual: 899, difference: 0, date: "Nov 04, 2026", status: "Matched" },
];

const claims = [
  { id: "CLM-0024", order: "ORD-2026-1040", gateway: "Razorpay", reason: "Incorrect settlement fee", amount: 175, status: "Open" },
  { id: "CLM-0023", order: "ORD-2026-1038", gateway: "Cashfree", reason: "Payment not settled", amount: 3499, status: "Under review" },
  { id: "CLM-0022", order: "ORD-2026-1028", gateway: "Razorpay", reason: "Short settlement", amount: 82, status: "Open" },
  { id: "CLM-0021", order: "ORD-2026-1019", gateway: "PayU", reason: "Fee discrepancy", amount: 54, status: "Resolved" },
];

const navGroups = [
  {
    label: "WORKSPACE", items: [
      { name: "Overview", icon: LayoutDashboard },
      { name: "Reconciliation", icon: ArrowLeftRight },
      { name: "Imports", icon: Upload },
    ]
  },
  {
    label: "FINANCE", items: [
      { name: "Claims", icon: FileText },
      { name: "Rate Cards", icon: CreditCard },
      { name: "Returns", icon: RotateCcw },
    ]
  },
];

const money = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

function App() {
  const [page, setPage] = useState<Page>("Overview");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [uploaded, setUploaded] = useState(false);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [liveClaims, setLiveClaims] = useState<any[]>([]);


  useEffect(() => {
    async function loadClaims() {
      try {
        const response = await apiFetch("/claims");
        const data = await response.json();
        if (response.ok) setLiveClaims(data.claims || []);
      } catch (error) {
        console.error("Claims loading error:", error);
      }
    }
    loadClaims();
  }, []);

  useEffect(() => {
    async function loadReconciliation() {
      try {
        const response = await apiFetch("/reconciliation");
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

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<any>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");


  const filtered = useMemo(() => transactions.filter(t => {
    const matchesSearch = `${t.id} ${t.order} ${t.customer} ${t.gateway}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (filter === "All" || t.status === filter);
  }), [transactions, search, filter]);

  const matched = transactions.filter(t => t.status === "Matched").length;
  const totalRisk = transactions.reduce((sum, t) => sum + Math.abs(Math.min(0, t.difference)), 0);

  async function handleFile(file?: File) {
    if (!file) return;

    setSelectedFile(file);
    setFileName(file.name);
    setUploaded(false);
    setUploadPreview(null);
    setUploadMessage("");
    setPage("Imports");
    setUploadBusy(true);

    try {
      const form = new FormData();
      form.append("file", file);

      const response = await apiFetch("/uploads/preview", {
        method: "POST",
        body: form
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Preview failed");

      setUploadPreview(result);
      setMapping(result.suggestedMapping || {});
      setUploadMessage("File preview ready. Review the mappings before importing.");
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  async function confirmImport() {
    if (!selectedFile) return;

    const required = ["orderReference", "grossAmount", "netAmount"];
    const missing = required.filter(field => !mapping[field]);

    if (missing.length) {
      setUploadMessage("Please map Order Reference, Gross Amount and Net Amount.");
      return;
    }

    setUploadBusy(true);
    setUploadMessage("");

    try {
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("mapping", JSON.stringify(mapping));

      const response = await apiFetch("/uploads/confirm", {
        method: "POST",
        body: form
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Import failed");

      setUploaded(true);
      setUploadMessage(
        "Import completed: " + result.import.insertedRows +
        " payment records saved. Mapping version " + result.import.mappingVersion + "."
      );
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Import failed");
    } finally {
      setUploadBusy(false);
    }
  }

  async function createClaim(id: string) {
    try {
      const response = await apiFetch("/claims", {
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
  }

  const nav = (
    <>
      <div className="brand">
        <div className="brand-icon"><span> S </span></div>
        <div><div className="brand-name">settleflow<span>.</span></div><div className="brand-sub">FINANCE OPERATIONS</div></div>
      </div>
      <div className="workspace-switch">
        <div className="workspace-avatar">V</div>
        <div className="workspace-copy"><b>Velora Living</b><span>Workspace</span></div>
        <ChevronDown size={15} />
      </div>
      {navGroups.map(group => <div className="nav-group" key={group.label}>
        <div className="nav-label">{group.label}</div>
        {group.items.map(item => {
          const Icon = item.icon;
          return <button key={item.name} className={`nav-item ${page === item.name ? "active" : ""}`} onClick={() => { setPage(item.name as Page); setMobileOpen(false); }}>
            <Icon size={18} /><span>{item.name}</span>
            {item.name === "Claims" && <span className="nav-count">3</span>}
          </button>;
        })}
      </div>)}
      <div className="sidebar-bottom">
        <button className="nav-item"><CircleHelp size={18} /><span>Help & support</span></button>
        <button className="nav-item"><Settings size={18} /><span>Settings</span></button>
        <div className="profile">
          <div className="profile-avatar">AS</div>
          <div className="profile-copy"><b>Aditya Sharma</b><span>Finance executive</span></div>
          <MoreHorizontal size={19} />
        </div>
      </div>
    </>
  );

  return (
    <div className="app-shell">
      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <button className="mobile-close" onClick={() => setMobileOpen(false)}><X /></button>
        {nav}
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu /></button>
          <div className="breadcrumb">Workspace <span>/</span> <b>{page}</b></div>
          <div className="top-actions">
            <div className="live-indicator"><span /> All systems operational</div>
            <button className="icon-button notification"><Bell size={18} /><i /></button>
            <div className="top-avatar">AS</div>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">WEDNESDAY, NOVEMBER 5, 2026</div>
              <h1>{page === "Overview" ? "Good morning, Aditya" : page}</h1>
              <p>{page === "Overview" ? "Here's what's happening with your finances today." :
                page === "Reconciliation" ? "Track and resolve payment settlement discrepancies." :
                  page === "Imports" ? "Upload and manage your settlement statements." :
                    page === "Claims" ? "Manage disputes and recover money from payment gateways." :
                      page === "Rate Cards" ? "Manage gateway fees and expected settlement rules." :
                        "Track returned orders and their settlement impact."}</p>
            </div>
            <div className="heading-actions">
              {page === "Overview" && <button className="btn-secondary"><CalendarDays size={16} /> Last 30 days <ChevronDown size={14} /></button>}
              <label className="btn-primary"><Plus size={17} /> {page === "Imports" ? "Upload statement" : "New import"}<input type="file" accept=".csv,.xlsx,.xls" hidden onChange={e => handleFile(e.target.files?.[0])} /></label>
            </div>
          </div>

          {page === "Overview" && <>
            <div className="summary-banner">
              <div className="banner-icon"><Sparkles size={19} /></div>
              <div><b>Your reconciliation is looking healthy</b><span>You've reconciled {matched} of {transactions.length} sample transactions. Review the discrepancies that need your attention.</span></div>
              <button onClick={() => setPage("Reconciliation")}>Review activity <ArrowUpRight size={15} /></button>
            </div>

            <div className="metrics-grid">
              <Metric title="Total orders" value="2,846" change="+12.8%" positive detail="vs. previous 30 days" icon={<Wallet />} />
              <Metric title="Reconciled amount" value="₹18.42L" change="+8.2%" positive detail="vs. previous 30 days" icon={<CircleDollarSign />} />
              <Metric title="Pending reconciliation" value="124" change="-4.3%" positive detail="vs. previous 30 days" icon={<Clock3 />} />
              <Metric title="Money at risk" value={money(totalRisk)} change="Needs attention" detail="Across open discrepancies" icon={<AlertCircle />} warning />
            </div>

            <div className="dashboard-grid">
              <section className="panel chart-panel">
                <div className="panel-heading"><div><h3>Settlement overview</h3><p>Expected vs. received settlement</p></div><button className="btn-plain">Last 7 days <ChevronDown size={14} /></button></div>
                <div className="chart-legend"><span><i className="legend-dot purple" /> Expected</span><span><i className="legend-dot green" /> Received</span></div>
                <div className="chart">
                  <div className="chart-y"><span>₹5L</span><span>₹4L</span><span>₹3L</span><span>₹2L</span><span>₹1L</span><span>₹0</span></div>
                  <div className="chart-main">
                    <div className="chart-gridlines"><i /><i /><i /><i /><i /><i /></div>
                    <div className="chart-bars">
                      {[[68, 57], [82, 70], [59, 55], [92, 78], [73, 68], [86, 81], [95, 88]].map((v, i) => <div className="bar-group" key={i}><div className="bar-pair"><i style={{ height: v[0] + "%" }} /><i style={{ height: v[1] + "%" }} /></div><span>{["Oct 30", "Oct 31", "Nov 01", "Nov 02", "Nov 03", "Nov 04", "Nov 05"][i]}</span></div>)}
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel gateway-panel">
                <div className="panel-heading"><div><h3>Gateway performance</h3><p>Settlement success rate</p></div><MoreHorizontal size={20} /></div>
                {[
                  { name: "Razorpay", initial: "R", color: "razor", rate: "98.4%", width: "98.4%", amount: "₹8,42,500" },
                  { name: "Cashfree", initial: "C", color: "cash", rate: "96.8%", width: "96.8%", amount: "₹6,18,200" },
                  { name: "PayU", initial: "P", color: "payu", rate: "94.2%", width: "94.2%", amount: "₹3,61,800" },
                ].map(g => <div className="gateway-row" key={g.name}><div className={`gateway-logo ${g.color}`}>{g.initial}</div><div className="gateway-info"><div><b>{g.name}</b><strong>{g.rate}</strong></div><div className="progress-track"><i style={{ width: g.width }} /></div><span>{g.amount} settled</span></div></div>)}
              </section>
            </div>

            <section className="panel table-panel">
              <div className="panel-heading"><div><h3>Recent discrepancies</h3><p>Transactions that need your attention</p></div><button className="btn-plain" onClick={() => setPage("Reconciliation")}>View all <ArrowUpRight size={15} /></button></div>
              <TransactionTable rows={transactions.filter(t => t.difference !== 0).slice(0, 4)} onClaim={createClaim} />
            </section>
          </>}

          {page === "Reconciliation" && <section className="panel table-panel">
            <div className="recon-stats"><div><span>Total transactions</span><b>{transactions.length}</b></div><div><span>Matched</span><b className="green-text">{matched}</b></div><div><span>Discrepancies</span><b className="red-text">{transactions.filter(t => t.difference !== 0).length}</b></div><div><span>Money at risk</span><b>{money(totalRisk)}</b></div></div>
            <div className="table-toolbar"><div className="search-box"><Search size={16} /><input placeholder="Search order, transaction..." value={search} onChange={e => setSearch(e.target.value)} /></div><select value={filter} onChange={e => setFilter(e.target.value)}><option>All</option><option>Matched</option><option>Short paid</option><option>Missing</option><option>Claim created</option></select><button className="btn-secondary"><Filter size={15} /> Filters</button><button className="btn-secondary"><Download size={15} /> Export</button></div>
            <TransactionTable rows={filtered} onClaim={createClaim} />
          </section>}

          {page === "Imports" && <div className="imports-layout">
            <section className="panel upload-panel">
              <div className="upload-icon"><FileSpreadsheet size={27} /></div>
              <h3>Import settlement statement</h3>
              <p>Upload a CSV or Excel file from your payment gateway to start reconciliation.</p>
              <label className="dropzone"><Upload size={24} /><b>Click to browse or drag your file here</b><span>CSV, XLSX or XLS · Max file size 20 MB</span><input type="file" accept=".csv,.xlsx,.xls" hidden onChange={e => handleFile(e.target.files?.[0])} /></label>
              {uploaded && <div className="upload-success"><CheckCircle2 size={18} /> {fileName} selected. Ready for column mapping.</div>}
              {uploadBusy && <div className="upload-success">Processing file, please wait...</div>}

              {uploadMessage && (
                <div className="upload-success" style={{ marginTop: 12 }}>
                  {uploadMessage}
                </div>
              )}

              {uploadPreview && (
                <div style={{ marginTop: 24, textAlign: "left", width: "100%" }}>
                  <div className="panel-heading">
                    <div>
                      <h3>Review column mapping</h3>
                      <p>{uploadPreview.file.totalRows.toLocaleString()} rows detected · Showing first 20 rows</p>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginTop: 16 }}>
                    {[
                      ["orderReference", "Order Reference"],
                      ["transactionId", "Transaction ID"],
                      ["grossAmount", "Gross Amount"],
                      ["fees", "Gateway Fees"],
                      ["netAmount", "Net Amount"],
                      ["paymentDate", "Payment Date"],
                      ["status", "Payment Status"]
                    ].map(([field, label]) => (
                      <label key={field} style={{ display: "grid", gap: 6, fontSize: 13 }}>
                        <b>{label}{["orderReference", "grossAmount", "netAmount"].includes(field) ? " *" : ""}</b>
                        <select
                          value={mapping[field] || ""}
                          onChange={e => setMapping(old => ({
                            ...old,
                            [field]: e.target.value || null
                          }))}
                          style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8, background: "white", color: "#222" }}
                        >
                          <option value="">-- Not mapped --</option>
                          {uploadPreview.headers.map((header: string) => (
                            <option key={header} value={header}>{header}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>

                  <div style={{ overflowX: "auto", marginTop: 20 }}>
                    <h3 style={{ marginBottom: 10 }}>Data preview</h3>
                    <table>
                      <thead>
                        <tr>
                          {(uploadPreview.headers as string[]).slice(0, 6).map(header => (
                            <th key={header}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(uploadPreview.preview as Record<string, unknown>[]).slice(0, 5).map((row, index) => (
                          <tr key={index}>
                            {(uploadPreview.headers as string[]).slice(0, 6).map(header => (
                              <td key={header}>{String(row[header] ?? "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    className="btn-primary"
                    onClick={confirmImport}
                    disabled={uploadBusy || uploaded}
                    style={{ marginTop: 18, opacity: uploadBusy || uploaded ? 0.6 : 1 }}
                  >
                    <CheckCircle2 size={16} />
                    {uploaded ? "Import completed" : "Approve mapping & import"}
                  </button>
                  <p style={{ fontSize: 12, color: "#777", marginTop: 8 }}>
                    * Required fields. Review the suggested mappings before approval.
                  </p>
                </div>
              )}

              <div className="upload-note"><AlertCircle size={15} /> Your files are processed securely. Personal data is masked.</div>
            </section>
            <section className="panel">
              <div className="panel-heading"><div><h3>Recent imports</h3><p>Your uploaded settlement statements</p></div></div>
              {["razorpay_settlement_nov04.csv", "cashfree_payout_oct31.xlsx", "payu_settlement_oct30.csv"].map((f, i) => <div className="import-row" key={f}><div className="file-icon"><FileSpreadsheet size={19} /></div><div><b>{f}</b><span>{["Nov 04, 2026 · 248 rows", "Oct 31, 2026 · 182 rows", "Oct 30, 2026 · 315 rows"][i]}</span></div><Status value={i === 0 ? "Completed" : i === 1 ? "Completed" : "Processing"} /></div>)}
            </section>
          </div>}

          {page === "Claims" && <section className="panel table-panel">
            <div className="recon-stats"><div><span>Total claims</span><b>{liveClaims.length}</b></div><div><span>Open</span><b className="red-text">{liveClaims.filter(c => c.status === "OPEN").length}</b></div><div><span>Under review</span><b>{liveClaims.filter(c => c.status === "UNDER_REVIEW").length}</b></div><div><span>Resolved</span><b className="green-text">{liveClaims.filter(c => c.status === "RESOLVED").length}</b></div></div>
            <div className="panel-heading"><div><h3>Claims register</h3><p>Track gateway payment discrepancies</p></div><button className="btn-secondary"><Download size={15} /> Export claims</button></div>
            <div className="table-scroll"><table><thead><tr><th>CLAIM ID</th><th>ORDER</th><th>GATEWAY</th><th>REASON</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{liveClaims.map(c => <tr key={c.id}><td className="id-cell">{c.claimNumber}</td><td>{c.reconciliationResult?.order?.orderNumber || c.reconciliationResult?.paymentRecord?.orderReference || "—"}</td><td>Demo Gateway</td><td>{c.title}</td><td className="amount-cell">{money(Number(c.amount))}</td><td><select value={c.status} onChange={async e => { const response = await apiFetch(`/claims/${c.id}/status`, { method: "PATCH", body: JSON.stringify({ status: e.target.value }) }); if (response.ok) setLiveClaims(old => old.map(item => item.id === c.id ? { ...item, status: e.target.value } : item)); }}><option value="OPEN">Open</option><option value="UNDER_REVIEW">Under review</option><option value="RESOLVED">Resolved</option><option value="REJECTED">Rejected</option></select></td></tr>)}</tbody></table></div>
          </section>}

          {page === "Rate Cards" && <section className="panel table-panel"><div className="panel-heading"><div><h3>Gateway rate cards</h3><p>Configure expected transaction fees for reconciliation</p></div><button className="btn-primary"><Plus size={16} /> Add rate card</button></div><div className="table-scroll"><table><thead><tr><th>GATEWAY</th><th>PAYMENT METHOD</th><th>PLATFORM FEE</th><th>GST</th><th>FIXED FEE</th><th>STATUS</th></tr></thead><tbody>{[["Razorpay", "UPI", "0.00%", "0%", "₹0"], ["Razorpay", "Credit card", "2.00%", "18%", "₹0"], ["Cashfree", "UPI", "0.00%", "0%", "₹0"], ["Cashfree", "Credit card", "1.90%", "18%", "₹0"], ["PayU", "Credit card", "2.00%", "18%", "₹0"]].map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}<td><Status value="Active" /></td></tr>)}</tbody></table></div></section>}

          {page === "Returns" && <Returns />}

          <footer className="footer"><span>© 2026 SettleFlow. Finance, in flow.</span><span>Made for clarity <span className="footer-heart">♥</span></span></footer>
        </div>
      </main>
    </div>
  );
}

function Metric({ title, value, change, positive, detail, icon, warning = false }: { title: string, value: string, change: string, positive?: boolean, detail: string, icon: React.ReactNode, warning?: boolean }) {
  return <div className="metric-card"><div className="metric-top"><span>{title}</span><div className={`metric-icon ${warning ? "warning" : ""}`}>{icon}</div></div><div className="metric-value">{value}</div><div className="metric-bottom"><span className={positive ? "positive" : warning ? "warning-text" : "muted"}>{positive ? <TrendingUp size={13} /> : warning ? <AlertCircle size={13} /> : null}{change}</span><span>{detail}</span></div></div>;
}

function Status({ value }: { value: string }) {
  const cls = value === "Matched" || value === "Completed" || value === "Resolved" || value === "Active" ? "success" : value === "Short paid" || value === "Missing" || value === "Open" ? "danger" : value === "Claim created" || value === "Processing" ? "info" : "warning";
  return <span className={`status-pill ${cls}`}><i />{value}</span>;
}

function TransactionTable({ rows, onClaim }: { rows: typeof initialTransactions, onClaim: (id: string) => void }) {
  return <div className="table-scroll"><table><thead><tr><th>TRANSACTION / ORDER</th><th>CUSTOMER</th><th>GATEWAY</th><th>EXPECTED</th><th>RECEIVED</th><th>DIFFERENCE</th><th>STATUS</th><th></th></tr></thead><tbody>
    {rows.map(t => <tr key={t.id}><td><b className="id-cell">{t.id}</b><span className="sub-cell">{t.order}</span></td><td>{t.customer}</td><td>{t.gateway}</td><td>{money(t.expected)}</td><td>{money(t.actual)}</td><td className={t.difference < 0 ? "red-text" : "green-text"}>{t.difference === 0 ? "—" : (t.difference < 0 ? "-" : "+") + money(t.difference)}</td><td><Status value={t.status} /></td><td>{t.difference !== 0 && t.status !== "Claim created" && <button className="claim-button" onClick={() => onClaim(t.id)}>Create claim</button>}</td></tr>)}
    {rows.length === 0 && <tr><td colSpan={8} className="no-results">No transactions match your search.</td></tr>}
  </tbody></table></div>;
}

export default App;
