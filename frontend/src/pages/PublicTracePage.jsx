import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import TrackTransferABI   from "../utils/TrackTransfer.json";
import ProduceRegistryABI from "../utils/ProduceRegistry.json";
import QualityVerifierABI from "../utils/QualityVerifier.json";
import { TRACKER_ADDRESS, REGISTRY_ADDRESS, VERIFIER_ADDRESS } from "../utils/addresses";

const STATUS_LABELS = ["Registered","In Transit","Quality Checked","Delivered","Rejected"];
const STATUS_COLORS = ["#e8f5ee","#fef3c7","#eff6ff","#d1fae5","#fee2e2"];
const STATUS_TEXT   = ["#1a6b3a","#92400e","#1e40af","#065f46","#991b1b"];
const TRANSPORT_LABELS = ["🚛 Road","🚂 Rail","✈️ Air","🚢 Sea"];
const GRADE_LABELS = ["A","B","C","Rejected"];
const GRADE_COLORS = { A:"#065f46", B:"#1e40af", C:"#92400e", Rejected:"#991b1b" };
const GRADE_BG     = { A:"#d1fae5", B:"#dbeafe", C:"#fef3c7", Rejected:"#fee2e2" };

/* ── read-only provider (no MetaMask needed) ─────────────────── */
function getProvider() {
  return new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
}
function getContracts() {
  const p = getProvider();
  return {
    registry: new ethers.Contract(REGISTRY_ADDRESS, ProduceRegistryABI.abi, p),
    tracker:  new ethers.Contract(TRACKER_ADDRESS,  TrackTransferABI.abi,   p),
    verifier: new ethers.Contract(VERIFIER_ADDRESS, QualityVerifierABI.abi, p),
  };
}

/* ── tiny timeline item ──────────────────────────────────────── */
function TimelineItem({ item, index, total, dark }) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), index * 160); return () => clearTimeout(t); }, [index]);
  const isLast = index === total - 1;
  const T = dark
    ? { card:"rgba(255,255,255,0.06)", border:"rgba(255,255,255,0.10)", text:"#e8f5ee", muted:"#6b9b7a" }
    : { card:"#ffffff",               border:"#e4ede6",                 text:"#1a2e1a", muted:"#4b7a5a" };

  return (
    <div style={{ opacity: vis?1:0, transform: vis?"translateY(0)":"translateY(14px)", transition:"all 0.45s ease",
      display:"flex", gap:14, paddingBottom: isLast?0:22, position:"relative" }}>
      {!isLast && <div style={{ position:"absolute", left:18, top:40, bottom:0, width:2,
        background:`linear-gradient(180deg,${item.color}55,transparent)` }}/>}
      <div style={{ width:36, height:36, borderRadius:12, flexShrink:0, zIndex:1,
        background:item.bg, display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:17, border:`2px solid ${item.color}50` }}>{item.emoji}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, fontSize:13, color:item.color, marginBottom:2 }}>{item.title}</div>
        <div style={{ fontSize:13, color:T.text, marginBottom:3 }}>{item.desc}</div>
        <div style={{ fontSize:11, color:T.muted, fontFamily:"monospace" }}>{item.time}</div>
        {item.tx && <div style={{ fontSize:10, color:T.muted, fontFamily:"monospace", marginTop:2 }}>{item.tx}</div>}
      </div>
      <span style={{ fontSize:11, padding:"3px 9px", borderRadius:20, background:item.bg, color:item.color,
        fontWeight:700, flexShrink:0, height:"fit-content" }}>✓ On-Chain</span>
    </div>
  );
}

