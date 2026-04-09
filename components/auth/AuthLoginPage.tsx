import React, { useCallback, useState } from "react";
import { TouchableOpacity, View } from "react-native";

import { useAuth } from "@/components/AuthProvider";
import { AuthScreenScaffold } from "@/components/AuthScreenScaffold";
import { Icon } from "@/components/Icon";
import { AppTextInput, AppText as Text } from "@/components/ui";
import {
  BORDER_WIDTH_TOKENS,
  COLOR_TOKENS,
  OPACITY_TOKENS,
  RADIUS_TOKENS,
  SIZE_TOKENS,
  SPACING_TOKENS,
} from "@/lib/design-system/tokens";
import { getThemeTokens } from "@/lib/theme";

export function AuthLoginPage({
  isDark,
  theme,
  onBack,
  onForgotPassword,
}: {
  isDark: boolean;
  theme: ReturnType<typeof getThemeTokens>;
  onBack: () => void;
  onForgotPassword: (email: string) => void;
}) {
  const { isSupabaseConfigured, signIn, resetAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const normalizedEmail = email.trim().toLowerCase();
  const canSubmit = Boolean(
    normalizedEmail && password.trim() && !isSubmitting,
  );
  const colorMode = isDark ? "dark" : "light";
  const selectionColor = COLOR_TOKENS[colorMode]["primary.default"];
  const fieldBg = isDark
    ? COLOR_TOKENS.dark["btn.secondary"]
    : COLOR_TOKENS.light["bg.input"];
  const primaryActionBg = theme.authActionBg;
  const primaryActionText = COLOR_TOKENS[colorMode]["text.primary"];
  const loginButtonBg = COLOR_TOKENS.dark["primary.default"];
  const forgotPasswordColor = primaryActionBg;
  const inputLabelColor = theme.onboardingTitle;
  const focusBorderColor = COLOR_TOKENS[colorMode]["primary.soft"];
  const placeholderColor = COLOR_TOKENS[colorMode]["text.secondary"];
  const idleBorderColor = placeholderColor;
  const fieldHeight = SPACING_TOKENS["4xl"];
  const controlRadius = RADIUS_TOKENS.control;
  const focusBorderWidth = BORDER_WIDTH_TOKENS.focus;
  const subtleBorderWidth = BORDER_WIDTH_TOKENS.subtle;
  const visibilityToggleSize = SIZE_TOKENS.authVisibilityToggle;
  const visibilityIconSize = SIZE_TOKENS.authVisibilityIcon;
  const disabledOpacity = OPACITY_TOKENS.disabled;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    if (!isSupabaseConfigured) {
      setErrorMessage("Supabase nije povezan. Proveri `.env`.");
      setInfoMessage(null);
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn(normalizedEmail, password);
      setErrorMessage(null);
      setInfoMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Auth nije uspeo.",
      );
      setInfoMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, isSupabaseConfigured, normalizedEmail, password, signIn]);

  const handleResetAuth = useCallback(async () => {
    if (isResetting) return;
    if (!isSupabaseConfigured) {
      setErrorMessage("Supabase nije povezan. Proveri `.env`.");
      setInfoMessage(null);
      return;
    }

    setIsResetting(true);
    try {
      await resetAuth();
      setErrorMessage(null);
      setInfoMessage("Auth je resetovan. Prijavi se ponovo.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Reset auth nije uspeo.",
      );
      setInfoMessage(null);
    } finally {
      setIsResetting(false);
    }
  }, [isResetting, isSupabaseConfigured, resetAuth]);

  return (
    <AuthScreenScaffold
      theme={theme}
      title="Log In"
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
          borderWidth:
            focusedField === "login-email" ? focusBorderWidth : subtleBorderWidth,
          borderColor:
            focusedField === "login-email" ? focusBorderColor : idleBorderColor,
        }}
      >
        <AppTextInput
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          onFocus={() => setFocusedField("login-email")}
          onBlur={() =>
            setFocusedField((current) =>
              current === "login-email" ? null : current,
            )
          }
          placeholder="name@example.com"
          placeholderTextColor={placeholderColor}
          variant="bodyMd"
          className="leading-5 text-things-text"
          selectionColor={selectionColor}
        />
      </View>

      <View className="mt-4">
        <Text
          className="mb-2 ml-1 font-semibold text-label-md"
          style={{ color: inputLabelColor }}
        >
          Password
        </Text>
        <View
          className="px-3 py-0"
          style={{
            height: fieldHeight,
            borderRadius: controlRadius,
            backgroundColor: fieldBg,
            borderWidth:
              focusedField === "login-password"
                ? focusBorderWidth
                : subtleBorderWidth,
            borderColor:
              focusedField === "login-password"
                ? focusBorderColor
                : idleBorderColor,
          }}
        >
          <View className="h-full flex-row items-center">
            <AppTextInput
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!isPasswordVisible}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField("login-password")}
              onBlur={() =>
                setFocusedField((current) =>
                  current === "login-password" ? null : current,
                )
              }
              placeholder="Password"
              placeholderTextColor={placeholderColor}
              variant="bodyMd"
              className="flex-1 leading-5 text-things-text"
              selectionColor={selectionColor}
            />
            <TouchableOpacity
              onPress={() => setIsPasswordVisible((current) => !current)}
              className="ml-2 items-center justify-center"
              style={{
                width: visibilityToggleSize,
                height: visibilityToggleSize,
              }}
              hitSlop={8}
            >
              <Icon
                name={isPasswordVisible ? "eyeOff" : "eye"}
                size={visibilityIconSize}
                color="var(--color-muted)"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.75}
        className="mt-3 self-end py-1"
        hitSlop={10}
        onPress={() => onForgotPassword(normalizedEmail || email)}
      >
        <Text
          className="font-semibold text-label"
          style={{ color: forgotPasswordColor }}
        >
          Forgot password?
        </Text>
      </TouchableOpacity>

      {__DEV__ ? (
        <TouchableOpacity
          activeOpacity={0.7}
          className="mt-2 self-end py-1"
          hitSlop={10}
          disabled={isResetting}
          onPress={() => void handleResetAuth()}
        >
          <Text className="font-medium text-label-sm text-things-muted">
            Reset auth (dev)
          </Text>
        </TouchableOpacity>
      ) : null}

      {infoMessage ? (
        <Text className="mt-4 font-regular text-label-sm leading-5 text-things-muted">
          {infoMessage}
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
        onPress={() => void handleSubmit()}
        className="mt-5 px-4 items-center justify-center"
        style={{
          height: fieldHeight,
          borderRadius: controlRadius,
          backgroundColor: loginButtonBg,
          opacity: canSubmit ? 1 : disabledOpacity,
        }}
      >
        <Text
          className="font-semibold text-label"
          style={{ color: primaryActionText }}
        >
          Log In
        </Text>
      </TouchableOpacity>
    </AuthScreenScaffold>
  );
}
