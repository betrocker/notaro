import { Icon } from "@/components/Icon";
import { ModalCircleButton } from "@/components/ModalCircleButton";
import { TransparentModalShell } from "@/components/TransparentModalShell";
import { AppTextInput, AppText as Text } from "@/components/ui";
import {
  BORDER_WIDTH_TOKENS,
  COLOR_TOKENS,
  SHADOW_TOKENS,
  SPACING_TOKENS,
} from "@/lib/design-system/tokens";
import {
  loadQuickFindRecents,
  recordQuickFindRecent,
  searchQuickFindLinks,
  type QuickFindLink,
} from "@/lib/quickFind";
import { fetchJobsList, type JobsListItem } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getThemeTokens } from "@/lib/theme";
import { router } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { FadeIn, FadeOut, ZoomIn, ZoomOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

function QuickFindRow({
  title,
  icon,
  iconColor,
  colorMode,
  onPress,
}: {
  title: string;
  icon: React.ComponentProps<typeof Icon>["name"];
  iconColor: string;
  colorMode: "light" | "dark";
  onPress: () => void;
}) {
  const rowPressedBg = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    colorMode === "dark" ? 0.18 : 0.1,
  );

  return (
    <Pressable
      onPress={onPress}
      className="min-h-[42px] rounded-[14px] px-0 py-[6px]"
      style={({ pressed }) => ({
        backgroundColor: pressed ? rowPressedBg : "transparent",
      })}
    >
      <View className="min-w-0 flex-row items-center">
        <View
          className="h-6 w-6 shrink-0 items-center justify-center"
          style={{ marginRight: 7 }}
        >
          <Icon name={icon} size={20} color={iconColor} />
        </View>

        <View className="min-w-0 flex-1">
          <Text
            className="font-medium text-body-md text-things-text"
            numberOfLines={1}
            style={{ fontSize: 15, lineHeight: 18 }}
          >
            {title}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function QuickFindScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colorMode = isDark ? "dark" : "light";
  const theme = getThemeTokens(isDark);
  const [query, setQuery] = useState("");
  const [recentLinks, setRecentLinks] = useState<QuickFindLink[]>([]);
  const [projects, setProjects] = useState<JobsListItem[]>([]);
  const modalBg = isDark
    ? COLOR_TOKENS.dark["bg.input"]
    : COLOR_TOKENS.light["bg.modal"];
  const borderColor = isDark
    ? COLOR_TOKENS.dark["btn.secondary"]
    : COLOR_TOKENS.light["border.default"];
  const searchPillBg = isDark
    ? theme.modalCircleButtonBg
    : theme.modalCircleButtonBg;
  const searchPillBorder = theme.modalCircleButtonBorder;
  const helperTextColor = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    0.9,
  );
  const sectionDividerColor = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    0.28,
  );
  const queryValue = query.trim();

  const results = useMemo(() => searchQuickFindLinks(queryValue), [queryValue]);
  const projectResults = useMemo(() => {
    if (!queryValue) {
      return [];
    }

    const terms = queryValue.toLowerCase().split(/\s+/).filter(Boolean);
    return projects
      .filter((project) => {
        const searchSpace =
          `${project.title ?? ""} ${project.description ?? ""}`.toLowerCase();
        return terms.every((term) => searchSpace.includes(term));
      })
      .slice(0, 8);
  }, [projects, queryValue]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      const nextRecents = await loadQuickFindRecents();
      if (!active) {
        return;
      }

      setRecentLinks(nextRecents);

      if (!isSupabaseConfigured) {
        setProjects([]);
        return;
      }

      try {
        const projectItems = await fetchJobsList();
        if (!active) {
          return;
        }

        setProjects(projectItems);
      } catch {
        if (!active) {
          return;
        }

        setProjects([]);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  const handleNavigate = useCallback((link: QuickFindLink) => {
    void recordQuickFindRecent(link.href);
    router.replace(link.href as never);
  }, []);

  const handleSubmitSearch = useCallback(() => {
    if (results.length > 0) {
      handleNavigate(results[0]);
      return;
    }

    if (projectResults.length === 0) {
      return;
    }

    router.replace({
      pathname: "/job/[id]",
      params: { id: projectResults[0].id },
    } as never);
  }, [handleNavigate, projectResults, results]);

  const sectionTitle = queryValue.length > 0 ? "Results" : "Recent";
  const visibleLinks = queryValue.length > 0 ? results : recentLinks;

  return (
    <View className="flex-1 bg-transparent">
      <TransparentModalShell
        closeOnBackdropPress
        onBackdropPress={() => router.back()}
        enteringBackdrop={FadeIn.duration(110)}
        exitingBackdrop={FadeOut.duration(90)}
        enteringContent={ZoomIn.duration(90)
          .springify()
          .damping(56)
          .stiffness(620)
          .mass(0.7)}
        exitingContent={ZoomOut.duration(75)}
        contentStyle={
          [
            {
              width: "82%",
              maxHeight: "78%",
              borderWidth: 0.5,
              borderRadius: 28,
              overflow: "hidden",
            },
            Platform.select({
              ios: {
                ...SHADOW_TOKENS.card.ios,
              },
              android: {
                elevation: SHADOW_TOKENS.card.android.elevation,
              },
            }),
            {
              borderColor,
              backgroundColor: modalBg,
              transformOrigin: "top center",
            },
          ] as any
        }
        overlayStyle={[
          {
            justifyContent: "flex-start",
            alignItems: "center",
            paddingHorizontal: SPACING_TOKENS.lg + 4,
          },
          { paddingTop: insets.top + SPACING_TOKENS.sm },
        ]}
      >
        <View className="px-6 pb-[18px] pt-4">
          <View className="flex-row items-center">
            <View
              style={[
                {
                  flex: 1,
                  height: 36,
                  borderRadius: 999,
                  borderWidth: BORDER_WIDTH_TOKENS.subtle,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: SPACING_TOKENS.md,
                },
                {
                  backgroundColor: searchPillBg,
                  borderColor: searchPillBorder,
                },
              ]}
            >
              <Icon
                name="search"
                size={22}
                color={COLOR_TOKENS[colorMode]["text.secondary"]}
              />
              <AppTextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSubmitSearch}
                placeholder="Quick Find"
                placeholderTextColor={COLOR_TOKENS[colorMode]["text.secondary"]}
                returnKeyType="search"
                className="ml-2 flex-1 font-regular text-things-text"
                style={{ fontSize: 13, lineHeight: 16 }}
                selectionColor={COLOR_TOKENS[colorMode]["primary.default"]}
              />
            </View>

            <View className="ml-2">
              <ModalCircleButton
                icon="close"
                theme={theme}
                onPress={() => router.back()}
              />
            </View>
          </View>

          <View className="mb-2 mt-4">
            <Text
              className="font-semibold"
              style={{
                fontSize: 13,
                lineHeight: 16,
                color: COLOR_TOKENS[colorMode]["text.secondary"],
              }}
            >
              {sectionTitle}
            </Text>
            <View
              className="mt-1 h-px w-full"
              style={{ backgroundColor: sectionDividerColor }}
            />
          </View>

          <ScrollView
            style={{ maxHeight: 336 }}
            contentContainerStyle={{ paddingBottom: 6 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {visibleLinks.length > 0
              ? visibleLinks.map((link) => (
                  <View
                    key={link.id}
                    className={queryValue.length > 0 ? "mb-1" : "mb-0.5"}
                  >
                    <QuickFindRow
                      title={link.title}
                      icon={link.icon}
                      iconColor={link.iconColor}
                      colorMode={colorMode}
                      onPress={() => handleNavigate(link)}
                    />
                  </View>
                ))
              : null}

            {queryValue.length > 0
              ? projectResults.map((project) => (
                  <View key={project.id} className="mb-1">
                    <QuickFindRow
                      title={project.title?.trim() || "Untitled project"}
                      icon="project"
                      iconColor="var(--color-today)"
                      colorMode={colorMode}
                      onPress={() =>
                        router.replace({
                          pathname: "/job/[id]",
                          params: { id: project.id },
                        } as never)
                      }
                    />
                  </View>
                ))
              : null}

            {visibleLinks.length === 0 && projectResults.length === 0 ? (
              <View className="items-center justify-center px-5 py-7">
                <Text className="text-center font-regular text-label-sm text-things-muted">
                  {queryValue.length > 0
                    ? "No matching screens."
                    : "No recent screens yet."}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View className="mt-2 items-center justify-center pb-4 pt-[14px]">
            <Text
              className="text-center font-regular"
              style={{ color: helperTextColor, fontSize: 13, lineHeight: 17 }}
            >
              Quickly switch screens, find projects, and jump anywhere.
            </Text>
          </View>
        </View>
      </TransparentModalShell>
    </View>
  );
}
