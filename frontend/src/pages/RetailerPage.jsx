import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import ProduceRegistryABI from "../utils/ProduceRegistry.json";
import { REGISTRY_ADDRESS } from "../utils/addresses";

const STATUS_LABELS = ["Registered","In Transit","Quality Checked","Delivered","Rejected"];
const STATUS_COLORS = ["#e8f5ee","#fef3c7","#eff6ff","#d1fae5","#fee2e2"];
const STATUS_TEXT   = ["#1a6b3a","#92400e","#1e40af","#065f46","#991b1b"];

export default function RetailerPage({ account }) {
  const [tab, setTab]       = useState("confirm");
  const [batchId, setBatchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [batchInfo, setBatchInfo] = useState(null);
  const [batches, setBatches]     = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [activeQrBatch, setActiveQrBatch]   = useState(null);

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
        produceType:   batch.produceType,
        quantity:      batch.quantity.toString(),
        farmLocation:  batch.farmLocation,
        certification: batch.certification,
        status:        Number(batch.status),
        currentHolder: batch.currentHolder,
      });
      setResult(null);
    } catch (e) {
      setBatchInfo(null);
      setResult({ type: "error", msg: "Batch not found. Check the ID." });
    }
  }

  async function confirmDelivery() {
    if (!batchId) { setResult({ type: "error", msg: "Enter Batch ID" }); return; }
    try {
      setLoading(true); setResult(null);
      const signer   = await getSigner();
      const contract = new ethers.Contract(REGISTRY_ADDRESS, ProduceRegistryABI.abi, signer);
      // confirmDelivery() requires msg.sender == currentHolder — no OPERATOR_ROLE needed
      const tx = await contract.confirmDelivery(BigInt(batchId));
      await tx.wait();
      setResult({ type: "success", msg: `✅ Batch #${batchId} marked as Delivered! Tx: ${tx.hash.slice(0,22)}...` });
      setBatchInfo(b => b ? { ...b, status: 3 } : b);
    } catch (e) {
      setResult({ type: "error", msg: e.reason || e.message });
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
        certification:b.certification,
        status:       Number(b.status),
      })));
    } catch (e) { console.error(e); }
    finally { setLoadingBatches(false); }
  }, [account]);

  function handleTabChange(t) { setTab(t); setResult(null); if (t === "batches") loadMyBatches(); }

  const qrUrlForId = (id) => `${window.location.origin}?batch=${id}`;

  return (
    <div>
      <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
        {[["confirm","Confirm Delivery"],["batches","My Batches"]].map(([key,label]) => (
          <button key={key} className={tab === key ? "btn" : "btn-outline"} onClick={() => handleTabChange(key)}>{label}</button>
        ))}
      </div>

      {tab === "confirm" && (
        <div className="card">
          <div className="card-header"><h2>🏪 Confirm Batch Delivery</h2></div>
          <div className="card-body">
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Batch ID received from Distributor</label>
                <input value={batchId} onChange={e => setBatchId(e.target.value)} placeholder="Enter batch ID..." onKeyDown={e => e.key === "Enter" && lookupBatch()} />
              </div>
              <div style={{ alignSelf: "flex-end" }}>
                <button className="btn-outline" onClick={lookupBatch}>Lookup</button>
              </div>
            </div>

            {batchInfo && (
              <div style={{ background: "#f8f7f2", border: "1px solid #e5e1d8", borderRadius: "8px", padding: "14px 16px", marginBottom: "16px", display: "flex", justifyContent: "space-between", gap: "20px", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {[["Produce",batchInfo.produceType],["Quantity",batchInfo.quantity+" kg"],["Origin",batchInfo.farmLocation],["Certification",batchInfo.certification]].map(([k,v]) => (
                      <div key={k}>
                        <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>{k}</div>
                        <div style={{ fontWeight: 600, fontSize: "13px" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: "10px" }}>
                    <span className="badge" style={{ background: STATUS_COLORS[batchInfo.status], color: STATUS_TEXT[batchInfo.status] }}>{STATUS_LABELS[batchInfo.status]}</span>
                  </div>
                  {batchInfo.currentHolder.toLowerCase() !== account.toLowerCase() && (
                    <div style={{ marginTop: "10px", fontSize: "12px", color: "#b45309", background: "#fef3c7", padding: "8px 10px", borderRadius: "6px" }}>
                      ⚠️ You are not the current holder of this batch. Transfer it to your address first.
                    </div>
                  )}
                </div>
                {batchInfo.status === 3 && (
                  <div style={{ textAlign: "center", minWidth: "120px" }}>
                    <QRCodeSVG value={qrUrlForId(batchId)} size={100} bgColor="white" fgColor="#1a6b3a" style={{ border: "2px solid #e8f5ee", borderRadius: "6px", padding: "4px" }} />
                    <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "4px" }}>Customer QR Code</div>
                  </div>
                )}
              </div>
            )}

            <button className="btn" onClick={confirmDelivery} disabled={loading}>
              {loading && <span className="spinner" />}{loading ? "Confirming..." : "Confirm Delivery ⬡"}
            </button>
            {result && <div className={result.type === "success" ? "tx-box" : "error-box"}>{result.msg}</div>}
          </div>
        </div>
      )}

      {tab === "batches" && (
        <div className="card">
          <div className="card-header">
            <h2>📦 Batches At My Store</h2>
            <button className="btn-outline" onClick={loadMyBatches} disabled={loadingBatches}>{loadingBatches ? "Loading..." : "🔄 Refresh"}</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {loadingBatches ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#6b7280" }}>Loading from blockchain...</div>
            ) : batches.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#9ca3af" }}>No batches currently in your custody.</div>
            ) : (
              <table>
                <thead><tr><th>Batch ID</th><th>Produce</th><th>Qty (kg)</th><th>Origin</th><th>Cert</th><th>Status</th><th style={{ textAlign: "center" }}>Customer QR</th></tr></thead>
                <tbody>
                  {batches.map(b => (
                    <tr key={b.batchId}>
                      <td><strong>#{b.batchId}</strong></td>
                      <td>{b.produceType}</td>
                      <td>{b.quantity}</td>
                      <td>{b.farmLocation}</td>
                      <td>{b.certification}</td>
                      <td><span className="badge" style={{ background: STATUS_COLORS[b.status], color: STATUS_TEXT[b.status] }}>{STATUS_LABELS[b.status]}</span></td>
                      <td style={{ textAlign: "center" }}>
                        <button className="btn-outline" style={{ padding: "4px 10px", fontSize: "11px" }} onClick={() => setActiveQrBatch(b.batchId)}>View QR 📱</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* QR Code Modal Dialog */}
      {activeQrBatch && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, fontFamily: "inherit" }} onClick={() => setActiveQrBatch(null)}>
          <div style={{ background: "white", padding: "28px", borderRadius: "12px", textAlign: "center", maxWidth: "340px", width: "90%", border: "1px solid #e5e1d8" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: "16px", marginBottom: "4px" }}>Batch #{activeQrBatch} QR Code</h3>
            <p style={{ fontSize: "11px", color: "#6b7280", marginBottom: "20px" }}>Display this QR code at your retail counter for customers to verify organic crop traceability.</p>
            <div style={{ display: "inline-block", background: "white", padding: "12px", border: "1px solid #e5e1d8", borderRadius: "8px" }}>
              <QRCodeSVG value={qrUrlForId(activeQrBatch)} size={160} bgColor="white" fgColor="#1a6b3a" />
            </div>
            <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
              <a href={qrUrlForId(activeQrBatch)} target="_blank" rel="noreferrer" className="btn" style={{ flex: 1, textDecoration: "none", display: "inline-block", fontSize: "12px" }}>Open Live Trace</a>
              <button className="btn-outline" style={{ flex: 1, fontSize: "12px" }} onClick={() => setActiveQrBatch(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}