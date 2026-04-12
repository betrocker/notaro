import { Icon } from "@/components/Icon";
import WhenCalendarModal from "@/components/WhenCalendarModal";
import { AppText as Text, AppTextInput } from "@/components/ui";
import {
  BORDER_WIDTH_TOKENS,
  COLOR_TOKENS,
  RADIUS_TOKENS,
} from "@/lib/design-system/tokens";
import { useColorScheme } from "nativewind";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, TextInput as RNTextInput, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
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

type ChecklistEditCommitResult = "none" | "removed" | "removed_moved_previous";

type WhenSelection =
  | { type: "none" }
  | { type: "date"; date: Date }
  | { type: "today" }
  | { type: "someday" };

type TodoItem = {
  id: string;
  title: string;
  description: string | null;
  scheduledDate?: string | null;
  deadlineDateIso?: string | null;
  checklistItems?: string[];
  status?: string | null;
};

type SavePayload = {
  title: string;
  description: string;
  scheduledDateIso?: string | null;
  deadlineDateIso?: string | null;
  checklistItems?: string[];
  status?: "new" | "someday" | null;
};

const CHECKED_HOLD_DURATION_MS = 2300;
const CHECKED_FADE_OUT_DURATION_MS = 320;
const NOTES_MIN_HEIGHT = 36;

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
  const accordionBg = withOpacity(COLOR_TOKENS[colorMode]["bg.input"], 0.72);
  const selectionColor = COLOR_TOKENS.light["primary.default"];
  const checklistActiveBg = COLOR_TOKENS[colorMode]["btn.secondary"];
  const checklistDotColor = COLOR_TOKENS[colorMode]["primary.default"];

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
  const [selectedTagLabel] = useState<string | null>(null);
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
  const [checklistDraft, setChecklistDraft] = useState("");
  const [, setIsChecklistVisible] = useState(false);
  const [isChecklistSurfaceActive, setIsChecklistSurfaceActive] = useState(false);
  const [armedDeleteChecklistItemId, setArmedDeleteChecklistItemId] = useState<
    string | null
  >(null);
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<
    string | null
  >(null);
  const [editingChecklistText, setEditingChecklistText] = useState("");
  const checklistDraftInputRef = useRef<RNTextInput>(null);
  const checklistItemsRef = useRef<ChecklistItem[]>([]);
  const checklistItemInputRefs = useRef<Record<string, RNTextInput | null>>({});
  const editingChecklistTextRef = useRef("");
  const armedDeleteChecklistItemIdRef = useRef<string | null>(null);
  const skipChecklistBlurForItemIdRef = useRef<string | null>(null);
  const isOpeningChecklistRef = useRef(false);
  const isCollapsingChecklistRef = useRef(false);
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
      bodyProgress.value = withDelay(
        160,
        withTiming(1, { duration: 580, easing: smooth }),
      );
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
        scheduledDateIso: persistence.scheduledDateIso,
        deadlineDateIso,
        checklistItems: checklistTexts,
        status: persistence.status,
      });
      setSavedTitle(nextTitle);
      setSavedNotes(nextNotes);
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
    isSaving,
    notes,
    onSave,
    savedChecklistSignature,
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
      collapseChecklist({ dismissKeyboard: true });
      void commitChanges();
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
    setWhenSelection((current) =>
      whenSelectionKey(current) === nextWhenKey ? current : nextWhenSelection,
    );
    setSavedWhenKey(nextWhenKey);
    setDeadlineDate(fromDateOnlyIso(nextDeadlineDateIso));
    setSavedDeadlineDateIso(nextDeadlineDateIso);
    setChecklistItems(checklistTextsToItems(nextChecklistTexts));
    setSavedChecklistSignature(JSON.stringify(nextChecklistTexts));
    setChecklistDraft("");
    setIsChecklistVisible(nextChecklistTexts.length > 0);
    setIsChecklistSurfaceActive(false);
    setErrorMessage(null);
  }, [
    commitChanges,
    isExpanded,
    task.checklistItems,
    task.deadlineDateIso,
    task.description,
    task.id,
    task.scheduledDate,
    task.status,
    task.title,
  ]);

  useEffect(() => {
    wasExpandedRef.current = isExpanded;
  }, [isExpanded]);

  useEffect(() => {
    checklistItemsRef.current = checklistItems;
  }, [checklistItems]);

  useEffect(() => {
    editingChecklistTextRef.current = editingChecklistText;
  }, [editingChecklistText]);

  useEffect(() => {
    armedDeleteChecklistItemIdRef.current = armedDeleteChecklistItemId;
  }, [armedDeleteChecklistItemId]);

  useEffect(() => {
    return () => {
      checklistItemFocusTimeoutsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      checklistItemFocusTimeoutsRef.current = [];
    };
  }, []);

  const handleToolbarIconPress = (action?: () => void) => {
    Keyboard.dismiss();
    setIsChecklistSurfaceActive(false);
    action?.();
  };

  const handleChecklistInputFocus = () => {
    setIsChecklistVisible(true);
    setIsChecklistSurfaceActive(true);
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
    }, 24);
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
    }, 24);
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
    editingChecklistTextRef.current = "";
    armedDeleteChecklistItemIdRef.current = null;
    setArmedDeleteChecklistItemId(null);
  };

  const collapseChecklist = ({ dismissKeyboard = false } = {}) => {
    isOpeningChecklistRef.current = false;
    isCollapsingChecklistRef.current = true;
    const trimmedDraft = checklistDraft.trim();
    let nextItems = checklistItemsRef.current;

    if (trimmedDraft.length > 0) {
      nextItems = [
        ...checklistItemsRef.current,
        { id: createChecklistItemId(), text: trimmedDraft },
      ];
      checklistItemsRef.current = nextItems;
      setChecklistItems(nextItems);
    }

    clearChecklistEditingState();
    setChecklistDraft("");
    setIsChecklistSurfaceActive(false);
    setIsChecklistVisible(nextItems.length > 0);
    if (dismissKeyboard) {
      Keyboard.dismiss();
    }
    isCollapsingChecklistRef.current = false;
  };

  const handleSubmitChecklistDraft = () => {
    const trimmedValue = checklistDraft.trim();
    if (!trimmedValue) {
      return;
    }

    const nextItems = [
      ...checklistItemsRef.current,
      { id: createChecklistItemId(), text: trimmedValue },
    ];
    checklistItemsRef.current = nextItems;
    setChecklistItems(nextItems);
    setChecklistDraft("");
    setArmedDeleteChecklistItemId(null);
    setIsChecklistVisible(true);
    setIsChecklistSurfaceActive(true);
    focusChecklistDraftWithRetry();
  };

  const handleChecklistDraftBackspace = () => {
    if (checklistDraft.length > 0) {
      return;
    }

    const currentItems = checklistItemsRef.current;
    if (currentItems.length === 0) {
      clearChecklistItemFocusTimeouts();
      clearChecklistEditingState();
      setIsChecklistSurfaceActive(false);
      setIsChecklistVisible(false);
      Keyboard.dismiss();
      return;
    }

    const lastItem = currentItems[currentItems.length - 1];
    if (!lastItem) {
      return;
    }

    handleChecklistRowPress(lastItem);
  };

  const handleChecklistRowPress = (item: ChecklistItem) => {
    skipChecklistBlurForItemIdRef.current = null;
    setIsChecklistVisible(true);
    setIsChecklistSurfaceActive(true);
    setEditingChecklistItemId(item.id);
    setEditingChecklistText(item.text);
    editingChecklistTextRef.current = item.text;
    armedDeleteChecklistItemIdRef.current = null;
    setArmedDeleteChecklistItemId(null);
    scheduleChecklistItemFocus(item.id);
  };

  const removeChecklistItem = (itemId: string): ChecklistEditCommitResult => {
    skipChecklistBlurForItemIdRef.current = itemId;
    const currentItems = checklistItemsRef.current;
    const currentIndex = currentItems.findIndex((item) => item.id === itemId);
    if (currentIndex < 0) {
      skipChecklistBlurForItemIdRef.current = null;
      return "none";
    }

    const previousItem =
      currentIndex > 0 ? currentItems[currentIndex - 1] : null;
    const nextItems = currentItems.filter((item) => item.id !== itemId);

    checklistItemsRef.current = nextItems;
    setChecklistItems(nextItems);
    armedDeleteChecklistItemIdRef.current = null;
    setArmedDeleteChecklistItemId(null);

    if (nextItems.length === 0) {
      clearChecklistItemFocusTimeouts();
      clearChecklistEditingState();
      setIsChecklistVisible(false);
      setIsChecklistSurfaceActive(false);
      Keyboard.dismiss();
      return "removed";
    }

    if (currentIndex === 0) {
      clearChecklistItemFocusTimeouts();
      clearChecklistEditingState();
      setIsChecklistVisible(true);
      setIsChecklistSurfaceActive(false);
      Keyboard.dismiss();
      return "removed";
    }

    if (previousItem) {
      setEditingChecklistItemId(previousItem.id);
      setEditingChecklistText(previousItem.text);
      editingChecklistTextRef.current = previousItem.text;
      setIsChecklistSurfaceActive(true);
      scheduleChecklistItemFocus(previousItem.id);
      return "removed_moved_previous";
    }

    clearChecklistItemFocusTimeouts();
    clearChecklistEditingState();
    setIsChecklistVisible(nextItems.length > 0);
    setIsChecklistSurfaceActive(false);
    Keyboard.dismiss();

    return "removed";
  };

  const setChecklistItemText = (itemId: string, text: string) => {
    const nextItems = checklistItemsRef.current.map((entry) =>
      entry.id === itemId ? { ...entry, text } : entry,
    );
    checklistItemsRef.current = nextItems;
    setChecklistItems(nextItems);
  };

  const handleChecklistToolbarPress = () => {
    isOpeningChecklistRef.current = true;
    skipChecklistBlurForItemIdRef.current = null;
    setIsChecklistVisible(true);
    setIsChecklistSurfaceActive(true);
    clearChecklistEditingState();
    requestAnimationFrame(() => {
      focusChecklistDraftWithRetry();
      setTimeout(() => {
        focusChecklistDraftWithRetry();
      }, 90);
      setTimeout(() => {
        focusChecklistDraftWithRetry();
      }, 180);
      setTimeout(() => {
        isOpeningChecklistRef.current = false;
      }, 360);
    });
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
    height: interpolate(bodyProgress.value, [0, 1], [0, expandedBodyHeight]),
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
  const selectedTagDisplay = selectedTagLabel
    ? { label: selectedTagLabel }
    : null;
  const visibleChecklistItems = checklistItems;
  const shouldRenderChecklist =
    isChecklistSurfaceActive ||
    editingChecklistItemId !== null ||
    checklistDraft.trim().length > 0 ||
    visibleChecklistItems.length > 0;
  const showChecklistComposer =
    isChecklistSurfaceActive && editingChecklistItemId === null;
  const metadataRowClassName = shouldRenderChecklist
    ? "mt-[6px] mb-[2px] flex-row justify-between"
    : "mt-[10px] mb-0 flex-row justify-between";
  const metadataDetailsClassName =
    "h-[78px] min-w-0 flex-1 justify-end pr-2 pb-0";
  const metadataIconsClassName =
    "ml-2 h-[78px] shrink-0 flex-row items-end justify-end self-stretch pb-0";

  return (
    <Pressable
      className="relative mb-1 -mx-5 px-5"
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
            className="relative flex-row items-center py-3"
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
              className="flex-1 flex-row items-center"
              activeOpacity={isExpanded ? 1 : 0.76}
              disabled={isExpanded}
              onLayout={handleTitleLayout}
              onPress={(event) => {
                event.stopPropagation();
                onToggleExpanded(task.id);
              }}
            >
              {titlePrefix ? (
                <Text className="mr-2 font-medium text-footer text-things-muted">
                  {titlePrefix}
                </Text>
              ) : null}
              <AppTextInput
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
                  minHeight: 30,
                  flex: 1,
                  backgroundColor: "transparent",
                  paddingHorizontal: 0,
                  paddingVertical: 0,
                  color: primaryTextColor,
                }}
                selectionColor={selectionColor}
                returnKeyType="done"
              />
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
            className="overflow-hidden"
            pointerEvents={isExpanded ? "auto" : "none"}
            style={expandedBodyContainerAnimatedStyle}
          >
            <View className="px-4 pb-4" onLayout={handleExpandedBodyLayout}>
            {errorMessage ? (
              <Text
                className="mb-2 ml-8 font-regular text-label-sm"
                style={{ color: secondaryTextColor }}
              >
                {errorMessage}
              </Text>
            ) : null}

            <View className="relative ml-8 min-h-[36px]">
              {!notes.trim() && !isNotesFocused ? (
                <Text
                  variant="labelSm"
                  pointerEvents="none"
                  className="absolute left-0 top-2 z-10"
                  style={{ color: secondaryTextColor }}
                >
                  Notes
                </Text>
              ) : null}
              <AppTextInput
                value={notes}
                onChangeText={setNotes}
                onFocus={() => {
                  collapseChecklist();
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
                  paddingTop: 6,
                  paddingBottom: 6,
                  color: primaryTextColor,
                }}
                selectionColor={selectionColor}
                multiline
                scrollEnabled={false}
                textAlignVertical="top"
              />
            </View>

            {shouldRenderChecklist ? (
              <Pressable
                className="ml-8 mt-1"
                onPress={(event) => {
                  event.stopPropagation();
                  setIsChecklistVisible(true);
                }}
              >
                <View className="rounded-xl py-0.5">
                  {visibleChecklistItems.map((item, index) => {
                    const isLastItem = index === visibleChecklistItems.length - 1;
                    return (
                      <React.Fragment key={item.id}>
                        <View
                          style={{
                            height: 0.5,
                            marginHorizontal: 4,
                            backgroundColor: inputBorderColor,
                          }}
                        />
                        {editingChecklistItemId === item.id ? (
                          <View
                            className="-mx-1 flex-row items-center rounded-xl px-4 py-2"
                            style={{
                              backgroundColor: checklistActiveBg,
                            }}
                          >
                            <View
                              className="h-[10px] w-[10px] rounded-full"
                              style={{
                                borderWidth: 1,
                                borderColor: checklistDotColor,
                                backgroundColor: "transparent",
                              }}
                            />
                            <AppTextInput
                              ref={(input) => {
                                checklistItemInputRefs.current[item.id] = input;
                              }}
                              autoFocus
                              value={editingChecklistText}
                              onChangeText={(nextText) => {
                                const previousText = editingChecklistTextRef.current;
                                editingChecklistTextRef.current = nextText;
                                setEditingChecklistText(nextText);
                                setChecklistItemText(item.id, nextText);
                                if (nextText.length === 0) {
                                  if (previousText.length === 0) {
                                    armedDeleteChecklistItemIdRef.current = item.id;
                                    setArmedDeleteChecklistItemId(item.id);
                                  } else {
                                    armedDeleteChecklistItemIdRef.current = item.id;
                                    setArmedDeleteChecklistItemId(item.id);
                                  }
                                  return;
                                }

                                armedDeleteChecklistItemIdRef.current = null;
                                setArmedDeleteChecklistItemId(null);
                              }}
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

                                if (armedDeleteChecklistItemIdRef.current === item.id) {
                                  removeChecklistItem(item.id);
                                } else {
                                  armedDeleteChecklistItemIdRef.current = item.id;
                                  setArmedDeleteChecklistItemId(item.id);
                                }
                              }}
                              onFocus={handleChecklistInputFocus}
                              onBlur={() => {
                                if (skipChecklistBlurForItemIdRef.current === item.id) {
                                  skipChecklistBlurForItemIdRef.current = null;
                                  return;
                                }

                                if (isCollapsingChecklistRef.current) {
                                  return;
                                }

                                if (editingChecklistItemId === item.id) {
                                  clearChecklistEditingState();
                                }
                                setIsChecklistSurfaceActive(false);
                              }}
                              onSubmitEditing={() => {
                                const currentItemText =
                                  checklistItemsRef.current.find(
                                    (entry) => entry.id === item.id,
                                  )?.text ?? "";
                                if (currentItemText.trim().length === 0) {
                                  armedDeleteChecklistItemIdRef.current = item.id;
                                  setArmedDeleteChecklistItemId(item.id);
                                  return;
                                }

                                skipChecklistBlurForItemIdRef.current = item.id;
                                setIsChecklistVisible(true);
                                setIsChecklistSurfaceActive(true);
                                clearChecklistEditingState();
                                requestAnimationFrame(() => {
                                  focusChecklistDraftWithRetry();
                                });
                              }}
                              placeholder="Checklist"
                              placeholderTextColor={secondaryTextColor}
                              variant="labelSm"
                              className="ml-2 flex-1"
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
                        ) : (
                          <TouchableOpacity
                            activeOpacity={0.8}
                            className="-mx-1 flex-row items-center px-4 py-2"
                            onPress={(event) => {
                              event.stopPropagation();
                              handleChecklistRowPress(item);
                            }}
                          >
                            <View
                              className="h-[10px] w-[10px] rounded-full"
                              style={{
                                borderWidth: 1,
                                borderColor: checklistDotColor,
                                backgroundColor: "transparent",
                              }}
                            />
                            <Text
                              variant="labelSm"
                              className="ml-2 flex-1"
                              style={{ color: primaryTextColor }}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {item.text}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {isLastItem ? (
                          <View
                            style={{
                              height: 0.5,
                              marginHorizontal: 4,
                              backgroundColor: inputBorderColor,
                            }}
                          />
                        ) : null}
                      </React.Fragment>
                    );
                  })}

                  {showChecklistComposer ? (
                    <View
                      className="-mx-1 flex-row items-center rounded-xl px-4 py-2"
                      style={{ backgroundColor: checklistActiveBg }}
                    >
                      <View
                        className="h-[10px] w-[10px] rounded-full"
                        style={{
                          borderWidth: 1,
                          borderColor: checklistDotColor,
                          backgroundColor: "transparent",
                        }}
                      />
                      <AppTextInput
                        ref={checklistDraftInputRef}
                        autoFocus={showChecklistComposer}
                        value={checklistDraft}
                        onChangeText={setChecklistDraft}
                        onKeyPress={(event) => {
                          if (event.nativeEvent.key !== "Backspace") {
                            return;
                          }
                          handleChecklistDraftBackspace();
                        }}
                        onFocus={handleChecklistInputFocus}
                        onBlur={() => {
                          setIsChecklistSurfaceActive(false);
                          if (
                            checklistItemsRef.current.length === 0 &&
                            checklistDraft.trim().length === 0
                          ) {
                            setIsChecklistVisible(false);
                          }
                        }}
                        onSubmitEditing={handleSubmitChecklistDraft}
                        placeholder="Checklist"
                        placeholderTextColor={secondaryTextColor}
                        variant="labelSm"
                        className="ml-2 flex-1"
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
                  ) : null}
                </View>
              </Pressable>
            ) : null}

            <View className={metadataRowClassName}>
              <View className={metadataDetailsClassName}>
                {selectedTagDisplay ? (
                  <TouchableOpacity
                    activeOpacity={0.72}
                    className="min-w-0 flex-row items-center"
                    onPress={() => handleToolbarIconPress()}
                  >
                    <Icon
                      name="tag"
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
                      {selectedTagDisplay.label}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {selectedWhenDisplay ? (
                  <TouchableOpacity
                    activeOpacity={0.72}
                    className="min-w-0 flex-row items-center pr-[10px] py-1"
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
                      selectedWhenDisplay ? "mt-2" : ""
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
                <TouchableOpacity
                  className="ml-2 h-8 w-8 items-center justify-center"
                  activeOpacity={0.72}
                  onPress={() => handleToolbarIconPress()}
                >
                  <Icon name="tag" size={18} color={secondaryTextColor} weight="light" />
                </TouchableOpacity>
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
