import {
  fetchHomeData,
} from "@/lib/repository";
import type { HomeData } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getThemeTokens } from "@/lib/theme";
import { Icon, IconName, LIST_ICON_COLORS } from "@/components/Icon";
import { QuickFindPullDown } from "@/components/QuickFindPullDown";
import SectionAccordion from "@/components/SectionAccordion";
import SnoozeReminderModal, { type SnoozePreset } from "@/components/SnoozeReminderModal";
import SwipeableActionRow from "@/components/SwipeableActionRow";
import { AppText as Text } from "@/components/ui";
import { COLOR_TOKENS, SPACING_TOKENS } from "@/lib/design-system/tokens";
import {
  fetchActiveReminders,
  markReminderDone,
  ReminderItem,
  snoozeReminder,
} from "@/lib/reminders";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, router } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

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

type HomeLinkMetricKey =
  | "allJobs"
  | "clients"
  | "scheduledJobs"
  | "completedJobs";

const ACCORDION_PREVIEW_LIMIT = 3;
const HOME_FAB_SIZE = 64;
const SETTINGS_LINK_HEIGHT = 34;

const HOME_LINK_ITEMS = [
  {
    icon: "project" as const,
    iconColor: "var(--color-today)",
    title: "Projects",
    key: "allJobs" as HomeLinkMetricKey,
    route: "/jobs" as const,
  },
  {
    icon: "client" as const,
    iconColor: "var(--color-logbook)",
    title: "Clients",
    key: "clients" as HomeLinkMetricKey,
    route: "/clients-home" as const,
  },
  {
    icon: "upcoming" as const,
    iconColor: "var(--color-upcoming)",
    title: "Upcoming",
    key: "scheduledJobs" as HomeLinkMetricKey,
    route: "/upcoming" as const,
  },
  {
    icon: "logbook" as const,
    iconColor: "var(--color-logbook)",
    title: "Logbook",
    key: "completedJobs" as HomeLinkMetricKey,
    route: "/logbook" as const,
    spacingTop: 10,
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

function formatPriceLabel(price: number | null | undefined) {
  if (price === null || price === undefined || !Number.isFinite(price)) {
    return null;
  }

  const rounded = Math.round(price * 100) / 100;
  const hasDecimals = Math.abs(rounded % 1) > 0.000001;
  const formatted = new Intl.NumberFormat("sr-RS", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(rounded);

  return `${formatted} RSD`;
}

function formatPaymentDateLabel(dateIso: string | null | undefined) {
  if (!dateIso) {
    return "today";
  }

  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "today";
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (target.getTime() === today.getTime()) {
    return "today";
  }

  const day = date.getDate();
  const month = date.getMonth() + 1;
  return `${day}. ${month}.`;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isReminderOverdue(remindAtIso: string) {
  const remindAtMs = Date.parse(remindAtIso);
  if (!Number.isFinite(remindAtMs)) {
    return false;
  }

  return remindAtMs < Date.now();
}

function formatReminderWhenParts(remindAtIso: string) {
  const remindAt = new Date(remindAtIso);
  if (!Number.isFinite(remindAt.getTime())) {
    return {
      dateLabel: "Invalid date",
      timeLabel: "--:--",
    };
  }

  const timeLabel = remindAt.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const now = new Date();
  if (isSameDay(remindAt, now)) {
    return {
      dateLabel: "Today",
      timeLabel,
    };
  }

  return {
    dateLabel: `${remindAt.getDate()}. ${remindAt.getMonth() + 1}.`,
    timeLabel,
  };
}

function getTonightDate(now = new Date()) {
  const tonight = new Date(now);
  tonight.setHours(20, 0, 0, 0);

  if (tonight.getTime() <= now.getTime()) {
    tonight.setDate(tonight.getDate() + 1);
  }

  return tonight;
}

function getTomorrowAtNineDate(now = new Date()) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow;
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
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const theme = getThemeTokens(colorScheme === "dark");
  const sectionDividerColor = withOpacity(COLOR_TOKENS[colorMode]["text.primary"], 0.15);
  const projectStatusRingColor = withOpacity(COLOR_TOKENS[colorMode]["text.secondary"], 0.58);
  const projectStatusFillColor = LIST_ICON_COLORS["--color-upcoming"];
  const debtItemIconColor = COLOR_TOKENS[colorMode]["primary.soft"];
  const emptySectionEmbossTextStyle = {
    color: withOpacity(COLOR_TOKENS[colorMode]["text.primary"], colorMode === "dark" ? 0.26 : 0.22),
    textShadowColor:
      colorMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  } as const;
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
  const [activeProjects, setActiveProjects] = useState<HomeData["activeProjects"]>([]);
  const [debts, setDebts] = useState<HomeData["debts"]>([]);
  const [payments, setPayments] = useState<HomeData["payments"]>([]);
  const [isHomeLoading, setIsHomeLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSettingsPressed, setIsSettingsPressed] = useState(false);
  const [isActiveProjectsExpanded, setIsActiveProjectsExpanded] = useState(false);
  const [isDebtsExpanded, setIsDebtsExpanded] = useState(false);
  const [isPaymentsExpanded, setIsPaymentsExpanded] = useState(false);
  const [isRemindersExpanded, setIsRemindersExpanded] = useState(false);
  const [isActiveProjectsListExpanded, setIsActiveProjectsListExpanded] = useState(false);
  const [isDebtsListExpanded, setIsDebtsListExpanded] = useState(false);
  const [isPaymentsListExpanded, setIsPaymentsListExpanded] = useState(false);
  const [isRemindersListExpanded, setIsRemindersListExpanded] = useState(false);
  const [isActiveProjectsMorePressed, setIsActiveProjectsMorePressed] = useState(false);
  const [isDebtsMorePressed, setIsDebtsMorePressed] = useState(false);
  const [isPaymentsMorePressed, setIsPaymentsMorePressed] = useState(false);
  const [isRemindersMorePressed, setIsRemindersMorePressed] = useState(false);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [isRemindersLoading, setIsRemindersLoading] = useState(true);
  const [remindersErrorMessage, setRemindersErrorMessage] = useState<string | null>(null);
  const [snoozeReminderId, setSnoozeReminderId] = useState<string | null>(null);
  const [doneReminderId, setDoneReminderId] = useState<string | null>(null);
  const paymentsMorePressedBg = withOpacity(
    COLOR_TOKENS[colorMode]["bg.input"],
    colorMode === "dark" ? 0.88 : 0.86,
  );
  const reminderOverdueColor = "#D15B52";
  const reminderUpcomingColor = COLOR_TOKENS[colorMode]["primary.default"];
  const reminderActionBg = withOpacity(
    COLOR_TOKENS[colorMode]["bg.input"],
    colorMode === "dark" ? 0.92 : 0.88,
  );
  const reminderSwipeRevealBg =
    colorMode === "dark" ? "#3A3D42" : "#E2E5EA";
  const reminderSwipeActionBg = LIST_ICON_COLORS["--color-today"];
  const reminderSwipeActionIconColor = "#FFFFFF";
  const hiddenActiveProjectsCount = Math.max(
    activeProjects.length - ACCORDION_PREVIEW_LIMIT,
    0,
  );
  const visibleActiveProjects =
    isActiveProjectsListExpanded || activeProjects.length <= ACCORDION_PREVIEW_LIMIT
      ? activeProjects
      : activeProjects.slice(0, ACCORDION_PREVIEW_LIMIT);
  const hiddenDebtsCount = Math.max(debts.length - ACCORDION_PREVIEW_LIMIT, 0);
  const visibleDebts =
    isDebtsListExpanded || debts.length <= ACCORDION_PREVIEW_LIMIT
      ? debts
      : debts.slice(0, ACCORDION_PREVIEW_LIMIT);
  const hiddenPaymentsCount = Math.max(payments.length - ACCORDION_PREVIEW_LIMIT, 0);
  const visiblePayments =
    isPaymentsListExpanded || payments.length <= ACCORDION_PREVIEW_LIMIT
      ? payments
      : payments.slice(0, ACCORDION_PREVIEW_LIMIT);
  const orderedReminders = useMemo(() => {
    return [...reminders].sort((left, right) => {
      const leftOverdue = isReminderOverdue(left.remindAt);
      const rightOverdue = isReminderOverdue(right.remindAt);
      if (leftOverdue !== rightOverdue) {
        return leftOverdue ? -1 : 1;
      }

      const leftTimestamp = Date.parse(left.remindAt);
      const rightTimestamp = Date.parse(right.remindAt);
      if (Number.isFinite(leftTimestamp) && Number.isFinite(rightTimestamp)) {
        if (leftTimestamp !== rightTimestamp) {
          return leftTimestamp - rightTimestamp;
        }
      } else if (Number.isFinite(leftTimestamp)) {
        return -1;
      } else if (Number.isFinite(rightTimestamp)) {
        return 1;
      }

      return left.createdAt.localeCompare(right.createdAt, "sr");
    });
  }, [reminders]);
  const hiddenRemindersCount = Math.max(orderedReminders.length - ACCORDION_PREVIEW_LIMIT, 0);
  const visibleReminders =
    isRemindersListExpanded || orderedReminders.length <= ACCORDION_PREVIEW_LIMIT
      ? orderedReminders
      : orderedReminders.slice(0, ACCORDION_PREVIEW_LIMIT);
  const snoozeReminderTarget = useMemo(
    () => reminders.find((item) => item.id === snoozeReminderId) ?? null,
    [reminders, snoozeReminderId],
  );
  const homeFabBottom = Math.max(insets.bottom + 8, 20);
  const settingsBottom = homeFabBottom + (HOME_FAB_SIZE - SETTINGS_LINK_HEIGHT) / 2;
  const skeletonBaseColor = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    colorMode === "dark" ? 0.22 : 0.14,
  );
  const skeletonStrongColor = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    colorMode === "dark" ? 0.34 : 0.22,
  );

  const renderSimpleSectionSkeletonRows = (
    count: number,
    options?: { showTrailingAmount?: boolean },
  ) => (
    <View className="px-1">
      {Array.from({ length: count }).map((_, index) => (
        <View key={`simple-skeleton-${index}`} className="flex-row items-center min-h-[46px] py-2">
          <View className="h-8 w-8 items-center justify-center">
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: skeletonBaseColor,
              }}
            />
          </View>
          <View className="ml-2 flex-1 pr-3">
            <View
              style={{
                width: "64%",
                height: 10,
                borderRadius: 5,
                backgroundColor: skeletonStrongColor,
              }}
            />
            <View
              style={{
                width: "46%",
                height: 8,
                borderRadius: 4,
                backgroundColor: skeletonBaseColor,
                marginTop: 6,
              }}
            />
          </View>
          {options?.showTrailingAmount ? (
            <View
              style={{
                width: 64,
                height: 10,
                borderRadius: 5,
                backgroundColor: skeletonStrongColor,
              }}
            />
          ) : null}
        </View>
      ))}
    </View>
  );

  const renderPaymentsSectionSkeletonRows = (count: number) => (
    <View className="px-1">
      {Array.from({ length: count }).map((_, index) => (
        <View key={`payments-skeleton-${index}`} className="flex-row items-center min-h-[46px] py-2">
          <View className="w-6 items-center justify-center">
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: skeletonBaseColor,
              }}
            />
          </View>

          <View className="mr-1 w-[46px] items-center justify-center">
            <View
              style={{
                width: 30,
                height: 8,
                borderRadius: 4,
                backgroundColor: skeletonStrongColor,
              }}
            />
          </View>

          <View className="min-w-0 flex-1 justify-center pr-2">
            <View
              style={{
                width: "58%",
                height: 10,
                borderRadius: 5,
                backgroundColor: skeletonStrongColor,
              }}
            />
            <View
              style={{
                width: "44%",
                height: 8,
                borderRadius: 4,
                backgroundColor: skeletonBaseColor,
                marginTop: 6,
              }}
            />
          </View>

          <View
            style={{
              width: 66,
              height: 10,
              borderRadius: 5,
              backgroundColor: skeletonStrongColor,
            }}
          />
        </View>
      ))}
    </View>
  );

  const loadHomeData = useCallback(async () => {
    setIsHomeLoading(true);

    if (!isSupabaseConfigured) {
      setActiveProjects([]);
      setDebts([]);
      setPayments([]);
      setErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      setIsHomeLoading(false);
      return;
    }

    try {
      const data = await fetchHomeData();
      setListCounts(data.metrics);
      setActiveProjects(data.activeProjects);
      setDebts(data.debts);
      setPayments(data.payments);
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
      setActiveProjects([]);
      setDebts([]);
      setPayments([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nisam uspeo da ucitam podatke sa Supabase.",
      );
    } finally {
      setIsHomeLoading(false);
    }
  }, []);

  const loadReminders = useCallback(async () => {
    setIsRemindersLoading(true);
    try {
      const activeReminders = await fetchActiveReminders();
      setReminders(activeReminders);
      setRemindersErrorMessage(null);
    } catch (error) {
      setReminders([]);
      setRemindersErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da ucitam reminders.",
      );
    } finally {
      setIsRemindersLoading(false);
    }
  }, []);

  const handleOpenReminder = useCallback((reminder: ReminderItem) => {
    if (reminder.jobId) {
      router.push({
        pathname: "/job/[id]",
        params: { id: reminder.jobId },
      });
      return;
    }

    router.push({
      pathname: "/new-reminder",
      params: { reminderId: reminder.id },
    });
  }, []);

  const handleDoneReminder = useCallback(
    async (reminderId: string) => {
      setDoneReminderId(reminderId);
      try {
        await markReminderDone(reminderId);
        await loadReminders();
      } finally {
        setDoneReminderId((current) => (current === reminderId ? null : current));
      }
    },
    [loadReminders],
  );

  const handleSnoozeReminder = useCallback(
    async (reminderId: string, nextDate: Date) => {
      await snoozeReminder(reminderId, nextDate);
      setSnoozeReminderId(null);
      await loadReminders();
    },
    [loadReminders],
  );

  const handleSwipeOpenReminderSnooze = useCallback((reminderId: string) => {
    if (doneReminderId) {
      return;
    }

    setSnoozeReminderId(reminderId);
  }, [doneReminderId]);

  const handleSelectSnoozePreset = useCallback(
    (preset: SnoozePreset) => {
      if (!snoozeReminderTarget) {
        return;
      }

      const nextDate =
        preset === "oneHour"
          ? new Date(Date.now() + 60 * 60 * 1000)
          : preset === "tonight"
            ? getTonightDate()
            : getTomorrowAtNineDate();

      void handleSnoozeReminder(snoozeReminderTarget.id, nextDate).catch((error) => {
        setRemindersErrorMessage(
          error instanceof Error ? error.message : "Nisam uspeo da odlozim reminder.",
        );
      });
    },
    [handleSnoozeReminder, snoozeReminderTarget],
  );

  useFocusEffect(
    useCallback(() => {
      void loadHomeData();
      void loadReminders();
    }, [loadHomeData, loadReminders]),
  );

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
                onPress={() => router.push("/quick-find" as never)}
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

          <View className="mb-8">
            {HOME_LINK_ITEMS.map((item) => (
              <View key={item.title} style={{ marginTop: item.spacingTop ?? 0 }}>
                <ListItem
                  icon={item.icon}
                  iconColor={item.iconColor}
                  title={item.title}
                  dense
                  onPress={() => router.push(item.route as never)}
                />
              </View>
            ))}
          </View>

          <View>
            <SectionAccordion
              title="Active Projects"
              collapsedIcon="archiveOutline"
              expandedIcon="archiveFilled"
              isExpanded={isActiveProjectsExpanded}
              onToggle={() =>
                setIsActiveProjectsExpanded((current) => {
                  const next = !current;
                  if (!next) {
                    setIsActiveProjectsListExpanded(false);
                  }
                  return next;
                })
              }
              borderColor={sectionDividerColor}
            >
              {isHomeLoading ? (
                renderSimpleSectionSkeletonRows(3)
              ) : activeProjects.length > 0 ? (
                visibleActiveProjects.map((activeProject) => (
                  <TouchableOpacity
                    key={activeProject.id}
                    activeOpacity={0.72}
                    onPress={() =>
                      router.push({
                        pathname: "/job/[id]",
                        params: { id: activeProject.id },
                      })
                    }
                    className="flex-row items-center px-1 py-2"
                  >
                    <View className="h-8 w-8 items-center justify-center">
                      <View
                        className="items-center justify-center"
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 1.25,
                          borderColor: projectStatusRingColor,
                        }}
                      >
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: projectStatusFillColor,
                          }}
                        />
                      </View>
                    </View>
                    <View className="ml-2 flex-1">
                      <Text variant="bodyMd" className="font-regular text-things-text">
                        {activeProject.title}
                      </Text>
                      {activeProject.clientName ? (
                        <Text
                          variant="footer"
                          className="font-regular text-things-muted"
                          numberOfLines={1}
                        >
                          {activeProject.clientName}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View className="mt-2 mx-1 min-h-[48px] items-center justify-center rounded-xl px-5 py-3">
                  <Text
                    variant="labelSm"
                    className="text-center italic"
                    style={emptySectionEmbossTextStyle}
                  >
                    No active projects.
                  </Text>
                </View>
              )}
              {hiddenActiveProjectsCount > 0 ? (
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPressIn={() => setIsActiveProjectsMorePressed(true)}
                  onPressOut={() => setIsActiveProjectsMorePressed(false)}
                  className="mt-2 self-start rounded-full py-1.5"
                  style={{
                    backgroundColor: isActiveProjectsMorePressed
                      ? paymentsMorePressedBg
                      : "transparent",
                    marginLeft: -6,
                    paddingHorizontal: 10,
                  }}
                  onPress={() =>
                    setIsActiveProjectsListExpanded((current) => !current)
                  }
                >
                  <Text
                    className="font-medium"
                    style={{
                      color: COLOR_TOKENS[colorMode]["text.secondary"],
                      fontSize: 11,
                      lineHeight: 14,
                    }}
                  >
                    {isActiveProjectsListExpanded
                      ? "Show less"
                      : `Show ${hiddenActiveProjectsCount} more`}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </SectionAccordion>
          </View>

          <View>
            <SectionAccordion
              title="Client Debts"
              collapsedIcon="boxOutline"
              expandedIcon="boxFilled"
              isExpanded={isDebtsExpanded}
              onToggle={() =>
                setIsDebtsExpanded((current) => {
                  const next = !current;
                  if (!next) {
                    setIsDebtsListExpanded(false);
                  }
                  return next;
                })
              }
              borderColor={sectionDividerColor}
            >
              {isHomeLoading ? (
                renderSimpleSectionSkeletonRows(3, { showTrailingAmount: true })
              ) : debts.length > 0 ? (
                visibleDebts.map((debt) => (
                  <TouchableOpacity
                    key={debt.jobId}
                    activeOpacity={0.72}
                    onPress={() =>
                      router.push({
                        pathname: "/job/[id]",
                        params: { id: debt.jobId },
                      })
                    }
                    className="flex-row items-center min-h-[46px] px-1 py-2"
                  >
                    <View className="h-8 w-8 items-center justify-center">
                      <View
                        className="items-center justify-center"
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 1.25,
                          borderColor: projectStatusRingColor,
                        }}
                      >
                        <Icon name="dollar" size={12} color={debtItemIconColor} />
                      </View>
                    </View>
                    <View className="ml-2 flex-1 pr-3">
                      <Text variant="bodyMd" className="font-regular text-things-text">
                        {debt.clientName}
                      </Text>
                      <Text
                        variant="footer"
                        className="font-regular text-things-muted"
                        numberOfLines={1}
                      >
                        {debt.jobTitle}
                      </Text>
                    </View>
                    <Text variant="labelSm" className="text-things-text">
                      {formatPriceLabel(debt.amount) ?? "0 RSD"}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View className="mt-2 mx-1 min-h-[48px] items-center justify-center rounded-xl px-5 py-3">
                  <Text
                    variant="labelSm"
                    className="text-center italic"
                    style={emptySectionEmbossTextStyle}
                  >
                    No client debts.
                  </Text>
                </View>
              )}
              {hiddenDebtsCount > 0 ? (
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPressIn={() => setIsDebtsMorePressed(true)}
                  onPressOut={() => setIsDebtsMorePressed(false)}
                  className="mt-2 self-start rounded-full py-1.5"
                  style={{
                    backgroundColor: isDebtsMorePressed
                      ? paymentsMorePressedBg
                      : "transparent",
                    marginLeft: -6,
                    paddingHorizontal: 10,
                  }}
                  onPress={() =>
                    setIsDebtsListExpanded((current) => !current)
                  }
                >
                  <Text
                    className="font-medium"
                    style={{
                      color: COLOR_TOKENS[colorMode]["text.secondary"],
                      fontSize: 11,
                      lineHeight: 14,
                    }}
                  >
                    {isDebtsListExpanded
                      ? "Show less"
                      : `Show ${hiddenDebtsCount} more`}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </SectionAccordion>
          </View>

          <View>
            <SectionAccordion
              title="Latest Payments"
              collapsedIcon="dollar"
              expandedIcon="dollar"
              isExpanded={isPaymentsExpanded}
              onToggle={() =>
                setIsPaymentsExpanded((current) => {
                  const next = !current;
                  if (!next) {
                    setIsPaymentsListExpanded(false);
                  }
                  return next;
                })
              }
              borderColor={sectionDividerColor}
            >
              {isHomeLoading ? (
                renderPaymentsSectionSkeletonRows(3)
              ) : payments.length > 0 ? (
                visiblePayments.map((payment) => {
                  const paymentDateLabel = formatPaymentDateLabel(payment.paymentDate);

                  return (
                    <TouchableOpacity
                      key={payment.id}
                      activeOpacity={0.72}
                      onPress={() =>
                        router.push({
                          pathname: "/job/[id]",
                          params: { id: payment.jobId },
                        })
                      }
                      className="flex-row items-center min-h-[46px] px-1 py-2"
                    >
                      <View className="w-6 items-center justify-center">
                        <View
                          className="items-center justify-center"
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            borderWidth: 1.25,
                            borderColor: projectStatusRingColor,
                          }}
                        >
                          <Icon name="dollar" size={12} color={debtItemIconColor} />
                        </View>
                      </View>

                      <View className="mr-1 w-[46px] items-center justify-center">
                        <Text
                          className="text-center font-medium"
                          style={{
                            color: debtItemIconColor,
                            fontSize: 11,
                            lineHeight: 13,
                          }}
                          numberOfLines={1}
                        >
                          {paymentDateLabel}
                        </Text>
                      </View>

                      <View className="min-w-0 flex-1 justify-center pr-2">
                        <Text
                          variant="bodyMd"
                          className="font-regular text-things-text"
                          numberOfLines={1}
                        >
                          {payment.clientName?.trim() || "Unknown client"}
                        </Text>
                        <Text
                          variant="footer"
                          className="mt-0.5 font-regular text-things-muted"
                          numberOfLines={1}
                        >
                          {payment.jobTitle}
                        </Text>
                      </View>

                      <View className="w-[88px] items-end justify-center pl-2">
                        <Text
                          variant="labelSm"
                          className="text-things-text"
                          numberOfLines={1}
                        >
                          {formatPriceLabel(payment.amount) ?? "0 RSD"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View className="mt-2 mx-1 min-h-[48px] items-center justify-center rounded-xl px-5 py-3">
                  <Text
                    variant="labelSm"
                    className="text-center italic"
                    style={emptySectionEmbossTextStyle}
                  >
                    No payments yet.
                  </Text>
                </View>
              )}
              {hiddenPaymentsCount > 0 ? (
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPressIn={() => setIsPaymentsMorePressed(true)}
                  onPressOut={() => setIsPaymentsMorePressed(false)}
                  className="mt-2 self-start rounded-full py-1.5"
                  style={{
                    backgroundColor: isPaymentsMorePressed
                      ? paymentsMorePressedBg
                      : "transparent",
                    marginLeft: -6,
                    paddingHorizontal: 10,
                  }}
                  onPress={() =>
                    setIsPaymentsListExpanded((current) => !current)
                  }
                >
                  <Text
                    className="font-medium"
                    style={{
                      color: COLOR_TOKENS[colorMode]["text.secondary"],
                      fontSize: 11,
                      lineHeight: 14,
                    }}
                  >
                    {isPaymentsListExpanded
                      ? "Show less"
                      : `Show ${hiddenPaymentsCount} more`}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </SectionAccordion>
          </View>

          <View className="mb-8">
            <SectionAccordion
              title="Reminders"
              collapsedIcon="upcoming"
              expandedIcon="upcoming"
              isExpanded={isRemindersExpanded}
              onToggle={() =>
                setIsRemindersExpanded((current) => {
                  const next = !current;
                  if (!next) {
                    setIsRemindersListExpanded(false);
                  }
                  return next;
                })
              }
              borderColor={sectionDividerColor}
            >
              {isRemindersLoading ? (
                renderSimpleSectionSkeletonRows(2)
              ) : remindersErrorMessage ? (
                <View className="mt-2 mx-1 min-h-[48px] items-center justify-center rounded-xl px-5 py-3">
                  <Text
                    variant="labelSm"
                    className="text-center"
                    style={{ color: COLOR_TOKENS[colorMode]["text.secondary"] }}
                  >
                    {remindersErrorMessage}
                  </Text>
                </View>
              ) : reminders.length > 0 ? (
                <View className="px-1">
                  {visibleReminders.map((reminder) => {
                    const { dateLabel, timeLabel } = formatReminderWhenParts(reminder.remindAt);
                    const projectLabel =
                      reminder.jobTitle?.trim() || reminder.clientName?.trim() || null;
                    const isDoneSubmitting = doneReminderId === reminder.id;
                    const reminderAccentColor = isReminderOverdue(reminder.remindAt)
                      ? reminderOverdueColor
                      : reminderUpcomingColor;

                    return (
                      <SwipeableActionRow
                        key={reminder.id}
                        disabled={Boolean(doneReminderId) || Boolean(snoozeReminderId)}
                        onSwipeLeft={() => handleSwipeOpenReminderSnooze(reminder.id)}
                        revealBackgroundColor={reminderSwipeRevealBg}
                        actionBackgroundColor={reminderSwipeActionBg}
                        actionIconColor={reminderSwipeActionIconColor}
                        actionIcon="bell"
                      >
                        <View className="flex-row items-center min-h-[46px] px-1 py-2">
                          <View className="w-6 items-center justify-center">
                            <TouchableOpacity
                              activeOpacity={0.82}
                              className="items-center justify-center"
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 4,
                                borderWidth: 1.25,
                                borderColor: reminderAccentColor,
                                backgroundColor: isDoneSubmitting
                                  ? withOpacity(reminderAccentColor, colorMode === "dark" ? 0.88 : 0.9)
                                  : "transparent",
                              }}
                              disabled={Boolean(doneReminderId)}
                              onPress={() => {
                                void handleDoneReminder(reminder.id).catch((error) => {
                                  setRemindersErrorMessage(
                                    error instanceof Error
                                      ? error.message
                                      : "Nisam uspeo da oznacim reminder kao done.",
                                  );
                                });
                              }}
                            >
                              {isDoneSubmitting ? (
                                <Icon name="check" size={11} color={COLOR_TOKENS.light["bg.base"]} />
                              ) : null}
                            </TouchableOpacity>
                          </View>

                          <View className="mr-1 w-[46px] items-center justify-center">
                            <Text
                              className="text-center font-medium"
                              style={{
                                color: reminderAccentColor,
                                fontSize: 11,
                                lineHeight: 13,
                              }}
                              numberOfLines={1}
                            >
                              {dateLabel}
                            </Text>
                          </View>

                          <TouchableOpacity
                            activeOpacity={0.76}
                            className="min-w-0 flex-1 justify-center pr-2"
                            onPress={() => handleOpenReminder(reminder)}
                          >
                            <View className="min-w-0 flex-row items-center">
                              <Text
                                variant="bodyMd"
                                className="min-w-0 flex-1 font-regular text-things-text"
                                numberOfLines={1}
                              >
                                {reminder.title}
                              </Text>
                              <View className="ml-2 flex-row items-center">
                                <Icon
                                  name="bell"
                                  size={12}
                                  color={COLOR_TOKENS[colorMode]["text.secondary"]}
                                />
                                <Text
                                  variant="footer"
                                  className="ml-1 font-regular text-things-muted"
                                  numberOfLines={1}
                                >
                                  {timeLabel}
                                </Text>
                              </View>
                            </View>
                            {projectLabel ? (
                              <Text
                                variant="footer"
                                className="mt-0.5 font-regular text-things-muted"
                                numberOfLines={1}
                              >
                                {projectLabel}
                              </Text>
                            ) : null}
                          </TouchableOpacity>
                        </View>
                      </SwipeableActionRow>
                    );
                  })}
                </View>
              ) : (
                <View className="mt-2 mx-1 min-h-[48px] items-center justify-center rounded-xl px-5 py-3">
                  <Text
                    variant="labelSm"
                    className="text-center italic"
                    style={emptySectionEmbossTextStyle}
                  >
                    No reminders yet.
                  </Text>
                </View>
              )}
              {hiddenRemindersCount > 0 ? (
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPressIn={() => setIsRemindersMorePressed(true)}
                  onPressOut={() => setIsRemindersMorePressed(false)}
                  className="mt-2 self-start rounded-full py-1.5"
                  style={{
                    backgroundColor: isRemindersMorePressed
                      ? paymentsMorePressedBg
                      : "transparent",
                    marginLeft: -6,
                    paddingHorizontal: 10,
                  }}
                  onPress={() =>
                    setIsRemindersListExpanded((current) => !current)
                  }
                >
                  <Text
                    className="font-medium"
                    style={{
                      color: COLOR_TOKENS[colorMode]["text.secondary"],
                      fontSize: 11,
                      lineHeight: 14,
                    }}
                  >
                    {isRemindersListExpanded
                      ? "Show less"
                      : `Show ${hiddenRemindersCount} more`}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </SectionAccordion>
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
          <QuickFindPullDown onPress={() => router.push("/quick-find" as never)} />
        </View>

        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: settingsBottom,
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

        <SnoozeReminderModal
          visible={Boolean(snoozeReminderTarget)}
          title={snoozeReminderTarget?.title ?? ""}
          colorMode={colorMode}
          theme={theme}
          actionBackgroundColor={reminderActionBg}
          onClose={() => setSnoozeReminderId(null)}
          onSelectPreset={handleSelectSnoozePreset}
        />

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
