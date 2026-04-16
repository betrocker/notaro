import { Icon } from "@/components/Icon";
import ProjectHeader from "@/components/ProjectHeader";
import ProjectMenu, { type ProjectMenuAction } from "@/components/ProjectMenu";
import WhenCalendarModal from "@/components/WhenCalendarModal";
import { AppText as Text, AppTextInput } from "@/components/ui";
import { COLOR_TOKENS } from "@/lib/design-system/tokens";
import {
  completeInboxTodo,
  deleteInboxTodo,
  fetchJobById,
  JobDetail,
  updateInboxTodo,
} from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TextInput as RNTextInput, TouchableOpacity, View } from "react-native";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
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

function getDaysUntilDate(targetDate: Date) {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfTarget = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  );
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (startOfTarget.getTime() - startOfToday.getTime()) / millisecondsPerDay,
  );
}

function formatSelectedDateLabel(date: Date) {
  const daysUntil = getDaysUntilDate(date);

  if (daysUntil === 0) {
    return "Today";
  }

  if (daysUntil === 1) {
    return "Tomorrow";
  }

  if (daysUntil > 1 && daysUntil <= 4) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }

  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const day = date.getDate();
  const month = date.toLocaleDateString("en-US", { month: "short" });
  return `${weekday}, ${day} ${month}`;
}

function formatDaysUntilLabel(targetDate: Date) {
  const daysUntil = getDaysUntilDate(targetDate);

  if (daysUntil <= 0) {
    return "today";
  }

  if (daysUntil === 1) {
    return "1 day left";
  }

  return `${daysUntil} days left`;
}

