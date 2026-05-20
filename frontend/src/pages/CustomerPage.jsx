import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import TrackTransferABI   from "../utils/TrackTransfer.json";
import ProduceRegistryABI from "../utils/ProduceRegistry.json";
import QualityVerifierABI from "../utils/QualityVerifier.json";
import { TRACKER_ADDRESS, REGISTRY_ADDRESS, VERIFIER_ADDRESS } from "../utils/addresses";
import { toastError } from "../utils/toast";

const STATUS_LABELS = ["Registered","In Transit","Quality Checked","Delivered","Rejected"];
const STATUS_COLORS = ["#e8f5ee","#fef3c7","#eff6ff","#d1fae5","#fee2e2"];
const STATUS_TEXT   = ["#1a6b3a","#92400e","#1e40af","#065f46","#991b1b"];
const TRANSPORT_LABELS = ["🚛 Road","🚂 Rail","✈️ Air","🚢 Sea"];
const GRADE_LABELS = ["A","B","C","Rejected"];

export default function CustomerPage() {
  const [batchId,   setBatchId]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [batchInfo, setBatchInfo] = useState(null);
  const [history,   setHistory]   = useState([]);
  const [cert,      setCert]      = useState(null);

  // Auto-trace if URL has ?batch= param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("batch");
    if (id) { setBatchId(id); traceBatchById(id); }
  }, []); // eslint-disable-line

  async function getContracts() {
    // Use a public Sepolia RPC — no MetaMask required for read-only tracing
    const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
    return {
      registry: new ethers.Contract(REGISTRY_ADDRESS, ProduceRegistryABI.abi, provider),
      tracker:  new ethers.Contract(TRACKER_ADDRESS,  TrackTransferABI.abi,   provider),
      verifier: new ethers.Contract(VERIFIER_ADDRESS, QualityVerifierABI.abi, provider),
    };
  }

  async function traceBatchById(id) {
    if (!id) return;
    try {
      setLoading(true); setError(null); setBatchInfo(null); setHistory([]); setCert(null);
      const { registry, tracker, verifier } = await getContracts();

      const batch     = await registry.getBatch(BigInt(id));
      const transfers = await tracker.getBatchHistory(BigInt(id));

      setBatchInfo({
        produceType:   batch.produceType,
        quantity:      batch.quantity.toString(),
        farmLocation:  batch.farmLocation,
        certification: batch.certification,
        farmer:        batch.farmer,
        harvestDate:   new Date(Number(batch.harvestTimestamp) * 1000).toLocaleDateString(),
        status:        Number(batch.status),
      });

      setHistory(transfers.map(t => ({
        from:      t.from,
        to:        t.to,
        location:  t.location,
        temp:      t.temperature.toString(),
        transport: TRANSPORT_LABELS[Number(t.transport)] || "🚛 Road",
        timestamp: new Date(Number(t.timestamp) * 1000).toLocaleString(),
        notes:     t.notes,
      })));

      // Try to load quality certificate
      try {
        const c = await verifier.getBatchCertificate(BigInt(id));
        setCert({
          grade:     GRADE_LABELS[Number(c.grade)],
          passed:    c.passed,
          issuedAt:  new Date(Number(c.issuedAt) * 1000).toLocaleDateString(),
          inspector: c.inspector,
          remarks:   c.remarks,
          ipfsHash:  c.ipfsHash,
        });
      } catch { /* no cert yet */ }

    } catch (e) {
      toastError("Batch not found. Please check the ID — it must exist on the Sepolia testnet.");
    } finally { setLoading(false); }
  }

  async function traceBatch() { await traceBatchById(batchId); }

  const qrUrl = `${window.location.origin}?batch=${batchId}`;

  return (
    <div>
      {/* Search */}
      <div className="card">
        <div className="card-header"><h2>👤 Trace Your Produce</h2></div>
        <div className="card-body">
          <div style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
            <input style={{ flex: 1, padding: "9px 12px", border: "1px solid #e5e1d8", borderRadius: "7px", fontSize: "13px", background: "#fafaf8", outline: "none" }}
              placeholder="Enter Batch ID (e.g. 1000)..."
              value={batchId} onChange={e => setBatchId(e.target.value)}
              onKeyDown={e => e.key === "Enter" && traceBatch()} />
            <button className="btn" onClick={traceBatch} disabled={loading}>
              {loading ? "Tracing..." : "Trace ↗"}
            </button>
          </div>
          <div style={{ fontSize: "11px", color: "#9ca3af" }}>You can also scan a QR code to auto-load a batch.</div>
        </div>
      </div>

      {batchInfo && (
        <>
          {/* Batch Info */}
          <div className="card">
            <div className="card-header">
              <h2>Batch #{batchId} — {batchInfo.produceType}</h2>
              <span className="badge" style={{ background: STATUS_COLORS[batchInfo.status], color: STATUS_TEXT[batchInfo.status] }}>{STATUS_LABELS[batchInfo.status]}</span>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                    {[
                      ["Produce",       batchInfo.produceType],
                      ["Quantity",      batchInfo.quantity + " kg"],
                      ["Farm Location", batchInfo.farmLocation],
                      ["Certification", batchInfo.certification],
                      ["Harvest Date",  batchInfo.harvestDate],
                      ["Farmer Wallet", batchInfo.farmer.slice(0,14) + "..."],
                    ].map(([k,v]) => (
                      <div key={k}>
                        <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase", marginBottom: "2px" }}>{k}</div>
                        <div style={{ fontWeight: 600, fontSize: "13px" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <QRCodeSVG value={qrUrl} size={120} bgColor="white" fgColor="#1a6b3a" style={{ border: "4px solid #e8f5ee", borderRadius: "8px", padding: "6px" }} />
                  <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "6px" }}>Scan to verify</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quality Certificate */}
          {cert && (
            <div className="card">
              <div className="card-header">
                <h2>🏅 Quality Certificate</h2>
                <span className="badge" style={{ background: cert.passed ? "#d1fae5" : "#fee2e2", color: cert.passed ? "#065f46" : "#991b1b" }}>
                  Grade {cert.grade} — {cert.passed ? "PASSED" : "REJECTED"}
                </span>
              </div>
              <div className="card-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                  <div><div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>Grade</div><div style={{ fontWeight: 600 }}>{cert.grade}</div></div>
                  <div><div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>Issued</div><div style={{ fontWeight: 600 }}>{cert.issuedAt}</div></div>
                  <div><div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>Inspector</div><div style={{ fontWeight: 600, fontFamily: "monospace", fontSize: "11px" }}>{cert.inspector.slice(0,12)}...</div></div>
                  {cert.remarks && <div style={{ gridColumn: "span 3" }}><div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>Remarks</div><div style={{ fontWeight: 500 }}>{cert.remarks}</div></div>}
                  {cert.ipfsHash && <div style={{ gridColumn: "span 3" }}><div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>IPFS Document</div><div style={{ fontFamily: "monospace", fontSize: "11px", color: "#1a6b3a" }}>{cert.ipfsHash}</div></div>}
                </div>
              </div>
            </div>
          )}

          {/* Journey Timeline */}
          <div className="card">
            <div className="card-header"><h2>📍 Full Journey on Blockchain</h2></div>
            <div className="card-body">
              <div className="timeline">
                <div className="tl-item">
                  <div className="tl-dot done">🌾</div>
                  <div>
                    <div className="tl-title">Harvested — {batchInfo.farmLocation}</div>
                    <div className="tl-meta">{batchInfo.harvestDate} · Batch registered on-chain</div>
                    <div className="tl-tx">Farmer: {batchInfo.farmer.slice(0,16)}...</div>
                  </div>
                </div>
                {history.map((item, i) => (
                  <div className="tl-item" key={i}>
                    <div className={`tl-dot ${i === history.length - 1 ? "active" : "done"}`}>
                      {i === 0 ? "🚛" : i === 1 ? "🏪" : "📦"}
                    </div>
                    <div>
                      <div className="tl-title">{item.notes} — {item.location}</div>
                      <div className="tl-meta">{item.timestamp} · Temp: {item.temp}°C · {item.transport}</div>
                      <div className="tl-tx">From: {item.from.slice(0,12)}... → To: {item.to.slice(0,12)}...</div>
                    </div>
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="tl-item">
                    <div className="tl-dot pending">🚛</div>
                    <div>
                      <div className="tl-title">Awaiting first transfer</div>
                      <div className="tl-meta">No transfers recorded yet</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}