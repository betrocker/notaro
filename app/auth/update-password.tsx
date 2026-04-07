import { router } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useState } from "react";
import { TouchableOpacity, View } from "react-native";

import { AuthScreenScaffold } from "@/components/AuthScreenScaffold";
import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/Icon";
import { AppText as Text, AppTextInput } from "@/components/ui";
import { COLOR_TOKENS } from "@/lib/design-system/tokens";
import { getThemeTokens } from "@/lib/theme";

export default function UpdatePasswordScreen() {
  const { colorScheme } = useColorScheme();
  const { updatePassword, isSupabaseConfigured } = useAuth();
  const isDark = colorScheme === "dark";
  const theme = getThemeTokens(isDark);
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const colorMode = isDark ? "dark" : "light";
  const selectionColor = COLOR_TOKENS[colorMode]["primary.default"];

  const canSubmit = Boolean(password.trim() && !isSubmitting);
  const fieldBg = isDark
    ? COLOR_TOKENS.dark["btn.secondary"]
    : COLOR_TOKENS.light["bg.input"];
  const focusBorderColor = COLOR_TOKENS[colorMode]["primary.default"];
  const placeholderColor = COLOR_TOKENS[colorMode]["text.secondary"];
  const idleBorderColor = placeholderColor;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) {
      return;
    }

    if (!isSupabaseConfigured) {
      setErrorMessage("Supabase nije povezan. Proveri `.env`.");
      return;
    }

    setIsSubmitting(true);

    try {
      await updatePassword(password);
      setErrorMessage(null);
      setMessage("Password updated.");
    } catch (error) {
      setMessage(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Password update nije uspeo.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, isSupabaseConfigured, password, updatePassword]);

  return (
    <AuthScreenScaffold
      theme={theme}
      title="New Password"
      headerAction={{
        icon: "close",
        iconSize: 22,
        onPress: () => router.dismissTo("/welcome" as never),
      }}
    >
      <View
        className="h-[40px] rounded-[14px] px-3 py-0"
        style={{
          backgroundColor: fieldBg,
          borderWidth: isInputFocused ? 1.5 : 0.5,
          borderColor: isInputFocused ? focusBorderColor : idleBorderColor,
        }}
      >
        <View className="h-full flex-row items-center">
          <AppTextInput
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!isPasswordVisible}
            value={password}
            onChangeText={setPassword}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            placeholder="New password"
            placeholderTextColor={placeholderColor}
            returnKeyType="done"
            onSubmitEditing={() => void handleSubmit()}
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

      <View className="mt-9 items-start">
        <TouchableOpacity
          activeOpacity={0.75}
          className="py-2 pr-3"
          hitSlop={10}
          onPress={() => router.dismissTo("/welcome" as never)}
        >
          <Text className="font-regular text-label-sm text-things-muted">
            Back to welcome
          </Text>
        </TouchableOpacity>
      </View>
    </AuthScreenScaffold>
  );
}
