import { ImageResponse } from "next/og";
import { BarbellIcon } from "@/lib/appIcon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS rounds the corners itself and renders transparent pixels black, so the
// apple-touch-icon must be a full-bleed square (the "maskable" variant).
export default function AppleIcon() {
  return new ImageResponse(<BarbellIcon size={180} variant="maskable" />, size);
}
