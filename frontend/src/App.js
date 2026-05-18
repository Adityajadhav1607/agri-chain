import { useState, useEffect } from "react";
import FarmerPage      from "./pages/FarmerPage";
import DistributorPage from "./pages/DistributorPage";
import RetailerPage    from "./pages/RetailerPage";
import CustomerPage    from "./pages/CustomerPage";
import InspectorPage   from "./pages/InspectorPage";
import LoginPage       from "./pages/LoginPage";
import RegisterPage    from "./pages/RegisterPage";
import AdminPage       from "./pages/AdminPage";
import { loadSession, clearSession, getRoleFromChain } from "./utils/auth";
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
  const [session, setSession] = useState(null);
  const [page,    setPage]    = useState("login");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initApp();
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", () => {
        clearSession();
        setSession(null);
        setPage("login");
      });
      window.ethereum.on("chainChanged", () => {
        clearSession();
        setSession(null);
        setPage("login");
      });
    }
  }, []);

  async function initApp() {
    try {
      const existing = loadSession();
      if (!existing) { setLoading(false); return; }

      if (window.ethereum) {
        const liveRole = await getRoleFromChain(existing.account);
        const updated  = { ...existing, role: liveRole || existing.role };
        localStorage.setItem("agrichain_session", JSON.stringify(updated));
        setSession(updated);
      } else {
        setSession(existing);
      }
    } catch (e) {
      console.error("Session init error:", e);
      clearSession();
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(newSession) { setSession(newSession); }

  function handleLogout() {
    clearSession();
    setSession(null);
    setPage("login");
  }

  function shortAddress(addr) {
    return addr?.slice(0, 6) + "..." + addr?.slice(-4);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f6f0", fontFamily: "'Segoe UI',sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>🌾</div>
        <div style={{ color: "#1a6b3a", fontSize: "14px" }}>Verifying your identity on blockchain...</div>
      </div>
    </div>
  );

  if (!session) {
    if (page === "register") return <RegisterPage onBack={() => setPage("login")} />;
    if (page === "admin")    return <AdminPage    onBack={() => setPage("login")} />;
    return (
      <LoginPage
        onLogin={handleLogin}
        onRegister={() => setPage("register")}
        onAdmin={()    => setPage("admin")}
      />
    );
  }

  const roleInfo  = ROLE_LABELS[session.role];
  const expiresIn = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000 / 60 / 60));

  return (
    <div className="app">
      <header className="header">
        <h1>🌾 AgriChain</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", background: "rgba(0,0,0,0.2)", padding: "3px 10px", borderRadius: "20px" }}>
            🕒 {expiresIn}h left
          </span>
          {roleInfo && (
            <span className="role-badge" style={{ background: roleInfo.color }}>
              {roleInfo.label}
            </span>
          )}
          <div className="wallet-badge">⬡ {shortAddress(session.account)}</div>
          <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "7px", padding: "6px 14px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>
            Logout
          </button>
        </div>
      </header>

      <main className="main">
        {session.role === "farmer"      && <FarmerPage      account={session.account} />}
        {session.role === "distributor" && <DistributorPage account={session.account} />}
        {session.role === "retailer"    && <RetailerPage    account={session.account} />}
        {session.role === "customer"    && <CustomerPage    account={session.account} />}
        {session.role === "inspector"   && <InspectorPage   account={session.account} />}
        {session.role === "admin"       && <AdminPage       onBack={handleLogout} />}
        {session.role === "unknown"     && (
          <div className="connect-prompt">
            <div style={{ fontSize: "48px" }}>❓</div>
            <h2>Unregistered Wallet</h2>
            <p>This wallet has no role assigned yet. Contact the AgriChain admin to get a role.</p>
            <button className="btn" onClick={handleLogout} style={{ marginTop: "20px" }}>← Back to Login</button>
          </div>
        )}
      </main>
    </div>
  );
}