import { BlurView } from "expo-blur";
import { useColorScheme } from "nativewind";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { AppText as Text } from "@/components/ui";
import { COLOR_TOKENS, SHADOW_TOKENS } from "@/lib/design-system/tokens";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "./Icon";

const SPRING_CONFIG = { damping: 56, stiffness: 620, mass: 0.7 };
const BUTTON_OFFSCREEN = 150;

interface ThingsMagicMenuProps {
  onNewTask: () => void;
  onNewProject: () => void;
  onNewClient: () => void;
}

const ACTIONS = [
  {
    key: "task",
    label: "New Task",
    description: "Quickly add a new task to your inbox.",
    icon: "plusfab" as const,
    action: "task" as const,
  },
  {
    key: "project",
    label: "New Project",
    description: "Define a goal, then work toward it one task at a time.",
    icon: "project" as const,
    action: "project" as const,
  },
  {
    key: "client",
    label: "New Client",
    description: "Create a client profile for future work and follow-ups.",
    icon: "clipboard" as const,
    action: "client" as const,
  },
];

function withOpacity(hexColor: string, opacity: number) {
  const sanitized = hexColor.replace("#", "");
  const isShort = sanitized.length === 3;
  const full = isShort
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

export default function MagicMenu({
  onNewTask,
  onNewProject,
  onNewClient,
}: ThingsMagicMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colorMode = isDark ? "dark" : "light";
  const color = COLOR_TOKENS[colorMode];
  const { width } = useWindowDimensions();
  const menuWidth = Math.min(Math.max(width * 0.84, 312), 420);
  const surfaceColor = color["bg.popup"];
  const blurOverlayColor = withOpacity(COLOR_TOKENS.dark["bg.base"], 0.08);
  const menuBorderColor = withOpacity(COLOR_TOKENS.dark["text.secondary"], 0.38);
  const fabBorderColor = withOpacity(COLOR_TOKENS.dark["text.secondary"], 0.42);
  const itemTextColor = COLOR_TOKENS.dark["text.primary"];
  const secondaryTextColor = withOpacity(COLOR_TOKENS.dark["text.secondary"], 0.86);
  const overlayColor = COLOR_TOKENS.dark["bg.base"];
  const overlayOpacity = isDark ? 0.5 : 0.32;

  const menuProgress = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  const buttonTranslateY = useSharedValue(0);

  const openMenu = () => {
    setIsOpen(true);
    buttonScale.value = withTiming(0, { duration: 90 });
    menuProgress.value = withSpring(1, SPRING_CONFIG);
  };

  const closeMenu = (callback?: () => void) => {
    setIsOpen(false);
    menuProgress.value = withSpring(0, SPRING_CONFIG);
    buttonTranslateY.value = BUTTON_OFFSCREEN;
    buttonScale.value = 1;
    buttonTranslateY.value = withSpring(0, {
      damping: 24,
      stiffness: 260,
      mass: 0.6,
    });

    if (callback) {
      setTimeout(callback, 100);
    }
  };

  const menuAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(menuProgress.value, [0, 1], [0.18, 1]);
    const translateY = interpolate(menuProgress.value, [0, 1], [22, 0]);
    const translateX = interpolate(menuProgress.value, [0, 1], [18, 0]);

    return {
      opacity: menuProgress.value > 0.05 ? 1 : 0,
      transform: [{ translateX }, { translateY }, { scale }],
      pointerEvents: menuProgress.value > 0.5 ? "auto" : "none",
    };
  });

  const mainButtonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: buttonTranslateY.value },
        { scale: buttonScale.value },
      ],
      pointerEvents: menuProgress.value < 0.5 ? "auto" : "none",
      position: "absolute",
      bottom: 0,
      right: 24,
    };
  });

  return (
    <>
      {isOpen && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              zIndex: 40,
              backgroundColor: overlayColor,
              opacity: overlayOpacity,
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => closeMenu()}
          />
        </Animated.View>
      )}

      <View
        pointerEvents="box-none"
        className="absolute bottom-14 left-0 right-0 z-50 items-center"
      >
        <Animated.View
          style={[
            menuAnimatedStyle,
            styles.shadow,
            {
              width: menuWidth,
              backgroundColor: surfaceColor,
              borderColor: menuBorderColor,
              borderWidth: 0.5,
              transformOrigin: "bottom right",
            } as any,
          ]}
          className="mb-3 overflow-hidden rounded-[30px]"
        >
          <BlurView
            intensity={isDark ? 40 : 54}
            tint={isDark ? "dark" : "light"}
            style={{ backgroundColor: blurOverlayColor }}
          >
            {ACTIONS.map((item) => {
              const onPress =
                item.action === "task"
                  ? onNewTask
                  : item.action === "project"
                    ? onNewProject
                    : onNewClient;
              const iconColor =
                item.action === "task"
                  ? COLOR_TOKENS.dark["icon.inbox"]
                  : item.action === "project"
                    ? COLOR_TOKENS.dark["primary.default"]
                    : "var(--color-logbook)";

              return (
                <TouchableOpacity
                  key={item.key}
                  className="flex-row items-start px-5 py-4"
                  onPress={() => closeMenu(onPress)}
                >
                  <View className="mr-3 pt-0.5">
                    <Icon name={item.icon} size={20} color={iconColor} />
                  </View>

                  <View className="flex-1">
                    <Text
                      className="font-semibold text-label"
                      style={{ color: itemTextColor }}
                    >
                      {item.label}
                    </Text>
                    <Text
                      className="mt-0.5 font-regular text-footer"
                      style={{ color: secondaryTextColor }}
                    >
                      {item.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </BlurView>
        </Animated.View>

        <Animated.View style={mainButtonAnimatedStyle}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={openMenu}
            className="h-16 w-16 items-center justify-center rounded-full"
            style={[
              styles.magicShadow,
              {
                backgroundColor: color["primary.default"],
                borderWidth: 0.5,
                borderColor: fabBorderColor,
              },
            ]}
          >
            <Icon
              name="plusfab"
              size={32}
              color={COLOR_TOKENS.light["bg.modal"]}
            />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: SHADOW_TOKENS.card.ios.shadowColor,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 24,
      },
      android: { elevation: 12 },
    }),
  },
  magicShadow: {
    ...Platform.select({
      ios: {
        shadowColor: COLOR_TOKENS.dark["primary.default"],
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
});
