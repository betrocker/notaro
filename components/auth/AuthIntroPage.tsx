import { TouchableOpacity } from "react-native";
import { AppText as Text } from "@/components/ui";

import { AuthScreenScaffold } from "@/components/AuthScreenScaffold";
import { COLOR_TOKENS } from "@/lib/design-system/tokens";
import { getThemeTokens } from "@/lib/theme";

export function AuthIntroPage({
  isDark,
  theme,
  onClose,
  onLogin,
  onRegister,
}: {
  isDark: boolean;
  theme: ReturnType<typeof getThemeTokens>;
  onClose: () => void;
  onLogin: () => void;
  onRegister: () => void;
}) {
  const colorMode = isDark ? "dark" : "light";
  const supportTextColor = COLOR_TOKENS[colorMode]["text.secondary"];
  const introActionBg = COLOR_TOKENS[colorMode]["btn.secondary"];
  const introActionText = COLOR_TOKENS[colorMode]["text.primary"];

  return (
    <AuthScreenScaffold
      theme={theme}
      title="Welcome to Notaro"
      titleIconSize={30}
      headerAction={{
        icon: "close",
        iconSize: 22,
        onPress: onClose,
      }}
    >
      <Text
        className="mt-5 font-regular text-label-sm leading-6"
        style={{ color: supportTextColor }}
      >
        Sign in to pick up where you left off, or create an account to start
        organizing matters, notes, and next steps.
      </Text>

      <TouchableOpacity
        activeOpacity={0.82}
        onPress={onLogin}
        className="mt-7 h-[40px] px-4 items-center justify-center rounded-[14px]"
        style={{ backgroundColor: introActionBg }}
      >
        <Text
          className="font-semibold text-label"
          style={{ color: introActionText }}
        >
          Log In
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.78}
        onPress={onRegister}
        className="mt-3 h-[40px] px-4 items-center justify-center rounded-[14px]"
        style={{ backgroundColor: introActionBg }}
      >
        <Text
          className="font-semibold text-label"
          style={{ color: introActionText }}
        >
          Create Account
        </Text>
      </TouchableOpacity>
    </AuthScreenScaffold>
  );
}
