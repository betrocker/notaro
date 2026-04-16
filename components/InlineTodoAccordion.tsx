import { Icon } from "@/components/Icon";
import WhenCalendarModal from "@/components/WhenCalendarModal";
import { AppText as Text, AppTextInput } from "@/components/ui";
import {
  BORDER_WIDTH_TOKENS,
  COLOR_TOKENS,
  RADIUS_TOKENS,
} from "@/lib/design-system/tokens";
import { subscribeClientPickerSelection } from "@/lib/clientPicker";
import { router } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, TextInput as RNTextInput, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  FadeOut,
  LinearTransition,
  SlideInLeft,
  SlideInRight,
  SlideOutRight,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

type ChecklistItem = {
  id: string;
  text: string;
};

type WhenSelection =
  | { type: "none" }
  | { type: "date"; date: Date }
  | { type: "today" }
  | { type: "someday" };

type TodoItem = {
  id: string;
  title: string;
  description: string | null;
  clientId?: string | null;
  clientName?: string | null;
  scheduledDate?: string | null;
  deadlineDateIso?: string | null;
  checklistItems?: string[];
  status?: string | null;
};

type SavePayload = {
  title: string;
  description: string;
  clientId?: string | null;
  scheduledDateIso?: string | null;
  deadlineDateIso?: string | null;
  checklistItems?: string[];
  status?: "new" | "someday" | null;
};

const CHECKED_HOLD_DURATION_MS = 2300;
const CHECKED_FADE_OUT_DURATION_MS = 320;
const NOTES_MIN_HEIGHT = 36;
const CHECKLIST_FOCUS_RETRY_MS = 24;

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

