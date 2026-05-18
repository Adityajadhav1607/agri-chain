/* eslint-disable no-undef */
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import ProduceRegistryABI from "../utils/ProduceRegistry.json";
import { REGISTRY_ADDRESS } from "../utils/addresses";

const ROLE_HASHES = {
  farmer:      ethers.keccak256(ethers.toUtf8Bytes("FARMER")),
  distributor: ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR")),
  retailer:    ethers.keccak256(ethers.toUtf8Bytes("RETAILER")),
};

export default function AdminPage({ onBack }) {
  const [requests,  setRequests]  = useState([]);
  const [loading,   setLoading]   = useState({});
  const [results,   setResults]   = useState({});
  const [manualForm, setManual]   = useState({ address: "", role: "farmer" });
  const [manualRes,  setManualRes] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem("agrichain_requests") || "[]";
    setRequests(JSON.parse(raw));
  }, []);

  async function getContract() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    return new ethers.Contract(REGISTRY_ADDRESS, ProduceRegistryABI.abi, signer);
  }

  async function approveRequest(req) {
    try {
      setLoading(l => ({ ...l, [req.id]: true }));
      const contract  = await getContract();
      const roleHash  = ROLE_HASHES[req.role];
      const alreadyHas = await contract.hasRole(roleHash, req.address);
      if (!alreadyHas) {
        const tx = await contract.grantRole(roleHash, req.address);
        await tx.wait();
      }
      updateRequestStatus(req.id, "approved");
      setResults(r => ({ ...r, [req.id]: { type:"success",
        msg: `✅ ${req.name} approved as ${req.role}!` }}));
    } catch (e) {
      setResults(r => ({ ...r, [req.id]: { type:"error",
        msg: e.reason || e.message }}));
    } finally {
      setLoading(l => ({ ...l, [req.id]: false }));
    }
  }

  function rejectRequest(id) {
    updateRequestStatus(id, "rejected");
  }

  function updateRequestStatus(id, status) {
    const updated = requests.map(r => r.id === id ? { ...r, status } : r);
    setRequests(updated);
    localStorage.setItem("agrichain_requests", JSON.stringify(updated));
  }

  async function grantManual() {
    if (!ethers.isAddress(manualForm.address)) {
      setManualRes({ type:"error", msg:"Invalid address" }); return;
    }
    try {
      setManualRes({ type:"loading", msg:"Processing..." });
      const contract = await getContract();
      const roleHash = ROLE_HASHES[manualForm.role];
      const tx = await contract.grantRole(roleHash, manualForm.address);
      await tx.wait();
      setManualRes({ type:"success",
        msg:`✅ ${manualForm.role} role granted to ${manualForm.address.slice(0,10)}...` });
      setManual({ address:"", role:"farmer" });
    } catch (e) {
      setManualRes({ type:"error", msg: e.reason || e.message });
    }
  }

  const pending  = requests.filter(r => r.status === "pending");
  const approved = requests.filter(r => r.status === "approved");
  const rejected = requests.filter(r => r.status === "rejected");

  const statusColor = { pending:"#b45309", approved:"#1a6b3a", rejected:"#dc2626" };
  const statusBg    = { pending:"#fef3c7", approved:"#e8f5ee", rejected:"#fee2e2" };

  return (
    <div style={{
      minHeight:"100vh", background:"#f4f6f0",
      fontFamily:"'Segoe UI',sans-serif", padding:"24px"
    }}>
      <div style={{ maxWidth:"760px", margin:"0 auto" }}>

        {/* Header */}
        <div style={{
          display:"flex", alignItems:"center",
          justifyContent:"space-between", marginBottom:"24px"
        }}>
          <div>
            <h1 style={{ fontSize:"22px", color:"#1a6b3a", margin:0 }}>
              🔧 Admin Panel
            </h1>
            <p style={{ color:"#6b7280", fontSize:"13px", margin:"4px 0 0" }}>
              Manage role requests and grant access
            </p>
          </div>
          <button onClick={onBack} style={{
            background:"none", border:"1px solid #e5e1d8",
            borderRadius:"7px", padding:"8px 16px",
            fontSize:"13px", cursor:"pointer", fontFamily:"inherit"
          }}>← Back</button>
        </div>

        {/* Stats */}
        <div style={{
          display:"grid", gridTemplateColumns:"repeat(3,1fr)",
          gap:"12px", marginBottom:"24px"
        }}>
          {[
            { label:"Pending",  count: pending.length,  color:"#b45309", bg:"#fef3c7" },
            { label:"Approved", count: approved.length, color:"#1a6b3a", bg:"#e8f5ee" },
            { label:"Rejected", count: rejected.length, color:"#dc2626", bg:"#fee2e2" },
          ].map(s => (
            <div key={s.label} style={{
              background:"white", border:"1px solid #e5e1d8",
              borderRadius:"10px", padding:"16px", textAlign:"center"
            }}>
              <div style={{
                fontSize:"28px", fontWeight:"700", color:s.color
              }}>{s.count}</div>
              <div style={{ fontSize:"12px", color:"#6b7280" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Pending requests */}
        <div style={{
          background:"white", border:"1px solid #e5e1d8",
          borderRadius:"12px", marginBottom:"20px", overflow:"hidden"
        }}>
          <div style={{
            padding:"14px 20px", borderBottom:"1px solid #e5e1d8",
            background:"#fafaf8"
          }}>
            <h2 style={{ fontSize:"14px", fontWeight:"600", margin:0 }}>
              📋 Pending Requests ({pending.length})
            </h2>
          </div>
          {pending.length === 0 ? (
            <div style={{ padding:"28px", textAlign:"center", color:"#9ca3af", fontSize:"13px" }}>
              No pending requests
            </div>
          ) : (
            pending.map(req => (
              <div key={req.id} style={{
                padding:"16px 20px", borderBottom:"1px solid #f0ede6",
                display:"flex", alignItems:"center", gap:"16px", flexWrap:"wrap"
              }}>
                <div style={{ flex:1, minWidth:"200px" }}>
                  <div style={{ fontWeight:"600", fontSize:"13px" }}>{req.name}</div>
                  <div style={{ fontSize:"11px", color:"#6b7280", margin:"2px 0" }}>
                    {req.farmLocation} · {req.phone}
                  </div>
                  <div style={{
                    fontSize:"11px", fontFamily:"monospace",
                    color:"#374151", wordBreak:"break-all"
                  }}>{req.address}</div>
                </div>
                <span style={{
                  background: statusBg[req.status],
                  color: statusColor[req.status],
                  padding:"3px 10px", borderRadius:"4px",
                  fontSize:"11px", fontWeight:"500"
                }}>{req.role}</span>
                <div style={{ display:"flex", gap:"8px" }}>
                  <button onClick={() => approveRequest(req)}
                    disabled={loading[req.id]}
                    style={{
                      background:"#1a6b3a", color:"white", border:"none",
                      borderRadius:"6px", padding:"7px 16px",
                      fontSize:"12px", cursor:"pointer", fontFamily:"inherit"
                    }}>
                    {loading[req.id] ? "..." : "✅ Approve"}
                  </button>
                  <button onClick={() => rejectRequest(req.id)} style={{
                    background:"#dc2626", color:"white", border:"none",
                    borderRadius:"6px", padding:"7px 16px",
                    fontSize:"12px", cursor:"pointer", fontFamily:"inherit"
                  }}>❌ Reject</button>
                </div>
                {results[req.id] && (
                  <div style={{
                    width:"100%", fontSize:"12px",
                    color: results[req.id].type === "success" ? "#1a6b3a" : "#dc2626",
                    background: results[req.id].type === "success" ? "#e8f5ee" : "#fee2e2",
                    padding:"6px 10px", borderRadius:"5px"
                  }}>{results[req.id].msg}</div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Manual grant */}
        <div style={{
          background:"white", border:"1px solid #e5e1d8",
          borderRadius:"12px", overflow:"hidden", marginBottom:"20px"
        }}>
          <div style={{
            padding:"14px 20px", borderBottom:"1px solid #e5e1d8",
            background:"#fafaf8"
          }}>
            <h2 style={{ fontSize:"14px", fontWeight:"600", margin:0 }}>
              ⚡ Grant Role Directly
            </h2>
          </div>
          <div style={{ padding:"20px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr auto", gap:"10px", alignItems:"flex-end" }}>
              <div>
                <label style={{ display:"block", fontSize:"12px", fontWeight:"600", color:"#374151", marginBottom:"5px" }}>
                  Wallet Address
                </label>
                <input
                  value={manualForm.address}
                  onChange={e => setManual(f => ({ ...f, address: e.target.value }))}
                  placeholder="0x..."
                  style={{
                    width:"100%", padding:"9px 12px",
                    border:"1px solid #e5e1d8", borderRadius:"7px",
                    fontSize:"12px", fontFamily:"monospace",
                    background:"#fafaf8", outline:"none", boxSizing:"border-box"
                  }}
                />
              </div>
              <div>
                <label style={{ display:"block", fontSize:"12px", fontWeight:"600", color:"#374151", marginBottom:"5px" }}>
                  Role
                </label>
                <select
                  value={manualForm.role}
                  onChange={e => setManual(f => ({ ...f, role: e.target.value }))}
                  style={{
                    width:"100%", padding:"9px 12px",
                    border:"1px solid #e5e1d8", borderRadius:"7px",
                    fontSize:"13px", fontFamily:"inherit",
                    background:"#fafaf8", outline:"none"
                  }}>
                  <option value="farmer">🌾 Farmer</option>
                  <option value="distributor">🚛 Distributor</option>
                  <option value="retailer">🏪 Retailer</option>
                </select>
              </div>
              <button onClick={grantManual} style={{
                background:"#1a6b3a", color:"white", border:"none",
                borderRadius:"7px", padding:"9px 18px",
                fontSize:"13px", cursor:"pointer", fontFamily:"inherit",
                whiteSpace:"nowrap"
              }}>Grant ⬡</button>
            </div>
            {manualRes && (
              <div style={{
                marginTop:"10px", fontSize:"12px",
                color: manualRes.type === "success" ? "#1a6b3a" : manualRes.type === "error" ? "#dc2626" : "#b45309",
                background: manualRes.type === "success" ? "#e8f5ee" : manualRes.type === "error" ? "#fee2e2" : "#fef3c7",
                padding:"8px 12px", borderRadius:"6px"
              }}>{manualRes.msg}</div>
            )}
          </div>
        </div>

        {/* Approved history */}
        {approved.length > 0 && (
          <div style={{
            background:"white", border:"1px solid #e5e1d8",
            borderRadius:"12px", overflow:"hidden"
          }}>
            <div style={{ padding:"14px 20px", borderBottom:"1px solid #e5e1d8", background:"#fafaf8" }}>
              <h2 style={{ fontSize:"14px", fontWeight:"600", margin:0 }}>✅ Approved Users</h2>
            </div>
            {approved.map(req => (
              <div key={req.id} style={{
                padding:"12px 20px", borderBottom:"1px solid #f0ede6",
                display:"flex", alignItems:"center", gap:"12px"
              }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:"600", fontSize:"13px" }}>{req.name}</div>
                  <div style={{ fontSize:"11px", color:"#6b7280" }}>{req.farmLocation}</div>
                </div>
                <span style={{
                  background:"#e8f5ee", color:"#1a6b3a",
                  padding:"3px 10px", borderRadius:"4px", fontSize:"11px"
                }}>{req.role}</span>
                <span style={{
                  background:"#d1fae5", color:"#065f46",
                  padding:"3px 10px", borderRadius:"4px", fontSize:"11px"
                }}>Active</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}