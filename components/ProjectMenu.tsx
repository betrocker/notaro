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
import type { IconName } from "./Icon";

interface ProjectMenuProps {
  onClose: () => void;
  anchor?: {
    x: number;
    y: number;
  } | null;
  actions?: ProjectMenuAction[];
}

export type ProjectMenuAction = {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  destructive?: boolean;
  showSeparatorAbove?: boolean;
};

const DEFAULT_ACTIONS: ProjectMenuAction[] = [
  {
    key: "complete-project",
    label: "Complete Project",
    icon: "checkCircle",
    onPress: () => {
      console.log("Complete Project");
    },
  },
  {
    key: "when",
    label: "When",
    icon: "upcoming",
    onPress: () => {
      console.log("When");
    },
  },
  {
    key: "add-tags",
    label: "Add Tags",
    icon: "tag",
    onPress: () => {
      console.log("Add Tags");
    },
  },
  {
    key: "add-deadline",
    label: "Add Deadline",
    icon: "upcoming",
    onPress: () => {
      console.log("Add Deadline");
    },
  },
  {
    key: "share",
    label: "Share",
    icon: "share",
    onPress: () => {
      console.log("Share");
    },
    showSeparatorAbove: true,
  },
  {
    key: "delete-project",
    label: "Delete Project",
    icon: "trash",
    onPress: () => {
      console.log("Delete Project");
    },
    destructive: true,
  },
];

export default function ProjectMenu({
  onClose,
  anchor = null,
  actions,
}: ProjectMenuProps) {
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
  const resolvedActions = actions && actions.length > 0 ? actions : DEFAULT_ACTIONS;

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
            {resolvedActions.map((item) => (
              <React.Fragment key={item.key}>
                {item.showSeparatorAbove ? (
                  <View
                    className="mx-4 my-1 h-px"
                    style={{
                      backgroundColor: borderColor,
                      opacity: 0.8,
                    }}
                  />
                ) : null}
                <TouchableOpacity
                  className="flex-row items-center px-4 py-3"
                  onPress={() => {
                    item.onPress();
                    onClose();
                  }}
                >
                  <Icon name={item.icon} size={20} color={menuIconColor} />
                  <Text
                    className="ml-3 font-regular text-label-sm"
                    style={{
                      color: item.destructive ? color["text.secondary"] : itemTextColor,
                    }}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
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
