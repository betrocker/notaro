import { Icon, IconName } from "@/components/Icon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "nativewind";
import React from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { AppText as Text } from "@/components/ui";
import { COLOR_TOKENS } from "@/lib/design-system/tokens";

export default function AppearanceScreen() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const activeTheme = colorScheme ?? "system";
  const isDark = activeTheme === "dark";

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
    const colorMode = isDark ? "dark" : "light";

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        className="flex-row items-center pr-1"
        style={{
          paddingVertical: 10,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: COLOR_TOKENS[colorMode]["border.default"],
        }}
        onPress={() => handleThemeChange(value)}
      >
        <View
          className="mr-3 h-8 w-8 items-center justify-center rounded-[10px]"
          style={{
            borderWidth: 1.5,
            borderColor: COLOR_TOKENS[colorMode]["border.default"],
            backgroundColor: "var(--color-tag)",
          }}
        >
          <Icon name={icon} size={17} color="var(--color-text)" />
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
            backgroundColor: "var(--color-bg-input)",
            width: 52,
            height: 52,
            borderRadius: 14,
          }}
        >
          <Icon name="appearance" size={24} color="var(--color-text)" />
        </View>
      </View>

      <Text className="mt-5 font-medium text-label-md text-things-text">
        Appearance
      </Text>
      <View
        className="mt-0.5 mb-1"
        style={{
          height: 1,
          backgroundColor: "var(--color-border-default)",
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
