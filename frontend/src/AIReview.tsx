import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, CheckCircle2, XCircle, History, RotateCcw, AlertCircle } from "lucide-react";
import { apiFetch } from "./api";

type Suggestion = {
  id: string;
  confidence: number;
  reason: string;
  evidence: string[];
  paymentRecord: {
    id: string;
    externalTransactionId: string | null;
    grossAmount: string | number;
    netAmount: string | number;
    paymentDate: string | null;
  };
  suggestedOrder: {
    id: string;
    orderNumber: string;
    orderAmount: string | number;
    orderDate: string | null;
  };
};

type MappingVersion = {
  id: string;
  sourceName: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  mapping: Record<string, string | null>;
};

export default function AIReview() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [mappings, setMappings] = useState<MappingVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [suggestionResponse, mappingResponse] = await Promise.all([
        apiFetch("/ai-matches"),
        apiFetch("/uploads/mappings")
      ]);

      const suggestionData = await suggestionResponse.json();
      const mappingData = await mappingResponse.json();

      if (!suggestionResponse.ok) throw new Error(suggestionData.message || "Could not load suggestions");
      if (!mappingResponse.ok) throw new Error(mappingData.message || "Could not load mappings");

      setSuggestions(suggestionData.suggestions || []);
      setMappings(mappingData.mappings || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load AI review data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function generateSuggestions() {
    setGenerating(true);
    setMessage("");

    try {
      const response = await apiFetch("/ai-matches/generate", {
        method: "POST"
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "AI generation failed");

      setMessage(
        `Scanned ${data.paymentsScanned} payments. Generated ${data.suggestionsCreated} suggestions.`
      );

      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate suggestions");
    } finally {
      setGenerating(false);
    }
  }

  async function reviewSuggestion(id: string, decision: "APPROVE" | "REJECT") {
    setBusyId(id);
    setMessage("");

    try {
      const response = await apiFetch(`/ai-matches/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Review failed");

      setMessage(decision === "APPROVE"
        ? "Suggested match approved and reconciliation updated."
        : "Suggested match rejected.");

      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review failed");
    } finally {
      setBusyId("");
    }
  }

  async function rollbackMapping(id: string, version: number) {
    if (!window.confirm(`Activate mapping version ${version}?`)) return;

    setBusyId(id);
    setMessage("");

    try {
      const response = await apiFetch(`/uploads/mappings/${id}/activate`, {
        method: "PATCH"
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Rollback failed");

      setMessage(`Mapping version ${version} activated successfully.`);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rollback failed");
    } finally {
      setBusyId("");
    }
  }

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e8e8ee",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16
  };

  const buttonStyle: React.CSSProperties = {
    border: "1px solid #e3e3eb",
    borderRadius: 8,
    padding: "9px 13px",
    cursor: "pointer",
    background: "#fff",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    fontSize: 13
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 15, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>
              <Sparkles size={19} style={{ verticalAlign: "middle", marginRight: 8 }} />
              AI matching review
            </h2>
            <p style={{ color: "#777", fontSize: 13, margin: 0 }}>
              Review Gemini's suggested order matches before updating reconciliation.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button style={buttonStyle} onClick={loadData} disabled={loading}>
              <RefreshCw size={15} /> Refresh
            </button>
            <button
              style={{ ...buttonStyle, background: "#6754d9", color: "#fff", border: "none" }}
              onClick={generateSuggestions}
              disabled={generating}
            >
              <Sparkles size={15} />
              {generating ? "Generating..." : "Generate AI suggestions"}
            </button>
          </div>
        </div>

        {message && (
          <div style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background: "#f3f1ff",
            color: "#5545b8",
            fontSize: 13
          }}>
            {message}
          </div>
        )}

        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
          <div style={{ background: "#f8f7fc", padding: 15, borderRadius: 9 }}>
            <span style={{ color: "#777", fontSize: 12 }}>Pending suggestions</span>
            <h2 style={{ margin: "7px 0 0", fontSize: 25 }}>{suggestions.length}</h2>
          </div>
          <div style={{ background: "#f8f7fc", padding: 15, borderRadius: 9 }}>
            <span style={{ color: "#777", fontSize: 12 }}>Mapping versions</span>
            <h2 style={{ margin: "7px 0 0", fontSize: 25 }}>{mappings.length}</h2>
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Suggested payment matches</h3>
          <p style={{ color: "#777", fontSize: 12 }}>
            Only payments without an order reference are considered.
          </p>
        </div>

        {loading && <p>Loading suggestions...</p>}

        {!loading && suggestions.length === 0 && (
          <div style={{ textAlign: "center", padding: 35, color: "#888" }}>
            <CheckCircle2 size={30} />
            <p>No pending AI suggestions.</p>
            <span style={{ fontSize: 12 }}>Generate suggestions to scan payments with missing order IDs.</span>
          </div>
        )}

        {suggestions.map(item => (
          <div key={item.id} style={{
            border: "1px solid #ececf1",
            borderRadius: 10,
            padding: 16,
            marginBottom: 12
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <b>{item.paymentRecord.externalTransactionId || item.paymentRecord.id}</b>
                <p style={{ color: "#777", fontSize: 12, margin: "5px 0" }}>
                  Payment date: {item.paymentRecord.paymentDate
                    ? new Date(item.paymentRecord.paymentDate).toLocaleDateString("en-IN")
                    : "Not available"}
                </p>
              </div>
              <span style={{
                background: "#f0edff",
                color: "#6654c9",
                padding: "6px 10px",
                borderRadius: 20,
                height: "fit-content",
                fontSize: 12
              }}>
                {(item.confidence * 100).toFixed(0)}% AI confidence
              </span>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
              gap: 12,
              background: "#fafafa",
              padding: 13,
              borderRadius: 8,
              marginTop: 12
            }}>
              <div>
                <span style={{ color: "#888", fontSize: 11 }}>Payment gross</span>
                <h3 style={{ margin: "5px 0" }}>₹{Number(item.paymentRecord.grossAmount).toLocaleString("en-IN")}</h3>
              </div>
              <div>
                <span style={{ color: "#888", fontSize: 11 }}>Suggested order</span>
                <h3 style={{ margin: "5px 0" }}>{item.suggestedOrder.orderNumber}</h3>
              </div>
              <div>
                <span style={{ color: "#888", fontSize: 11 }}>Order amount</span>
                <h3 style={{ margin: "5px 0" }}>₹{Number(item.suggestedOrder.orderAmount).toLocaleString("en-IN")}</h3>
              </div>
            </div>

            <p style={{ fontSize: 13, marginTop: 13 }}>
              <b>AI reasoning:</b> {item.reason}
            </p>

            {Array.isArray(item.evidence) && item.evidence.length > 0 && (
              <div style={{ fontSize: 12, color: "#666" }}>
                <b>Evidence:</b>
                <ul>
                  {item.evidence.map((entry, index) => <li key={index}>{entry}</li>)}
                </ul>
              </div>
            )}

            <div style={{ display: "flex", gap: 9, marginTop: 15, flexWrap: "wrap" }}>
              <button
                style={{ ...buttonStyle, background: "#e9f7ef", color: "#16834b", border: "none" }}
                disabled={busyId === item.id}
                onClick={() => reviewSuggestion(item.id, "APPROVE")}
              >
                <CheckCircle2 size={15} /> Approve match
              </button>
              <button
                style={{ ...buttonStyle, background: "#fff0f0", color: "#c43b3b", border: "none" }}
                disabled={busyId === item.id}
                onClick={() => reviewSuggestion(item.id, "REJECT")}
              >
                <XCircle size={15} /> Reject
              </button>
            </div>
          </div>
        ))}
      </section>

      <section style={cardStyle}>
        <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>
          <History size={17} style={{ verticalAlign: "middle", marginRight: 8 }} />
          Column mapping history
        </h3>
        <p style={{ color: "#777", fontSize: 12 }}>
          Review saved mappings and reactivate an older version when a new mapping is incorrect.
        </p>

        {mappings.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>No saved mappings yet.</p>}

        {mappings.map(mapping => (
          <div key={mapping.id} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            borderTop: "1px solid #eee",
            padding: "14px 0"
          }}>
            <div>
              <b style={{ fontSize: 13 }}>{mapping.sourceName}</b>
              <p style={{ color: "#888", fontSize: 12, margin: "5px 0" }}>
                Version {mapping.version} · {new Date(mapping.createdAt).toLocaleString("en-IN")}
              </p>
              {mapping.isActive && (
                <span style={{ color: "#16834b", fontSize: 11 }}>● Active version</span>
              )}
            </div>

            {!mapping.isActive && (
              <button
                style={buttonStyle}
                disabled={busyId === mapping.id}
                onClick={() => rollbackMapping(mapping.id, mapping.version)}
              >
                <RotateCcw size={14} /> Activate version
              </button>
            )}
          </div>
        ))}
      </section>

      <p style={{ fontSize: 11, color: "#888", display: "flex", gap: 7, alignItems: "center" }}>
        <AlertCircle size={14} />
        AI recommendations are advisory. Only an authorized human reviewer can approve a match.
      </p>
    </div>
  );
}