/* ── main component ──────────────────────────────────────────── */
export default function PublicTracePage({ initialBatchId = "", onSignIn, onBack, dark: parentDark }) {
  const [dark,       setDark]      = useState(parentDark || false);
  const [batchInput, setBatchInput]= useState(initialBatchId);
  const [batchId,    setBatchId]   = useState(initialBatchId);
  const [loading,    setLoading]   = useState(false);
  const [error,      setError]     = useState("");
  const [batchInfo,  setBatchInfo] = useState(null);
  const [history,    setHistory]   = useState([]);
  const [cert,       setCert]      = useState(null);
  const [copyMsg,    setCopyMsg]   = useState("");
  const inputRef = useRef(null);

  /* auto-trace on mount if id provided */
  useEffect(() => {
    if (initialBatchId) traceBatch(initialBatchId);
    else if (inputRef.current) inputRef.current.focus();
  }, []); // eslint-disable-line

  async function traceBatch(id) {
    const rawId = (id || batchInput).toString().trim().replace(/^AC-?/i, "");
    if (!rawId) { setError("Please enter a batch ID."); return; }
    try {
      setLoading(true); setError("");
      setBatchInfo(null); setHistory([]); setCert(null);
      setBatchId(rawId);

      const { registry, tracker, verifier } = getContracts();
      const batch = await registry.getBatch(BigInt(rawId));

      const batchData = {
        id:            rawId,
        produceType:   batch.produceType,
        quantity:      batch.quantity.toString(),
        farmLocation:  batch.farmLocation,
        certification: batch.certification,
        farmer:        batch.farmer,
        harvestDate:   new Date(Number(batch.harvestTimestamp) * 1000).toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" }),
        status:        Number(batch.status),
      };
      setBatchInfo(batchData);

      const transfers = await tracker.getBatchHistory(BigInt(rawId));
      const hist = transfers.map(t => ({
        from:      t.from,
        to:        t.to,
        location:  t.location,
        temp:      t.temperature.toString(),
        transport: TRANSPORT_LABELS[Number(t.transport)] || "🚛 Road",
        timestamp: new Date(Number(t.timestamp) * 1000).toLocaleString("en-IN"),
        notes:     t.notes,
      }));
      setHistory(hist);

      try {
        const c = await verifier.getBatchCertificate(BigInt(rawId));
        setCert({
          grade:     GRADE_LABELS[Number(c.grade)],
          passed:    c.passed,
          issuedAt:  new Date(Number(c.issuedAt) * 1000).toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" }),
          inspector: c.inspector,
          remarks:   c.remarks,
        });
      } catch { /* no cert yet */ }

    } catch (e) {
      console.error(e);
      setError("Batch not found. Please check the ID — it must be a valid numeric batch ID on Sepolia Testnet.");
    } finally { setLoading(false); }
  }

  function copyLink() {
    const url = `${window.location.origin}?batch=${batchId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyMsg("🔗 Link copied!"); setTimeout(() => setCopyMsg(""), 2200);
    });
  }

  const qrUrl = `${window.location.origin}?batch=${batchId}`;

  /* timeline steps */
  const steps = batchInfo ? [
    {
      emoji:"🌾", title:`Farm Origin — ${batchInfo.farmLocation}`,
      desc:`${batchInfo.produceType} · ${batchInfo.quantity} kg · Harvested ${batchInfo.harvestDate}`,
      time:`Farmer: ${batchInfo.farmer.slice(0,10)}...${batchInfo.farmer.slice(-6)}`,
      color:"#16a34a", bg:"#dcfce7",
    },
    ...history.map((h, i) => ({
      emoji: i === 0 ? "🔬" : i === 1 ? "🚛" : "🏪",
      title: `${h.notes || "Transfer"} — ${h.location}`,
      desc:  `${h.transport} · Temp ${h.temp}°C`,
      time:  h.timestamp,
      tx:    `${h.from.slice(0,10)}... → ${h.to.slice(0,10)}...`,
      color: i === 0 ? "#7c3aed" : i === 1 ? "#2563eb" : "#ea580c",
      bg:    i === 0 ? "#ede9fe" : i === 1 ? "#dbeafe" : "#ffedd5",
    })),
    ...(cert ? [{
      emoji:"✅", title:`Quality Certified — Grade ${cert.grade}`,
      desc: cert.remarks || "Inspector verified quality",
      time: `Issued ${cert.issuedAt} · Inspector: ${cert.inspector.slice(0,10)}...`,
      color: cert.passed ? "#065f46" : "#991b1b",
      bg:    cert.passed ? "#d1fae5" : "#fee2e2",
    }] : []),
  ] : [];

  /* theme */
  const T = {
    bg:     dark ? "#0d1f11" : "#f0f7f2",
    card:   dark ? "rgba(255,255,255,0.05)" : "#ffffff",
    border: dark ? "rgba(255,255,255,0.10)" : "#e4ede6",
    text:   dark ? "#e8f5ee" : "#1a2e1a",
    muted:  dark ? "#6b9b7a" : "#4b7a5a",
    nav:    dark ? "rgba(13,31,17,0.97)" : "rgba(14,54,30,0.98)",
  };

  return (
    <div style={{ background:T.bg, minHeight:"100vh", fontFamily:"'Inter','Segoe UI',sans-serif", color:T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pdot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
        .pt-card{border-radius:20px;padding:28px;border:1px solid;animation:fadeUp .4s ease both}
        .pt-btn{border:none;border-radius:12px;padding:13px 28px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .25s;display:inline-flex;align-items:center;gap:8px}
        .pt-btn:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(26,107,58,.3)}
        .pt-btn-outline{background:transparent;border:2px solid #1a6b3a;color:#1a6b3a;border-radius:12px;padding:11px 24px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .25s}
        .pt-btn-outline:hover{background:#1a6b3a;color:white}
        .pt-input{width:100%;padding:14px 18px;border-radius:12px;font-size:15px;font-weight:600;font-family:monospace;outline:none;transition:border .2s}
        .pt-input:focus{border-color:#4caf72!important;box-shadow:0 0 0 3px rgba(76,175,114,.15)}
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position:"sticky", top:0, zIndex:100, background:T.nav, backdropFilter:"blur(16px)",
        WebkitBackdropFilter:"blur(16px)", borderBottom:"1px solid rgba(255,255,255,.08)",
        height:58, display:"flex", alignItems:"center", padding:"0 24px", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:"linear-gradient(135deg,#4caf72,#1a6b3a)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>🌱</div>
          <span style={{ fontWeight:800, color:"white", fontSize:16 }}>AgriChain</span>
          <span style={{ fontSize:11, color:"rgba(255,255,255,.4)", background:"rgba(255,255,255,.07)",
            padding:"2px 10px", borderRadius:20, marginLeft:4 }}>Public Trace</span>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <button onClick={() => setDark(d => !d)}
            style={{ background:"rgba(255,255,255,.1)", border:"1px solid rgba(255,255,255,.18)",
              borderRadius:8, width:30, height:30, display:"flex", alignItems:"center",
              justifyContent:"center", cursor:"pointer", fontSize:14 }}>
            {dark ? "☀️" : "🌙"}
          </button>
          {onBack && (
            <button onClick={onBack}
              style={{ background:"rgba(255,255,255,.08)", border:"1px solid rgba(255,255,255,.15)",
                borderRadius:9, padding:"6px 16px", fontSize:13, fontWeight:600, color:"white",
                cursor:"pointer", fontFamily:"inherit", transition:"all .2s" }}
              onMouseOver={e => e.currentTarget.style.background="rgba(255,255,255,.16)"}
              onMouseOut={e  => e.currentTarget.style.background="rgba(255,255,255,.08)"}>
              ← Home
            </button>
          )}
          {onSignIn && (
            <button onClick={onSignIn}
              style={{ background:"#4caf72", color:"#0b2614", border:"none", borderRadius:10,
                padding:"8px 20px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              🦊 Sign In
            </button>
          )}
        </div>
      </nav>

      <div style={{ maxWidth:820, margin:"0 auto", padding:"40px 20px" }}>

        {/* ── HERO BANNER ── */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🔍</div>
          <h1 style={{ fontSize:"clamp(24px,5vw,38px)", fontWeight:900, letterSpacing:"-1px",
            color:dark?"#e8f5ee":"#0b2614", marginBottom:10 }}>
            Trace Your Produce
          </h1>
          <p style={{ color:T.muted, fontSize:15, maxWidth:480, margin:"0 auto", lineHeight:1.7 }}>
            Enter a batch ID or scan a QR code to see the complete farm-to-fork journey — verified on Ethereum blockchain.
          </p>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, marginTop:14,
            background:dark?"rgba(76,175,114,.12)":"rgba(255,255,255,.9)",
            border:"1px solid #4caf72", borderRadius:50, padding:"5px 16px",
            fontSize:12, color:dark?"#4caf72":"#1a6b3a", fontWeight:600 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#4caf72",
              display:"inline-block", animation:"pdot 2s infinite" }}/>
            No MetaMask Required · Read-Only · Free
          </div>
        </div>

        {/* ── SEARCH BOX ── */}
        <div className="pt-card" style={{ background:T.card, borderColor:T.border,
          marginBottom:28, animationDelay:"0s" }}>
          <div style={{ fontWeight:700, fontSize:16, color:T.text, marginBottom:18, display:"flex", alignItems:"center", gap:8 }}>
            📦 Enter Batch ID
          </div>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
            <input
              ref={inputRef}
              className="pt-input"
              value={batchInput}
              onChange={e => setBatchInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && traceBatch()}
              placeholder="e.g. 1000 or AC-1000"
              style={{ flex:1, minWidth:180, border:`2px solid ${dark?"#2a4a2e":"#c2dfc9"}`,
                background:dark?"#1a2e1e":"white", color:T.text }}
            />
            <button
              className="pt-btn"
              onClick={() => traceBatch()}
              disabled={loading}
              style={{ background: loading?"#4b6655":"linear-gradient(135deg,#1a6b3a,#4caf72)",
                color:"white", opacity: loading?0.8:1 }}>
              {loading
                ? <><span style={{ width:16, height:16, border:"2px solid rgba(255,255,255,.35)",
                    borderTopColor:"white", borderRadius:"50%", animation:"spin .75s linear infinite",
                    display:"inline-block" }}/> Tracing...</>
                : "🔍 Trace Batch"}
            </button>
          </div>
          {error && (
            <div style={{ marginTop:14, background:"#fee2e2", border:"1px solid #f87171",
              borderRadius:10, padding:"12px 16px", fontSize:13, color:"#991b1b", fontWeight:500 }}>
              ❌ {error}
            </div>
          )}
        </div>

        {/* ── RESULTS ── */}
        {batchInfo && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

            {/* Overview Card */}
            <div className="pt-card" style={{ background:T.card, borderColor:T.border, animationDelay:".05s" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12, marginBottom:22 }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:"#4caf72", letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:6 }}>
                    Batch #{batchId}
                  </div>
                  <h2 style={{ fontSize:24, fontWeight:800, color:T.text, letterSpacing:"-0.5px" }}>
                    {batchInfo.produceType}
                  </h2>
                </div>
                <span style={{ padding:"6px 18px", borderRadius:20, fontSize:13, fontWeight:700,
                  background:STATUS_COLORS[batchInfo.status], color:STATUS_TEXT[batchInfo.status] }}>
                  {STATUS_LABELS[batchInfo.status]}
                </span>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:16 }}>
                {[
                  ["🌾 Produce",     batchInfo.produceType],
                  ["⚖️ Quantity",    batchInfo.quantity + " kg"],
                  ["📍 Farm Location", batchInfo.farmLocation],
                  ["🏷️ Certification", batchInfo.certification],
                  ["📅 Harvest Date", batchInfo.harvestDate],
                  ["🔗 Transfers",   history.length + " recorded"],
                ].map(([k, v]) => (
                  <div key={k} style={{ background:dark?"rgba(255,255,255,.04)":"#f8fdf8",
                    border:`1px solid ${T.border}`, borderRadius:12, padding:"12px 14px" }}>
                    <div style={{ fontSize:11, color:T.muted, marginBottom:5 }}>{k}</div>
                    <div style={{ fontWeight:700, fontSize:13, color:T.text }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ marginTop:22, display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
                <button className="pt-btn-outline" onClick={copyLink}>
                  🔗 Share Link
                </button>
                {batchId && (
                  <div style={{ background:dark?"rgba(255,255,255,.05)":"#f8fdf8",
                    border:`1px solid ${T.border}`, borderRadius:12, padding:"10px 14px",
                    display:"flex", alignItems:"center", gap:14 }}>
                    <QRCodeSVG value={qrUrl} size={64} fgColor="#1a6b3a" bgColor="transparent" />
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:3 }}>QR Code</div>
                      <div style={{ fontSize:11, color:T.muted }}>Scan to share this trace</div>
                    </div>
                  </div>
                )}
                {copyMsg && <span style={{ fontSize:13, color:"#16a34a", fontWeight:600 }}>{copyMsg}</span>}
              </div>
            </div>

            {/* Quality Certificate */}
            {cert && (
              <div className="pt-card" style={{ background:T.card, borderColor:T.border, animationDelay:".1s",
                borderLeft:`4px solid ${cert.passed?"#16a34a":"#ef4444"}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10, marginBottom:18 }}>
                  <h3 style={{ fontSize:16, fontWeight:800, color:T.text }}>🏅 Quality Certificate</h3>
                  <span style={{ padding:"6px 18px", borderRadius:20, fontSize:13, fontWeight:700,
                    background:cert.passed?GRADE_BG[cert.grade]:"#fee2e2",
                    color:cert.passed?GRADE_COLORS[cert.grade]:"#991b1b" }}>
                    Grade {cert.grade} — {cert.passed ? "PASSED ✓" : "REJECTED ✗"}
                  </span>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14 }}>
                  {[
                    ["Grade",     cert.grade],
                    ["Result",    cert.passed?"✅ Passed":"❌ Rejected"],
                    ["Issued",    cert.issuedAt],
                    ["Inspector", cert.inspector.slice(0,12)+"..."],
                  ].map(([k,v]) => (
                    <div key={k}>
                      <div style={{ fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:4 }}>{k}</div>
                      <div style={{ fontWeight:600, fontSize:13, color:T.text }}>{v}</div>
                    </div>
                  ))}
                  {cert.remarks && (
                    <div style={{ gridColumn:"span 4" }}>
                      <div style={{ fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:".5px", marginBottom:4 }}>Remarks</div>
                      <div style={{ fontWeight:500, fontSize:13, color:T.text }}>{cert.remarks}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Journey Timeline */}
            <div className="pt-card" style={{ background:T.card, borderColor:T.border, animationDelay:".15s" }}>
              <h3 style={{ fontSize:16, fontWeight:800, color:T.text, marginBottom:22 }}>
                📍 Full Journey on Blockchain
              </h3>
              {steps.length > 0 ? (
                <div style={{ display:"flex", flexDirection:"column" }}>
                  {steps.map((s, i) => (
                    <TimelineItem key={i} item={s} index={i} total={steps.length} dark={dark} />
                  ))}
                </div>
              ) : (
                <div style={{ textAlign:"center", padding:"32px 0", color:T.muted, fontSize:14 }}>
                  🚛 No transfers recorded yet — batch at origin farm.
                </div>
              )}
            </div>

            {/* Blockchain Verification Footer */}
            <div className="pt-card" style={{ background:dark?"rgba(76,175,114,.06)":"rgba(220,252,231,.4)",
              borderColor:"rgba(76,175,114,.25)", animationDelay:".2s", textAlign:"center" }}>
              <div style={{ fontSize:22, marginBottom:10 }}>⛓️</div>
              <div style={{ fontSize:14, fontWeight:700, color:dark?"#4caf72":"#1a6b3a", marginBottom:6 }}>
                Verified on Ethereum Sepolia Testnet
              </div>
              <div style={{ fontSize:12, color:T.muted, maxWidth:400, margin:"0 auto", lineHeight:1.7 }}>
                All data above is read directly from the blockchain — immutable and tamper-proof.
                No one, including AgriChain, can alter this record.
              </div>
              {onSignIn && (
                <div style={{ marginTop:18 }}>
                  <div style={{ fontSize:12, color:T.muted, marginBottom:10 }}>
                    Are you a farmer, distributor, retailer, or inspector?
                  </div>
                  <button onClick={onSignIn} className="pt-btn"
                    style={{ background:"linear-gradient(135deg,#1a6b3a,#4caf72)", color:"white" }}>
                    🦊 Sign In with Ethereum
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!batchInfo && !loading && !error && (
          <div style={{ textAlign:"center", padding:"48px 24px" }}>
            <div style={{ fontSize:64, marginBottom:16, opacity:.35 }}>📦</div>
            <div style={{ fontSize:16, fontWeight:600, color:T.text, marginBottom:8 }}>
              No batch loaded yet
            </div>
            <div style={{ fontSize:13, color:T.muted }}>
              Enter a batch ID above or scan a QR code from a product label.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
