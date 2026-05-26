import { useState, useEffect } from "react";
import FarmerPage      from "./pages/FarmerPage";
import DistributorPage from "./pages/DistributorPage";
import RetailerPage    from "./pages/RetailerPage";
import CustomerPage    from "./pages/CustomerPage";
import InspectorPage   from "./pages/InspectorPage";
import LoginPage       from "./pages/LoginPage";
import RegisterPage    from "./pages/RegisterPage";
import AdminPage       from "./pages/AdminPage";
import HomePage        from "./pages/HomePage";
import PublicTracePage from "./pages/PublicTracePage";
import { loadSession, clearSession, getRoleFromChain, switchNetwork } from "./utils/auth";
import ToastProvider   from "./components/ToastProvider";
import DarkModeToggle  from "./components/DarkModeToggle";
import "./App.css";

const ROLE_LABELS = {
  farmer:      { label: "🌾 Farmer",      color: "#1a6b3a" },
  distributor: { label: "🚛 Distributor", color: "#b45309" },
  retailer:    { label: "🏪 Retailer",    color: "#c2410c" },
  customer:    { label: "👤 Customer",    color: "#1d4ed8" },
  inspector:   { label: "🔬 Inspector",   color: "#7c3aed" },
  admin:       { label: "🔧 Admin",       color: "#374151" },
};

