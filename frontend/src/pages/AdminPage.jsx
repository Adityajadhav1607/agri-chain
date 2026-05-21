/* eslint-disable no-undef */
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import ProduceRegistryABI from "../utils/ProduceRegistry.json";
import TrackTransferABI   from "../utils/TrackTransfer.json";
import QualityVerifierABI from "../utils/QualityVerifier.json";
import PriceOracleABI     from "../utils/PriceOracle.json";
import { REGISTRY_ADDRESS, TRACKER_ADDRESS, VERIFIER_ADDRESS, ORACLE_ADDRESS } from "../utils/addresses";
import { toastSuccess, toastError, toastLoading, toastDismiss, toastInfo } from "../utils/toast";
import StatsCard from "../components/StatsCard";

ChartJS.register(ArcElement, Tooltip, Legend);

const ROLE_HASHES = {
  farmer:      ethers.keccak256(ethers.toUtf8Bytes("FARMER")),
  distributor: ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR")),
  retailer:    ethers.keccak256(ethers.toUtf8Bytes("RETAILER")),
  inspector:   ethers.keccak256(ethers.toUtf8Bytes("INSPECTOR")),
};

const ROLE_INFO = {
  farmer:      { icon: "🌾", color: "#1a6b3a" },
  distributor: { icon: "🚛", color: "#b45309" },
  retailer:    { icon: "🏪", color: "#c2410c" },
  inspector:   { icon: "🔬", color: "#7c3aed" },
};

const ORACLE_CROPS = [
  { name: "Wheat",  emoji: "🌾" }, { name: "Rice",   emoji: "🌾" }, { name: "Tomato", emoji: "🍅" },
  { name: "Onion",  emoji: "🧅" }, { name: "Potato", emoji: "🥔" }, { name: "Mango",  emoji: "🥭" },
  { name: "Banana", emoji: "🍌" }, { name: "Apple",  emoji: "🍎" }, { name: "Garlic", emoji: "🧄" },
  { name: "Ginger", emoji: "🫚" },
];

