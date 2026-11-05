import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { Plus, Save } from "lucide-react";
import { canManageRateCards } from "./permissions";

type RateCard = {
  id: string;
  gatewayName: string;
  feePercent: number | string;
  fixedFee: number | string;
  tcsPercent: number | string;
  tdsPercent: number | string;
  isActive: boolean;
};

export default function RateCards() {
  const [cards, setCards] = useState<RateCard[]>([]);
  const [gatewayName, setGatewayName] = useState("");
  const [feePercent, setFeePercent] = useState("2");
  const [fixedFee, setFixedFee] = useState("0");
  const [tcsPercent, setTcsPercent] = useState("0");
  const [tdsPercent, setTdsPercent] = useState("0");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await apiFetch("/rate-cards");
    const data = await response.json();
    if (response.ok) setCards(data.rateCards || data.cards || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function addCard() {
    const response = await apiFetch("/rate-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gatewayName,
        feePercent: Number(feePercent),
        fixedFee: Number(fixedFee),
        tcsPercent: Number(tcsPercent),
        tdsPercent: Number(tdsPercent)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Could not save rate card");
      return;
    }

    setMessage("Rate card saved.");
    setGatewayName("");
    await load();
  }

  async function toggleCard(card: RateCard) {
    const response = await apiFetch("/rate-cards/" + card.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !card.isActive })
    });

    if (response.ok) await load();
  }

  return (
    <section className="panel table-panel">
      <div className="panel-heading">
        <div>
          <h3>Gateway rate cards</h3>
          <p>Manage expected settlement deductions</p>
        </div>
      </div>

      {canManageRateCards() && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: 18 }}>
          <input placeholder="Gateway name" value={gatewayName}
            onChange={e => setGatewayName(e.target.value)} />
          <input type="number" placeholder="Fee %" value={feePercent}
            onChange={e => setFeePercent(e.target.value)} />
          <input type="number" placeholder="Fixed fee" value={fixedFee}
            onChange={e => setFixedFee(e.target.value)} />
          <input type="number" placeholder="TCS %" value={tcsPercent}
            onChange={e => setTcsPercent(e.target.value)} />
          <input type="number" placeholder="TDS %" value={tdsPercent}
            onChange={e => setTdsPercent(e.target.value)} />
          <button className="btn-primary" onClick={addCard}>
            <Plus size={16} /> Add rate card
          </button>
        </div>
      )}

      {message && <p style={{ padding: 12 }}>{message}</p>}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>GATEWAY</th>
              <th>PLATFORM FEE</th>
              <th>FIXED FEE</th>
              <th>TCS</th>
              <th>TDS</th>
              <th>STATUS</th>
              {canManageRateCards() && <th>ACTION</th>}
            </tr>
          </thead>
          <tbody>
            {cards.map(card => (
              <tr key={card.id}>
                <td>{card.gatewayName}</td>
                <td>{card.feePercent}%</td>
                <td>₹{card.fixedFee}</td>
                <td>{card.tcsPercent}%</td>
                <td>{card.tdsPercent}%</td>
                <td>{card.isActive ? "Active" : "Inactive"}</td>
                {canManageRateCards() && (
                  <td>
                    <button className="btn-secondary" onClick={() => toggleCard(card)}>
                      <Save size={14} />
                      {card.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {cards.length === 0 && (
              <tr><td colSpan={7}>No rate cards found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}