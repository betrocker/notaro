import React, { useCallback, useState } from "react";
import { TouchableOpacity, View } from "react-native";

import { AuthScreenScaffold } from "@/components/AuthScreenScaffold";
import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/Icon";
import { AppText as Text, AppTextInput } from "@/components/ui";
import { COLOR_TOKENS } from "@/lib/design-system/tokens";
import { getThemeTokens } from "@/lib/theme";

export function AuthRegisterPage({
  isDark,
  theme,
  onBack,
}: {
  isDark: boolean;
  theme: ReturnType<typeof getThemeTokens>;
  onBack: () => void;
}) {
  const { isSupabaseConfigured, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const supportTextColor = COLOR_TOKENS[colorMode]["text.primary"];
  const registerButtonBg = COLOR_TOKENS.dark["primary.default"];
  const policyLinkColor = registerButtonBg;
  const primaryActionText = COLOR_TOKENS[colorMode]["text.primary"];
  const inputLabelColor = theme.onboardingTitle;
  const focusBorderColor = COLOR_TOKENS[colorMode]["primary.default"];
  const placeholderColor = COLOR_TOKENS[colorMode]["text.secondary"];
  const idleBorderColor = placeholderColor;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    if (!isSupabaseConfigured) {
      setErrorMessage("Supabase nije povezan. Proveri `.env`.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signUp(normalizedEmail, password);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Create account nije uspeo.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, isSupabaseConfigured, normalizedEmail, password, signUp]);

  return (
    <AuthScreenScaffold
      theme={theme}
      title="Create Account"
      headerAction={{ icon: "chevronLeft", iconSize: 27, onPress: onBack }}
    >
      <Text
        className="mb-2 ml-1 font-semibold text-label-md"
        style={{ color: inputLabelColor }}
      >
        Email
      </Text>
      <View
        className="h-[40px] rounded-[14px] px-3 py-0"
        style={{
          backgroundColor: fieldBg,
          borderWidth: focusedField === "register-email" ? 1.5 : 0.5,
          borderColor:
            focusedField === "register-email"
              ? focusBorderColor
              : idleBorderColor,
        }}
      >
        <AppTextInput
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          onFocus={() => setFocusedField("register-email")}
          onBlur={() =>
            setFocusedField((current) =>
              current === "register-email" ? null : current,
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
          className="h-[40px] rounded-[14px] px-3 py-0"
          style={{
            backgroundColor: fieldBg,
            borderWidth: focusedField === "register-password" ? 1.5 : 0.5,
            borderColor:
              focusedField === "register-password"
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
              onFocus={() => setFocusedField("register-password")}
              onBlur={() =>
                setFocusedField((current) =>
                  current === "register-password" ? null : current,
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
              className="ml-2 h-9 w-9 items-center justify-center"
              hitSlop={8}
            >
              <Icon
                name={isPasswordVisible ? "eyeOff" : "eye"}
                size={19}
                color="var(--color-muted)"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Text
        className="mt-4 font-regular text-footer"
        style={{ color: supportTextColor }}
      >
        By creating an account, you agree to the{" "}
        <Text
          style={{ color: policyLinkColor, textDecorationLine: "underline" }}
        >
          Notaro Terms
        </Text>
        . Learn how we use and protect your data in our{" "}
        <Text
          style={{ color: policyLinkColor, textDecorationLine: "underline" }}
        >
          Privacy Policy
        </Text>
        .
      </Text>

      {errorMessage ? (
        <Text className="mt-4 font-regular text-label-sm leading-5 text-things-muted">
          {errorMessage}
        </Text>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.82}
        disabled={!canSubmit}
        onPress={() => void handleSubmit()}
        className="mt-5 h-[40px] px-4 items-center justify-center rounded-[14px]"
        style={{
          backgroundColor: registerButtonBg,
          opacity: canSubmit ? 1 : 0.4,
        }}
      >
        <Text
          className="font-semibold text-label"
          style={{ color: primaryActionText }}
        >
          Create Account
        </Text>
      </TouchableOpacity>
    </AuthScreenScaffold>
  );
}
