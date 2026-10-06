"use client";

import { useEffect } from "react";

// Registers /sw.js (production only — no point caching-adjacent behaviour
// while developing). The worker is what lets Chrome offer a real "Install".
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability is a nicety; never break the app over it.
    });
  }, []);
  return null;
}
