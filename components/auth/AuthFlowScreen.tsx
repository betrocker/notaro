import { router, useLocalSearchParams } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AuthIntroPage } from "@/components/auth/AuthIntroPage";
import { AuthLoginPage } from "@/components/auth/AuthLoginPage";
import { AuthRegisterPage } from "@/components/auth/AuthRegisterPage";
import { AuthResetPage } from "@/components/auth/AuthResetPage";
import { getThemeTokens } from "@/lib/theme";

type AuthFlowScreenName = "intro" | "login" | "register" | "reset";

function getInitialScreen(value?: string): AuthFlowScreenName {
  switch (value) {
    case "login":
      return "login";
    case "register":
      return "register";
    case "reset":
    case "reset-password":
      return "reset";
    default:
      return "intro";
  }
}

export function AuthFlowScreen() {
  const { screen: screenParam, email: initialResetEmail = "" } = useLocalSearchParams<{
    screen?: string;
    email?: string;
  }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = getThemeTokens(isDark);

  const [screen, setScreen] = useState<AuthFlowScreenName>(getInitialScreen(screenParam));
  const [resetSeedEmail, setResetSeedEmail] = useState(
    typeof initialResetEmail === "string" ? initialResetEmail : "",
  );

  useEffect(() => {
    setScreen(getInitialScreen(screenParam));
  }, [screenParam]);

  return (
    <View style={styles.root}>
      <View style={styles.viewport}>
        {screen === "intro" ? (
          <AuthIntroPage
            isDark={isDark}
            theme={theme}
            onClose={() => router.dismissTo("/welcome" as never)}
            onLogin={() => setScreen("login")}
            onRegister={() => setScreen("register")}
          />
        ) : null}

        {screen === "register" ? (
          <AuthRegisterPage
            isDark={isDark}
            theme={theme}
            onBack={() => setScreen("intro")}
          />
        ) : null}

        {screen === "login" ? (
          <AuthLoginPage
            isDark={isDark}
            theme={theme}
            onBack={() => setScreen("intro")}
            onForgotPassword={(email) => {
              setResetSeedEmail(email);
              setScreen("reset");
            }}
          />
        ) : null}

        {screen === "reset" ? (
          <AuthResetPage
            isDark={isDark}
            theme={theme}
            initialEmail={resetSeedEmail}
            onBack={() => setScreen("login")}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  viewport: {
    flex: 1,
  },
});
