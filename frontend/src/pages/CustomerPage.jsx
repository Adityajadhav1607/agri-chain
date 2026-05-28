import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import TrackTransferABI   from "../utils/TrackTransfer.json";
import ProduceRegistryABI from "../utils/ProduceRegistry.json";
import QualityVerifierABI from "../utils/QualityVerifier.json";
import FarmPassportABI    from "../utils/FarmPassport.json";
import { TRACKER_ADDRESS, REGISTRY_ADDRESS, VERIFIER_ADDRESS, FARM_PASSPORT_ADDRESS } from "../utils/addresses";
import { toastError } from "../utils/toast";
import TrustScore, { computeTrustScore } from "../components/TrustScore";
import FreshnessMeter from "../components/FreshnessMeter";
import SpoilagePredictor from "../components/SpoilagePredictor";
import SatelliteView    from "../components/SatelliteView";
import { downloadJourneyPDF } from "../utils/pdf";

const STATUS_LABELS    = ["Registered","In Transit","Quality Checked","Delivered","Rejected"];
const STATUS_COLORS    = ["#e8f5ee","#fef3c7","#eff6ff","#d1fae5","#fee2e2"];
const STATUS_TEXT      = ["#1a6b3a","#92400e","#1e40af","#065f46","#991b1b"];
const TRANSPORT_LABELS = ["🚛 Road","🚂 Rail","✈️ Air","🚢 Sea"];
const GRADE_LABELS     = ["A","B","C","Rejected"];

// Carbon footprint per km in kg CO₂ equivalent (per ton-km)
const CO2_FACTOR = { "🚛 Road": 0.096, "🚂 Rail": 0.022, "✈️ Air": 0.602, "🚢 Sea": 0.011 };
const DIST_ESTIMATE = 350; // km average per hop

