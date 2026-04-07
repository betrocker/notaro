import React, { PropsWithChildren } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  BaseAnimationBuilder,
} from "react-native-reanimated";
import { useColorScheme } from "nativewind";
import { COLOR_TOKENS } from "@/lib/design-system/tokens";

interface TransparentModalShellProps extends PropsWithChildren {
  backdropColor?: string;
  backdropOpacity?: number;
  closeOnBackdropPress?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  enteringBackdrop?: BaseAnimationBuilder;
  enteringContent?: BaseAnimationBuilder;
  exitingBackdrop?: BaseAnimationBuilder;
  exitingContent?: BaseAnimationBuilder;
  onBackdropPress?: () => void;
  overlayStyle?: StyleProp<ViewStyle>;
  visible?: boolean;
}

export function TransparentModalShell({
  backdropColor,
  backdropOpacity = 0.42,
  children,
  closeOnBackdropPress = false,
  contentStyle,
  enteringBackdrop,
  enteringContent,
  exitingBackdrop,
  exitingContent,
  onBackdropPress,
  overlayStyle,
  visible = true,
}: TransparentModalShellProps) {
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const resolvedBackdropColor = backdropColor ?? COLOR_TOKENS[colorMode]["bg.popup"];

  const handleBackdropPress = () => {
    if (!closeOnBackdropPress) {
      return;
    }

    onBackdropPress?.();
  };

  return (
    <View style={[styles.overlay, overlayStyle]}>
      {visible ? (
        <>
          {enteringBackdrop || exitingBackdrop ? (
            <Animated.View
              entering={enteringBackdrop}
              exiting={exitingBackdrop}
              style={StyleSheet.absoluteFill}
            >
              <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress}>
                <View
                  style={[
                    styles.backdrop,
                    { backgroundColor: resolvedBackdropColor, opacity: backdropOpacity },
                  ]}
                />
              </Pressable>
            </Animated.View>
          ) : (
            <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress}>
              <View
                style={[
                  styles.backdrop,
                  { backgroundColor: resolvedBackdropColor, opacity: backdropOpacity },
                ]}
              />
            </Pressable>
          )}

          {enteringContent || exitingContent ? (
            <Animated.View
              entering={enteringContent}
              exiting={exitingContent}
              style={contentStyle}
            >
              {children}
            </Animated.View>
          ) : (
            <View style={contentStyle}>{children}</View>
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
