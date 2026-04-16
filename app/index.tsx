import {
  createProject,
  fetchHomeData,
} from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getThemeTokens } from "@/lib/theme";
import { Icon, IconName } from "@/components/Icon";
import { InlineComposer } from "@/components/InlineComposer";
import { QuickFindPullDown } from "@/components/QuickFindPullDown";
import { AppText as Text } from "@/components/ui";
import { COLOR_TOKENS, SPACING_TOKENS } from "@/lib/design-system/tokens";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  unstable_batchedUpdates,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ListItemProps {
  icon: IconName;
  iconColor: string;
  title: string;
  count?: number;
  subtitle?: string;
  onPress: () => void;
  dense?: boolean;
  titleVariant?: React.ComponentProps<typeof Text>["variant"];
  titleClassName?: string;
}

type OverviewMetricKey =
  | "todayJobs"
  | "scheduledJobs"
  | "unscheduledJobs"
  | "archivedJobs"
  | "completedJobs";

const OVERVIEW_COUNT_ENABLED: Record<OverviewMetricKey, boolean> = {
  todayJobs: false,
  scheduledJobs: false,
  unscheduledJobs: false,
  archivedJobs: false,
  completedJobs: false,
};

const OVERVIEW_ITEMS = [
  {
    icon: "today" as const,
    iconColor: "var(--color-today)",
    title: "Today",
    key: "todayJobs" as OverviewMetricKey,
    route: "/today" as const,
  },
  {
    icon: "upcoming" as const,
    iconColor: "var(--color-upcoming)",
    title: "Upcoming",
    key: "scheduledJobs" as OverviewMetricKey,
    route: "/upcoming" as const,
  },
  {
    icon: "anytime" as const,
    iconColor: "var(--color-anytime)",
    title: "Anytime",
    key: "unscheduledJobs" as OverviewMetricKey,
    route: "/anytime" as const,
  },
  {
    icon: "someday" as const,
    iconColor: "var(--color-someday)",
    title: "Someday",
    key: "archivedJobs" as OverviewMetricKey,
    route: "/someday" as const,
  },
  {
    icon: "logbook" as const,
    iconColor: "var(--color-logbook)",
    title: "Logbook",
    key: "completedJobs" as OverviewMetricKey,
    route: "/logbook" as const,
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

const ListItem = ({
  icon,
  iconColor,
  title,
  count,
  subtitle,
  onPress,
  dense = false,
  titleVariant = "bodyLg",
  titleClassName = "font-semibold text-things-text",
}: ListItemProps) => (
  <TouchableOpacity
    activeOpacity={0.72}
    onPress={onPress}
    className={`flex-row items-center px-1 ${dense ? "py-1.5" : "py-2"}`}
  >
    <View className="h-8 w-8 items-center justify-center">
      <Icon name={icon} size={22} color={iconColor} />
    </View>

    <View className="ml-2 flex-1">
      <Text variant={titleVariant} className={titleClassName}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="mt-0.5 font-regular text-label-sm text-things-muted">
          {subtitle}
        </Text>
      ) : null}
    </View>

    {count !== undefined && count > 0 ? (
      <View className="min-w-[28px] items-end">
        <Text className="font-medium text-label-sm text-things-muted">
          {count}
        </Text>
      </View>
    ) : null}
  </TouchableOpacity>
);

