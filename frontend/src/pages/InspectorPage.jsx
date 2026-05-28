import { useState, useEffect } from "react";
import { ethers } from "ethers";
import QualityVerifierABI from "../utils/QualityVerifier.json";
import ProduceRegistryABI from "../utils/ProduceRegistry.json";
import { VERIFIER_ADDRESS, REGISTRY_ADDRESS } from "../utils/addresses";
import { toastSuccess, toastError, toastLoading, toastDismiss } from "../utils/toast";
import Confetti    from "../components/Confetti";
import StatsCard   from "../components/StatsCard";
import CopyButton  from "../components/CopyButton";
import SpoilagePredictor from "../components/SpoilagePredictor";
import { downloadCertificatePDF } from "../utils/pdf";

const GRADE_OPTIONS = [
  { value: 0, label: "Grade A — Excellent",  color: "#065f46", bg: "#d1fae5", icon: "🥇" },
  { value: 1, label: "Grade B — Good",       color: "#1e40af", bg: "#dbeafe", icon: "🥈" },
  { value: 2, label: "Grade C — Acceptable", color: "#92400e", bg: "#fef3c7", icon: "🥉" },
  { value: 3, label: "Rejected",             color: "#991b1b", bg: "#fee2e2", icon: "❌" },
];

const CHECKLIST_ITEMS = [
  { key: "freshness",  label: "✅ Freshness & Appearance", desc: "No visible rot, bruising, or discoloration" },
  { key: "pesticide",  label: "✅ Pesticide Levels",        desc: "Within FSSAI/EU MRL limits" },
  { key: "size",       label: "✅ Size & Weight",           desc: "Meets minimum grade requirements" },
  { key: "packaging",  label: "✅ Packaging Integrity",     desc: "Container intact, no leakage" },
  { key: "labeling",   label: "✅ Labeling Compliance",     desc: "Origin, date, and content correctly labeled" },
];

const SCORE_PARAMS = [
  { key: "freshness", label: "Freshness", icon: "🌿" },
  { key: "color",     label: "Color",     icon: "🎨" },
  { key: "size",      label: "Size",      icon: "📏" },
  { key: "smell",     label: "Smell",     icon: "👃" },
  { key: "packaging", label: "Packaging", icon: "📦" },
];

function scoreToGrade(avg) {
  if (avg >= 8.5) return "0"; // Grade A
  if (avg >= 6.5) return "1"; // Grade B
  if (avg >= 4.0) return "2"; // Grade C
  return "3"; // Rejected
}

