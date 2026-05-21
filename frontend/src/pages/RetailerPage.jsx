import { useState, useCallback, useRef } from "react";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import ProduceRegistryABI from "../utils/ProduceRegistry.json";
import { REGISTRY_ADDRESS } from "../utils/addresses";
import { toastSuccess, toastError, toastLoading, toastDismiss } from "../utils/toast";
import Confetti    from "../components/Confetti";
import StatsCard   from "../components/StatsCard";
import CopyButton  from "../components/CopyButton";
import BatchAgeTag from "../components/BatchAgeTag";
import FreshnessMeter from "../components/FreshnessMeter";
import { getFreshnessInfo } from "../utils/shelfLife";

const STATUS_LABELS = ["Registered","In Transit","Quality Checked","Delivered","Rejected"];
const STATUS_COLORS = ["#e8f5ee","#fef3c7","#eff6ff","#d1fae5","#fee2e2"];
const STATUS_TEXT   = ["#1a6b3a","#92400e","#1e40af","#065f46","#991b1b"];

function SkeletonRow({ cols = 8 }) {
  return (
    <tr>{Array.from({ length: cols }).map((_, i) => (
      <td key={i}><div className="skeleton-line" /></td>
    ))}</tr>
  );
}

function ExpiryBadge({ harvestTimestamp, produceType }) {
  const { daysRemaining, label, color, bgColor } = getFreshnessInfo(harvestTimestamp, produceType);
  if (daysRemaining <= 0) return <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>⚠️ Expired</span>;
  if (daysRemaining <= 2) return <span style={{ background: "#fee2e2", color: "#dc2626", padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, animation: "pulse 1.5s infinite" }}>⚠️ Expires in {daysRemaining}d!</span>;
  if (daysRemaining <= 5) return <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600 }}>⏳ {daysRemaining}d left</span>;
  return <span style={{ background: bgColor, color, padding: "2px 8px", borderRadius: 10, fontSize: 10 }}>{daysRemaining}d left</span>;
}

