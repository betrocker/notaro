import { Slot } from "expo-router";
import { useColorScheme } from "nativewind";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import { AuthModalProvider } from "@/components/AuthModalContext";
import { TransparentModalShell } from "@/components/TransparentModalShell";
import { COLOR_TOKENS, SHADOW_TOKENS } from "@/lib/design-system/tokens";

export default function AuthLayout() {
  return <AuthModalShell />;
}

function AuthModalShell() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colorMode = isDark ? "dark" : "light";
  const modalBg = isDark
    ? COLOR_TOKENS.dark["bg.input"]
    : COLOR_TOKENS.light["bg.modal"];
  const backdropOpacity = isDark ? 0.5 : 0.24;

  return (
    <View style={styles.safeArea}>
      <TransparentModalShell
        backdropColor={COLOR_TOKENS[colorMode]["bg.popup"]}
        backdropOpacity={backdropOpacity}
        contentStyle={[
          styles.authModalWindow,
          {
            backgroundColor: modalBg,
          },
        ]}        
        overlayStyle={styles.authOverlay}
      >
        <View style={styles.slotHost}>
          <AuthModalProvider requestShellClose={(callback) => callback()}>
            <Slot />
          </AuthModalProvider>
        </View>
      </TransparentModalShell>
    </View>
  );
}

const styles = StyleSheet.create({
  authModalWindow: {
    width: "85%",
    height: "60%",
    borderWidth: 0,
    borderRadius: 28,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        ...SHADOW_TOKENS.card.ios,
        shadowOffset: { width: 0, height: 16 },
      },
      android: {
        elevation: SHADOW_TOKENS.card.android.elevation,
      },
    }),
  },
  authOverlay: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  slotHost: {
    flex: 1,
    overflow: "hidden",
  },
});
