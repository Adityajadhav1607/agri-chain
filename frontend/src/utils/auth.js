import { ethers } from "ethers";
import ProduceRegistryABI from "./ProduceRegistry.json";
import TrackTransferABI   from "./TrackTransfer.json";
import QualityVerifierABI from "./QualityVerifier.json";
import { REGISTRY_ADDRESS, TRACKER_ADDRESS, VERIFIER_ADDRESS } from "./addresses";

/** Thrown when window.ethereum is not available (MetaMask not installed). */
export class MetaMaskNotFoundError extends Error {
  constructor() {
    super("MetaMask not found. Please install MetaMask to continue.");
    this.name = "MetaMaskNotFoundError";
  }
}

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
    // Prefer BrowserProvider if MetaMask is available, else fall back to public RPC
    const provider = window.ethereum
      ? new ethers.BrowserProvider(window.ethereum)
      : new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");

    const registry = new ethers.Contract(REGISTRY_ADDRESS, ProduceRegistryABI.abi, provider);
    const tracker  = new ethers.Contract(TRACKER_ADDRESS,  TrackTransferABI.abi,   provider);
    const verifier = new ethers.Contract(VERIFIER_ADDRESS, QualityVerifierABI.abi, provider);

    // Admin: the deployer gets ADMIN_ROLE in constructor — check across all 3 contracts
    const [isAdminReg, isAdminTrk, isAdminVer] = await Promise.all([
      registry.hasRole(ROLE_HASHES.admin, address).catch(() => false),
      tracker.hasRole(ROLE_HASHES.admin,  address).catch(() => false),
      verifier.hasRole(ROLE_HASHES.admin, address).catch(() => false),
    ]);
    if (isAdminReg || isAdminTrk || isAdminVer) return "admin";

    // Farmer — ProduceRegistry
    if (await registry.hasRole(ROLE_HASHES.farmer, address).catch(() => false))      return "farmer";

    // Distributor & Retailer — TrackTransfer
    if (await tracker.hasRole(ROLE_HASHES.distributor, address).catch(() => false))  return "distributor";
    if (await tracker.hasRole(ROLE_HASHES.retailer,    address).catch(() => false))  return "retailer";

    // Inspector — check ALL three contracts (role may have been granted on any of them)
    const [isInspReg, isInspTrk, isInspVer] = await Promise.all([
      registry.hasRole(ROLE_HASHES.inspector, address).catch(() => false),
      tracker.hasRole(ROLE_HASHES.inspector,  address).catch(() => false),
      verifier.hasRole(ROLE_HASHES.inspector, address).catch(() => false),
    ]);
    console.log(`Inspector check for ${address}: registry=${isInspReg}, tracker=${isInspTrk}, verifier=${isInspVer}`);
    if (isInspReg || isInspTrk || isInspVer) return "inspector";

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
      params: [{ chainId: "0xAA36A7" }],
    });
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId:        "0xAA36A7",
          chainName:      "Sepolia Testnet",
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls:        ["https://rpc.sepolia.org"],
        }],
      });
    }
  }
}

export async function signInWithEthereum() {
  if (!window.ethereum) throw new MetaMaskNotFoundError();

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
    "Chain ID: 11155111",
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