function AnimatedTimelineItem({ item, index, total }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), index * 200);
    return () => clearTimeout(timer);
  }, [index]);

  const isLast = index === total - 1;

  return (
    <div
      ref={ref}
      className="tl-item"
      style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)", transition: "all 0.5s ease" }}
    >
      <div className={`tl-dot ${isLast ? "active" : "done"}`}>
        {item.icon || (index === 0 ? "🌾" : index === 1 ? "🚛" : index === 2 ? "🏪" : "📦")}
      </div>
      <div style={{ flex: 1 }}>
        <div className="tl-title">{item.title}</div>
        <div className="tl-meta">{item.meta}</div>
        {item.tx && <div className="tl-tx">{item.tx}</div>}
        {item.extra && (
          <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {item.extra.map((tag, i) => (
              <span key={i} style={{ background: "#f0ede6", color: "#374151", padding: "2px 8px", borderRadius: 4, fontSize: 10 }}>{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerPage({ account, initialBatchId }) {
  const [batchId,   setBatchId]   = useState(initialBatchId || "");
  const [compareBatchId, setCompareBatchId] = useState("");
  const [loading,   setLoading]   = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [batchInfo, setBatchInfo] = useState(null);
  const [compareInfo, setCompareInfo] = useState(null);
  const [history,   setHistory]   = useState([]);
  const [cert,      setCert]      = useState(null);
  const [trustScore, setTrustScore] = useState(null);
  const [carbonKg,  setCarbonKg]  = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [shareMsg,  setShareMsg]  = useState("");
  const [rawHarvestTs, setRawHarvestTs] = useState(null);
  const [passport,  setPassport]  = useState(null);

  useEffect(() => {
    // Priority: initialBatchId prop > URL ?batch= param
    const fromProp = initialBatchId;
    const params   = new URLSearchParams(window.location.search);
    const fromUrl  = params.get("batch");
    const id = fromProp || fromUrl;
    if (id) {
      const cleanId = id.toString().trim().replace(/^AC-?/i, "");
      setBatchId(cleanId);
      traceBatchById(cleanId);
    }
  }, []); // eslint-disable-line

  async function getContracts() {
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
      setLoading(true);
    setBatchInfo(null); setHistory([]); setCert(null); setTrustScore(null); setCarbonKg(null); setPassport(null);
      const { registry, tracker, verifier } = await getContracts();

      const batch     = await registry.getBatch(BigInt(id));
      const transfers = await tracker.getBatchHistory(BigInt(id));

      const harvestTs = batch.harvestTimestamp.toString();
      setRawHarvestTs(harvestTs);

      const batchData = {
        produceType:   batch.produceType,
        quantity:      batch.quantity.toString(),
        farmLocation:  batch.farmLocation,
        certification: batch.certification,
        farmer:        batch.farmer,
        harvestDate:   new Date(Number(batch.harvestTimestamp) * 1000).toLocaleDateString(),
        harvestTimestamp: harvestTs,
        status:        Number(batch.status),
        // Lookup farmer name from localStorage registration
        farmerName: (() => {
          try {
            const reqs = JSON.parse(localStorage.getItem("agrichain_requests") || "[]");
            const r = reqs.find(x => x.address && x.address.toLowerCase() === batch.farmer.toLowerCase() && x.role === "farmer");
            return r?.name || null;
          } catch { return null; }
        })(),
      };
      setBatchInfo(batchData);

      const historyData = transfers.map(t => ({
        from:      t.from,
        to:        t.to,
        location:  t.location,
        temp:      t.temperature.toString(),
        transport: TRANSPORT_LABELS[Number(t.transport)] || "🚛 Road",
        timestamp: new Date(Number(t.timestamp) * 1000).toLocaleString(),
        notes:     t.notes,
      }));
      setHistory(historyData);

      // Carbon footprint
      const co2 = historyData.reduce((sum, h) => sum + (CO2_FACTOR[h.transport] || 0.096) * DIST_ESTIMATE, 0);
      setCarbonKg(Math.round(co2 * 10) / 10);

      let certData = null;
      try {
        const c = await verifier.getBatchCertificate(BigInt(id));
        certData = {
          grade:     GRADE_LABELS[Number(c.grade)],
          passed:    c.passed,
          issuedAt:  new Date(Number(c.issuedAt) * 1000).toLocaleDateString(),
          inspector: c.inspector,
          remarks:   c.remarks,
          ipfsHash:  c.ipfsHash,
        };
        setCert(certData);
      } catch {}

      // Trust score
      const score = computeTrustScore({
        cert:           certData,
        transferCount:  historyData.length,
        harvestTimestamp: harvestTs,
        certification:  batchData.certification,
      });
      setTrustScore(score);

      // Load Farm Passport NFT if contract is deployed
      if (FARM_PASSPORT_ADDRESS) {
        try {
          const passport = new ethers.Contract(FARM_PASSPORT_ADDRESS, FarmPassportABI.abi, await getContracts().then(c => c.registry.runner));
          const hasP = await new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com")
            .then(p => new ethers.Contract(FARM_PASSPORT_ADDRESS, FarmPassportABI.abi, p).hasPassport(BigInt(id)));
          if (hasP) {
            const provider2 = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
            const passportContract = new ethers.Contract(FARM_PASSPORT_ADDRESS, FarmPassportABI.abi, provider2);
            const p = await passportContract.getPassport(BigInt(id));
            setPassport({
              tokenId:        p.tokenId.toString(),
              farmer:         p.farmer,
              batchId:        p.batchId.toString(),
              gpsCoordinates: p.gpsCoordinates,
              tokenUri:       p.tokenUri,
              mintedAt:       new Date(Number(p.mintedAt) * 1000).toLocaleDateString(),
            });
          }
        } catch { /* no passport */ }
      }

    } catch (e) {
      toastError("Batch not found. Check the ID — it must exist on the Sepolia testnet.");
    } finally { setLoading(false); }
  }

  async function traceCompare() {
    if (!compareBatchId) return;
    try {
      setCompareLoading(true); setCompareInfo(null);
      const { registry, verifier } = await getContracts();
      const batch = await registry.getBatch(BigInt(compareBatchId));
      let cGrade = null;
      try {
        const c = await verifier.getBatchCertificate(BigInt(compareBatchId));
        cGrade = GRADE_LABELS[Number(c.grade)];
      } catch {}
      setCompareInfo({
        batchId:       compareBatchId,
        produceType:   batch.produceType,
        quantity:      batch.quantity.toString(),
        farmLocation:  batch.farmLocation,
        certification: batch.certification,
        harvestDate:   new Date(Number(batch.harvestTimestamp) * 1000).toLocaleDateString(),
        harvestTimestamp: batch.harvestTimestamp.toString(),
        status:        Number(batch.status),
        grade:         cGrade,
      });
    } catch { toastError("Comparison batch not found."); }
    finally { setCompareLoading(false); }
  }

  function shareBatch() {
    const url = `${window.location.origin}?batch=${batchId}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareMsg("🔗 Link copied to clipboard!");
      setTimeout(() => setShareMsg(""), 2500);
    });
  }

  async function traceBatch() {
    const cleanId = batchId.toString().trim().replace(/^AC-?/i, "");
    setBatchId(cleanId);
    await traceBatchById(cleanId);
  }

  const qrUrl = `${window.location.origin}?batch=${batchId}`;

  // Build timeline steps
  const timelineSteps = batchInfo ? [
    {
      icon: "🌾",
      title: `Harvested — ${batchInfo.farmLocation}`,
      meta: `${batchInfo.harvestDate} · Batch registered on-chain`,
      tx: `Farmer: ${batchInfo.farmer.slice(0,16)}...`,
      extra: [batchInfo.certification !== "None" ? `✅ ${batchInfo.certification}` : null, `${batchInfo.quantity} kg`].filter(Boolean),
    },
    ...history.map((item, i) => ({
      icon: i === 0 ? "🚛" : i === 1 ? "🏪" : "📦",
      title: `${item.notes} — ${item.location}`,
      meta: `${item.timestamp} · Temp: ${item.temp}°C · ${item.transport}`,
      tx: `From: ${item.from.slice(0,12)}... → To: ${item.to.slice(0,12)}...`,
    })),
  ] : [];

  return (
    <div>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp 0.4s ease forwards}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* Search */}
      <div className="card">
        <div className="card-header"><h2>👤 Trace Your Produce</h2></div>
        <div className="card-body">
          <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <input
              style={{ flex: 1, padding: "9px 12px", border: "1px solid #e5e1d8", borderRadius: 7, fontSize: 13, background: "var(--input-bg, #fafaf8)", outline: "none", color: "var(--text, inherit)" }}
              placeholder="Enter Batch ID (e.g. 1000)..."
              value={batchId} onChange={e => setBatchId(e.target.value)}
              onKeyDown={e => e.key === "Enter" && traceBatch()}
            />
            <button className="btn" onClick={traceBatch} disabled={loading}>
              {loading ? <><span className="spinner" />Tracing...</> : "Trace ↗"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>Scan a QR code or enter a batch ID to view full supply chain journey.</span>
            {batchInfo && (
              <>
                <button onClick={() => setCompareMode(m => !m)}
                  style={{ background: "none", border: "1px solid #e5e1d8", borderRadius: 20, padding: "2px 10px", fontSize: 11, cursor: "pointer", color: "#6b7280" }}>
                  ⚖️ Compare
                </button>
                <button onClick={shareBatch}
                  style={{ background: "none", border: "1px solid #e5e1d8", borderRadius: 20, padding: "2px 10px", fontSize: 11, cursor: "pointer", color: "#6b7280" }}>
                  🔗 Share
                </button>
              </>
            )}
          </div>
          {shareMsg && <div style={{ marginTop: 8, fontSize: 12, color: "#1a6b3a", fontWeight: 500 }}>{shareMsg}</div>}
        </div>
      </div>

      {/* Compare Panel */}
      {compareMode && (
        <div className="card fade-up">
          <div className="card-header"><h2>⚖️ Compare Batches</h2></div>
          <div className="card-body">
            <div style={{ display: "flex", gap: 10 }}>
              <input style={{ flex: 1, padding: "9px 12px", border: "1px solid #e5e1d8", borderRadius: 7, fontSize: 13, background: "#fafaf8" }}
                placeholder="Second batch ID..." value={compareBatchId} onChange={e => setCompareBatchId(e.target.value)}
                onKeyDown={e => e.key === "Enter" && traceCompare()} />
              <button className="btn-outline" onClick={traceCompare} disabled={compareLoading}>{compareLoading ? "Loading..." : "Compare"}</button>
            </div>
            {compareInfo && batchInfo && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 16 }}>
                {[
                  { label: `Batch #${batchId}`, data: batchInfo, grade: cert?.grade },
                  { label: `Batch #${compareBatchId}`, data: compareInfo, grade: compareInfo.grade },
                ].map(({ label, data, grade }) => (
                  <div key={label} style={{ background: "#f8f7f2", borderRadius: 10, padding: "14px 16px", border: "1px solid #e5e1d8" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#1a6b3a" }}>{label}</div>
                    {[["Produce",data.produceType],["Quantity",data.quantity+" kg"],["Origin",data.farmLocation],["Certification",data.certification],["Harvest",data.harvestDate],["Grade",grade||"—"]].map(([k,v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                        <span style={{ color: "#6b7280" }}>{k}</span>
                        <span style={{ fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 10 }}>
                      <FreshnessMeter harvestTimestamp={data.harvestTimestamp} produceType={data.produceType} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {batchInfo && (
        <>
          {/* Trust Score + Batch Overview */}
          <div className="card fade-up">
            <div className="card-header">
              <h2>Batch #{batchId} — {batchInfo.produceType}</h2>
              <span className="badge" style={{ background: STATUS_COLORS[batchInfo.status], color: STATUS_TEXT[batchInfo.status] }}>
                {STATUS_LABELS[batchInfo.status]}
              </span>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
                {/* Trust Score */}
                <div style={{ textAlign: "center", minWidth: 130 }}>
                  {trustScore !== null && <TrustScore score={trustScore} />}
                </div>

                {/* Info grid */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                      ["Produce",       batchInfo.produceType],
                      ["Quantity",      batchInfo.quantity + " kg"],
                      ["Farm Location", batchInfo.farmLocation],
                      ["Certification", batchInfo.certification],
                      ["Harvest Date",  batchInfo.harvestDate],
                      ["Farmer Name",   batchInfo.farmerName || "—"],
                    ].map(([k,v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>{k}</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div>
                      </div>
                    ))}
                    {/* Farmer wallet on its own full-width row */}
                    <div style={{ gridColumn: "span 2" }}>
                      <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>Farmer Wallet (Blockchain)</div>
                      <div style={{ fontWeight: 600, fontSize: 11, fontFamily: "monospace", wordBreak: "break-all",
                        background: "#f0fdf4", padding: "6px 8px", borderRadius: 6, border: "1px solid #bbf7d0" }}>
                        {batchInfo.farmer}
                      </div>
                    </div>
                  </div>

                  {/* Freshness */}
                  <div style={{ marginTop: 16 }}>
                    <FreshnessMeter harvestTimestamp={batchInfo.harvestTimestamp} produceType={batchInfo.produceType} />
                  </div>

                  {/* Carbon footprint */}
                  {carbonKg !== null && (
                    <div style={{ marginTop: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                      🌿 Estimated Carbon Footprint: <strong>{carbonKg} kg CO₂e</strong>
                      <span style={{ color: "#6b7280", marginLeft: 6 }}>({history.length} transit legs)</span>
                    </div>
                  )}
                </div>

                {/* QR */}
                <div style={{ textAlign: "center" }}>
                  <QRCodeSVG value={qrUrl} size={120} bgColor="white" fgColor="#1a6b3a"
                    style={{ border: "4px solid #e8f5ee", borderRadius: 8, padding: 6 }} />
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>Scan to verify</div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn-outline" style={{ fontSize: 12 }} onClick={shareBatch}>🔗 Share</button>
                <button className="btn-outline" style={{ fontSize: 12 }}
                  onClick={() => downloadJourneyPDF({
                    batchId, produceType: batchInfo.produceType, farmLocation: batchInfo.farmLocation,
                    harvestDate: batchInfo.harvestDate, quantity: batchInfo.quantity,
                    certification: batchInfo.certification, status: STATUS_LABELS[batchInfo.status],
                    history, cert,
                  })}>
                  ⬇️ PDF Report
                </button>
              </div>
            </div>
          </div>

          {/* Quality Certificate */}
          {cert && (
            <div className="card fade-up">
              <div className="card-header">
                <h2>🏅 Quality Certificate</h2>
                <span className="badge" style={{ background: cert.passed ? "#d1fae5" : "#fee2e2", color: cert.passed ? "#065f46" : "#991b1b" }}>
                  Grade {cert.grade} — {cert.passed ? "PASSED" : "REJECTED"}
                </span>
              </div>
              <div className="card-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  <div><div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>Grade</div><div style={{ fontWeight: 600, fontSize: 22, color: cert.passed ? "#065f46" : "#991b1b" }}>{cert.grade}</div></div>
                  <div><div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>Issued</div><div style={{ fontWeight: 600 }}>{cert.issuedAt}</div></div>
                  <div><div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>Inspector</div><div style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}>{cert.inspector.slice(0,12)}...</div></div>
                  {cert.remarks && <div style={{ gridColumn: "span 3" }}><div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>Remarks</div><div style={{ fontWeight: 500 }}>{cert.remarks}</div></div>}
                  {cert.ipfsHash && <div style={{ gridColumn: "span 3" }}><div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>IPFS Document</div><div style={{ fontFamily: "monospace", fontSize: 11, color: "#1a6b3a" }}>{cert.ipfsHash}</div></div>}
                </div>
              </div>
            </div>
          )}

          {/* AI Spoilage Prediction */}
          <SpoilagePredictor batchInfo={batchInfo} history={history} cert={cert} />

          {/* Journey Timeline */}
          <div className="card fade-up">
            <div className="card-header"><h2>📍 Full Journey on Blockchain</h2></div>
            <div className="card-body">
              <div className="timeline">
                {timelineSteps.map((step, i) => (
                  <AnimatedTimelineItem key={i} item={step} index={i} total={timelineSteps.length} />
                ))}
                {history.length === 0 && (
                  <div className="tl-item">
                    <div className="tl-dot pending">🚛</div>
                    <div><div className="tl-title">Awaiting first transfer</div><div className="tl-meta">No transfers recorded yet</div></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Farm Passport / Satellite View */}
          <SatelliteView
            gpsCoordinates={passport?.gpsCoordinates || batchInfo?.gpsCoordinates || ""}
            farmLocation={batchInfo?.farmLocation}
            batchId={batchId}
            passport={passport}
          />
        </>
      )}
    </div>
  );
}