export default function RetailerPage({ account }) {
  const [tab, setTab]       = useState("confirm");
  const [batchId, setBatchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [batchInfo, setBatchInfo] = useState(null);
  const [batches, setBatches]     = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [activeQrBatch, setActiveQrBatch]   = useState(null);
  const [confetti, setConfetti] = useState(false);
  const [labelBatch, setLabelBatch] = useState(null);
  const printRef = useRef(null);

  async function getSigner() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    return provider.getSigner();
  }

  async function lookupBatch() {
    if (!batchId) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(REGISTRY_ADDRESS, ProduceRegistryABI.abi, provider);
      const batch    = await contract.getBatch(BigInt(batchId));
      setBatchInfo({
        produceType:     batch.produceType,
        quantity:        batch.quantity.toString(),
        farmLocation:    batch.farmLocation,
        certification:   batch.certification,
        status:          Number(batch.status),
        currentHolder:   batch.currentHolder,
        harvestTimestamp: batch.harvestTimestamp.toString(),
      });
    } catch (e) {
      setBatchInfo(null); toastError("Batch not found. Check the ID.");
    }
  }

  async function confirmDelivery() {
    if (!batchId) { toastError("Enter Batch ID"); return; }
    const tid = toastLoading("Waiting for MetaMask confirmation...");
    try {
      setLoading(true);
      const signer   = await getSigner();
      const contract = new ethers.Contract(REGISTRY_ADDRESS, ProduceRegistryABI.abi, signer);
      const tx = await contract.confirmDelivery(BigInt(batchId));
      toastDismiss(tid);
      toastLoading("Transaction submitted — waiting for block confirmation...");
      await tx.wait();
      toastDismiss(tid);
      toastSuccess(`✅ Batch #${batchId} marked as Delivered! QR code is ready.`);
      setBatchInfo(b => b ? { ...b, status: 3 } : b);
      setConfetti(true);
      setTimeout(() => setConfetti(false), 3600);
    } catch (e) {
      toastDismiss(tid); toastError(e.reason || e.message || "Transaction failed.");
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
        batchId:         b.batchId.toString(),
        produceType:     b.produceType,
        quantity:        b.quantity.toString(),
        farmLocation:    b.farmLocation,
        certification:   b.certification,
        status:          Number(b.status),
        harvestTimestamp: b.harvestTimestamp.toString(),
      })));
    } catch (e) { toastError("Failed to load batches."); console.error(e); }
    finally { setLoadingBatches(false); }
  }, [account]);

  function handleTabChange(t) { setTab(t); if (t === "batches") loadMyBatches(); }

  const qrUrlForId = (id) => `${window.location.origin}?batch=${id}`;

  function downloadQR(batchId) {
    const svg = document.getElementById(`qr-${batchId}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas  = document.createElement("canvas");
    canvas.width = 200; canvas.height = 200;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "white"; ctx.fillRect(0, 0, 200, 200);
      ctx.drawImage(img, 0, 0, 200, 200);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `AgriChain_QR_Batch_${batchId}.png`;
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  }

  // Stats
  const totalStock  = batches.reduce((s, b) => s + parseInt(b.quantity || 0), 0);
  const expiring    = batches.filter(b => { const info = getFreshnessInfo(b.harvestTimestamp, b.produceType); return info.daysRemaining <= 2 && info.daysRemaining > 0; }).length;

  // Group by produce type
  const inventoryGroups = batches.reduce((acc, b) => {
    acc[b.produceType] = (acc[b.produceType] || 0) + parseInt(b.quantity || 0);
    return acc;
  }, {});

  return (
    <div>
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .skeleton-line{height:14px;border-radius:6px;background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.4s ease infinite}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
        .fade-up{animation:fadeUp 0.4s ease forwards}
        @media print { .no-print{display:none!important} .print-only{display:block!important} }
        .print-only{display:none}
      `}</style>
      <Confetti active={confetti} />

      {/* Stats */}
      <div className="stats" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <StatsCard icon="🏪" label="Batches at Store" value={batches.length}              color="#c2410c" />
        <StatsCard icon="⚖️" label="Total Stock"      value={`${totalStock.toLocaleString()} kg`} color="#1a6b3a" />
        <StatsCard icon="⚠️" label="Expiring Soon"    value={expiring}                    color={expiring > 0 ? "#dc2626" : "#1a6b3a"} sub={expiring > 0 ? "Act now!" : "All fresh"} />
        <StatsCard icon="🌾" label="Produce Types"    value={Object.keys(inventoryGroups).length} color="#7c3aed" />
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        {[["confirm","✅ Confirm Delivery"],["batches","📦 My Batches"],["inventory","📊 Inventory"]].map(([key,label]) => (
          <button key={key} className={tab === key ? "btn" : "btn-outline"} onClick={() => handleTabChange(key)}>{label}</button>
        ))}
      </div>

      {/* ── CONFIRM TAB ── */}
      {tab === "confirm" && (
        <div className="card fade-up">
          <div className="card-header"><h2>🏪 Confirm Batch Delivery</h2></div>
          <div className="card-body">
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Batch ID received from Distributor</label>
                <input value={batchId} onChange={e => setBatchId(e.target.value)}
                  placeholder="Enter batch ID..." onKeyDown={e => e.key === "Enter" && lookupBatch()} />
              </div>
              <div style={{ alignSelf: "flex-end" }}><button className="btn-outline" onClick={lookupBatch}>Lookup</button></div>
            </div>

            {batchInfo && (
              <div style={{ background: "#f8f7f2", border: "1px solid #e5e1d8", borderRadius: 8, padding: "14px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[["Produce",batchInfo.produceType],["Quantity",batchInfo.quantity+" kg"],["Origin",batchInfo.farmLocation],["Certification",batchInfo.certification]].map(([k,v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>{k}</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="badge" style={{ background: STATUS_COLORS[batchInfo.status], color: STATUS_TEXT[batchInfo.status] }}>{STATUS_LABELS[batchInfo.status]}</span>
                    <FreshnessMeter harvestTimestamp={batchInfo.harvestTimestamp} produceType={batchInfo.produceType} />
                  </div>
                  {batchInfo.currentHolder.toLowerCase() !== account.toLowerCase() && (
                    <div style={{ marginTop: 10, fontSize: 12, color: "#b45309", background: "#fef3c7", padding: "8px 10px", borderRadius: 6 }}>
                      ⚠️ You are not the current holder of this batch.
                    </div>
                  )}
                </div>
                {batchInfo.status === 3 && (
                  <div style={{ textAlign: "center", minWidth: 120 }}>
                    <QRCodeSVG id={`qr-confirm-${batchId}`} value={qrUrlForId(batchId)} size={100} bgColor="white" fgColor="#1a6b3a"
                      style={{ border: "2px solid #e8f5ee", borderRadius: 6, padding: 4 }} />
                    <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>Customer QR Code</div>
                    <button className="btn-outline" style={{ marginTop: 6, fontSize: 11, padding: "4px 10px" }} onClick={() => setActiveQrBatch(batchId)}>View Full QR</button>
                  </div>
                )}
              </div>
            )}
            <button className="btn" onClick={confirmDelivery} disabled={loading}>
              {loading && <span className="spinner" />}{loading ? "Confirming..." : "Confirm Delivery ⬡"}
            </button>
          </div>
        </div>
      )}

      {/* ── BATCHES TAB ── */}
      {tab === "batches" && (
        <div className="card fade-up">
          <div className="card-header">
            <h2>📦 Batches At My Store</h2>
            <button className="btn-outline" onClick={loadMyBatches} disabled={loadingBatches}>{loadingBatches ? "Loading..." : "🔄 Refresh"}</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {loadingBatches ? (
              <table><thead><tr><th>ID</th><th>Produce</th><th>Qty</th><th>Origin</th><th>Cert</th><th>Freshness</th><th>Expiry</th><th>Status</th><th>QR</th></tr></thead>
                <tbody>{[1,2,3].map(i => <SkeletonRow key={i} cols={9} />)}</tbody></table>
            ) : batches.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}><div style={{ fontSize: 32 }}>📭</div>No batches currently in your custody.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead><tr>
                    <th>Batch ID</th><th>Produce</th><th>Qty (kg)</th><th>Origin</th>
                    <th>Cert</th><th>Freshness</th><th>Expiry</th><th>Status</th><th style={{ textAlign: "center" }}>QR Actions</th>
                  </tr></thead>
                  <tbody>
                    {batches.map(b => (
                      <tr key={b.batchId} style={{ background: (() => { const i = getFreshnessInfo(b.harvestTimestamp, b.produceType); return i.daysRemaining <= 2 ? "#fff5f5" : ""; })() }}>
                        <td><strong>#{b.batchId}</strong><CopyButton text={b.batchId} /></td>
                        <td>{b.produceType}</td>
                        <td>{parseInt(b.quantity).toLocaleString()}</td>
                        <td>{b.farmLocation}</td>
                        <td>
                          {b.certification !== "None" ? <span className="badge badge-green">{b.certification}</span>
                            : <span style={{ color: "#9ca3af", fontSize: 11 }}>None</span>}
                        </td>
                        <td><BatchAgeTag harvestTimestamp={b.harvestTimestamp} produceType={b.produceType} /></td>
                        <td><ExpiryBadge harvestTimestamp={b.harvestTimestamp} produceType={b.produceType} /></td>
                        <td><span className="badge" style={{ background: STATUS_COLORS[b.status], color: STATUS_TEXT[b.status] }}>{STATUS_LABELS[b.status]}</span></td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button className="btn-outline" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setActiveQrBatch(b.batchId)}>📱 QR</button>
                            <button className="btn-outline" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => downloadQR(b.batchId)}>⬇️</button>
                            <button className="btn-outline" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => setLabelBatch(b)}>🏷️</button>
                          </div>
                          {/* Hidden QR for download */}
                          <div style={{ display: "none" }}>
                            <QRCodeSVG id={`qr-${b.batchId}`} value={qrUrlForId(b.batchId)} size={200} />
                          </div>
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

      {/* ── INVENTORY TAB ── */}
      {tab === "inventory" && (
        <div className="card fade-up">
          <div className="card-header"><h2>📊 Inventory by Produce Type</h2></div>
          <div className="card-body">
            {Object.keys(inventoryGroups).length === 0 ? (
              <div style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>Load your batches first from the My Batches tab.</div>
            ) : (
              <>
                {Object.entries(inventoryGroups).map(([produce, qty]) => {
                  const pct = Math.round((qty / totalStock) * 100);
                  return (
                    <div key={produce} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{produce}</span>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>{qty.toLocaleString()} kg · {pct}%</span>
                      </div>
                      <div style={{ height: 10, background: "#f0ede6", borderRadius: 5, overflow: "hidden" }}>
                        <div style={{ height: "100%", background: "#1a6b3a", width: `${pct}%`, borderRadius: 5, transition: "width 1s ease" }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 20, padding: "12px 16px", background: "#f8f7f2", borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600 }}>Total Stock</span>
                  <span style={{ fontWeight: 700, color: "#1a6b3a" }}>{totalStock.toLocaleString()} kg</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── QR Modal ── */}
      {activeQrBatch && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, fontFamily: "inherit" }}
          onClick={() => setActiveQrBatch(null)}>
          <div style={{ background: "white", padding: 28, borderRadius: 16, textAlign: "center", maxWidth: 380, width: "90%", border: "1px solid #e5e1d8" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, marginBottom: 4 }}>Batch #{activeQrBatch} — Customer QR Code</h3>
            <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 20 }}>Display at retail counter for customers to scan and verify produce origin.</p>
            <div style={{ display: "inline-block", background: "white", padding: 12, border: "1px solid #e5e1d8", borderRadius: 8 }}>
              <QRCodeSVG id={`qr-modal-${activeQrBatch}`} value={qrUrlForId(activeQrBatch)} size={180} bgColor="white" fgColor="#1a6b3a" />
            </div>
            <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <a href={qrUrlForId(activeQrBatch)} target="_blank" rel="noreferrer" className="btn" style={{ textDecoration: "none", display: "block", fontSize: 12 }}>🔗 Open</a>
              <button className="btn-outline" style={{ fontSize: 12 }} onClick={() => downloadQR(activeQrBatch)}>⬇️ PNG</button>
              <button className="btn-outline" style={{ fontSize: 12 }} onClick={() => setActiveQrBatch(null)}>✕ Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Label Modal ── */}
      {labelBatch && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setLabelBatch(null)}>
          <div style={{ background: "white", padding: 28, borderRadius: 16, maxWidth: 360, width: "90%", textAlign: "center", border: "1px solid #e5e1d8" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16, fontSize: 15 }}>🏷️ Customer Produce Label</h3>
            <div style={{ border: "2px dashed #1a6b3a", borderRadius: 10, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6b3a", marginBottom: 4 }}>{labelBatch.produceType}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Origin: {labelBatch.farmLocation}</div>
              {labelBatch.certification !== "None" && (
                <div style={{ fontSize: 11, background: "#e8f5ee", color: "#1a6b3a", padding: "2px 10px", borderRadius: 20, display: "inline-block", marginBottom: 10 }}>
                  ✅ {labelBatch.certification} Certified
                </div>
              )}
              <FreshnessMeter harvestTimestamp={labelBatch.harvestTimestamp} produceType={labelBatch.produceType} />
              <div style={{ marginTop: 14 }}>
                <QRCodeSVG value={qrUrlForId(labelBatch.batchId)} size={100} bgColor="white" fgColor="#1a6b3a" />
              </div>
              <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 6 }}>Scan QR to verify on blockchain · Batch #{labelBatch.batchId}</div>
              <div style={{ fontSize: 9, color: "#1a6b3a", marginTop: 2, fontWeight: 600 }}>✓ Verified on AgriChain Blockchain</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" style={{ flex: 1, fontSize: 12 }} onClick={() => window.print()}>🖨️ Print Label</button>
              <button className="btn-outline" style={{ flex: 1, fontSize: 12 }} onClick={() => setLabelBatch(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}