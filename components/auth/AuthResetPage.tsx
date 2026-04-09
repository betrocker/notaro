import React, { useCallback, useEffect, useState } from "react";
import { TouchableOpacity, View } from "react-native";

import { useAuth } from "@/components/AuthProvider";
import { AuthScreenScaffold } from "@/components/AuthScreenScaffold";
import { AppTextInput, AppText as Text } from "@/components/ui";
import {
  BORDER_WIDTH_TOKENS,
  COLOR_TOKENS,
  OPACITY_TOKENS,
  RADIUS_TOKENS,
  SPACING_TOKENS,
} from "@/lib/design-system/tokens";
import { getThemeTokens } from "@/lib/theme";

export function AuthResetPage({
  isDark,
  theme,
  initialEmail = "",
  onBack,
}: {
  isDark: boolean;
  theme: ReturnType<typeof getThemeTokens>;
  initialEmail?: string;
  onBack: () => void;
}) {
  const { sendPasswordReset, isSupabaseConfigured } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  const normalizedEmail = email.trim().toLowerCase();
  const canSubmit = Boolean(normalizedEmail && !isSubmitting);
  const colorMode = isDark ? "dark" : "light";
  const selectionColor = COLOR_TOKENS[colorMode]["primary.default"];
  const fieldBg = isDark
    ? COLOR_TOKENS.dark["btn.secondary"]
    : COLOR_TOKENS.light["bg.input"];
  const supportTextColor = COLOR_TOKENS[colorMode]["text.primary"];
  const resetButtonBg = COLOR_TOKENS.dark["primary.default"];
  const primaryActionText = COLOR_TOKENS[colorMode]["text.primary"];
  const inputLabelColor = theme.onboardingTitle;
  const focusBorderColor = COLOR_TOKENS[colorMode]["primary.soft"];
  const placeholderColor = COLOR_TOKENS[colorMode]["text.secondary"];
  const idleBorderColor = placeholderColor;
  const fieldHeight = SPACING_TOKENS["4xl"];
  const controlRadius = RADIUS_TOKENS.control;
  const focusBorderWidth = BORDER_WIDTH_TOKENS.focus;
  const subtleBorderWidth = BORDER_WIDTH_TOKENS.subtle;
  const disabledOpacity = OPACITY_TOKENS.disabled;

  const handleReset = useCallback(async () => {
    if (!canSubmit) return;
    if (!isSupabaseConfigured) {
      setErrorMessage("Supabase nije povezan. Proveri `.env`.");
      return;
    }

    setIsSubmitting(true);
    try {
      await sendPasswordReset(normalizedEmail);
      setErrorMessage(null);
      setMessage("Reset link is on its way if this account exists.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nisam uspeo da posaljem reset link.",
      );
      setMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, isSupabaseConfigured, normalizedEmail, sendPasswordReset]);

  return (
    <AuthScreenScaffold
      theme={theme}
      title="Reset Password"
      headerAction={{ icon: "chevronLeft", onPress: onBack }}
    >
      <Text
        className="mb-2 ml-1 font-semibold text-label-md"
        style={{ color: inputLabelColor }}
      >
        Email
      </Text>
      <View
        className="px-3 py-0"
        style={{
          height: fieldHeight,
          borderRadius: controlRadius,
          backgroundColor: fieldBg,
          borderWidth: isInputFocused ? focusBorderWidth : subtleBorderWidth,
          borderColor: isInputFocused ? focusBorderColor : idleBorderColor,
        }}
      >
        <AppTextInput
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          placeholder="name@example.com"
          placeholderTextColor={placeholderColor}
          variant="bodyMd"
          className="leading-5 text-things-text"
          selectionColor={selectionColor}
        />
      </View>

      <Text
        className="mt-4 font-regular text-footer"
        style={{ color: supportTextColor }}
      >
        Enter the email linked to your account and we&apos;ll send you a secure
        reset link.
      </Text>

      {message ? (
        <Text className="mt-4 font-regular text-label-sm leading-5 text-things-muted">
          {message}
        </Text>
      ) : null}

      {errorMessage ? (
        <Text className="mt-4 font-regular text-label-sm leading-5 text-things-muted">
          {errorMessage}
        </Text>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.82}
        disabled={!canSubmit}
        onPress={() => void handleReset()}
        className="mt-5 px-4 items-center justify-center"
        style={{
          height: fieldHeight,
          borderRadius: controlRadius,
          backgroundColor: resetButtonBg,
          opacity: canSubmit ? 1 : disabledOpacity,
        }}
      >
        <Text
          className="font-semibold text-label"
          style={{ color: primaryActionText }}
        >
          Send Reset Link
        </Text>
      </TouchableOpacity>
    </AuthScreenScaffold>
  );
}
