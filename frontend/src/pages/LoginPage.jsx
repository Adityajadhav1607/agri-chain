import { useState } from "react";
import { signInWithEthereum, MetaMaskNotFoundError, getRoleFromChain } from "../utils/auth";

export default function LoginPage({ onLogin, onRegister, onAdmin, onBack }) {
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [step,       setStep]       = useState("idle");
  const [noMetaMask, setNoMetaMask] = useState(!window.ethereum);
  const [adminChecking, setAdminChecking] = useState(false);
  const [adminDenied,   setAdminDenied]   = useState(false);

  const roles = [
    { emoji:"🌾", title:"Farmer",      desc:"Register batches & transfer to distributor", color:"#1a6b3a", bg:"#e8f5ee" },
    { emoji:"🚛", title:"Distributor", desc:"Pick up & deliver to retailer",              color:"#b45309", bg:"#fef3c7" },
    { emoji:"🏪", title:"Retailer",    desc:"Receive & confirm delivery",                 color:"#c2410c", bg:"#fff7ed" },
    { emoji:"👤", title:"Customer",    desc:"Scan QR & trace produce journey",            color:"#1d4ed8", bg:"#eff6ff" },
  ];

  async function handleLogin() {
    if (!window.ethereum) {
      setNoMetaMask(true);
      return;
    }
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
      if (e instanceof MetaMaskNotFoundError) {
        setNoMetaMask(true);
      } else {
        setError(e.message || "Login failed.");
      }
      setStep("idle");
    } finally { setLoading(false); }
  }

  async function handleAdminClick() {
    if (!window.ethereum) { setNoMetaMask(true); return; }
    try {
      setAdminChecking(true); setAdminDenied(false); setError(null);
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (!accounts || accounts.length === 0) { setError("Please connect MetaMask first."); return; }
      const role = await getRoleFromChain(accounts[0]);
      if (role === "admin") {
        onAdmin();
      } else {
        setAdminDenied(true);
        setTimeout(() => setAdminDenied(false), 3000);
      }
    } catch (e) {
      setError("Could not verify admin role: " + (e.message || ""));
    } finally { setAdminChecking(false); }
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
      padding:"24px", fontFamily:"'Segoe UI',sans-serif",
      position:"relative"
    }}>

      {/* ← Back to Home — top-left */}
      <button
        onClick={onBack}
        style={{
          position:"absolute", top:"20px", left:"20px",
          background:"rgba(26,107,58,0.08)",
          border:"1px solid rgba(26,107,58,0.18)",
          borderRadius:"10px", padding:"7px 16px",
          fontSize:"13px", fontWeight:"600", color:"#1a6b3a",
          cursor:"pointer", fontFamily:"inherit",
          display:"flex", alignItems:"center", gap:"6px",
          transition:"all 0.2s",
        }}
        onMouseOver={e => { e.currentTarget.style.background="rgba(26,107,58,0.15)"; e.currentTarget.style.transform="translateX(-2px)"; }}
        onMouseOut={e => { e.currentTarget.style.background="rgba(26,107,58,0.08)"; e.currentTarget.style.transform=""; }}
      >
        ← Back to Home
      </button>

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
        <button onClick={handleAdminClick} disabled={adminChecking} style={{
          flex:1, background: adminDenied ? "#fee2e2" : "white",
          color: adminDenied ? "#991b1b" : "#6b7280",
          border: adminDenied ? "1px solid #f87171" : "1px solid #e5e1d8",
          borderRadius:"8px",
          padding:"10px", fontSize:"13px",
          cursor: adminChecking ? "not-allowed" : "pointer",
          fontFamily:"inherit", transition:"all 0.2s"
        }}>
          {adminChecking ? "⏳ Verifying..." : adminDenied ? "🚫 Not Admin" : "🔧 Admin Panel"}
        </button>
      </div>

      {/* MetaMask Not Installed Banner */}
      {noMetaMask && (
        <div style={{
          background:"linear-gradient(135deg,#fff8f0,#fff3e0)",
          border:"2px solid #f97316",
          borderRadius:"14px", padding:"20px 22px",
          maxWidth:"460px", width:"100%", marginBottom:"16px"
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
            <span style={{ fontSize:"28px" }}>🦊</span>
            <div>
              <div style={{ fontWeight:"700", fontSize:"15px", color:"#c2410c" }}>
                MetaMask Not Detected
              </div>
              <div style={{ fontSize:"12px", color:"#78350f", marginTop:"2px" }}>
                A MetaMask wallet is required to sign in to AgriChain.
              </div>
            </div>
          </div>

          {/* Download button */}
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noreferrer"
            style={{
              display:"block", textAlign:"center",
              background:"#f97316", color:"white",
              borderRadius:"8px", padding:"10px",
              fontWeight:"600", fontSize:"14px",
              textDecoration:"none", marginBottom:"16px"
            }}
          >
            📥 Download MetaMask — metamask.io
          </a>

          {/* Setup steps */}
          <div style={{ fontSize:"12px", color:"#78350f" }}>
            <div style={{ fontWeight:"700", marginBottom:"8px", fontSize:"13px", color:"#c2410c" }}>
              📱 How to set up MetaMask on a new device:
            </div>
            {[
              { n:"1", t:"Install MetaMask",    d:"Click the button above → install the browser extension (Chrome / Firefox / Brave) or the mobile app from metamask.io." },
              { n:"2", t:"Import your wallet",  d:"Choose \"Import wallet\" and enter your 12-word Secret Recovery Phrase from your existing MetaMask to restore the same account." },
              { n:"3", t:"Switch to Sepolia",   d:"Open MetaMask → click the network dropdown → select \"Sepolia Testnet\". (Enable test networks in Settings → Advanced if you don't see it.)" },
              { n:"4", t:"Come back & Sign In", d:"Return to this page and click \"Sign In With Ethereum\". MetaMask will ask you to sign a message — approve it and you're in!" },
            ].map(s => (
              <div key={s.n} style={{
                display:"flex", gap:"10px", marginBottom:"10px",
                padding:"10px", background:"white",
                borderRadius:"8px", border:"1px solid #fed7aa"
              }}>
                <div style={{
                  minWidth:"22px", height:"22px", borderRadius:"50%",
                  background:"#f97316", color:"white",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontWeight:"700", fontSize:"11px", flexShrink:0
                }}>{s.n}</div>
                <div>
                  <div style={{ fontWeight:"600", fontSize:"12px", color:"#c2410c", marginBottom:"2px" }}>{s.t}</div>
                  <div style={{ fontSize:"11px", color:"#92400e", lineHeight:"1.5" }}>{s.d}</div>
                </div>
              </div>
            ))}
            <div style={{
              marginTop:"4px", padding:"8px 12px",
              background:"#fff7ed", borderRadius:"6px",
              border:"1px dashed #fdba74",
              fontSize:"11px", color:"#92400e"
            }}>
              ⚠️ <strong>Never share</strong> your Secret Recovery Phrase with anyone.
              AgriChain will <strong>never</strong> ask for it.
            </div>
          </div>
        </div>
      )}

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