export default function AdminPage({ onBack }) {
  const [tab,       setTab]       = useState("dashboard");
  const [requests,  setRequests]  = useState([]);
  const [loading,   setLoading]   = useState({});
  const [manualForm, setManual]   = useState({ address: "", role: "farmer" });
  const [searchQuery, setSearch]  = useState("");
  const [selectedIds, setSelected] = useState(new Set());
  const [activityLog, setActivityLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem("admin_activity_log") || "[]"); } catch { return []; }
  });
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [confirmRevoke, setConfirmRevoke] = useState("");

  // Oracle state
  const [oraclePrices, setOraclePrices]   = useState([]);
  const [oracleLoading, setOracleLoading] = useState(false);
  const [priceForm, setPriceForm]         = useState({ crop: "Wheat", price: "" });
  const [oracleUpdating, setOracleUpdating] = useState(false);

  // System analytics (simulated from localStorage)
  const [analytics, setAnalytics] = useState({ batches: 0, transfers: 0, certs: 0 });

  useEffect(() => {
    const raw = localStorage.getItem("agrichain_requests") || "[]";
    setRequests(JSON.parse(raw));
    const certs = JSON.parse(localStorage.getItem("inspector_certs") || "[]");
    setAnalytics({ batches: "—", transfers: "—", certs: certs.length });
  }, []);

  async function loadOraclePrices() {
    if (!ORACLE_ADDRESS) { setOraclePrices([]); return; }
    setOracleLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
      const oracle   = new ethers.Contract(ORACLE_ADDRESS, PriceOracleABI.abi, provider);
      const data     = await oracle.getAllPrices();
      setOraclePrices(data.map(d => ({
        crop:      d.crop,
        price:     Number(d.priceInPaise) / 100,
        updatedAt: new Date(Number(d.updatedAt) * 1000).toLocaleString(),
      })));
    } catch (e) { toastError("Oracle not deployed yet — deploy first."); setOraclePrices([]); }
    finally { setOracleLoading(false); }
  }

  async function updateOraclePrice() {
    if (!ORACLE_ADDRESS) { toastError("Oracle not deployed yet. Run deployPriceOracle.js first."); return; }
    const priceInPaise = Math.round(parseFloat(priceForm.price) * 100);
    if (!priceForm.crop || isNaN(priceInPaise) || priceInPaise <= 0) { toastError("Enter a valid crop and price."); return; }
    const tid = toastLoading(`Updating ${priceForm.crop} price on-chain...`);
    setOracleUpdating(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const oracle = new ethers.Contract(ORACLE_ADDRESS, PriceOracleABI.abi, signer);
      const tx = await oracle.updatePrice(priceForm.crop, BigInt(priceInPaise));
      await tx.wait();
      toastDismiss(tid);
      toastSuccess(`✅ ${priceForm.crop} price updated to ₹${priceForm.price}/kg on-chain!`);
      logActivity(`💹 Updated ${priceForm.crop} price to ₹${priceForm.price}/kg`);
      setPriceForm({ crop: "Wheat", price: "" });
      loadOraclePrices();
    } catch (e) { toastDismiss(tid); toastError(e.reason || e.message); }
    finally { setOracleUpdating(false); }
  }

  async function getContractForRole(role) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    if (role === "farmer" || role === "admin")
      return new ethers.Contract(REGISTRY_ADDRESS, ProduceRegistryABI.abi, signer);
    if (role === "distributor" || role === "retailer")
      return new ethers.Contract(TRACKER_ADDRESS, TrackTransferABI.abi, signer);
    if (role === "inspector")
      return new ethers.Contract(VERIFIER_ADDRESS, QualityVerifierABI.abi, signer);
    throw new Error("Invalid role");
  }

  function logActivity(message) {
    const entry = { message, time: new Date().toLocaleTimeString(), date: new Date().toLocaleDateString() };
    const updated = [entry, ...activityLog].slice(0, 100);
    setActivityLog(updated);
    localStorage.setItem("admin_activity_log", JSON.stringify(updated));
  }

  async function approveRequest(req) {
    const tid = toastLoading(`Approving ${req.name} as ${req.role}...`);
    try {
      setLoading(l => ({ ...l, [req.id]: true }));
      const contract  = await getContractForRole(req.role);
      const roleHash  = ROLE_HASHES[req.role];
      const alreadyHas = await contract.hasRole(roleHash, req.address);
      if (!alreadyHas) {
        const tx = await contract.grantRole(roleHash, req.address);
        await tx.wait();
      }
      updateRequestStatus(req.id, "approved");
      toastDismiss(tid);
      toastSuccess(`✅ ${req.name} approved as ${req.role}!`);
      logActivity(`✅ Approved ${req.name} (${req.role}) — ${req.address.slice(0,10)}...`);
    } catch (e) {
      toastDismiss(tid); toastError(e.reason || e.message);
    } finally { setLoading(l => ({ ...l, [req.id]: false })); }
  }

  async function bulkApprove() {
    const toApprove = requests.filter(r => selectedIds.has(r.id) && r.status === "pending");
    if (toApprove.length === 0) { toastInfo("No pending requests selected."); return; }
    for (const req of toApprove) { await approveRequest(req); }
    setSelected(new Set());
  }

  function rejectRequest(id) {
    const req = requests.find(r => r.id === id);
    updateRequestStatus(id, "rejected");
    toastInfo("Request rejected.");
    if (req) logActivity(`❌ Rejected ${req.name} (${req.role})`);
  }

  function updateRequestStatus(id, status) {
    const updated = requests.map(r => r.id === id ? { ...r, status } : r);
    setRequests(updated);
    localStorage.setItem("agrichain_requests", JSON.stringify(updated));
  }

  async function grantManual() {
    if (!ethers.isAddress(manualForm.address)) { toastError("Invalid address"); return; }
    const tid = toastLoading("Processing role grant...");
    try {
      const contract = await getContractForRole(manualForm.role);
      const roleHash = ROLE_HASHES[manualForm.role];
      const tx = await contract.grantRole(roleHash, manualForm.address);
      await tx.wait();
      toastDismiss(tid);
      toastSuccess(`✅ ${manualForm.role} role granted to ${manualForm.address.slice(0,10)}...`);
      logActivity(`⚡ Granted ${manualForm.role} role to ${manualForm.address.slice(0,10)}...`);
      setManual({ address:"", role:"farmer" });
    } catch (e) { toastDismiss(tid); toastError(e.reason || e.message); }
  }

  async function revokeRole() {
    if (!revokeTarget) return;
    if (confirmRevoke !== revokeTarget.address.slice(0,6)) {
      toastError("Address confirmation mismatch. Type the first 6 chars of the address."); return;
    }
    const tid = toastLoading(`Revoking ${revokeTarget.role} from ${revokeTarget.name}...`);
    try {
      const contract = await getContractForRole(revokeTarget.role);
      const roleHash = ROLE_HASHES[revokeTarget.role];
      const tx = await contract.revokeRole(roleHash, revokeTarget.address);
      await tx.wait();
      updateRequestStatus(revokeTarget.id, "revoked");
      toastDismiss(tid);
      toastSuccess(`Role revoked from ${revokeTarget.name}.`);
      logActivity(`🚫 Revoked ${revokeTarget.role} from ${revokeTarget.name}`);
      setRevokeTarget(null); setConfirmRevoke("");
    } catch (e) { toastDismiss(tid); toastError(e.reason || e.message); }
  }

  function exportAuditCSV() {
    const rows = [["Message","Time","Date"], ...activityLog.map(e => [e.message, e.time, e.date])];
    const csv  = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "admin_audit_log.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const pending  = requests.filter(r => r.status === "pending");
  const approved = requests.filter(r => r.status === "approved");
  const rejected = requests.filter(r => r.status === "rejected");

  const filteredApproved = approved.filter(r =>
    !searchQuery || r.name?.toLowerCase().includes(searchQuery.toLowerCase())
      || r.role?.toLowerCase().includes(searchQuery.toLowerCase())
      || r.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Role distribution for chart
  const roleCounts = approved.reduce((acc, r) => { acc[r.role] = (acc[r.role] || 0) + 1; return acc; }, {});
  const chartData = {
    labels: Object.keys(roleCounts).map(r => `${ROLE_INFO[r]?.icon || ""} ${r}`),
    datasets: [{
      data: Object.values(roleCounts),
      backgroundColor: ["#1a6b3a","#b45309","#c2410c","#7c3aed","#1e40af"],
      borderWidth: 2,
      borderColor: "white",
    }],
  };

  const statusColor = { pending:"#b45309", approved:"#1a6b3a", rejected:"#dc2626", revoked:"#6b7280" };
  const statusBg    = { pending:"#fef3c7", approved:"#e8f5ee", rejected:"#fee2e2", revoked:"#f3f4f6" };

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg, #f4f6f0)", fontFamily:"'Segoe UI',sans-serif", padding:"24px" }}>
      <div style={{ maxWidth:"900px", margin:"0 auto" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px" }}>
          <div>
            <h1 style={{ fontSize:"22px", color:"#1a6b3a", margin:0 }}>🔧 Admin Panel</h1>
            <p style={{ color:"#6b7280", fontSize:"13px", margin:"4px 0 0" }}>Manage roles, view analytics, and monitor system activity</p>
          </div>
          <button onClick={onBack} style={{ background:"none", border:"1px solid #e5e1d8", borderRadius:"7px", padding:"8px 16px", fontSize:"13px", cursor:"pointer", fontFamily:"inherit" }}>← Back</button>
        </div>

        {/* Stats */}
        <div className="stats" style={{ gridTemplateColumns:"repeat(4,1fr)", marginBottom:"20px" }}>
          <StatsCard icon="📋" label="Pending"  value={pending.length}  color="#b45309" />
          <StatsCard icon="✅" label="Approved" value={approved.length} color="#1a6b3a" />
          <StatsCard icon="❌" label="Rejected" value={rejected.length} color="#dc2626" />
          <StatsCard icon="🏅" label="Certs Issued" value={analytics.certs} color="#7c3aed" />
        </div>

        {/* Tabs */}
        <div style={{ marginBottom:"16px", display:"flex", gap:"8px", flexWrap:"wrap" }}>
          {[["dashboard","📊 Dashboard"],["requests","📋 Requests"],["users","👥 Users"],["grant","⚡ Grant Role"],["oracle","💹 Price Oracle"],["log","📜 Activity Log"]].map(([key,label]) => (
            <button key={key}
              style={{
                padding:"8px 16px", borderRadius:7, fontSize:13, cursor:"pointer", fontFamily:"inherit",
                border: tab === key ? "none" : "1px solid #e5e1d8",
                background: tab === key ? "#1a6b3a" : "transparent",
                color: tab === key ? "white" : "#374151",
              }}
              onClick={() => { setTab(key); if (key === "oracle") loadOraclePrices(); }}>{label}
              {key === "requests" && pending.length > 0 && (
                <span style={{ marginLeft:6, background:"#dc2626", color:"white", borderRadius:"50%", padding:"1px 6px", fontSize:10, fontWeight:700 }}>{pending.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── DASHBOARD TAB ── */}
        {tab === "dashboard" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
            {/* Role Distribution Chart */}
            <div style={{ background:"white", border:"1px solid #e5e1d8", borderRadius:12, padding:24 }}>
              <h2 style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>👥 Role Distribution</h2>
              {Object.keys(roleCounts).length > 0 ? (
                <div style={{ maxWidth:200, margin:"0 auto" }}>
                  <Doughnut data={chartData} options={{ plugins:{ legend:{ position:"bottom", labels:{ font:{ size:11 }, padding:12 } } }, cutout:"65%" }} />
                </div>
              ) : (
                <div style={{ textAlign:"center", color:"#9ca3af", padding:40 }}>No approved users yet.</div>
              )}
            </div>

            {/* Quick Stats */}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {Object.entries(roleCounts).map(([role, count]) => (
                <div key={role} style={{ background:"white", border:"1px solid #e5e1d8", borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:24 }}>{ROLE_INFO[role]?.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, textTransform:"capitalize" }}>{role}s</div>
                    <div style={{ height:6, background:"#f0ede6", borderRadius:3, marginTop:4 }}>
                      <div style={{ height:"100%", background: ROLE_INFO[role]?.color, width:`${Math.min(100,(count/Math.max(...Object.values(roleCounts)))*100)}%`, borderRadius:3 }} />
                    </div>
                  </div>
                  <span style={{ fontSize:22, fontWeight:700, color: ROLE_INFO[role]?.color }}>{count}</span>
                </div>
              ))}
              {Object.keys(roleCounts).length === 0 && <div style={{ background:"white", border:"1px solid #e5e1d8", borderRadius:10, padding:24, textAlign:"center", color:"#9ca3af" }}>No approved users yet.</div>}
            </div>
          </div>
        )}

        {/* ── REQUESTS TAB ── */}
        {tab === "requests" && (
          <>
            {/* Pending */}
            <div style={{ background:"white", border:"1px solid #e5e1d8", borderRadius:12, marginBottom:16, overflow:"hidden" }}>
              <div style={{ padding:"14px 20px", borderBottom:"1px solid #e5e1d8", background:"#fafaf8", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <h2 style={{ fontSize:14, fontWeight:600, margin:0 }}>
                  📋 Pending Requests ({pending.length})
                  {pending.length > 0 && <span style={{ marginLeft:8, background:"#dc2626", color:"white", borderRadius:"50%", padding:"1px 6px", fontSize:10 }}>{pending.length}</span>}
                </h2>
                {selectedIds.size > 0 && (
                  <button onClick={bulkApprove} style={{ background:"#1a6b3a", color:"white", border:"none", borderRadius:7, padding:"6px 14px", fontSize:12, cursor:"pointer" }}>
                    ✅ Approve Selected ({selectedIds.size})
                  </button>
                )}
              </div>
              {pending.length === 0 ? (
                <div style={{ padding:28, textAlign:"center", color:"#9ca3af", fontSize:13 }}>No pending requests 🎉</div>
              ) : (
                pending.map(req => (
                  <div key={req.id} style={{ padding:"14px 20px", borderBottom:"1px solid #f0ede6", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                    <input type="checkbox" checked={selectedIds.has(req.id)}
                      onChange={e => setSelected(s => { const n = new Set(s); e.target.checked ? n.add(req.id) : n.delete(req.id); return n; })}
                      style={{ width:16, height:16, accentColor:"#1a6b3a", cursor:"pointer" }}
                    />
                    <div style={{ flex:1, minWidth:200 }}>
                      <div style={{ fontWeight:600, fontSize:13 }}>{req.name}</div>
                      <div style={{ fontSize:11, color:"#6b7280", margin:"2px 0" }}>{req.farmLocation} · {req.phone}</div>
                      <div style={{ fontSize:11, fontFamily:"monospace", color:"#374151", wordBreak:"break-all" }}>{req.address}</div>
                    </div>
                    <span style={{ background: statusBg[req.status], color: statusColor[req.status], padding:"3px 10px", borderRadius:4, fontSize:11, fontWeight:500 }}>
                      {ROLE_INFO[req.role]?.icon} {req.role}
                    </span>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={() => approveRequest(req)} disabled={loading[req.id]}
                        style={{ background:"#1a6b3a", color:"white", border:"none", borderRadius:6, padding:"7px 16px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                        {loading[req.id] ? "..." : "✅ Approve"}
                      </button>
                      <button onClick={() => rejectRequest(req.id)}
                        style={{ background:"#dc2626", color:"white", border:"none", borderRadius:6, padding:"7px 16px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>❌ Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <div style={{ background:"white", border:"1px solid #e5e1d8", borderRadius:12, overflow:"hidden" }}>
            <div style={{ padding:"14px 20px", borderBottom:"1px solid #e5e1d8", background:"#fafaf8", display:"flex", gap:12, alignItems:"center" }}>
              <h2 style={{ fontSize:14, fontWeight:600, margin:0 }}>✅ Approved Users ({approved.length})</h2>
              <input
                value={searchQuery} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, role, address..."
                style={{ flex:1, padding:"6px 12px", border:"1px solid #e5e1d8", borderRadius:7, fontSize:12, outline:"none", background:"#fafaf8" }}
              />
            </div>
            {filteredApproved.length === 0 ? (
              <div style={{ padding:28, textAlign:"center", color:"#9ca3af", fontSize:13 }}>No approved users match your search.</div>
            ) : (
              filteredApproved.map(req => (
                <div key={req.id} style={{ padding:"12px 20px", borderBottom:"1px solid #f0ede6", display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ fontSize:22 }}>{ROLE_INFO[req.role]?.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>{req.name}</div>
                    <div style={{ fontSize:11, color:"#6b7280" }}>{req.farmLocation}</div>
                    <div style={{ fontSize:10, fontFamily:"monospace", color:"#6b7280" }}>{req.address}</div>
                  </div>
                  <span style={{ background:"#e8f5ee", color:"#1a6b3a", padding:"3px 10px", borderRadius:4, fontSize:11 }}>{req.role}</span>
                  <span style={{ background:"#d1fae5", color:"#065f46", padding:"3px 10px", borderRadius:4, fontSize:11 }}>Active</span>
                  <button onClick={() => { setRevokeTarget(req); setConfirmRevoke(""); }}
                    style={{ background:"#fee2e2", color:"#dc2626", border:"1px solid #fca5a5", borderRadius:6, padding:"5px 12px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                    🚫 Revoke
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── GRANT TAB ── */}
        {tab === "grant" && (
          <div style={{ background:"white", border:"1px solid #e5e1d8", borderRadius:12, overflow:"hidden" }}>
            <div style={{ padding:"14px 20px", borderBottom:"1px solid #e5e1d8", background:"#fafaf8" }}>
              <h2 style={{ fontSize:14, fontWeight:600, margin:0 }}>⚡ Grant Role Directly</h2>
            </div>
            <div style={{ padding:20 }}>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr auto", gap:10, alignItems:"flex-end" }}>
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:5 }}>Wallet Address</label>
                  <input value={manualForm.address} onChange={e => setManual(f => ({ ...f, address: e.target.value }))}
                    placeholder="0x..." style={{ width:"100%", padding:"9px 12px", border:"1px solid #e5e1d8", borderRadius:7, fontSize:12, fontFamily:"monospace", background:"#fafaf8", outline:"none", boxSizing:"border-box" }} />
                </div>
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:5 }}>Role</label>
                  <select value={manualForm.role} onChange={e => setManual(f => ({ ...f, role: e.target.value }))}
                    style={{ width:"100%", padding:"9px 12px", border:"1px solid #e5e1d8", borderRadius:7, fontSize:13, fontFamily:"inherit", background:"#fafaf8", outline:"none" }}>
                    <option value="farmer">🌾 Farmer</option>
                    <option value="distributor">🚛 Distributor</option>
                    <option value="retailer">🏪 Retailer</option>
                    <option value="inspector">🔬 Inspector</option>
                  </select>
                </div>
                <button onClick={grantManual}
                  style={{ background:"#1a6b3a", color:"white", border:"none", borderRadius:7, padding:"9px 18px", fontSize:13, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                  Grant ⬡
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ORACLE TAB ── */}
        {tab === "oracle" && (
          <div>
            <style>{`@keyframes oraclePulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
            {!ORACLE_ADDRESS && (
              <div style={{ background:"#fef9c3", border:"1px solid #fde047", borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:13, color:"#92400e" }}>
                ⚠️ <strong>Price Oracle not deployed yet.</strong> Run <code style={{ background:"#fef3c7", padding:"1px 6px", borderRadius:4 }}>npx hardhat run scripts/deployPriceOracle.js --network sepolia</code> then paste the address into <code>addresses.js</code> as <code>ORACLE_ADDRESS</code>.
              </div>
            )}

            {/* Update Price Form */}
            <div style={{ background:"white", border:"1px solid #e5e1d8", borderRadius:12, padding:20, marginBottom:16 }}>
              <h2 style={{ fontSize:14, fontWeight:700, marginBottom:16, color:"#1a6b3a" }}>💹 Update Commodity Price On-Chain</h2>
              <p style={{ fontSize:12, color:"#6b7280", marginBottom:16 }}>Prices are stored on the Sepolia blockchain and read by all farmer dashboards in real-time.</p>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 2fr auto", gap:10, alignItems:"flex-end" }}>
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:5 }}>Crop</label>
                  <select value={priceForm.crop} onChange={e => setPriceForm(f => ({ ...f, crop: e.target.value }))}
                    style={{ width:"100%", padding:"9px 12px", border:"1px solid #e5e1d8", borderRadius:7, fontSize:13, fontFamily:"inherit", background:"#fafaf8", outline:"none" }}>
                    {ORACLE_CROPS.map(c => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#374151", marginBottom:5 }}>New Price (₹/kg)</label>
                  <input type="number" value={priceForm.price} onChange={e => setPriceForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="e.g. 25.50"
                    style={{ width:"100%", padding:"9px 12px", border:"1px solid #e5e1d8", borderRadius:7, fontSize:13, background:"#fafaf8", outline:"none", boxSizing:"border-box" }} />
                </div>
                <button onClick={updateOraclePrice} disabled={oracleUpdating || !ORACLE_ADDRESS}
                  style={{ background:oracleUpdating || !ORACLE_ADDRESS ? "#9ca3af" : "#1a6b3a", color:"white", border:"none", borderRadius:7, padding:"9px 18px", fontSize:13, cursor: oracleUpdating || !ORACLE_ADDRESS ? "not-allowed" : "pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                  {oracleUpdating ? "Updating..." : "Update ⬡"}
                </button>
              </div>
            </div>

            {/* Current Prices Table */}
            <div style={{ background:"white", border:"1px solid #e5e1d8", borderRadius:12, overflow:"hidden" }}>
              <div style={{ padding:"14px 20px", borderBottom:"1px solid #e5e1d8", background:"#fafaf8", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <h2 style={{ fontSize:14, fontWeight:600, margin:0 }}>📊 Current On-Chain Prices</h2>
                <button onClick={loadOraclePrices} disabled={oracleLoading}
                  style={{ background:"none", border:"1px solid #e5e1d8", borderRadius:7, padding:"5px 12px", fontSize:12, cursor:"pointer" }}>
                  {oracleLoading ? "Loading..." : "🔄 Refresh"}
                </button>
              </div>
              {oracleLoading ? (
                <div style={{ padding:28, textAlign:"center", color:"#9ca3af" }}>Loading from blockchain...</div>
              ) : oraclePrices.length === 0 ? (
                <div style={{ padding:28, textAlign:"center", color:"#9ca3af", fontSize:13 }}>
                  {ORACLE_ADDRESS ? "No prices loaded yet. Click Refresh." : "Deploy oracle contract first."}
                </div>
              ) : (
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"#f8f7f2" }}>
                      {["Crop","Price (₹/kg)","Last Updated","Action"].map(h => (
                        <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.5px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {oraclePrices.map((p, i) => (
                      <tr key={i} style={{ borderBottom:"1px solid #f0ede6" }}>
                        <td style={{ padding:"10px 16px", fontSize:13, fontWeight:600 }}>
                          {ORACLE_CROPS.find(c => c.name.toLowerCase() === p.crop.toLowerCase())?.emoji || "🌿"} {p.crop}
                        </td>
                        <td style={{ padding:"10px 16px" }}>
                          <span style={{ background:"#e8f5ee", color:"#1a6b3a", padding:"3px 10px", borderRadius:4, fontSize:12, fontWeight:700 }}>₹{p.price.toFixed(2)}</span>
                        </td>
                        <td style={{ padding:"10px 16px", fontSize:11, color:"#6b7280" }}>{p.updatedAt}</td>
                        <td style={{ padding:"10px 16px" }}>
                          <button onClick={() => setPriceForm({ crop: p.crop, price: p.price.toString() })}
                            style={{ background:"none", border:"1px solid #e5e1d8", borderRadius:6, padding:"4px 10px", fontSize:11, cursor:"pointer", color:"#374151" }}>✏️ Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── ACTIVITY LOG TAB ── */}
        {tab === "log" && (
          <div style={{ background:"white", border:"1px solid #e5e1d8", borderRadius:12, overflow:"hidden" }}>
            <div style={{ padding:"14px 20px", borderBottom:"1px solid #e5e1d8", background:"#fafaf8", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <h2 style={{ fontSize:14, fontWeight:600, margin:0 }}>📜 Admin Activity Log</h2>
              <button onClick={exportAuditCSV}
                style={{ background:"none", border:"1px solid #e5e1d8", borderRadius:7, padding:"5px 12px", fontSize:12, cursor:"pointer" }}>
                ⬇️ Export CSV
              </button>
            </div>
            {activityLog.length === 0 ? (
              <div style={{ padding:28, textAlign:"center", color:"#9ca3af", fontSize:13 }}>No activity logged yet.</div>
            ) : (
              activityLog.map((entry, i) => (
                <div key={i} style={{ padding:"10px 20px", borderBottom:"1px solid #f0ede6", display:"flex", gap:12, alignItems:"center" }}>
                  <span style={{ fontSize:11, color:"#9ca3af", whiteSpace:"nowrap" }}>{entry.date} {entry.time}</span>
                  <span style={{ fontSize:13 }}>{entry.message}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── REVOKE CONFIRMATION MODAL ── */}
        {revokeTarget && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:3000 }}
            onClick={() => setRevokeTarget(null)}>
            <div style={{ background:"white", borderRadius:14, padding:28, maxWidth:400, width:"90%", border:"2px solid #fca5a5" }} onClick={e => e.stopPropagation()}>
              <div style={{ textAlign:"center", marginBottom:16 }}>
                <div style={{ fontSize:36 }}>⚠️</div>
                <h3 style={{ fontSize:16, fontWeight:700, color:"#dc2626" }}>Confirm Role Revocation</h3>
                <p style={{ fontSize:13, color:"#6b7280", marginTop:6 }}>You are about to revoke the <strong>{revokeTarget.role}</strong> role from <strong>{revokeTarget.name}</strong>. This action will be recorded on the blockchain.</p>
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:12, fontWeight:600, color:"#374151", display:"block", marginBottom:5 }}>
                  Type the first 6 characters of the address ({revokeTarget.address.slice(0,6)}) to confirm:
                </label>
                <input value={confirmRevoke} onChange={e => setConfirmRevoke(e.target.value)}
                  placeholder={revokeTarget.address.slice(0,6)}
                  style={{ width:"100%", padding:"9px 12px", border:"1px solid #fca5a5", borderRadius:7, fontSize:13, fontFamily:"monospace", outline:"none", boxSizing:"border-box" }}
                />
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={revokeRole}
                  disabled={confirmRevoke !== revokeTarget.address.slice(0,6)}
                  style={{ flex:1, background: confirmRevoke === revokeTarget.address.slice(0,6) ? "#dc2626" : "#9ca3af", color:"white", border:"none", borderRadius:7, padding:"10px", fontSize:13, cursor: confirmRevoke === revokeTarget.address.slice(0,6) ? "pointer" : "not-allowed", fontFamily:"inherit" }}>
                  🚫 Revoke Role
                </button>
                <button onClick={() => { setRevokeTarget(null); setConfirmRevoke(""); }}
                  style={{ flex:1, background:"none", border:"1px solid #e5e1d8", borderRadius:7, padding:"10px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}