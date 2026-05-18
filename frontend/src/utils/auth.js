import { ethers } from "ethers";
import ProduceRegistryABI from "./ProduceRegistry.json";
import TrackTransferABI   from "./TrackTransfer.json";
import QualityVerifierABI from "./QualityVerifier.json";
import { REGISTRY_ADDRESS, TRACKER_ADDRESS, VERIFIER_ADDRESS } from "./addresses";

const SESSION_KEY = "agrichain_session";

const ROLE_HASHES = {
  admin:       ethers.keccak256(ethers.toUtf8Bytes("ADMIN")),
  farmer:      ethers.keccak256(ethers.toUtf8Bytes("FARMER")),
  distributor: ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR")),
  retailer:    ethers.keccak256(ethers.toUtf8Bytes("RETAILER")),
  inspector:   ethers.keccak256(ethers.toUtf8Bytes("INSPECTOR")),
};

export function saveSession(account, role, signature) {
  const session = {
    account,
    role,
    signature,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    issuedAt:  Date.now(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch { return null; }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/** Reads the actual role from the blockchain for a given address. */
export async function getRoleFromChain(address) {
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);

    const registry = new ethers.Contract(REGISTRY_ADDRESS, ProduceRegistryABI.abi, provider);
    const tracker  = new ethers.Contract(TRACKER_ADDRESS,  TrackTransferABI.abi,   provider);
    const verifier = new ethers.Contract(VERIFIER_ADDRESS, QualityVerifierABI.abi, provider);

    // Admin check first (admin of registry = deployer)
    if (await registry.hasRole(ROLE_HASHES.admin, address))       return "admin";
    // Role checks across contracts
    if (await registry.hasRole(ROLE_HASHES.farmer, address))      return "farmer";
    if (await tracker.hasRole(ROLE_HASHES.distributor, address))  return "distributor";
    if (await tracker.hasRole(ROLE_HASHES.retailer, address))     return "retailer";
    if (await verifier.hasRole(ROLE_HASHES.inspector, address))   return "inspector";

    return "customer";
  } catch (e) {
    console.error("getRoleFromChain error:", e);
    return "unknown";
  }
}

export async function switchNetwork() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x7A69" }],
    });
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId:        "0x7A69",
          chainName:      "Hardhat Local",
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls:        ["http://127.0.0.1:8545"],
        }],
      });
    }
  }
}

export async function signInWithEthereum() {
  if (!window.ethereum) throw new Error("MetaMask not found. Please install MetaMask.");

  await switchNetwork();

  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  const address  = accounts[0];

  const nonce    = Math.random().toString(36).slice(2, 10).toUpperCase();
  const issuedAt = new Date().toISOString();
  const message  = [
    "AgriChain wants you to sign in with your Ethereum account:",
    address,
    "",
    "Sign in to AgriChain Supply Chain Platform",
    "",
    `URI: ${window.location.origin}`,
    "Version: 1",
    "Chain ID: 31337",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");

  const provider  = new ethers.BrowserProvider(window.ethereum);
  const signer    = await provider.getSigner();
  const signature = await signer.signMessage(message);

  const recovered = ethers.verifyMessage(message, signature);
  if (recovered.toLowerCase() !== address.toLowerCase()) {
    throw new Error("Signature verification failed");
  }

  const role = await getRoleFromChain(address);
  if (!role) throw new Error("Could not determine role");

  clearSession();
  return saveSession(address.toLowerCase(), role, signature);
}