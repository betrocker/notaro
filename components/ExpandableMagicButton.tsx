import { BlurView } from "expo-blur";
import { useColorScheme } from "nativewind";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
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

const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.8 };
const BUTTON_OFFSCREEN = 150;

export default function ThingsMagicMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colorMode = isDark ? "dark" : "light";
  const color = COLOR_TOKENS[colorMode];

  const menuProgress = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  const buttonTranslateY = useSharedValue(0);

  const openMenu = () => {
    setIsOpen(true);
    buttonScale.value = withTiming(0, { duration: 150 });
    menuProgress.value = withSpring(1, SPRING_CONFIG);
  };

  const closeMenu = () => {
    setIsOpen(false);
    menuProgress.value = withSpring(0, SPRING_CONFIG);
    buttonTranslateY.value = BUTTON_OFFSCREEN;
    buttonScale.value = 1;
    buttonTranslateY.value = withSpring(0, {
      damping: 18,
      stiffness: 180,
      mass: 0.6,
    });
  };

  const menuAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(menuProgress.value, [0, 1], [0.1, 1]);
    const translateY = interpolate(menuProgress.value, [0, 1], [30, 0]);
    const translateX = interpolate(menuProgress.value, [0, 1], [20, 0]);

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
      right: 0,
    };
  });

  return (
    <>
      {isOpen ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              zIndex: 40,
              backgroundColor: color["bg.popup"],
              opacity: 0.42,
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeMenu} />
        </Animated.View>
      ) : null}

      <View className="absolute bottom-10 right-6 z-50">
        <Animated.View
          style={[
            menuAnimatedStyle,
            styles.shadow,
            { transformOrigin: "bottom right" } as any,
          ]}
          className="mb-2 overflow-hidden rounded-3xl"
        >
          <BlurView
            intensity={isDark ? 40 : 60}
            tint={isDark ? "dark" : "light"}
            style={{ backgroundColor: color["bg.popup"], width: 192 }}
          >
            <TouchableOpacity
              className="flex-row items-center border-b border-things-border/50 px-4 py-3.5"
              onPress={closeMenu}
            >
              <View className="mr-3 h-6 w-6 items-center justify-center">
                <Icon name="todo" size={20} color={COLOR_TOKENS[colorMode]["text.primary"]} />
              </View>
              <Text className="font-medium text-things-body text-things-text">New To-Do</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center border-b border-things-border/50 px-4 py-3.5"
              onPress={closeMenu}
            >
              <View className="mr-3 h-6 w-6 items-center justify-center">
                <Icon name="project" size={20} color={COLOR_TOKENS[colorMode]["text.primary"]} />
              </View>
              <Text className="font-medium text-things-body text-things-text">New Project</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center px-4 py-3.5"
              onPress={closeMenu}
            >
              <View className="mr-3 h-6 w-6 items-center justify-center">
                <Icon name="area" size={20} color={COLOR_TOKENS[colorMode]["text.primary"]} />
              </View>
              <Text className="font-medium text-things-body text-things-text">New Area</Text>
            </TouchableOpacity>
          </BlurView>
        </Animated.View>

        <Animated.View style={mainButtonAnimatedStyle}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={openMenu}
            className="h-16 w-16 items-center justify-center rounded-full bg-things-inbox"
            style={styles.magicShadow}
          >
            <Icon name="plus" size={32} color={COLOR_TOKENS.dark["text.primary"]} />
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
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
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
