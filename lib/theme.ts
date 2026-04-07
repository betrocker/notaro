import { COLOR_TOKENS, type ColorMode } from "@/lib/design-system/tokens";

function buildThemeTokens(mode: ColorMode) {
  const color = COLOR_TOKENS[mode];

  return {
    authActionBg: color["primary.default"],
    authActionText: color["bg.base"],
    authFieldBg: color["bg.input"],
    authLabelText: color["text.secondary"],
    onboardingTitle: color["text.primary"],
    onboardingBody: color["text.secondary"],
    onboardingSkipText: color["text.secondary"],
    onboardingIcon: color["primary.default"],
    onboardingIndicatorInactive: color["border.default"],
    onboardingFabBgPressed: color["primary.default"],
    onboardingFabBorder: color["border.default"],
    modalCircleButtonBg: color["bg.modal"],
    modalCircleButtonBorder: color["btn.secondary"],
    modalCircleButtonIcon: color["text.primary"],
    modalCircleButtonGlassBorder: color["btn.secondary"],
    modalCircleButtonPressedBg: color["bg.input"],
    modalCircleButtonPressedIcon: color["text.primary"],
    settingsLinkText: color["text.secondary"],
    settingsLinkTextPressed: color["text.primary"],
    settingsLinkBgPressed: color["bg.input"],
  } as const;
}

export type ThemeTokens = ReturnType<typeof buildThemeTokens>;

export function getThemeTokens(isDark: boolean): ThemeTokens {
  return buildThemeTokens(isDark ? "dark" : "light");
}
