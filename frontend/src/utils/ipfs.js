/**
 * AgriChain IPFS Utility
 * Encodes NFT metadata as base64 data URIs (no Pinata API key required).
 * If you add a Pinata API key, it will upload to real IPFS instead.
 *
 * Supports:
 *  - ERC-721 Farm Passport metadata
 *  - ERC-1155 Carbon Credit metadata
 *  - base64 data URI encoding (works offline / no backend)
 *  - Pinata IPFS upload when API key is configured
 */

// ─────────────────────────────────────────────
// Configuration — add your Pinata API key here
// ─────────────────────────────────────────────
export const PINATA_API_KEY    = ""; // Add your Pinata API key here
export const PINATA_API_SECRET = ""; // Add your Pinata secret key here
const PINATA_ENDPOINT = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

// ─────────────────────────────────────────────
// 1. Farm Passport — ERC-721 Metadata
// ─────────────────────────────────────────────
/**
 * Build ERC-721 metadata for a Farm Passport NFT.
 *
 * @param {object} params
 * @param {string|number} params.batchId
 * @param {string} params.produceType
 * @param {string} params.farmLocation
 * @param {string} params.gpsCoordinates   - e.g. "19.0760,72.8777"
 * @param {string} params.farmerAddress    - 0x... wallet
 * @param {string} params.harvestDate      - human-readable date string
 * @param {string} [params.mapImageUrl]    - optional satellite/map image URL
 *
 * @returns {object} ERC-721 JSON metadata
 */
export function buildFarmPassportMetadata({
  batchId,
  produceType,
  farmLocation,
  gpsCoordinates,
  farmerAddress,
  harvestDate,
  mapImageUrl,
}) {
  const [lat, lon] = (gpsCoordinates || "0,0").split(",").map(s => s.trim());

  return {
    name: `AgriChain Farm Passport #${batchId}`,
    description:
      `Verified on-chain produce passport for ${produceType} harvested at ` +
      `${farmLocation} on ${harvestDate}. ` +
      `This NFT certifies the origin and authenticity of the agricultural batch ` +
      `tracked on the AgriChain supply chain platform.`,
    image: mapImageUrl || `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=13&size=400x250&markers=${lat},${lon}`,
    external_url: `https://agrichain.app/batch/${batchId}`,
    background_color: "1a6b3a",
    attributes: [
      { trait_type: "Batch ID",        value: String(batchId)        },
      { trait_type: "Produce Type",    value: produceType            },
      { trait_type: "Farm Location",   value: farmLocation           },
      { trait_type: "Harvest Date",    value: harvestDate            },
      { trait_type: "Farmer Address",  value: farmerAddress          },
      { trait_type: "GPS Latitude",    value: lat                    },
      { trait_type: "GPS Longitude",   value: lon                    },
      { trait_type: "GPS Coordinates", value: gpsCoordinates || "N/A"},
      { trait_type: "Blockchain",      value: "Ethereum Sepolia"     },
      { trait_type: "Platform",        value: "AgriChain v1"         },
      {
        display_type: "date",
        trait_type:   "Harvest Timestamp",
        value:        Math.floor(Date.now() / 1000),
      },
    ],
  };
}

// ─────────────────────────────────────────────
// 2. Carbon Credit — ERC-1155 Metadata
// ─────────────────────────────────────────────
/**
 * Build ERC-1155 metadata for a Carbon Credit NFT.
 *
 * @param {object} params
 * @param {string|number} params.batchId
 * @param {number}        params.co2Grams      - CO₂ offset in grams
 * @param {string}        params.farmerAddress
 * @param {string}        params.produceType
 * @param {number|string} params.issuedAt      - Unix timestamp (seconds)
 *
 * @returns {object} ERC-1155 JSON metadata
 */
