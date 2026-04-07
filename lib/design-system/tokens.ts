export const FONT_FAMILIES = {
  regular: "Inter-Regular",
  medium: "Inter-Medium",
  semibold: "Inter-SemiBold",
  bold: "Inter-Bold",
} as const;

export const SPACING_TOKENS = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
} as const;

export const RADIUS_TOKENS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 28,
  full: 999,
} as const;

export const SHADOW_TOKENS = {
  card: {
    ios: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
    },
    android: {
      elevation: 8,
    },
  },
} as const;

export const COLOR_TOKENS = {
  light: {
    "bg.base": "#fbfcfc",
    "bg.modal": "#fdfefe",
    "bg.input": "#e5e6e5",
    "bg.popup": "#32373d",
    "text.primary": "#27282c",
    "text.secondary": "#45464a",
    "border.default": "#cbcccd",
    "primary.default": "#007aff",
    "primary.soft": "#72a8fe",
    "btn.secondary": "#d7e2f2",
    "icon.inbox": "#99d6f5",
  },
  dark: {
    "bg.base": "#101318",
    "bg.modal": "#252a30",
    "bg.input": "#3d424a",
    "bg.popup": "#32373d",
    "text.primary": "#dbdee5",
    "text.secondary": "#999da4",
    "border.default": "#0d1114",
    "primary.default": "#4387f4",
    "primary.soft": "#72a8fe",
    "btn.secondary": "#515862",
    "icon.inbox": "#47a2d1",
  },
} as const;

export type ColorMode = keyof typeof COLOR_TOKENS;
export type ColorTokenName = keyof (typeof COLOR_TOKENS)["light"];

export const TEXT_COLOR_TONES = {
  default: "var(--color-text-primary)",
  muted: "var(--color-text-secondary)",
  inverse: "var(--color-text-primary)",
  accent: "var(--color-primary-default)",
  danger: "var(--color-text-primary)",
  success: "var(--color-text-primary)",
} as const;

export type TextTone = keyof typeof TEXT_COLOR_TONES;
