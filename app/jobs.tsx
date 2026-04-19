import { Icon, IconName, LIST_ICON_COLORS } from "@/components/Icon";
import InlineTodoAccordion from "@/components/InlineTodoAccordion";
import ProjectHeader from "@/components/ProjectHeader";
import WhenCalendarModal from "@/components/WhenCalendarModal";
import { AppText as Text } from "@/components/ui";
import {
  BORDER_WIDTH_TOKENS,
  COLOR_TOKENS,
  RADIUS_TOKENS,
  SIZE_TOKENS,
} from "@/lib/design-system/tokens";
import {
  completeInboxTodo,
  createTodo,
  deleteInboxTodo,
  fetchJobsList,
  fetchLogbookTodos,
  JobsListItem,
  updateInboxTodo,
} from "@/lib/repository";
import { subscribeJobsInlineComposer } from "@/lib/jobsInlineComposer";
import { setJobsSelectionActive } from "@/lib/jobsSelectionMode";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, router } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeOut,
  Extrapolation,
  LinearTransition,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

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

function formatCompactDate(dateIso: string | null) {
  if (!dateIso) {
    return null;
  }

  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const day = date.getDate();
  const month = date.getMonth() + 1;
  return `${day}. ${month}.`;
}

function formatCompletedDate(dateString: string | null) {
  if (!dateString) {
    return "";
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const day = date.getDate();
  const month = date.getMonth() + 1;
  return `${day}. ${month}.`;
}

type JobSection = {
  key: string;
  title: string;
  jobs: JobsListItem[];
};

type SectionRenderItem =
  | {
      type: "header";
      key: string;
      title: string;
      spacingClassName: string;
    }
  | {
      type: "job";
      key: string;
      job: JobsListItem;
    }
  | {
      type: "showMore";
      key: string;
      sectionKey: string;
      hiddenCount: number;
      isExpanded: boolean;
    };

const SECTION_PREVIEW_LIMIT = 3;

type LoggedJob = {
  id: string;
  title: string;
  completedAt: string | null;
  completedDate: Date | null;
};

type InlineDraftTask = {
  id: string;
  title: string;
  description: string | null;
  scheduledDate: string | null;
  deadlineDateIso: string | null;
  checklistItems: string[];
  status: "new";
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function parseDateOnlyIso(dateIso: string | null) {
  if (!dateIso) {
    return null;
  }

  const parsed = new Date(`${dateIso}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateOnlyIso(date: Date) {
  const year = `${date.getFullYear()}`;
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isSameMonth(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

const SWIPE_WHEN_REVEAL_WIDTH = 36;
const SWIPE_WHEN_TRIGGER = 27;
const DATE_ROW_FLIGHT_MS = 520;
const DATE_LIFT_HOLD_MS = 420;
const DATE_LIFT_FADE_MS = 520;
const JOB_FLIGHT_LAYOUT = LinearTransition.springify()
  .damping(36)
  .stiffness(160);
const JOB_STATIC_LAYOUT = LinearTransition.duration(1);
const SECTION_STATIC_LAYOUT = LinearTransition.duration(1);

function SwipeableJobRow({
  onOpenWhen,
  onTriggerSelect,
  isWhenActive = false,
  revealBackgroundColor,
  activeBackgroundColor,
  whenBackgroundColor,
  whenIconColor,
  selectBackgroundColor,
  selectIconColor,
  children,
  disabled = false,
}: {
  onOpenWhen: () => void;
  onTriggerSelect?: () => void;
  isWhenActive?: boolean;
  revealBackgroundColor: string;
  activeBackgroundColor: string;
  whenBackgroundColor: string;
  whenIconColor: string;
  selectBackgroundColor: string;
  selectIconColor: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const translateX = useSharedValue(0);
  const activeProgress = useSharedValue(isWhenActive ? 1 : 0);

  useEffect(() => {
    activeProgress.value = withTiming(isWhenActive ? 1 : 0, { duration: 360 });
  }, [activeProgress, isWhenActive]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .activeOffsetX([-8, 8])
        .failOffsetY([-10, 10])
        .onUpdate((event) => {
          const next = Math.max(
            -SWIPE_WHEN_REVEAL_WIDTH,
            Math.min(event.translationX, SWIPE_WHEN_REVEAL_WIDTH),
          );
          translateX.value = next;
        })
        .onEnd(() => {
          const shouldOpenWhen = translateX.value >= SWIPE_WHEN_TRIGGER;
          const shouldTriggerSelect =
            !!onTriggerSelect && translateX.value <= -SWIPE_WHEN_TRIGGER;
          translateX.value = withTiming(0, { duration: 180 });
          if (shouldOpenWhen) {
            runOnJS(onOpenWhen)();
          } else if (shouldTriggerSelect && onTriggerSelect) {
            runOnJS(onTriggerSelect)();
          }
        })
        .onFinalize(() => {
          if (translateX.value !== 0) {
            translateX.value = withTiming(0, { duration: 180 });
          }
        }),
    [disabled, onOpenWhen, onTriggerSelect, translateX],
  );

  const foregroundStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const whenRevealStyle = useAnimatedStyle(() => {
    const revealProgress = interpolate(
      translateX.value,
      [0, 8, SWIPE_WHEN_REVEAL_WIDTH],
      [0, 1, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: revealProgress * (1 - activeProgress.value),
    };
  });

  const selectRevealStyle = useAnimatedStyle(() => {
    const revealProgress = interpolate(
      translateX.value,
      [-SWIPE_WHEN_REVEAL_WIDTH, -8, 0],
      [1, 1, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity: revealProgress,
    };
  });

  const movingSurfaceStyle = useAnimatedStyle(() => ({
    opacity: Math.max(
      interpolate(
        Math.abs(translateX.value),
        [0, 1, 2],
        [0, 0.98, 1],
        Extrapolation.CLAMP,
      ),
      activeProgress.value,
    ),
    borderRadius: 11,
    backgroundColor: interpolateColor(
      activeProgress.value,
      [0, 1],
      [revealBackgroundColor, activeBackgroundColor],
    ),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ position: "relative", overflow: "hidden", borderRadius: 11 }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              borderRadius: 11,
              alignItems: "center",
              flexDirection: "row",
              paddingLeft: 12,
              backgroundColor: whenBackgroundColor,
            },
            whenRevealStyle,
          ]}
        >
          <Icon name="upcoming" size={18} color={whenIconColor} />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              borderRadius: 11,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "flex-end",
              paddingRight: 12,
              backgroundColor: selectBackgroundColor,
            },
            selectRevealStyle,
          ]}
        >
          <Icon name="checklist" size={18} color={selectIconColor} />
        </Animated.View>
        <Animated.View style={foregroundStyle}>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
              },
              movingSurfaceStyle,
            ]}
          />
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

function SectionMoreToggle({
  isExpanded,
  hiddenCount,
  onPress,
  textColor,
  pressedBg,
}: {
  isExpanded: boolean;
  hiddenCount: number;
  onPress: () => void;
  textColor: string;
  pressedBg: string;
}) {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      activeOpacity={0.88}
      className="mt-2 self-start rounded-full py-1.5"
      style={{
        backgroundColor: isPressed ? pressedBg : "transparent",
        marginLeft: -6,
        paddingHorizontal: 10,
      }}
    >
      <Text
        className="font-medium"
        style={{ color: textColor, fontSize: 11, lineHeight: 14 }}
      >
        {isExpanded ? "Show less" : `Show ${hiddenCount} more`}
      </Text>
    </TouchableOpacity>
  );
}

type SelectionActionItem = {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
};

function SelectionActionBar({
  visible,
  bottom,
  bg,
  border,
  primaryColor,
  colorMode,
  actions,
}: {
  visible: boolean;
  bottom: number;
  bg: string;
  border: string;
  primaryColor: string;
  colorMode: "light" | "dark";
  actions: SelectionActionItem[];
}) {
  const progress = useSharedValue(visible ? 1 : 0);
  const slideDistance = bottom + 80;

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: visible ? 260 : 200 });
  }, [progress, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [slideDistance, 0],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(progress.value, [0, 1], [0.94, 1], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <View
      pointerEvents={visible ? "box-none" : "none"}
      className="absolute left-0 right-0 items-center"
      style={{ bottom, zIndex: 60 }}
    >
      <Animated.View
        style={[
          animatedStyle,
          {
            borderRadius: RADIUS_TOKENS.full,
            borderWidth: 0.5,
            borderColor: border,
            backgroundColor: bg,
            overflow: "hidden",
          },
        ]}
      >
        <BlurView
          intensity={colorMode === "dark" ? 54 : 70}
          tint={colorMode === "dark" ? "dark" : "light"}
          style={{ borderRadius: RADIUS_TOKENS.full }}
        >
          <View
            className="flex-row items-center"
            style={{ paddingHorizontal: 10, paddingVertical: 4, gap: 6 }}
          >
            {actions.map((action) => (
              <Pressable
                key={action.key}
                onPress={action.onPress}
                className="flex-row items-center"
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: RADIUS_TOKENS.full,
                }}
              >
                <Icon name={action.icon} size={22} color={primaryColor} />
                <Text
                  variant="label"
                  style={{ color: primaryColor, marginLeft: 6 }}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </BlurView>
      </Animated.View>
    </View>
  );
}

export default function JobsScreen() {
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState<JobsListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedIds.size > 0;
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );

  const toggleSectionExpanded = useCallback((key: string) => {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);
  const scrollViewRef = useRef<Animated.ScrollView | null>(null);
  const jobsRef = useRef<JobsListItem[]>([]);
  const [inlineComposerToken, setInlineComposerToken] = useState("initial");
  const [isInlineComposerVisible, setIsInlineComposerVisible] = useState(false);
  const [isInlineComposerExpanded, setIsInlineComposerExpanded] = useState(false);
  const [isInlineComposerDirty, setIsInlineComposerDirty] = useState(false);
  const [isDateRelayoutAnimating, setIsDateRelayoutAnimating] = useState(false);
  const [dateRelayoutJobIds, setDateRelayoutJobIds] = useState<Set<string>>(
    new Set(),
  );
  const [dateLiftJobIds, setDateLiftJobIds] = useState<Set<string>>(new Set());
  const [loggedJobs, setLoggedJobs] = useState<LoggedJob[]>([]);
  const [isLoggedOpen, setIsLoggedOpen] = useState(false);
  const [isLoggedTogglePressed, setIsLoggedTogglePressed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWhenModalOpen, setIsWhenModalOpen] = useState(false);
  const [selectedWhenJobId, setSelectedWhenJobId] = useState<string | null>(null);
  const [isBulkWhenMode, setIsBulkWhenMode] = useState(false);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const checkingIdsRef = useRef<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const checkedIdsRef = useRef<Set<string>>(new Set());
  const removalTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const dateRelayoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dateLiftFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dateLiftClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollY = useSharedValue(0);
  const dateLiftVisualProgress = useSharedValue(0);
  const emptyIconColor = withOpacity(COLOR_TOKENS[colorMode]["text.secondary"], 0.5);
  const checkboxBorderColor = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    colorMode === "dark" ? 0.68 : 0.42,
  );
  const checkboxCheckedBg = COLOR_TOKENS[colorMode]["primary.soft"];
  const checkboxCheckColor = COLOR_TOKENS.light["text.primary"];
  const scheduledBadgeBg = withOpacity(COLOR_TOKENS[colorMode]["bg.input"], 0.9);
  const scheduledBadgeBorder = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    0.24,
  );
  const sectionDividerColor = withOpacity(COLOR_TOKENS[colorMode]["text.secondary"], 0.26);
  const loggedToggleBgPressed = withOpacity(
    COLOR_TOKENS[colorMode]["bg.input"],
    colorMode === "dark" ? 0.88 : 0.86,
  );
  const completedAccentColor = COLOR_TOKENS[colorMode]["primary.soft"];
  const completedTitleColor = COLOR_TOKENS[colorMode]["text.secondary"];
  const checkedIconColor = COLOR_TOKENS.light["text.primary"];
  const swipeRevealBackgroundColor =
    colorMode === "dark" ? "#3A3D42" : "#E2E5EA";
  const swipeActiveBackgroundColor = withOpacity(
    COLOR_TOKENS[colorMode]["primary.default"],
    colorMode === "dark" ? 0.34 : 0.2,
  );
  const swipeWhenBackgroundColor = LIST_ICON_COLORS["--color-today"];
  const swipeWhenIconColor = "#FFFFFF";
  const swipeSelectBackgroundColor = COLOR_TOKENS[colorMode]["primary.default"];
  const swipeSelectIconColor = "#FFFFFF";
  const selectionCircleColor = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    colorMode === "dark" ? 0.7 : 0.55,
  );
  const selectionFillColor = COLOR_TOKENS[colorMode]["primary.default"];
  const actionBarBg =
    colorMode === "dark"
      ? withOpacity(COLOR_TOKENS.dark["btn.secondary"], 0.92)
      : withOpacity(COLOR_TOKENS.light["bg.modal"], 0.96);
  const actionBarBorder = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    colorMode === "dark" ? 0.56 : 0.4,
  );
  const actionBarPrimaryColor = COLOR_TOKENS[colorMode]["text.primary"];

  const clearDateRelayoutTimers = useCallback(() => {
    if (dateRelayoutTimeoutRef.current) {
      clearTimeout(dateRelayoutTimeoutRef.current);
      dateRelayoutTimeoutRef.current = null;
    }
    if (dateLiftFadeTimeoutRef.current) {
      clearTimeout(dateLiftFadeTimeoutRef.current);
      dateLiftFadeTimeoutRef.current = null;
    }
    if (dateLiftClearTimeoutRef.current) {
      clearTimeout(dateLiftClearTimeoutRef.current);
      dateLiftClearTimeoutRef.current = null;
    }
  }, []);

  const resetDateRelayoutState = useCallback(() => {
    setIsDateRelayoutAnimating(false);
    setDateRelayoutJobIds(new Set());
    setDateLiftJobIds(new Set());
    dateLiftVisualProgress.value = 0;
    clearDateRelayoutTimers();
  }, [clearDateRelayoutTimers, dateLiftVisualProgress]);

  const hideInlineComposer = useCallback(
    (options?: { collapse?: boolean }) => {
      const shouldCollapse = options?.collapse ?? true;
      if (shouldCollapse) {
        setIsInlineComposerExpanded(false);
      }
      setIsInlineComposerVisible(false);
      setIsInlineComposerDirty(false);
    },
    [],
  );

  const clearPendingRemovals = useCallback(() => {
    Object.values(removalTimeoutsRef.current).forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    removalTimeoutsRef.current = {};
  }, []);

  const triggerDateRelayoutAnimation = useCallback(
    (jobIds: string[], applyLayoutChange?: () => void) => {
      clearDateRelayoutTimers();
      setDateRelayoutJobIds(new Set(jobIds));
      setDateLiftJobIds(new Set(jobIds));
      dateLiftVisualProgress.value = 1;
      setIsDateRelayoutAnimating(jobIds.length > 0);
      requestAnimationFrame(() => {
        applyLayoutChange?.();
      });
      dateRelayoutTimeoutRef.current = setTimeout(() => {
        setIsDateRelayoutAnimating(false);
        setDateRelayoutJobIds(new Set());
        dateRelayoutTimeoutRef.current = null;
        dateLiftFadeTimeoutRef.current = setTimeout(() => {
          dateLiftVisualProgress.value = withTiming(0, {
            duration: DATE_LIFT_FADE_MS,
          });
          dateLiftFadeTimeoutRef.current = null;
          dateLiftClearTimeoutRef.current = setTimeout(() => {
            setDateLiftJobIds(new Set());
            dateLiftClearTimeoutRef.current = null;
          }, DATE_LIFT_FADE_MS);
        }, DATE_LIFT_HOLD_MS);
      }, DATE_ROW_FLIGHT_MS);
    },
    [clearDateRelayoutTimers, dateLiftVisualProgress],
  );

  useEffect(() => {
    return () => {
      clearPendingRemovals();
      clearDateRelayoutTimers();
    };
  }, [clearDateRelayoutTimers, clearPendingRemovals]);

  useEffect(() => {
    checkingIdsRef.current = checkingIds;
  }, [checkingIds]);

  useEffect(() => {
    checkedIdsRef.current = checkedIds;
  }, [checkedIds]);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    setJobsSelectionActive(isSelectionMode);
  }, [isSelectionMode]);

  useEffect(() => {
    return () => {
      setJobsSelectionActive(false);
    };
  }, []);

  const selectedWhenJob = useMemo(
    () =>
      selectedWhenJobId
        ? jobs.find((job) => job.id === selectedWhenJobId) ?? null
        : null,
    [jobs, selectedWhenJobId],
  );

  useEffect(() => {
    const unsubscribe = subscribeJobsInlineComposer(() => {
      resetDateRelayoutState();
      requestAnimationFrame(() => {
        setInlineComposerToken(`${Date.now()}`);
        setIsInlineComposerVisible(true);
        setIsInlineComposerExpanded(true);
        setIsInlineComposerDirty(false);
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      });
    });

    return unsubscribe;
  }, [resetDateRelayoutState]);

  useEffect(() => {
    if (!isInlineComposerVisible || isInlineComposerExpanded) {
      return;
    }

    const hideTimeout = setTimeout(() => {
      hideInlineComposer({ collapse: false });
    }, 320);

    return () => {
      clearTimeout(hideTimeout);
    };
  }, [hideInlineComposer, isInlineComposerExpanded, isInlineComposerVisible]);

  const loadJobs = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      setJobs([]);
      setLoggedJobs([]);
      setCheckingIds(new Set());
      setCheckedIds(new Set());
      clearPendingRemovals();
      return;
    }

    try {
      const [data, completedData] = await Promise.all([
        fetchJobsList(),
        fetchLogbookTodos(),
      ]);
      clearPendingRemovals();
      setJobs(data);
      setLoggedJobs(
        completedData.map((task) => ({
          id: task.id,
          title: task.title ?? "Bez naslova",
          completedAt: task.completed_at,
          completedDate: task.completed_at ? new Date(task.completed_at) : null,
        })),
      );
      setCheckingIds(new Set());
      setCheckedIds(new Set());
      setSelectedIds(new Set());
      setErrorMessage(null);
    } catch (error) {
      setJobs([]);
      setLoggedJobs([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nisam uspeo da ucitam jobs.",
      );
    }
  }, [clearPendingRemovals]);

  useFocusEffect(
    useCallback(() => {
      void loadJobs();
    }, [loadJobs]),
  );

  const handleCompleteJob = useCallback(async (jobId: string) => {
    if (checkingIdsRef.current.has(jobId) || checkedIdsRef.current.has(jobId)) {
      return;
    }

    setCheckingIds((current) => {
      const next = new Set(current);
      next.add(jobId);
      checkingIdsRef.current = next;
      return next;
    });

    setCheckedIds((current) => {
      const next = new Set(current);
      next.add(jobId);
      checkedIdsRef.current = next;
      return next;
    });

    try {
      await completeInboxTodo(jobId);
      setErrorMessage(null);
      setLoggedJobs((current) => {
        if (current.some((item) => item.id === jobId)) {
          return current;
        }

        const matchedJob = jobsRef.current.find((job) => job.id === jobId);
        const completedAt = new Date().toISOString();

        return [
          {
            id: jobId,
            title: matchedJob?.title?.trim() || "Bez naslova",
            completedAt,
            completedDate: new Date(completedAt),
          },
          ...current,
        ];
      });

      if (removalTimeoutsRef.current[jobId]) {
        clearTimeout(removalTimeoutsRef.current[jobId]);
      }

      removalTimeoutsRef.current[jobId] = setTimeout(() => {
        setJobs((current) => current.filter((job) => job.id !== jobId));
        setCheckedIds((current) => {
          const next = new Set(current);
          next.delete(jobId);
          return next;
        });
        delete removalTimeoutsRef.current[jobId];
      }, 2000);
    } catch (error) {
      setCheckedIds((current) => {
        const next = new Set(current);
        next.delete(jobId);
        checkedIdsRef.current = next;
        return next;
      });
      setErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da zavrsim posao.",
      );
    } finally {
      setCheckingIds((current) => {
        const next = new Set(current);
        next.delete(jobId);
        checkingIdsRef.current = next;
        return next;
      });
    }
  }, []);

  const openWhenModalForJob = useCallback((jobId: string) => {
    setSelectedWhenJobId(jobId);
    setIsWhenModalOpen(true);
  }, []);

  const toggleJobSelection = useCallback((jobId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const openWhenForSelection = useCallback(() => {
    if (selectedIds.size === 0) {
      return;
    }
    setIsBulkWhenMode(true);
    setSelectedWhenJobId(null);
    setIsWhenModalOpen(true);
  }, [selectedIds.size]);

  const handleDeleteSelected = useCallback(async () => {
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) {
      return;
    }

    const previousJobs = jobsRef.current;
    const previousLogged = loggedJobs;
    const remainingJobs = previousJobs.filter((job) => !selectedIds.has(job.id));
    const remainingLogged = previousLogged.filter(
      (task) => !selectedIds.has(task.id),
    );
    setJobs(remainingJobs);
    jobsRef.current = remainingJobs;
    setLoggedJobs(remainingLogged);
    setSelectedIds(new Set());
    setErrorMessage(null);

    try {
      await Promise.all(idsToDelete.map((id) => deleteInboxTodo(id)));
    } catch (error) {
      setJobs(previousJobs);
      jobsRef.current = previousJobs;
      setLoggedJobs(previousLogged);
      setErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da obrisem poslove.",
      );
    }
  }, [loggedJobs, selectedIds]);

  const closeWhenModal = useCallback(() => {
    setIsWhenModalOpen(false);
    setIsBulkWhenMode(false);
  }, []);

  const persistJobWhen = useCallback(
    async (
      jobId: string,
      input: {
        scheduledDateIso?: string | null;
        status?: "new" | "someday" | null;
      },
    ) => {
      const previousJobs = jobsRef.current;
      const targetJob = previousJobs.find((job) => job.id === jobId);
      if (!targetJob) {
        return;
      }

      const nextJobs = previousJobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              scheduled_date:
                input.scheduledDateIso !== undefined
                  ? input.scheduledDateIso
                  : job.scheduled_date,
              status:
                input.status !== undefined
                  ? input.status === "someday"
                    ? "someday"
                    : null
                  : job.status,
            }
          : job,
      );

      triggerDateRelayoutAnimation([jobId], () => {
        setJobs(nextJobs);
        jobsRef.current = nextJobs;
      });
      setErrorMessage(null);

      try {
        await updateInboxTodo(jobId, {
          title: targetJob.title?.trim() || "Bez naslova",
          scheduledDateIso: input.scheduledDateIso,
          status: input.status,
        });
      } catch (error) {
        setJobs(previousJobs);
        jobsRef.current = previousJobs;
        resetDateRelayoutState();
        setErrorMessage(
          error instanceof Error ? error.message : "Nisam uspeo da sacuvam when.",
        );
      }
    },
    [resetDateRelayoutState, triggerDateRelayoutAnimation],
  );

  const applyWhenInput = useCallback(
    (input: {
      scheduledDateIso?: string | null;
      status?: "new" | "someday" | null;
    }) => {
      if (isBulkWhenMode) {
        const ids = Array.from(selectedIds);
        ids.forEach((id) => {
          void persistJobWhen(id, input);
        });
        setSelectedIds(new Set());
        return;
      }
      if (!selectedWhenJobId) {
        return;
      }
      void persistJobWhen(selectedWhenJobId, input);
    },
    [isBulkWhenMode, persistJobWhen, selectedIds, selectedWhenJobId],
  );

  const handleSelectWhenDate = useCallback(
    (date: Date) => {
      applyWhenInput({
        scheduledDateIso: toDateOnlyIso(date),
        status: null,
      });
    },
    [applyWhenInput],
  );

  const handleSelectToday = useCallback(() => {
    applyWhenInput({
      scheduledDateIso: toDateOnlyIso(new Date()),
      status: null,
    });
  }, [applyWhenInput]);

  const handleSelectSomeday = useCallback(() => {
    applyWhenInput({
      scheduledDateIso: null,
      status: "someday",
    });
  }, [applyWhenInput]);

  const handleClearWhenSelection = useCallback(() => {
    applyWhenInput({
      scheduledDateIso: null,
      status: null,
    });
  }, [applyWhenInput]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerTitleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [44, 86],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [44, 86],
      [8, 0],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const heroTitleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 48],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [0, 48],
      [0, -14],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      scrollY.value,
      [0, 48],
      [1, 0.96],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  const liftedRowOverlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: dateLiftVisualProgress.value,
  }));

  const sections = useMemo<JobSection[]>(() => {
    const today = startOfDay(new Date());
    const nextWeekEnd = addDays(today, 7);
    const monthLabel = today.toLocaleDateString("en-US", { month: "long" });

    const todayJobs: JobsListItem[] = [];
    const nextWeekJobs: JobsListItem[] = [];
    const currentMonthJobs: JobsListItem[] = [];
    const otherDateJobs: JobsListItem[] = [];
    const noDateJobs: JobsListItem[] = [];

    for (const job of jobs) {
      const scheduledDate = parseDateOnlyIso(job.scheduled_date);

      if (!scheduledDate) {
        noDateJobs.push(job);
        continue;
      }

      if (isSameDay(scheduledDate, today)) {
        todayJobs.push(job);
        continue;
      }

      if (scheduledDate > today && scheduledDate <= nextWeekEnd) {
        nextWeekJobs.push(job);
        continue;
      }

      if (isSameMonth(scheduledDate, today)) {
        currentMonthJobs.push(job);
        continue;
      }

      otherDateJobs.push(job);
    }

    return [
      { key: "today", title: "Today", jobs: todayJobs },
      { key: "next-week", title: "Next week", jobs: nextWeekJobs },
      { key: "current-month", title: monthLabel, jobs: currentMonthJobs },
      { key: "other-dates", title: "Other dates", jobs: otherDateJobs },
      { key: "no-date", title: "No date", jobs: noDateJobs },
    ].filter((section) => section.jobs.length > 0);
  }, [jobs]);

  const sectionRenderItems = useMemo<SectionRenderItem[]>(() => {
    const items: SectionRenderItem[] = [];

    sections.forEach((section, index) => {
      items.push({
        type: "header",
        key: `header-${section.key}`,
        title: section.title,
        spacingClassName: index === 0 ? "mb-3 mt-2" : "mb-3 mt-4",
      });

      const isExpanded = expandedSections.has(section.key);
      const visibleJobs =
        isExpanded || section.jobs.length <= SECTION_PREVIEW_LIMIT
          ? section.jobs
          : section.jobs.slice(0, SECTION_PREVIEW_LIMIT);

      visibleJobs.forEach((job) => {
        items.push({
          type: "job",
          key: `job-${job.id}`,
          job,
        });
      });

      if (section.jobs.length > SECTION_PREVIEW_LIMIT) {
        items.push({
          type: "showMore",
          key: `show-more-${section.key}`,
          sectionKey: section.key,
          hiddenCount: section.jobs.length - SECTION_PREVIEW_LIMIT,
          isExpanded,
        });
      }
    });

    return items;
  }, [sections, expandedSections]);

  const todayDate = startOfDay(new Date());
  const selectedWhenDate = parseDateOnlyIso(selectedWhenJob?.scheduled_date ?? null);
  const selectedWhenState: "none" | "date" | "today" | "someday" = selectedWhenJob
    ? selectedWhenJob.status === "someday"
      ? "someday"
      : selectedWhenDate
        ? isSameDay(selectedWhenDate, todayDate)
          ? "today"
          : "date"
        : "none"
    : "none";
  const inlineComposerTask = useMemo<InlineDraftTask>(
    () => ({
      id: `jobs-inline-${inlineComposerToken}`,
      title: "",
      description: null,
      scheduledDate: null,
      deadlineDateIso: null,
      checklistItems: [],
      status: "new",
    }),
    [inlineComposerToken],
  );

  const handleInlineComposerSave = useCallback(
    async (
      _taskId: string,
      payload: {
        title: string;
        description: string;
        clientId?: string | null;
        scheduledDateIso?: string | null;
        deadlineDateIso?: string | null;
        checklistItems?: string[];
        status?: "new" | "someday" | null;
      },
    ) => {
      const scheduledDate = payload.scheduledDateIso
        ? parseDateOnlyIso(payload.scheduledDateIso)
        : null;
      const deadlineDate = payload.deadlineDateIso
        ? parseDateOnlyIso(payload.deadlineDateIso)
        : null;

      await createTodo({
        title: payload.title,
        notes: payload.description,
        projectId: payload.clientId ?? null,
        scheduledDate,
        deadlineDate,
        checklistItems: payload.checklistItems,
        status: payload.status === "someday" ? "someday" : "new",
      });

      hideInlineComposer();
      setErrorMessage(null);
      await loadJobs();
    },
    [hideInlineComposer, loadJobs],
  );

  const handleInlineComposerCollapseWithoutChanges = useCallback(() => {
    hideInlineComposer();
  }, [hideInlineComposer]);

  const renderSectionHeader = (title: string, spacingClassName = "mb-3 mt-2") => (
    <View className={spacingClassName}>
      <Text className="font-bold text-body-md text-things-text">{title}</Text>
      <View
        className="mt-2 h-px w-full"
        style={{ backgroundColor: sectionDividerColor }}
      />
    </View>
  );

  const renderJobRow = (job: JobsListItem, renderKey?: string) => {
    const isChecked = checkedIds.has(job.id);
    const isChecking = checkingIds.has(job.id);
    const isWhenActive = isWhenModalOpen && selectedWhenJobId === job.id;
    const isSelected = selectedIds.has(job.id);
    const isFlyingDateRow =
      isDateRelayoutAnimating && dateRelayoutJobIds.has(job.id);
    const isLiftedDateRow = dateLiftJobIds.has(job.id);
    const scheduledDate = parseDateOnlyIso(job.scheduled_date);
    const isTodayJob = !!scheduledDate && isSameDay(scheduledDate, todayDate);
    const scheduledDateLabel = formatCompactDate(job.scheduled_date);
    const deadlineDateLabel = formatCompactDate(job.deadline_date);

    const handleRowPress = () => {
      if (isSelectionMode) {
        toggleJobSelection(job.id);
        return;
      }
      router.push({
        pathname: "/job/[id]",
        params: { id: job.id },
      });
    };

    return (
      <Animated.View
        key={renderKey ?? `job-${job.id}`}
        className="mb-2.5"
        layout={isFlyingDateRow ? JOB_FLIGHT_LAYOUT : JOB_STATIC_LAYOUT}
      >
        <SwipeableJobRow
          onOpenWhen={() => openWhenModalForJob(job.id)}
          onTriggerSelect={() => toggleJobSelection(job.id)}
          isWhenActive={isWhenActive}
          revealBackgroundColor={swipeRevealBackgroundColor}
          activeBackgroundColor={swipeActiveBackgroundColor}
          whenBackgroundColor={swipeWhenBackgroundColor}
          whenIconColor={swipeWhenIconColor}
          selectBackgroundColor={swipeSelectBackgroundColor}
          selectIconColor={swipeSelectIconColor}
          disabled={isChecking || isChecked || isSelectionMode}
        >
          <Animated.View
            className="flex-row items-center px-2 py-2"
            exiting={FadeOut.duration(240)}
            style={{
              borderRadius: 11,
              backgroundColor: isSelected
                ? swipeActiveBackgroundColor
                : "transparent",
            }}
          >
          {isLiftedDateRow && !isSelected ? (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  borderRadius: 11,
                  backgroundColor: withOpacity(
                    COLOR_TOKENS[colorMode]["bg.input"],
                    colorMode === "dark" ? 0.96 : 0.98,
                  ),
                  borderWidth: 0.5,
                  borderColor: withOpacity(
                    COLOR_TOKENS[colorMode]["text.secondary"],
                    colorMode === "dark" ? 0.38 : 0.16,
                  ),
                  shadowColor: "#000000",
                  shadowOpacity: colorMode === "dark" ? 0.28 : 0.12,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 5 },
                  elevation: 7,
                },
                liftedRowOverlayAnimatedStyle,
              ]}
            />
          ) : null}
          <TouchableOpacity
            onPress={() => void handleCompleteJob(job.id)}
            disabled={isChecking || isChecked}
            activeOpacity={0.85}
            className="mr-2 items-center justify-center self-center"
            style={{
              width: 16,
              height: 16,
              borderRadius: 3.5,
              borderWidth: 1.25,
              borderColor: isChecked ? checkboxCheckedBg : checkboxBorderColor,
              backgroundColor: isChecked ? checkboxCheckedBg : "transparent",
              overflow: "hidden",
            }}
          >
            {isChecked ? (
              <Icon name="check" size={10} color={checkboxCheckColor} />
            ) : null}
          </TouchableOpacity>

          {scheduledDateLabel && !isTodayJob ? (
            <View
              className="mr-2 rounded-md px-1.5 py-0.5"
              style={{
                backgroundColor: scheduledBadgeBg,
                borderWidth: 0.5,
                borderColor: scheduledBadgeBorder,
              }}
            >
              <Text className="font-medium text-tiny text-things-muted">
                {scheduledDateLabel}
              </Text>
            </View>
          ) : (
            <View className="mr-1.5" />
          )}

          <View className="flex-1">
            <Pressable onPress={handleRowPress}>
              <View className="flex-row items-center">
                {isTodayJob ? (
                  <View className="mr-1.5 self-center" style={{ marginTop: 1 }}>
                    <Icon name="today" size={17} color="var(--color-today)" />
                  </View>
                ) : null}
                <Text
                  variant="bodyMd"
                  className="flex-1 font-medium text-things-text"
                  numberOfLines={1}
                >
                  {job.title?.trim() || "Bez naslova"}
                </Text>
              </View>
            </Pressable>
          </View>

          {deadlineDateLabel ? (
            <View className="ml-2 flex-row items-center">
              <Icon name="flag" size={11} color="var(--color-upcoming)" />
              <Text
                className="ml-1 font-medium text-tiny text-things-muted"
              >
                {deadlineDateLabel}
              </Text>
            </View>
          ) : null}

          {isSelectionMode ? (
            <TouchableOpacity
              onPress={() => toggleJobSelection(job.id)}
              activeOpacity={0.7}
              hitSlop={8}
              className="ml-3 items-center justify-center self-center"
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 1.5,
                borderColor: isSelected ? selectionFillColor : selectionCircleColor,
                backgroundColor: "transparent",
              }}
            >
              {isSelected ? (
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: selectionFillColor,
                  }}
                />
              ) : null}
            </TouchableOpacity>
          ) : null}
          </Animated.View>
        </SwipeableJobRow>
      </Animated.View>
    );
  };

  const renderLoggedTaskRow = (
    task: LoggedJob,
    dateLabel: string,
    dateLabelClassName = "mr-3 font-medium text-footer",
  ) => {
    const isSelected = selectedIds.has(task.id);
    return (
      <Pressable
        key={task.id}
        onPress={() => {
          if (isSelectionMode) {
            toggleJobSelection(task.id);
          }
        }}
        className="flex-row items-center px-2 py-3"
        style={
          isSelected
            ? { backgroundColor: swipeActiveBackgroundColor, borderRadius: 11 }
            : undefined
        }
      >
        <View
          className="mr-3 items-center justify-center"
          style={{
            width: SIZE_TOKENS.quickTaskCheckbox,
            height: SIZE_TOKENS.quickTaskCheckbox,
            borderRadius: RADIUS_TOKENS.xs,
            borderWidth: BORDER_WIDTH_TOKENS.subtle,
            borderColor: completedAccentColor,
            backgroundColor: completedAccentColor,
          }}
        >
          <Icon name="check" size={10} color={checkedIconColor} />
        </View>
        <Text
          className={dateLabelClassName}
          style={{ color: completedAccentColor }}
        >
          {dateLabel}
        </Text>
        <Text
          className="flex-1 font-regular text-label-sm"
          style={{ color: completedTitleColor }}
        >
          {task.title}
        </Text>
        {isSelectionMode ? (
          <TouchableOpacity
            onPress={() => toggleJobSelection(task.id)}
            activeOpacity={0.7}
            hitSlop={8}
            className="ml-3 items-center justify-center self-center"
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              borderWidth: 1.5,
              borderColor: isSelected ? selectionFillColor : selectionCircleColor,
              backgroundColor: "transparent",
            }}
          >
            {isSelected ? (
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: selectionFillColor,
                }}
              />
            ) : null}
          </TouchableOpacity>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-things-bg">
      <Stack.Screen options={{ headerShown: false }} />

      <ProjectHeader
        title="Jobs"
        titleAnimatedStyle={headerTitleAnimatedStyle}
        onBack={() => router.replace("/")}
      />

      <Animated.ScrollView
        ref={scrollViewRef}
        className="flex-1 bg-things-bg px-5"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 94, paddingBottom: 132, flexGrow: 1 }}
      >
        <Animated.View
          className="mb-6 flex-row items-center"
          style={heroTitleAnimatedStyle}
        >
          <Icon name="briefcase" size={22} color="var(--color-inbox)" />
          <Text className="ml-2.5 font-bold text-things-text text-things-title-large">
            Jobs
          </Text>
        </Animated.View>

        <View className="flex-1">
          {errorMessage ? (
            <Text className="mb-4 font-regular text-label-sm leading-5 text-things-muted">
              {errorMessage}
            </Text>
          ) : null}

          {jobs.length > 0 || loggedJobs.length > 0 || isInlineComposerVisible ? (
            <View className="mb-20">
              {isInlineComposerVisible ? (
                <View className="mb-3">
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <InlineTodoAccordion
                      key={inlineComposerTask.id}
                      task={inlineComposerTask}
                      checkboxSize={SIZE_TOKENS.quickTaskCheckbox}
                      checkboxBorderColor={checkboxBorderColor}
                      checkedColor={checkboxCheckedBg}
                      checkedIconColor={checkboxCheckColor}
                      isChecked={false}
                      isFading={false}
                      isBusy={false}
                      isExpanded={isInlineComposerExpanded}
                      allowClientAssignment={false}
                      syncFromTaskWhenCollapsed={false}
                      onCollapseWithoutChanges={handleInlineComposerCollapseWithoutChanges}
                      onDraftStateChange={(_, isDirty) =>
                        setIsInlineComposerDirty(isDirty)
                      }
                      onCheckPress={() => {}}
                      onToggleExpanded={() =>
                        setIsInlineComposerExpanded((current) => !current)
                      }
                      onFadeComplete={() => {}}
                      onSave={handleInlineComposerSave}
                    />
                  </Pressable>
                </View>
              ) : null}

              <Pressable
                onPress={() => {
                  if (isInlineComposerVisible && isInlineComposerExpanded) {
                    if (isInlineComposerDirty) {
                      setIsInlineComposerExpanded(false);
                    } else {
                      hideInlineComposer();
                    }
                  }
                }}
              >
                {sectionRenderItems.map((item) => {
                  if (item.type === "header") {
                    return (
                      <Animated.View
                        key={item.key}
                        layout={SECTION_STATIC_LAYOUT}
                      >
                        {renderSectionHeader(item.title, item.spacingClassName)}
                      </Animated.View>
                    );
                  }

                  if (item.type === "showMore") {
                    return (
                      <SectionMoreToggle
                        key={item.key}
                        isExpanded={item.isExpanded}
                        hiddenCount={item.hiddenCount}
                        onPress={() => toggleSectionExpanded(item.sectionKey)}
                        textColor={COLOR_TOKENS[colorMode]["text.secondary"]}
                        pressedBg={loggedToggleBgPressed}
                      />
                    );
                  }

                  return renderJobRow(item.job, item.key);
                })}

                {jobs.length > 0 || loggedJobs.length > 0 ? (
                  <>
                    <TouchableOpacity
                      onPress={() => setIsLoggedOpen((current) => !current)}
                      onPressIn={() => setIsLoggedTogglePressed(true)}
                      onPressOut={() => setIsLoggedTogglePressed(false)}
                      activeOpacity={0.88}
                      className="mt-5 self-start rounded-full py-1.5"
                      style={{
                        backgroundColor: isLoggedTogglePressed ? loggedToggleBgPressed : "transparent",
                        marginLeft: -6,
                        paddingHorizontal: 10,
                      }}
                    >
                      <Text
                        className="font-medium"
                        style={{
                          color: COLOR_TOKENS[colorMode]["text.secondary"],
                          fontSize: 11,
                          lineHeight: 14,
                        }}
                      >
                        {isLoggedOpen
                          ? "Hide logged items"
                          : `Show ${loggedJobs.length} logged items`}
                      </Text>
                    </TouchableOpacity>

                    {isLoggedOpen ? (
                      <Animated.View entering={FadeIn.duration(220)} className="mt-4">
                        {loggedJobs.map((task) =>
                          renderLoggedTaskRow(
                            task,
                            task.completedDate && isSameDay(task.completedDate, todayDate)
                              ? "today"
                              : formatCompletedDate(task.completedAt),
                            task.completedDate && isSameDay(task.completedDate, todayDate)
                              ? "mr-3 font-medium text-tiny"
                              : "mr-3 font-medium text-footer",
                          ),
                        )}
                      </Animated.View>
                    ) : null}
                  </>
                ) : null}
              </Pressable>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Icon name="briefcase" size={96} color={emptyIconColor} />
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <SelectionActionBar
        visible={isSelectionMode}
        bottom={Math.max(insets.bottom + 8, 18)}
        bg={actionBarBg}
        border={actionBarBorder}
        primaryColor={actionBarPrimaryColor}
        colorMode={colorMode}
        actions={[
          { key: "cancel", label: "Cancel", icon: "close", onPress: clearSelection },
          { key: "when", label: "When", icon: "upcoming", onPress: openWhenForSelection },
          { key: "delete", label: "Delete", icon: "trash", onPress: () => void handleDeleteSelected() },
        ]}
      />

      <WhenCalendarModal
        visible={isWhenModalOpen}
        onClose={closeWhenModal}
        onSelectDate={handleSelectWhenDate}
        onSelectToday={handleSelectToday}
        onSelectSomeday={handleSelectSomeday}
        onClearSelection={handleClearWhenSelection}
        selectedDate={selectedWhenDate}
        selectedWhen={selectedWhenState}
      />
    </View>
  );
}
