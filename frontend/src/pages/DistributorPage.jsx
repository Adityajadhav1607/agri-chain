import { useState, useCallback } from "react";
import { ethers } from "ethers";
import TrackTransferABI   from "../utils/TrackTransfer.json";
import ProduceRegistryABI from "../utils/ProduceRegistry.json";
import { TRACKER_ADDRESS, REGISTRY_ADDRESS } from "../utils/addresses";
import { toastSuccess, toastError, toastLoading, toastDismiss } from "../utils/toast";
import Confetti from "../components/Confetti";

const STATUS_LABELS = ["Registered","In Transit","Quality Checked","Delivered","Rejected"];
const STATUS_COLORS = ["#e8f5ee","#fef3c7","#eff6ff","#d1fae5","#fee2e2"];
const STATUS_TEXT   = ["#1a6b3a","#92400e","#1e40af","#065f46","#991b1b"];

function SkeletonRow({ cols = 6 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <div style={{ height: "14px", borderRadius: "6px", background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s ease infinite" }} />
        </td>
      ))}
    </tr>
  );
}

export default function DistributorPage({ account }) {
  const [tab, setTab]     = useState("transfer");
  const [form, setForm]   = useState({ batchId: "", retailerAddr: "", location: "", temp: "10", transport: "0" });
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

  async function transferToRetailer() {
    if (!form.batchId) { toastError("Enter Batch ID"); return; }
    if (!ethers.isAddress(form.retailerAddr)) { toastError("Enter a valid retailer wallet address"); return; }
    const tid = toastLoading("Waiting for MetaMask confirmation...");
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer   = await provider.getSigner();
      const contract = new ethers.Contract(TRACKER_ADDRESS, TrackTransferABI.abi, signer);
      const tx = await contract.logTransfer(BigInt(form.batchId), form.retailerAddr, parseInt(form.transport), parseInt(form.temp), form.location || "Distribution Center", "Transferred to retailer");
      toastDismiss(tid);
      toastLoading("Transaction submitted — waiting for block confirmation...");
      await tx.wait();
      toastDismiss(tid);
      toastSuccess(`✅ Batch #${form.batchId} delivered to retailer!`);
      setConfetti(true);
      setTimeout(() => setConfetti(false), 3600);
      setForm({ batchId: "", retailerAddr: "", location: "", temp: "10", transport: "0" });
    } catch (e) {
      toastDismiss(tid);
      toastError(e.reason || e.message || "Transaction failed.");
    } finally { setLoading(false); }
  }

  const loadMyBatches = useCallback(async () => {
    try {
      setLoadingBatches(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(REGISTRY_ADDRESS, ProduceRegistryABI.abi, provider);
      const ids      = await contract.getHolderBatches(account);
      const details  = await Promise.all(ids.map(id => contract.getBatch(id).catch(() => null)));
      const mine     = details.filter(b => b && b.currentHolder.toLowerCase() === account.toLowerCase());
      setBatches(mine.map(b => ({
        batchId:      b.batchId.toString(),
        produceType:  b.produceType,
        quantity:     b.quantity.toString(),
        farmLocation: b.farmLocation,
        status:       Number(b.status),
        farmer:       b.farmer.slice(0,10) + "...",
      })));
    } catch (e) { toastError("Failed to load batches."); console.error(e); }
    finally { setLoadingBatches(false); }
  }, [account]);

  function handleTabChange(t) { setTab(t); if (t === "batches") loadMyBatches(); }

  return (
    <div>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <Confetti active={confetti} />

      <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
        {[["transfer","Transfer to Retailer"],["batches","My Batches"]].map(([key,label]) => (
          <button key={key} className={tab === key ? "btn" : "btn-outline"} onClick={() => handleTabChange(key)}>{label}</button>
        ))}
      </div>

      {tab === "transfer" && (
        <div className="card">
          <div className="card-header"><h2>🚛 Transfer Batch to Retailer</h2></div>
          <div className="card-body">
            <div className="form-grid">
              <div className="field"><label>Batch ID *</label><input name="batchId" value={form.batchId} onChange={handle} placeholder="1000" /></div>
              <div className="field"><label>Temperature (°C)</label><input name="temp" type="number" value={form.temp} onChange={handle} /></div>
              <div className="field" style={{ gridColumn: "span 2" }}><label>Retailer Wallet Address *</label><input name="retailerAddr" value={form.retailerAddr} onChange={handle} placeholder="0x... retailer's wallet" /></div>
              <div className="field"><label>Current Location</label><input name="location" value={form.location} onChange={handle} placeholder="Pune Distribution Center" /></div>
              <div className="field">
                <label>Transport Mode</label>
                <select name="transport" value={form.transport} onChange={handle}>
                  <option value="0">🚛 Road</option><option value="1">🚂 Rail</option><option value="2">✈️ Air</option><option value="3">🚢 Sea</option>
                </select>
              </div>
            </div>
            <button className="btn" onClick={transferToRetailer} disabled={loading}>
              {loading && <span className="spinner" />}{loading ? "Transferring..." : "Deliver to Retailer ⬡"}
            </button>
          </div>
        </div>
      )}

      {tab === "batches" && (
        <div className="card">
          <div className="card-header">
            <h2>📦 Batches In My Custody</h2>
            <button className="btn-outline" onClick={loadMyBatches} disabled={loadingBatches}>{loadingBatches ? "Loading..." : "🔄 Refresh"}</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {loadingBatches ? (
              <table>
                <thead><tr><th>Batch ID</th><th>Produce</th><th>Qty (kg)</th><th>Origin</th><th>Farmer</th><th>Status</th></tr></thead>
                <tbody>{[1,2,3].map(i => <SkeletonRow key={i} cols={6} />)}</tbody>
              </table>
            ) : batches.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#9ca3af" }}>No batches currently in your custody.</div>
            ) : (
              <table>
                <thead><tr><th>Batch ID</th><th>Produce</th><th>Qty (kg)</th><th>Origin</th><th>Farmer</th><th>Status</th></tr></thead>
                <tbody>
                  {batches.map(b => (
                    <tr key={b.batchId}>
                      <td><strong>#{b.batchId}</strong></td>
                      <td>{b.produceType}</td>
                      <td>{b.quantity}</td>
                      <td>{b.farmLocation}</td>
                      <td style={{ fontFamily: "monospace", fontSize: "11px" }}>{b.farmer}</td>
                      <td><span className="badge" style={{ background: STATUS_COLORS[b.status], color: STATUS_TEXT[b.status] }}>{STATUS_LABELS[b.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}