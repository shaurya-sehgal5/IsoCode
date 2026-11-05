import { useEffect, useState } from "react";
import { RefreshCw, Plus, Search, RotateCcw } from "lucide-react";
import { apiFetch } from "./api";

const API = "http://localhost:5000/api";

type ReturnRecord = {
  id: string;
  returnNumber: string;
  orderReference: string;
  refundAmount: string;
  reason: string;
  status: "REQUESTED" | "APPROVED" | "REFUNDED" | "REJECTED";
  createdAt: string;
  order?: { customerName?: string };
};

const money = (value: string | number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value));

const statusStyle: Record<string, string> = {
  REQUESTED: "bg-amber-50 text-amber-700",
  APPROVED: "bg-blue-50 text-blue-700",
  REFUNDED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
};

export default function Returns() {
  const [records, setRecords] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [orderReference, setOrderReference] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadReturns() {
    try {
      const response = await apiFetch("/returns");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load returns");
      setRecords(data.returns || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load returns");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReturns();
  }, []);

  async function createReturn(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await apiFetch("/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderReference,
          refundAmount: Number(refundAmount),
          reason,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not create return");

      setRecords((previous) => [data.return, ...previous]);
      setOrderReference("");
      setRefundAmount("");
      setReason("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create return");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    setError("");

    try {
      const response = await apiFetch(`/returns/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Status update failed");

      setRecords((previous) =>
        previous.map((record) =>
          record.id === id ? { ...record, ...data.return } : record
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed");
      loadReturns();
    }
  }

  const filtered = records.filter((record) =>
    `${record.returnNumber} ${record.orderReference} ${record.reason}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const totalRefunds = records.reduce(
    (sum, record) => sum + Number(record.refundAmount),
    0
  );

  const refunded = records
    .filter((record) => record.status === "REFUNDED")
    .reduce((sum, record) => sum + Number(record.refundAmount), 0);

  const pending = records.filter(
    (record) => record.status === "REQUESTED" || record.status === "APPROVED"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Returns & Refunds</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track customer returns and refund reconciliation.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          <Plus size={17} /> Create return
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={createReturn}
          className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-3"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Order reference
            </label>
            <input
              required
              value={orderReference}
              onChange={(e) => setOrderReference(e.target.value)}
              placeholder="ORD-1001"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Refund amount (₹)
            </label>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="500"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Reason
            </label>
            <input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Customer requested refund"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div className="flex gap-2 md:col-span-3">
            <button
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save return"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total returns", records.length],
          ["Refund value", money(totalRefunds)],
          ["Refunded", money(refunded)],
          ["Pending actions", pending],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <h2 className="font-semibold text-slate-900">Return records</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3">
              <Search size={15} className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search returns..."
                className="w-40 py-2 text-sm outline-none"
              />
            </div>
            <button
              onClick={() => { setLoading(true); loadReturns(); }}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading returns...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <RotateCcw className="mx-auto mb-3 text-slate-300" size={30} />
            <p className="font-medium text-slate-700">No return records found</p>
            <p className="mt-1 text-sm text-slate-500">Create a return to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Return ID</th>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Refund</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-800">
                      {record.returnNumber}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{record.orderReference}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {record.order?.customerName || "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-800">
                      {money(record.refundAmount)}
                    </td>
                    <td className="max-w-48 px-5 py-4 text-slate-500">{record.reason}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                      {new Date(record.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={record.status}
                        onChange={(e) => updateStatus(record.id, e.target.value)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold outline-none ${statusStyle[record.status]}`}
                      >
                        <option value="REQUESTED">Requested</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REFUNDED">Refunded</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
