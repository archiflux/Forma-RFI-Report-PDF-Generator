"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, Popup } from "maplibre-gl";
import { addCountLayer, CLUSTER, countRadius, createStreetMap, fitTo, pinsUnder, tip, zoomInto } from "@/lib/map/maplibre";
import { placeOf, type Grouping, type Universe3D } from "@/lib/three-d/universe";
import { mapPlaces } from "@/lib/three-d/map-places";

export interface MapPick {
  placeIds: string[];
  title: string;
  zoomIn: () => void;
}

// The 3D view's "Map": the same street map and splitting pins as the 2D
// dashboard, in the 3D view's dark palette. Each pin takes the colour of
// the most common "Organise by" group there; picking a group in the key
// shows only that group's records.
export default function UniverseMap({
  universe,
  grouping,
  highlight,
  resetKey = 0,
  onPick,
}: {
  universe: Universe3D;
  grouping: Grouping;
  highlight: number | null;
  resetKey?: number;
  // A tapped pin or cluster: the places it holds, and a way to zoom in.
  onPick: (pick: MapPick) => void;
}) {
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const host = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const places = useMemo(() => mapPlaces(universe, grouping, highlight), [universe, grouping, highlight]);
  const placesRef = useRef(places);
  placesRef.current = places;
  const unplaced = useMemo(() => universe.things.filter((t) => !placeOf(t, universe.locations)).length, [universe]);

  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    let popup: Popup | null = null;
    (async () => {
      if (!host.current) return;
      const made = await createStreetMap(host.current, "dark", () => cancelled || !host.current, { controls: false });
      if (!made) return;
      map = made.map;
      mapRef.current = made.map;
      if (made.offline) setOffline(true);
      popup = new made.ml.Popup({ closeButton: false, closeOnClick: true, offset: 14, maxWidth: "280px", className: "siteboard-dark-popup" });
      const m = made.map;
      m.on("load", () => {
        setReady(true);
        const show = (e: { lngLat: { lng: number; lat: number }; features?: Array<{ properties?: Record<string, unknown> }> }) => {
          const p = e.features?.[0]?.properties;
          if (!p || !popup) return;
          const { title, rows } = placesRef.current.describe(p);
          popup.setLngLat(e.lngLat).setDOMContent(tip(title, rows, true)).addTo(m);
        };
        // Tap a pin or cluster to list its records in the details panel.
        const pick = async (e: { lngLat: { lng: number; lat: number }; features?: Array<{ properties?: Record<string, unknown> }> }) => {
          const p = e.features?.[0]?.properties;
          const src = m.getSource("pins") as GeoJSONSource | undefined;
          if (!p || !src) return;
          popup?.remove();
          const pins = await pinsUnder(src, p);
          const at: [number, number] = [e.lngLat.lng, e.lngLat.lat];
          onPickRef.current({
            placeIds: pins.map((x) => String(x.id)),
            title: pins.length === 1 ? String(pins[0]?.name ?? "") : `${pins.length} places`,
            zoomIn: () => void zoomInto(m, src, p, at),
          });
        };
        m.on("click", "clusters", pick);
        m.on("click", "pins", pick);
        // Hover (mouse) for a quick breakdown.
        m.on("mousemove", "pins", show);
        m.on("mousemove", "clusters", show);
        for (const layer of ["clusters", "pins"]) {
          m.on("mouseenter", layer, () => {
            m.getCanvas().style.cursor = "pointer";
          });
          m.on("mouseleave", layer, () => {
            m.getCanvas().style.cursor = "";
            popup?.remove();
          });
        }
      });
    })();
    return () => {
      cancelled = true;
      popup?.remove();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Data and colours follow the grouping and the key's highlight.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const l of ["counts", "clusters", "pins"]) if (map.getLayer(l)) map.removeLayer(l);
    // clusterProperties are fixed when a source is created, so rebuild it
    // when the groups change.
    if (map.getSource("pins")) map.removeSource("pins");
    map.addSource("pins", { type: "geojson", data: places.geojson, ...CLUSTER, clusterProperties: places.clusterProperties });
    const radius = countRadius(places.maxTotal);
    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "pins",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": places.colour as never,
        "circle-radius": ["+", 3, radius] as never,
        "circle-stroke-color": "rgba(255,255,255,0.9)",
        "circle-stroke-width": 2.5,
        "circle-opacity": 0.92,
        "circle-blur": 0.05,
      },
    });
    map.addLayer({
      id: "pins",
      type: "circle",
      source: "pins",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": places.colour as never,
        "circle-radius": radius as never,
        "circle-stroke-color": "rgba(255,255,255,0.85)",
        "circle-stroke-width": 1.5,
        "circle-opacity": 0.95,
      },
    });
    addCountLayer(map, "pins");
  }, [places, ready]);

  // Frame the pins when the set of places changes (not on every highlight).
  const placesKey = places.coords.map((c) => c.join(",")).join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !places.coords.length) return;
    const w = map.getContainer().clientWidth;
    const phone = w < 640;
    // Room for the controls above and below, and for the biggest pins.
    fitTo(map, places.coords, { top: phone ? 220 : 160, bottom: phone ? 190 : 120, left: phone ? 50 : 300, right: phone ? 50 : 80 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesKey, ready, resetKey]);

  return (
    <div className="absolute inset-0 z-[5] bg-[#0a1a2c]">
      <div ref={host} style={{ position: "absolute", inset: 0 }} role="region" aria-label={`Map of ${universe.noun}`} />
      {offline || unplaced ? (
        <p className="pointer-events-none absolute right-3 top-48 max-w-[16rem] rounded-lg bg-[#0b1b2e]/80 px-3 py-2 text-right text-[11px] text-white/60 backdrop-blur-md sm:bottom-24 sm:right-6 sm:top-auto">
          {offline ? "Street map unavailable; showing pins only. " : ""}
          {unplaced ? `${unplaced.toLocaleString("en-GB")} ${universe.noun} have no location in Forma, so aren't shown.` : ""}
        </p>
      ) : null}
    </div>
  );
}
