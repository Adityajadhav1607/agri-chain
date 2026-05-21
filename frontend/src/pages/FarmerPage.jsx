import { useState, useCallback, useRef } from "react";
import { ethers } from "ethers";
import ProduceRegistryABI from "../utils/ProduceRegistry.json";
import TrackTransferABI   from "../utils/TrackTransfer.json";
import FarmPassportABI    from "../utils/FarmPassport.json";
import { REGISTRY_ADDRESS, TRACKER_ADDRESS, FARM_PASSPORT_ADDRESS } from "../utils/addresses";
import { toastSuccess, toastError, toastLoading, toastDismiss } from "../utils/toast";
import Confetti       from "../components/Confetti";
import StatsCard      from "../components/StatsCard";
import CopyButton     from "../components/CopyButton";
import BatchAgeTag    from "../components/BatchAgeTag";
import PriceTicker    from "../components/PriceTicker";
import PriceAdvisor   from "../components/PriceAdvisor";
import GreenPortfolio from "../components/GreenPortfolio";
import { buildFarmPassportMetadata, uploadMetadata } from "../utils/ipfs";
import { getCropPrice } from "../utils/shelfLife";

const STATUS_LABELS = ["Registered","In Transit","Quality Checked","Delivered","Rejected"];
const STATUS_COLORS = ["#e8f5ee","#fef3c7","#eff6ff","#d1fae5","#fee2e2"];
const STATUS_TEXT   = ["#1a6b3a","#92400e","#1e40af","#065f46","#991b1b"];

const PRODUCE_TYPES = [
  "Wheat","Rice","Tomato","Onion","Potato","Mango","Banana","Apple",
  "Carrot","Spinach","Corn","Garlic","Ginger","Chili","Cauliflower",
  "Cabbage","Broccoli","Lettuce","Cucumber","Pumpkin","Grapes","Orange","Lemon",
];

const CERTIFICATIONS = ["None","Organic","APEDA","GlobalGAP","FSSAI"];

function SkeletonRow({ cols = 8 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}><div className="skeleton-line" /></td>
      ))}
    </tr>
  );
}

const STATUS_FILTER_OPTIONS = ["All","Registered","In Transit","Quality Checked","Delivered","Rejected"];

