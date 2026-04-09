import { BlurView } from "expo-blur";
import { useColorScheme } from "nativewind";
import React from "react";
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
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./Icon";

interface ProjectMenuProps {
  onClose: () => void;
  anchor?: {
    x: number;
    y: number;
  } | null;
}

export default function ProjectMenu({ onClose, anchor = null }: ProjectMenuProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colorMode = isDark ? "dark" : "light";
  const color = COLOR_TOKENS[colorMode];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const menuWidth = 224;
  const surfaceColor = color["bg.popup"];
  const borderColor = isDark
    ? color["btn.secondary"]
    : color["border.default"];
  const menuIconColor = color["primary.soft"];
  const itemTextColor = color["text.primary"];
  const fallbackTop = insets.top + 42;
  const anchorY = anchor?.y ?? fallbackTop;
  const menuRight = 16;
  const menuTop = Math.max(insets.top + 8, anchorY + 12);

  return (
    <Animated.View
      entering={FadeIn.duration(110)}
      exiting={FadeOut.duration(90)}
      style={[StyleSheet.absoluteFillObject, { zIndex: 100 }]}
    >
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose}>
        <View
          style={[
            styles.backdrop,
            { backgroundColor: color["bg.overlay"], opacity: 0.42 },
          ]}
        />
      </Pressable>

      <Animated.View
        entering={ZoomIn.duration(90)
          .springify()
          .damping(56)
          .stiffness(620)
          .mass(0.7)}
        exiting={ZoomOut.duration(75)}
        className="absolute overflow-hidden rounded-[26px]"
        style={[
          styles.shadow,
          {
            top: menuTop,
            right: menuRight,
            width: menuWidth,
            transformOrigin: "top center",
            backgroundColor: surfaceColor,
            borderWidth: 0.5,
            borderColor,
          } as any,
        ]}
      >
        <BlurView
          intensity={isDark ? 50 : 70}
          tint={isDark ? "dark" : "light"}
          style={{ backgroundColor: "transparent" }}
        >
          <TouchableOpacity
            className="flex-row items-center px-4 py-3"
            onPress={() => {
              console.log("Complete Project");
              onClose();
            }}
          >
            <Icon name="checkCircle" size={20} color={menuIconColor} />
            <Text
              className="ml-3 font-regular text-label-sm"
              style={{ color: itemTextColor }}
            >
              Complete Project
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-4 py-3"
            onPress={() => {
              console.log("When");
              onClose();
            }}
          >
            <Icon name="upcoming" size={20} color={menuIconColor} />
            <Text
              className="ml-3 font-regular text-label-sm"
              style={{ color: itemTextColor }}
            >
              When
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-4 py-3"
            onPress={() => {
              console.log("Add Tags");
              onClose();
            }}
          >
            <Icon name="tag" size={20} color={menuIconColor} />
            <Text
              className="ml-3 font-regular text-label-sm"
              style={{ color: itemTextColor }}
            >
              Add Tags
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-4 py-3"
            onPress={() => {
              console.log("Add Deadline");
              onClose();
            }}
          >
            <Icon name="upcoming" size={20} color={menuIconColor} />
            <Text
              className="ml-3 font-regular text-label-sm"
              style={{ color: itemTextColor }}
            >
              Add Deadline
            </Text>
          </TouchableOpacity>

          <View
            className="mx-4 my-1 h-px"
            style={{
              backgroundColor: borderColor,
              opacity: 0.8,
            }}
          />

          <TouchableOpacity
            className="flex-row items-center px-4 py-3"
            onPress={() => {
              console.log("Share");
              onClose();
            }}
          >
            <Icon name="share" size={20} color={menuIconColor} />
            <Text
              className="ml-3 font-regular text-label-sm"
              style={{ color: itemTextColor }}
            >
              Share
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-4 py-3"
            onPress={() => {
              console.log("Delete Project");
              onClose();
            }}
          >
            <Icon name="trash" size={20} color={menuIconColor} />
            <Text
              className="ml-3 font-regular text-label-sm"
              style={{ color: color["text.secondary"] }}
            >
              Delete Project
            </Text>
          </TouchableOpacity>
        </BlurView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: SHADOW_TOKENS.card.ios.shadowColor,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
      android: { elevation: 10 },
    }),
  },
});
