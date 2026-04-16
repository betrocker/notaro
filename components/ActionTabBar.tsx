import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, IconName } from "@/components/Icon";
import { AppText as Text } from "@/components/ui";
import {
  COLOR_TOKENS,
  RADIUS_TOKENS,
  SPACING_TOKENS,
} from "@/lib/design-system/tokens";

export type ActionTabKey = "home" | "jobs" | "clients";

type ActionTabConfig = {
  key: ActionTabKey;
  label: string;
  icon: IconName;
  href: "/jobs" | "/clients-home" | "/";
};

const TABS: ActionTabConfig[] = [
  { key: "home", label: "Home", icon: "home", href: "/" },
  { key: "jobs", label: "Jobs", icon: "briefcase", href: "/jobs" },
  { key: "clients", label: "Clients", icon: "client", href: "/clients-home" },
];
const TAB_BASE_STYLE = {
  alignItems: "center",
  borderRadius: RADIUS_TOKENS.full,
  flexDirection: "row",
  minHeight: 38,
  justifyContent: "center",
} as const;
const PILL_BASE_STYLE = {
  borderRadius: RADIUS_TOKENS.full,
  left: 0,
  position: "absolute",
  right: 0,
  top: 0,
  bottom: 0,
} as const;

function withOpacity(hexColor: string, opacity: number) {
  const sanitized = hexColor.replace("#", "");
  const full =
    sanitized.length === 3
      ? sanitized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : sanitized;

  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function resolveActionTabFromSegment(
  segment: string | undefined,
): ActionTabKey {
  if (!segment || segment === "index") {
    return "home";
  }

  if (segment === "clients-home" || segment === "clients") {
    return "clients";
  }

  if (
    segment === "jobs" ||
    segment === "job" ||
    segment === "today" ||
    segment === "inbox" ||
    segment === "upcoming" ||
    segment === "anytime" ||
    segment === "someday" ||
    segment === "logbook" ||
    segment === "project"
  ) {
    return "jobs";
  }

  return "home";
}

function ActionTabItem({
  tab,
  isActive,
  activeTabBg,
  activeText,
  inactiveText,
}: {
  tab: ActionTabConfig;
  isActive: boolean;
  activeTabBg: string;
  activeText: string;
  inactiveText: string;
}) {
  const [isPressed, setIsPressed] = useState(false);
  const pillProgress = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    const shouldShow = isPressed;
    pillProgress.value = withTiming(shouldShow ? 1 : 0, {
      duration: shouldShow ? 130 : 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [isPressed, pillProgress]);

  const pillAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pillProgress.value, [0, 1], [0, 1]),
    transform: [
      { scale: interpolate(pillProgress.value, [0, 1], [0.92, 1]) },
      { translateY: interpolate(pillProgress.value, [0, 1], [1.5, 0]) },
    ],
  }));

  const iconColor = isActive
    ? tab.key === "jobs"
      ? "var(--color-today)"
      : activeText
    : inactiveText;
  const labelColor = isActive ? activeText : inactiveText;

  return (
    <Pressable
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      onPress={() => {
        if (isActive) {
          return;
        }

        router.replace(tab.href as never);
      }}
      style={TAB_BASE_STYLE}
    >
      <View
        className="relative flex-row items-center justify-center"
        style={{
          borderRadius: RADIUS_TOKENS.full,
          paddingHorizontal: SPACING_TOKENS.md,
          paddingVertical: SPACING_TOKENS.xs + 1,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            PILL_BASE_STYLE,
            pillAnimatedStyle,
            {
              backgroundColor: activeTabBg,
              marginLeft: 4,
              marginRight: 4,
            },
          ]}
        />
        <Icon name={tab.icon} size={17} color={iconColor} />
        <Text
          variant="label"
          className="font-semibold"
          style={[{ marginLeft: 4 }, { color: labelColor }]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
      </View>
    </Pressable>
  );
}

export default function ActionTabBar({
  activeTab,
}: {
  activeTab: ActionTabKey;
}) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colorMode = isDark ? "dark" : "light";
  const palette = COLOR_TOKENS[colorMode];
  const bottom = Math.max(insets.bottom + 8, 18);
  const shellBorder = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    isDark ? 0.56 : 0.4,
  );
  const shellBg = isDark
    ? withOpacity(COLOR_TOKENS.dark["btn.secondary"], 0.9)
    : withOpacity(COLOR_TOKENS.light["bg.modal"], 0.96);
  const activeTabBg = isDark
    ? withOpacity(COLOR_TOKENS.dark["text.primary"], 0.14)
    : withOpacity(COLOR_TOKENS.light["border.default"], 0.72);
  const inactiveText = withOpacity(
    palette["text.secondary"],
    isDark ? 0.86 : 0.94,
  );
  const activeText = palette["text.primary"];
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(1, {
      damping: 20,
      stiffness: 220,
      mass: 0.85,
    });
  }, [progress]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [14, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.94, 1]) },
    ],
  }));

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 items-center"
      style={{ bottom, zIndex: 42 }}
    >
      <Animated.View
        style={[
          containerAnimatedStyle,
          {
            alignSelf: "center",
            borderRadius: RADIUS_TOKENS.full,
            borderWidth: 0.5,
            borderColor: shellBorder,
            backgroundColor: shellBg,
          },
        ]}
        className="overflow-hidden"
      >
        <BlurView
          intensity={isDark ? 54 : 70}
          tint={isDark ? "dark" : "light"}
          style={{ borderRadius: RADIUS_TOKENS.full }}
        >
          <View
            className="flex-row items-center"
            style={{
              paddingHorizontal: 0,
              paddingVertical: 2,
            }}
          >
            {TABS.map((tab) => (
              <ActionTabItem
                key={tab.key}
                tab={tab}
                isActive={tab.key === activeTab}
                activeTabBg={activeTabBg}
                activeText={activeText}
                inactiveText={inactiveText}
              />
            ))}
          </View>
        </BlurView>
      </Animated.View>
    </View>
  );
}