export default function App() {
  const [session, setSession]               = useState(null);
  const [page,    setPage]                  = useState("home");
  const [loading, setLoading]               = useState(true);
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [publicBatchId, setPublicBatchId]   = useState("");

  useEffect(() => {
    // ── Detect ?batch= QR scan param ──────────────────────────────────
    const params = new URLSearchParams(window.location.search);
    const qrBatch = params.get("batch");
    if (qrBatch) {
      setPublicBatchId(qrBatch);
      setPage("public-trace");
    }
    // ────────────────────────────────────────────────────────────────
    initApp();
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", () => {
        clearSession(); setSession(null); setPage("home");
      });
      window.ethereum.on("chainChanged", () => initApp());
    }
    // Apply saved dark mode
    if (localStorage.getItem("agrichain_dark") === "1") {
      document.body.classList.add("dark");
    }
  }, []);

  async function initApp() {
    try {
      const existing = loadSession();
      if (!existing) { setLoading(false); return; }

      if (window.ethereum) {
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        if (chainId !== "0xaa36a7" && chainId !== "0xAA36A7") {
          setIsWrongNetwork(true); setSession(existing); setLoading(false); return;
        }
        setIsWrongNetwork(false);
        const liveRole = await getRoleFromChain(existing.account);
        if (liveRole && liveRole !== "unknown") {
          const updated = { ...existing, role: liveRole };
          localStorage.setItem("agrichain_session", JSON.stringify(updated));
          setSession(updated);
        } else {
          setSession(existing);
        }
      } else {
        setSession(existing);
      }
    } catch (e) {
      console.error("Session init error:", e); clearSession();
    } finally { setLoading(false); }
  }

  function handleLogin(newSession) { setIsWrongNetwork(false); setSession(newSession); }

  function handleLogout() {
    clearSession(); setSession(null); setIsWrongNetwork(false); setPage("home");
  }

  function shortAddress(addr) { return addr?.slice(0, 6) + "…" + addr?.slice(-4); }

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg,#f4f6f0)", fontFamily:"'Segoe UI',sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:14, animation:"tl-pulse 1.5s infinite" }}>🌾</div>
        <div style={{ color:"#1a6b3a", fontSize:14, fontWeight:500 }}>Verifying identity on blockchain...</div>
        <div style={{ marginTop:10, display:"flex", justifyContent:"center", gap:4 }}>
          {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"#1a6b3a", animation:`pulse 1.2s ease ${i*0.2}s infinite` }} />)}
        </div>
      </div>
      <style>{`
        @keyframes tl-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
        @keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}
      `}</style>
    </div>
  );

  if (isWrongNetwork) return (
    <div style={{ minHeight:"100vh", background:"radial-gradient(circle at center, #1b3d22 0%, #0d1f11 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"'Segoe UI',sans-serif", color:"white" }}>
      <div style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderRadius:24, padding:"40px 32px", maxWidth:460, width:"100%", textAlign:"center", border:"1px solid rgba(255,255,255,0.15)", boxShadow:"0 25px 50px -12px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize:64, marginBottom:20, display:"inline-block", animation:"tl-pulse 2s infinite" }}>⛓️</div>
        <h2 style={{ fontSize:26, fontWeight:700, marginBottom:12, background:"linear-gradient(90deg,#ffc73c,#ff8c3b)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Wrong Network</h2>
        <p style={{ color:"rgba(255,255,255,0.75)", fontSize:14, lineHeight:1.6, marginBottom:28 }}>
          AgriChain runs on <strong>Sepolia Testnet</strong>. Please switch your MetaMask network to continue.
        </p>
        <button
          onClick={async () => { try { await switchNetwork(); setIsWrongNetwork(false); initApp(); } catch (e) { console.error(e); } }}
          style={{ background:"linear-gradient(135deg,#1a6b3a,#114a28)", color:"white", border:"none", borderRadius:12, padding:"14px 36px", fontSize:15, fontWeight:600, cursor:"pointer", boxShadow:"0 10px 20px rgba(26,107,58,0.3)", transition:"all 0.3s", width:"100%", marginBottom:16 }}
          onMouseOver={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 15px 25px rgba(26,107,58,0.5)"; }}
          onMouseOut={e  => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 10px 20px rgba(26,107,58,0.3)"; }}
        >🦊 Switch to Sepolia Testnet</button>
        <button onClick={handleLogout} style={{ background:"transparent", color:"rgba(255,255,255,0.55)", border:"none", cursor:"pointer", fontSize:13, textDecoration:"underline", fontFamily:"inherit" }}>
          Or log out
        </button>
      </div>
      <style>{`@keyframes tl-pulse{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.08);opacity:1}}`}</style>
    </div>
  );

  if (!session) {
    if (page === "register")     return <RegisterPage onBack={() => setPage("home")} />;
    if (page === "admin")        return <AdminPage    onBack={() => setPage("home")} />;
    if (page === "public-trace") return (
      <PublicTracePage
        initialBatchId={publicBatchId}
        onSignIn={() => setPage("login")}
        onBack={() => { setPage("home"); window.history.replaceState({}, "", window.location.pathname); }}
      />
    );
    if (page === "login")        return (
      <LoginPage onLogin={handleLogin} onRegister={() => setPage("register")} onAdmin={() => setPage("admin")} onBack={() => setPage("home")} />
    );
    return <HomePage onSignIn={() => setPage("login")} onRegister={() => setPage("register")} onTrace={(id) => { setPublicBatchId(id); setPage("public-trace"); }} />;
  }

  const roleInfo  = ROLE_LABELS[session.role];
  const expiresIn = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000 / 60 / 60));

  return (
    <div className="app">
      <ToastProvider />
      <header className="header">
        <h1>🌾 AgriChain</h1>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.55)", background:"rgba(0,0,0,0.18)", padding:"3px 10px", borderRadius:20 }}>
            🕒 {expiresIn}h
          </span>
          {roleInfo && <span className="role-badge" style={{ background:roleInfo.color }}>{roleInfo.label}</span>}
          <div className="wallet-badge">⬡ {shortAddress(session.account)}</div>
          <DarkModeToggle />
          <button onClick={handleLogout}
            style={{ background:"rgba(255,255,255,0.1)", color:"white", border:"1px solid rgba(255,255,255,0.22)", borderRadius:8, padding:"6px 14px", fontSize:12, cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s" }}
            onMouseOver={e => e.currentTarget.style.background="rgba(255,255,255,0.2)"}
            onMouseOut={e  => e.currentTarget.style.background="rgba(255,255,255,0.1)"}
          >Logout</button>
        </div>
      </header>

      <main className="main">
        {session.role === "farmer"      && <FarmerPage      account={session.account} />}
        {session.role === "distributor" && <DistributorPage account={session.account} />}
        {session.role === "retailer"    && <RetailerPage    account={session.account} />}
        {session.role === "customer"    && <CustomerPage    account={session.account} initialBatchId={publicBatchId} />}
        {session.role === "inspector"   && <InspectorPage   account={session.account} />}
        {session.role === "admin"       && <AdminPage       onBack={handleLogout} />}
        {session.role === "unknown"     && (
          <div className="connect-prompt">
            <div style={{ fontSize:48 }}>❓</div>
            <h2>Unregistered Wallet</h2>
            <p>This wallet has no role assigned yet. Contact the AgriChain admin to get a role assigned on-chain.</p>
            <p style={{ fontSize:12, color:"#6b7280", marginTop:8, fontFamily:"monospace" }}>Wallet: {session.account}</p>
            <div style={{ display:"flex", gap:10, marginTop:20, flexWrap:"wrap", justifyContent:"center" }}>
              <button className="btn" onClick={async () => {
                try {
                  const liveRole = await getRoleFromChain(session.account);
                  if (liveRole && liveRole !== "unknown") {
                    const updated = { ...session, role: liveRole };
                    localStorage.setItem("agrichain_session", JSON.stringify(updated));
                    setSession(updated);
                  } else {
                    alert("Role still not found on-chain. Ask admin to run grantRole() for your wallet address.");
                  }
                } catch(e) { alert("Error checking role: " + e.message); }
              }}>🔄 Re-check Role</button>
              <button className="btn" onClick={handleLogout} style={{ background:"#6b7280" }}>← Logout</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}