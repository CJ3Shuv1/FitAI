"use client";

import { useEffect, useRef, useState } from "react";
import type { GlobeInstance } from "globe.gl";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { countryName, iso3ForFeature } from "@/lib/world/countries";
import { statusMeta, type LatLng, type WorldStatus } from "@/lib/world/types";

type CountryFeature = Feature<Geometry, { name: string; iso3: string | null }>;

export type GlobeRoute = { iso3: string; title: string; points: LatLng[] };
export type GlobeMarker = LatLng & {
  iso3: string;
  kind: "place" | "photo";
  label: string;
};
type RenderedMarker = LatLng & {
  iso3: string;
  kind: "place" | "photo" | "country";
  label: string;
  color?: string;
};

const ROUTE_COLOR = "#E0603A";
// Countries whose outline spans less than this many degrees are too small
// to see or hit at normal zoom, so marked ones also get a dot.
const TINY_COUNTRY_DEG = 1.6;

// Weak devices keep the same 50m outlines (so small states like Malta or
// Liechtenstein always exist) but render with a lower pixel ratio, no
// antialiasing and coarser curvature.
function isLowEnd() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (
    (nav.hardwareConcurrency ?? 8) <= 4 ||
    (nav.deviceMemory ?? 8) <= 4 ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function largestRing(geometry: Geometry): Position[] | null {
  const rings: Position[][] =
    geometry.type === "Polygon"
      ? [geometry.coordinates[0]]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates.map((p) => p[0])
        : [];
  return rings.sort((a, b) => b.length - a.length)[0] ?? null;
}

// Rough visual centre and extent from the largest outer ring. Good enough to
// aim the camera and to spot tiny countries; not a true centroid.
function shapeOf(geometry: Geometry): { centre: LatLng; extent: number } | null {
  const ring = largestRing(geometry);
  if (!ring || ring.length === 0) return null;
  let lng = 0;
  let lat = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    lng += x;
    lat += y;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return {
    centre: { lat: lat / ring.length, lng: lng / ring.length },
    extent: Math.max(maxX - minX, maxY - minY),
  };
}

function cssVar(el: HTMLElement, name: string, fallback: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

export default function GlobeView({
  statusByIso3,
  selectedIso3,
  routes,
  markers,
  onSelect,
}: {
  statusByIso3: Record<string, WorldStatus>;
  selectedIso3: string | null;
  routes: GlobeRoute[];
  markers: GlobeMarker[];
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
          import("world-atlas/countries-50m.json"),
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
          .polygonCapCurvatureResolution(low ? 12 : 5)
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
          })
          // Routes: lines through the waypoints read from the Maps links.
          .pathPoints((d) => (d as GlobeRoute).points)
          .pathPointLat((p) => (p as LatLng).lat)
          .pathPointLng((p) => (p as LatLng).lng)
          .pathPointAlt(0.02)
          .pathColor(() => ROUTE_COLOR)
          .pathStroke(low ? null : 0.35)
          .pathTransitionDuration(0)
          // Places, photo locations and tiny countries: tappable dots.
          .htmlAltitude(0.025)
          .htmlTransitionDuration(0)
          .htmlElement((d) => {
            const m = d as RenderedMarker;
            const dot = document.createElement("button");
            dot.type = "button";
            dot.title = m.label;
            dot.setAttribute("aria-label", m.label);
            const base =
              "pointer-events:auto;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%);border-radius:50%;";
            if (m.kind === "country") {
              dot.style.cssText =
                base + `width:14px;height:14px;background:${m.color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.5);`;
            } else {
              dot.textContent = m.kind === "photo" ? "📷" : "📍";
              dot.style.cssText =
                base + "width:26px;height:26px;font-size:15px;line-height:1;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.55);";
            }
            dot.addEventListener("click", (e) => {
              e.stopPropagation();
              onSelectRef.current(m.iso3);
            });
            return dot;
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

  // Recolour when entries or the selection change; fly to a new selection.
  useEffect(() => {
    statusRef.current = statusByIso3;
    const previous = selectedRef.current;
    selectedRef.current = selectedIso3;
    const globe = globeRef.current;
    const el = containerRef.current;
    if (!globe || !el || state !== "ready") return;

    const land = cssVar(el, "--hairline", "#3A3730");
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

    if (selectedIso3 && selectedIso3 !== previous) {
      const feature = featuresRef.current.find((f) => f.properties.iso3 === selectedIso3);
      const shape = feature ? shapeOf(feature.geometry) : null;
      if (shape) {
        const tiny = shape.extent < TINY_COUNTRY_DEG;
        globe.controls().autoRotate = false;
        globe.pointOfView(
          { ...shape.centre, altitude: Math.min(globe.pointOfView().altitude, tiny ? 0.6 : 1.6) },
          700
        );
      }
    }
  }, [statusByIso3, selectedIso3, state]);

  // Routes and markers.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || state !== "ready") return;

    const tinyCountries: RenderedMarker[] = [];
    for (const f of featuresRef.current) {
      const iso3 = f.properties.iso3;
      const status = iso3 ? statusByIso3[iso3] : undefined;
      if (!iso3 || !status) continue;
      const shape = shapeOf(f.geometry);
      if (shape && shape.extent < TINY_COUNTRY_DEG) {
        tinyCountries.push({
          ...shape.centre,
          iso3,
          kind: "country",
          label: countryName(iso3),
          color: statusMeta(status).color,
        });
      }
    }

    globe.pathsData(routes).htmlElementsData([...tinyCountries, ...markers]);
  }, [routes, markers, statusByIso3, state]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        role="img"
        aria-label="Drehbarer Globus mit deinen markierten Ländern, Routen und Orten. Die Länder stehen zusätzlich als Liste darunter."
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
