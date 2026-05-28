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

  // Blockchain role holders
  const [chainUsers, setChainUsers]         = useState([]);
  const [chainLoading, setChainLoading]     = useState(false);
  const [userSearchQ, setUserSearchQ]       = useState("");

  /* ── read requests from localStorage (called on mount + on demand) ── */
  function refreshRequests() {
    const raw = localStorage.getItem("agrichain_requests") || "[]";
    setRequests(JSON.parse(raw));
  }

  useEffect(() => {
    refreshRequests();
    const certs = JSON.parse(localStorage.getItem("inspector_certs") || "[]");
    setAnalytics({ batches: "—", transfers: "—", certs: certs.length });

    // Refresh requests when another tab writes to localStorage (cross-tab)
    function onStorage(e) {
      if (e.key === "agrichain_requests") refreshRequests();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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

  /* ── Load all on-chain role holders ── */
  async function loadChainUsers() {
    setChainLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
      const registry = new ethers.Contract(REGISTRY_ADDRESS, ProduceRegistryABI.abi, provider);
      const tracker  = new ethers.Contract(TRACKER_ADDRESS,  TrackTransferABI.abi,   provider);
      const verifier = new ethers.Contract(VERIFIER_ADDRESS, QualityVerifierABI.abi, provider);

      // Limit block range — Sepolia public RPCs reject queries > ~100k blocks
      const latest    = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latest - 99000);

      const ROLE_MAP = [
        { role: "farmer",      hash: ROLE_HASHES.farmer,      contract: registry },
        { role: "distributor", hash: ROLE_HASHES.distributor, contract: tracker  },
        { role: "retailer",    hash: ROLE_HASHES.retailer,    contract: tracker  },
        { role: "inspector",   hash: ROLE_HASHES.inspector,   contract: verifier },
      ];

      const seen   = new Set();
      const result = [];
      const storedReqs = JSON.parse(localStorage.getItem("agrichain_requests") || "[]");

      // ── Pass 1: Query recent RoleGranted events ──
      for (const { role, hash, contract } of ROLE_MAP) {
        try {
          const filter = contract.filters.RoleGranted(hash, null, null);
          const events = await contract.queryFilter(filter, fromBlock, "latest");
          for (const ev of events) {
            const addr = ev.args.account.toLowerCase();
            const key  = `${role}:${addr}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const stillHas = await contract.hasRole(hash, addr).catch(() => false);
            if (!stillHas) continue;
            const req = storedReqs.find(r => r.address?.toLowerCase() === addr && r.role === role);
            result.push({ address: addr, role, name: req?.name || "—", location: req?.farmLocation || "—", source: "event" });
          }
        } catch (err) {
          console.warn(`Event query failed for ${role}:`, err.message);
        }
      }

      // ── Pass 2: Check all localStorage-approved addresses (catches old events outside block range) ──
      const approvedReqs = storedReqs.filter(r => r.status === "approved" && ROLE_HASHES[r.role]);
      for (const req of approvedReqs) {
        const addr = req.address?.toLowerCase();
        if (!addr) continue;
        const role = req.role;
        const key  = `${role}:${addr}`;
        if (seen.has(key)) continue; // already found via events
        const { contract, hash } = (() => {
          if (role === "farmer")      return { contract: registry, hash: ROLE_HASHES.farmer };
          if (role === "distributor") return { contract: tracker,  hash: ROLE_HASHES.distributor };
          if (role === "retailer")    return { contract: tracker,  hash: ROLE_HASHES.retailer };
          if (role === "inspector")   return { contract: verifier, hash: ROLE_HASHES.inspector };
          return {};
        })();
        if (!contract) continue;
        const stillHas = await contract.hasRole(hash, addr).catch(() => false);
        if (!stillHas) continue;
        seen.add(key);
        result.push({ address: addr, role, name: req.name || "—", location: req.farmLocation || "—", source: "local" });
      }

      setChainUsers(result);
      toastSuccess(`✅ Found ${result.length} active role holder(s) on-chain.`);
    } catch (e) {
      toastError("Failed to load blockchain roles: " + (e.message || ""));
    } finally {
      setChainLoading(false);
    }
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
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const roleHash = ROLE_HASHES[req.role];

      if (req.role === "inspector") {
        // Inspector needs role on ALL 3 contracts so login + certificate both work
        const registry = new ethers.Contract(REGISTRY_ADDRESS, ProduceRegistryABI.abi, signer);
        const tracker  = new ethers.Contract(TRACKER_ADDRESS,  TrackTransferABI.abi,   signer);
        const verifier = new ethers.Contract(VERIFIER_ADDRESS, QualityVerifierABI.abi, signer);
        for (const c of [registry, tracker, verifier]) {
          try {
            const tx = await c.grantRole(roleHash, req.address);
            await tx.wait();
          } catch (err) {
            const msg = (err.reason || err.message || "").toLowerCase();
            if (msg.includes("already granted") || msg.includes("already")) continue;
            throw err; // real error — propagate
          }
        }
      } else {
        const contract = await getContractForRole(req.role);
        const alreadyHas = await contract.hasRole(roleHash, req.address);
        if (!alreadyHas) { const tx = await contract.grantRole(roleHash, req.address); await tx.wait(); }
      }

      updateRequestStatus(req.id, "approved");
      toastDismiss(tid);
      toastSuccess(`✅ ${req.name} approved as ${req.role}!`);
      logActivity(`✅ Approved ${req.name} (${req.role}) — ${req.address.slice(0,10)}...`);
    } catch (e) {
      toastDismiss(tid); toastError(e.reason || e.message);
    } finally { setLoading(l => ({ ...l, [req.id]: false })); }
  }

  /* ── Repair: grant inspector role on QualityVerifier for an address that
     already has it on registry/tracker but is missing it on verifier ── */
  async function grantInspectorOnVerifier(address) {
    if (!ethers.isAddress(address)) { toastError("Invalid address"); return; }
    const tid = toastLoading("Granting INSPECTOR on QualityVerifier...");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer   = await provider.getSigner();
      const roleHash = ROLE_HASHES.inspector;
      // Grant on all 3
      const registry = new ethers.Contract(REGISTRY_ADDRESS, ProduceRegistryABI.abi, signer);
      const tracker  = new ethers.Contract(TRACKER_ADDRESS,  TrackTransferABI.abi,   signer);
      const verifier = new ethers.Contract(VERIFIER_ADDRESS, QualityVerifierABI.abi, signer);
      for (const c of [registry, tracker, verifier]) {
        try {
          const tx = await c.grantRole(roleHash, address);
          await tx.wait();
        } catch (err) {
          const msg = (err.reason || err.message || "").toLowerCase();
          if (msg.includes("already granted") || msg.includes("already")) continue; // already granted = OK
          throw err; // real error
        }
      }
      toastDismiss(tid);
      toastSuccess(`✅ INSPECTOR role granted on all contracts for ${address.slice(0,10)}...`);
      logActivity(`🔧 Re-granted INSPECTOR on all contracts for ${address.slice(0,10)}...`);
    } catch (e) { toastDismiss(tid); toastError(e.reason || e.message); }
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
    const displayName = revokeTarget.name && revokeTarget.name !== "—" ? revokeTarget.name : revokeTarget.address.slice(0,10)+"...";
    const tid = toastLoading(`Revoking ${revokeTarget.role} from ${displayName}...`);
    try {
      const contract = await getContractForRole(revokeTarget.role);
      const roleHash = ROLE_HASHES[revokeTarget.role];
      const tx = await contract.revokeRole(roleHash, revokeTarget.address);
      await tx.wait();
      // Update localStorage request if exists
      if (revokeTarget.id) updateRequestStatus(revokeTarget.id, "revoked");
      // Remove from chain users list
      setChainUsers(u => u.filter(x => !(x.address === revokeTarget.address && x.role === revokeTarget.role)));
      toastDismiss(tid);
      toastSuccess(`🚫 Role revoked from ${displayName}.`);
      logActivity(`🚫 Revoked ${revokeTarget.role} from ${displayName} (${revokeTarget.address.slice(0,10)}...)`);
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
          {[["dashboard","📊 Dashboard"],["requests","📋 Requests"],["users","👥 Users"],["oracle","💹 Price Oracle"],["log","📜 Activity Log"]].map(([key,label]) => (
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

              {/* Inspector Role Management */}
              <div style={{ background:"white", border:"2px solid #dc2626", borderRadius:10, padding:"14px 16px" }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:4, color:"#991b1b", display:"flex", alignItems:"center", gap:8 }}>
                  🔧 Fix Inspector Access
                  <span style={{ background:"#fee2e2", color:"#dc2626", fontSize:10, padding:"2px 7px", borderRadius:20, fontWeight:600 }}>REPAIR TOOL</span>
                </div>
                <div style={{ fontSize:11, color:"#6b7280", marginBottom:10 }}>
                  If an inspector sees <strong>"AccessControl: missing role"</strong>, paste their wallet below and click Grant. 
                  This grants INSPECTOR role on <em>all 3 contracts</em>.
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <input
                    id="fix-inspector-addr"
                    placeholder="0x... inspector wallet address"
                    style={{ flex:1, padding:"8px 10px", border:"1px solid #f87171", borderRadius:7, fontSize:12, fontFamily:"monospace", outline:"none", background:"#fff5f5" }}
                  />
                  <button
                    onClick={() => {
                      const addr = document.getElementById("fix-inspector-addr").value.trim();
                      grantInspectorOnVerifier(addr);
                    }}
                    style={{ background:"#dc2626", color:"white", border:"none", borderRadius:7, padding:"8px 14px", fontSize:12, cursor:"pointer", fontFamily:"inherit", fontWeight:600, whiteSpace:"nowrap" }}>
                    ⚡ Grant Role
                  </button>
                </div>
                <div style={{ marginTop:10, borderTop:"1px solid #fee2e2", paddingTop:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontSize:11, color:"#6b7280" }}>Also clears local cert archive:</div>
                  <button
                    onClick={() => {
                      if (window.confirm("Reset all local inspector certificate records?")) {
                        localStorage.removeItem("inspector_certs");
                        setAnalytics(a => ({ ...a, certs: 0 }));
                        toastSuccess("✅ Inspector cert archive reset.");
                        logActivity("🔬 Admin reset inspector certificate archive");
                      }
                    }}
                    style={{ background:"#fef9c3", color:"#92400e", border:"1px solid #fde047", borderRadius:7, padding:"5px 12px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                    🗑️ Reset Certs to 0
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── REQUESTS TAB ── */}
        {tab === "requests" && (
          <>
            {/* Pending */}
            <div style={{ background:"white", border:"1px solid #e5e1d8", borderRadius:12, marginBottom:16, overflow:"hidden" }}>
              <div style={{ padding:"14px 20px", borderBottom:"1px solid #e5e1d8", background:"#fafaf8", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                <h2 style={{ fontSize:14, fontWeight:600, margin:0 }}>
                  📋 Pending Requests ({pending.length})
                  {pending.length > 0 && <span style={{ marginLeft:8, background:"#dc2626", color:"white", borderRadius:"50%", padding:"1px 6px", fontSize:10 }}>{pending.length}</span>}
                </h2>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <button onClick={refreshRequests}
                    style={{ background:"#f0f9ff", color:"#0369a1", border:"1px solid #bae6fd", borderRadius:7,
                      padding:"5px 12px", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                    🔄 Refresh
                  </button>
                  {selectedIds.size > 0 && (
                    <button onClick={bulkApprove} style={{ background:"#1a6b3a", color:"white", border:"none", borderRadius:7, padding:"6px 14px", fontSize:12, cursor:"pointer" }}>
                      ✅ Approve Selected ({selectedIds.size})
                    </button>
                  )}
                </div>
              </div>
              {pending.length === 0 ? (
                <div style={{ padding:28, textAlign:"center", color:"#9ca3af", fontSize:13 }}>
                  <div>No pending requests 🎉</div>
                  <button onClick={refreshRequests} style={{ marginTop:10, background:"none", border:"1px solid #d1d5db",
                    borderRadius:6, padding:"4px 12px", fontSize:11, cursor:"pointer", color:"#6b7280" }}>
                    🔄 Click to check for new requests
                  </button>
                </div>
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
            {/* Header */}
            <div style={{ padding:"14px 20px", borderBottom:"1px solid #e5e1d8", background:"#fafaf8", display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
              <h2 style={{ fontSize:14, fontWeight:600, margin:0 }}>
                ⛓️ On-Chain Role Holders
                {chainUsers.length > 0 && (
                  <span style={{ marginLeft:8, background:"#1a6b3a", color:"white", borderRadius:"50%", padding:"1px 7px", fontSize:11 }}>{chainUsers.length}</span>
                )}
              </h2>
              <input
                value={userSearchQ} onChange={e => setUserSearchQ(e.target.value)}
                placeholder="Search by name, role, address..."
                style={{ flex:1, minWidth:160, padding:"6px 12px", border:"1px solid #e5e1d8", borderRadius:7, fontSize:12, outline:"none", background:"#fafaf8" }}
              />
              <button onClick={loadChainUsers} disabled={chainLoading}
                style={{ background:"#1a6b3a", color:"white", border:"none", borderRadius:7, padding:"7px 16px", fontSize:12, cursor:chainLoading?"not-allowed":"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                {chainLoading ? "⏳ Loading..." : "🔄 Load from Blockchain"}
              </button>
            </div>

            {/* Info */}
            <div style={{ padding:"10px 20px", background:"#eff6ff", borderBottom:"1px solid #dbeafe", fontSize:12, color:"#1e40af" }}>
              ℹ️ Click <strong>"Load from Blockchain"</strong> to fetch all addresses with active on-chain roles. <strong>Revoke</strong> removes the role from the smart contract permanently.
            </div>

            {/* Loading */}
            {chainLoading && (
              <div style={{ padding:32, textAlign:"center", color:"#6b7280", fontSize:13 }}>
                <div style={{ fontSize:28, marginBottom:10 }}>⏳</div>
                Querying blockchain events... this may take a moment.
              </div>
            )}

            {/* Empty */}
            {!chainLoading && chainUsers.length === 0 && (
              <div style={{ padding:40, textAlign:"center" }}>
                <div style={{ fontSize:40, opacity:.35, marginBottom:10 }}>⛓️</div>
                <div style={{ fontSize:14, fontWeight:600, color:"#374151", marginBottom:6 }}>No blockchain roles loaded</div>
                <div style={{ fontSize:12, color:"#9ca3af" }}>Click "Load from Blockchain" to see all active role holders.</div>
              </div>
            )}

            {/* Table */}
            {!chainLoading && chainUsers.length > 0 && (() => {
              const filtered = chainUsers.filter(u =>
                !userSearchQ ||
                u.name?.toLowerCase().includes(userSearchQ.toLowerCase()) ||
                u.role?.toLowerCase().includes(userSearchQ.toLowerCase()) ||
                u.address?.toLowerCase().includes(userSearchQ.toLowerCase())
              );
              if (filtered.length === 0) return (
                <div style={{ padding:24, textAlign:"center", color:"#9ca3af", fontSize:13 }}>No users match your search.</div>
              );
              return (
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr style={{ background:"#f8f7f2" }}>
                        {["Role","Name / Location","Wallet Address","Status","Action"].map(h => (
                          <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.5px", whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((u, i) => (
                        <tr key={i} style={{ borderBottom:"1px solid #f0ede6" }}>
                          <td style={{ padding:"12px 16px" }}>
                            <span style={{ display:"inline-flex", alignItems:"center", gap:6,
                              background: (ROLE_INFO[u.role]?.color || "#6b7280")+"18",
                              color: ROLE_INFO[u.role]?.color || "#6b7280",
                              padding:"4px 10px", borderRadius:20, fontSize:12, fontWeight:700 }}>
                              {ROLE_INFO[u.role]?.icon} {u.role.charAt(0).toUpperCase()+u.role.slice(1)}
                            </span>
                          </td>
                          <td style={{ padding:"12px 16px" }}>
                            <div style={{ fontWeight:600, fontSize:13, color:"#1a2e1a" }}>
                              {u.name && u.name !== "—" ? u.name : <span style={{ color:"#9ca3af", fontStyle:"italic" }}>Unknown</span>}
                            </div>
                            {u.location && u.location !== "—" && <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>{u.location}</div>}
                          </td>
                          <td style={{ padding:"12px 16px" }}>
                            <span style={{ fontFamily:"monospace", fontSize:11, color:"#374151", background:"#f3f4f6", padding:"3px 8px", borderRadius:6 }}>
                              {u.address.slice(0,10)}...{u.address.slice(-6)}
                            </span>
                          </td>
                          <td style={{ padding:"12px 16px" }}>
                            <span style={{ background:"#d1fae5", color:"#065f46", padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>✓ Active</span>
                          </td>
                          <td style={{ padding:"12px 16px" }}>
                            <button
                              onClick={() => { setRevokeTarget({ ...u, id: null }); setConfirmRevoke(""); }}
                              style={{ background:"#fee2e2", color:"#dc2626", border:"1px solid #fca5a5", borderRadius:6, padding:"6px 14px", fontSize:11, cursor:"pointer", fontFamily:"inherit", fontWeight:600, transition:"all 0.2s" }}
                              onMouseOver={e => e.currentTarget.style.background="#fecaca"}
                              onMouseOut={e => e.currentTarget.style.background="#fee2e2"}>
                              🚫 Revoke Role
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
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