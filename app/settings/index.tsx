import { Icon, IconName } from "@/components/Icon";
import { useAuth } from "@/components/AuthProvider";
import { TransparentModalShell } from "@/components/TransparentModalShell";
import { COLOR_TOKENS, SHADOW_TOKENS } from "@/lib/design-system/tokens";
import { getThemeTokens } from "@/lib/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { AppText as Text } from "@/components/ui";

type SettingsScreen = "root" | "appearance";

interface SettingsRowProps {
  colorMode: "light" | "dark";
  icon?: IconName;
  iconColor?: string;
  title: string;
  onPress?: () => void;
  rightText?: string;
  tone?: "default" | "danger";
}

function SettingsRow({
  colorMode,
  icon,
  iconColor,
  title,
  onPress,
  rightText,
  tone = "default",
}: SettingsRowProps) {
  const resolvedIconColor = iconColor ?? COLOR_TOKENS[colorMode]["text.primary"];
  const titleColor =
    tone === "danger"
      ? COLOR_TOKENS[colorMode]["primary.default"]
      : colorMode === "dark"
        ? COLOR_TOKENS.light["bg.modal"]
        : COLOR_TOKENS.light["text.primary"];

  const content = (
    <View className="ml-4 flex-row items-center pr-4 py-1.5">
      {icon ? (
        <View className="mr-2 h-7 w-7 items-center justify-center">
          <Icon name={icon} size={20} color={resolvedIconColor} />
        </View>
      ) : null}

      <View className="flex-1">
        <Text
          className="font-regular text-body-md"
          style={{ color: titleColor, fontSize: 15 }}
        >
          {title}
        </Text>
      </View>

      <View className="ml-3 flex-row items-center">
        {rightText ? (
          <Text
            className="mr-2 font-medium text-label-sm"
            style={{
              color:
                colorMode === "dark"
                  ? COLOR_TOKENS.dark["text.primary"]
                  : COLOR_TOKENS.light["text.secondary"],
            }}
          >
            {rightText}
          </Text>
        ) : null}

        {onPress ? (
          <Icon
            name="chevronRight"
            size={22}
            weight="light"
            color={
              colorMode === "dark"
                ? COLOR_TOKENS.dark["text.primary"]
                : COLOR_TOKENS.light["text.secondary"]
            }
          />
        ) : null}
      </View>
    </View>
  );

  if (!onPress) {
    return <View>{content}</View>;
  }

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      {content}
    </TouchableOpacity>
  );
}

function SettingsGroup({
  children,
  colorMode,
}: {
  children: React.ReactNode;
  colorMode: "light" | "dark";
}) {
  return (
    <View
      className="mx-4 overflow-hidden rounded-xl"
      style={{ backgroundColor: COLOR_TOKENS[colorMode]["bg.input"] }}
    >
      {children}
    </View>
  );
}

function HeaderButton({
  icon,
  iconSize,
  onPress,
  theme,
}: {
  icon: "chevronLeft" | "close";
  iconSize: number;
  onPress: () => void;
  theme: ReturnType<typeof getThemeTokens>;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: false,
      speed: 24,
      bounciness: 6,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onPress}
        onPressIn={() => animateTo(1.18)}
        onPressOut={() => animateTo(1)}
        style={[
          styles.headerButton,
          {
            backgroundColor: theme.modalCircleButtonBg,
            borderColor: theme.modalCircleButtonBorder,
          },
        ]}
      >
        <Icon
          name={icon}
          size={iconSize}
          weight={icon === "chevronLeft" ? "light" : undefined}
          color={theme.modalCircleButtonIcon}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

function SettingsHeader({
  title,
  theme,
  colorMode,
  onBack,
  onClose,
}: {
  title: string;
  theme: ReturnType<typeof getThemeTokens>;
  colorMode: "light" | "dark";
  onBack?: () => void;
  onClose: () => void;
}) {
  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: "transparent",
        },
      ]}
    >
      {onBack ? (
        <HeaderButton
          icon="chevronLeft"
          iconSize={25}
          onPress={onBack}
          theme={theme}
        />
      ) : (
        <View style={styles.headerSpacer} />
      )}

      <Text
        style={[
          styles.headerTitle,
          { color: COLOR_TOKENS[colorMode]["text.primary"] },
        ]}
      >
        {title}
      </Text>

      <HeaderButton
        icon="close"
        iconSize={20}
        onPress={onClose}
        theme={theme}
      />
    </View>
  );
}

