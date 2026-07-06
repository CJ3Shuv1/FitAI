export type ThemeName = "copper" | "ocean" | "forest" | "berry" | "mono";

export const THEME_LABELS: Record<ThemeName, string> = {
  copper: "Copper",
  ocean: "Ocean",
  forest: "Forest",
  berry: "Berry",
  mono: "Mono",
};

type ThemeVars = {
  bg: string;
  surface: string;
  surfaceRaised: string;
  hairline: string;
  text: string;
  textDim: string;
  textFaint: string;
  steel: string;
  accent: string;
  accentDim: string;
  good: string;
};

export const THEMES: Record<ThemeName, ThemeVars> = {
  copper: {
    bg: "#15140F",
    surface: "#1E1D17",
    surfaceRaised: "#262420",
    hairline: "#3A3730",
    text: "#EDE8DD",
    textDim: "#9C9588",
    textFaint: "#6B665C",
    steel: "#8B95A1",
    accent: "#D97B3F",
    accentDim: "#5E3A24",
    good: "#7FA66B",
  },
  ocean: {
    bg: "#0E1620",
    surface: "#152230",
    surfaceRaised: "#1C2C3D",
    hairline: "#2E4257",
    text: "#E4EEF7",
    textDim: "#93AAC0",
    textFaint: "#63788C",
    steel: "#8FA8C7",
    accent: "#3FA6D9",
    accentDim: "#254A5E",
    good: "#6BA695",
  },
  forest: {
    bg: "#12160F",
    surface: "#1A2016",
    surfaceRaised: "#22291D",
    hairline: "#37402F",
    text: "#E9EDE2",
    textDim: "#9BAA8D",
    textFaint: "#6B7960",
    steel: "#93A18B",
    accent: "#7FB13F",
    accentDim: "#3A4E24",
    good: "#6BA66B",
  },
  berry: {
    bg: "#170F16",
    surface: "#211721",
    surfaceRaised: "#2B1E2B",
    hairline: "#402F3F",
    text: "#EEE2EC",
    textDim: "#AA8DA6",
    textFaint: "#79606F",
    steel: "#A18B9E",
    accent: "#D93F8E",
    accentDim: "#5E244A",
    good: "#7FA66B",
  },
  mono: {
    bg: "#121212",
    surface: "#1B1B1B",
    surfaceRaised: "#242424",
    hairline: "#383838",
    text: "#ECECEC",
    textDim: "#9C9C9C",
    textFaint: "#6B6B6B",
    steel: "#9A9A9A",
    accent: "#D9D9D9",
    accentDim: "#4A4A4A",
    good: "#7FA66B",
  },
};

export function themeCssVars(theme: ThemeName): Record<string, string> {
  const t = THEMES[theme] ?? THEMES.copper;
  return {
    "--bg": t.bg,
    "--surface": t.surface,
    "--surface-raised": t.surfaceRaised,
    "--hairline": t.hairline,
    "--text": t.text,
    "--text-dim": t.textDim,
    "--text-faint": t.textFaint,
    "--steel": t.steel,
    "--copper": t.accent,
    "--copper-dim": t.accentDim,
    "--good": t.good,
  };
}
