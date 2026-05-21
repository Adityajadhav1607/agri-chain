import { useState, useCallback } from "react";
import { ethers } from "ethers";
import TrackTransferABI   from "../utils/TrackTransfer.json";
import ProduceRegistryABI from "../utils/ProduceRegistry.json";
import QualityVerifierABI from "../utils/QualityVerifier.json";
import { TRACKER_ADDRESS, REGISTRY_ADDRESS, VERIFIER_ADDRESS } from "../utils/addresses";
import { toastSuccess, toastError, toastLoading, toastDismiss } from "../utils/toast";
import Confetti    from "../components/Confetti";
import StatsCard   from "../components/StatsCard";
import CopyButton  from "../components/CopyButton";
import BatchAgeTag from "../components/BatchAgeTag";

const STATUS_LABELS = ["Registered","In Transit","Quality Checked","Delivered","Rejected"];
const STATUS_COLORS = ["#e8f5ee","#fef3c7","#eff6ff","#d1fae5","#fee2e2"];
const STATUS_TEXT   = ["#1a6b3a","#92400e","#1e40af","#065f46","#991b1b"];
const GRADE_LABELS  = ["A","B","C","Rejected"];
const GRADE_COLORS  = { A:"#065f46", B:"#1e40af", C:"#92400e", Rejected:"#991b1b" };
const GRADE_BG      = { A:"#d1fae5", B:"#dbeafe", C:"#fef3c7", Rejected:"#fee2e2" };

function SkeletonRow({ cols = 7 }) {
  return (
    <tr>{Array.from({ length: cols }).map((_, i) => (
      <td key={i}><div className="skeleton-line" /></td>
    ))}</tr>
  );
}

function ColdChainScore({ temps }) {
  if (!temps || temps.length === 0) return <span style={{ color: "#9ca3af", fontSize: "11px" }}>—</span>;
  const safe  = temps.filter(t => t >= 0 && t <= 35).length;
  const pct   = Math.round((safe / temps.length) * 100);
  const color = pct >= 90 ? "#065f46" : pct >= 70 ? "#92400e" : "#991b1b";
  const bg    = pct >= 90 ? "#d1fae5" : pct >= 70 ? "#fef3c7" : "#fee2e2";
  return (
    <span style={{ background: bg, color, padding: "2px 8px", borderRadius: 10, fontSize: "11px", fontWeight: 600 }}>
      ❄️ {pct}%
    </span>
  );
}