export default function InspectorPage({ account }) {
  const [tab, setTab]           = useState("issue");
  const [form, setForm]         = useState({ batchId: "", grade: "0", ipfsHash: "", remarks: "" });
  const [checklist, setChecklist] = useState({});
  const [scores, setScores]     = useState({});
  const [lookup, setLookup]     = useState({ batchId: "" });
  const [batchInfo, setBatchInfo] = useState(null);
  const [cert,  setCert]        = useState(null);
  const [loading, setLoading]   = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [issuedCerts, setIssuedCerts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("inspector_certs") || "[]"); } catch { return []; }
  });
  const [inputMode, setInputMode] = useState("checklist"); // checklist | scoring
  const [roleStatus, setRoleStatus] = useState("checking"); // checking | granted | denied

  // Check role on mount
  useEffect(() => {
    async function checkRole() {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const verifier = new ethers.Contract(VERIFIER_ADDRESS, QualityVerifierABI.abi, provider);
        const INSPECTOR_HASH = ethers.keccak256(ethers.toUtf8Bytes("INSPECTOR"));
        const has = await verifier.hasRole(INSPECTOR_HASH, account);
        setRoleStatus(has ? "granted" : "denied");
      } catch { setRoleStatus("denied"); }
    }
    if (account) checkRole();
  }, [account]);

  const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

  // Compute auto-grade from scores
  function applyScoreGrade() {
    const vals = SCORE_PARAMS.map(p => parseInt(scores[p.key] || 5));
    const avg  = vals.reduce((a,b) => a+b, 0) / vals.length;
    setForm(f => ({ ...f, grade: scoreToGrade(avg) }));
  }

  // Build remarks from checklist
  function buildChecklistRemarks() {
    const passed = CHECKLIST_ITEMS.filter(i => checklist[i.key]);
    const failed = CHECKLIST_ITEMS.filter(i => !checklist[i.key]);
    const parts  = [];
    if (passed.length > 0) parts.push("Passed: " + passed.map(i => i.label.replace("✅ ","")).join(", "));
    if (failed.length > 0) parts.push("Failed: " + failed.map(i => i.label.replace("✅ ","")).join(", "));
    return parts.join(". ");
  }

  async function getSigner() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    return provider.getSigner();
  }

  async function lookupBatch() {
    if (!lookup.batchId) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const registry = new ethers.Contract(REGISTRY_ADDRESS, ProduceRegistryABI.abi, provider);
      const batch    = await registry.getBatch(BigInt(lookup.batchId));
      setBatchInfo({
        batchId:      batch.batchId.toString(),
        produceType:  batch.produceType,
        quantity:     batch.quantity.toString(),
        farmLocation: batch.farmLocation,
        certification:batch.certification,
        status:       ["Registered","In Transit","Quality Checked","Delivered","Rejected"][batch.status],
        harvestDate:  new Date(Number(batch.harvestTimestamp) * 1000).toLocaleDateString(),
        harvestTimestamp: batch.harvestTimestamp.toString(),
      });
      setForm(f => ({ ...f, batchId: lookup.batchId }));
      try {
        const verifier = new ethers.Contract(VERIFIER_ADDRESS, QualityVerifierABI.abi, provider);
        const c = await verifier.getBatchCertificate(BigInt(lookup.batchId));
        setCert({ grade: ["A","B","C","Rejected"][Number(c.grade)], passed: c.passed, remarks: c.remarks, ipfsHash: c.ipfsHash, issuedAt: new Date(Number(c.issuedAt)*1000).toLocaleDateString() });
      } catch { setCert(null); }
    } catch {
      setBatchInfo(null); toastError("Batch not found.");
    }
  }

  async function issueCertificate() {
    if (!form.batchId) { toastError("Enter a Batch ID"); return; }
    const finalRemarks = inputMode === "checklist" ? (form.remarks || buildChecklistRemarks()) : form.remarks;
    const tid = toastLoading("Waiting for MetaMask confirmation...");
    try {
      setLoading(true);
      const signer   = await getSigner();
      const verifier = new ethers.Contract(VERIFIER_ADDRESS, QualityVerifierABI.abi, signer);

      // ── Pre-check: does this wallet have INSPECTOR role? ──────────────
      const INSPECTOR_HASH = ethers.keccak256(ethers.toUtf8Bytes("INSPECTOR"));
      const hasInspectorRole = await verifier.hasRole(INSPECTOR_HASH, await signer.getAddress()).catch(() => false);
      if (!hasInspectorRole) {
        toastDismiss(tid);
        toastError("🚫 Inspector role not granted on blockchain. Ask admin to approve your request.");
        setLoading(false);
        return;
      }
      // ─────────────────────────────────────────────────────────────────

      const tx = await verifier.issueCertificate(BigInt(form.batchId), parseInt(form.grade), form.ipfsHash || "", finalRemarks || "");
      toastDismiss(tid);
      toastLoading("Transaction submitted — waiting for block confirmation...");
      const receipt = await tx.wait();
      const event   = receipt.logs.find(l => { try { return verifier.interface.parseLog(l)?.name === "CertificateIssued"; } catch { return false; } });
      const certId  = event ? verifier.interface.parseLog(event).args[0].toString() : "?";
      const gradeLabel = GRADE_OPTIONS[parseInt(form.grade)].label;
      toastDismiss(tid);
      toastSuccess(`✅ Certificate #${certId} issued! Grade: ${gradeLabel}`);
      setConfetti(true);
      setTimeout(() => setConfetti(false), 3600);

      // Store in local archive
      const certRecord = {
        certId, batchId: form.batchId, grade: gradeLabel,
        passed: parseInt(form.grade) < 3, issuedAt: new Date().toLocaleDateString(),
        produceType: batchInfo?.produceType || "—",
      };
      const updated = [certRecord, ...issuedCerts].slice(0, 50);
      setIssuedCerts(updated);
      localStorage.setItem("inspector_certs", JSON.stringify(updated));

      // Auto-download PDF
      downloadCertificatePDF({
        batchId: form.batchId, produceType: batchInfo?.produceType || "—",
        farmLocation: batchInfo?.farmLocation || "—",
        grade: ["A","B","C","Rejected"][parseInt(form.grade)],
        passed: parseInt(form.grade) < 3,
        remarks: finalRemarks, issuedAt: new Date().toLocaleDateString(),
        inspectorAddress: account,
      });

      setForm({ batchId: "", grade: "0", ipfsHash: "", remarks: "" });
      setBatchInfo(null); setCert(null); setChecklist({}); setScores({});
    } catch (e) {
      toastDismiss(tid);
      const msg = e.reason || e.message || "Transaction failed.";
      if (msg.toLowerCase().includes("role") || msg.toLowerCase().includes("access") || msg.toLowerCase().includes("missing")) {
        toastError("🚫 Inspector role not granted. Contact admin to approve your access request.");
      } else {
        toastError(msg);
      }
    } finally { setLoading(false); }
  }

  // Stats
  const totalCerts   = issuedCerts.length;
  const gradeACerts  = issuedCerts.filter(c => c.grade.includes("Grade A")).length;
  const thisMonth    = issuedCerts.filter(c => {
    const parts = c.issuedAt.split("/");
    const d = new Date(parseInt(parts[2]), parseInt(parts[0])-1);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const passRate = totalCerts > 0 ? Math.round((issuedCerts.filter(c => c.passed).length / totalCerts) * 100) : 0;

  return (
    <div>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp 0.4s ease forwards}
        .score-slider{width:100%;accent-color:#1a6b3a}
        .skeleton-line{height:14px;border-radius:6px;background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:200% 100%}
      `}</style>
      <Confetti active={confetti} />

      {/* ── Role Status Banner ── */}
      {roleStatus === "denied" && (
        <div style={{ background:"#fee2e2", border:"1px solid #f87171", borderRadius:10, padding:"14px 18px", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:24 }}>🚫</div>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:"#991b1b" }}>Inspector Role Not Granted on Blockchain</div>
            <div style={{ fontSize:12, color:"#b91c1c", marginTop:3 }}>
              Your wallet <span style={{ fontFamily:"monospace" }}>{account?.slice(0,10)}...{account?.slice(-6)}</span> does not have the INSPECTOR role on the QualityVerifier contract.
              Please submit a <strong>Request Access</strong> form with role "Inspector" and wait for admin approval.
            </div>
          </div>
        </div>
      )}
      {roleStatus === "granted" && (
        <div style={{ background:"#d1fae5", border:"1px solid #4caf72", borderRadius:10, padding:"10px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:18 }}>✅</div>
          <div style={{ fontSize:13, color:"#065f46", fontWeight:600 }}>Inspector role active on blockchain — you can issue certificates.</div>
        </div>
      )}

      {/* Stats */}
      <div className="stats" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <StatsCard icon="🏅" label="Total Certified"  value={totalCerts}  color="#7c3aed" />
        <StatsCard icon="🥇" label="Grade A Issued"   value={gradeACerts} color="#065f46" />
        <StatsCard icon="📅" label="This Month"       value={thisMonth}   color="#1e40af" />
        <StatsCard icon="📊" label="Pass Rate"        value={`${passRate}%`} color="#1a6b3a" />
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
        {[["issue","🏅 Issue Certificate"],["verify","🔍 Verify Batch"],["archive","📁 My Certificates"]].map(([key,label]) => (
          <button key={key} className={tab === key ? "btn" : "btn-outline"} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {/* ── ISSUE TAB ── */}
      {tab === "issue" && (
        <>
          {/* Lookup */}
          <div className="card fade-up" style={{ marginBottom: 16 }}>
            <div className="card-header"><h2>🔍 Lookup Batch</h2></div>
            <div className="card-body">
              <div style={{ display: "flex", gap: "10px" }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Batch ID</label>
                  <input value={lookup.batchId} onChange={e => setLookup({ batchId: e.target.value })}
                    placeholder="Enter batch ID to inspect..." onKeyDown={e => e.key === "Enter" && lookupBatch()} />
                </div>
                <div style={{ alignSelf: "flex-end" }}>
                  <button className="btn-outline" onClick={lookupBatch}>Lookup</button>
                </div>
              </div>
              {batchInfo && (
                <div style={{ marginTop: 14, background: "#f8f7f2", borderRadius: 8, padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {[["Produce",batchInfo.produceType],["Quantity",batchInfo.quantity+" kg"],["Location",batchInfo.farmLocation],["Certification",batchInfo.certification],["Harvest",batchInfo.harvestDate],["Status",batchInfo.status]].map(([k,v]) => (
                    <div key={k}><div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>{k}</div><div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div></div>
                  ))}
                </div>
              )}
              {/* AI Spoilage Prediction for inspector */}
              {batchInfo && (
                <div style={{ marginTop: 14 }}>
                  <SpoilagePredictor
                    batchInfo={{
                      produceType:      batchInfo.produceType,
                      quantity:         batchInfo.quantity,
                      farmLocation:     batchInfo.farmLocation,
                      certification:    batchInfo.certification,
                      harvestTimestamp: batchInfo.harvestTimestamp,
                      status:           0,
                    }}
                    history={[]}
                    cert={null}
                  />
                </div>
              )}
              {cert && (
                <div style={{ marginTop: 12, background: "#fee2e2", border: "1px solid #f87171", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#991b1b" }}>
                  ⚠️ This batch already has a certificate (Grade {cert.grade}, issued {cert.issuedAt}). A second certificate cannot be issued.
                </div>
              )}
            </div>
          </div>

          {/* Mode Switcher */}
          <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#6b7280", alignSelf: "center" }}>Input Mode:</span>
            {[["checklist","📋 Checklist"],["scoring","⭐ Scoring"],["manual","✏️ Manual"]].map(([m,l]) => (
              <button key={m} onClick={() => setInputMode(m)}
                style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "inherit", border: "1px solid",
                  background: inputMode === m ? "#1a6b3a" : "transparent",
                  color: inputMode === m ? "white" : "#6b7280",
                  borderColor: inputMode === m ? "#1a6b3a" : "#e5e1d8",
                }}>{l}</button>
            ))}
          </div>

          {/* Certificate Form */}
          <div className="card fade-up">
            <div className="card-header"><h2>🏅 Issue Quality Certificate</h2></div>
            <div className="card-body">
              {/* Grade Card Selector */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Quality Grade *</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                  {GRADE_OPTIONS.map(g => (
                    <div key={g.value}
                      onClick={() => setForm(f => ({ ...f, grade: String(g.value) }))}
                      style={{
                        padding: "14px 10px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                        background: parseInt(form.grade) === g.value ? g.bg : "#f8f7f2",
                        border: `2px solid ${parseInt(form.grade) === g.value ? g.color : "#e5e1d8"}`,
                        transition: "all 0.2s",
                        transform: parseInt(form.grade) === g.value ? "scale(1.04)" : "scale(1)",
                      }}
                    >
                      <div style={{ fontSize: 24 }}>{g.icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: parseInt(form.grade) === g.value ? g.color : "#6b7280", marginTop: 4 }}>{g.label.split("—")[0].trim()}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af" }}>{g.label.split("—")[1]?.trim()}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>Batch ID *</label>
                  <input name="batchId" value={form.batchId} onChange={handle} placeholder="1000" />
                </div>
                <div className="field">
                  <label>IPFS Document Hash (optional)</label>
                  <input name="ipfsHash" value={form.ipfsHash} onChange={handle} placeholder="Qm... (IPFS CID of lab report)" />
                </div>
              </div>

              {/* Checklist Mode */}
              {inputMode === "checklist" && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Inspection Checklist</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {CHECKLIST_ITEMS.map(item => (
                      <label key={item.key} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                        borderRadius: 8, cursor: "pointer",
                        background: checklist[item.key] ? "#e8f5ee" : "#f8f7f2",
                        border: `1px solid ${checklist[item.key] ? "#4caf72" : "#e5e1d8"}`,
                        transition: "all 0.2s",
                      }}>
                        <input type="checkbox" checked={!!checklist[item.key]}
                          onChange={e => setChecklist(c => ({ ...c, [item.key]: e.target.checked }))}
                          style={{ width: 18, height: 18, accentColor: "#1a6b3a", cursor: "pointer" }}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: checklist[item.key] ? "#1a6b3a" : "#374151" }}>{item.label}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>{item.desc}</div>
                        </div>
                        <div style={{ marginLeft: "auto", fontSize: 18 }}>{checklist[item.key] ? "✅" : "⬜"}</div>
                      </label>
                    ))}
                  </div>
                  {Object.keys(checklist).length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                      {Object.values(checklist).filter(Boolean).length}/{CHECKLIST_ITEMS.length} items passed
                      {Object.values(checklist).filter(Boolean).length === CHECKLIST_ITEMS.length && " 🎉 All items cleared!"}
                    </div>
                  )}
                </div>
              )}

              {/* Scoring Mode */}
              {inputMode === "scoring" && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Parameter Scoring (1–10)</div>
                  {SCORE_PARAMS.map(p => (
                    <div key={p.key} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{p.icon} {p.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#1a6b3a" }}>{scores[p.key] || 5}/10</span>
                      </div>
                      <input type="range" min={1} max={10} value={scores[p.key] || 5}
                        onChange={e => setScores(s => ({ ...s, [p.key]: e.target.value }))}
                        className="score-slider" style={{ width: "100%", accentColor: "#1a6b3a" }}
                      />
                    </div>
                  ))}
                  <button className="btn-outline" onClick={applyScoreGrade} style={{ marginTop: 4, fontSize: 12 }}>
                    🎯 Compute Grade from Scores
                  </button>
                </div>
              )}

              {/* Manual remarks */}
              <div className="field" style={{ marginBottom: 16 }}>
                <label>Inspector Remarks</label>
                <input name="remarks" value={form.remarks} onChange={handle} placeholder="Pesticide levels normal, freshness grade A..." />
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn" onClick={issueCertificate} disabled={loading || !!cert}>
                  {loading && <span className="spinner" />}{loading ? "Issuing..." : "Issue Certificate on Blockchain ⬡"}
                </button>
                {cert && <span style={{ fontSize: 12, color: "#991b1b", alignSelf: "center" }}>Certificate already exists for this batch.</span>}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── VERIFY TAB ── */}
      {tab === "verify" && (
        <div className="card fade-up">
          <div className="card-header"><h2>🔍 Verify Batch Certificate</h2></div>
          <div className="card-body">
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Batch ID</label>
                <input value={lookup.batchId} onChange={e => setLookup({ batchId: e.target.value })}
                  placeholder="Enter batch ID..." onKeyDown={e => e.key === "Enter" && lookupBatch()} />
              </div>
              <div style={{ alignSelf: "flex-end" }}>
                <button className="btn-outline" onClick={lookupBatch}>Verify</button>
              </div>
            </div>
            {cert ? (
              <div style={{ background: cert.passed ? "#e8f5ee" : "#fee2e2", border: `1px solid ${cert.passed ? "#4caf72" : "#f87171"}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}>{cert.passed ? "✅" : "❌"}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[["Grade",cert.grade],["Result",cert.passed?"PASSED":"REJECTED"],["Issued",cert.issuedAt],["Remarks",cert.remarks||"—"]].map(([k,v]) => (
                    <div key={k}><div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>{k}</div><div style={{ fontWeight: 600 }}>{v}</div></div>
                  ))}
                  {cert.ipfsHash && <div style={{ gridColumn: "span 2" }}><div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>IPFS Hash</div><div style={{ fontFamily: "monospace", fontSize: 11 }}>{cert.ipfsHash}</div></div>}
                </div>
                {batchInfo && (
                  <button className="btn" style={{ marginTop: 16, fontSize: 12 }}
                    onClick={() => downloadCertificatePDF({
                      batchId: lookup.batchId, produceType: batchInfo.produceType,
                      farmLocation: batchInfo.farmLocation, grade: cert.grade,
                      passed: cert.passed, remarks: cert.remarks,
                      issuedAt: cert.issuedAt, inspectorAddress: account,
                    })}>
                    ⬇️ Download Certificate PDF
                  </button>
                )}
              </div>
            ) : batchInfo && <div className="error-box">No quality certificate found for this batch yet.</div>}
          </div>
        </div>
      )}

      {/* ── ARCHIVE TAB ── */}
      {tab === "archive" && (
        <div className="card fade-up">
          <div className="card-header">
            <h2>📁 My Issued Certificates</h2>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Pass rate: <strong style={{ color: "#1a6b3a" }}>{passRate}%</strong></div>
          </div>
          {issuedCerts.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>
              <div style={{ fontSize: 32 }}>📁</div>
              No certificates issued yet in this browser session.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead><tr><th>Cert ID</th><th>Batch ID</th><th>Produce</th><th>Grade</th><th>Result</th><th>Issued</th></tr></thead>
                <tbody>
                  {issuedCerts.map((c, i) => (
                    <tr key={i}>
                      <td><strong>#{c.certId}</strong><CopyButton text={c.certId} /></td>
                      <td>#{c.batchId}</td>
                      <td>{c.produceType}</td>
                      <td><span className="badge" style={{ background: c.passed ? "#d1fae5" : "#fee2e2", color: c.passed ? "#065f46" : "#991b1b" }}>{c.grade}</span></td>
                      <td><span style={{ fontSize: 11, fontWeight: 700, color: c.passed ? "#1a6b3a" : "#991b1b" }}>{c.passed ? "PASSED" : "REJECTED"}</span></td>
                      <td style={{ color: "#6b7280", fontSize: 11 }}>{c.issuedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
