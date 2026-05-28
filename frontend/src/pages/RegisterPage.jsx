import { useState } from "react";
import { ethers } from "ethers";
import { switchNetwork } from "../utils/auth";

export default function RegisterPage({ onBack }) {
  const [form, setForm] = useState({
    name: "", farmLocation: "", phone: "", role: "farmer", address: ""
  });
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error,     setError]     = useState(null);

  const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

  async function autoFillAddress() {
    try {
      if (!window.ethereum) { alert("Install MetaMask first!"); return; }
      await switchNetwork();
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });
      setForm(f => ({ ...f, address: accounts[0] }));
    } catch (e) { setError("Could not connect MetaMask"); }
  }

  async function handleSubmit() {
    if (!form.name || !form.farmLocation || !form.phone || !form.address) {
      setError("Please fill all fields and connect your wallet."); return;
    }
    if (!ethers.isAddress(form.address)) {
      setError("Invalid wallet address — click Auto-fill to use MetaMask."); return;
    }
    if (!window.ethereum) {
      setError("MetaMask not detected. Please install MetaMask to request access."); return;
    }
    try {
      setLoading(true); setError(null);

      // Connect MetaMask and get signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer  = await provider.getSigner();
      const signerAddr = await signer.getAddress();

      // Make sure MetaMask wallet matches the entered address
      if (signerAddr.toLowerCase() !== form.address.toLowerCase()) {
        setError(
          "Active MetaMask wallet doesn\u2019t match the address above. " +
          "Click \ud83e\udd8a Auto-fill to use your current wallet."
        );
        return;
      }

      // Sign a message to prove wallet ownership — this shows the MetaMask popup
      const message =
        `AgriChain Access Request\n\n` +
        `Role:     ${form.role}\n` +
        `Name:     ${form.name}\n` +
        `Location: ${form.farmLocation}\n` +
        `Wallet:   ${form.address}\n\n` +
        `\u2139\ufe0f  This is a FREE signature \u2014 no gas or transaction required.`;

      const signature = await signer.signMessage(message);

      // Save request with signature proof to localStorage
      const existing = JSON.parse(localStorage.getItem("agrichain_requests") || "[]");
      existing.push({
        ...form,
        id:        Date.now(),
        status:    "pending",
        createdAt: new Date().toISOString(),
        signature, // cryptographic proof the user owns this wallet
      });
      localStorage.setItem("agrichain_requests", JSON.stringify(existing));
      setSubmitted(true);
    } catch (e) {
      if (e.code === 4001 || (e.message || "").toLowerCase().includes("user rejected")) {
        setError("Signature cancelled. You must sign the MetaMask message to confirm your request.");
      } else {
        setError(e.message || "Submission failed. Please try again.");
      }
    } finally { setLoading(false); }
  }

  if (submitted) return (
    <div style={{
      minHeight: "100vh", background: "#f4f6f0",
      display: "flex", alignItems: "center",
      justifyContent: "center", padding: "24px",
      fontFamily: "'Segoe UI',sans-serif"
    }}>
      <div style={{
        background: "white", borderRadius: "16px",
        padding: "40px", maxWidth: "440px", width: "100%",
        textAlign: "center", border: "1px solid #e5e1d8"
      }}>
        <div style={{ fontSize: "52px", marginBottom: "16px" }}>✅</div>
        <h2 style={{ color: "#1a6b3a", marginBottom: "10px" }}>
          Request Submitted!
        </h2>
        <p style={{ color: "#6b7280", fontSize: "14px", lineHeight: "1.6" }}>
          Your registration request has been sent to the AgriChain admin.
          You will be notified once your <strong>{form.role}</strong> role
          is approved on the blockchain.
        </p>
        <div style={{
          background: "#f8f7f2", borderRadius: "8px",
          padding: "12px 16px", margin: "20px 0",
          fontSize: "12px", color: "#374151", textAlign: "left"
        }}>
          <div style={{ marginBottom: "6px" }}>
            <strong>Name:</strong> {form.name}
          </div>
          <div style={{ marginBottom: "6px" }}>
            <strong>Role:</strong> {form.role}
          </div>
          <div style={{ wordBreak: "break-all" }}>
            <strong>Wallet:</strong> {form.address}
          </div>
        </div>
        <button onClick={onBack} style={{
          background: "#1a6b3a", color: "white", border: "none",
          borderRadius: "8px", padding: "10px 28px",
          fontSize: "14px", cursor: "pointer", fontFamily: "inherit"
        }}>← Back to Login</button>
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh", background: "#f4f6f0",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px", fontFamily: "'Segoe UI',sans-serif"
    }}>
      <div style={{
        background: "white", borderRadius: "16px",
        padding: "32px", maxWidth: "500px", width: "100%",
        border: "1px solid #e5e1d8"
      }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", color: "#6b7280",
          cursor: "pointer", fontSize: "13px", marginBottom: "20px",
          padding: 0, fontFamily: "inherit"
        }}>← Back to Login</button>

        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "36px", marginBottom: "10px" }}>📋</div>
          <h2 style={{ fontSize: "22px", color: "#1c1c1a", marginBottom: "6px" }}>
            Request Access
          </h2>
          <p style={{ color: "#6b7280", fontSize: "13px" }}>
            Fill this form to request a role in AgriChain.
            Admin will review and approve your request.
          </p>
        </div>

        {/* Role selector */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{
            display: "block", fontSize: "12px", fontWeight: "600",
            color: "#374151", marginBottom: "6px"
          }}>Select Role *</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            {[
              { value: "farmer",      emoji: "🌾", label: "Farmer" },
              { value: "distributor", emoji: "🚛", label: "Distributor" },
              { value: "retailer",    emoji: "🏪", label: "Retailer" },
              { value: "customer",    emoji: "👤", label: "Customer" },
              { value: "inspector",   emoji: "🔬", label: "Inspector" },
            ].map(r => (
              <div key={r.value}
                onClick={() => setForm(f => ({ ...f, role: r.value }))}
                style={{
                  border: `2px solid ${form.role === r.value ? "#1a6b3a" : "#e5e1d8"}`,
                  background: form.role === r.value ? "#e8f5ee" : "white",
                  borderRadius: "8px", padding: "10px 14px",
                  cursor: "pointer", display: "flex",
                  alignItems: "center", gap: "8px",
                  fontSize: "13px", fontWeight: "500",
                  color: form.role === r.value ? "#1a6b3a" : "#374151",
                  transition: "all 0.2s"
                }}>
                <span>{r.emoji}</span>{r.label}
              </div>
            ))}
          </div>
        </div>

        {/* Form fields */}
        {[
          { name: "name",         label: "Full Name *",        placeholder: "Ramesh Patil" },
          { name: "farmLocation", label: "Location / Business *", placeholder: "Nasik, Maharashtra" },
          { name: "phone",        label: "Phone / Aadhaar *",  placeholder: "9876543210" },
        ].map(f => (
          <div key={f.name} style={{ marginBottom: "14px" }}>
            <label style={{
              display: "block", fontSize: "12px", fontWeight: "600",
              color: "#374151", marginBottom: "5px"
            }}>{f.label}</label>
            <input
              name={f.name} value={form[f.name]}
              onChange={handle} placeholder={f.placeholder}
              style={{
                width: "100%", padding: "9px 12px",
                border: "1px solid #e5e1d8", borderRadius: "7px",
                fontSize: "13px", fontFamily: "inherit",
                background: "#fafaf8", outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>
        ))}

        {/* Wallet address */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{
            display: "block", fontSize: "12px", fontWeight: "600",
            color: "#374151", marginBottom: "5px"
          }}>Wallet Address *</label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              name="address" value={form.address}
              onChange={handle} placeholder="0x... or click Auto-fill"
              style={{
                flex: 1, padding: "9px 12px",
                border: "1px solid #e5e1d8", borderRadius: "7px",
                fontSize: "12px", fontFamily: "monospace",
                background: form.address ? "#e8f5ee" : "#fafaf8",
                outline: "none"
              }}
            />
            <button onClick={autoFillAddress} style={{
              background: "#1a6b3a", color: "white", border: "none",
              borderRadius: "7px", padding: "9px 14px",
              fontSize: "12px", cursor: "pointer",
              fontFamily: "inherit", whiteSpace: "nowrap"
            }}>🦊 Auto-fill</button>
          </div>
          <div style={{
            fontSize: "11px", color: "#6b7280", marginTop: "4px"
          }}>
            Click Auto-fill to use your MetaMask wallet address
          </div>
        </div>

        {error && (
          <div style={{
            background: "#fee2e2", border: "1px solid #f87171",
            borderRadius: "7px", padding: "10px 14px",
            fontSize: "12px", color: "#991b1b", marginBottom: "14px"
          }}>❌ {error}</div>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{
          width: "100%", background: "#1a6b3a", color: "white",
          border: "none", borderRadius: "8px", padding: "12px",
          fontSize: "14px", fontWeight: "600", cursor: "pointer",
          fontFamily: "inherit"
        }}>
          {loading ? "Submitting..." : "📋 Submit Registration Request"}
        </button>

        <div style={{
          marginTop: "16px", padding: "12px",
          background: "#fef3c7", borderRadius: "8px",
          fontSize: "11px", color: "#78350f", lineHeight: "1.6"
        }}>
          ⚠️ <strong>Note:</strong> After approval, admin will assign your role
          on the Ethereum blockchain. You will then be able to sign in with your
          MetaMask wallet. Role assignment requires one blockchain transaction
          by the admin.
        </div>
      </div>
    </div>
  );
}