import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import FloatingAIBot from "../components/FloatingAIBot";
import ProduceRegistryABI from "../utils/ProduceRegistry.json";
import TrackTransferABI   from "../utils/TrackTransfer.json";
import QualityVerifierABI from "../utils/QualityVerifier.json";
import { REGISTRY_ADDRESS, TRACKER_ADDRESS, VERIFIER_ADDRESS } from "../utils/addresses";

/* ─────────────────────────────────────────────────────────────
   STATIC DATA
───────────────────────────────────────────────────────────── */
const FEED_NAMES = [
  "Rajesh Farms","Green Routes Dist.","FreshMart","City Grocery",
  "Farm Fresh Co.","Sunrise Agro","Valley Harvest","Pune Fresh Mandi",
];
const FEED_EVENTS = [
  { type:"Registered",  emoji:"🌾", color:"#16a34a", bg:"#dcfce7" },
  { type:"Transferred", emoji:"🚛", color:"#2563eb", bg:"#dbeafe" },
  { type:"Delivered",   emoji:"🏪", color:"#ea580c", bg:"#ffedd5" },
  { type:"Traced",      emoji:"👤", color:"#db2777", bg:"#fce7f3" },
  { type:"Inspected",   emoji:"🔬", color:"#7c3aed", bg:"#ede9fe" },
];
let _cnt = 2045;
const rndAddr = () => "0x" + Math.random().toString(16).slice(2,7) + "..." + Math.random().toString(16).slice(2,6);
function genItem() {
  const ev = FEED_EVENTS[Math.floor(Math.random() * FEED_EVENTS.length)];
  const nm = FEED_NAMES[Math.floor(Math.random() * FEED_NAMES.length)];
  _cnt++;
  const label =
    ev.type === "Traced"      ? `Customer traced Batch #AC-${_cnt} via QR scan` :
    ev.type === "Registered"  ? `Batch #AC-${_cnt} registered by ${nm}` :
    ev.type === "Transferred" ? `Batch #AC-${_cnt} transferred to ${nm}` :
    ev.type === "Delivered"   ? `Batch #AC-${_cnt} delivery confirmed by ${nm}` :
                                `Batch #AC-${_cnt} inspected by ${nm}`;
  return { key: Date.now() + Math.random(), label, addr: rndAddr(), ...ev };
}

const INIT_FEED = [
  { key:1, label:"Batch #AC-2041 registered by Rajesh Farms",       addr:"0x7f3a...b12c", type:"Registered",  emoji:"🌾", color:"#16a34a", bg:"#dcfce7", time:"2s ago"  },
  { key:2, label:"Batch #AC-2039 transferred to Green Routes Dist.", addr:"0x2a9c...f44e", type:"Transferred", emoji:"🚛", color:"#2563eb", bg:"#dbeafe", time:"18s ago" },
  { key:3, label:"Batch #AC-2037 delivery confirmed by FreshMart",   addr:"0x9b1d...c77a", type:"Delivered",   emoji:"🏪", color:"#ea580c", bg:"#ffedd5", time:"1m ago"  },
  { key:4, label:"Customer traced Batch #AC-2035 via QR scan",       addr:"0x4c8e...d23f", type:"Traced",      emoji:"👤", color:"#db2777", bg:"#fce7f3", time:"3m ago"  },
];

const TRACE_STEPS = [
  { emoji:"🌾", title:"Farm Registration",  desc:"Batch created & hashed on blockchain",      color:"#16a34a", bg:"#dcfce7", time:"9:42 AM · May 10, 2025" },
  { emoji:"🔬", title:"Quality Inspection", desc:"Inspector verified — freshness Grade A",     color:"#7c3aed", bg:"#ede9fe", time:"2:15 PM · May 10, 2025" },
  { emoji:"🚛", title:"Distributor Pickup", desc:"Green Routes picked up batch from farm",     color:"#2563eb", bg:"#dbeafe", time:"8:00 AM · May 11, 2025" },
  { emoji:"🏪", title:"Retailer Delivery",  desc:"FreshMart confirmed receipt on-chain",       color:"#ea580c", bg:"#ffedd5", time:"3:30 PM · May 11, 2025" },
  { emoji:"👤", title:"Customer Scan",       desc:"QR code scanned at point of sale",           color:"#db2777", bg:"#fce7f3", time:"11:20 AM · May 12, 2025" },
];

const WHY_CARDS = [
  { icon:"🔐", title:"EIP-712 Signed sessions",  desc:"No passwords, no accounts. Authenticate with your Ethereum wallet using typed data signatures.", color:"#ea580c", bg:"#fff7ed" },
  { icon:"📦", title:"Immutable records",         desc:"Every batch transfer and delivery confirmation is permanently stored on-chain — no tampering possible.", color:"#2563eb", bg:"#eff6ff" },
  { icon:"⛓️", title:"On-chain roles",           desc:"Farmer, distributor, retailer, and customer roles are enforced by smart contracts, not a backend database.", color:"#7c3aed", bg:"#f5f3ff" },
  { icon:"📱", title:"QR-based traceability",    desc:"Customers can scan any product label and see the complete supply chain journey instantly.", color:"#16a34a", bg:"#f0fdf4" },
  { icon:"🕒", title:"24h sessions",              desc:"Timed sessions reduce wallet interaction fatigue while keeping security intact across the work day.", color:"#0891b2", bg:"#ecfeff" },
  { icon:"🛡️", title:"Permissioned access",      desc:"Admin-approved role requests ensure only verified participants join the supply chain network.", color:"#db2777", bg:"#fdf2f8" },
];

const TESTIMONIALS = [
  { initials:"RK", color:"#16a34a", bg:"#dcfce7", name:"Rajesh Kumar",  role:"Farmer, Nashik",       quote:"Finally I can prove where my crops come from. Buyers trust me more and I get better prices. AgriChain changed how I do business." },
  { initials:"PM", color:"#ea580c", bg:"#ffedd5", name:"Priya Mehta",   role:"Retailer, FreshMart Mumbai", quote:"Our customers now scan QR codes before buying. Transparency has become our biggest competitive advantage in the market." },
  { initials:"AS", color:"#2563eb", bg:"#dbeafe", name:"Ananya Shah",   role:"Customer, Pune",       quote:"I scanned a tomato pack and saw the exact farm, harvest date and route. I'll never buy untraced produce again. This is the future." },
];

