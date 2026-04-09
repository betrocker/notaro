import { PixelRatio, Platform, TextStyle } from "react-native";

import { FONT_FAMILIES } from "@/lib/design-system/tokens";

const ANDROID_FONT_SIZE_FACTOR = 0.94;
const round = (value: number) => Math.round(value * 100) / 100;

function normalizeDimension(value: number) {
  const corrected = Platform.OS === "android" ? value * ANDROID_FONT_SIZE_FACTOR : value;
  return round(PixelRatio.roundToNearestPixel(corrected));
}

type RawTextVariant = {
  size: number;
  lineHeight: number;
  letterSpacing: number;
  fontFamily: keyof typeof FONT_FAMILIES;
  maxFontSizeMultiplier?: number;
};

const CANONICAL_TYPOGRAPHY_VARIANTS = {
  largeTitle: {
    size: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
    fontFamily: "bold",
    maxFontSizeMultiplier: 1.15,
  },
  bodyLg: {
    size: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
    fontFamily: "semibold",
    maxFontSizeMultiplier: 1.2,
  },
  bodyMd: {
    size: 17,
    lineHeight: 22,
    letterSpacing: -0.16,
    fontFamily: "regular",
    maxFontSizeMultiplier: 1.25,
  },
  label: {
    size: 15,
    lineHeight: 20,
    letterSpacing: -0.08,
    fontFamily: "semibold",
    maxFontSizeMultiplier: 1.2,
  },
  labelSm: {
    size: 15,
    lineHeight: 20,
    letterSpacing: -0.08,
    fontFamily: "regular",
    maxFontSizeMultiplier: 1.2,
  },
  footer: {
    size: 13,
    lineHeight: 18,
    letterSpacing: -0.04,
    fontFamily: "regular",
    maxFontSizeMultiplier: 1.2,
  },
  tiny: {
    size: 11,
    lineHeight: 14,
    letterSpacing: -0.02,
    fontFamily: "regular",
    maxFontSizeMultiplier: 1.15,
  },
} as const satisfies Record<string, RawTextVariant>;

type CanonicalTypographyVariant = keyof typeof CANONICAL_TYPOGRAPHY_VARIANTS;

const TYPOGRAPHY_ALIASES = {
  displayXl: "largeTitle",
  displayLg: "largeTitle",
  titleLg: "bodyLg",
  titleMd: "bodyLg",
  titleSm: "bodyLg",
  bodyBase: "bodyMd",
  bodySm: "labelSm",
  labelMd: "label",
  caption: "footer",
  captionXs: "tiny",
  buttonMd: "label",
  buttonSm: "labelSm",
  onboardingTitle: "largeTitle",
} as const satisfies Record<string, CanonicalTypographyVariant>;

type AliasTypographyVariant = keyof typeof TYPOGRAPHY_ALIASES;
export type TypographyVariant = CanonicalTypographyVariant | AliasTypographyVariant;

type ResolvedTypography = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  maxFontSizeMultiplier: number;
};

function resolveRawVariant(variant: RawTextVariant): ResolvedTypography {
  return {
    fontFamily: FONT_FAMILIES[variant.fontFamily],
    fontSize: normalizeDimension(variant.size),
    lineHeight: normalizeDimension(variant.lineHeight),
    letterSpacing: round(variant.letterSpacing),
    maxFontSizeMultiplier: variant.maxFontSizeMultiplier ?? 1.25,
  };
}

const RESOLVED_CANONICAL_VARIANTS = Object.fromEntries(
  Object.entries(CANONICAL_TYPOGRAPHY_VARIANTS).map(([name, variant]) => [
    name,
    resolveRawVariant(variant),
  ]),
) as Record<CanonicalTypographyVariant, ResolvedTypography>;

const RESOLVED_ALIAS_VARIANTS = Object.fromEntries(
  Object.entries(TYPOGRAPHY_ALIASES).map(([aliasName, canonicalName]) => [
    aliasName,
    RESOLVED_CANONICAL_VARIANTS[canonicalName],
  ]),
) as Record<AliasTypographyVariant, ResolvedTypography>;

export const TYPOGRAPHY_VARIANTS = {
  ...RESOLVED_CANONICAL_VARIANTS,
  ...RESOLVED_ALIAS_VARIANTS,
} as const satisfies Record<TypographyVariant, ResolvedTypography>;

export function getTypographyStyle(variant: TypographyVariant = "bodyMd"): TextStyle {
  const config = TYPOGRAPHY_VARIANTS[variant];
  return {
    fontFamily: config.fontFamily,
    fontSize: config.fontSize,
    lineHeight: config.lineHeight,
    letterSpacing: config.letterSpacing,
    includeFontPadding: false,
  };
}

export const DEFAULT_TEXT_VARIANT: TypographyVariant = "bodyMd";
export const DEFAULT_TEXT_STYLE = getTypographyStyle(DEFAULT_TEXT_VARIANT);
export const DEFAULT_TEXT_MAX_MULTIPLIER =
  TYPOGRAPHY_VARIANTS[DEFAULT_TEXT_VARIANT].maxFontSizeMultiplier;
