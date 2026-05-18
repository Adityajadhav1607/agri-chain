import { useState } from "react";
import { signInWithEthereum } from "../utils/auth";

export default function LoginPage({ onLogin, onRegister, onAdmin }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [step,    setStep]    = useState("idle");

  const roles = [
    { emoji:"🌾", title:"Farmer",      desc:"Register batches & transfer to distributor", color:"#1a6b3a", bg:"#e8f5ee" },
    { emoji:"🚛", title:"Distributor", desc:"Pick up & deliver to retailer",              color:"#b45309", bg:"#fef3c7" },
    { emoji:"🏪", title:"Retailer",    desc:"Receive & confirm delivery",                 color:"#c2410c", bg:"#fff7ed" },
    { emoji:"👤", title:"Customer",    desc:"Scan QR & trace produce journey",            color:"#1d4ed8", bg:"#eff6ff" },
  ];

  async function handleLogin() {
    try {
      setLoading(true); setError(null);
      setStep("connecting");
      await new Promise(r => setTimeout(r, 400));
      setStep("signing");
      const session = await signInWithEthereum();
      setStep("verifying");
      await new Promise(r => setTimeout(r, 500));
      onLogin(session);
    } catch (e) {
      setError(e.message || "Login failed.");
      setStep("idle");
    } finally { setLoading(false); }
  }

  const stepLabels = {
    idle:       null,
    connecting: "Connecting to MetaMask...",
    signing:    "Please sign the message in MetaMask...",
    verifying:  "Verifying on blockchain...",
  };

  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(135deg,#f0f7f0 0%,#e8f5ee 50%,#f4f6f0 100%)",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      padding:"24px", fontFamily:"'Segoe UI',sans-serif"
    }}>
      {/* Hero */}
      <div style={{ textAlign:"center", marginBottom:"32px" }}>
        <div style={{ fontSize:"52px", marginBottom:"12px" }}>🌾</div>
        <h1 style={{ fontSize:"32px", fontWeight:"700", color:"#1a6b3a", margin:"0 0 8px" }}>
          AgriChain
        </h1>
        <p style={{ color:"#4b7a5a", fontSize:"14px", margin:0 }}>
          Blockchain-based Agricultural Supply Chain Transparency
        </p>
        <div style={{
          display:"inline-flex", alignItems:"center", gap:"6px",
          background:"#e8f5ee", border:"1px solid #4caf72",
          borderRadius:"20px", padding:"4px 14px", marginTop:"10px",
          fontSize:"11px", color:"#1a6b3a", fontWeight:"500"
        }}>⬡ Powered by Ethereum Blockchain</div>
      </div>

      {/* Role cards */}
      <div style={{
        display:"grid", gridTemplateColumns:"repeat(2,1fr)",
        gap:"12px", maxWidth:"520px", width:"100%", marginBottom:"28px"
      }}>
        {roles.map(r => (
          <div key={r.title} style={{
            background:"white", border:`1.5px solid ${r.bg}`,
            borderRadius:"12px", padding:"14px 16px",
            display:"flex", alignItems:"center", gap:"12px"
          }}>
            <div style={{
              width:"38px", height:"38px", borderRadius:"50%",
              background:r.bg, display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:"18px", flexShrink:0
            }}>{r.emoji}</div>
            <div>
              <div style={{ fontWeight:"600", fontSize:"13px", color:r.color }}>
                {r.title}
              </div>
              <div style={{ fontSize:"11px", color:"#6b7280", marginTop:"2px" }}>
                {r.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sign in button */}
      <button onClick={handleLogin} disabled={loading} style={{
        background: loading ? "#4caf72" : "#1a6b3a",
        color:"white", border:"none", borderRadius:"10px",
        padding:"13px 48px", fontSize:"15px", fontWeight:"600",
        cursor: loading ? "not-allowed" : "pointer",
        fontFamily:"inherit", width:"100%", maxWidth:"360px",
        display:"flex", alignItems:"center", justifyContent:"center", gap:"10px",
        marginBottom:"12px"
      }}>
        {loading ? (
          <>
            <span style={{
              width:"16px", height:"16px",
              border:"2px solid rgba(255,255,255,0.4)",
              borderTopColor:"white", borderRadius:"50%",
              animation:"spin 0.7s linear infinite", display:"inline-block"
            }}/>
            {stepLabels[step]}
          </>
        ) : "🦊 Sign In With Ethereum"}
      </button>

      {/* Register + Admin buttons */}
      <div style={{
        display:"flex", gap:"10px", width:"100%",
        maxWidth:"360px", marginBottom:"16px"
      }}>
        <button onClick={onRegister} style={{
          flex:1, background:"white", color:"#1a6b3a",
          border:"1.5px solid #4caf72", borderRadius:"8px",
          padding:"10px", fontSize:"13px", fontWeight:"500",
          cursor:"pointer", fontFamily:"inherit"
        }}>📋 Request Access</button>
        <button onClick={onAdmin} style={{
          flex:1, background:"white", color:"#6b7280",
          border:"1px solid #e5e1d8", borderRadius:"8px",
          padding:"10px", fontSize:"13px",
          cursor:"pointer", fontFamily:"inherit"
        }}>🔧 Admin Panel</button>
      </div>

      {error && (
        <div style={{
          background:"#fee2e2", border:"1px solid #f87171",
          borderRadius:"8px", padding:"10px 16px",
          fontSize:"12px", color:"#991b1b",
          maxWidth:"360px", width:"100%", textAlign:"center",
          marginBottom:"12px"
        }}>❌ {error}</div>
      )}

      {/* Security badges */}
      <div style={{
        display:"flex", gap:"8px", flexWrap:"wrap", justifyContent:"center"
      }}>
        {["🔐 EIP-712 Signed","⛓️ On-chain roles","🕒 24h session","🚫 No passwords"].map(b => (
          <span key={b} style={{
            background:"white", border:"1px solid #e5e1d8",
            borderRadius:"20px", padding:"3px 10px",
            fontSize:"11px", color:"#374151"
          }}>{b}</span>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}