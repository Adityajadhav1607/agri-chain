import { useState } from "react";
import { ethers } from "ethers";
import QualityVerifierABI from "../utils/QualityVerifier.json";
import ProduceRegistryABI from "../utils/ProduceRegistry.json";
import { VERIFIER_ADDRESS, REGISTRY_ADDRESS } from "../utils/addresses";
import { toastSuccess, toastError, toastLoading, toastDismiss } from "../utils/toast";
import Confetti from "../components/Confetti";

const GRADE_OPTIONS = [
  { value: 0, label: "Grade A — Excellent",  color: "#065f46", bg: "#d1fae5" },
  { value: 1, label: "Grade B — Good",       color: "#1e40af", bg: "#dbeafe" },
  { value: 2, label: "Grade C — Acceptable", color: "#92400e", bg: "#fef3c7" },
  { value: 3, label: "Rejected",             color: "#991b1b", bg: "#fee2e2" },
];

export default function InspectorPage({ account }) {
  const [tab, setTab]     = useState("issue");
  const [form, setForm]   = useState({ batchId: "", grade: "0", ipfsHash: "", remarks: "" });
  const [lookup, setLookup] = useState({ batchId: "" });
  const [batchInfo, setBatchInfo] = useState(null);
  const [cert,  setCert]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

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
      });
      setForm(f => ({ ...f, batchId: lookup.batchId }));
      // check for existing cert
      try {
        const verifier = new ethers.Contract(VERIFIER_ADDRESS, QualityVerifierABI.abi, provider);
        const c = await verifier.getBatchCertificate(BigInt(lookup.batchId));
        setCert({ grade: ["A","B","C","Rejected"][Number(c.grade)], passed: c.passed, remarks: c.remarks, ipfsHash: c.ipfsHash, issuedAt: new Date(Number(c.issuedAt)*1000).toLocaleDateString() });
      } catch { setCert(null); }
    } catch {
      setBatchInfo(null);
      toastError("Batch not found.");
    }
  }

  async function issueCertificate() {
    if (!form.batchId) { toastError("Enter a Batch ID"); return; }
    const tid = toastLoading("Waiting for MetaMask confirmation...");
    try {
      setLoading(true);
      const signer   = await getSigner();
      const verifier = new ethers.Contract(VERIFIER_ADDRESS, QualityVerifierABI.abi, signer);
      const tx = await verifier.issueCertificate(BigInt(form.batchId), parseInt(form.grade), form.ipfsHash || "", form.remarks || "");
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
      setForm({ batchId: "", grade: "0", ipfsHash: "", remarks: "" });
      setBatchInfo(null); setCert(null);
    } catch (e) {
      toastDismiss(tid);
      toastError(e.reason || e.message || "Transaction failed.");
    } finally { setLoading(false); }
  }

  return (
    <div>
      <Confetti active={confetti} />

      <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
        {[["issue","Issue Certificate"],["verify","Verify Batch"]].map(([key,label]) => (
          <button key={key} className={tab === key ? "btn" : "btn-outline"} onClick={() => { setTab(key); }}>{label}</button>
        ))}
      </div>

      {/* Issue Certificate Tab */}
      {tab === "issue" && (
        <>
          {/* Lookup first */}
          <div className="card" style={{ marginBottom: "16px" }}>
            <div className="card-header"><h2>🔍 Lookup Batch</h2></div>
            <div className="card-body">
              <div style={{ display: "flex", gap: "10px" }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Batch ID</label>
                  <input value={lookup.batchId} onChange={e => setLookup({ batchId: e.target.value })} placeholder="Enter batch ID to inspect..." onKeyDown={e => e.key === "Enter" && lookupBatch()} />
                </div>
                <div style={{ alignSelf: "flex-end" }}>
                  <button className="btn-outline" onClick={lookupBatch}>Lookup</button>
                </div>
              </div>
              {batchInfo && (
                <div style={{ marginTop: "14px", background: "#f8f7f2", borderRadius: "8px", padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                  {[["Produce",batchInfo.produceType],["Quantity",batchInfo.quantity+" kg"],["Location",batchInfo.farmLocation],["Certification",batchInfo.certification],["Harvest",batchInfo.harvestDate],["Status",batchInfo.status]].map(([k,v]) => (
                    <div key={k}><div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>{k}</div><div style={{ fontWeight: 600, fontSize: "13px" }}>{v}</div></div>
                  ))}
                </div>
              )}
              {cert && (
                <div style={{ marginTop: "12px", background: cert.passed ? "#e8f5ee" : "#fee2e2", border: `1px solid ${cert.passed ? "#4caf72" : "#f87171"}`, borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: cert.passed ? "#1a6b3a" : "#991b1b" }}>
                  ⚠️ This batch already has a certificate (Grade {cert.grade}, issued {cert.issuedAt}). Cannot issue a second one.
                </div>
              )}
            </div>
          </div>

          {/* Certificate Form */}
          <div className="card">
            <div className="card-header"><h2>🏅 Issue Quality Certificate</h2></div>
            <div className="card-body">
              <div className="form-grid">
                <div className="field">
                  <label>Batch ID *</label>
                  <input name="batchId" value={form.batchId} onChange={handle} placeholder="1000" />
                </div>
                <div className="field">
                  <label>Quality Grade *</label>
                  <select name="grade" value={form.grade} onChange={handle}>
                    {GRADE_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div className="field" style={{ gridColumn: "span 2" }}>
                  <label>IPFS Document Hash (optional)</label>
                  <input name="ipfsHash" value={form.ipfsHash} onChange={handle} placeholder="Qm... (IPFS CID of lab report)" />
                </div>
                <div className="field" style={{ gridColumn: "span 2" }}>
                  <label>Inspector Remarks</label>
                  <input name="remarks" value={form.remarks} onChange={handle} placeholder="Pesticide levels normal, freshness grade A..." />
                </div>
              </div>

              {/* Grade Preview */}
              <div style={{ marginBottom: "16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {GRADE_OPTIONS.map(g => (
                  <div key={g.value} onClick={() => setForm(f => ({ ...f, grade: String(g.value) }))}
                    style={{ padding: "6px 14px", borderRadius: "20px", cursor: "pointer", fontSize: "12px", fontWeight: "600",
                      background: parseInt(form.grade) === g.value ? g.bg : "#f3f4f6",
                      color: parseInt(form.grade) === g.value ? g.color : "#6b7280",
                      border: `2px solid ${parseInt(form.grade) === g.value ? g.color : "transparent"}` }}>
                    {g.label}
                  </div>
                ))}
              </div>

              <button className="btn" onClick={issueCertificate} disabled={loading || !!cert}>
                {loading && <span className="spinner" />}{loading ? "Issuing..." : "Issue Certificate on Blockchain ⬡"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Verify Tab */}
      {tab === "verify" && (
        <div className="card">
          <div className="card-header"><h2>🔍 Verify Batch Certificate</h2></div>
          <div className="card-body">
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Batch ID</label>
                <input value={lookup.batchId} onChange={e => setLookup({ batchId: e.target.value })} placeholder="Enter batch ID..." onKeyDown={e => e.key === "Enter" && lookupBatch()} />
              </div>
              <div style={{ alignSelf: "flex-end" }}>
                <button className="btn-outline" onClick={lookupBatch}>Verify</button>
              </div>
            </div>
            {cert ? (
              <div style={{ background: cert.passed ? "#e8f5ee" : "#fee2e2", border: `1px solid ${cert.passed ? "#4caf72" : "#f87171"}`, borderRadius: "10px", padding: "20px" }}>
                <div style={{ fontSize: "32px", textAlign: "center", marginBottom: "12px" }}>{cert.passed ? "✅" : "❌"}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {[["Grade",cert.grade],["Result",cert.passed?"PASSED":"REJECTED"],["Issued",cert.issuedAt],["Remarks",cert.remarks||"—"]].map(([k,v]) => (
                    <div key={k}><div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>{k}</div><div style={{ fontWeight: 600 }}>{v}</div></div>
                  ))}
                  {cert.ipfsHash && <div style={{ gridColumn: "span 2" }}><div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>IPFS Hash</div><div style={{ fontFamily: "monospace", fontSize: "11px" }}>{cert.ipfsHash}</div></div>}
                </div>
              </div>
            ) : batchInfo && <div className="error-box">No quality certificate found for this batch yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
