/**
 * SatelliteView.jsx — Farm Passport Map Component
 * Shows a react-leaflet map of the farm's GPS location.
 * If a FarmPassport NFT has been minted, displays an on-chain verified badge.
 */
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icon broken by webpack
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl       from "leaflet/dist/images/marker-icon.png";
import shadowUrl     from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

// Custom green marker icon for farm
const farmIcon = new L.Icon({
  iconUrl:       "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl,
  iconSize:      [25, 41],
  iconAnchor:    [12, 41],
  popupAnchor:   [1, -34],
  shadowSize:    [41, 41],
});

export default function SatelliteView({ gpsCoordinates, farmLocation, batchId, passport }) {
  // Parse "lat,lon" string
  const coords = gpsCoordinates ? gpsCoordinates.split(",").map(s => parseFloat(s.trim())) : null;
  const lat    = coords && !isNaN(coords[0]) ? coords[0] : null;
  const lon    = coords && !isNaN(coords[1]) ? coords[1] : null;
  const valid  = lat !== null && lon !== null;

  const mapsUrl = valid
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=13/${lat}/${lon}`
    : null;

  return (
    <div style={{ marginTop: 20, fontFamily: "'Segoe UI', sans-serif" }}>
      <style>{`
        @keyframes nftPulse { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)} 50%{box-shadow:0 0 0 8px rgba(34,197,94,0)} }
        @keyframes mapFadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .farm-map-card { animation: mapFadeIn 0.5s ease forwards; }
        .leaflet-container { border-radius: 0 0 12px 12px; }
      `}</style>

      <div className="farm-map-card" style={{
        border: "1px solid #e5e1d8", borderRadius: 12, overflow: "hidden",
        background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}>

        {/* Header */}
        <div style={{
          padding: "14px 20px", background: "linear-gradient(135deg, #1a6b3a 0%, #2d8a52 100%)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "white", margin: 0 }}>
              🗺️ Farm Passport — Satellite View
            </h2>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 3 }}>
              {passport ? "Geo-anchored NFT — verified on Sepolia blockchain" : "Farm location recorded at batch registration"}
            </p>
          </div>

          {/* NFT Status Badge */}
          {passport ? (
            <div style={{
              background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8,
              padding: "6px 12px", textAlign: "center",
              animation: "nftPulse 2.5s ease infinite",
            }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", marginBottom: 2 }}>ON-CHAIN NFT</div>
              <div style={{ fontSize: 12, color: "white", fontWeight: 700 }}>🎖️ #{passport.tokenId}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)" }}>Minted {passport.mintedAt}</div>
            </div>
          ) : valid ? (
            <div style={{
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8, padding: "6px 12px", textAlign: "center",
            }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>📍 Location</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>Recorded</div>
            </div>
          ) : null}
        </div>

        {valid ? (
          <>
            {/* Map */}
            <div style={{ position: "relative", height: 260 }}>
              <MapContainer
                center={[lat, lon]}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={false}
                zoomControl={true}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <Marker position={[lat, lon]} icon={farmIcon}>
                  <Popup>
                    <div style={{ fontSize: 13, minWidth: 160 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>🌾 {farmLocation || "Farm Location"}</div>
                      {batchId && <div style={{ fontSize: 11, color: "#6b7280" }}>Batch #{batchId}</div>}
                      {passport && (
                        <div style={{ marginTop: 6, padding: "3px 8px", background: "#d1fae5", borderRadius: 4, fontSize: 11, color: "#065f46", fontWeight: 600 }}>
                          🎖️ Farm Passport NFT #{passport.tokenId}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>

              {/* Overlay: NFT verified stamp */}
              {passport && (
                <div style={{
                  position: "absolute", top: 10, right: 10, zIndex: 1000,
                  background: "rgba(26, 107, 58, 0.92)", backdropFilter: "blur(6px)",
                  borderRadius: 8, padding: "6px 10px", border: "1px solid rgba(255,255,255,0.3)",
                }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)" }}>🔗 On-chain verified</div>
                  <div style={{ fontSize: 11, color: "white", fontWeight: 700 }}>AFP #{passport.tokenId}</div>
                </div>
              )}
            </div>

            {/* Footer info */}
            <div style={{
              padding: "12px 20px", background: "#fafaf8", borderTop: "1px solid #e5e1d8",
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  background: "#e8f5ee", color: "#1a6b3a", padding: "4px 12px",
                  borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: "monospace",
                }}>
                  📍 {lat.toFixed(4)}°N, {lon.toFixed(4)}°E
                </span>
                {farmLocation && (
                  <span style={{ fontSize: 12, color: "#6b7280" }}>{farmLocation}</span>
                )}
              </div>
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  color: "#1a6b3a", fontSize: 12, fontWeight: 600,
                  textDecoration: "none", padding: "5px 12px",
                  border: "1px solid #4caf72", borderRadius: 7,
                  transition: "all 0.2s",
                }}>
                🔗 Open in Maps
              </a>
            </div>
          </>
        ) : (
          /* No GPS State */
          <div style={{ padding: "36px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📍</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              No GPS coordinates recorded
            </div>
            <div style={{ fontSize: 13, color: "#9ca3af", maxWidth: 320, margin: "0 auto" }}>
              When registering a batch, enable GPS to geo-anchor it on-chain and mint a Farm Passport NFT visible here.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
