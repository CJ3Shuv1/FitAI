"use client";

import { useEffect, useRef, useState } from "react";
import type { GlobeInstance } from "globe.gl";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { countryName, iso3ForFeature } from "@/lib/world/countries";
import { statusMeta, type WorldStatus } from "@/lib/world/types";

type CountryFeature = Feature<Geometry, { name: string; iso3: string | null }>;

// Weak devices get the coarse 110m outlines, a lower pixel ratio and less
// curvature subdivision; everything else gets the 50m set (incl. small
// states like Malta or Liechtenstein).
function isLowEnd() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (
    (nav.hardwareConcurrency ?? 8) <= 4 ||
    (nav.deviceMemory ?? 8) <= 4 ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Rough visual centre: mean of the largest outer ring. Good enough to aim
// the camera; not a true centroid.
function centreOf(geometry: Geometry): { lat: number; lng: number } | null {
  const rings: Position[][] =
    geometry.type === "Polygon"
      ? [geometry.coordinates[0]]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates.map((p) => p[0])
        : [];
  const ring = rings.sort((a, b) => b.length - a.length)[0];
  if (!ring || ring.length === 0) return null;
  let lng = 0;
  let lat = 0;
  for (const [x, y] of ring) {
    lng += x;
    lat += y;
  }
  return { lat: lat / ring.length, lng: lng / ring.length };
}

function cssVar(el: HTMLElement, name: string, fallback: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

export default function GlobeView({
  statusByIso3,
  selectedIso3,
  onSelect,
}: {
  statusByIso3: Record<string, WorldStatus>;
  selectedIso3: string | null;
  onSelect: (iso3: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeInstance | null>(null);
  const featuresRef = useRef<CountryFeature[]>([]);
  const statusRef = useRef(statusByIso3);
  const selectedRef = useRef(selectedIso3);
  const onSelectRef = useRef(onSelect);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Build the globe once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let disposed = false;
    let observer: ResizeObserver | null = null;
    let onVisibility: (() => void) | null = null;

    (async () => {
      try {
        const low = isLowEnd();
        const [{ default: Globe }, topojson, atlas] = await Promise.all([
          import("globe.gl"),
          import("topojson-client"),
          low ? import("world-atlas/countries-110m.json") : import("world-atlas/countries-50m.json"),
        ]);
        if (disposed) return;

        const topology = atlas.default as unknown as Topology<{
          countries: GeometryCollection<{ name: string }>;
        }>;
        const collection = topojson.feature(
          topology,
          topology.objects.countries
        ) as FeatureCollection<Geometry, { name: string }>;
        const features: CountryFeature[] = collection.features.map((f) => ({
          ...f,
          properties: { name: f.properties.name, iso3: iso3ForFeature(f.id, f.properties.name) },
        }));
        featuresRef.current = features;

        const ocean = cssVar(el, "--surface", "#1E1D17");
        const land = cssVar(el, "--hairline", "#3A3730");
        const stroke = cssVar(el, "--bg", "#15140F");
        const accent = cssVar(el, "--copper", "#D97B3F");

        const size = () => {
          const w = el.clientWidth;
          return { w, h: Math.round(Math.min(w, window.innerHeight * 0.5)) };
        };

        const globe = new Globe(el, {
          animateIn: false,
          rendererConfig: { antialias: !low, alpha: true, powerPreference: "low-power" },
        });
        globeRef.current = globe;

        const { w, h } = size();
        globe
          .width(w)
          .height(h)
          .backgroundColor("rgba(0,0,0,0)")
          .showAtmosphere(true)
          .atmosphereColor(accent)
          .atmosphereAltitude(0.12)
          .polygonsData(features)
          .polygonCapCurvatureResolution(low ? 10 : 5)
          .polygonsTransitionDuration(0)
          .polygonSideColor(() => "rgba(0,0,0,0.25)")
          .polygonStrokeColor(() => stroke)
          .polygonLabel((d) => {
            const p = (d as CountryFeature).properties;
            const label = p.iso3 ? countryName(p.iso3) : p.name;
            return `<div style="padding:4px 8px;border-radius:8px;background:rgba(0,0,0,0.75);color:#fff;font:600 12px system-ui">${label}</div>`;
          })
          .onPolygonClick((d) => {
            const iso3 = (d as CountryFeature).properties.iso3;
            if (iso3) onSelectRef.current(iso3);
          });

        (globe.globeMaterial() as unknown as { color: { set: (c: string) => void } }).color.set(ocean);
        globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, low ? 1.25 : 2));
        globe.pointOfView({ lat: 46, lng: 12, altitude: 1.55 }, 0);

        // Slow idle spin until the first touch/drag.
        const controls = globe.controls();
        controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        controls.autoRotateSpeed = 0.5;
        controls.addEventListener("start", () => {
          controls.autoRotate = false;
        });

        applyColors(globe, land);

        observer = new ResizeObserver(() => {
          const s = size();
          globe.width(s.w).height(s.h);
        });
        observer.observe(el);

        onVisibility = () => {
          if (document.hidden) globe.pauseAnimation();
          else globe.resumeAnimation();
        };
        document.addEventListener("visibilitychange", onVisibility);

        setState("ready");
      } catch {
        if (!disposed) setState("error");
      }
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      if (onVisibility) document.removeEventListener("visibilitychange", onVisibility);
      globeRef.current?._destructor();
      globeRef.current = null;
      el.replaceChildren();
    };
  }, []);

  function applyColors(globe: GlobeInstance, landColor?: string) {
    const el = containerRef.current;
    const land = landColor ?? (el ? cssVar(el, "--hairline", "#3A3730") : "#3A3730");
    globe
      .polygonCapColor((d) => {
        const iso3 = (d as CountryFeature).properties.iso3;
        const status = iso3 ? statusRef.current[iso3] : undefined;
        return status ? statusMeta(status).color : land;
      })
      .polygonAltitude((d) => {
        const iso3 = (d as CountryFeature).properties.iso3;
        if (iso3 && iso3 === selectedRef.current) return 0.035;
        return iso3 && statusRef.current[iso3] ? 0.014 : 0.006;
      });
  }

  // Recolour when entries or the selection change; fly to a new selection.
  useEffect(() => {
    statusRef.current = statusByIso3;
    const previous = selectedRef.current;
    selectedRef.current = selectedIso3;
    const globe = globeRef.current;
    if (!globe || state !== "ready") return;

    applyColors(globe);

    if (selectedIso3 && selectedIso3 !== previous) {
      const feature = featuresRef.current.find((f) => f.properties.iso3 === selectedIso3);
      const centre = feature ? centreOf(feature.geometry) : null;
      if (centre) {
        globe.controls().autoRotate = false;
        globe.pointOfView({ ...centre, altitude: Math.min(globe.pointOfView().altitude, 1.6) }, 700);
      }
    }
  }, [statusByIso3, selectedIso3, state]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        role="img"
        aria-label="Drehbarer Globus mit deinen markierten Ländern. Die Länder stehen zusätzlich als Liste darunter."
        className="mx-auto w-full touch-none select-none"
        style={{ minHeight: state === "ready" ? undefined : 260 }}
      />
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[12px] text-[var(--text-faint)]">
          Lade Globus…
        </div>
      )}
      {state === "error" && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-[var(--text-dim)]">
          Der 3D-Globus konnte auf diesem Gerät nicht geladen werden. Deine Länder
          kannst du trotzdem über die Liste und „Land eintragen“ verwalten.
        </div>
      )}
    </div>
  );
}
