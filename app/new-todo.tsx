import { Icon } from "@/components/Icon";
import { ModalCircleButton } from "@/components/ModalCircleButton";
import WhenCalendarModal from "@/components/WhenCalendarModal";
import { AppTextInput, AppText as Text } from "@/components/ui";
import {
  COLOR_TOKENS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  SIZE_TOKENS,
} from "@/lib/design-system/tokens";
import { createTodo } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getThemeTokens } from "@/lib/theme";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  TextInput as RNTextInput,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type WhenSelection =
  | { type: "none" }
  | { type: "date"; date: Date }
  | { type: "today" }
  | { type: "someday" };

type ChecklistItem = {
  id: string;
  text: string;
};

type ChecklistEditCommitResult = "none" | "removed" | "removed_moved_previous";

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

function isSameDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

const MODAL_ENTRY_DURATION_MS = 320;
const MODAL_ENTRY_TRANSLATE_Y = Dimensions.get("window").height * 0.32;
const TITLE_AUTOFOCUS_DELAY_MS = 16;
const KEYBOARD_MODAL_GAP = 50;
const KEYBOARD_EXTRA_ROOM_PX = 50;
const NOTES_MIN_HEIGHT = 36;
const NEW_TODO_MODAL_RADIUS = 28;
const MODAL_CARD_SHADOW_STYLE = Platform.select({
  ios: {
    shadowColor: SHADOW_TOKENS.card.ios.shadowColor,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
  },
  android: {
    elevation: 18,
  },
});

