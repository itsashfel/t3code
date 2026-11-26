import { getResolvedOrResolveTheme, registerCustomTheme, type DiffsTheme } from "@pierre/diffs";

/** pierre-light with every syntax color darkened until it reads on every light code surface. */
export const READABLE_LIGHT_THEME_NAME = "t3-light";

const MIN_CONTRAST = 4.5;
// The darkest light code surface is a changed word on a deleted line (#f8d3d4, luminance
// 0.71), rounded down for margin.
const DARKEST_SURFACE_LUMINANCE = 0.69;

function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function contrastOnLightCode(rgb: readonly [number, number, number]): number {
  const [r, g, b] = rgb.map(channelLuminance) as [number, number, number];
  return (DARKEST_SURFACE_LUMINANCE + 0.05) / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

/** Darkens a #rrggbb(aa) color in steps that keep its hue until it reads on light code. */
export function readableOnLightCode(color: string, minContrast = MIN_CONTRAST): string {
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(color);
  if (!match) return color;
  let rgb = [0, 2, 4].map((start) => Number.parseInt(match[1]!.slice(start, start + 2), 16)) as [
    number,
    number,
    number,
  ];
  if (contrastOnLightCode(rgb) >= minContrast) return color;
  while (contrastOnLightCode(rgb) < minContrast) {
    rgb = rgb.map((channel) => Math.floor(channel * 0.96)) as [number, number, number];
  }
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}${match[2] ?? ""}`;
}

type ZedTheme = NonNullable<DiffsTheme["zed"]>;

// Pairs that differ only in lightness would merge at one floor. The darker color of each pair
// goes further, keeping pierre-light's order: numbers stay darker than operators, punctuation
// darker than comments, and decorators darker than property names.
const FURTHER_COLORS = new Set(["#1ca1c7", "#636363", "#1a85d4"]);
const FURTHER_MIN_CONTRAST = 6;

/** The t3-light color for a pierre-light syntax color. */
export function readableSyntaxColor(color: string): string {
  return readableOnLightCode(
    color,
    FURTHER_COLORS.has(color.toLowerCase()) ? FURTHER_MIN_CONTRAST : MIN_CONTRAST,
  );
}

function withReadableSyntax(theme: ZedTheme): ZedTheme {
  const syntax = Object.fromEntries(
    Object.entries(theme.style.syntax ?? {}).map(([scope, style]) => [
      scope,
      typeof style === "string"
        ? readableSyntaxColor(style)
        : style.color
          ? { ...style, color: readableSyntaxColor(style.color) }
          : style,
    ]),
  );
  return { ...theme, name: READABLE_LIGHT_THEME_NAME, style: { ...theme.style, syntax } };
}

// Themes resolve on the main thread and reach the diff workers already resolved.
registerCustomTheme(
  READABLE_LIGHT_THEME_NAME,
  async () => {
    const base = await getResolvedOrResolveTheme("pierre-light", "highlights");
    if (!base.zed) throw new Error("pierre-light has no Highlights palette");
    return withReadableSyntax(base.zed);
  },
  "zed",
);

/** pierre-dark recolored to a vivid One Dark-style palette, sampled from Claude's code views. */
export const READABLE_DARK_THEME_NAME = "t3-dark";

// Keyed by pierre-dark's colors, which it reuses per role: keywords, strings, functions, types, and so on.
const DARK_SYNTAX_COLORS: Readonly<Record<string, string>> = {
  "#ff678d": "#cc7bf4",
  "#5ecc71": "#93d466",
  "#9d6afb": "#70b8ff",
  "#d568ea": "#eaecf0",
  "#ffa359": "#eaecf0",
  "#a3a3a3": "#dcdfe4",
  "#ffab16": "#e06c75",
  "#68cdf2": "#58d5d5",
  "#ffd452": "#e5c07b",
  "#08c0ef": "#c8ccd4",
  "#636363": "#b2b6bc",
  "#737373": "#8b93a3",
  "#ff855e": "#f5a85d",
  "#60d199": "#e06c75",
  "#009fff": "#70b8ff",
  "#61d5c0": "#eaa15a",
  "#64d1db": "#56b6c2",
  "#69b1ff": "#70b8ff",
  "#fafafa": "#eaecf0",
};

// Roles whose pierre-dark color is shared with a role that is recolored differently.
const DARK_SYNTAX_SCOPE_COLORS: Readonly<Record<string, string>> = {
  "punctuation.bracket": "#e8c547",
  "tag.component": "#f5a85d",
};

function withDarkSyntax(theme: ZedTheme): ZedTheme {
  const recolor = (color: string) => DARK_SYNTAX_COLORS[color.toLowerCase()] ?? color;
  const syntax = Object.fromEntries(
    Object.entries(theme.style.syntax ?? {}).map(([scope, style]) => {
      const scopeColor = DARK_SYNTAX_SCOPE_COLORS[scope];
      if (typeof style === "string") return [scope, scopeColor ?? recolor(style)];
      return [scope, style.color ? { ...style, color: scopeColor ?? recolor(style.color) } : style];
    }),
  );
  return {
    ...theme,
    name: READABLE_DARK_THEME_NAME,
    // A neutral current-line tint instead of pierre-dark's blue.
    style: { ...theme.style, syntax, "editor.active_line.background": "#ffffff0d" },
  };
}

registerCustomTheme(
  READABLE_DARK_THEME_NAME,
  async () => {
    const base = await getResolvedOrResolveTheme("pierre-dark", "highlights");
    if (!base.zed) throw new Error("pierre-dark has no Highlights palette");
    return withDarkSyntax(base.zed);
  },
  "zed",
);

type TextmateTheme = NonNullable<DiffsTheme["textmate"]>;

// Shiki, which file editors use, resolves themes separately from the diff highlighter.
registerCustomTheme(
  READABLE_DARK_THEME_NAME,
  async () => {
    const base = await getResolvedOrResolveTheme("pierre-dark", "shiki-js");
    if (!base.textmate) throw new Error("pierre-dark has no TextMate palette");
    const theme: TextmateTheme = {
      ...base.textmate,
      name: READABLE_DARK_THEME_NAME,
      colors: { ...base.textmate.colors, "editor.lineHighlightBackground": "#ffffff0d" },
      settings: base.textmate.settings.map((rule) => {
        const foreground = rule.settings.foreground;
        if (foreground === undefined) return rule;
        const recolored = DARK_SYNTAX_COLORS[foreground.toLowerCase()] ?? foreground;
        return { ...rule, settings: { ...rule.settings, foreground: recolored } };
      }),
    };
    return theme;
  },
  "textmate",
);
