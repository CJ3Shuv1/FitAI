// Shared JSX for every app icon (favicon, apple-touch-icon, manifest icons),
// rendered via next/og's ImageResponse (satori). The barbell mark comes from
// the original Silverback favicon, in FitAI's copper/steel palette.
//
// Two variants:
//  - "any":      rounded-square badge, mark fills most of it (browser tabs,
//                desktop install, Android "any" purpose).
//  - "maskable": full-bleed square, mark scaled into the centre safe zone so
//                Android's circle/squircle masks and iOS's corner rounding
//                never clip it.
export type IconVariant = "any" | "maskable";

export function BarbellIcon({
  size,
  variant = "any",
}: {
  size: number;
  variant?: IconVariant;
}) {
  const k = variant === "maskable" ? 0.78 : 1;
  const plate = Math.round(size * 0.28 * k);
  const ring = Math.max(2, Math.round(size * 0.07 * k));
  const barHeight = Math.round(size * 0.14 * k);
  const barWidth = Math.round(size * 0.34 * k);

  const plateStyle = {
    width: plate,
    height: plate,
    borderRadius: "50%",
    border: `${ring}px solid #8B95A1`,
    display: "flex",
  } as const;

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: "linear-gradient(145deg, #1F1D17 0%, #15140F 60%, #0F0E0A 100%)",
        borderRadius: variant === "maskable" ? 0 : Math.round(size * 0.22),
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={plateStyle} />
        <div
          style={{
            width: barWidth,
            height: barHeight,
            background: "#D97B3F",
            borderRadius: Math.round(barHeight * 0.3),
            display: "flex",
          }}
        />
        <div style={plateStyle} />
      </div>
    </div>
  );
}
