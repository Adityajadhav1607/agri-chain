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
import { loadSession, clearSession, getRoleFromChain, switchNetwork } from "./utils/auth";
import ToastProvider   from "./components/ToastProvider";
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

  useEffect(() => {
    initApp();
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", () => {
        clearSession();
        setSession(null);
        setPage("login");
      });
      window.ethereum.on("chainChanged", () => {
        initApp();
      });
    }
  }, []);

  async function initApp() {
    try {
      const existing = loadSession();
      if (!existing) { setLoading(false); return; }

      if (window.ethereum) {
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        if (chainId !== "0xaa36a7" && chainId !== "0xAA36A7") {
          setIsWrongNetwork(true);
          setSession(existing);
          setLoading(false);
          return;
        }
        setIsWrongNetwork(false);

        const liveRole = await getRoleFromChain(existing.account);
        if (liveRole && liveRole !== "unknown") {
          const updated  = { ...existing, role: liveRole };
          localStorage.setItem("agrichain_session", JSON.stringify(updated));
          setSession(updated);
        } else {
          setSession(existing);
        }
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

  function handleLogin(newSession) { 
    setIsWrongNetwork(false);
    setSession(newSession); 
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    setIsWrongNetwork(false);
    setPage("home");
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

  if (isWrongNetwork) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at center, #1b3d22 0%, #0d1f11 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "'Segoe UI',sans-serif",
        color: "white"
      }}>
        <div style={{
          background: "rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: "24px",
          padding: "40px 32px",
          maxWidth: "460px",
          width: "100%",
          textAlign: "center",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
        }}>
          <div style={{
            fontSize: "64px",
            marginBottom: "20px",
            animation: "pulse 2s infinite",
            display: "inline-block"
          }}>⛓️</div>
          <h2 style={{
            fontSize: "26px",
            fontWeight: "700",
            marginBottom: "12px",
            background: "linear-gradient(90deg, #ffc73c, #ff8c3b)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            Wrong Network Connected
          </h2>
          <p style={{
            color: "rgba(255, 255, 255, 0.75)",
            fontSize: "14px",
            lineHeight: "1.6",
            marginBottom: "28px"
          }}>
            AgriChain operates on the <strong>Sepolia Testnet</strong> network. Please switch your MetaMask network to continue using the application.
          </p>
          <button
            onClick={async () => {
              try {
                await switchNetwork();
                setIsWrongNetwork(false);
                initApp();
              } catch (e) {
                console.error("Failed to switch network:", e);
              }
            }}
            style={{
              background: "linear-gradient(135deg, #1a6b3a 0%, #114a28 100%)",
              color: "white",
              border: "none",
              borderRadius: "12px",
              padding: "14px 36px",
              fontSize: "15px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "0 10px 20px rgba(26, 107, 58, 0.3)",
              transition: "all 0.3s ease",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 15px 25px rgba(26, 107, 58, 0.5)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 10px 20px rgba(26, 107, 58, 0.3)";
            }}
          >
            🦊 Switch to Sepolia Testnet
          </button>
          
          <button 
            onClick={handleLogout}
            style={{
              background: "transparent",
              color: "rgba(255, 255, 255, 0.55)",
              border: "none",
              marginTop: "20px",
              cursor: "pointer",
              fontSize: "13px",
              textDecoration: "underline",
              fontFamily: "inherit"
            }}
          >
            Or log out of session
          </button>
        </div>
        <style>{`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 0.85; }
            50% { transform: scale(1.08); opacity: 1; }
            100% { transform: scale(1); opacity: 0.85; }
          }
        `}</style>
      </div>
    );
  }

  if (!session) {
    if (page === "register") return <RegisterPage onBack={() => setPage("home")} />;
    if (page === "admin")    return <AdminPage    onBack={() => setPage("home")} />;
    if (page === "login")    return (
      <LoginPage
        onLogin={handleLogin}
        onRegister={() => setPage("register")}
        onAdmin={()    => setPage("admin")}
        onBack={()     => setPage("home")}
      />
    );
    return (
      <HomePage
        onSignIn={()   => setPage("login")}
        onRegister={() => setPage("register")}
      />
    );
  }

  const roleInfo  = ROLE_LABELS[session.role];
  const expiresIn = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000 / 60 / 60));

  return (
    <div className="app">
      <ToastProvider />
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