const FAQS = [
  { q:"Do I need cryptocurrency to use AgriChain?",       a:'No crypto payments needed. You only need a MetaMask wallet for authentication. All transactions on our testnet are free — just sign with your wallet.' },
  { q:"Is my data stored on the blockchain forever?",     a:"Yes — once a batch is registered, the record is permanently and immutably stored on the Ethereum blockchain. No one can alter or delete it, not even us." },
  { q:"How do I get access as a farmer or distributor?",  a:'Click "Request Access" on the homepage, connect your MetaMask wallet, and an admin will review and approve your role on-chain within 24 hours.' },
  { q:"What is the Sepolia Testnet?",                     a:"Sepolia is Ethereum's official test network. We use it so you can experience the full blockchain workflow without spending real ETH. Gas fees are simulated with free test tokens." },
  { q:"Can customers trace produce without MetaMask?",    a:"Yes! Customers can scan a QR code and view the full journey in their browser — no wallet needed for reading public trace data. MetaMask is only required to register or transfer batches." },
  { q:"What happens if someone tries to tamper with data?", a:"It's cryptographically impossible. Each block contains the hash of the previous one. Any change would invalidate the entire chain and be immediately visible to the entire network." },
];

const TEAM = [
  { initials:"AJ", name:"Aditya Jadhav",  role:"Full Stack + Blockchain", tags:["Solidity","React","Web3"],        color:"#16a34a", bg:"#dcfce7", photo:"/team/aditya.jpg" },
  { initials:"VY", name:"Vijay Yadav",    role:"Smart Contract Dev",      tags:["Hardhat","Ethers.js","Solidity"], color:"#2563eb", bg:"#dbeafe" },
  { initials:"SJ", name:"Sagar Jagadale", role:"UI/UX + Backend",         tags:["Node.js","Figma","CSS"],          color:"#ea580c", bg:"#ffedd5" },
  { initials:"HJ", name:"Harshad Jadhav", role:"Blockchain Engineer",     tags:["Solidity","IPFS","Web3"],         color:"#7c3aed", bg:"#ede9fe" },
  { initials:"HK", name:"Harshal Katkar", role:"Frontend Developer",      tags:["React","CSS","Web3"],             color:"#db2777", bg:"#fce7f3" },
];

const TECH_STACK = [
  { icon:"⟠",  name:"Ethereum",  desc:"Blockchain layer",  color:"#627EEA", bg:"#eef0ff" },
  { icon:"◈",  name:"Solidity",  desc:"Smart contracts",   color:"#363636", bg:"#f0f0f0" },
  { icon:"⚛",  name:"React.js",  desc:"Frontend UI",       color:"#0ea5e9", bg:"#e0f2fe" },
  { icon:"⬡",  name:"Node.js",   desc:"Backend API",       color:"#16a34a", bg:"#dcfce7" },
  { icon:"🦊", name:"MetaMask",  desc:"Wallet auth",       color:"#f97316", bg:"#fff7ed" },
  { icon:"🔨", name:"Hardhat",   desc:"Contract testing",  color:"#ca8a04", bg:"#fef9c3" },
];

const BLOCKS = [
  { num:"#18,304,771", rows:[{k:"Batch ID",v:"AC 2041"},{k:"Action",v:"Register",c:"#16a34a"},{k:"Farmer",v:"0x3f4e...b162"},{k:"Hash",v:"0x7f5e...b12c"}] },
  { num:"#18,305,112", rows:[{k:"Batch ID",v:"AC 2041"},{k:"Action",v:"Transfer",c:"#2563eb"},{k:"Dist.",v:"0x7e3b...d0fa"},{k:"Prev hash",v:"0x7f5a...b12c"}] },
  { num:"#18,305,588", rows:[{k:"Batch ID",v:"AC 2041"},{k:"Action",v:"Deliver",c:"#ea580c"},{k:"Retailer",v:"0x9e8c...c3f1"},{k:"Prev hash",v:"0x2a9c...f44e"}] },
];

/* ─────────────────────────────────────────────────────────────
   PARTICLE CANVAS
───────────────────────────────────────────────────────────── */
function ParticleCanvas({ dark }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const pts = Array.from({ length: 28 }, () => ({
      x: Math.random() * 1200, y: Math.random() * 700,
      s: Math.random() * 8 + 4, vx: (Math.random() - 0.5) * 0.28,
      vy: -(Math.random() * 0.4 + 0.12), op: Math.random() * 0.3 + 0.08,
      rot: Math.random() * Math.PI * 2, rv: (Math.random() - 0.5) * 0.02,
    }));
    let id;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const fill = dark ? "#4caf72" : "#2d7a4f";
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.rv;
        if (p.y < -20) { p.y = canvas.height + 20; p.x = Math.random() * canvas.width; }
        if (p.x < -20) p.x = canvas.width + 20;
        if (p.x > canvas.width + 20) p.x = -20;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = p.op;
        ctx.beginPath(); ctx.fillStyle = fill;
        ctx.ellipse(0, 0, p.s * 0.35, p.s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 0.5;
        ctx.moveTo(0, -p.s); ctx.lineTo(0, p.s); ctx.stroke();
        ctx.restore();
      });
      id = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", resize); };
  }, [dark]);
  return <canvas ref={ref} style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }} />;
}

/* ─────────────────────────────────────────────────────────────
   COUNTER HOOK
───────────────────────────────────────────────────────────── */
function useCounter(target, active, dur = 2000) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) return;
    let id, t0 = null;
    const step = ts => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / dur, 1);
      setV(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [active, target, dur]);
  return v;
}