export function buildCarbonCreditMetadata({
  batchId,
  co2Grams,
  farmerAddress,
  produceType,
  issuedAt,
}) {
  const co2Kg      = (co2Grams / 1000).toFixed(2);
  const treesEquiv = (co2Grams / 21000).toFixed(3);
  const issuedDate = issuedAt
    ? new Date(Number(issuedAt) * 1000).toLocaleDateString()
    : new Date().toLocaleDateString();

  return {
    name:        `AgriChain Carbon Credit — Batch #${batchId}`,
    description:
      `This carbon credit certifies that ${co2Kg} kg (${co2Grams.toLocaleString()} g) ` +
      `of CO₂ equivalent has been offset through the sustainable cultivation of ` +
      `${produceType} by farmer ${farmerAddress.slice(0, 10)}... on the AgriChain platform. ` +
      `Equivalent to approximately ${treesEquiv} trees planted per year.`,
    image: `https://agrichain.app/assets/carbon-credit-nft.svg`,
    decimals: 0,
    properties: {
      batch_id:      String(batchId),
      produce_type:  produceType,
      farmer:        farmerAddress,
      co2_grams:     co2Grams,
      co2_kg:        parseFloat(co2Kg),
      trees_equiv:   parseFloat(treesEquiv),
      issued_date:   issuedDate,
      standard:      "ERC-1155",
      chain:         "Ethereum Sepolia",
    },
    attributes: [
      { trait_type: "CO₂ Offset (g)",     value: co2Grams,              display_type: "number" },
      { trait_type: "CO₂ Offset (kg)",    value: parseFloat(co2Kg),     display_type: "number" },
      { trait_type: "Trees Equivalent",   value: parseFloat(treesEquiv), display_type: "number" },
      { trait_type: "Produce",            value: produceType            },
      { trait_type: "Batch ID",           value: String(batchId)        },
      { trait_type: "Farmer",             value: farmerAddress          },
      { trait_type: "Issued Date",        value: issuedDate             },
      { trait_type: "Verification",       value: "On-Chain AgriChain"   },
      {
        display_type: "date",
        trait_type:   "Issue Timestamp",
        value:        Number(issuedAt) || Math.floor(Date.now() / 1000),
      },
    ],
  };
}

// ─────────────────────────────────────────────
// 3. Encode metadata as base64 data URI
// ─────────────────────────────────────────────
/**
 * Encode a metadata object as a base64 data URI.
 * This works without any backend or IPFS gateway.
 *
 * @param {object} metadata - Any JSON-serializable metadata object
 * @returns {string}        - data:application/json;base64,... URI
 */
export function encodeMetadataAsDataUri(metadata) {
  const json = JSON.stringify(metadata, null, 2);
  // btoa works in browser; in Node use Buffer.from(json).toString('base64')
  const base64 =
    typeof btoa !== "undefined"
      ? btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json, "utf-8").toString("base64");
  return `data:application/json;base64,${base64}`;
}

// ─────────────────────────────────────────────
// 4. Upload to Pinata or fall back to data URI
// ─────────────────────────────────────────────
/**
 * Upload metadata to Pinata IPFS if API keys are configured.
 * Falls back to a base64 data URI otherwise.
 *
 * @param {object} metadata - JSON metadata object
 * @returns {Promise<string>} - IPFS URI (ipfs://...) or data: URI
 */
export async function uploadMetadata(metadata) {
  if (!PINATA_API_KEY || !PINATA_API_SECRET) {
    // No API key — return local data URI
    return encodeMetadataAsDataUri(metadata);
  }

  try {
    const response = await fetch(PINATA_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type":         "application/json",
        "pinata_api_key":        PINATA_API_KEY,
        "pinata_secret_api_key": PINATA_API_SECRET,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: {
          name: metadata.name || "AgriChain NFT Metadata",
          keyvalues: {
            platform: "AgriChain",
            version:  "1.0",
          },
        },
        pinataOptions: {
          cidVersion: 1,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Pinata upload failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return `ipfs://${data.IpfsHash}`;
  } catch (err) {
    console.warn("[AgriChain IPFS] Pinata upload failed, using data URI fallback:", err.message);
    return encodeMetadataAsDataUri(metadata);
  }
}

// ─────────────────────────────────────────────
// 5. Convenience: decode a data URI back to JSON
// ─────────────────────────────────────────────
/**
 * Decode a base64 data URI back to a metadata object.
 * Useful for reading back locally-encoded metadata.
 *
 * @param {string} dataUri - data:application/json;base64,... URI
 * @returns {object|null}
 */
export function decodeDataUri(dataUri) {
  try {
    if (!dataUri.startsWith("data:")) return null;
    const base64Part = dataUri.split(",")[1];
    const json =
      typeof atob !== "undefined"
        ? decodeURIComponent(escape(atob(base64Part)))
        : Buffer.from(base64Part, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}
