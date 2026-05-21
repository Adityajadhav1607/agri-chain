import { useState, useEffect, useRef } from "react";

export default function FloatingAIBot({ dark }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "bot",
      text: "👋 Hello! I am AgriBot, your personal blockchain assistant. How can I help you trace, register, or navigate the AgriChain ecosystem today? 🌾",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Show tooltips occasionally to engage the user
    const timer = setTimeout(() => {
      setShowTooltip(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom of chat
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const QUICK_PROMPTS = [
    { text: "🌾 What is AgriChain?", id: "what_is" },
    { text: "🔑 What is EIP-712?", id: "eip_712" },
    { text: "👥 How do roles work?", id: "roles" },
    { text: "🦊 MetaMask & Sepolia?", id: "metamask" }
  ];

  const handleQuickPrompt = (id) => {
    let question = "";
    let answer = "";

    switch (id) {
      case "what_is":
        question = "What is AgriChain and how does it work?";
        answer = "🌾 **AgriChain** is a decentralized, blockchain-powered agricultural supply chain platform. It acts as an immutable ledger to track produce batches from farm to retail.\n\nEvery batch registered on the system is cryptographic, hashed, and signed on the **Ethereum blockchain**. This ensures total transparency and eliminates middlemen tampering with harvest records, locations, and inspection states!";
        break;
      case "eip_712":
        question = "What is EIP-712 typed session signing?";
        answer = "🔑 **EIP-712 Typed Signing** is a standard for presenting human-readable transaction messages inside MetaMask instead of unreadable hex bytes.\n\nAgriChain leverages EIP-712 signatures to provide **passwordless, wallet-native logins**. This initiates a secure 24-hour cryptographic session so you can confirm actions without paying gas fees or repeating wallet clicks for every single supply chain event!";
        break;
      case "roles":
        question = "How do different user roles operate?";
        answer = "👥 AgriChain features **four core verified roles**:\n\n1. 🌾 **Farmer**: Registers newly harvested batches with crop species, weight, and harvest location.\n2. 🔬 **Inspector**: Audits product quality on-chain and signs a graded safety verification.\n3. 🚛 **Distributor**: Logs dispatch dates and updates batch transit locations.\n4. 🏪 **Retailer**: Scans the batch code and confirms receipt at stores.\n\n👤 **Customers** can scan the batch QR code to instantly pull up this complete, tamper-proof history directly in their browser!";
        break;
      case "metamask":
        question = "How do I setup MetaMask and Sepolia Testnet?";
        answer = "🦊 **MetaMask** serves as your digital identity. To use AgriChain:\n\n1. Install the MetaMask extension or mobile app.\n2. Switch your network to the **Sepolia Testnet** inside the wallet.\n3. To trigger on-chain transactions for free, request test Ethereum coins using a faucet like `sepoliafaucet.com` or `infura.io/faucet`.\n\nNo real money is needed—all gas fees are simulated for demonstration purposes!";
        break;
      default:
        return;
    }

    sendUserMessage(question, answer);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const userText = inputVal.trim();
    setInputVal("");
    
    // Simple rule-based chatbot logic
    let answer = "🤖 I'm still learning! For detailed questions about the smart contracts, please ask about 'roles', 'MetaMask', 'EIP-712', or 'AgriChain'. You can also request access on the register page!";
    const text = userText.toLowerCase();

    if (text.includes("hello") || text.includes("hi") || text.includes("hey")) {
      answer = "👋 Hey there! Let me know if you have questions about blockchain traceability, MetaMask connection, or how farmers and inspectors interact on AgriChain.";
    } else if (text.includes("agrichain") || text.includes("what is this") || text.includes("how it works")) {
      answer = "🌾 **AgriChain** is a Web3 traceability app. It secures produce supply chains by hashing registration, quality control, logistics, and retail delivery on Ethereum's Sepolia test network. Customers scan a QR code to view the final, verified path!";
    } else if (text.includes("eip-712") || text.includes("eip712") || text.includes("signature") || text.includes("sign")) {
      answer = "🔑 AgriChain implements **EIP-712 standard signatures** so you don't need user accounts or passwords. You just sign a typed data structure once to launch a secure 24-hour web session.";
    } else if (text.includes("role") || text.includes("farmer") || text.includes("distributor") || text.includes("inspector") || text.includes("retailer")) {
      answer = "👥 Verified roles coordinate the supply chain:\n- **Farmers** register crops.\n- **Inspectors** grade freshness.\n- **Distributors** update coordinates.\n- **Retailers** accept delivery.\nAll transitions are locked to blockchain blocks!";
    } else if (text.includes("metamask") || text.includes("sepolia") || text.includes("wallet") || text.includes("testnet")) {
      answer = "🦊 MetaMask is the portal for our dApp. Make sure to select **Sepolia Testnet** and fetch some test ETH. If you're on the wrong network, the header will guide you to switch with one click!";
    } else if (text.includes("team") || text.includes("aditya") || text.includes("vijay") || text.includes("creator")) {
      answer = "💻 AgriChain was designed and built by a highly skilled team of engineers: **Aditya Jadhav** (Full Stack & Blockchain), **Vijay Yadav** (Smart Contracts), **Sagar Jagadale** (UI/UX & Backend), **Harshad Jadhav** (Blockchain), and **Harshal Katkar** (Frontend UI).";
    } else if (text.includes("smart contract") || text.includes("solidity") || text.includes("hardhat")) {
      answer = "⚙️ Our smart contracts are built in **Solidity**, compiled and tested using **Hardhat**, and deployed on **Sepolia Testnet**. We use standard access control models to securely partition roles on-chain.";
    }

    sendUserMessage(userText, answer);
  };

  const sendUserMessage = (userText, botAnswer) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Add user message
    setMessages(prev => [...prev, { id: Date.now(), sender: "user", text: userText, time }]);
    setShowTooltip(false);

    // Simulate bot typing delay
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: "bot", text: botAnswer, time }]);
    }, 1200);
  };

  // Color theme tokens based on app state
  const theme = {
    bubbleBg: "linear-gradient(135deg, #1a6b3a 0%, #4caf72 100%)",
    bubbleHoverBg: "linear-gradient(135deg, #1d4a24 0%, #3e9e5c 100%)",
    glow: "0 8px 32px rgba(76, 175, 114, 0.4)",
    cardBg: dark ? "rgba(22, 40, 25, 0.95)" : "rgba(255, 255, 255, 0.97)",
    cardBorder: dark ? "1px solid rgba(76, 175, 114, 0.28)" : "1px solid rgba(26, 107, 58, 0.15)",
    text: dark ? "#e8f5ee" : "#1a2e1a",
    muted: dark ? "#94c2a4" : "#4b7a5a",
    userBubbleBg: "linear-gradient(135deg, #1a6b3a 0%, #2a9e58 100%)",
    botBubbleBg: dark ? "rgba(255, 255, 255, 0.08)" : "#f0f7f2",
    inputBg: dark ? "rgba(13, 31, 17, 0.8)" : "#ffffff",
    inputBorder: dark ? "rgba(76, 175, 114, 0.3)" : "rgba(26, 107, 58, 0.2)"
  };

  return (
    <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 9999, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      {/* ── STYLES FOR THE BOT ── */}
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes scale-up {
          from { opacity: 0; transform: scale(0.8) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .bot-bubble {
          animation: bounce-slow 4s ease-in-out infinite;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .bot-bubble:hover {
          transform: scale(1.1) rotate(5deg);
        }
        .message-bubble {
          white-space: pre-line;
          line-height: 1.5;
        }
        .message-bubble strong {
          color: inherit;
          font-weight: 700;
        }
        .chat-input::placeholder {
          color: ${dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"};
        }
        .quick-reply-btn {
          background: ${dark ? "rgba(255, 255, 255, 0.05)" : "#ffffff"};
          border: 1px solid ${theme.inputBorder};
          color: ${theme.text};
          padding: 8px 12px;
          border-radius: 18px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-block;
          text-align: left;
        }
        .quick-reply-btn:hover {
          background: ${dark ? "rgba(76, 175, 114, 0.15)" : "rgba(76, 175, 114, 0.1)"};
          border-color: #4caf72;
          transform: translateY(-2px);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"};
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4caf72;
        }
      `}</style>

      {/* ── TOOLTIP HINT ── */}
      {showTooltip && !isOpen && (
        <div style={{
          position: "absolute",
          bottom: "76px",
          right: "10px",
          background: theme.cardBg,
          color: theme.text,
          border: theme.cardBorder,
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          borderRadius: "16px",
          padding: "12px 18px",
          fontSize: "13px",
          fontWeight: "600",
          width: "220px",
          textAlign: "center",
          animation: "scale-up 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both",
          cursor: "pointer",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)"
        }}
        onClick={() => { setIsOpen(true); setShowTooltip(false); }}
        >
          <div style={{ position: "absolute", bottom: "-8px", right: "26px", width: "16px", height: "16px", background: theme.cardBg, borderRight: theme.cardBorder, borderBottom: theme.cardBorder, transform: "rotate(45deg)", zIndex: -1 }} />
          👋 Have a question about AgriChain? Ask me! 🌾
        </div>
      )}

      {/* ── FLOATING BUTTON (BUBBLE) ── */}
      {!isOpen && (
        <div className="bot-bubble"
          onClick={() => { setIsOpen(true); setShowTooltip(false); }}
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            background: theme.bubbleBg,
            boxShadow: theme.glow,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px",
            position: "relative",
            zIndex: 100
          }}
        >
          🤖
          <span style={{
            position: "absolute",
            top: "2px",
            right: "2px",
            width: "12px",
            height: "12px",
            background: "#ef4444",
            borderRadius: "50%",
            border: "2px solid white",
            boxShadow: "0 0 10px rgba(239, 68, 68, 0.8)"
          }} />
        </div>
      )}

      {/* ── CHATBOX WINDOW ── */}
      {isOpen && (
        <div style={{
          width: "380px",
          height: "550px",
          borderRadius: "24px",
          background: theme.cardBg,
          border: theme.cardBorder,
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "scale-up 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) both",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          zIndex: 101
        }}>
          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg, #1a6b3a 0%, #1e4d2b 100%)",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "white"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>🤖</div>
              <div>
                <div style={{ fontWeight: "700", fontSize: "15px", display: "flex", alignItems: "center", gap: "6px" }}>
                  AgriBot Assistant
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4caf72", display: "inline-block", animation: "fade-in 1s infinite alternate" }} />
                </div>
                <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.7)" }}>AI Smart Assistant</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                fontSize: "18px",
                cursor: "pointer",
                padding: "4px",
                opacity: 0.8,
                transition: "opacity 0.2s"
              }}
              onMouseOver={e => e.currentTarget.style.opacity = 1}
              onMouseOut={e => e.currentTarget.style.opacity = 0.8}
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div className="custom-scrollbar" style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px"
          }}>
            {messages.map((m) => (
              <div key={m.id} style={{
                display: "flex",
                flexDirection: "column",
                alignItems: m.sender === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                alignSelf: m.sender === "user" ? "flex-end" : "flex-start"
              }}>
                <div className="message-bubble" style={{
                  padding: "12px 16px",
                  borderRadius: m.sender === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: m.sender === "user" ? theme.userBubbleBg : theme.botBubbleBg,
                  color: m.sender === "user" ? "white" : theme.text,
                  fontSize: "13px",
                  boxShadow: m.sender === "user" ? "0 4px 12px rgba(26,107,58,0.2)" : "none",
                  border: m.sender === "bot" ? theme.cardBorder : "none"
                }}>
                  {m.text}
                </div>
                <span style={{ fontSize: "10px", color: theme.muted, marginTop: "4px", padding: "0 4px" }}>{m.time}</span>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div style={{
                display: "flex",
                gap: "4px",
                alignItems: "center",
                background: theme.botBubbleBg,
                border: theme.cardBorder,
                padding: "12px 18px",
                borderRadius: "18px 18px 18px 4px",
                width: "fit-content",
                alignSelf: "flex-start"
              }}>
                <span style={{ width: "6px", height: "6px", background: "#4caf72", borderRadius: "50%", animation: "bounce-slow 1.2s infinite ease-in-out" }} />
                <span style={{ width: "6px", height: "6px", background: "#4caf72", borderRadius: "50%", animation: "bounce-slow 1.2s infinite ease-in-out 0.2s" }} />
                <span style={{ width: "6px", height: "6px", background: "#4caf72", borderRadius: "50%", animation: "bounce-slow 1.2s infinite ease-in-out 0.4s" }} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies Strip */}
          <div style={{
            padding: "0 20px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "6px"
          }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "#4caf72", textTransform: "uppercase", letterSpacing: "0.5px" }}>Quick Help Topics</div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px"
            }}>
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p.id}
                  className="quick-reply-btn"
                  onClick={() => handleQuickPrompt(p.id)}
                >
                  {p.text}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <form
            onSubmit={handleSendMessage}
            style={{
              padding: "15px 20px 20px",
              borderTop: theme.cardBorder,
              display: "flex",
              gap: "8px"
            }}
          >
            <input
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="Type your message here..."
              className="chat-input"
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: "14px",
                background: theme.inputBg,
                border: `1px solid ${theme.inputBorder}`,
                color: theme.text,
                fontSize: "13px",
                outline: "none",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)",
                transition: "border-color 0.2s"
              }}
              onFocus={e => e.currentTarget.style.borderColor = "#4caf72"}
              onBlur={e => e.currentTarget.style.borderColor = theme.inputBorder}
            />
            <button
              type="submit"
              style={{
                background: theme.userBubbleBg,
                border: "none",
                borderRadius: "14px",
                width: "42px",
                height: "42px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "white",
                boxShadow: "0 4px 12px rgba(26,107,58,0.25)",
                transition: "all 0.2s"
              }}
              onMouseOver={e => e.currentTarget.style.transform = "translateY(-1px)"}
              onMouseOut={e => e.currentTarget.style.transform = "none"}
            >
              ➔
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