/* ─────────────────────────────────────────────────────────────
   SECTION HEADER
───────────────────────────────────────────────────────────── */
function SH({ label, title, sub, dark, center = true }) {
  return (
    <div style={{ textAlign: center ? "center" : "left", marginBottom: "0" }}>
      <div style={{ fontSize:"11px", fontWeight:"700", letterSpacing:"2px", color:"#4caf72", marginBottom:"10px", textTransform:"uppercase" }}>{label}</div>
      <h2 style={{ fontSize:"clamp(26px,4vw,40px)", fontWeight:"800", color: dark ? "#e8f5ee" : "#1a2e1a", letterSpacing:"-1px", marginBottom: sub ? "12px" : "0", lineHeight:"1.15" }}>{title}</h2>
      {sub && <p style={{ fontSize:"15px", color: dark ? "#6b9b7a" : "#4b7a5a", maxWidth: center ? "500px" : "none", margin: center ? "0 auto" : "0", lineHeight:"1.7" }}>{sub}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
export default function HomePage({ onSignIn, onRegister, onTrace }) {
  const [dark, setDark]       = useState(false);
  const [wallet, setWallet]   = useState(null);
  const [feed, setFeed]       = useState(INIT_FEED);
  const [batchId, setBatchId] = useState("");
  const [openFaq, setOpenFaq] = useState(null);
  const [statsOn, setStatsOn] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [realStats, setRealStats] = useState({ batches: null, transfers: null, certs: null, totalKg: null });
  const statsRef = useRef(null);

  // Real on-chain stats counters — animate from realStats once loaded
  const cBatches = useCounter(realStats.batches   ?? 0, statsOn && realStats.batches   !== null);
  const cKg      = useCounter(realStats.totalKg   ?? 0, statsOn && realStats.totalKg   !== null);
  const cTx      = useCounter(realStats.transfers ?? 0, statsOn && realStats.transfers !== null);

  /* wallet */
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method:"eth_accounts" }).then(a => { if (a[0]) setWallet(a[0]); });
    window.ethereum.on("accountsChanged", a => setWallet(a[0] || null));
  }, []);

  /* ── Fetch REAL on-chain stats ────────────────────────────── */
  useEffect(() => {
    async function loadStats() {
      try {
        const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
        const registry = new ethers.Contract(REGISTRY_ADDRESS, ProduceRegistryABI.abi, provider);
        const tracker  = new ethers.Contract(TRACKER_ADDRESS,  TrackTransferABI.abi,   provider);
        const verifier = new ethers.Contract(VERIFIER_ADDRESS, QualityVerifierABI.abi, provider);

        // Total batches registered on-chain
        const totalBatches = await registry.totalBatches().catch(() => null);
        // Total quality certificates issued
        const totalCerts   = await verifier.totalCertificates().catch(() => null);
        // Total transfers: sum up transfer count for each batch
        let totalTransfers = 0;
        let totalKg = 0;
        if (totalBatches !== null) {
          const count = Number(totalBatches);
          const ids = Array.from({ length: count }, (_, i) => BigInt(1000 + i));
          await Promise.all(ids.map(async id => {
            try {
              const [tc, batch] = await Promise.all([
                tracker.getTransferCount(id).catch(() => 0n),
                registry.getBatch(id).catch(() => null),
              ]);
              totalTransfers += Number(tc);
              if (batch) totalKg += Number(batch.quantity);
            } catch { /* skip */ }
          }));
        }
        setRealStats({
          batches:   totalBatches !== null ? Number(totalBatches) : null,
          transfers: totalTransfers || null,
          certs:     totalCerts    !== null ? Number(totalCerts) : null,
          totalKg:   totalKg || null,
        });
      } catch (e) {
        console.warn("Stats load error:", e);
      }
    }
    loadStats();
  }, []);

  /* live feed ticker */
  useEffect(() => {
    const id = setInterval(() => setFeed(p => [{ ...genItem(), time:"just now" }, ...p.slice(0, 7)]), 3400);
    return () => clearInterval(id);
  }, []);

  /* scroll shadow */
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  /* stats observer */
  useEffect(() => {
    if (!statsRef.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsOn(true); }, { threshold:0.3 });
    obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  function handleTrace() {
    const rawId = batchId.toString().trim().replace(/^AC-?/i, "");
    if (!rawId) return;
    if (onTrace) onTrace(rawId);
  }

  const short = a => a ? a.slice(0,6) + "..." + a.slice(-4) : "";

  /* theme tokens */
  const T = {
    bg:      dark ? "#0d1f11" : "#f0f7f2",
    card:    dark ? "#162819" : "#ffffff",
    border:  dark ? "#1e3a22" : "#e4ede6",
    text:    dark ? "#e8f5ee" : "#1a2e1a",
    muted:   dark ? "#6b9b7a" : "#4b7a5a",
    altBg:   dark ? "#111c14" : "#f8fdf8",
    nav:     dark ? "rgba(13,31,17,0.97)" : "rgba(20,74,38,0.98)",
    hero:    dark ? "linear-gradient(160deg,#0d1f11,#152e19,#0d1f11)"
                  : "linear-gradient(160deg,#e6f4ea 0%,#d0e9d7 50%,#f0f7f2 100%)",
  };

  return (
    <div style={{ background:T.bg, color:T.text, fontFamily:"'Inter','Segoe UI',sans-serif", minHeight:"100vh" }}>

      {/* ── GLOBAL STYLES ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;}
        @keyframes fadeUp  {from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeLeft{from{opacity:0;transform:translateX(-22px)}to{opacity:1;transform:translateX(0)}}
        @keyframes float   {0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes spin    {to{transform:rotate(360deg)}}
        @keyframes pdot    {0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(1.45)}}
        @keyframes slideIn {from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:translateX(0)}}
        @keyframes gShift  {0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes ticker  {from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}

        .nav-a{color:rgba(255,255,255,.8);text-decoration:none;padding:6px 13px;border-radius:8px;font-size:14px;font-weight:500;transition:all .2s;cursor:pointer;background:none;border:none;font-family:inherit;}
        .nav-a:hover,.nav-a.active{background:rgba(255,255,255,.12);color:#fff;}

        .cta-primary{background:#1a3d1f;color:#fff;border:none;border-radius:12px;padding:15px 30px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:9px;transition:all .3s;box-shadow:0 4px 18px rgba(26,61,31,.35);}
        .cta-primary:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(26,61,31,.45);background:#1d4a24;}
        .cta-outline{background:transparent;border:2px solid #1a6b3a;border-radius:12px;padding:13px 30px;font-size:16px;font-weight:600;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:9px;transition:all .3s;color:#1a3d1f;}
        .cta-outline:hover{background:#1a6b3a;color:#fff;transform:translateY(-3px);}
        .cta-outline.dk{color:#4caf72;border-color:#4caf72;}
        .cta-outline.dk:hover{background:#4caf72;color:#0b2614;}

        .hov-lift{transition:all .3s;}
        .hov-lift:hover{transform:translateY(-6px);box-shadow:0 20px 44px rgba(0,0,0,.1);}

        .faq-btn{width:100%;background:none;border:none;text-align:left;padding:18px 22px;font-size:15px;font-weight:600;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-family:inherit;color:inherit;transition:background .2s;}
        .faq-btn:hover{background:rgba(76,175,114,.06);}

        .feed-row{animation:ticker .4s ease both;}
        .trace-row{animation:fadeLeft .4s ease both;}

        .tag{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;margin:2px;}
      `}</style>

      {/* ══════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════ */}
      <nav style={{
        position:"fixed",top:0,left:0,right:0,zIndex:1000,
        background:T.nav,
        backdropFilter: scrolled ? "blur(18px)" : "blur(4px)",
        WebkitBackdropFilter: scrolled ? "blur(18px)" : "blur(4px)",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,.08)" : "none",
        boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,.18)" : "none",
        transition:"all .35s", height:"58px",
        display:"flex", alignItems:"center", padding:"0 28px", justifyContent:"space-between",
      }}>
        {/* Logo */}
        <div onClick={() => window.scrollTo({top:0,behavior:"smooth"})}
          style={{ display:"flex", alignItems:"center", gap:"9px", cursor:"pointer" }}>
          <div style={{ width:"32px", height:"32px", borderRadius:"9px", background:"linear-gradient(135deg,#4caf72,#1a6b3a)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px" }}>🌱</div>
          <span style={{ fontSize:"17px", fontWeight:"800", color:"white", letterSpacing:"-0.3px" }}>AgriChain</span>
        </div>

        {/* Nav links */}
        <div style={{ display:"flex", gap:"2px" }}>
          {[["Home","#hero"],["How it works","#works"],["Roles","#roles"],["About","#about"],["Trace","#trace"]].map(([lbl,href]) => (
            <a key={lbl} href={href} className="nav-a">{lbl}</a>
          ))}
        </div>

        {/* Right */}
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          {/* MetaMask status */}
          {wallet ? (
            <div style={{ display:"flex", alignItems:"center", gap:"6px", background:"rgba(76,175,114,.18)", border:"1px solid rgba(76,175,114,.35)", borderRadius:"20px", padding:"5px 12px", fontSize:"12px", fontWeight:"600", color:"#a7f3c0", fontFamily:"monospace" }}>
              <span style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#4caf72", display:"inline-block", animation:"pdot 2s infinite" }}/>
              {short(wallet)}
            </div>
          ) : (
            <div style={{ display:"flex", alignItems:"center", gap:"6px", background:"rgba(255,255,255,.07)", borderRadius:"20px", padding:"5px 12px", fontSize:"12px", color:"rgba(255,255,255,.4)" }}>
              <span style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#6b7280", display:"inline-block" }}/>No wallet
            </div>
          )}
          {/* Dark mode */}
          <button onClick={() => setDark(d => !d)}
            title="Toggle dark mode"
            style={{ background:"rgba(255,255,255,.1)", border:"1px solid rgba(255,255,255,.18)", borderRadius:"8px", width:"32px", height:"32px", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:"15px", transition:"all .2s" }}>
            {dark ? "☀️" : "🌙"}
          </button>
          {/* Sign In */}
          <button onClick={onSignIn}
            style={{ background:"#4caf72", color:"#0b2614", border:"none", borderRadius:"10px", padding:"8px 20px", fontSize:"14px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit", transition:"all .2s", boxShadow:"0 2px 12px rgba(76,175,114,.35)" }}
            onMouseOver={e => { e.currentTarget.style.transform="translateY(-1px)"; e.currentTarget.style.boxShadow="0 6px 20px rgba(76,175,114,.5)"; }}
            onMouseOut={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 2px 12px rgba(76,175,114,.35)"; }}>
            Sign In
          </button>
        </div>
      </nav>

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section id="hero" style={{ position:"relative", minHeight:"100vh", background:T.hero, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"100px 24px 72px", textAlign:"center", overflow:"hidden" }}>
        <ParticleCanvas dark={dark} />
        {/* radial glow */}
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", background: dark ? "radial-gradient(ellipse 65% 55% at 50% 40%,rgba(76,175,114,.07),transparent)" : "radial-gradient(ellipse 70% 60% at 50% 40%,rgba(26,107,58,.04),transparent)" }}/>

        <div style={{ position:"relative", zIndex:1 }}>
          {/* badge */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:"7px", background: dark ? "rgba(76,175,114,.12)" : "rgba(255,255,255,.88)", border:`1px solid ${dark ? "rgba(76,175,114,.28)" : "#c2e0cc"}`, borderRadius:"50px", padding:"7px 20px", marginBottom:"28px", fontSize:"13px", fontWeight:"600", color: dark ? "#4caf72" : "#1a6b3a", backdropFilter:"blur(10px)", animation:"fadeUp .6s ease both", boxShadow:"0 2px 12px rgba(0,0,0,.05)" }}>
            ⚡ Powered by Ethereum Blockchain
          </div>

          {/* headline */}
          <h1 style={{ fontSize:"clamp(36px,7vw,70px)", fontWeight:"900", lineHeight:"1.08", letterSpacing:"-2px", color: dark ? "#e8f5ee" : "#0b2614", marginBottom:"20px", animation:"fadeUp .7s .1s both ease" }}>
            From Farm to Fork,<br />
            <span style={{ background:"linear-gradient(135deg,#1a6b3a,#4caf72,#2a9e58)", backgroundSize:"200%", animation:"gShift 4s ease infinite", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
              Fully Transparent
            </span>
          </h1>

          {/* sub */}
          <p style={{ fontSize:"17px", lineHeight:"1.75", color: dark ? "#6b9b7a" : "#3d6b4f", maxWidth:"560px", margin:"0 auto 40px", animation:"fadeUp .7s .2s both ease" }}>
            AgriChain connects farmers, distributors, retailers and consumers on a single blockchain-verified supply chain — so every produce has a traceable story.
          </p>

          {/* CTAs */}
          <div style={{ display:"flex", gap:"14px", justifyContent:"center", flexWrap:"wrap", marginBottom:"60px", animation:"fadeUp .7s .3s both ease" }}>
            <button className="cta-primary" onClick={onSignIn}>🦊 Sign In with Ethereum</button>
            <button className={`cta-outline${dark ? " dk" : ""}`} onClick={onRegister}>📋 Request Access</button>
          </div>

          {/* stats strip */}
          <div style={{ display:"flex", justifyContent:"center", flexWrap:"wrap", animation:"fadeUp .7s .4s both ease" }}>
            {[
              { val:"1,200+",     sub:"Batches registered" },
              { val:"4 roles",    sub:"On-chain verified"  },
              { val:"EIP-712",    sub:"Signed sessions"    },
              { val:"0 passwords",sub:"Wallet-native auth" },
            ].map((s,i) => (
              <div key={i} style={{ padding:"16px 30px", textAlign:"center", borderLeft: i>0 ? `1px solid ${dark?"rgba(76,175,114,.18)":"rgba(26,107,58,.14)"}` : "none" }}>
                <div style={{ fontSize:"22px", fontWeight:"800", color: dark?"#4caf72":"#1a3d1f", letterSpacing:"-0.5px" }}>{s.val}</div>
                <div style={{ fontSize:"12px", color: dark?"#6b9b7a":"#4b7a5a", marginTop:"3px" }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* scroll indicator */}
        <div style={{ position:"absolute", bottom:"28px", left:"50%", transform:"translateX(-50%)", display:"flex", flexDirection:"column", alignItems:"center", gap:"5px", animation:"float 2.5s ease-in-out infinite" }}>
          <div style={{ width:"28px", height:"44px", border:`2px solid ${dark?"rgba(76,175,114,.4)":"rgba(26,107,58,.3)"}`, borderRadius:"14px", display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:"6px" }}>
            <div style={{ width:"4px", height:"8px", borderRadius:"2px", background: dark?"#4caf72":"#1a6b3a", animation:"float 1.5s ease-in-out infinite" }}/>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          WHY AGRICHAIN
      ══════════════════════════════════════ */}
      <section id="about" style={{ padding:"90px 24px", background:T.altBg }}>
        <div style={{ maxWidth:"1040px", margin:"0 auto" }}>
          <SH label="Why AgriChain" title="Built for trust, transparency & scale" dark={dark} />
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:"20px", marginTop:"52px" }}>
            {WHY_CARDS.map((c,i) => (
              <div key={i} className="hov-lift" style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:"16px", padding:"28px 24px" }}>
                <div style={{ width:"48px", height:"48px", borderRadius:"14px", background:c.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px", marginBottom:"18px" }}>{c.icon}</div>
                <div style={{ fontWeight:"700", fontSize:"15px", color:T.text, marginBottom:"10px" }}>{c.title}</div>
                <div style={{ fontSize:"13px", color:T.muted, lineHeight:"1.7" }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          HOW IT WORKS (Chain)
      ══════════════════════════════════════ */}
      <section id="works" style={{ padding:"90px 24px", background:T.bg }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto" }}>
          <SH label="How It Works" title="One Chain, Four Roles" sub="Every produce batch is registered and tracked across the full supply chain, immutably recorded on Ethereum." dark={dark} />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", flexWrap:"wrap", marginTop:"56px" }}>
            {[
              { emoji:"🌾", title:"Farmer",      desc:"Registers batch with GPS, crop type & quantity", color:"#16a34a", bg: dark?"#0a2410":"#dcfce7" },
              { emoji:"🔬", title:"Inspector",   desc:"Verifies quality & freshness grade on-chain",    color:"#7c3aed", bg: dark?"#1a0f2e":"#ede9fe" },
              { emoji:"🚛", title:"Distributor", desc:"Logs every transport event on blockchain",        color:"#2563eb", bg: dark?"#0f1e3d":"#dbeafe" },
              { emoji:"🏪", title:"Retailer",    desc:"Confirms delivery & marks stock received",        color:"#ea580c", bg: dark?"#2a1200":"#ffedd5" },
              { emoji:"👤", title:"Customer",    desc:"Scans QR to trace the full provenance journey",  color:"#db2777", bg: dark?"#2d0820":"#fce7f3" },
            ].map((r,i,arr) => (
              <div key={i} style={{ display:"flex", alignItems:"center" }}>
                <div className="hov-lift" style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:"18px", padding:"24px 18px", textAlign:"center", width:"170px", position:"relative", overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,.04)" }}>
                  <div style={{ position:"absolute", top:"10px", right:"10px", width:"20px", height:"20px", borderRadius:"50%", background:r.color, color:"white", fontSize:"10px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center" }}>{i+1}</div>
                  <div style={{ width:"54px", height:"54px", borderRadius:"14px", background:r.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"24px", margin:"0 auto 14px", animation:`float 3s ease-in-out ${i*0.4}s infinite` }}>{r.emoji}</div>
                  <div style={{ fontWeight:"700", fontSize:"14px", color:r.color, marginBottom:"7px" }}>{r.title}</div>
                  <div style={{ fontSize:"11px", color:T.muted, lineHeight:"1.55" }}>{r.desc}</div>
                </div>
                {i < arr.length-1 && (
                  <div style={{ width:"44px", flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:"3px" }}>
                    <div style={{ height:"2px", width:"100%", background:"linear-gradient(90deg,#4caf72,#2a9e58)", boxShadow:"0 0 6px rgba(76,175,114,.35)", position:"relative" }}>
                      <span style={{ position:"absolute", right:"-5px", top:"-5px", fontSize:"11px", color:"#4caf72" }}>▶</span>
                    </div>
                    <span style={{ fontSize:"8px", color:"#4caf72", fontWeight:"700", opacity:.65 }}>on-chain</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          LIVE FEED
      ══════════════════════════════════════ */}
      <section id="roles" style={{ padding:"90px 24px", background:T.altBg }}>
        <div style={{ maxWidth:"820px", margin:"0 auto" }}>
          <SH label="Live On-Chain Activity" title="Real-time blockchain feed" sub="Watch transactions hit the Sepolia Testnet — live." dark={dark} />
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:"20px", overflow:"hidden", boxShadow:"0 4px 24px rgba(0,0,0,.06)", marginTop:"44px" }}>
            <div style={{ padding:"15px 22px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", background: dark?"rgba(76,175,114,.04)":"#fafdf8" }}>
              <span style={{ fontWeight:"700", fontSize:"15px", color:T.text }}>Recent transactions</span>
              <div style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"13px", fontWeight:"700", color:"#16a34a" }}>
                <span style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#16a34a", display:"inline-block", animation:"pdot 1.5s infinite" }}/>Live
              </div>
            </div>
            {feed.slice(0,6).map((item,i) => (
              <div key={item.key} className="feed-row" style={{ padding:"15px 22px", borderBottom: i<5?`1px solid ${dark?"rgba(255,255,255,.04)":"#f0f7f2"}`:"none", display:"flex", alignItems:"center", gap:"14px", background: i===0?(dark?"rgba(76,175,114,.07)":"rgba(220,252,231,.35)"):"transparent", transition:"background .3s" }}>
                <div style={{ width:"40px", height:"40px", borderRadius:"11px", background:item.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"19px", flexShrink:0 }}>{item.emoji}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:"600", fontSize:"13px", color:T.text, marginBottom:"2px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.label}</div>
                  <div style={{ fontSize:"11px", color:T.muted, fontFamily:"monospace" }}>{item.addr} · Sepolia Testnet</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ padding:"3px 10px", borderRadius:"6px", fontSize:"11px", fontWeight:"700", background:item.bg, color:item.color, marginBottom:"3px" }}>{item.type}</div>
                  <div style={{ fontSize:"11px", color:T.muted }}>{item.time || "just now"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          JOURNEY VISUALIZER + QR DEMO
      ══════════════════════════════════════ */}
      <section id="trace" style={{ padding:"90px 24px", background:T.bg }}>
        <div style={{ maxWidth:"760px", margin:"0 auto" }}>
          <SH label="Produce Journey" title="Trace Any Batch" sub="Enter a batch ID to see the full farm-to-fork journey pulled live from the Sepolia blockchain." dark={dark} />

          {/* input */}
          <div style={{ display:"flex", gap:"12px", marginTop:"44px", marginBottom:"28px", flexWrap:"wrap" }}>
            <input value={batchId} onChange={e => setBatchId(e.target.value)}
              placeholder="e.g. 1000 or AC-2041"
              style={{ flex:1, minWidth:"160px", padding:"13px 18px", border:`2px solid ${dark?"#2a4a2e":"#c2dfc9"}`, borderRadius:"12px", outline:"none", background: dark?"#1a2e1e":"white", color:T.text, fontFamily:"monospace", fontSize:"15px", fontWeight:"600", transition:"border .2s" }}
              onFocus={e => e.target.style.borderColor="#4caf72"}
              onBlur={e  => e.target.style.borderColor = dark?"#2a4a2e":"#c2dfc9"}
              onKeyDown={e => e.key==="Enter" && handleTrace()}
            />
            <button onClick={handleTrace}
              style={{ background:"linear-gradient(135deg,#1a6b3a,#4caf72)", color:"white", border:"none", borderRadius:"12px", padding:"13px 26px", fontSize:"15px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:"8px", boxShadow:"0 4px 16px rgba(26,107,58,.3)" }}>
              🔍 Trace on Blockchain
            </button>
          </div>

          {/* info box */}
          <div style={{ background: dark?"rgba(76,175,114,.08)":"rgba(220,252,231,.5)",
            border:`1px solid ${dark?"rgba(76,175,114,.2)":"#c2dfc9"}`,
            borderRadius:"16px", padding:"32px", textAlign:"center", color:T.muted }}>
            <div style={{ fontSize:"44px", marginBottom:"14px" }}>🔗</div>
            <div style={{ fontSize:"16px", fontWeight:"700", color:T.text, marginBottom:"8px" }}>Live Blockchain Trace</div>
            <div style={{ fontSize:"13px", lineHeight:"1.75", maxWidth:"420px", margin:"0 auto" }}>
              Enter any batch ID and click "Trace on Blockchain" to see the real supply chain journey — farm origin, quality inspection, distributor handoffs and delivery — all pulled live from Sepolia Testnet. No MetaMask needed.
            </div>
            <div style={{ marginTop:"18px", display:"flex", gap:"10px", justifyContent:"center", flexWrap:"wrap" }}>
              {["No MetaMask needed","Immutable records","Real-time data"].map(tag => (
                <span key={tag} style={{ background: dark?"rgba(76,175,114,.15)":"white",
                  border:`1px solid ${dark?"rgba(76,175,114,.3)":"#c2dfc9"}`,
                  borderRadius:"20px", padding:"4px 14px", fontSize:"12px",
                  fontWeight:"600", color:dark?"#4caf72":"#1a3d1f" }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>



      {/* ══════════════════════════════════════
          IMPACT STATS
      ══════════════════════════════════════ */}
      <section ref={statsRef} style={{ padding:"90px 24px", background:T.altBg }}>
        <div style={{ maxWidth:"960px", margin:"0 auto" }}>
          <SH label="Our Impact" title="Numbers that matter" dark={dark} />
          {/* Live badge */}
          <div style={{ display:"flex", justifyContent:"center", marginTop:12, marginBottom:36 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:11,
              fontWeight:700, color:"#16a34a", background:dark?"rgba(22,163,74,.12)":"#dcfce7",
              border:"1px solid #86efac", borderRadius:50, padding:"4px 14px" }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:"#16a34a",
                display:"inline-block", animation:"pdot 1.5s infinite" }}/>
              Live on Sepolia Testnet · {realStats.batches === null ? "Fetching…" : "Updated just now"}
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))", gap:"20px" }}>
            {[
              { icon:"🌾", val: realStats.batches   === null ? "…" : cBatches.toLocaleString(),         label:"Batches registered", sub:"on-chain" },
              { icon:"⚖️", val: realStats.totalKg   === null ? "…" : cKg.toLocaleString()+" kg",        label:"Produce traced",     sub:"total quantity" },
              { icon:"🔬", val: realStats.certs      === null ? "…" : realStats.certs.toLocaleString(),  label:"Certs issued",       sub:"quality verified" },
              { icon:"⛓️", val: realStats.transfers  === null ? "…" : cTx.toLocaleString(),              label:"Transfers logged",   sub:"blockchain txns" },
            ].map((s,i) => (
              <div key={i} className="hov-lift" style={{ background:T.card, border:`1px solid ${T.border}`,
                borderRadius:16, padding:"28px 20px", textAlign:"center", position:"relative" }}>
                <div style={{ fontSize:32, marginBottom:12 }}>{s.icon}</div>
                <div style={{ fontSize:30, fontWeight:800, color:dark?"#4caf72":"#1a3d1f",
                  letterSpacing:"-1px", lineHeight:1, marginBottom:6 }}>
                  {s.val === "…"
                    ? <span style={{ display:"inline-flex", gap:3 }}>
                        {[0,1,2].map(j => <span key={j} style={{ width:6,height:6,borderRadius:"50%",
                          background:dark?"#4caf72":"#1a6b3a", display:"inline-block",
                          animation:`pdot 1.2s ease ${j*0.2}s infinite` }}/>)}
                      </span>
                    : s.val}
                </div>
                <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:3 }}>{s.label}</div>
                <div style={{ fontSize:10, color:T.muted }}>{s.sub}</div>
                <div style={{ position:"absolute", bottom:0, left:"20%", right:"20%", height:2,
                  background:"linear-gradient(90deg,transparent,#4caf72,transparent)", borderRadius:1 }}/>
              </div>
            ))}
          </div>

          {/* Blockchain block visualizer */}
          <div style={{ marginTop:"60px" }}>
            <div style={{ fontSize:"12px", fontWeight:"700", color:"#4caf72", letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:"20px" }}>What a block looks like</div>
            <div style={{ display:"flex", gap:"14px", flexWrap:"wrap" }}>
              {BLOCKS.map((block,bi) => (
                <div key={bi} className="hov-lift" style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:"14px", padding:"18px", flex:"1", minWidth:"200px", maxWidth:"240px", fontFamily:"monospace" }}>
                  <div style={{ fontSize:"9px", color:"#4caf72", fontWeight:"700", letterSpacing:"1px", marginBottom:"10px" }}>BLOCK {block.num}</div>
                  {block.rows.map((row,ri) => (
                    <div key={ri} style={{ marginBottom:"6px" }}>
                      <div style={{ fontSize:"9px", color:T.muted, textTransform:"uppercase", letterSpacing:"0.5px" }}>{row.k}</div>
                      <div style={{ fontSize:"12px", fontWeight:"600", color: row.c || T.text }}>{row.v}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════ */}
      <section style={{ padding:"90px 24px", background:T.bg }}>
        <div style={{ maxWidth:"1000px", margin:"0 auto" }}>
          <SH label="What People Say" title="Trusted by farmers, retailers & customers" dark={dark} />
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:"20px", marginTop:"48px" }}>
            {TESTIMONIALS.map((t2,i) => (
              <div key={i} className="hov-lift" style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:"16px", padding:"28px", position:"relative" }}>
                {/* stars */}
                <div style={{ fontSize:"16px", color:"#f59e0b", marginBottom:"14px", letterSpacing:"2px" }}>★★★★★</div>
                <p style={{ fontSize:"14px", lineHeight:"1.75", color:T.muted, marginBottom:"22px", fontStyle:"italic" }}>"{t2.quote}"</p>
                <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                  <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:t2.bg, border:`2px solid ${t2.color}40`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"700", fontSize:"13px", color:t2.color, flexShrink:0 }}>{t2.initials}</div>
                  <div>
                    <div style={{ fontWeight:"700", fontSize:"14px", color:T.text }}>{t2.name}</div>
                    <div style={{ fontSize:"12px", color:T.muted }}>{t2.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          TECH STACK
      ══════════════════════════════════════ */}
      <section style={{ padding:"80px 24px", background:T.altBg }}>
        <div style={{ maxWidth:"980px", margin:"0 auto" }}>
          <SH label="Built With" title="Technology stack" dark={dark} />
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:"14px", marginTop:"44px" }}>
            {TECH_STACK.map((tech,i) => (
              <div key={i} className="hov-lift" style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:"14px", padding:"18px 20px", display:"flex", alignItems:"center", gap:"14px" }}>
                <div style={{ width:"44px", height:"44px", borderRadius:"12px", background: dark?`${tech.color}18`:tech.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px", flexShrink:0, border:`1px solid ${tech.color}30` }}>{tech.icon}</div>
                <div>
                  <div style={{ fontWeight:"700", fontSize:"15px", color:T.text }}>{tech.name}</div>
                  <div style={{ fontSize:"12px", color: dark?tech.color:T.muted }}>{tech.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Dark mode preview */}
          <div style={{ marginTop:"52px" }}>
            <div style={{ fontSize:"12px", fontWeight:"700", color:"#4caf72", letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:"18px" }}>Dark mode preview</div>
            <div style={{ display:"flex", gap:"16px", flexWrap:"wrap" }}>
              {[false, true].map(dm => (
                <div key={String(dm)} style={{ flex:1, minWidth:"240px", background: dm?"#1a3d1f":"white", border:`1px solid ${dm?"#2a5c38":"#e4ede6"}`, borderRadius:"14px", overflow:"hidden" }}>
                  <div style={{ background: dm?"#132d1a":"#1a4a28", padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:"13px", fontWeight:"700", color:"white" }}>AgriChain</span>
                    <span style={{ fontSize:"11px", color:"rgba(255,255,255,.5)", background:"rgba(255,255,255,.1)", padding:"2px 8px", borderRadius:"4px" }}>{dm?"Dark mode":"Light mode"}</span>
                  </div>
                  <div style={{ padding:"16px" }}>
                    <div style={{ background: dm?"rgba(76,175,114,.1)":"#f0f7f2", borderRadius:"8px", padding:"12px", border:`1px solid ${dm?"rgba(76,175,114,.2)":"#d0e9d7"}` }}>
                      <div style={{ fontWeight:"600", fontSize:"13px", color: dm?"#e8f5ee":"#1a2e1a" }}>Batch #AC-2041</div>
                      <div style={{ fontSize:"12px", color: dm?"#6b9b7a":"#4b7a5a", marginTop:"3px" }}>Status: Delivered · Pune → Mumbai</div>
                    </div>
                  </div>
                  <div style={{ padding:"0 16px 12px", textAlign:"center" }}>
                    <span style={{ fontSize:"11px", color: dm?"#4caf72":"#4b7a5a" }}>{dm?"Dark mode":"Light mode"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          TEAM
      ══════════════════════════════════════ */}
      <section id="team" style={{ padding:"90px 24px", background:T.bg }}>
        <div style={{ maxWidth:"1060px", margin:"0 auto" }}>
          <SH label="The Team" title="Built by final year students" sub="Engineering students passionate about blockchain & food security." dark={dark} />
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:"20px", marginTop:"48px" }}>
            {TEAM.map((m,i) => (
              <div key={i} className="hov-lift" style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:"18px", padding:"32px 20px 24px", textAlign:"center" }}>
                {/* Avatar — photo or initials */}
                {m.photo ? (
                  <div style={{ width:"90px", height:"90px", borderRadius:"50%", margin:"0 auto 18px", overflow:"hidden", border:`3px solid ${m.color}`, boxShadow:`0 0 0 4px ${m.color}22` }}>
                    <img
                      src={m.photo}
                      alt={m.name}
                      style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center top" }}
                    />
                  </div>
                ) : (
                  <div style={{ width:"90px", height:"90px", borderRadius:"50%", background: dark?`${m.color}22`:m.bg, border:`3px solid ${m.color}55`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"800", fontSize:"26px", color:m.color, margin:"0 auto 18px", boxShadow:`0 0 0 4px ${m.color}15` }}>{m.initials}</div>
                )}
                <div style={{ fontWeight:"700", fontSize:"15px", color:T.text, marginBottom:"5px" }}>{m.name}</div>
                <div style={{ fontSize:"12px", color:m.color, fontWeight:"600", marginBottom:"12px" }}>{m.role}</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:"4px", justifyContent:"center" }}>
                  {m.tags.map((tag,ti) => (
                    <span key={ti} className="tag" style={{ background: dark?`${m.color}18`:m.bg, color:m.color, border:`1px solid ${m.color}35` }}>{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FAQ
      ══════════════════════════════════════ */}
      <section style={{ padding:"90px 24px", background:T.altBg }}>
        <div style={{ maxWidth:"760px", margin:"0 auto" }}>
          <SH label="FAQ" title="Common Questions" dark={dark} />
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:"16px", overflow:"hidden", boxShadow:"0 4px 16px rgba(0,0,0,.04)", marginTop:"44px" }}>
            {FAQS.map((item,i) => (
              <div key={i} style={{ borderBottom: i<FAQS.length-1?`1px solid ${T.border}`:"none" }}>
                <button className="faq-btn" onClick={() => setOpenFaq(openFaq===i?null:i)}
                  style={{ color: dark ? (openFaq===i?"#4caf72":T.text) : (openFaq===i?"#1a6b3a":T.text), background: openFaq===i?(dark?"rgba(76,175,114,.07)":"#f8fdf8"):"transparent" }}>
                  <span style={{ flex:1, paddingRight:"16px", lineHeight:"1.4" }}>{item.q}</span>
                  <span style={{ width:"24px", height:"24px", borderRadius:"50%", flexShrink:0, background: openFaq===i?"#4caf72":(dark?"#1e3a22":"#e8f5ee"), color: openFaq===i?"white":"#4caf72", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"17px", fontWeight:"300", transition:"all .3s", transform: openFaq===i?"rotate(45deg)":"none" }}>+</span>
                </button>
                <div style={{ maxHeight: openFaq===i?"400px":"0", overflow:"hidden", transition:"max-height .4s ease" }}>
                  <div style={{ padding:"0 22px 18px", fontSize:"14px", color:T.muted, lineHeight:"1.75" }}>{item.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer style={{ background:"#0b2614", color:"rgba(255,255,255,.6)", padding:"60px 24px 40px" }}>
        <div style={{ maxWidth:"1060px", margin:"0 auto" }}>
          <div style={{ display:"flex", gap:"44px", flexWrap:"wrap", marginBottom:"44px" }}>
            <div style={{ flex:"2", minWidth:"230px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"9px", marginBottom:"14px" }}>
                <div style={{ width:"32px", height:"32px", borderRadius:"9px", background:"linear-gradient(135deg,#4caf72,#1a6b3a)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px" }}>🌱</div>
                <span style={{ fontSize:"17px", fontWeight:"800", color:"white" }}>AgriChain</span>
              </div>
              <p style={{ fontSize:"13px", lineHeight:"1.75", color:"rgba(255,255,255,.4)", maxWidth:"270px" }}>Blockchain-based agricultural supply chain transparency. Making food traceability accessible to everyone.</p>
              <a href="https://github.com/Adityajadhav1607/agri-chain" target="_blank" rel="noreferrer"
                style={{ display:"inline-flex", alignItems:"center", gap:"6px", marginTop:"16px", background:"rgba(255,255,255,.08)", border:"1px solid rgba(255,255,255,.12)", borderRadius:"9px", padding:"8px 16px", color:"white", textDecoration:"none", fontSize:"13px", fontWeight:"600", transition:"all .2s" }}
                onMouseOver={e => e.currentTarget.style.background="rgba(255,255,255,.14)"}
                onMouseOut={e => e.currentTarget.style.background="rgba(255,255,255,.08)"}>
                ⚡ View on GitHub
              </a>
            </div>
            {[
              { title:"Platform", links:["Home","How it Works","Roles","Trace Produce"] },
              { title:"Network",  links:["Sepolia Testnet","MetaMask","Etherscan","IPFS"] },
              { title:"Resources",links:["Documentation","Smart Contracts","API Reference","GitHub"] },
            ].map((col,ci) => (
              <div key={ci} style={{ flex:"1", minWidth:"130px" }}>
                <div style={{ fontWeight:"700", color:"white", fontSize:"12px", textTransform:"uppercase", letterSpacing:"1px", marginBottom:"16px" }}>{col.title}</div>
                {col.links.map((lnk,li) => (
                  <div key={li} style={{ marginBottom:"9px" }}>
                    {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                    <a href="#" style={{ color:"rgba(255,255,255,.42)", textDecoration:"none", fontSize:"13px", transition:"color .2s" }}
                      onMouseOver={e => e.currentTarget.style.color="#4caf72"}
                      onMouseOut={e => e.currentTarget.style.color="rgba(255,255,255,.42)"}>{lnk}</a>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop:"1px solid rgba(255,255,255,.07)", paddingTop:"22px", display:"flex", flexWrap:"wrap", justifyContent:"space-between", alignItems:"center", gap:"12px" }}>
            <div style={{ fontSize:"12px", color:"rgba(255,255,255,.28)" }}>© 2025 AgriChain · Final Year Engineering Project · Built with ❤️</div>
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
              {["Ethereum","Sepolia Testnet","EIP-712","Solidity ^0.8"].map((b,i) => (
                <span key={i} style={{ background:"rgba(76,175,114,.1)", border:"1px solid rgba(76,175,114,.2)", borderRadius:"20px", padding:"3px 10px", fontSize:"11px", color:"#4caf72" }}>{b}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>
      <FloatingAIBot dark={dark} />
    </div>
  );
}
