import { useState, useCallback } from "react";
import { ethers } from "ethers";
import ProduceRegistryABI from "../utils/ProduceRegistry.json";
import TrackTransferABI   from "../utils/TrackTransfer.json";
import { REGISTRY_ADDRESS, TRACKER_ADDRESS } from "../utils/addresses";
import { toastSuccess, toastError, toastLoading, toastDismiss } from "../utils/toast";
import Confetti from "../components/Confetti";

const STATUS_LABELS = ["Registered","In Transit","Quality Checked","Delivered","Rejected"];
const STATUS_COLORS = ["#e8f5ee","#fef3c7","#eff6ff","#d1fae5","#fee2e2"];
const STATUS_TEXT   = ["#1a6b3a","#92400e","#1e40af","#065f46","#991b1b"];

// ── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow({ cols = 7 }) {
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

export default function FarmerPage({ account }) {
  const [tab, setTab]       = useState("register");
  const [form, setForm]     = useState({ produceType: "", quantity: "", farmLocation: "", certification: "None", notes: "" });
  const [transfer, setTransfer] = useState({ batchId: "", distributorAddr: "", location: "", temp: "25", transport: "0" });
  const [loading, setLoading]   = useState(false);
  const [batches, setBatches]   = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const handle  = e => setForm({ ...form, [e.target.name]: e.target.value });
  const handleT = e => setTransfer({ ...transfer, [e.target.name]: e.target.value });

  async function getSigner() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    return provider.getSigner();
  }

  async function registerBatch() {
    if (!form.produceType || !form.quantity || !form.farmLocation) {
      toastError("Please fill all required fields."); return;
    }
    const tid = toastLoading("Waiting for MetaMask confirmation...");
    try {
      setLoading(true);
      const signer   = await getSigner();
      const contract = new ethers.Contract(REGISTRY_ADDRESS, ProduceRegistryABI.abi, signer);
      const tx       = await contract.registerBatch(form.produceType, BigInt(form.quantity), form.farmLocation, form.certification, form.notes);
      toastDismiss(tid);
      toastLoading("Transaction submitted — waiting for block confirmation...");
      const receipt  = await tx.wait();
      const event    = receipt.logs.find(l => { try { return contract.interface.parseLog(l)?.name === "BatchRegistered"; } catch { return false; } });
      const batchId  = event ? contract.interface.parseLog(event).args[0].toString() : "?";
      toastDismiss(tid);
      toastSuccess(`✅ Batch #${batchId} registered on blockchain!`);
      setConfetti(true);
      setTimeout(() => setConfetti(false), 3600);
      setForm({ produceType: "", quantity: "", farmLocation: "", certification: "None", notes: "" });
    } catch (e) {
      toastDismiss(tid);
      toastError(e.reason || e.message || "Transaction failed.");
    } finally { setLoading(false); }
  }

  async function transferToDistributor() {
    if (!transfer.batchId) { toastError("Enter Batch ID"); return; }
    if (!ethers.isAddress(transfer.distributorAddr)) { toastError("Enter a valid distributor wallet address"); return; }
    const tid = toastLoading("Waiting for MetaMask confirmation...");
    try {
      setLoading(true);
      const signer   = await getSigner();
      const contract = new ethers.Contract(TRACKER_ADDRESS, TrackTransferABI.abi, signer);
      const tx = await contract.logTransfer(BigInt(transfer.batchId), transfer.distributorAddr, parseInt(transfer.transport), parseInt(transfer.temp), transfer.location || "Farm Gate", "Transferred to distributor");
      toastDismiss(tid);
      toastLoading("Transaction submitted — waiting for block confirmation...");
      await tx.wait();
      toastDismiss(tid);
      toastSuccess(`✅ Batch #${transfer.batchId} transferred to distributor!`);
      setTransfer({ batchId: "", distributorAddr: "", location: "", temp: "25", transport: "0" });
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
      const ids      = await contract.getFarmerBatches(account);
      const details  = await Promise.all(ids.map(id => contract.getBatch(id)));
      setBatches(details.map(b => ({
        batchId:      b.batchId.toString(),
        produceType:  b.produceType,
        quantity:     b.quantity.toString(),
        farmLocation: b.farmLocation,
        certification:b.certification,
        status:       Number(b.status),
        harvestDate:  new Date(Number(b.harvestTimestamp) * 1000).toLocaleDateString(),
        currentHolder:b.currentHolder,
      })));
    } catch (e) { toastError("Failed to load batches."); console.error(e); }
    finally { setLoadingBatches(false); }
  }, [account]);

  function handleTabChange(t) { setTab(t); if (t === "batches") loadMyBatches(); }

  return (
    <div>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <Confetti active={confetti} />

      {/* Tabs */}
      <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
        {[["register","Register Batch"],["transfer","Transfer to Distributor"],["batches","My Batches"]].map(([key,label]) => (
          <button key={key} className={tab === key ? "btn" : "btn-outline"} onClick={() => handleTabChange(key)}>{label}</button>
        ))}
      </div>

      {/* Register Tab */}
      {tab === "register" && (
        <div className="card">
          <div className="card-header"><h2>🌾 Register Produce Batch</h2></div>
          <div className="card-body">
            <div className="form-grid">
              <div className="field"><label>Produce Type *</label><input name="produceType" value={form.produceType} onChange={handle} placeholder="Wheat, Tomato, Onion..." /></div>
              <div className="field"><label>Quantity (kg) *</label><input name="quantity" type="number" value={form.quantity} onChange={handle} placeholder="500" /></div>
              <div className="field"><label>Farm Location *</label><input name="farmLocation" value={form.farmLocation} onChange={handle} placeholder="Village, District, State" /></div>
              <div className="field">
                <label>Certification</label>
                <select name="certification" value={form.certification} onChange={handle}>
                  <option>None</option><option>Organic</option><option>APEDA</option><option>GlobalGAP</option><option>FSSAI</option>
                </select>
              </div>
              <div className="field" style={{ gridColumn: "span 2" }}><label>Notes</label><input name="notes" value={form.notes} onChange={handle} placeholder="Pesticide use, variety, harvest method..." /></div>
            </div>
            <button className="btn" onClick={registerBatch} disabled={loading}>
              {loading && <span className="spinner" />}{loading ? "Registering..." : "Register Batch ⬡"}
            </button>
          </div>
        </div>
      )}

      {/* Transfer Tab */}
      {tab === "transfer" && (
        <div className="card">
          <div className="card-header"><h2>🚛 Transfer to Distributor</h2></div>
          <div className="card-body">
            <div className="form-grid">
              <div className="field"><label>Batch ID *</label><input name="batchId" value={transfer.batchId} onChange={handleT} placeholder="1000" /></div>
              <div className="field"><label>Temperature (°C)</label><input name="temp" type="number" value={transfer.temp} onChange={handleT} /></div>
              <div className="field" style={{ gridColumn: "span 2" }}><label>Distributor Wallet Address *</label><input name="distributorAddr" value={transfer.distributorAddr} onChange={handleT} placeholder="0x... distributor's wallet" /></div>
              <div className="field"><label>Pickup Location</label><input name="location" value={transfer.location} onChange={handleT} placeholder="Farm Gate, Nasik" /></div>
              <div className="field">
                <label>Transport Mode</label>
                <select name="transport" value={transfer.transport} onChange={handleT}>
                  <option value="0">🚛 Road</option><option value="1">🚂 Rail</option><option value="2">✈️ Air</option><option value="3">🚢 Sea</option>
                </select>
              </div>
            </div>
            <button className="btn" onClick={transferToDistributor} disabled={loading}>
              {loading && <span className="spinner" />}{loading ? "Transferring..." : "Transfer to Distributor ⬡"}
            </button>
          </div>
        </div>
      )}

      {/* My Batches Tab */}
      {tab === "batches" && (
        <div className="card">
          <div className="card-header">
            <h2>📦 My Registered Batches</h2>
            <button className="btn-outline" onClick={loadMyBatches} disabled={loadingBatches}>{loadingBatches ? "Loading..." : "🔄 Refresh"}</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {loadingBatches ? (
              <table>
                <thead><tr><th>Batch ID</th><th>Produce</th><th>Qty (kg)</th><th>Location</th><th>Cert</th><th>Harvest</th><th>Status</th></tr></thead>
                <tbody>{[1,2,3].map(i => <SkeletonRow key={i} cols={7} />)}</tbody>
              </table>
            ) : batches.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#9ca3af" }}>No batches registered yet. Use the Register tab to add your first batch.</div>
            ) : (
              <table>
                <thead><tr><th>Batch ID</th><th>Produce</th><th>Qty (kg)</th><th>Location</th><th>Cert</th><th>Harvest</th><th>Status</th></tr></thead>
                <tbody>
                  {batches.map(b => (
                    <tr key={b.batchId}>
                      <td><strong>#{b.batchId}</strong></td>
                      <td>{b.produceType}</td>
                      <td>{b.quantity}</td>
                      <td>{b.farmLocation}</td>
                      <td>{b.certification}</td>
                      <td>{b.harvestDate}</td>
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