export default function NewTodoScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [whenSelection, setWhenSelection] = useState<WhenSelection>({
    type: "none",
  });
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistDraft, setChecklistDraft] = useState("");
  const [isChecklistVisible, setIsChecklistVisible] = useState(false);
  const [isChecklistSurfaceActive, setIsChecklistSurfaceActive] =
    useState(false);
  const [armedDeleteChecklistItemId, setArmedDeleteChecklistItemId] = useState<
    string | null
  >(null);
  const [notesInputHeight, setNotesInputHeight] = useState(NOTES_MIN_HEIGHT);
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<
    string | null
  >(null);
  const [editingChecklistText, setEditingChecklistText] = useState("");
  const [selectedTagLabel] = useState<string | null>(null);
  const [isWhenModalOpen, setIsWhenModalOpen] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState<Date | null>(null);
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
  const [isNotesFocused, setIsNotesFocused] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [keyboardTopY, setKeyboardTopY] = useState(windowHeight);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [modalTopY, setModalTopY] = useState(0);
  const modalTheme = getThemeTokens(true);
  const modalTopBg = COLOR_TOKENS.dark["bg.modal"];
  const modalBottomBg = COLOR_TOKENS.dark["bg.popup"];
  const primaryTextColor = COLOR_TOKENS.dark["text.primary"];
  const secondaryTextColor = COLOR_TOKENS.dark["text.secondary"];
  const checkboxBorderColor = COLOR_TOKENS.dark["text.secondary"];
  const inboxColor = COLOR_TOKENS.dark["icon.inbox"];
  const inputBorderColor = COLOR_TOKENS.dark["btn.secondary"];
  const saveButtonBg = COLOR_TOKENS.light["primary.default"];
  const saveButtonTextColor = COLOR_TOKENS.light["bg.base"];
  const saveButtonBorderColor = COLOR_TOKENS.light["bg.base"];
  const backdropColor = COLOR_TOKENS.dark["bg.overlay"];
  const selectionColor = COLOR_TOKENS.light["primary.default"];
  const checklistActiveBg = COLOR_TOKENS.dark["btn.secondary"];
  const checklistDotColor = COLOR_TOKENS.dark["primary.default"];
  const canSave = title.trim().length > 0 && !isSaving;
  const titleInputRef = useRef<RNTextInput>(null);
  const checklistDraftInputRef = useRef<RNTextInput>(null);
  const checklistItemsRef = useRef<ChecklistItem[]>([]);
  const checklistItemInputRefs = useRef<Record<string, RNTextInput | null>>({});
  const editingChecklistTextRef = useRef("");
  const armedDeleteChecklistItemIdRef = useRef<string | null>(null);
  const skipChecklistBlurForItemIdRef = useRef<string | null>(null);
  const isOpeningChecklistRef = useRef(false);
  const ignoreChecklistOutsidePressUntilRef = useRef(0);
  const titleAutofocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isCollapsingChecklistRef = useRef(false);
  const isCalendarModalOpenRef = useRef(false);
  const checklistItemFocusTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>(
    [],
  );
  const modalCardRef = useRef<View>(null);
  const modalEntryY = useRef(
    new Animated.Value(MODAL_ENTRY_TRANSLATE_Y),
  ).current;
  const modalEntryOpacity = useRef(new Animated.Value(0)).current;
  const isCalendarModalOpen = isWhenModalOpen || isDeadlineModalOpen;

  const measureModalTop = () => {
    requestAnimationFrame(() => {
      modalCardRef.current?.measureInWindow((_, y) => {
        if (Number.isFinite(y)) {
          setModalTopY(Math.max(0, y));
        }
      });
    });
  };

  useEffect(() => {
    modalEntryY.setValue(MODAL_ENTRY_TRANSLATE_Y);
    modalEntryOpacity.setValue(0);

    if (titleAutofocusTimeoutRef.current) {
      clearTimeout(titleAutofocusTimeoutRef.current);
    }

    titleAutofocusTimeoutRef.current = setTimeout(() => {
      if (isCalendarModalOpenRef.current) {
        return;
      }

      titleInputRef.current?.focus();
    }, TITLE_AUTOFOCUS_DELAY_MS);

    Animated.parallel([
      Animated.spring(modalEntryY, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: false,
      }),
      Animated.timing(modalEntryOpacity, {
        toValue: 1,
        duration: Math.round(MODAL_ENTRY_DURATION_MS * 0.62),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    return () => {
      if (titleAutofocusTimeoutRef.current) {
        clearTimeout(titleAutofocusTimeoutRef.current);
        titleAutofocusTimeoutRef.current = null;
      }
    };
  }, [modalEntryOpacity, modalEntryY]);

  useEffect(() => {
    isCalendarModalOpenRef.current = isCalendarModalOpen;
  }, [isCalendarModalOpen]);

  useEffect(() => {
    checklistItemsRef.current = checklistItems;
  }, [checklistItems]);

  useEffect(() => {
    editingChecklistTextRef.current = editingChecklistText;
  }, [editingChecklistText]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      const keyboardScreenY = event.endCoordinates?.screenY;
      const nextKeyboardHeight = event.endCoordinates?.height ?? 0;
      const fallbackTop = windowHeight - nextKeyboardHeight;
      setKeyboardTopY(
        typeof keyboardScreenY === "number" && keyboardScreenY > 0
          ? keyboardScreenY
          : fallbackTop,
      );
      setKeyboardHeight(nextKeyboardHeight);
      measureModalTop();
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardTopY(windowHeight);
      setKeyboardHeight(0);
      measureModalTop();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [windowHeight]);

  useEffect(() => {
    setKeyboardTopY(windowHeight);
    setKeyboardHeight(0);
  }, [windowHeight]);

  useEffect(() => {
    armedDeleteChecklistItemIdRef.current = armedDeleteChecklistItemId;
  }, [armedDeleteChecklistItemId]);

  const openWhenModal = () => {
    if (titleAutofocusTimeoutRef.current) {
      clearTimeout(titleAutofocusTimeoutRef.current);
      titleAutofocusTimeoutRef.current = null;
    }

    isCalendarModalOpenRef.current = true;
    Keyboard.dismiss();
    setIsWhenModalOpen(true);
  };

  const closeWhenModal = () => {
    setIsWhenModalOpen(false);
  };

  const openDeadlineModal = () => {
    if (titleAutofocusTimeoutRef.current) {
      clearTimeout(titleAutofocusTimeoutRef.current);
      titleAutofocusTimeoutRef.current = null;
    }

    isCalendarModalOpenRef.current = true;
    Keyboard.dismiss();
    setIsDeadlineModalOpen(true);
  };

  const closeDeadlineModal = () => {
    setIsDeadlineModalOpen(false);
  };

  const closeModal = () => {
    Keyboard.dismiss();
    router.back();
  };

  const handleBackdropPress = () => {
    if (
      isChecklistSurfaceActive ||
      editingChecklistItemId !== null ||
      checklistDraft.trim().length > 0
    ) {
      collapseChecklist({ dismissKeyboard: true });
      return;
    }

    Keyboard.dismiss();
  };

  const handleToolbarIconPress = (action?: () => void) => {
    Keyboard.dismiss();
    setIsChecklistSurfaceActive(false);
    action?.();
  };

  const handleChecklistInputFocus = () => {
    ignoreChecklistOutsidePressUntilRef.current = Date.now() + 700;
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

  const createChecklistItemId = () =>
    `check-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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
    ignoreChecklistOutsidePressUntilRef.current = Date.now() + 700;
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
    ignoreChecklistOutsidePressUntilRef.current = Date.now() + 700;
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

  const createTodoWithOptions = async ({
    scheduledDate,
    deadlineDate,
    checklistItems,
    status,
  }: {
    scheduledDate?: Date | null;
    deadlineDate?: Date | null;
    checklistItems?: string[];
    status?: "new" | "someday";
  }) => {
    if (!title.trim()) {
      setErrorMessage("Enter a task title.");
      return false;
    }

    if (isSaving) {
      return false;
    }

    if (!isSupabaseConfigured) {
      setErrorMessage(
        "Supabase is not connected. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.",
      );
      return false;
    }

    setIsSaving(true);

    try {
      await createTodo({
        title: title.trim(),
        notes: notes.trim(),
        scheduledDate: scheduledDate ?? null,
        deadlineDate: deadlineDate ?? null,
        checklistItems: checklistItems ?? [],
        status,
      });
      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Couldn't save the task.",
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    const saveOptions: {
      scheduledDate?: Date | null;
      status?: "new" | "someday";
    } = (() => {
      if (whenSelection.type === "date") {
        return { scheduledDate: whenSelection.date, status: "new" };
      }

      if (whenSelection.type === "today") {
        return { scheduledDate: new Date(), status: "new" };
      }

      if (whenSelection.type === "someday") {
        return { scheduledDate: null, status: "someday" };
      }

      return { scheduledDate: null, status: "new" };
    })();

    const saved = await createTodoWithOptions({
      scheduledDate: saveOptions.scheduledDate ?? null,
      deadlineDate: deadlineDate ?? null,
      checklistItems: [
        ...checklistItemsRef.current.map((item) => item.text),
        checklistDraft.trim(),
      ]
        .map((text) => text.trim())
        .filter((text) => text.length > 0),
      status: saveOptions.status,
    });
    if (saved) {
      if (whenSelection.type === "someday") {
        router.replace({
          pathname: "/someday",
          params: { refresh: String(Date.now()) },
        });
        return;
      }

      if (
        whenSelection.type === "today" ||
        (whenSelection.type === "date" &&
          isSameDate(whenSelection.date, new Date()))
      ) {
        router.replace({
          pathname: "/today",
          params: { refresh: String(Date.now()) },
        });
        return;
      }

      if (whenSelection.type === "date") {
        router.replace({
          pathname: "/upcoming",
          params: { refresh: String(Date.now()) },
        });
        return;
      }

      router.replace({
        pathname: "/inbox",
        params: { refresh: String(Date.now()) },
      });
    }
  };

  const handleSelectWhenDate = (date: Date) => {
    setWhenSelection({ type: "date", date });
  };

  const handleSelectToday = () => {
    setWhenSelection({ type: "today" });
  };

  const handleSelectSomeday = () => {
    setWhenSelection({ type: "someday" });
  };

  const handleClearWhenSelection = () => {
    setWhenSelection({ type: "none" });
  };

  const handleSelectDeadlineDate = (date: Date) => {
    setDeadlineDate(date);
  };

  const handleClearDeadlineSelection = () => {
    setDeadlineDate(null);
  };

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
  const metadataDetailsClassName = shouldRenderChecklist
    ? "h-[78px] min-w-0 flex-1 justify-end pr-2 pb-0"
    : "h-[78px] min-w-0 flex-1 justify-end pr-2 pb-0";
  const metadataIconsClassName = shouldRenderChecklist
    ? "ml-2 h-[78px] shrink-0 flex-row items-end justify-end self-stretch pb-0"
    : "ml-2 h-[78px] shrink-0 flex-row items-end justify-end self-stretch pb-0";
  const fallbackModalTopY = modalTopY > 0 ? modalTopY : 72;
  const availableHeightByKeyboardTop =
    keyboardTopY - fallbackModalTopY - KEYBOARD_MODAL_GAP;
  const availableHeightByKeyboardHeight =
    windowHeight - keyboardHeight - fallbackModalTopY - KEYBOARD_MODAL_GAP;
  const availableHeightToKeyboard = Math.min(
    availableHeightByKeyboardTop,
    availableHeightByKeyboardHeight,
  );
  const modalMaxHeight =
    keyboardHeight > 0
      ? Math.max(0, availableHeightToKeyboard + KEYBOARD_EXTRA_ROOM_PX)
      : windowHeight * 0.82;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-transparent">
      <Pressable
        className="absolute inset-0"
        pointerEvents={isCalendarModalOpen ? "none" : "auto"}
        onPress={isCalendarModalOpen ? undefined : handleBackdropPress}
      >
        <View
          style={{ flex: 1, backgroundColor: backdropColor, opacity: 0.52 }}
        />
      </Pressable>

      <View
        pointerEvents={isCalendarModalOpen ? "none" : "auto"}
        className="flex-1 justify-start px-3"
      >
        <Animated.View
          className="self-stretch"
          style={[
            {
              opacity: modalEntryOpacity,
              transform: [{ translateY: modalEntryY as never }],
            },
          ]}
        >
          <View
            className="rounded-[28px]"
            ref={modalCardRef}
            onLayout={measureModalTop}
            style={[
              MODAL_CARD_SHADOW_STYLE,
              {
                maxHeight: modalMaxHeight,
                borderRadius: NEW_TODO_MODAL_RADIUS,
                overflow: "hidden",
              },
            ]}
          >
            <ScrollView
              className="shrink"
              style={{ backgroundColor: modalTopBg }}
              contentContainerStyle={{ paddingBottom: 2 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === "ios" ? "interactive" : "on-drag"
              }
            >
              <View className="flex-row items-center px-5 pt-4 pb-1">
                <View className="mr-2 h-6 w-6 items-center justify-center">
                  <View
                    className="bg-transparent"
                    style={{
                      width: SIZE_TOKENS.quickTaskCheckbox,
                      height: SIZE_TOKENS.quickTaskCheckbox,
                      borderRadius: RADIUS_TOKENS.xs,
                      borderWidth: 1,
                      borderColor: checkboxBorderColor,
                    }}
                  />
                </View>
                <AppTextInput
                  ref={titleInputRef}
                  value={title}
                  onChangeText={setTitle}
                  onFocus={() => {
                    collapseChecklist();
                  }}
                  editable={!isCalendarModalOpen}
                  placeholder="New Quick Task"
                  placeholderTextColor={secondaryTextColor}
                  variant="bodyMd"
                  style={[
                    {
                      flex: 1,
                      minHeight: 36,
                      backgroundColor: "transparent",
                      paddingHorizontal: 0,
                      paddingVertical: 0,
                    },
                    {
                      color: primaryTextColor,
                    },
                  ]}
                  selectionColor={selectionColor}
                  returnKeyType="next"
                />
                <View className="ml-3">
                  <ModalCircleButton
                    icon="close"
                    theme={modalTheme}
                    onPress={closeModal}
                  />
                </View>
              </View>

              <View className="px-5 pb-2">
                {errorMessage ? (
                  <Text
                    className="mb-2 font-regular text-label-sm leading-5"
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
                    editable={!isCalendarModalOpen}
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
                    style={[
                      {
                        minHeight: NOTES_MIN_HEIGHT,
                        height: notesInputHeight,
                        backgroundColor: "transparent",
                        paddingHorizontal: 0,
                        paddingTop: 6,
                        paddingBottom: 6,
                      },
                      {
                        color: primaryTextColor,
                      },
                    ]}
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
                      ignoreChecklistOutsidePressUntilRef.current =
                        Date.now() + 700;
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
                                    const previousText =
                                      editingChecklistTextRef.current;
                                    editingChecklistTextRef.current = nextText;
                                    setEditingChecklistText(nextText);
                                    setChecklistItemText(item.id, nextText);
                                    if (nextText.length === 0) {
                                      if (previousText.length === 0) {
                                        armedDeleteChecklistItemIdRef.current =
                                          item.id;
                                        setArmedDeleteChecklistItemId(item.id);
                                      } else {
                                        armedDeleteChecklistItemIdRef.current =
                                          item.id;
                                        setArmedDeleteChecklistItemId(item.id);
                                      }
                                      return;
                                    }

                                    armedDeleteChecklistItemIdRef.current = null;
                                    setArmedDeleteChecklistItemId(null);
                                  }}
                                  onKeyPress={(event) => {
                                    if (event.nativeEvent.key !== "Backspace")
                                      return;
                                    const currentItemText =
                                      checklistItemsRef.current.find(
                                        (entry) => entry.id === item.id,
                                      )?.text ?? "";
                                    if (currentItemText.length > 0) return;

                                    if (
                                      armedDeleteChecklistItemIdRef.current ===
                                      item.id
                                    ) {
                                      removeChecklistItem(item.id);
                                    } else {
                                      armedDeleteChecklistItemIdRef.current =
                                        item.id;
                                      setArmedDeleteChecklistItemId(item.id);
                                    }
                                  }}
                                  onFocus={handleChecklistInputFocus}
                                  onBlur={() => {
                                    if (
                                      skipChecklistBlurForItemIdRef.current ===
                                      item.id
                                    ) {
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
                                      armedDeleteChecklistItemIdRef.current =
                                        item.id;
                                      setArmedDeleteChecklistItemId(item.id);
                                      return;
                                    }

                                    clearChecklistEditingState();
                                    checklistDraftInputRef.current?.focus();
                                  }}
                                  editable={!isCalendarModalOpen}
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
                            editable={!isCalendarModalOpen}
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
                        onPress={openWhenModal}
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
                            selectedWhenDisplay.showIcon
                              ? "ml-2 font-semibold"
                              : "font-semibold"
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
                        className={`min-w-0 flex-row items-center pr-[10px] py-1 ${selectedWhenDisplay ? "mt-2" : ""}`}
                        onPress={openDeadlineModal}
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
                        onPress={openWhenModal}
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
                      <Icon
                        name="tag"
                        size={18}
                        color={secondaryTextColor}
                        weight="light"
                      />
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
                        onPress={openDeadlineModal}
                      >
                        <Icon
                          name="flag"
                          size={18}
                          color={secondaryTextColor}
                          weight="light"
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            </ScrollView>

            <View
              className="flex-row items-center justify-between border-t px-[14px] py-[10px]"
              style={{
                backgroundColor: modalBottomBg,
                borderTopColor: inputBorderColor,
                borderTopWidth: 0.5,
                borderBottomLeftRadius: NEW_TODO_MODAL_RADIUS,
                borderBottomRightRadius: NEW_TODO_MODAL_RADIUS,
                overflow: "hidden",
              }}
            >
              <View className="flex-row items-center">
                <Icon name="inbox" size={18} color={inboxColor} />
                <Text
                  className="ml-2 font-semibold text-label-sm"
                  style={{ color: primaryTextColor }}
                >
                  Quick Tasks
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => void handleSave()}
                disabled={!canSave}
                activeOpacity={0.82}
                className="h-9 min-w-24 items-center justify-center rounded-full border px-4"
                style={{
                  backgroundColor: saveButtonBg,
                  borderColor: saveButtonBorderColor,
                  borderWidth: 0.5,
                  opacity: canSave ? 1 : 0.45,
                }}
              >
                <Text
                  className="font-semibold text-label-sm"
                  style={{ color: saveButtonTextColor }}
                >
                  {isSaving ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>

      <WhenCalendarModal
        visible={isWhenModalOpen}
        onClose={closeWhenModal}
        onSelectDate={handleSelectWhenDate}
        onSelectToday={handleSelectToday}
        onSelectSomeday={handleSelectSomeday}
        onClearSelection={handleClearWhenSelection}
        selectedDate={whenSelection.type === "date" ? whenSelection.date : null}
        selectedWhen={whenSelection.type}
      />

      <WhenCalendarModal
        visible={isDeadlineModalOpen}
        mode="deadline"
        onClose={closeDeadlineModal}
        onSelectDate={handleSelectDeadlineDate}
        onClearSelection={handleClearDeadlineSelection}
        selectedDate={deadlineDate}
      />
    </SafeAreaView>
  );
}