function parseDateOnly(dateIso: string | null | undefined) {
  if (!dateIso) {
    return null;
  }

  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function toDateOnlyIso(date: Date) {
  const year = `${date.getFullYear()}`;
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const NOTES_MIN_HEIGHT = 44;
const CHECKLIST_FOCUS_RETRY_MS = 24;

type ChecklistItem = {
  id: string;
  text: string;
};

function createChecklistItemId() {
  return `check-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const [job, setJob] = useState<JobDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [savedNotes, setSavedNotes] = useState("");
  const [isNotesFocused, setIsNotesFocused] = useState(false);
  const [notesInputHeight, setNotesInputHeight] = useState(NOTES_MIN_HEIGHT);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [savedChecklistItems, setSavedChecklistItems] = useState<string[]>([]);
  const [completedChecklistItemIds, setCompletedChecklistItemIds] = useState<
    string[]
  >([]);
  const [checklistDraft, setChecklistDraft] = useState("");
  const [isChecklistVisible, setIsChecklistVisible] = useState(false);
  const [isChecklistComposerOpen, setIsChecklistComposerOpen] = useState(false);
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<string | null>(
    null,
  );
  const [editingChecklistText, setEditingChecklistText] = useState("");
  const [, setEditingChecklistOriginalText] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isWhenModalOpen, setIsWhenModalOpen] = useState(false);
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
  const scrollY = useSharedValue(0);
  const emptyIconColor = withOpacity(COLOR_TOKENS[colorMode]["text.secondary"], 0.5);
  const primaryTextColor = COLOR_TOKENS[colorMode]["text.primary"];
  const secondaryTextColor = COLOR_TOKENS[colorMode]["text.secondary"];
  const subheaderColor = COLOR_TOKENS[colorMode]["primary.soft"];
  const selectionColor = COLOR_TOKENS[colorMode]["primary.default"];
  const titleMenuIconColor = COLOR_TOKENS[colorMode]["text.secondary"];
  const titleMenuActiveBg = COLOR_TOKENS[colorMode]["bg.input"];
  const metadataSeparatorColor = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    0.24,
  );
  const metadataGroupLayout = LinearTransition.duration(260);
  const metadataRowLayout = LinearTransition.duration(260);
  const checklistActiveBg = withOpacity(COLOR_TOKENS[colorMode]["bg.input"], 0.78);
  const checklistDotColor = subheaderColor;
  const checklistCheckColor = secondaryTextColor;
  const checklistCompletedTextColor = withOpacity(primaryTextColor, 0.58);
  const checklistDraftInputRef = useRef<RNTextInput>(null);
  const checklistItemInputRefs = useRef<Record<string, RNTextInput | null>>({});
  const checklistItemsRef = useRef<ChecklistItem[]>([]);
  const savedChecklistItemsRef = useRef<string[]>([]);
  const skipChecklistBlurForItemIdRef = useRef<string | null>(null);

  const loadJob = useCallback(async () => {
    if (!id) {
      setJob(null);
      setErrorMessage("Nedostaje ID posla.");
      return;
    }

    if (!isSupabaseConfigured) {
      setJob(null);
      setErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      return;
    }

    try {
      const data = await fetchJobById(id);
      setJob(data);
      setErrorMessage(null);
    } catch (error) {
      setJob(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da ucitam posao.",
      );
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadJob();
    }, [loadJob]),
  );

  useEffect(() => {
    const nextNotes = job?.description ?? "";
    setNotesDraft(nextNotes);
    setSavedNotes(nextNotes);
  }, [job?.description, job?.id]);

  useEffect(() => {
    checklistItemsRef.current = checklistItems;
  }, [checklistItems]);

  useEffect(() => {
    savedChecklistItemsRef.current = savedChecklistItems;
  }, [savedChecklistItems]);

  useEffect(() => {
    const jobChecklist = job?.checklist_items ?? [];
    const nextChecklistItems = jobChecklist.map((text) => ({
      id: createChecklistItemId(),
      text,
    }));
    setChecklistItems(nextChecklistItems);
    setSavedChecklistItems(jobChecklist);
    setCompletedChecklistItemIds([]);
    setChecklistDraft("");
    setIsChecklistVisible(jobChecklist.length > 0);
    setIsChecklistComposerOpen(false);
    setEditingChecklistItemId(null);
    setEditingChecklistText("");
    setEditingChecklistOriginalText("");
    skipChecklistBlurForItemIdRef.current = null;
  }, [job?.id, job?.checklist_items]);

  useEffect(() => {
    if (!isChecklistComposerOpen) {
      return;
    }

    setEditingChecklistItemId(null);
    setEditingChecklistText("");
    setEditingChecklistOriginalText("");
  }, [isChecklistComposerOpen]);

  useEffect(() => {
    setCompletedChecklistItemIds((current) => {
      if (current.length === 0) {
        return current;
      }

      const existingIds = new Set(checklistItems.map((item) => item.id));
      const next = current.filter((itemId) => existingIds.has(itemId));

      return next.length === current.length ? current : next;
    });
  }, [checklistItems]);

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

  const scheduledDateObj = parseDateOnly(job?.scheduled_date);
  const deadlineDateObj = parseDateOnly(job?.deadline_date);
  const scheduledDateLabel = scheduledDateObj
    ? formatSelectedDateLabel(scheduledDateObj)
    : null;
  const deadlineDateLabel = deadlineDateObj
    ? formatSelectedDateLabel(deadlineDateObj)
    : null;
  const deadlineDaysLeftLabel = deadlineDateObj
    ? formatDaysUntilLabel(deadlineDateObj)
    : null;
  const selectedWhenState: "none" | "date" | "today" | "someday" =
    scheduledDateObj ? "date" : job?.status === "someday" ? "someday" : "none";

  const openClientsModal = useCallback(() => {
    if (!job?.id) {
      router.push("/clients");
      return;
    }

    router.push({
      pathname: "/clients",
      params: {
        jobId: job.id,
        ...(job.client_id ? { selectedClientId: job.client_id } : {}),
      },
    });
  }, [job?.client_id, job?.id]);

  const openWhenModal = useCallback(() => {
    setIsWhenModalOpen(true);
  }, []);

  const closeWhenModal = useCallback(() => {
    setIsWhenModalOpen(false);
  }, []);

  const openDeadlineModal = useCallback(() => {
    setIsDeadlineModalOpen(true);
  }, []);

  const closeDeadlineModal = useCallback(() => {
    setIsDeadlineModalOpen(false);
  }, []);

  const persistJobMetadata = useCallback(
    async (input: {
      scheduledDateIso?: string | null;
      deadlineDateIso?: string | null;
      status?: "new" | "someday" | null;
    }) => {
      if (!job) {
        return;
      }

      const previousJob = job;
      const nextJob: JobDetail = {
        ...job,
        scheduled_date:
          input.scheduledDateIso !== undefined
            ? input.scheduledDateIso
            : job.scheduled_date,
        deadline_date:
          input.deadlineDateIso !== undefined
            ? input.deadlineDateIso
            : job.deadline_date,
        status:
          input.status !== undefined
            ? input.status === "new"
              ? null
              : input.status
            : job.status,
      };

      setJob(nextJob);
      setErrorMessage(null);

      try {
        await updateInboxTodo(job.id, {
          title: job.title?.trim() || "Bez naslova",
          scheduledDateIso: input.scheduledDateIso,
          deadlineDateIso: input.deadlineDateIso,
          status: input.status,
        });
      } catch (error) {
        setJob(previousJob);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Nisam uspeo da sacuvam izmene.",
        );
      }
    },
    [job],
  );

  const handleSelectWhenDate = useCallback(
    (date: Date) => {
      void persistJobMetadata({
        scheduledDateIso: toDateOnlyIso(date),
        status: null,
      });
    },
    [persistJobMetadata],
  );

  const handleSelectToday = useCallback(() => {
    void persistJobMetadata({
      scheduledDateIso: toDateOnlyIso(new Date()),
      status: null,
    });
  }, [persistJobMetadata]);

  const handleSelectSomeday = useCallback(() => {
    void persistJobMetadata({
      scheduledDateIso: null,
      status: "someday",
    });
  }, [persistJobMetadata]);

  const handleClearWhenSelection = useCallback(() => {
    void persistJobMetadata({
      scheduledDateIso: null,
      status: null,
    });
  }, [persistJobMetadata]);

  const handleSelectDeadlineDate = useCallback(
    (date: Date) => {
      void persistJobMetadata({
        deadlineDateIso: toDateOnlyIso(date),
      });
    },
    [persistJobMetadata],
  );

  const handleClearDeadlineSelection = useCallback(() => {
    void persistJobMetadata({
      deadlineDateIso: null,
    });
  }, [persistJobMetadata]);

  const persistNotes = useCallback(async () => {
    if (!job) {
      return;
    }

    const nextNotes = notesDraft.trim();
    const previousNotes = savedNotes.trim();

    if (nextNotes === previousNotes) {
      return;
    }

    const previousDescription = savedNotes;

    setSavedNotes(nextNotes);
    setErrorMessage(null);
    setJob((current) =>
      current
        ? {
            ...current,
            description: nextNotes || null,
          }
        : current,
    );

    try {
      await updateInboxTodo(job.id, {
        title: job.title?.trim() || "Bez naslova",
        description: nextNotes,
      });
    } catch (error) {
      setSavedNotes(previousDescription);
      setNotesDraft(previousDescription);
      setJob((current) =>
        current
          ? {
              ...current,
              description: previousDescription || null,
            }
          : current,
      );
      setErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da sacuvam notes.",
      );
    }
  }, [job, notesDraft, savedNotes]);

  const focusChecklistDraftWithRetry = useCallback((attempt = 0) => {
    const targetInput = checklistDraftInputRef.current;

    if (targetInput) {
      targetInput.focus();
      return;
    }

    if (attempt >= 20) {
      return;
    }

    setTimeout(() => {
      focusChecklistDraftWithRetry(attempt + 1);
    }, CHECKLIST_FOCUS_RETRY_MS);
  }, []);

  const focusChecklistItemWithRetry = useCallback((itemId: string, attempt = 0) => {
    const targetInput = checklistItemInputRefs.current[itemId] ?? null;

    if (targetInput) {
      targetInput.focus();
      return;
    }

    if (attempt >= 20) {
      return;
    }

    setTimeout(() => {
      focusChecklistItemWithRetry(itemId, attempt + 1);
    }, CHECKLIST_FOCUS_RETRY_MS);
  }, []);

  const persistChecklistItems = useCallback(
    async (nextItems: ChecklistItem[]) => {
      if (!job) {
        return;
      }

      const previousItems = checklistItemsRef.current;
      const previousSavedItems = savedChecklistItemsRef.current;
      const nextChecklistTexts = nextItems
        .map((item) => item.text.trim())
        .filter((text) => text.length > 0);

      if (areStringArraysEqual(nextChecklistTexts, previousSavedItems)) {
        setChecklistItems(nextItems);
        checklistItemsRef.current = nextItems;
        return;
      }

      setChecklistItems(nextItems);
      checklistItemsRef.current = nextItems;
      setSavedChecklistItems(nextChecklistTexts);
      savedChecklistItemsRef.current = nextChecklistTexts;
      setErrorMessage(null);

      try {
        await updateInboxTodo(job.id, {
          title: job.title?.trim() || "Bez naslova",
          checklistItems: nextChecklistTexts,
        });
      } catch (error) {
        setChecklistItems(previousItems);
        checklistItemsRef.current = previousItems;
        setSavedChecklistItems(previousSavedItems);
        savedChecklistItemsRef.current = previousSavedItems;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Nisam uspeo da sacuvam checklistu.",
        );
      }
    },
    [job],
  );

  const openChecklistComposer = useCallback(() => {
    setIsChecklistVisible(true);
    setIsChecklistComposerOpen(true);
    setEditingChecklistItemId(null);
    setEditingChecklistText("");
    setEditingChecklistOriginalText("");
    requestAnimationFrame(() => {
      focusChecklistDraftWithRetry();
    });
  }, [focusChecklistDraftWithRetry]);

  const handleSubmitChecklistDraft = useCallback(() => {
    const trimmedDraft = checklistDraft.trim();

    if (!trimmedDraft.length) {
      return;
    }

    const nextItems = [
      ...checklistItemsRef.current,
      { id: createChecklistItemId(), text: trimmedDraft },
    ];

    setChecklistDraft("");
    setIsChecklistVisible(true);
    setIsChecklistComposerOpen(true);
    setEditingChecklistItemId(null);
    setEditingChecklistText("");
    setEditingChecklistOriginalText("");
    void persistChecklistItems(nextItems);
    requestAnimationFrame(() => {
      focusChecklistDraftWithRetry();
    });
  }, [checklistDraft, focusChecklistDraftWithRetry, persistChecklistItems]);

  const closeChecklistComposer = useCallback(() => {
    const trimmedDraft = checklistDraft.trim();

    if (trimmedDraft.length > 0) {
      const nextItems = [
        ...checklistItemsRef.current,
        { id: createChecklistItemId(), text: trimmedDraft },
      ];
      setChecklistDraft("");
      setIsChecklistVisible(true);
      setIsChecklistComposerOpen(false);
      setEditingChecklistItemId(null);
      setEditingChecklistText("");
      setEditingChecklistOriginalText("");
      void persistChecklistItems(nextItems);
      return;
    }

    setIsChecklistComposerOpen(false);
    setEditingChecklistItemId(null);
    setEditingChecklistText("");
    setEditingChecklistOriginalText("");
    setIsChecklistVisible(checklistItemsRef.current.length > 0);
  }, [checklistDraft, persistChecklistItems]);

  const handleChecklistRowPress = useCallback(
    (item: ChecklistItem) => {
      setIsChecklistVisible(true);
      setIsChecklistComposerOpen(false);
      setEditingChecklistItemId(item.id);
      setEditingChecklistText(item.text);
      setEditingChecklistOriginalText(item.text);
      requestAnimationFrame(() => {
        focusChecklistItemWithRetry(item.id);
      });
    },
    [focusChecklistItemWithRetry],
  );

  const handleChecklistCompleteToggle = useCallback((itemId: string) => {
    setCompletedChecklistItemIds((current) => {
      if (current.includes(itemId)) {
        return current.filter((entry) => entry !== itemId);
      }

      return [...current, itemId];
    });
  }, []);

  const handleChecklistItemTextChange = useCallback((itemId: string, text: string) => {
    setEditingChecklistText(text);
    setChecklistItems((current) => {
      const next = current.map((entry) =>
        entry.id === itemId ? { ...entry, text } : entry,
      );
      checklistItemsRef.current = next;
      return next;
    });
  }, []);

  const removeChecklistItem = useCallback(
    (itemId: string) => {
      skipChecklistBlurForItemIdRef.current = itemId;
      const currentItems = checklistItemsRef.current;
      const removedIndex = currentItems.findIndex((entry) => entry.id === itemId);

      if (removedIndex === -1) {
        skipChecklistBlurForItemIdRef.current = null;
        return;
      }

      const nextItems = currentItems.filter((entry) => entry.id !== itemId);

      if (nextItems.length > 0) {
        const previousIndex = Math.max(0, removedIndex - 1);
        const previousItem = nextItems[previousIndex];
        if (previousItem) {
          setEditingChecklistItemId(previousItem.id);
          setEditingChecklistText(previousItem.text);
          setEditingChecklistOriginalText(previousItem.text);
          setIsChecklistVisible(true);
          setIsChecklistComposerOpen(false);
          requestAnimationFrame(() => {
            focusChecklistItemWithRetry(previousItem.id);
          });
        }
      } else {
        setEditingChecklistItemId(null);
        setEditingChecklistText("");
        setEditingChecklistOriginalText("");
        setIsChecklistVisible(isChecklistComposerOpen);
      }

      void persistChecklistItems(nextItems);
    },
    [focusChecklistItemWithRetry, isChecklistComposerOpen, persistChecklistItems],
  );

  const commitChecklistEditing = useCallback(
    (itemId: string) => {
      const currentText =
        checklistItemsRef.current.find((entry) => entry.id === itemId)?.text ?? "";
      const trimmedText = currentText.trim();

      if (!trimmedText.length) {
        removeChecklistItem(itemId);
        return;
      }

      const nextItems = checklistItemsRef.current.map((entry) =>
        entry.id === itemId ? { ...entry, text: trimmedText } : entry,
      );
      setEditingChecklistItemId(null);
      setEditingChecklistText("");
      setEditingChecklistOriginalText("");
      void persistChecklistItems(nextItems);
    },
    [persistChecklistItems, removeChecklistItem],
  );

  const finalizeChecklistEditingOnBlur = useCallback(
    (itemId: string) => {
      const currentText =
        checklistItemsRef.current.find((entry) => entry.id === itemId)?.text ?? "";
      const trimmedText = currentText.trim();

      if (!trimmedText.length) {
        removeChecklistItem(itemId);
        return;
      }

      const nextItems = checklistItemsRef.current.map((entry) =>
        entry.id === itemId ? { ...entry, text: trimmedText } : entry,
      );
      setEditingChecklistItemId(null);
      setEditingChecklistText("");
      setEditingChecklistOriginalText("");
      void persistChecklistItems(nextItems);
    },
    [persistChecklistItems, removeChecklistItem],
  );

  const closeJobMenu = useCallback(() => {
    setIsMenuOpen(false);
    setMenuAnchor(null);
  }, []);

  const handleCompleteFromMenu = useCallback(async () => {
    if (!job) {
      return;
    }

    try {
      await completeInboxTodo(job.id);
      closeJobMenu();
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da oznacim posao kao zavrsen.",
      );
    }
  }, [closeJobMenu, job]);

  const handleDeleteFromMenu = useCallback(async () => {
    if (!job) {
      return;
    }

    try {
      await deleteInboxTodo(job.id);
      closeJobMenu();
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da obrisem posao.",
      );
    }
  }, [closeJobMenu, job]);

  const jobMenuActions = useMemo<ProjectMenuAction[]>(
    () => [
      {
        key: "complete-project",
        label: "Complete Project",
        icon: "checkCircle",
        onPress: () => {
          void handleCompleteFromMenu();
        },
      },
      {
        key: "when",
        label: "When",
        icon: "upcoming",
        onPress: openWhenModal,
      },
      {
        key: "add-client",
        label: "Add Client",
        icon: "client",
        onPress: openClientsModal,
      },
      {
        key: "deadline",
        label: "Deadline",
        icon: "flag",
        onPress: openDeadlineModal,
      },
      {
        key: "delete",
        label: "Delete",
        icon: "trash",
        onPress: () => {
          void handleDeleteFromMenu();
        },
        destructive: true,
        showSeparatorAbove: true,
      },
    ],
    [
      handleCompleteFromMenu,
      handleDeleteFromMenu,
      openClientsModal,
      openDeadlineModal,
      openWhenModal,
    ],
  );

  return (
    <View className="flex-1 bg-things-bg">
      <Stack.Screen options={{ headerShown: false }} />

      <ProjectHeader
        title={job?.title?.trim() || "Job"}
        titleAnimatedStyle={headerTitleAnimatedStyle}
        onBack={() => router.back()}
      />

      <Animated.ScrollView
        className="flex-1 bg-things-bg px-5"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 94, paddingBottom: 132, flexGrow: 1 }}
      >
        <Animated.View
          className="mb-3 flex-row items-center"
          style={heroTitleAnimatedStyle}
        >
          <Icon name="todo" size={22} color="var(--color-inbox)" />
          <View className="ml-2.5 flex-1 flex-row items-center">
            <Text
              numberOfLines={1}
              className="font-bold text-things-text text-things-title-large"
              style={{ maxWidth: "88%" }}
            >
              {job?.title?.trim() || "Bez naslova"}
            </Text>
            <TouchableOpacity
              onPress={(event) => {
                setMenuAnchor({
                  x: event.nativeEvent.pageX,
                  y: event.nativeEvent.pageY,
                });
                setIsMenuOpen(true);
              }}
              disabled={!job}
              className="ml-1 h-9 w-9 items-center justify-center rounded-full"
              style={isMenuOpen ? { backgroundColor: titleMenuActiveBg } : undefined}
              activeOpacity={0.75}
            >
              <Icon name="ellipsisPlain" size={28} color={titleMenuIconColor} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {errorMessage ? (
          <Text className="mb-4 font-regular text-label-sm leading-5 text-things-muted">
            {errorMessage}
          </Text>
        ) : null}

        {job ? (
          <View className="mb-20">
            {job.client_name || scheduledDateLabel || deadlineDateLabel ? (
              <Animated.View className="mb-5" layout={metadataGroupLayout}>
                {job.client_name ? (
                  <Animated.View
                    key="meta-client"
                    layout={metadataRowLayout}
                    entering={FadeIn.duration(260)}
                    exiting={FadeOut.duration(260)}
                    className="overflow-hidden"
                  >
                    <TouchableOpacity
                      activeOpacity={0.72}
                      className="min-w-0 flex-row items-center py-2.5"
                      onPress={openClientsModal}
                      style={{
                        borderTopWidth: 0.5,
                        borderBottomWidth: 0.5,
                        borderColor: metadataSeparatorColor,
                      }}
                    >
                      <Icon
                        name="client"
                        size={16}
                        color={secondaryTextColor}
                        weight="light"
                      />
                      <Text
                        variant="label"
                        className="ml-2 font-semibold"
                        style={{ color: primaryTextColor, flexShrink: 1 }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {job.client_name}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                ) : null}

                {scheduledDateLabel ? (
                  <Animated.View
                    key="meta-when"
                    layout={metadataRowLayout}
                    entering={FadeIn.duration(260)}
                    exiting={FadeOut.duration(260)}
                    className="overflow-hidden"
                  >
                    <TouchableOpacity
                      activeOpacity={0.72}
                      className="min-w-0 flex-row items-center pr-[10px] py-2.5"
                      onPress={openWhenModal}
                      style={{
                        borderTopWidth: 0.5,
                        borderBottomWidth: 0.5,
                        borderColor: metadataSeparatorColor,
                      }}
                    >
                      <Icon
                        name="upcoming"
                        size={16}
                        color="var(--color-upcoming)"
                        weight="light"
                      />
                      <Text
                        variant="label"
                        className="ml-2 font-semibold"
                        style={{ color: primaryTextColor, flexShrink: 1 }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {scheduledDateLabel}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                ) : null}

                {deadlineDateLabel ? (
                  <Animated.View
                    key="meta-deadline"
                    layout={metadataRowLayout}
                    entering={FadeIn.duration(260)}
                    exiting={FadeOut.duration(260)}
                    className="overflow-hidden"
                  >
                    <TouchableOpacity
                      activeOpacity={0.72}
                      className="min-w-0 flex-row items-center pr-[10px] py-2.5"
                      onPress={openDeadlineModal}
                      style={{
                        borderTopWidth: 0.5,
                        borderBottomWidth: 0.5,
                        borderColor: metadataSeparatorColor,
                      }}
                    >
                      <Icon
                        name="flag"
                        size={16}
                        color={primaryTextColor}
                        weight="light"
                      />
                      <View className="ml-2 min-w-0 shrink flex-row items-center">
                        <Text
                          variant="label"
                          className="font-semibold"
                          style={{ color: primaryTextColor, flexShrink: 1 }}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {deadlineDateLabel}
                        </Text>
                        {deadlineDaysLeftLabel ? (
                          <Text
                            variant="labelSm"
                            className="ml-2 font-regular"
                            style={{ color: secondaryTextColor }}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {deadlineDaysLeftLabel}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                ) : null}
              </Animated.View>
            ) : null}

            <View className="relative min-h-[44px] py-1">
              {!notesDraft.trim() && !isNotesFocused ? (
                <Text
                  variant="labelSm"
                  pointerEvents="none"
                  className="absolute left-0 top-3 z-10"
                  style={{ color: secondaryTextColor }}
                >
                  Notes
                </Text>
              ) : null}
              <AppTextInput
                value={notesDraft}
                onChangeText={setNotesDraft}
                onFocus={() => setIsNotesFocused(true)}
                onBlur={() => {
                  setIsNotesFocused(false);
                  void persistNotes();
                }}
                onContentSizeChange={(event) => {
                  const nextHeight = Math.max(
                    NOTES_MIN_HEIGHT,
                    Math.ceil(event.nativeEvent.contentSize.height),
                  );
                  if (Math.abs(nextHeight - notesInputHeight) > 1) {
                    setNotesInputHeight(nextHeight);
                  }
                }}
                placeholder=""
                variant="bodyMd"
                style={{
                  minHeight: NOTES_MIN_HEIGHT,
                  height: notesInputHeight,
                  backgroundColor: "transparent",
                  paddingHorizontal: 0,
                  paddingTop: 8,
                  paddingBottom: 8,
                  color: primaryTextColor,
                }}
                selectionColor={selectionColor}
                multiline
                scrollEnabled={false}
                textAlignVertical="top"
              />
            </View>

            <View className="mt-3">
              <View className="flex-row items-center justify-between">
                <Text
                  className="font-bold"
                  style={{ color: subheaderColor, fontSize: 15 }}
                >
                  {"Things to do"}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.76}
                  className="h-7 w-7 items-center justify-center rounded-full"
                  onPress={openChecklistComposer}
                >
                  <Icon name="plusfab" size={18} color={subheaderColor} />
                </TouchableOpacity>
              </View>
              <View
                className="mt-2 h-px"
                style={{ backgroundColor: metadataSeparatorColor }}
              />
            </View>

            {isChecklistVisible || checklistItems.length > 0 ? (
              <View className="mt-2">
                {checklistItems.map((item) => {
                  const isChecklistItemCompleted = completedChecklistItemIds.includes(
                    item.id,
                  );
                  const separatorStyle = {
                    borderColor: metadataSeparatorColor,
                    borderBottomWidth: 0.5,
                    borderTopWidth: 0,
                  };

                  if (editingChecklistItemId === item.id && !isChecklistComposerOpen) {
                    return (
                      <View
                        key={item.id}
                        className="mx-1 flex-row items-center rounded-xl px-4 py-2"
                        style={{
                          ...separatorStyle,
                          backgroundColor: checklistActiveBg,
                        }}
                      >
                        <View className="h-5 w-5 items-center justify-center">
                          <View
                            className="h-[12px] w-[12px] rounded-full"
                            style={{
                              borderWidth: 1,
                              borderColor: checklistDotColor,
                              backgroundColor: "transparent",
                            }}
                          />
                        </View>
                        <View className="ml-2 flex-1 py-1">
                          <AppTextInput
                            ref={(input) => {
                              checklistItemInputRefs.current[item.id] = input;
                            }}
                            autoFocus
                            value={editingChecklistText}
                            onChangeText={(nextText) =>
                              handleChecklistItemTextChange(item.id, nextText)
                            }
                            onKeyPress={(event) => {
                              if (event.nativeEvent.key !== "Backspace") {
                                return;
                              }

                              const currentItemText =
                                checklistItemsRef.current.find(
                                  (entry) => entry.id === item.id,
                                )?.text ?? "";

                              if (currentItemText.length > 0) {
                                return;
                              }

                              removeChecklistItem(item.id);
                            }}
                            onBlur={() => {
                              if (skipChecklistBlurForItemIdRef.current === item.id) {
                                skipChecklistBlurForItemIdRef.current = null;
                                return;
                              }

                              if (editingChecklistItemId === item.id) {
                                finalizeChecklistEditingOnBlur(item.id);
                              }
                            }}
                            onSubmitEditing={() => {
                              if (!editingChecklistText.trim().length) {
                                commitChecklistEditing(item.id);
                                return;
                              }

                              commitChecklistEditing(item.id);
                              setIsChecklistComposerOpen(true);
                              requestAnimationFrame(() => {
                                focusChecklistDraftWithRetry();
                              });
                            }}
                            placeholder="Checklist"
                            placeholderTextColor={secondaryTextColor}
                            variant="labelSm"
                            className="flex-1"
                            style={{
                              color: primaryTextColor,
                              paddingVertical: 0,
                              paddingHorizontal: 0,
                              margin: 0,
                            }}
                            returnKeyType="done"
                            blurOnSubmit={false}
                          />
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View
                      key={item.id}
                      className="mx-1 flex-row items-center rounded-xl px-4 py-2"
                      style={separatorStyle}
                    >
                      <TouchableOpacity
                        activeOpacity={0.75}
                        className="h-5 w-5 items-center justify-center"
                        onPress={() => handleChecklistCompleteToggle(item.id)}
                      >
                        {isChecklistItemCompleted ? (
                          <Icon
                            name="check"
                            size={11}
                            color={checklistCheckColor}
                            weight="bold"
                          />
                        ) : (
                          <View
                            className="h-[12px] w-[12px] rounded-full"
                            style={{
                              borderWidth: 1,
                              borderColor: checklistDotColor,
                              backgroundColor: "transparent",
                            }}
                          />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        className="ml-2 flex-1 py-1"
                        onPress={() => handleChecklistRowPress(item)}
                      >
                        <Text
                          variant="labelSm"
                          className="flex-1"
                          style={{
                            color: isChecklistItemCompleted
                              ? checklistCompletedTextColor
                              : primaryTextColor,
                          }}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.text}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}

                {isChecklistComposerOpen ? (
                  <View
                    className="mx-1 flex-row items-center rounded-xl px-4 py-2"
                    style={{
                      borderColor: metadataSeparatorColor,
                      borderBottomWidth: 0.5,
                      borderTopWidth: 0,
                      backgroundColor: checklistActiveBg,
                    }}
                  >
                    <View className="h-5 w-5 items-center justify-center">
                      <View
                        className="h-[12px] w-[12px] rounded-full"
                        style={{
                          borderWidth: 1,
                          borderColor: checklistDotColor,
                          backgroundColor: "transparent",
                        }}
                      />
                    </View>
                    <View className="ml-2 flex-1 py-1">
                      <AppTextInput
                        ref={checklistDraftInputRef}
                        autoFocus={isChecklistComposerOpen}
                        value={checklistDraft}
                        onChangeText={setChecklistDraft}
                        onFocus={() => {
                          setEditingChecklistItemId(null);
                          setEditingChecklistText("");
                          setEditingChecklistOriginalText("");
                        }}
                        onKeyPress={(event) => {
                          if (event.nativeEvent.key !== "Backspace") {
                            return;
                          }
                          if (checklistDraft.length === 0) {
                            setIsChecklistComposerOpen(false);
                            setEditingChecklistItemId(null);
                            setEditingChecklistText("");
                            setEditingChecklistOriginalText("");
                            setIsChecklistVisible(checklistItemsRef.current.length > 0);
                          }
                        }}
                        onBlur={() => {
                          closeChecklistComposer();
                        }}
                        onSubmitEditing={handleSubmitChecklistDraft}
                        placeholder="Checklist"
                        placeholderTextColor={secondaryTextColor}
                        variant="labelSm"
                        className="flex-1"
                        style={{
                          color: primaryTextColor,
                          paddingVertical: 0,
                          paddingHorizontal: 0,
                          margin: 0,
                        }}
                        returnKeyType="done"
                        blurOnSubmit={false}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

          </View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Icon name="todo" size={96} color={emptyIconColor} />
          </View>
        )}
      </Animated.ScrollView>

      <WhenCalendarModal
        visible={isWhenModalOpen}
        onClose={closeWhenModal}
        onSelectDate={handleSelectWhenDate}
        onSelectToday={handleSelectToday}
        onSelectSomeday={handleSelectSomeday}
        onClearSelection={handleClearWhenSelection}
        selectedDate={scheduledDateObj}
        selectedWhen={selectedWhenState}
      />

      <WhenCalendarModal
        visible={isDeadlineModalOpen}
        mode="deadline"
        onClose={closeDeadlineModal}
        onSelectDate={handleSelectDeadlineDate}
        onClearSelection={handleClearDeadlineSelection}
        selectedDate={deadlineDateObj}
      />

      {isMenuOpen && job ? (
        <ProjectMenu
          anchor={menuAnchor}
          onClose={closeJobMenu}
          actions={jobMenuActions}
        />
      ) : null}
    </View>
  );
}
