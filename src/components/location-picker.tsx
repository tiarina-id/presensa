"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  /** Fallback center when no coordinate is set yet. */
  defaultCenter?: [number, number];
  className?: string;
}

// Simple pin as an inline SVG divIcon — avoids Leaflet's broken default image
// paths under bundlers and needs no external image requests.
const PIN_HTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="#0972d3" stroke="#fff" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>`;

export function LocationPicker({
  latitude,
  longitude,
  onChange,
  defaultCenter = [-6.2, 106.816], // Jakarta
  className,
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Initialize the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const start: [number, number] =
        latitude != null && longitude != null
          ? [latitude, longitude]
          : defaultCenter;

      const map = L.map(containerRef.current).setView(start, 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        html: PIN_HTML,
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 26],
      });

      const marker = L.marker(start, { draggable: true, icon }).addTo(map);
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        onChangeRef.current(lat, lng);
      });
      map.on("click", (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        onChangeRef.current(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      // Ensure correct sizing after layout settles.
      setTimeout(() => map.invalidateSize(), 0);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Sync marker when the coordinate is changed externally (e.g. "use my location").
  useEffect(() => {
    if (latitude == null || longitude == null) return;
    const marker = markerRef.current;
    const map = mapRef.current;
    if (!marker || !map) return;
    const current = marker.getLatLng();
    if (
      Math.abs(current.lat - latitude) > 1e-7 ||
      Math.abs(current.lng - longitude) > 1e-7
    ) {
      marker.setLatLng([latitude, longitude]);
      map.panTo([latitude, longitude]);
    }
  }, [latitude, longitude]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: 260, width: "100%", borderRadius: 8, zIndex: 0 }}
    />
  );
}
