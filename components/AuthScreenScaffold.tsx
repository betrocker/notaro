import { Image } from "expo-image";
import React, { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "@/components/ui";

import { ModalCircleButton } from "@/components/ModalCircleButton";
import { getThemeTokens } from "@/lib/theme";

export function AuthScreenScaffold({
  children,
  headerAction,
  theme,
  title,
  titleIconSize = 30,
}: PropsWithChildren<{
  headerAction?: {
    icon: "chevronLeft" | "close";
    onPress: () => void;
  };
  theme: ReturnType<typeof getThemeTokens>;
  title?: string;
  titleIconSize?: number;
}>) {
  const normalizedTitle = title?.trim().toLowerCase();
  const isBrandTitle =
    normalizedTitle === "notaro" || normalizedTitle === "welcome to notaro";
  const isLoginTitle = normalizedTitle === "log in";
  const isRegisterTitle = normalizedTitle === "create account";
  const isResetTitle = normalizedTitle === "reset password";
  const useLargeTitle =
    isBrandTitle || isLoginTitle || isRegisterTitle || isResetTitle;

  return (
    <View style={styles.root}>
      {headerAction ? (
        <View style={styles.header}>
          <View style={styles.headerInner}>
            <ModalCircleButton
              icon={headerAction.icon}
              theme={theme}
              onPress={headerAction.onPress}
            />

            <View style={styles.headerSpacer} />
          </View>
        </View>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          {title ? (
            <View className="mb-6 flex-row items-center">
              <Image
                source={require("@/assets/icon.png")}
                style={{
                  width: titleIconSize,
                  height: titleIconSize,
                  borderRadius: 8,
                }}
                contentFit="cover"
              />
              <Text
                variant={useLargeTitle ? "largeTitle" : "bodyLg"}
                className="ml-3 font-bold tracking-[0.15px]"
                style={{
                  color: useLargeTitle ? theme.onboardingTitle : theme.authLabelText,
                }}
              >
                {title}
              </Text>
            </View>
          ) : null}

          {children}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 96,
    paddingBottom: 24,
  },
  header: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    zIndex: 10,
  },
  headerInner: {
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  root: {
    flex: 1,
  },
});
