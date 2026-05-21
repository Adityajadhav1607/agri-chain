import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

/**
 * MapView — Leaflet route map for batch journey.
 * Plots pins at farm, distribution hub, retailer.
 * Uses dynamic import to avoid SSR issues.
 */
export default function MapView({ steps = [], height = 320 }) {
  const mapRef    = useRef(null);
  const mapObj    = useRef(null);
  const [ready, setReady] = useState(false);

  // Default India center if no coordinates
  const CENTER = [20.5937, 78.9629];
  const ZOOM   = 5;

  useEffect(() => {
    if (mapObj.current) return; // Already initialized

    let L;
    import("leaflet").then((mod) => {
      L = mod.default;

      // Fix default icon URLs broken by webpack
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current).setView(CENTER, ZOOM);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      mapObj.current = { map, L };

      // Draw markers + polyline if steps provided
      if (steps.length > 0) {
        const coords = steps.filter(s => s.lat && s.lng).map(s => [s.lat, s.lng]);

        const ICONS = {
          farm:  { emoji: "🌾", color: "#1a6b3a" },
          hub:   { emoji: "🏭", color: "#b45309" },
          store: { emoji: "🏪", color: "#1e40af" },
        };

        steps.forEach((step) => {
          if (!step.lat || !step.lng) return;
          const iconInfo = ICONS[step.type] || { emoji: "📍", color: "#374151" };
          const icon = L.divIcon({
            html: `<div style="background:${iconInfo.color};color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${iconInfo.emoji}</div>`,
            className: "",
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });
          L.marker([step.lat, step.lng], { icon })
           .addTo(map)
           .bindPopup(`<strong>${step.title}</strong><br/><span style="color:#6b7280;font-size:12px">${step.meta || ""}</span>`);
        });

        if (coords.length >= 2) {
          L.polyline(coords, { color: "#1a6b3a", weight: 3, dashArray: "8 6", opacity: 0.7 }).addTo(map);
          map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
        }
      }

      setReady(true);
    });

    return () => {
      if (mapObj.current?.map) {
        mapObj.current.map.remove();
        mapObj.current = null;
      }
    };
  }, []); // eslint-disable-line

  return (
    <div style={{ position: "relative" }}>
      {!ready && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          background: "#f4f6f0", display: "flex", alignItems: "center",
          justifyContent: "center", borderRadius: 8, height,
        }}>
          <div style={{ color: "#6b7280", fontSize: "13px" }}>🗺️ Loading map...</div>
        </div>
      )}
      <div ref={mapRef} style={{ height, borderRadius: 8, zIndex: 1 }} />
    </div>
  );
}