function HeaderAction({
  icon,
  onPress,
}: {
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="h-9 w-9 items-center justify-center rounded-full"
      style={{
        backgroundColor: "transparent",
        borderWidth: 0.5,
        borderColor: "var(--color-border-default)",
      }}
      activeOpacity={0.75}
    >
      <Icon name={icon} size={19} color="var(--color-muted)" />
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { colorScheme } = useColorScheme();
  const theme = getThemeTokens(colorScheme === "dark");
  const { newProject } = useLocalSearchParams<{ newProject?: string }>();
  const projectsDividerColor = withOpacity(COLOR_TOKENS.dark["text.primary"], 0.15);
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [inlineText, setInlineText] = useState("");
  const [listCounts, setListCounts] = useState<Record<string, number>>({
    clients: 0,
    todayJobs: 0,
    allJobs: 0,
    unscheduledJobs: 0,
    scheduledJobs: 0,
    completedJobs: 0,
    archivedJobs: 0,
    invoices: 0,
  });
  const [clients, setClients] = useState<
    {
      id: string;
      title: string;
      notes: string;
      taskCount: number;
    }[]
  >([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSettingsPressed, setIsSettingsPressed] = useState(false);
  const [isInlineSaving, setIsInlineSaving] = useState(false);
  const inlineSubmitLockRef = useRef(false);
  const inlineFade = useRef(new Animated.Value(1)).current;
  const inlineTextColor = COLOR_TOKENS.dark["text.primary"];
  const inlineTextOpacity = 1;
  const inlineIconColor = withOpacity(COLOR_TOKENS.dark["text.primary"], 0.86);
  const inlinePlaceholderColor = withOpacity(
    COLOR_TOKENS.dark["text.primary"],
    0.72,
  );
  const inlineEditorBg = withOpacity(COLOR_TOKENS.dark["primary.default"], 0.78);

  const loadHomeData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      return;
    }

    try {
      const data = await fetchHomeData();
      setListCounts(data.metrics);
      setClients(
        data.clients.map((client) => ({
          id: client.id,
          title: client.name ?? "Novi projekat",
          notes: client.note ?? "",
          taskCount: client.jobCount,
        })),
      );
      setErrorMessage(null);
    } catch (error) {
      setListCounts({
        clients: 0,
        todayJobs: 0,
        allJobs: 0,
        unscheduledJobs: 0,
        scheduledJobs: 0,
        completedJobs: 0,
        archivedJobs: 0,
        invoices: 0,
      });
      setClients([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nisam uspeo da ucitam podatke sa Supabase.",
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHomeData();
    }, [loadHomeData]),
  );

  useEffect(() => {
    if (newProject !== "1") {
      return;
    }

    setInlineText("");
    setIsInlineSaving(false);
    inlineFade.setValue(1);
    setIsCreatingInline(true);
    router.replace("/");
  }, [inlineFade, newProject]);

  const handleInlineSubmit = async () => {
    if (inlineSubmitLockRef.current) {
      return;
    }

    const title = inlineText.trim();

    if (!title) {
      setIsCreatingInline(false);
      setInlineText("");
      setIsInlineSaving(false);
      inlineFade.setValue(1);
      return;
    }

    inlineSubmitLockRef.current = true;
    let releaseLockInFinally = true;
    setInlineText(title);
    setIsInlineSaving(true);

    try {
      const createdProject = await createProject(title);
      setErrorMessage(null);
      inlineFade.stopAnimation();
      inlineFade.setValue(1);
      Animated.timing(inlineFade, {
        toValue: 0,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        unstable_batchedUpdates(() => {
          setClients((current) => [
            {
              id: createdProject.id,
              title: createdProject.name ?? "Novi projekat",
              notes: createdProject.note ?? "",
              taskCount: 0,
            },
            ...current,
          ]);
          setListCounts((current) => ({
            ...current,
            clients: current.clients + 1,
          }));
          setIsCreatingInline(false);
          setIsInlineSaving(false);
          setInlineText("");
          inlineSubmitLockRef.current = false;
        });
      });
      releaseLockInFinally = false;
      return;
    } catch (error) {
      setIsInlineSaving(false);
      setErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da sacuvam projekat.",
      );
    } finally {
      if (releaseLockInFinally && inlineSubmitLockRef.current) {
        inlineSubmitLockRef.current = false;
      }
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-things-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-things-bg"
      >
        <Stack.Screen
          options={{
            headerTitle: "",
            headerShadowVisible: false,
            headerStyle: { backgroundColor: "var(--color-bg)" },
            headerRight: () => (
              <HeaderAction
                icon="search"
                onPress={() => console.log("Search")}
              />
            ),
          }}
        />

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop:
              SPACING_TOKENS["4xl"] +
              SPACING_TOKENS["2xl"] +
              SPACING_TOKENS.sm,
            paddingBottom: 132,
          }}
          showsVerticalScrollIndicator={false}
        >
          {errorMessage ? (
            <Text className="mb-4 font-regular text-label-sm leading-5 text-things-muted">
              {errorMessage}
            </Text>
          ) : null}

          <TouchableOpacity
            className="mb-6 flex-row items-center px-1"
            activeOpacity={0.72}
            onPress={() => router.push("/inbox" as never)}
          >
            <Icon name="inbox" size={22} color="var(--color-inbox)" />
            <View className="ml-2 flex-1">
              <Text variant="bodyLg" className="font-semibold text-things-text">
                Quick Tasks
              </Text>
            </View>
            {(listCounts.unscheduledJobs ?? 0) > 0 ? (
              <View className="min-w-[28px] items-end">
                <Text className="font-medium text-label-sm text-things-muted">
                  {listCounts.unscheduledJobs}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <View className="mb-8">
            {OVERVIEW_ITEMS.map((item) => (
              <View key={item.title} className={item.key === "completedJobs" ? "mt-4" : ""}>
                <ListItem
                  icon={item.icon}
                  iconColor={item.iconColor}
                  title={item.title}
                  count={
                    OVERVIEW_COUNT_ENABLED[item.key]
                      ? (listCounts[item.key] ?? 0)
                      : 0
                  }
                  dense
                  onPress={() => router.push(item.route as never)}
                />
              </View>
            ))}
          </View>

          {clients.length > 0 ? (
            <View
              className="mb-4 h-px"
              style={{
                backgroundColor: projectsDividerColor,
                width: "96%",
                alignSelf: "center",
              }}
            />
          ) : null}

          <View className="mb-2">
            {isCreatingInline ? (
              <InlineComposer
                icon="project"
                iconColor={inlineIconColor}
                value={inlineText}
                isSaving={isInlineSaving}
                placeholder="New Project"
                placeholderTextColor={inlinePlaceholderColor}
                textColor={inlineTextColor}
                textOpacity={inlineTextOpacity}
                backgroundColor={inlineEditorBg}
                backgroundFade={inlineFade}
                selectionColor={inlineTextColor}
                autoFocus
                onChangeText={setInlineText}
                onSubmit={() => void handleInlineSubmit()}
              />
            ) : null}

            {clients.map((client) => (
              <ListItem
                key={client.id}
                icon="project"
                iconColor="var(--color-muted)"
                title={client.title}
                titleVariant="bodyMd"
                titleClassName="font-regular text-things-text"
                count={client.taskCount}
                onPress={() =>
                  router.push({
                    pathname: "/project/[id]",
                    params: { id: client.id },
                  })
                }
              />
            ))}

          </View>
        </ScrollView>

        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: SPACING_TOKENS.md,
            left: SPACING_TOKENS.lg,
            right: SPACING_TOKENS.lg,
            zIndex: 30,
          }}
        >
          <QuickFindPullDown />
        </View>

        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 106,
            zIndex: 20,
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPressIn={() => setIsSettingsPressed(true)}
            onPressOut={() => setIsSettingsPressed(false)}
            onPress={() => router.push("/settings" as never)}
            style={{
              minHeight: 34,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 9999,
              overflow: "hidden",
              alignSelf: "center",
              backgroundColor: isSettingsPressed
                ? theme.settingsLinkBgPressed
                : "transparent",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                className="mr-2 h-4 w-4 items-center justify-center"
                style={{ overflow: "hidden" }}
              >
                <Icon
                  name="sliders"
                  size={15}
                  color={
                    isSettingsPressed
                      ? theme.settingsLinkTextPressed
                      : theme.settingsLinkText
                  }
                />
              </View>
              <Text
                className="font-regular text-footer"
                style={{
                  color: isSettingsPressed
                    ? theme.settingsLinkTextPressed
                    : theme.settingsLinkText,
                }}
              >
                Settings
              </Text>
            </View>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
