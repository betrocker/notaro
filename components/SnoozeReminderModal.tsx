import { ModalCircleButton } from "@/components/ModalCircleButton";
import { TransparentModalShell } from "@/components/TransparentModalShell";
import { AppText as Text } from "@/components/ui";
import { COLOR_TOKENS } from "@/lib/design-system/tokens";
import { getThemeTokens } from "@/lib/theme";
import React from "react";
import { TouchableOpacity, View } from "react-native";

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

export type SnoozePreset = "oneHour" | "tonight" | "tomorrow";

export function SnoozeReminderModal({
  visible,
  title,
  colorMode,
  theme,
  actionBackgroundColor,
  onClose,
  onSelectPreset,
}: {
  visible: boolean;
  title: string;
  colorMode: "light" | "dark";
  theme: ReturnType<typeof getThemeTokens>;
  actionBackgroundColor: string;
  onClose: () => void;
  onSelectPreset: (preset: SnoozePreset) => void;
}) {
  if (!visible) {
    return null;
  }

  return (
    <TransparentModalShell
      closeOnBackdropPress
      onBackdropPress={onClose}
      backdropColor={COLOR_TOKENS[colorMode]["bg.overlay"]}
      backdropOpacity={colorMode === "dark" ? 0.56 : 0.34}
      overlayStyle={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 34,
        paddingHorizontal: 16,
        justifyContent: "center",
        alignItems: "center",
      }}
      contentStyle={{
        width: "80%",
        borderRadius: 28,
        borderWidth: 0.5,
        overflow: "hidden",
        borderColor: withOpacity(COLOR_TOKENS[colorMode]["text.secondary"], 0.28),
        backgroundColor: COLOR_TOKENS[colorMode]["bg.popup"],
      }}
    >
      <View
        style={{
          height: 56,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 6,
          marginBottom: 8,
          paddingHorizontal: 54,
        }}
      >
        <Text
          variant="bodyLg"
          className="font-bold"
          style={{ color: COLOR_TOKENS[colorMode]["text.primary"], textAlign: "center" }}
          numberOfLines={1}
        >
          {title || "Reminder"}
        </Text>
        <View style={{ position: "absolute", top: 8, right: 16 }}>
          <ModalCircleButton icon="close" theme={theme} onPress={onClose} />
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }}>
        <Text
          variant="footer"
          className="text-center font-regular text-things-muted"
        >
          Snooze
        </Text>

        <View className="mt-4">
          <TouchableOpacity
            activeOpacity={0.82}
            className="rounded-full px-3 py-2.5"
            style={{ backgroundColor: actionBackgroundColor }}
            onPress={() => onSelectPreset("oneHour")}
          >
            <Text className="text-center font-medium text-label-sm text-things-text">
              +1h
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.82}
            className="mt-2 rounded-full px-3 py-2.5"
            style={{ backgroundColor: actionBackgroundColor }}
            onPress={() => onSelectPreset("tonight")}
          >
            <Text className="text-center font-medium text-label-sm text-things-text">
              Tonight 20:00
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.82}
            className="mt-2 rounded-full px-3 py-2.5"
            style={{ backgroundColor: actionBackgroundColor }}
            onPress={() => onSelectPreset("tomorrow")}
          >
            <Text className="text-center font-medium text-label-sm text-things-text">
              Tomorrow 09:00
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TransparentModalShell>
  );
}

export default SnoozeReminderModal;