function RootPanel({
  accountLabel,
  colorMode,
  onOpenAppearance,
  onSignOut,
}: {
  accountLabel: string;
  colorMode: "light" | "dark";
  onOpenAppearance: () => void;
  onSignOut: () => void;
}) {
  return (
    <ScrollView
      className="flex-1 bg-transparent pt-6"
      contentContainerStyle={{ paddingBottom: 28 }}
    >
      <View className="mb-0">
        <SettingsGroup colorMode={colorMode}>
          <SettingsRow
            colorMode={colorMode}
            icon="general"
            iconColor={COLOR_TOKENS[colorMode]["primary.default"]}
            title={accountLabel}
          />
        </SettingsGroup>
      </View>

      <View className="mb-0">
        <SettingsGroup colorMode={colorMode}>
          <SettingsRow
            colorMode={colorMode}
            icon="appearance"
            iconColor={COLOR_TOKENS[colorMode]["icon.inbox"]}
            title="Appearance"
            onPress={onOpenAppearance}
          />
        </SettingsGroup>
      </View>

      <View className="mb-0">
        <SettingsGroup colorMode={colorMode}>
          <SettingsRow
            colorMode={colorMode}
            icon="chevronsRight"
            iconColor={COLOR_TOKENS[colorMode]["primary.default"]}
            title="Sign Out"
            tone="danger"
            onPress={onSignOut}
          />
        </SettingsGroup>
      </View>
    </ScrollView>
  );
}

