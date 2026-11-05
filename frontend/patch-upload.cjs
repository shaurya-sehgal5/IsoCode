const fs = require("fs");

const file = "src/App.tsx";
let s = fs.readFileSync(file, "utf8");

const stateAnchor = '  const [transactions, setTransactions] = useState(initialTransactions);';

const stateAddition = `
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<any>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
`;

if (!s.includes("const [uploadPreview")) {
  if (!s.includes(stateAnchor)) throw new Error("Could not find transaction state anchor");
  s = s.replace(stateAnchor, stateAnchor + stateAddition);
}

const oldHandler = `  function handleFile(file?: File) {
    if (!file) return;
    setFileName(file.name);
    setUploaded(true);
    setPage("Imports");
  }`;

const newHandler = `  async function handleFile(file?: File) {
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

      const response = await fetch("http://localhost:5000/api/uploads/preview", {
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

      const response = await fetch("http://localhost:5000/api/uploads/confirm", {
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
  }`;

if (s.includes(oldHandler)) {
  s = s.replace(oldHandler, newHandler);
} else if (!s.includes("async function confirmImport()")) {
  throw new Error("Could not find handleFile function. No handler changes were applied.");
}

const uploadAnchor = `              {uploaded && <div className="upload-success"><CheckCircle2 size={18}/> {fileName} selected. Ready for column mapping.</div>}`;

const uploadUI = `
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
`;

if (!s.includes("Review column mapping")) {
  if (!s.includes(uploadAnchor)) throw new Error("Could not find upload UI insertion point");
  s = s.replace(uploadAnchor, uploadAnchor + uploadUI);
}

fs.writeFileSync(file, s, "utf8");
console.log("Upload integration added to App.tsx");
