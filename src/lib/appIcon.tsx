// Shared JSX for the app icon (favicon/apple-touch-icon/manifest icons),
// rendered via next/og's ImageResponse (satori) at various sizes. Mirrors
// the barbell mark from the original Silverback favicon in FitAI's copper
// theme instead of steel/copper-on-black.
export function BarbellIcon({ size }: { size: number }) {
  const plate = Math.round(size * 0.28);
  const barHeight = Math.round(size * 0.14);
  const barWidth = Math.round(size * 0.34);

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#15140F",
        borderRadius: Math.round(size * 0.22),
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: plate,
            height: plate,
            borderRadius: "50%",
            border: `${Math.round(size * 0.07)}px solid #8B95A1`,
            display: "flex",
          }}
        />
        <div
          style={{
            width: barWidth,
            height: barHeight,
            background: "#D97B3F",
            borderRadius: Math.round(barHeight * 0.3),
            display: "flex",
          }}
        />
        <div
          style={{
            width: plate,
            height: plate,
            borderRadius: "50%",
            border: `${Math.round(size * 0.07)}px solid #8B95A1`,
            display: "flex",
          }}
        />
      </div>
    </div>
  );
}