function AppearancePanel() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const activeTheme = colorScheme ?? "system";
  const isDark = activeTheme === "dark";
  const colorMode = isDark ? "dark" : "light";

  const handleThemeChange = async (theme: "light" | "dark" | "system") => {
    setColorScheme(theme);
    try {
      await AsyncStorage.setItem("@app_theme", theme);
    } catch (error) {
      console.error("Failed to save theme:", error);
    }
  };

  const ThemeOption = ({
    title,
    value,
    icon,
    isLast = false,
  }: {
    title: string;
    value: "light" | "dark" | "system";
    icon: IconName;
    isLast?: boolean;
  }) => {
    const isSelected = activeTheme === value;
    const rowBorderColor =
      colorMode === "dark"
        ? COLOR_TOKENS.dark["btn.secondary"]
        : COLOR_TOKENS.light["border.default"];

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        className="flex-row items-center pr-1"
        style={{
          paddingVertical: 10,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: rowBorderColor,
        }}
        onPress={() => handleThemeChange(value)}
      >
        <View
          className="mr-3 h-8 w-8 items-center justify-center rounded-[10px]"
          style={{
            borderWidth: 1.5,
            borderColor: rowBorderColor,
            backgroundColor: COLOR_TOKENS[colorMode]["bg.input"],
          }}
        >
          <Icon name={icon} size={17} color={COLOR_TOKENS[colorMode]["text.primary"]} />
        </View>

        <Text className="flex-1 font-medium text-body-md text-things-text">
          {title}
        </Text>

        {isSelected ? (
          <Icon name="check" size={18} color="var(--color-inbox)" />
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-transparent"
      contentContainerStyle={{
        paddingHorizontal: 22,
        paddingTop: 18,
        paddingBottom: 24,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-7 flex-row items-start justify-between">
        <Text className="flex-1 pr-5 font-regular text-label-sm leading-5 text-things-muted">
          Choose how Notaro should look throughout the app.
        </Text>
        <View
          className="items-center justify-center rounded-[14px]"
          style={{
            backgroundColor: COLOR_TOKENS[colorMode]["bg.input"],
            width: 52,
            height: 52,
            borderRadius: 14,
          }}
        >
          <Icon
            name="appearance"
            size={24}
            color={COLOR_TOKENS[colorMode]["text.primary"]}
          />
        </View>
      </View>

      <Text className="mt-5 font-medium text-label-md text-things-text">
        Appearance
      </Text>
      <View
        className="mt-0.5 mb-1"
        style={{
          height: 1,
          backgroundColor:
            colorMode === "dark"
              ? COLOR_TOKENS.dark["btn.secondary"]
              : COLOR_TOKENS.light["border.default"],
        }}
      />

      <View className="mb-4">
        <ThemeOption title="Light" value="light" icon="sun" />
        <ThemeOption title="Dark" value="dark" icon="appearance" />
        <ThemeOption title="Automatic" value="system" icon="gear" isLast />
      </View>

      <Text
        className="self-center text-center font-regular text-label-sm leading-5 text-things-muted"
        style={{ maxWidth: 240 }}
      >
        Automatic follows your device appearance and switches between light and
        dark mode for you.
      </Text>
    </ScrollView>
  );
}

export default function SettingsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colorMode = isDark ? "dark" : "light";
  const theme = getThemeTokens(isDark);
  const { profile, signOut, user } = useAuth();
  const accountLabel =
    profile?.name || profile?.email || user?.email || "Account";
  const modalBg = isDark
    ? COLOR_TOKENS.dark["bg.input"]
    : COLOR_TOKENS.light["bg.modal"];
  const borderColor = isDark
    ? COLOR_TOKENS.dark["btn.secondary"]
    : COLOR_TOKENS.light["border.default"];

  const [screen, setScreen] = useState<SettingsScreen>("root");
  const [contentWidth, setContentWidth] = useState(0);
  const slideValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideValue, {
      toValue: screen === "root" ? 0 : 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [screen, slideValue]);

  const handleContentLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;

    if (!nextWidth || nextWidth === contentWidth) {
      return;
    }

    setContentWidth(nextWidth);
  };

  const translateX = slideValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -contentWidth],
  });

  return (
    <View style={styles.safeArea}>
      <TransparentModalShell
        contentStyle={[
          styles.modalWindow,
          styles.modalWindowShadow,
          {
            borderColor,
            backgroundColor: modalBg,
          },
        ]}
        overlayStyle={styles.overlay}
      >
        <View style={styles.viewport} onLayout={handleContentLayout}>
          {contentWidth > 0 ? (
            <Animated.View
              style={[
                styles.track,
                {
                  width: contentWidth * 2,
                  transform: [{ translateX }],
                },
              ]}
            >
              <View style={[styles.page, { width: contentWidth }]}>
                <SettingsHeader
                  title="Settings"
                  theme={theme}
                  colorMode={colorMode}
                  onClose={() => router.back()}
                />
                <View style={styles.pageBody}>
                  <RootPanel
                    accountLabel={accountLabel}
                    colorMode={colorMode}
                    onOpenAppearance={() => setScreen("appearance")}
                    onSignOut={() => {
                      void signOut();
                    }}
                  />
                </View>
              </View>

              <View style={[styles.page, { width: contentWidth }]}>
                <SettingsHeader
                  title="Appearance"
                  theme={theme}
                  colorMode={colorMode}
                  onBack={() => setScreen("root")}
                  onClose={() => router.back()}
                />
                <View style={styles.pageBody}>
                  <AppearancePanel />
                </View>
              </View>
            </Animated.View>
          ) : null}
        </View>
      </TransparentModalShell>
    </View>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  header: {
    height: 54,
    paddingLeft: 16,
    paddingRight: 12,
    paddingTop: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
  },
  headerSpacer: {
    width: 36,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
  },
  modalWindow: {
    width: "85%",
    height: "70%",
    borderWidth: 0.5,
    borderRadius: 28,
    overflow: "hidden",
  },
  modalWindowShadow: {
    ...Platform.select({
      ios: {
        ...SHADOW_TOKENS.card.ios,
      },
      android: {
        elevation: SHADOW_TOKENS.card.android.elevation,
      },
    }),
  },
  overlay: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  page: {
    flex: 1,
  },
  pageBody: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  track: {
    flexDirection: "row",
    flex: 1,
  },
  viewport: {
    flex: 1,
    overflow: "hidden",
  },
});