function createChecklistItemId() {
  return `check-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function toDateOnlyIso(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateOnlyIso(dateIso: string | null | undefined) {
  if (!dateIso) {
    return null;
  }

  const parsed = new Date(`${dateIso}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeChecklistTexts(texts: Array<string | null | undefined> | null | undefined) {
  if (!texts?.length) {
    return [] as string[];
  }

  return texts
    .map((text) => text?.trim() ?? "")
    .filter((text) => text.length > 0);
}

function checklistTextsToItems(texts: string[]) {
  return texts.map((text) => ({
    id: createChecklistItemId(),
    text,
  }));
}

function isSameDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getDaysUntilDate(targetDate: Date) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

function formatCompactDateLabel(date: Date) {
  return `${date.getDate()}.${date.getMonth() + 1}.`;
}

function parseWhenSelection(task: TodoItem): WhenSelection {
  if (task.status === "someday") {
    return { type: "someday" };
  }

  if (task.scheduledDate) {
    const parsed = new Date(`${task.scheduledDate}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      if (isSameDate(parsed, new Date())) {
        return { type: "today" };
      }

      return { type: "date", date: parsed };
    }
  }

  return { type: "none" };
}

function whenSelectionKey(selection: WhenSelection) {
  if (selection.type === "date") {
    return `date:${toDateOnlyIso(selection.date)}`;
  }

  return selection.type;
}

function whenSelectionToPersistence(selection: WhenSelection) {
  if (selection.type === "date") {
    return {
      scheduledDateIso: toDateOnlyIso(selection.date),
      status: "new" as const,
    };
  }

  if (selection.type === "today") {
    return {
      scheduledDateIso: toDateOnlyIso(new Date()),
      status: "new" as const,
    };
  }

  if (selection.type === "someday") {
    return {
      scheduledDateIso: null,
      status: "someday" as const,
    };
  }

  return {
    scheduledDateIso: null,
    status: "new" as const,
  };
}

export default function InlineTodoAccordion({
  task,
  titlePrefix,
  checkboxSize,
  checkboxBorderColor,
  checkedColor,
  checkedIconColor,
  isChecked,
  isFading,
  isBusy,
  isExpanded,
  allowClientAssignment = true,
  syncFromTaskWhenCollapsed = true,
  onCheckPress,
  onToggleExpanded,
  onFadeComplete,
  onSave,
}: {
  task: TodoItem;
  titlePrefix?: string;
  checkboxSize: number;
  checkboxBorderColor: string;
  checkedColor: string;
  checkedIconColor: string;
  isChecked: boolean;
  isFading: boolean;
  isBusy: boolean;
  isExpanded: boolean;
  allowClientAssignment?: boolean;
  syncFromTaskWhenCollapsed?: boolean;
  onCheckPress: (taskId: string) => void;
  onToggleExpanded: (taskId: string) => void;
  onFadeComplete: (taskId: string) => void;
  onSave: (taskId: string, payload: SavePayload) => Promise<void>;
}) {
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const primaryTextColor = COLOR_TOKENS[colorMode]["text.primary"];
  const secondaryTextColor = COLOR_TOKENS[colorMode]["text.secondary"];
  const inputBorderColor = COLOR_TOKENS[colorMode]["btn.secondary"];
  const dateBadgeBackgroundColor = withOpacity(
    COLOR_TOKENS[colorMode]["btn.secondary"],
    colorMode === "dark" ? 0.7 : 0.9,
  );
  const accordionBg = withOpacity(COLOR_TOKENS[colorMode]["bg.input"], 0.72);
  const selectionColor = COLOR_TOKENS.light["primary.default"];
  const checklistActiveBg = COLOR_TOKENS[colorMode]["btn.secondary"];
  const checklistDotColor = COLOR_TOKENS[colorMode]["primary.default"];
  const checklistCheckColor = secondaryTextColor;
  const checklistCompletedTextColor = withOpacity(primaryTextColor, 0.58);

  const rowOpacity = useSharedValue(1);
  const surfaceProgress = useSharedValue(isExpanded ? 1 : 0);
  const bodyProgress = useSharedValue(isExpanded ? 1 : 0);
  const hasFadeStartedRef = useRef(false);
  const wasExpandedRef = useRef(isExpanded);

  const [title, setTitle] = useState(task.title ?? "");
  const [savedTitle, setSavedTitle] = useState(task.title ?? "");
  const [notes, setNotes] = useState(task.description ?? "");
  const [savedNotes, setSavedNotes] = useState(task.description ?? "");
  const [whenSelection, setWhenSelection] = useState<WhenSelection>(() =>
    parseWhenSelection(task),
  );
  const [savedWhenKey, setSavedWhenKey] = useState(() =>
    whenSelectionKey(parseWhenSelection(task)),
  );
  const [deadlineDate, setDeadlineDate] = useState<Date | null>(() =>
    fromDateOnlyIso(task.deadlineDateIso),
  );
  const [savedDeadlineDateIso, setSavedDeadlineDateIso] = useState<string | null>(
    task.deadlineDateIso ?? null,
  );
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientLabel, setSelectedClientLabel] = useState<string | null>(null);
  const [savedClientId, setSavedClientId] = useState<string | null>(
    task.clientId ?? null,
  );
  const [isWhenModalOpen, setIsWhenModalOpen] = useState(false);
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
  const [isNotesFocused, setIsNotesFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notesInputHeight, setNotesInputHeight] = useState(NOTES_MIN_HEIGHT);
  const [headerRowWidth, setHeaderRowWidth] = useState(0);
  const [titleFrame, setTitleFrame] = useState({ x: 0, width: 0 });
  const [expandedBodyHeight, setExpandedBodyHeight] = useState(0);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(() =>
    checklistTextsToItems(normalizeChecklistTexts(task.checklistItems)),
  );
  const [savedChecklistSignature, setSavedChecklistSignature] = useState(() =>
    JSON.stringify(normalizeChecklistTexts(task.checklistItems)),
  );
  const [completedChecklistItemIds, setCompletedChecklistItemIds] = useState<string[]>(
    [],
  );
  const [checklistDraft, setChecklistDraft] = useState("");
  const [isChecklistVisible, setIsChecklistVisible] = useState(false);
  const [isChecklistComposerOpen, setIsChecklistComposerOpen] = useState(false);
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<
    string | null
  >(null);
  const [editingChecklistText, setEditingChecklistText] = useState("");
  const titleInputRef = useRef<RNTextInput>(null);
  const notesInputRef = useRef<RNTextInput>(null);
  const checklistDraftInputRef = useRef<RNTextInput>(null);
  const activeClientPickerTokenRef = useRef<string | null>(null);
  const checklistItemsRef = useRef<ChecklistItem[]>([]);
  const checklistItemInputRefs = useRef<Record<string, RNTextInput | null>>({});
  const skipChecklistBlurForItemIdRef = useRef<string | null>(null);
  const checklistItemFocusTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>(
    [],
  );

  useEffect(() => {
    if (!isFading || hasFadeStartedRef.current) {
      return;
    }

    hasFadeStartedRef.current = true;
    rowOpacity.value = withDelay(
      CHECKED_HOLD_DURATION_MS,
      withTiming(0, { duration: CHECKED_FADE_OUT_DURATION_MS }, (finished) => {
        if (finished) {
          runOnJS(onFadeComplete)(task.id);
        }
      }),
    );
  }, [isFading, onFadeComplete, rowOpacity, task.id]);

  useEffect(() => {
    const smooth = Easing.bezier(0.4, 0, 0.2, 1);

    if (isExpanded) {
      // Opening: surface fades in as pill → expands to full width → body drops
      surfaceProgress.value = withTiming(1, { duration: 620, easing: smooth });
      bodyProgress.value = withTiming(1, { duration: 580, easing: smooth });
    } else {
      // Closing: body collapses → surface shrinks to pill → gently fades out
      bodyProgress.value = withTiming(0, { duration: 480, easing: smooth });
      surfaceProgress.value = withDelay(
        100,
        withTiming(0, { duration: 620, easing: smooth }),
      );
    }
  }, [isExpanded, surfaceProgress, bodyProgress]);

  const commitChanges = useCallback(async () => {
    if (isSaving) {
      return;
    }

    const nextTitle = title.trim();
    const nextNotes = notes.trim();
    const nextWhenKey = whenSelectionKey(whenSelection);
    const checklistTexts = normalizeChecklistTexts(
      checklistItemsRef.current.map((item) => item.text),
    );
    const checklistSignature = JSON.stringify(checklistTexts);
    const deadlineDateIso = deadlineDate ? toDateOnlyIso(deadlineDate) : null;
    const hasDraftChanges =
      nextTitle !== savedTitle.trim() ||
      nextNotes !== savedNotes.trim() ||
      selectedClientId !== savedClientId ||
      nextWhenKey !== savedWhenKey ||
      deadlineDateIso !== savedDeadlineDateIso ||
      checklistSignature !== savedChecklistSignature;

    if (!hasDraftChanges) {
      return;
    }

    if (!nextTitle) {
      setErrorMessage("Title can't be empty.");
      return;
    }

    setIsSaving(true);
    try {
      const persistence = whenSelectionToPersistence(whenSelection);

      await onSave(task.id, {
        title: nextTitle,
        description: nextNotes,
        clientId: selectedClientId,
        scheduledDateIso: persistence.scheduledDateIso,
        deadlineDateIso,
        checklistItems: checklistTexts,
        status: persistence.status,
      });
      setSavedTitle(nextTitle);
      setSavedNotes(nextNotes);
      setSavedClientId(selectedClientId);
      setSavedWhenKey(nextWhenKey);
      setSavedDeadlineDateIso(deadlineDateIso);
      setSavedChecklistSignature(checklistSignature);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Couldn't save the task.",
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    deadlineDate,
    isSaving,
    notes,
    onSave,
    savedChecklistSignature,
    savedClientId,
    selectedClientId,
    savedDeadlineDateIso,
    savedNotes,
    savedTitle,
    savedWhenKey,
    task.id,
    title,
    whenSelection,
  ]);

  useEffect(() => {
    if (isExpanded) {
      return;
    }

    if (wasExpandedRef.current) {
      const trimmedDraft = checklistDraft.trim();
      if (trimmedDraft.length > 0) {
        const nextItems = [
          ...checklistItemsRef.current,
          { id: createChecklistItemId(), text: trimmedDraft },
        ];
        checklistItemsRef.current = nextItems;
        setChecklistItems(nextItems);
        setChecklistDraft("");
      }
      setIsChecklistComposerOpen(false);
      setEditingChecklistItemId(null);
      setEditingChecklistText("");
      setIsChecklistVisible(checklistItemsRef.current.length > 0);
      void commitChanges();
      return;
    }

    if (!syncFromTaskWhenCollapsed) {
      return;
    }

    const nextWhenSelection = parseWhenSelection(task);
    const nextWhenKey = whenSelectionKey(nextWhenSelection);
    const nextDeadlineDateIso = task.deadlineDateIso ?? null;
    const nextChecklistTexts = normalizeChecklistTexts(task.checklistItems);
    setTitle(task.title ?? "");
    setSavedTitle(task.title ?? "");
    setNotes(task.description ?? "");
    setSavedNotes(task.description ?? "");
    setSelectedClientId(task.clientId ?? null);
    setSelectedClientLabel(task.clientName ?? null);
    setSavedClientId(task.clientId ?? null);
    setWhenSelection((current) =>
      whenSelectionKey(current) === nextWhenKey ? current : nextWhenSelection,
    );
    setSavedWhenKey(nextWhenKey);
    setDeadlineDate(fromDateOnlyIso(nextDeadlineDateIso));
    setSavedDeadlineDateIso(nextDeadlineDateIso);
    const nextChecklistItems = checklistTextsToItems(nextChecklistTexts);
    setChecklistItems(nextChecklistItems);
    checklistItemsRef.current = nextChecklistItems;
    setSavedChecklistSignature(JSON.stringify(nextChecklistTexts));
    setCompletedChecklistItemIds([]);
    setChecklistDraft("");
    setIsChecklistVisible(nextChecklistTexts.length > 0);
    setIsChecklistComposerOpen(false);
    setEditingChecklistItemId(null);
    setEditingChecklistText("");
    skipChecklistBlurForItemIdRef.current = null;
    setErrorMessage(null);
  }, [
    commitChanges,
    isExpanded,
    task.checklistItems,
    task.clientId,
    task.clientName,
    task.deadlineDateIso,
    task.description,
    task.id,
    task.scheduledDate,
    task.status,
    task.title,
    checklistDraft,
    syncFromTaskWhenCollapsed,
  ]);

  useEffect(() => {
    wasExpandedRef.current = isExpanded;
  }, [isExpanded]);

  useEffect(() => {
    checklistItemsRef.current = checklistItems;
  }, [checklistItems]);

  useEffect(() => {
    if (!isChecklistComposerOpen) {
      return;
    }
    setEditingChecklistItemId(null);
    setEditingChecklistText("");
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

  useEffect(() => {
    return () => {
      checklistItemFocusTimeoutsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      checklistItemFocusTimeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeClientPickerSelection((selection) => {
      if (!activeClientPickerTokenRef.current) {
        return;
      }

      if (selection.token !== activeClientPickerTokenRef.current) {
        return;
      }

      activeClientPickerTokenRef.current = null;
      setSelectedClientId(selection.clientId);
      setSelectedClientLabel(selection.clientName);
    });

    return unsubscribe;
  }, []);

  const handleToolbarIconPress = (action?: () => void) => {
    Keyboard.dismiss();
    action?.();
  };
  const openClientsModal = () => {
    const pickerToken = `picker-${task.id}-${Date.now()}`;
    activeClientPickerTokenRef.current = pickerToken;

    handleToolbarIconPress(() =>
      router.push({
        pathname: "/clients",
        params: {
          pickerToken,
          ...(selectedClientId ? { selectedClientId } : {}),
          ...(allowClientAssignment ? { jobId: task.id } : {}),
        },
      }),
    );
  };

  const focusTitleInput = () => {
    requestAnimationFrame(() => {
      titleInputRef.current?.focus();
    });
  };

  const focusNotesInput = () => {
    requestAnimationFrame(() => {
      notesInputRef.current?.focus();
    });
  };

  const focusChecklistDraftWithRetry = (attempt = 0) => {
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
  };

  const focusChecklistItemWithRetry = (itemId: string, attempt = 0) => {
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
  };

  const clearChecklistItemFocusTimeouts = () => {
    checklistItemFocusTimeoutsRef.current.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    checklistItemFocusTimeoutsRef.current = [];
  };

  const scheduleChecklistItemFocus = (itemId: string) => {
    clearChecklistItemFocusTimeouts();
    requestAnimationFrame(() => {
      focusChecklistItemWithRetry(itemId);
    });
    const retryShort = setTimeout(() => {
      focusChecklistItemWithRetry(itemId);
    }, 80);
    const retryLong = setTimeout(() => {
      focusChecklistItemWithRetry(itemId);
    }, 180);
    checklistItemFocusTimeoutsRef.current.push(retryShort, retryLong);
  };

  const clearChecklistEditingState = () => {
    setEditingChecklistItemId(null);
    setEditingChecklistText("");
  };

  const openChecklistComposer = () => {
    setIsChecklistVisible(true);
    setIsChecklistComposerOpen(true);
    clearChecklistEditingState();
    requestAnimationFrame(() => {
      focusChecklistDraftWithRetry();
    });
  };

  const handleSubmitChecklistDraft = () => {
    const trimmedDraft = checklistDraft.trim();
    if (!trimmedDraft.length) {
      return;
    }

    const nextItems = [
      ...checklistItemsRef.current,
      { id: createChecklistItemId(), text: trimmedDraft },
    ];
    checklistItemsRef.current = nextItems;
    setChecklistItems(nextItems);
    setChecklistDraft("");
    setIsChecklistVisible(true);
    setIsChecklistComposerOpen(true);
    clearChecklistEditingState();
    requestAnimationFrame(() => {
      focusChecklistDraftWithRetry();
    });
  };

  const closeChecklistComposer = () => {
    const trimmedDraft = checklistDraft.trim();

    if (trimmedDraft.length > 0) {
      const nextItems = [
        ...checklistItemsRef.current,
        { id: createChecklistItemId(), text: trimmedDraft },
      ];
      checklistItemsRef.current = nextItems;
      setChecklistItems(nextItems);
      setChecklistDraft("");
      setIsChecklistVisible(true);
      setIsChecklistComposerOpen(false);
      clearChecklistEditingState();
      return;
    }

    setIsChecklistComposerOpen(false);
    clearChecklistEditingState();
    setIsChecklistVisible(checklistItemsRef.current.length > 0);
  };

  const handleChecklistRowPress = (item: ChecklistItem) => {
    const trimmedDraft = checklistDraft.trim();
    if (isChecklistComposerOpen && trimmedDraft.length > 0) {
      const nextItems = [
        ...checklistItemsRef.current,
        { id: createChecklistItemId(), text: trimmedDraft },
      ];
      checklistItemsRef.current = nextItems;
      setChecklistItems(nextItems);
      setChecklistDraft("");
    }

    setIsChecklistVisible(true);
    setIsChecklistComposerOpen(false);
    setEditingChecklistItemId(item.id);
    setEditingChecklistText(item.text);
    skipChecklistBlurForItemIdRef.current = null;
    requestAnimationFrame(() => {
      scheduleChecklistItemFocus(item.id);
    });
  };

  const handleChecklistCompleteToggle = (itemId: string) => {
    setCompletedChecklistItemIds((current) => {
      if (current.includes(itemId)) {
        return current.filter((entry) => entry !== itemId);
      }

      return [...current, itemId];
    });
  };

  const handleChecklistItemTextChange = (itemId: string, text: string) => {
    setEditingChecklistText(text);
    setChecklistItems((current) => {
      const next = current.map((entry) =>
        entry.id === itemId ? { ...entry, text } : entry,
      );
      checklistItemsRef.current = next;
      return next;
    });
  };

  const removeChecklistItem = (itemId: string) => {
    skipChecklistBlurForItemIdRef.current = itemId;
    const currentItems = checklistItemsRef.current;
    const removedIndex = currentItems.findIndex((entry) => entry.id === itemId);

    if (removedIndex === -1) {
      skipChecklistBlurForItemIdRef.current = null;
      return;
    }

    const nextItems = currentItems.filter((entry) => entry.id !== itemId);
    checklistItemsRef.current = nextItems;
    setChecklistItems(nextItems);

    if (nextItems.length > 0) {
      const previousIndex = Math.max(0, removedIndex - 1);
      const previousItem = nextItems[previousIndex];
      if (previousItem) {
        setEditingChecklistItemId(previousItem.id);
        setEditingChecklistText(previousItem.text);
        setIsChecklistVisible(true);
        setIsChecklistComposerOpen(false);
        requestAnimationFrame(() => {
          scheduleChecklistItemFocus(previousItem.id);
        });
      }
    } else {
      clearChecklistEditingState();
      setIsChecklistVisible(isChecklistComposerOpen);
    }
  };

  const commitChecklistEditing = (itemId: string) => {
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
    checklistItemsRef.current = nextItems;
    setChecklistItems(nextItems);
    clearChecklistEditingState();
  };

  const finalizeChecklistEditingOnBlur = (itemId: string) => {
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
    checklistItemsRef.current = nextItems;
    setChecklistItems(nextItems);
    clearChecklistEditingState();
  };

  const handleChecklistToolbarPress = () => {
    openChecklistComposer();
  };

  const rowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
  }));

  const surfaceBackgroundAnimatedStyle = useAnimatedStyle(() => ({
    // 0→0.3: fade in at pill size, no movement
    // 0.3→1: expand from pill to full screen width
    left: interpolate(surfaceProgress.value, [0, 0.3, 1], [-8, -8, -20]),
    right: interpolate(surfaceProgress.value, [0, 0.3, 1], [-8, -8, -20]),
    top: 0,
    bottom: 0,
    borderRadius: interpolate(surfaceProgress.value, [0, 0.3, 1], [10, 10, 8]),
    opacity: interpolate(surfaceProgress.value, [0, 0.55, 1], [0, 1, 1]),
    shadowOpacity: interpolate(surfaceProgress.value, [0, 0.4, 1], [0, 0.06, 0.14]),
    elevation: interpolate(surfaceProgress.value, [0, 0.4, 1], [0, 2, 4]),
  }));

  const expandedBodyContainerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bodyProgress.value, [0, 0.35, 1], [0, 0.85, 1]),
  }));

  const handleHeaderRowLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      const nextWidth = Math.ceil(event.nativeEvent.layout.width);
      if (nextWidth <= 0 || Math.abs(nextWidth - headerRowWidth) <= 1) {
        return;
      }

      setHeaderRowWidth(nextWidth);
    },
    [headerRowWidth],
  );

  const handleTitleLayout = useCallback(
    (event: { nativeEvent: { layout: { x: number; width: number } } }) => {
      const nextX = Math.max(0, Math.floor(event.nativeEvent.layout.x));
      const nextWidth = Math.max(0, Math.ceil(event.nativeEvent.layout.width));
      if (
        Math.abs(nextX - titleFrame.x) <= 1 &&
        Math.abs(nextWidth - titleFrame.width) <= 1
      ) {
        return;
      }

      setTitleFrame({ x: nextX, width: nextWidth });
    },
    [titleFrame.width, titleFrame.x],
  );

  const handleExpandedBodyLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number } } }) => {
      const nextHeight = Math.ceil(event.nativeEvent.layout.height);
      if (nextHeight <= 0 || Math.abs(nextHeight - expandedBodyHeight) <= 1) {
        return;
      }

      setExpandedBodyHeight(nextHeight);
    },
    [expandedBodyHeight],
  );

  const selectedWhenDisplay =
    whenSelection.type === "date"
      ? {
          label: formatSelectedDateLabel(whenSelection.date),
          icon: "upcoming" as const,
          iconColor: "var(--color-upcoming)",
          showIcon: true,
        }
      : whenSelection.type === "today"
        ? {
            label: "Today",
            icon: "today" as const,
            iconColor: "var(--color-today)",
            showIcon: true,
          }
        : whenSelection.type === "someday"
          ? {
              label: "Someday",
              icon: "someday" as const,
              iconColor: "var(--color-someday)",
              showIcon: true,
            }
          : null;

  const selectedDeadlineDisplay = deadlineDate
    ? {
        label: formatSelectedDateLabel(deadlineDate),
        daysLeft: formatDaysUntilLabel(deadlineDate),
      }
    : null;
  const compactDeadlineLabel = deadlineDate
    ? formatCompactDateLabel(deadlineDate)
    : null;
  const selectedClientDisplay = selectedClientLabel
    ? { label: selectedClientLabel }
    : null;
  const bodyContentInsetLeft = Math.max(0, checkboxSize + 12 - 16);
  const visibleChecklistItems = checklistItems;
  const shouldRenderChecklist =
    isChecklistVisible || visibleChecklistItems.length > 0;
  const showChecklistComposer = isChecklistComposerOpen;
  const metadataRowClassName = shouldRenderChecklist
    ? "mt-[18px] mb-[2px] flex-row justify-between"
    : "mt-[10px] mb-0 flex-row justify-between";
  const metadataDetailsClassName =
    "h-[78px] min-w-0 flex-1 justify-end pr-2 pb-0";
  const metadataIconsClassName =
    "ml-2 h-[78px] shrink-0 flex-row items-end justify-end self-stretch pb-0";
  const titleRowLayoutTransition = LinearTransition.duration(190);

  return (
    <Pressable
      className="relative mb-0 -mx-5 px-5"
      onPress={(event) => {
        event.stopPropagation();
      }}
    >
      <Animated.View style={rowAnimatedStyle}>
        <Animated.View
          className="relative"
        >
          <Animated.View
            pointerEvents="none"
            className="absolute"
            style={[
              {
                backgroundColor: accordionBg,
                shadowColor: "#000000",
                shadowOffset: { width: 0, height: 6 },
                shadowRadius: 12,
              },
              surfaceBackgroundAnimatedStyle,
            ]}
          />

          <Animated.View
            className="relative flex-row items-center py-2"
            onLayout={handleHeaderRowLayout}
          >
            <TouchableOpacity
              className="mr-3 items-center justify-center"
              activeOpacity={0.72}
              onPress={(event) => {
                event.stopPropagation();
                onCheckPress(task.id);
              }}
              disabled={isBusy}
              style={{
                width: checkboxSize,
                height: checkboxSize,
                borderRadius: RADIUS_TOKENS.xs,
                borderWidth: BORDER_WIDTH_TOKENS.subtle,
                borderColor: isChecked ? checkedColor : checkboxBorderColor,
                backgroundColor: isChecked ? checkedColor : "transparent",
              }}
            >
              {isChecked ? <Icon name="check" size={10} color={checkedIconColor} /> : null}
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 flex-row items-center py-1"
              activeOpacity={isExpanded ? 1 : 0.76}
              onLayout={handleTitleLayout}
              onPress={(event) => {
                event.stopPropagation();
                if (isExpanded) {
                  focusTitleInput();
                  return;
                }
                onToggleExpanded(task.id);
              }}
            >
              {!isExpanded && titlePrefix ? (
                <Animated.View
                  entering={SlideInLeft.duration(120)}
                  exiting={FadeOut.duration(170)}
                  layout={titleRowLayoutTransition}
                  className="mr-2 rounded-md px-1.5 py-0.5"
                  style={{ backgroundColor: dateBadgeBackgroundColor }}
                >
                  <Text
                    variant="labelSm"
                    className="font-semibold"
                    style={{ color: primaryTextColor, fontSize: 11, lineHeight: 13 }}
                  >
                    {titlePrefix}
                  </Text>
                </Animated.View>
              ) : null}
              <Animated.View layout={titleRowLayoutTransition} className="flex-1">
                <AppTextInput
                  ref={titleInputRef}
                  value={title}
                  onChangeText={(nextTitle) => {
                    setTitle(nextTitle);
                    if (errorMessage) {
                      setErrorMessage(null);
                    }
                  }}
                  editable={isExpanded}
                  pointerEvents={isExpanded ? "auto" : "none"}
                  placeholder="New Quick Task"
                  placeholderTextColor={secondaryTextColor}
                  variant="bodyMd"
                  style={{
                    minHeight: 36,
                    flex: 1,
                    backgroundColor: "transparent",
                    paddingHorizontal: 0,
                    paddingVertical: 4,
                    color: primaryTextColor,
                  }}
                  selectionColor={selectionColor}
                  returnKeyType="done"
                />
              </Animated.View>
            </TouchableOpacity>

            {!isExpanded && selectedDeadlineDisplay ? (
              <Animated.View
                entering={SlideInRight.duration(140)}
                exiting={SlideOutRight.duration(160)}
              >
                <TouchableOpacity
                  activeOpacity={0.76}
                  className="ml-2 flex-row items-center py-1"
                  onPress={(event) => {
                    event.stopPropagation();
                    onToggleExpanded(task.id);
                  }}
                >
                  <Icon name="flag" size={14} color={secondaryTextColor} weight="light" />
                  <Text
                    variant="labelSm"
                    className="ml-1 font-regular"
                    style={{ color: secondaryTextColor, fontSize: 11, lineHeight: 13 }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {compactDeadlineLabel}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ) : null}
          </Animated.View>

          <Animated.View
            pointerEvents={isExpanded ? "auto" : "none"}
            style={[
              {
                height: isExpanded ? undefined : 0,
                overflow: "hidden",
              },
              expandedBodyContainerAnimatedStyle,
            ]}
          >
            <View className="px-4 pb-4" onLayout={handleExpandedBodyLayout}>
            {errorMessage ? (
              <Text
                className="mb-2 font-regular text-label-sm"
                style={{ color: secondaryTextColor, marginLeft: bodyContentInsetLeft }}
              >
                {errorMessage}
              </Text>
            ) : null}

            <Pressable
              className="relative min-h-[42px] py-1"
              style={{ marginLeft: bodyContentInsetLeft }}
              onPress={(event) => {
                event.stopPropagation();
                focusNotesInput();
              }}
            >
              {!notes.trim() && !isNotesFocused ? (
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
                ref={notesInputRef}
                value={notes}
                onChangeText={setNotes}
                onFocus={() => {
                  closeChecklistComposer();
                  setIsNotesFocused(true);
                }}
                onBlur={() => setIsNotesFocused(false)}
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
            </Pressable>

            {shouldRenderChecklist ? (
              <Pressable
                className="mt-2"
                style={{ marginLeft: bodyContentInsetLeft }}
                onPress={(event) => {
                  event.stopPropagation();
                }}
              >
                {visibleChecklistItems.map((item) => {
                  const isChecklistItemCompleted = completedChecklistItemIds.includes(
                    item.id,
                  );
                  const separatorStyle = {
                    borderColor: inputBorderColor,
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

                {showChecklistComposer ? (
                  <View
                    className="mx-1 flex-row items-center rounded-xl px-4 py-2"
                    style={{
                      borderColor: inputBorderColor,
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
                          clearChecklistEditingState();
                        }}
                        onKeyPress={(event) => {
                          if (event.nativeEvent.key !== "Backspace") {
                            return;
                          }
                          if (checklistDraft.length === 0) {
                            setIsChecklistComposerOpen(false);
                            clearChecklistEditingState();
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
              </Pressable>
            ) : null}

            <View className={metadataRowClassName}>
              <View className={metadataDetailsClassName}>
                {selectedClientDisplay ? (
                  <TouchableOpacity
                    activeOpacity={0.72}
                    className="min-w-0 flex-row items-center pr-[10px] py-1"
                    onPress={openClientsModal}
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
                      {selectedClientDisplay.label}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {selectedWhenDisplay ? (
                  <TouchableOpacity
                    activeOpacity={0.72}
                    className={`min-w-0 flex-row items-center pr-[10px] py-1 ${
                      selectedClientDisplay ? "mt-2" : ""
                    }`}
                    onPress={() => setIsWhenModalOpen(true)}
                  >
                    {selectedWhenDisplay.showIcon ? (
                      <Icon
                        name={selectedWhenDisplay.icon}
                        size={16}
                        color={selectedWhenDisplay.iconColor}
                        weight="light"
                      />
                    ) : null}
                    <Text
                      variant="label"
                      className={
                        selectedWhenDisplay.showIcon ? "ml-2 font-semibold" : "font-semibold"
                      }
                      style={{ color: primaryTextColor, flexShrink: 1 }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {selectedWhenDisplay.label}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {selectedDeadlineDisplay ? (
                  <TouchableOpacity
                    activeOpacity={0.72}
                    className={`min-w-0 flex-row items-center pr-[10px] py-1 ${
                      selectedWhenDisplay || selectedClientDisplay ? "mt-2" : ""
                    }`}
                    onPress={() => setIsDeadlineModalOpen(true)}
                  >
                    <Icon name="flag" size={16} color={primaryTextColor} weight="light" />
                    <View className="ml-2 min-w-0 shrink flex-row items-center">
                      <Text
                        variant="label"
                        className="font-semibold"
                        style={{ color: primaryTextColor, flexShrink: 1 }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {selectedDeadlineDisplay.label}
                      </Text>
                      <Text
                        variant="labelSm"
                        className="ml-2 font-regular"
                        style={{ color: secondaryTextColor }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {selectedDeadlineDisplay.daysLeft}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View className={metadataIconsClassName}>
                {whenSelection.type === "none" ? (
                  <TouchableOpacity
                    className="h-8 w-8 items-center justify-center"
                    activeOpacity={0.72}
                    onPress={() => setIsWhenModalOpen(true)}
                  >
                    <Icon
                      name="upcoming"
                      size={18}
                      color={secondaryTextColor}
                      weight="light"
                    />
                  </TouchableOpacity>
                ) : null}
                {!selectedClientDisplay ? (
                  <TouchableOpacity
                    className="ml-2 h-8 w-8 items-center justify-center"
                    activeOpacity={0.72}
                    onPress={openClientsModal}
                  >
                    <Icon
                      name="client"
                      size={18}
                      color={secondaryTextColor}
                      weight="light"
                    />
                  </TouchableOpacity>
                ) : null}
                {!shouldRenderChecklist ? (
                  <TouchableOpacity
                    className="ml-2 h-8 w-8 items-center justify-center"
                    activeOpacity={0.72}
                    onPress={(event) => {
                      event.stopPropagation();
                      handleChecklistToolbarPress();
                    }}
                  >
                    <Icon
                      name="checkCircle"
                      size={18}
                      color={secondaryTextColor}
                      weight="light"
                    />
                  </TouchableOpacity>
                ) : null}
                {!deadlineDate ? (
                  <TouchableOpacity
                    className="ml-2 h-8 w-8 items-center justify-center"
                    activeOpacity={0.72}
                    onPress={() => setIsDeadlineModalOpen(true)}
                  >
                    <Icon name="flag" size={18} color={secondaryTextColor} weight="light" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>

      <WhenCalendarModal
        visible={isWhenModalOpen}
        onClose={() => setIsWhenModalOpen(false)}
        onSelectDate={(date) => setWhenSelection({ type: "date", date })}
        onSelectToday={() => setWhenSelection({ type: "today" })}
        onSelectSomeday={() => setWhenSelection({ type: "someday" })}
        onClearSelection={() => setWhenSelection({ type: "none" })}
        selectedDate={whenSelection.type === "date" ? whenSelection.date : null}
        selectedWhen={whenSelection.type}
      />

      <WhenCalendarModal
        visible={isDeadlineModalOpen}
        mode="deadline"
        onClose={() => setIsDeadlineModalOpen(false)}
        onSelectDate={(date) => setDeadlineDate(date)}
        onClearSelection={() => setDeadlineDate(null)}
        selectedDate={deadlineDate}
      />
    </Pressable>
  );
}