export default function DistributorPage({ account }) {
  const [tab, setTab]     = useState("transfer");
  const [form, setForm]   = useState({ batchId: "", retailerAddr: "", location: "", temp: "10", transport: "0" });
  const [loading, setLoading]         = useState(false);
  const [batches, setBatches]         = useState([]);
  const [batchCerts, setBatchCerts]   = useState({});    // { batchId: grade }
  const [batchTemps, setBatchTemps]   = useState({});    // { batchId: [temps] }
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [confetti, setConfetti]       = useState(false);
  const [quickTransferBatch, setQuickTransferBatch] = useState(null);

  const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

  async function transferToRetailer() {
    const bId = quickTransferBatch?.batchId || form.batchId;
    const rAddr = quickTransferBatch ? form.retailerAddr : form.retailerAddr;
    if (!bId) { toastError("Enter Batch ID"); return; }
    if (!ethers.isAddress(form.retailerAddr)) { toastError("Enter a valid retailer wallet address"); return; }
    const tid = toastLoading("Waiting for MetaMask confirmation...");
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer   = await provider.getSigner();
      const contract = new ethers.Contract(TRACKER_ADDRESS, TrackTransferABI.abi, signer);
      const tx = await contract.logTransfer(BigInt(bId), form.retailerAddr, parseInt(form.transport), parseInt(form.temp), form.location || "Distribution Center", "Transferred to retailer");
      toastDismiss(tid);
      toastLoading("Transaction submitted — waiting for block confirmation...");
      await tx.wait();
      toastDismiss(tid);
      toastSuccess(`✅ Batch #${bId} delivered to retailer!`);
      setConfetti(true);
      setTimeout(() => setConfetti(false), 3600);
      setForm({ batchId: "", retailerAddr: "", location: "", temp: "10", transport: "0" });
      setQuickTransferBatch(null);
    } catch (e) {
      toastDismiss(tid);
      toastError(e.reason || e.message || "Transaction failed.");
    } finally { setLoading(false); }
  }

  const loadMyBatches = useCallback(async () => {
    try {
      setLoadingBatches(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const registry = new ethers.Contract(REGISTRY_ADDRESS, ProduceRegistryABI.abi, provider);
      const verifier = new ethers.Contract(VERIFIER_ADDRESS, QualityVerifierABI.abi, provider);
      const tracker  = new ethers.Contract(TRACKER_ADDRESS,  TrackTransferABI.abi,  provider);

      const ids     = await registry.getHolderBatches(account);
      const details = await Promise.all(ids.map(id => registry.getBatch(id).catch(() => null)));
      const mine    = details.filter(b => b && b.currentHolder.toLowerCase() === account.toLowerCase());

      const batchList = mine.map(b => ({
        batchId:         b.batchId.toString(),
        produceType:     b.produceType,
        quantity:        b.quantity.toString(),
        farmLocation:    b.farmLocation,
        harvestTimestamp: b.harvestTimestamp.toString(),
        status:          Number(b.status),
        farmer:          b.farmer.slice(0,10) + "...",
      }));
      setBatches(batchList);

      // Load certs and temps in background
      const certMap = {}, tempMap = {};
      await Promise.all(batchList.map(async b => {
        try {
          const c = await verifier.getBatchCertificate(BigInt(b.batchId));
          certMap[b.batchId] = GRADE_LABELS[Number(c.grade)];
        } catch {}
        try {
          const transfers = await tracker.getBatchHistory(BigInt(b.batchId));
          tempMap[b.batchId] = transfers.map(t => Number(t.temperature));
        } catch {}
      }));
      setBatchCerts(certMap);
      setBatchTemps(tempMap);

    } catch (e) { toastError("Failed to load batches."); console.error(e); }
    finally { setLoadingBatches(false); }
  }, [account]);

  function handleTabChange(t) { setTab(t); if (t === "batches") loadMyBatches(); }

  const inCustody  = batches.filter(b => b.status !== 3 && b.status !== 4).length;
  const delivered  = batches.filter(b => b.status === 3).length;
  const totalKg    = batches.reduce((s, b) => s + parseInt(b.quantity || 0), 0);

  return (
    <div>
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .skeleton-line{height:14px;border-radius:6px;background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.4s ease infinite}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp 0.4s ease forwards}
      `}</style>
      <Confetti active={confetti} />

      {/* Stats */}
      <div className="stats" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <StatsCard icon="📦" label="In Custody"     value={inCustody}  color="#b45309" />
        <StatsCard icon="✅" label="Delivered"       value={delivered}  color="#1a6b3a" />
        <StatsCard icon="⚖️" label="Total Volume"   value={`${totalKg.toLocaleString()} kg`} color="#1e40af" />
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
        {[["transfer","🚛 Transfer to Retailer"],["batches","📦 My Batches"]].map(([key,label]) => (
          <button key={key} className={tab === key ? "btn" : "btn-outline"} onClick={() => handleTabChange(key)}>{label}</button>
        ))}
      </div>

      {/* ── TRANSFER TAB ── */}
      {tab === "transfer" && (
        <div className="card fade-up">
          <div className="card-header">
            <h2>🚛 Transfer Batch to Retailer</h2>
            {quickTransferBatch && (
              <span style={{ background: "#e8f5ee", color: "#1a6b3a", padding: "3px 10px", borderRadius: 6, fontSize: "12px" }}>
                Quick Transfer: Batch #{quickTransferBatch.batchId} ({quickTransferBatch.produceType})
              </span>
            )}
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="field">
                <label>Batch ID *</label>
                <input name="batchId" value={quickTransferBatch?.batchId || form.batchId}
                  onChange={e => !quickTransferBatch && handle(e)} placeholder="1000"
                  style={quickTransferBatch ? { background: "#e8f5ee", color: "#1a6b3a" } : {}}
                  readOnly={!!quickTransferBatch}
                />
              </div>
              <div className="field">
                <label>Temperature (°C)</label>
                <input name="temp" type="number" value={form.temp} onChange={handle} />
                {(parseInt(form.temp) > 35 || parseInt(form.temp) < 0) && (
                  <div style={{ fontSize: "11px", color: "#dc2626", marginTop: 3 }}>⚠️ Temperature outside safe range!</div>
                )}
              </div>
              <div className="field" style={{ gridColumn: "span 2" }}>
                <label>Retailer Wallet Address *</label>
                <input name="retailerAddr" value={form.retailerAddr} onChange={handle} placeholder="0x... retailer's wallet" />
              </div>
              <div className="field">
                <label>Current Location</label>
                <input name="location" value={form.location} onChange={handle} placeholder="Pune Distribution Center" />
              </div>
              <div className="field">
                <label>Transport Mode</label>
                <select name="transport" value={form.transport} onChange={handle}>
                  <option value="0">🚛 Road</option><option value="1">🚂 Rail</option>
                  <option value="2">✈️ Air</option><option value="3">🚢 Sea</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="btn" onClick={transferToRetailer} disabled={loading}>
                {loading && <span className="spinner" />}{loading ? "Transferring..." : "Deliver to Retailer ⬡"}
              </button>
              {quickTransferBatch && (
                <button className="btn-outline" onClick={() => setQuickTransferBatch(null)}>Cancel Quick Transfer</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── BATCHES TAB ── */}
      {tab === "batches" && (
        <div className="card fade-up">
          <div className="card-header">
            <h2>📦 Batches In My Custody</h2>
            <button className="btn-outline" onClick={loadMyBatches} disabled={loadingBatches}>{loadingBatches ? "Loading..." : "🔄 Refresh"}</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {loadingBatches ? (
              <table><thead><tr><th>Batch ID</th><th>Produce</th><th>Qty</th><th>Origin</th><th>Freshness</th><th>Grade</th><th>Cold Chain</th><th>Status</th><th></th></tr></thead>
                <tbody>{[1,2,3].map(i => <SkeletonRow key={i} cols={9} />)}</tbody>
              </table>
            ) : batches.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>📭</div>
                No batches currently in your custody.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead><tr>
                    <th>Batch ID</th><th>Produce</th><th>Qty (kg)</th><th>Origin</th>
                    <th>Freshness</th><th>Quality</th><th>Cold Chain</th><th>Status</th><th>Action</th>
                  </tr></thead>
                  <tbody>
                    {batches.map(b => (
                      <tr key={b.batchId}>
                        <td><strong>#{b.batchId}</strong><CopyButton text={b.batchId} /></td>
                        <td>{b.produceType}</td>
                        <td>{parseInt(b.quantity).toLocaleString()}</td>
                        <td>{b.farmLocation}</td>
                        <td><BatchAgeTag harvestTimestamp={b.harvestTimestamp} produceType={b.produceType} /></td>
                        <td>
                          {batchCerts[b.batchId] ? (
                            <span style={{
                              background: GRADE_BG[batchCerts[b.batchId]],
                              color: GRADE_COLORS[batchCerts[b.batchId]],
                              padding: "2px 8px", borderRadius: 10, fontSize: "11px", fontWeight: 700,
                            }}>Grade {batchCerts[b.batchId]}</span>
                          ) : <span style={{ color: "#9ca3af", fontSize: "11px" }}>Pending</span>}
                        </td>
                        <td><ColdChainScore temps={batchTemps[b.batchId]} /></td>
                        <td><span className="badge" style={{ background: STATUS_COLORS[b.status], color: STATUS_TEXT[b.status] }}>{STATUS_LABELS[b.status]}</span></td>
                        <td>
                          <button
                            className="btn" style={{ fontSize: "11px", padding: "5px 10px" }}
                            onClick={() => { setQuickTransferBatch(b); setTab("transfer"); }}
                          >
                            🚛 Transfer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}