export default function FarmerPage({ account }) {
  const [tab, setTab]     = useState("register");
  const [form, setForm]   = useState({ produceType: "", quantity: "", farmLocation: "", certification: "None", notes: "" });
  const [transfer, setTransfer] = useState({ batchId: "", distributorAddr: "", location: "", temp: "25", transport: "0" });
  const [loading, setLoading]   = useState(false);
  const [batches, setBatches]   = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [fieldErrors, setFieldErrors]   = useState({});
  const [drawerBatch, setDrawerBatch]   = useState(null);
  const [drawerHistory, setDrawerHistory] = useState([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [gpsCoords, setGpsCoords]       = useState({ lat: "", lon: "" });
  const [gpsLoading, setGpsLoading]     = useState(false);
  const [lastBatchId, setLastBatchId]   = useState(null);

  const handle  = e => setForm({ ...form, [e.target.name]: e.target.value });
  const handleT = e => setTransfer({ ...transfer, [e.target.name]: e.target.value });

  async function getSigner() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    return provider.getSigner();
  }

  function validateRegister() {
    const errors = {};
    if (!form.produceType.trim()) errors.produceType = "Produce type is required";
    if (!form.quantity || Number(form.quantity) <= 0) errors.quantity = "Enter a valid quantity";
    if (!form.farmLocation.trim()) errors.farmLocation = "Farm location is required";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function registerBatch() {
    if (!validateRegister()) return;
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
      setLastBatchId(batchId);

      // Auto-mint Farm Passport NFT if GPS coords provided
      if (gpsCoords.lat && gpsCoords.lon && FARM_PASSPORT_ADDRESS && batchId !== "?") {
        try {
          const gpsString  = `${gpsCoords.lat},${gpsCoords.lon}`;
          const metadata   = buildFarmPassportMetadata({
            batchId, produceType: form.produceType, farmLocation: form.farmLocation,
            gpsCoordinates: gpsString, farmerAddress: await signer.getAddress(),
            harvestDate: new Date().toLocaleDateString(), mapImageUrl: "",
          });
          const tokenUri   = await uploadMetadata(metadata);
          const passport   = new ethers.Contract(FARM_PASSPORT_ADDRESS, FarmPassportABI.abi, signer);
          const ptx        = await passport.mintPassport(await signer.getAddress(), BigInt(batchId), gpsString, tokenUri);
          await ptx.wait();
          toastSuccess(`🗺️ Farm Passport NFT minted for batch #${batchId}!`);
        } catch (pe) {
          console.warn("Farm Passport mint failed (non-critical):", pe.message);
        }
      }

      setForm({ produceType: "", quantity: "", farmLocation: "", certification: "None", notes: "" });
      setGpsCoords({ lat: "", lon: "" });
      setFieldErrors({});
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
      setConfetti(true);
      setTimeout(() => setConfetti(false), 3600);
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
        batchId:         b.batchId.toString(),
        produceType:     b.produceType,
        quantity:        b.quantity.toString(),
        farmLocation:    b.farmLocation,
        certification:   b.certification,
        status:          Number(b.status),
        harvestDate:     new Date(Number(b.harvestTimestamp) * 1000).toLocaleDateString(),
        harvestTimestamp: b.harvestTimestamp.toString(),
        currentHolder:   b.currentHolder,
      })));
    } catch (e) { toastError("Failed to load batches."); console.error(e); }
    finally { setLoadingBatches(false); }
  }, [account]);

  async function openDrawer(batch) {
    setDrawerBatch(batch);
    setDrawerHistory([]);
    setDrawerLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const tracker  = new ethers.Contract(TRACKER_ADDRESS, TrackTransferABI.abi, provider);
      const transfers = await tracker.getBatchHistory(BigInt(batch.batchId));
      setDrawerHistory(transfers.map(t => ({
        from:      t.from,
        to:        t.to,
        location:  t.location,
        temp:      t.temperature.toString(),
        timestamp: new Date(Number(t.timestamp) * 1000).toLocaleString(),
        notes:     t.notes,
      })));
    } catch { setDrawerHistory([]); }
    finally { setDrawerLoading(false); }
  }

  function exportCSV() {
    const rows = [["Batch ID","Produce","Qty(kg)","Location","Cert","Status","Harvest"],
      ...filteredBatches.map(b => [b.batchId, b.produceType, b.quantity, b.farmLocation, b.certification, STATUS_LABELS[b.status], b.harvestDate])];
    const csv  = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "my_batches.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function handleTabChange(t) { setTab(t); if (t === "batches") loadMyBatches(); }

  const filteredBatches = statusFilter === "All"
    ? batches
    : batches.filter(b => STATUS_LABELS[b.status] === statusFilter);

  // Stats
  const totalKg     = batches.reduce((s, b) => s + parseInt(b.quantity || 0), 0);
  const inTransit   = batches.filter(b => b.status === 1).length;
  const delivered   = batches.filter(b => b.status === 3).length;
  const estRevenue  = batches.reduce((s, b) => s + parseInt(b.quantity || 0) * getCropPrice(b.produceType), 0);

  return (
    <div>
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .skeleton-line{height:14px;border-radius:6px;background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.4s ease infinite}
        @keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp 0.4s ease forwards}
        .field-error{font-size:11px;color:#dc2626;margin-top:3px}
        .field input.error,.field select.error{border-color:#f87171;background:#fff5f5}
      `}</style>
      <Confetti active={confetti} />

      {/* Live Market Price Ticker */}
      <PriceTicker compact />

      {/* Dashboard Stats */}
      <div className="stats" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <StatsCard icon="📦" label="Total Batches"  value={batches.length} color="#1a6b3a" />
        <StatsCard icon="⚖️" label="Total Quantity" value={`${totalKg.toLocaleString()} kg`} color="#1e40af" />
        <StatsCard icon="🚛" label="In Transit"     value={inTransit} color="#b45309" />
        <StatsCard icon="💰" label="Est. Revenue"   value={`₹${estRevenue.toLocaleString()}`} color="#7c3aed" sub="at current mandi rates" />
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
        {[["register","🌾 Register Batch"],["transfer","🚛 Transfer"],["batches","📦 My Batches"],["prices","📊 Market Prices"],["green","🌿 Green Portfolio"]].map(([key,label]) => (
        <button key={key} className={tab === key ? "btn" : "btn-outline"} onClick={() => handleTabChange(key)}>{label}</button>
      ))}
      </div>

      {/* ── REGISTER TAB ── */}
      {tab === "register" && (
        <div className="card fade-up">
          <div className="card-header"><h2>🌾 Register Produce Batch</h2></div>
          <div className="card-body">
            <div className="form-grid">
              <div className="field">
                <label>Produce Type *</label>
                <input
                  name="produceType" value={form.produceType} onChange={handle}
                  placeholder="Wheat, Tomato, Onion..."
                  list="produce-list"
                  className={fieldErrors.produceType ? "error" : ""}
                />
                <datalist id="produce-list">
                  {PRODUCE_TYPES.map(p => <option key={p} value={p} />)}
                </datalist>
                {fieldErrors.produceType && <div className="field-error">⚠ {fieldErrors.produceType}</div>}
                {form.produceType && (
                  <div style={{ fontSize: "10px", color: "#1a6b3a", marginTop: 3 }}>
                    💰 Market rate: ₹{getCropPrice(form.produceType)}/kg
                  </div>
                )}
              </div>
              <div className="field">
                <label>Quantity (kg) *</label>
                <input
                  name="quantity" type="number" value={form.quantity} onChange={handle} placeholder="500"
                  className={fieldErrors.quantity ? "error" : ""}
                />
                {fieldErrors.quantity && <div className="field-error">⚠ {fieldErrors.quantity}</div>}
                {form.quantity && form.produceType && (
                  <div style={{ fontSize: "10px", color: "#1a6b3a", marginTop: 3 }}>
                    💰 Est. value: ₹{(parseInt(form.quantity || 0) * getCropPrice(form.produceType)).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="field">
                <label>Farm Location *</label>
                <input
                  name="farmLocation" value={form.farmLocation} onChange={handle}
                  placeholder="Village, District, State"
                  className={fieldErrors.farmLocation ? "error" : ""}
                />
                {fieldErrors.farmLocation && <div className="field-error">⚠ {fieldErrors.farmLocation}</div>}
              </div>
              <div className="field">
                <label>Certification</label>
                <select name="certification" value={form.certification} onChange={handle}>
                  {CERTIFICATIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              {/* GPS Coordinates — Optional, triggers Farm Passport NFT mint */}
              <div className="field">
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  📍 GPS Latitude
                  <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 400 }}>(optional — mints a Farm Passport NFT)</span>
                </label>
                <input
                  type="number" step="any"
                  value={gpsCoords.lat}
                  onChange={e => setGpsCoords(g => ({ ...g, lat: e.target.value }))}
                  placeholder="e.g. 19.0760"
                />
              </div>
              <div className="field">
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  📍 GPS Longitude
                  <button
                    type="button"
                    disabled={gpsLoading}
                    onClick={() => {
                      if (!navigator.geolocation) { toastError("Geolocation not supported"); return; }
                      setGpsLoading(true);
                      navigator.geolocation.getCurrentPosition(
                        pos => { setGpsCoords({ lat: pos.coords.latitude.toFixed(6), lon: pos.coords.longitude.toFixed(6) }); setGpsLoading(false); },
                        () => { toastError("Location access denied"); setGpsLoading(false); }
                      );
                    }}
                    style={{ marginLeft: 6, background: "#e8f5ee", color: "#1a6b3a", border: "1px solid #4caf72", borderRadius: 6, padding: "2px 8px", fontSize: 10, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
                  >
                    {gpsLoading ? "Getting..." : "📡 Use My Location"}
                  </button>
                </label>
                <input
                  type="number" step="any"
                  value={gpsCoords.lon}
                  onChange={e => setGpsCoords(g => ({ ...g, lon: e.target.value }))}
                  placeholder="e.g. 72.8777"
                />
                {gpsCoords.lat && gpsCoords.lon && (
                  <div style={{ fontSize: 10, color: "#1a6b3a", marginTop: 3 }}>✅ GPS set: {gpsCoords.lat}, {gpsCoords.lon} — Farm Passport NFT will auto-mint!</div>
                )}
              </div>
              <div className="field" style={{ gridColumn: "span 2" }}>
                <label>Notes</label>
                <input name="notes" value={form.notes} onChange={handle} placeholder="Pesticide use, variety, harvest method..." />
              </div>
            </div>
            <button className="btn" onClick={registerBatch} disabled={loading}>
              {loading && <span className="spinner" />}{loading ? "Registering..." : "Register Batch on Blockchain ⬡"}
            </button>
          </div>
        </div>
      )}

      {/* ── TRANSFER TAB ── */}
      {tab === "transfer" && (
        <div className="card fade-up">
          <div className="card-header"><h2>🚛 Transfer to Distributor</h2></div>
          <div className="card-body">
            <div className="form-grid">
              <div className="field"><label>Batch ID *</label><input name="batchId" value={transfer.batchId} onChange={handleT} placeholder="1000" /></div>
              <div className="field"><label>Temperature (°C)</label>
                <input name="temp" type="number" value={transfer.temp} onChange={handleT} />
                {(parseInt(transfer.temp) > 35 || parseInt(transfer.temp) < 0) && (
                  <div style={{ fontSize: "11px", color: "#dc2626", marginTop: 3 }}>⚠️ Temperature outside safe range (0–35°C)!</div>
                )}
              </div>
              <div className="field" style={{ gridColumn: "span 2" }}>
                <label>Distributor Wallet Address *</label>
                <input name="distributorAddr" value={transfer.distributorAddr} onChange={handleT} placeholder="0x... distributor's wallet" />
              </div>
              <div className="field"><label>Pickup Location</label><input name="location" value={transfer.location} onChange={handleT} placeholder="Farm Gate, Nasik" /></div>
              <div className="field">
                <label>Transport Mode</label>
                <select name="transport" value={transfer.transport} onChange={handleT}>
                  <option value="0">🚛 Road</option><option value="1">🚂 Rail</option>
                  <option value="2">✈️ Air</option><option value="3">🚢 Sea</option>
                </select>
              </div>
            </div>
            <button className="btn" onClick={transferToDistributor} disabled={loading}>
              {loading && <span className="spinner" />}{loading ? "Transferring..." : "Transfer to Distributor ⬡"}
            </button>
          </div>
        </div>
      )}

      {/* ── BATCHES TAB ── */}
      {tab === "batches" && (
        <div className="card fade-up">
          <div className="card-header">
            <h2>📦 My Registered Batches</h2>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button className="btn-outline" style={{ fontSize: "11px", padding: "6px 12px" }} onClick={exportCSV}>⬇️ CSV</button>
              <button className="btn-outline" onClick={loadMyBatches} disabled={loadingBatches}>{loadingBatches ? "Loading..." : "🔄 Refresh"}</button>
            </div>
          </div>

          {/* Status Filter */}
          <div style={{ padding: "10px 16px", borderBottom: "1px solid #e5e1d8", display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {STATUS_FILTER_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setStatusFilter(opt)}
                style={{
                  padding: "4px 12px", borderRadius: "20px", fontSize: "11px", cursor: "pointer",
                  fontFamily: "inherit", border: "1px solid",
                  background: statusFilter === opt ? "#1a6b3a" : "transparent",
                  color:      statusFilter === opt ? "white"   : "#6b7280",
                  borderColor: statusFilter === opt ? "#1a6b3a" : "#e5e1d8",
                  transition: "all 0.2s",
                }}
              >
                {opt} {opt !== "All" && `(${batches.filter(b => STATUS_LABELS[b.status] === opt).length})`}
              </button>
            ))}
          </div>

          <div className="card-body" style={{ padding: 0 }}>
            {loadingBatches ? (
              <table>
                <thead><tr><th>Batch ID</th><th>Produce</th><th>Qty (kg)</th><th>Location</th><th>Cert</th><th>Freshness</th><th>Harvest</th><th>Status</th></tr></thead>
                <tbody>{[1,2,3].map(i => <SkeletonRow key={i} cols={8} />)}</tbody>
              </table>
            ) : filteredBatches.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>📭</div>
                {statusFilter === "All" ? "No batches registered yet. Use the Register tab above." : `No batches with status "${statusFilter}".`}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead><tr>
                    <th>Batch ID</th><th>Produce</th><th>Qty (kg)</th><th>Location</th>
                    <th>Cert</th><th>Freshness</th><th>Harvest</th><th>Status</th><th>Details</th>
                  </tr></thead>
                  <tbody>
                    {filteredBatches.map(b => (
                      <tr key={b.batchId}>
                        <td>
                          <strong>#{b.batchId}</strong>
                          <CopyButton text={b.batchId} />
                        </td>
                        <td>{b.produceType}</td>
                        <td>{parseInt(b.quantity).toLocaleString()}</td>
                        <td>{b.farmLocation}</td>
                        <td>
                          {b.certification !== "None" ? (
                            <span className="badge badge-green">{b.certification}</span>
                          ) : <span style={{ color: "#9ca3af", fontSize: "11px" }}>None</span>}
                        </td>
                        <td><BatchAgeTag harvestTimestamp={b.harvestTimestamp} produceType={b.produceType} /></td>
                        <td style={{ whiteSpace: "nowrap" }}>{b.harvestDate}</td>
                        <td><span className="badge" style={{ background: STATUS_COLORS[b.status], color: STATUS_TEXT[b.status] }}>{STATUS_LABELS[b.status]}</span></td>
                        <td>
                          <button className="btn-outline" style={{ fontSize: "11px", padding: "4px 10px" }} onClick={() => openDrawer(b)}>
                            📋 History
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

      {/* ── MARKET PRICES TAB ── */}
      {tab === "prices" && (
        <div className="card fade-up">
          <PriceAdvisor account={account} batches={batches} />
        </div>
      )}

      {/* ── GREEN PORTFOLIO TAB ── */}
      {tab === "green" && (
        <div className="card fade-up">
          <GreenPortfolio account={account} />
        </div>
      )}

      {/* ── Batch History Drawer ── */}
      {drawerBatch && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000, display: "flex", justifyContent: "flex-end" }}
          onClick={() => setDrawerBatch(null)}
        >
          <div
            style={{ width: "min(440px,100%)", background: "white", height: "100%", overflowY: "auto", padding: "24px", boxShadow: "-4px 0 24px rgba(0,0,0,0.2)", animation: "slideIn 0.3s ease" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700 }}>📋 Batch #{drawerBatch.batchId} History</h2>
              <button onClick={() => setDrawerBatch(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#6b7280" }}>✕</button>
            </div>
            <div style={{ background: "#f8f7f2", borderRadius: 8, padding: "12px 16px", marginBottom: "20px", display: "grid", gap: "8px", fontSize: "12px" }}>
              {[["Produce",drawerBatch.produceType],["Quantity",drawerBatch.quantity+" kg"],["Location",drawerBatch.farmLocation],["Cert",drawerBatch.certification]].map(([k,v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>{k}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px", color: "#374151" }}>Transfer History</h3>
            {drawerLoading ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#6b7280" }}>Loading from blockchain...</div>
            ) : drawerHistory.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#9ca3af", fontSize: "13px" }}>No transfers recorded yet.</div>
            ) : (
              <div className="timeline">
                {drawerHistory.map((h, i) => (
                  <div className="tl-item" key={i}>
                    <div className="tl-dot done">🚛</div>
                    <div>
                      <div className="tl-title">{h.notes} — {h.location}</div>
                      <div className="tl-meta">{h.timestamp} · Temp: {h.temp}°C</div>
                      <div className="tl-tx">From: {h.from.slice(0,12)}... → To: {h.to.slice(0,12)}...</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}