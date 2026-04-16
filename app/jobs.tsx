import { Icon, LIST_ICON_COLORS } from "@/components/Icon";
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
  fetchJobsList,
  fetchLogbookTodos,
  JobsListItem,
  updateInboxTodo,
} from "@/lib/repository";
import { subscribeJobsInlineComposer } from "@/lib/jobsInlineComposer";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, router } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
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
    };

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
const JOB_FLIGHT_LAYOUT = LinearTransition.springify()
  .damping(36)
  .stiffness(160);
const JOB_STATIC_LAYOUT = LinearTransition.duration(1);
const SECTION_STATIC_LAYOUT = LinearTransition.duration(1);

function SwipeableWhenRow({
  onOpenWhen,
  isWhenActive = false,
  revealBackgroundColor,
  activeBackgroundColor,
  actionBackgroundColor,
  actionIconColor,
  children,
  disabled = false,
}: {
  onOpenWhen: () => void;
  isWhenActive?: boolean;
  revealBackgroundColor: string;
  activeBackgroundColor: string;
  actionBackgroundColor: string;
  actionIconColor: string;
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
        .activeOffsetX([8, 999])
        .failOffsetY([-10, 10])
        .onUpdate((event) => {
          const next = Math.max(0, Math.min(event.translationX, SWIPE_WHEN_REVEAL_WIDTH));
          translateX.value = next;
        })
        .onEnd(() => {
          const shouldOpenWhen = translateX.value >= SWIPE_WHEN_TRIGGER;
          translateX.value = withTiming(0, { duration: 180 });
          if (shouldOpenWhen) {
            runOnJS(onOpenWhen)();
          }
        })
        .onFinalize(() => {
          if (translateX.value > 0) {
            translateX.value = withTiming(0, { duration: 180 });
          }
        }),
    [disabled, onOpenWhen, translateX],
  );

  const foregroundStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const revealProgressStyle = useAnimatedStyle(() => {
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

  const movingSurfaceStyle = useAnimatedStyle(() => ({
    opacity: Math.max(
      interpolate(
        translateX.value,
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
              backgroundColor: actionBackgroundColor,
            },
            revealProgressStyle,
          ]}
        >
          <Icon name="upcoming" size={18} color={actionIconColor} />
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

export default function JobsScreen() {
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const [jobs, setJobs] = useState<JobsListItem[]>([]);
  const scrollViewRef = useRef<Animated.ScrollView | null>(null);
  const jobsRef = useRef<JobsListItem[]>([]);
  const [inlineComposerToken, setInlineComposerToken] = useState("initial");
  const [isInlineComposerVisible, setIsInlineComposerVisible] = useState(false);
  const [isInlineComposerExpanded, setIsInlineComposerExpanded] = useState(false);
  const [isDateRelayoutAnimating, setIsDateRelayoutAnimating] = useState(false);
  const [loggedJobs, setLoggedJobs] = useState<LoggedJob[]>([]);
  const [isLoggedOpen, setIsLoggedOpen] = useState(false);
  const [isLoggedTogglePressed, setIsLoggedTogglePressed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWhenModalOpen, setIsWhenModalOpen] = useState(false);
  const [selectedWhenJobId, setSelectedWhenJobId] = useState<string | null>(null);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const checkingIdsRef = useRef<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const checkedIdsRef = useRef<Set<string>>(new Set());
  const removalTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const dateRelayoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollY = useSharedValue(0);
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

  const clearPendingRemovals = useCallback(() => {
    Object.values(removalTimeoutsRef.current).forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    removalTimeoutsRef.current = {};
  }, []);

  const triggerDateRelayoutAnimation = useCallback(() => {
    if (dateRelayoutTimeoutRef.current) {
      clearTimeout(dateRelayoutTimeoutRef.current);
      dateRelayoutTimeoutRef.current = null;
    }
    setIsDateRelayoutAnimating(true);
    dateRelayoutTimeoutRef.current = setTimeout(() => {
      setIsDateRelayoutAnimating(false);
      dateRelayoutTimeoutRef.current = null;
    }, 520);
  }, []);

  useEffect(() => {
    return () => {
      clearPendingRemovals();
      if (dateRelayoutTimeoutRef.current) {
        clearTimeout(dateRelayoutTimeoutRef.current);
        dateRelayoutTimeoutRef.current = null;
      }
    };
  }, [clearPendingRemovals]);

  useEffect(() => {
    checkingIdsRef.current = checkingIds;
  }, [checkingIds]);

  useEffect(() => {
    checkedIdsRef.current = checkedIds;
  }, [checkedIds]);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const selectedWhenJob = useMemo(
    () =>
      selectedWhenJobId
        ? jobs.find((job) => job.id === selectedWhenJobId) ?? null
        : null,
    [jobs, selectedWhenJobId],
  );

  useEffect(() => {
    const unsubscribe = subscribeJobsInlineComposer(() => {
      setIsDateRelayoutAnimating(false);
      requestAnimationFrame(() => {
        setInlineComposerToken(`${Date.now()}`);
        setIsInlineComposerVisible(true);
        setIsInlineComposerExpanded(true);
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      });
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isInlineComposerVisible || isInlineComposerExpanded) {
      return;
    }

    const hideTimeout = setTimeout(() => {
      setIsInlineComposerVisible(false);
    }, 320);

    return () => {
      clearTimeout(hideTimeout);
    };
  }, [isInlineComposerExpanded, isInlineComposerVisible]);

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

  const closeWhenModal = useCallback(() => {
    setIsWhenModalOpen(false);
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

      triggerDateRelayoutAnimation();
      setJobs(nextJobs);
      jobsRef.current = nextJobs;
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
        setIsDateRelayoutAnimating(false);
        setErrorMessage(
          error instanceof Error ? error.message : "Nisam uspeo da sacuvam when.",
        );
      }
    },
    [triggerDateRelayoutAnimation],
  );

  const handleSelectWhenDate = useCallback(
    (date: Date) => {
      if (!selectedWhenJobId) {
        return;
      }
      void persistJobWhen(selectedWhenJobId, {
        scheduledDateIso: toDateOnlyIso(date),
        status: null,
      });
    },
    [persistJobWhen, selectedWhenJobId],
  );

  const handleSelectToday = useCallback(() => {
    if (!selectedWhenJobId) {
      return;
    }
    void persistJobWhen(selectedWhenJobId, {
      scheduledDateIso: toDateOnlyIso(new Date()),
      status: null,
    });
  }, [persistJobWhen, selectedWhenJobId]);

  const handleSelectSomeday = useCallback(() => {
    if (!selectedWhenJobId) {
      return;
    }
    void persistJobWhen(selectedWhenJobId, {
      scheduledDateIso: null,
      status: "someday",
    });
  }, [persistJobWhen, selectedWhenJobId]);

  const handleClearWhenSelection = useCallback(() => {
    if (!selectedWhenJobId) {
      return;
    }
    void persistJobWhen(selectedWhenJobId, {
      scheduledDateIso: null,
      status: null,
    });
  }, [persistJobWhen, selectedWhenJobId]);

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

      section.jobs.forEach((job) => {
        items.push({
          type: "job",
          key: `job-${job.id}`,
          job,
        });
      });
    });

    return items;
  }, [sections]);

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

      setIsInlineComposerExpanded(false);
      setIsInlineComposerVisible(false);
      setErrorMessage(null);
      await loadJobs();
    },
    [loadJobs],
  );

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
    const scheduledDate = parseDateOnlyIso(job.scheduled_date);
    const isTodayJob = !!scheduledDate && isSameDay(scheduledDate, todayDate);
    const scheduledDateLabel = formatCompactDate(job.scheduled_date);
    const deadlineDateLabel = formatCompactDate(job.deadline_date);

    return (
      <Animated.View
        key={renderKey ?? `job-${job.id}`}
        className="mb-2.5"
        layout={isDateRelayoutAnimating ? JOB_FLIGHT_LAYOUT : JOB_STATIC_LAYOUT}
      >
        <SwipeableWhenRow
          onOpenWhen={() => openWhenModalForJob(job.id)}
          isWhenActive={isWhenActive}
          revealBackgroundColor={swipeRevealBackgroundColor}
          activeBackgroundColor={swipeActiveBackgroundColor}
          actionBackgroundColor={swipeWhenBackgroundColor}
          actionIconColor={swipeWhenIconColor}
          disabled={isChecking || isChecked}
        >
          <Animated.View
            className="flex-row items-center px-2 py-2"
            exiting={FadeOut.duration(240)}
          >
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
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/job/[id]",
                  params: { id: job.id },
                })
              }
            >
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
          </Animated.View>
        </SwipeableWhenRow>
      </Animated.View>
    );
  };

  const renderLoggedTaskRow = (
    task: LoggedJob,
    dateLabel: string,
    dateLabelClassName = "mr-3 font-medium text-footer",
  ) => (
    <View
      key={task.id}
      className="flex-row items-center py-3"
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
    </View>
  );

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
                    setIsInlineComposerExpanded(false);
                  }
                }}
              >
                {sectionRenderItems.map((item) => {
                  if (item.type === "header") {
                    return (
                      <Animated.View
                        key={item.key}
                        layout={
                          isDateRelayoutAnimating
                            ? LinearTransition.duration(220)
                            : SECTION_STATIC_LAYOUT
                        }
                      >
                        {renderSectionHeader(item.title, item.spacingClassName)}
                      </Animated.View>
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
