import { Icon, LIST_ICON_COLORS } from "@/components/Icon";
import { ModalCircleButton } from "@/components/ModalCircleButton";
import { TransparentModalShell } from "@/components/TransparentModalShell";
import { AppText as Text } from "@/components/ui";
import { COLOR_TOKENS, SHADOW_TOKENS } from "@/lib/design-system/tokens";
import { getThemeTokens } from "@/lib/theme";
import { useColorScheme } from "nativewind";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

type CalendarPage = "quick" | "detail";
type CalendarModalMode = "when" | "deadline";

const WEEKDAY_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;
const PAGE_SLIDE_MS = 520;
const CALENDAR_TODAY_STAR_SIZE = 20;
const TODAY_ROW_STAR_SIZE = 24;
const DETAIL_MAX_MONTHS = 36;
const DETAIL_DAY_CELL_HEIGHT = 34;
const DETAIL_WEEK_ROW_HORIZONTAL_PADDING = 0;
const DETAIL_WEEK_ROW_VERTICAL_PADDING = 1;
const DETAIL_WEEK_ROW_MARGIN = 2;
const DETAIL_SEPARATOR_STROKE = 2;
const DETAIL_SEPARATOR_RADIUS = 8;
const CLEAR_ACTION_COLOR = LIST_ICON_COLORS["--color-upcoming"];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfWeekMonday(date: Date) {
  const mondayIndex = (date.getDay() + 6) % 7;
  return addDays(dayStart(date), -mondayIndex);
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function toDateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

type DetailWeek = {
  key: string;
  days: Date[];
  boundaryAfterIndex: number | null;
  startsWithMonth: boolean;
};

function buildDetailWeeks(today: Date, lastLoadedMonthStart: Date) {
  const weekStart = startOfWeekMonday(today);
  const rangeEndWeekStart = startOfWeekMonday(endOfMonth(lastLoadedMonthStart));
  const weeks: DetailWeek[] = [];

  for (
    let cursor = weekStart;
    cursor.getTime() <= rangeEndWeekStart.getTime();
    cursor = addDays(cursor, 7)
  ) {
    const days = Array.from({ length: 7 }, (_, index) =>
      addDays(cursor, index),
    );
    let boundaryAfterIndex: number | null = null;

    for (let index = 0; index < 6; index += 1) {
      const current = days[index];
      const next = days[index + 1];
      if (
        current.getMonth() !== next.getMonth() ||
        current.getFullYear() !== next.getFullYear()
      ) {
        boundaryAfterIndex = index;
        break;
      }
    }

    weeks.push({
      key: `detail-week-${toDateKey(cursor)}`,
      days,
      boundaryAfterIndex,
      startsWithMonth:
        days[0].getDate() === 1 &&
        dayStart(days[0]).getTime() > today.getTime(),
    });
  }

  return weeks;
}

function buildMonthCells(monthStart: Date, todayKey: string) {
  const monthDays = daysInMonth(monthStart);
  const firstWeekdayIndex = (monthStart.getDay() + 6) % 7;
  const totalCells = firstWeekdayIndex + monthDays <= 35 ? 35 : 42;
  const prevMonthStart = addMonths(monthStart, -1);
  const prevMonthDays = daysInMonth(prevMonthStart);
  const cells: Array<{
    key: string;
    dayNumber: number;
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
  }> = [];

  for (let index = 0; index < totalCells; index += 1) {
    if (index < firstWeekdayIndex) {
      const dayNumber = prevMonthDays - firstWeekdayIndex + index + 1;
      const date = new Date(
        prevMonthStart.getFullYear(),
        prevMonthStart.getMonth(),
        dayNumber,
      );
      cells.push({
        key: `prev-${toDateKey(date)}`,
        dayNumber,
        date,
        isCurrentMonth: false,
        isToday: toDateKey(date) === todayKey,
      });
      continue;
    }

    if (index < firstWeekdayIndex + monthDays) {
      const dayNumber = index - firstWeekdayIndex + 1;
      const date = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth(),
        dayNumber,
      );
      cells.push({
        key: `curr-${toDateKey(date)}`,
        dayNumber,
        date,
        isCurrentMonth: true,
        isToday: toDateKey(date) === todayKey,
      });
      continue;
    }

    const dayNumber = index - (firstWeekdayIndex + monthDays) + 1;
    const nextMonthStart = addMonths(monthStart, 1);
    const date = new Date(
      nextMonthStart.getFullYear(),
      nextMonthStart.getMonth(),
      dayNumber,
    );
    cells.push({
      key: `next-${toDateKey(date)}`,
      dayNumber,
      date,
      isCurrentMonth: false,
      isToday: toDateKey(date) === todayKey,
    });
  }

  return cells;
}

interface WhenCalendarModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate?: (date: Date) => void;
  onSelectToday?: () => void;
  onSelectSomeday?: () => void;
  onClearSelection?: () => void;
  selectedDate?: Date | null;
  selectedWhen?: "none" | "date" | "today" | "someday";
  mode?: CalendarModalMode;
}

function MonthGrid({
  monthStart,
  minimumMonthStart,
  today,
  primaryText,
  secondaryText,
  selectedDateKey,
  selectionAccentColor,
  showTrailingChevron = false,
  onPressTrailingChevron,
  onSelectDate,
}: {
  monthStart: Date;
  minimumMonthStart: Date;
  today: Date;
  primaryText: string;
  secondaryText: string;
  selectedDateKey: string | null;
  selectionAccentColor: string;
  showTrailingChevron?: boolean;
  onPressTrailingChevron?: () => void;
  onSelectDate: (date: Date) => void;
}) {
  const todayKey = toDateKey(today);
  const cells = useMemo(
    () => buildMonthCells(monthStart, todayKey),
    [monthStart, todayKey],
  );
  const monthShortLabel = monthStart.toLocaleDateString("en-US", {
    month: "short",
  });
  const nextMonthStart = addMonths(monthStart, 1);
  const nextMonthShortLabel = nextMonthStart.toLocaleDateString("en-US", {
    month: "short",
  });
  const isMinimumMonth =
    monthStart.getFullYear() === minimumMonthStart.getFullYear() &&
    monthStart.getMonth() === minimumMonthStart.getMonth();
  const todayTime = today.getTime();
  const visibleCells = useMemo(() => {
    const weeks: (typeof cells)[] = [];
    for (let index = 0; index < cells.length; index += 7) {
      weeks.push(cells.slice(index, index + 7));
    }

    if (!isMinimumMonth) {
      return weeks.flat();
    }

    let firstVisibleWeekIndex = 0;
    while (
      firstVisibleWeekIndex < weeks.length &&
      weeks[firstVisibleWeekIndex].every(
        (cell) => dayStart(cell.date).getTime() < todayTime,
      )
    ) {
      firstVisibleWeekIndex += 1;
    }

    return weeks.slice(firstVisibleWeekIndex).flat();
  }, [cells, isMinimumMonth, todayTime]);

  return (
    <View>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((day) => (
          <View key={day} style={styles.weekdayCell}>
            <Text variant="tiny" style={{ color: secondaryText }}>
              {day}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.daysGrid}>
        {visibleCells.map((cell, index) => {
          const isToday = cell.isToday && cell.isCurrentMonth;
          const isSelectedDate =
            selectedDateKey !== null &&
            toDateKey(cell.date) === selectedDateKey;
          const isMonthFirstDay = cell.isCurrentMonth && cell.dayNumber === 1;
          const isNextMonthFirstDay =
            !cell.isCurrentMonth &&
            cell.dayNumber === 1 &&
            cell.date.getFullYear() === nextMonthStart.getFullYear() &&
            cell.date.getMonth() === nextMonthStart.getMonth();
          const isPastOnMinimumMonth =
            isMinimumMonth && dayStart(cell.date).getTime() < todayTime;
          const isChevronCell =
            showTrailingChevron && index === visibleCells.length - 1;

          if (isChevronCell) {
            return (
              <TouchableOpacity
                key={`${cell.key}-next`}
                activeOpacity={0.72}
                style={styles.dayCell}
                onPress={onPressTrailingChevron}
              >
                <Icon
                  name="chevronRight"
                  size={30}
                  color={secondaryText}
                  weight="light"
                />
              </TouchableOpacity>
            );
          }

          if (isPastOnMinimumMonth) {
            return <View key={`${cell.key}-hidden`} style={styles.dayCell} />;
          }

          return (
            <TouchableOpacity
              key={cell.key}
              activeOpacity={0.75}
              style={styles.dayCell}
              onPress={() => onSelectDate(cell.date)}
            >
              <View style={styles.dayContent}>
                {isMonthFirstDay || isNextMonthFirstDay ? (
                  !isSelectedDate ? (
                    <Text
                      variant="tiny"
                      style={{ color: secondaryText, opacity: 0.92 }}
                    >
                      {isMonthFirstDay ? monthShortLabel : nextMonthShortLabel}
                    </Text>
                  ) : null
                ) : null}

                {isSelectedDate ? (
                  <>
                    <View
                      style={[
                        styles.selectedDayCircle,
                        { borderColor: selectionAccentColor },
                      ]}
                    >
                      <Text
                        variant="tiny"
                        style={{
                          color: secondaryText,
                          opacity: 0.96,
                          lineHeight: 9,
                        }}
                      >
                        {cell.date.toLocaleDateString("en-US", {
                          month: "short",
                        })}
                      </Text>
                      <Text
                        variant="tiny"
                        style={[
                          styles.selectedDayCircleText,
                          { color: primaryText },
                        ]}
                      >
                        {cell.dayNumber}
                      </Text>
                    </View>
                  </>
                ) : isToday ? (
                  <Icon
                    name="today"
                    size={CALENDAR_TODAY_STAR_SIZE}
                    color={secondaryText}
                    weight="light"
                  />
                ) : (
                  <Text
                    variant="bodyMd"
                    style={{
                      color: cell.isCurrentMonth ? primaryText : secondaryText,
                      opacity: cell.isCurrentMonth ? 1 : 0.44,
                    }}
                  >
                    {cell.dayNumber}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function DetailWeeksGrid({
  weeks,
  today,
  borderColor,
  primaryText,
  secondaryText,
  selectedDateKey,
  selectionAccentColor,
  onSelectDate,
  listVersion,
}: {
  weeks: DetailWeek[];
  today: Date;
  borderColor: string;
  primaryText: string;
  secondaryText: string;
  selectedDateKey: string | null;
  selectionAccentColor: string;
  onSelectDate: (date: Date) => void;
  listVersion: number;
}) {
  const todayTime = today.getTime();
  const starColor = secondaryText;
  const [detailGridWidth, setDetailGridWidth] = useState(0);
  const detailSeparatorWidth = Math.max(
    detailGridWidth - DETAIL_WEEK_ROW_HORIZONTAL_PADDING * 2,
    0,
  );
  const detailSeparatorOutset = DETAIL_WEEK_ROW_MARGIN;
  const detailSeparatorHeight =
    DETAIL_DAY_CELL_HEIGHT +
    DETAIL_WEEK_ROW_VERTICAL_PADDING * 2 +
    detailSeparatorOutset * 2;
  const separatorTopY = DETAIL_SEPARATOR_STROKE / 2;
  const separatorBottomY = detailSeparatorHeight - DETAIL_SEPARATOR_STROKE / 2;

  const onDetailGridLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (!nextWidth || Math.abs(nextWidth - detailGridWidth) < 0.5) {
      return;
    }

    setDetailGridWidth(nextWidth);
  }, [detailGridWidth]);

  const detailWeekRowHeight =
    DETAIL_DAY_CELL_HEIGHT +
    DETAIL_WEEK_ROW_VERTICAL_PADDING * 2 +
    DETAIL_WEEK_ROW_MARGIN * 2;
  const keyExtractor = useCallback((week: DetailWeek) => week.key, []);
  const getItemLayout = useCallback(
    (_: ArrayLike<DetailWeek> | null | undefined, index: number) => ({
      length: detailWeekRowHeight,
      offset: detailWeekRowHeight * index,
      index,
    }),
    [detailWeekRowHeight],
  );

  const renderDetailWeek = useCallback(
    ({ item: week }: { item: DetailWeek }) => {
      const leftCells =
        week.boundaryAfterIndex === null ? null : week.boundaryAfterIndex + 1;
      const rightCells = leftCells === null ? null : 7 - leftCells;

      return (
        <View style={styles.detailWeekRow}>
          {week.startsWithMonth ? (
            <View
              pointerEvents="none"
              style={[
                styles.detailSeparatorTop,
                { backgroundColor: borderColor },
              ]}
            />
          ) : null}

          {leftCells !== null && rightCells !== null ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {detailSeparatorWidth > 0 ? (
                <Svg
                  width={detailSeparatorWidth}
                  height={detailSeparatorHeight}
                  style={[
                    styles.detailSeparatorSvg,
                    { top: -detailSeparatorOutset },
                  ]}
                >
                  <Path
                    d={(() => {
                      const splitX = (leftCells / 7) * detailSeparatorWidth;
                      const radius = Math.min(
                        DETAIL_SEPARATOR_RADIUS,
                        splitX,
                        detailSeparatorWidth - splitX,
                        (separatorBottomY - separatorTopY) / 2,
                      );

                      return `M 0 ${separatorBottomY} H ${Math.max(
                        splitX - radius,
                        0,
                      )} Q ${splitX} ${separatorBottomY} ${splitX} ${Math.max(
                        separatorBottomY - radius,
                        separatorTopY,
                      )} V ${Math.min(
                        separatorTopY + radius,
                        separatorBottomY,
                      )} Q ${splitX} ${separatorTopY} ${Math.min(
                        splitX + radius,
                        detailSeparatorWidth,
                      )} ${separatorTopY} H ${detailSeparatorWidth}`;
                    })()}
                    fill="none"
                    stroke={borderColor}
                    strokeWidth={DETAIL_SEPARATOR_STROKE}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </Svg>
              ) : null}
            </View>
          ) : null}

          {week.days.map((date) => {
            const dateTime = dayStart(date).getTime();
            const isPast = dateTime < todayTime;
            const isToday = isSameDay(date, today);
            const isSelectedDate =
              selectedDateKey !== null && toDateKey(date) === selectedDateKey;
            const showMonthLabel = date.getDate() === 1 && !isPast;

            if (isPast) {
              return <View key={`hidden-${toDateKey(date)}`} style={styles.dayCell} />;
            }

            return (
              <TouchableOpacity
                key={toDateKey(date)}
                activeOpacity={0.75}
                style={styles.dayCell}
                onPress={() => onSelectDate(date)}
              >
                <View style={styles.dayContent}>
                  {showMonthLabel || isSelectedDate ? (
                    <Text variant="tiny" style={{ color: secondaryText, opacity: 0.92 }}>
                      {date.toLocaleDateString("en-US", { month: "short" })}
                    </Text>
                  ) : null}

                  {isSelectedDate ? (
                    <View
                      style={[
                        styles.selectedDayCircle,
                        { borderColor: selectionAccentColor },
                      ]}
                    >
                      <Text
                        variant="tiny"
                        style={{
                          color: secondaryText,
                          opacity: 0.96,
                          lineHeight: 9,
                        }}
                      >
                        {date.toLocaleDateString("en-US", { month: "short" })}
                      </Text>
                      <Text
                        variant="tiny"
                        style={[styles.selectedDayCircleText, { color: primaryText }]}
                      >
                        {date.getDate()}
                      </Text>
                    </View>
                  ) : isToday ? (
                    <Icon
                      name="today"
                      size={CALENDAR_TODAY_STAR_SIZE}
                      color={starColor}
                      weight="light"
                    />
                  ) : (
                    <Text
                      variant="bodyMd"
                      style={{
                        color: primaryText,
                      }}
                    >
                      {date.getDate()}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    },
    [
      borderColor,
      detailSeparatorHeight,
      detailSeparatorOutset,
      detailSeparatorWidth,
      onSelectDate,
      primaryText,
      secondaryText,
      selectedDateKey,
      selectionAccentColor,
      separatorBottomY,
      separatorTopY,
      starColor,
      today,
      todayTime,
    ],
  );

  return (
    <View style={styles.detailGrid} onLayout={onDetailGridLayout}>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((day) => (
          <View key={day} style={styles.weekdayCell}>
            <Text variant="tiny" style={{ color: secondaryText }}>
              {day}
            </Text>
          </View>
        ))}
      </View>

      <FlatList
        key={`detail-weeks-${listVersion}`}
        data={weeks}
        keyExtractor={keyExtractor}
        style={styles.detailWeeksList}
        contentContainerStyle={styles.detailWeeksListContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={40}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
        getItemLayout={getItemLayout}
        renderItem={renderDetailWeek}
      />
    </View>
  );
}

export default function WhenCalendarModal({
  visible,
  onClose,
  onSelectDate,
  onSelectToday,
  onSelectSomeday,
  onClearSelection,
  selectedDate,
  selectedWhen = "none",
  mode = "when",
}: WhenCalendarModalProps) {
  const isDeadlineMode = mode === "deadline";
  const today = useMemo(() => dayStart(new Date()), []);
  const minimumMonthStart = useMemo(() => startOfMonth(today), [today]);
  const detailLastMonthStart = useMemo(
    () => addMonths(minimumMonthStart, DETAIL_MAX_MONTHS - 1),
    [minimumMonthStart],
  );
  const [page, setPage] = useState<CalendarPage>(
    isDeadlineMode ? "detail" : "quick",
  );
  const [pageWidth, setPageWidth] = useState(0);
  const [detailListVersion, setDetailListVersion] = useState(0);
  const pageSlide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setPage(isDeadlineMode ? "detail" : "quick");
      setDetailListVersion(0);
      pageSlide.setValue(isDeadlineMode ? 1 : 0);
      return;
    }

    if (isDeadlineMode) {
      setPage("detail");
      setDetailListVersion((current) => current + 1);
      pageSlide.setValue(1);
    } else {
      setPage("quick");
      pageSlide.setValue(0);
    }
  }, [isDeadlineMode, pageSlide, visible]);

  useEffect(() => {
    Animated.timing(pageSlide, {
      toValue: page === "quick" ? 0 : 1,
      duration: PAGE_SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [page, pageSlide]);

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colorMode = isDark ? "dark" : "light";
  const colors = COLOR_TOKENS[colorMode];
  const theme = getThemeTokens(isDark);
  const modalBg = isDark
    ? COLOR_TOKENS.dark["bg.input"]
    : COLOR_TOKENS.light["bg.modal"];
  const borderColor = isDark
    ? COLOR_TOKENS.dark["btn.secondary"]
    : COLOR_TOKENS.light["border.default"];
  const primaryText = colors["text.primary"];
  const secondaryText = colors["text.secondary"];
  const headerTitleColor = isDark
    ? COLOR_TOKENS.light["bg.modal"]
    : primaryText;
  const selectionAccentColor = COLOR_TOKENS.light["primary.default"];
  const selectedDateKey = useMemo(() => {
    if (!selectedDate) {
      return null;
    }

    if (!isDeadlineMode && selectedWhen !== "date") {
      return null;
    }

    return toDateKey(dayStart(selectedDate));
  }, [isDeadlineMode, selectedDate, selectedWhen]);
  const isTodaySelected = selectedWhen === "today";
  const isSomedaySelected = selectedWhen === "someday";
  const canClearSelection = selectedWhen !== "none";
  const canClearDeadlineSelection = isDeadlineMode && selectedDateKey !== null;

  const pageTranslateX =
    pageWidth > 0
      ? pageSlide.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -pageWidth],
        })
      : 0;
  const detailWeeks = useMemo(() => {
    return buildDetailWeeks(today, detailLastMonthStart);
  }, [detailLastMonthStart, today]);

  const openDetailPage = useCallback(() => {
    if (page === "detail") {
      return;
    }

    setPage("detail");
    setDetailListVersion((current) => current + 1);
  }, [page]);

  const closeDetailPage = useCallback(() => {
    if (page !== "detail") {
      return;
    }

    setPage("quick");
  }, [page]);

  const onPageViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (!width || width === pageWidth) {
      return;
    }

    setPageWidth(width);
  }, [pageWidth]);

  const handleSelectDate = useCallback((date: Date) => {
    onSelectDate?.(dayStart(date));
    onClose();
  }, [onClose, onSelectDate]);

  const handleSelectToday = useCallback(() => {
    onSelectToday?.();
    onClose();
  }, [onClose, onSelectToday]);

  const handleClearSelection = useCallback(() => {
    onClearSelection?.();
    onClose();
  }, [onClearSelection, onClose]);

  return (
    <View
      pointerEvents={visible ? "auto" : "none"}
      style={StyleSheet.absoluteFill}
    >
      <TransparentModalShell
        visible={visible}
        contentStyle={[
          styles.modalWindow,
          styles.modalWindowShadow,
          {
            borderColor,
            backgroundColor: modalBg,
          },
        ]}
        overlayStyle={styles.overlay}
        backdropColor={COLOR_TOKENS.dark["bg.overlay"]}
        backdropOpacity={isDark ? 0.64 : 0.4}
      >
        <View style={styles.header}>
          {page === "detail" && !isDeadlineMode ? (
            <View style={styles.headerLeftButton}>
              <ModalCircleButton
                icon="chevronLeft"
                theme={theme}
                onPress={closeDetailPage}
              />
            </View>
          ) : null}
          <Text
            variant="bodyLg"
            style={[styles.headerTitle, { color: headerTitleColor }]}
          >
            {isDeadlineMode ? "Deadline" : "When?"}
          </Text>
          <View style={styles.headerRightButton}>
            <ModalCircleButton icon="close" theme={theme} onPress={onClose} />
          </View>
        </View>

        <View style={styles.pagesViewport} onLayout={onPageViewportLayout}>
          {pageWidth > 0 && !isDeadlineMode ? (
            <Animated.View
              style={[
                styles.pagesTrack,
                {
                  width: pageWidth * 2,
                  transform: [{ translateX: pageTranslateX as never }],
                },
              ]}
            >
              <View style={[styles.quickPage, { width: pageWidth }]}>
                <TouchableOpacity
                  activeOpacity={0.78}
                  style={styles.todayRow}
                  onPress={handleSelectToday}
                >
                  <View style={styles.rowLabelContent}>
                    <Icon
                      name="today"
                      size={TODAY_ROW_STAR_SIZE}
                      color="var(--color-today)"
                      weight="light"
                    />
                    <Text
                      className="ml-2 font-semibold"
                      variant="labelSm"
                      style={{ color: primaryText }}
                    >
                      Today
                    </Text>
                  </View>
                  {isTodaySelected ? (
                    <Icon
                      name="check"
                      size={18}
                      color={selectionAccentColor}
                      weight="medium"
                    />
                  ) : null}
                </TouchableOpacity>

                <View style={styles.quickCalendarWrap}>
                  <MonthGrid
                    monthStart={minimumMonthStart}
                    minimumMonthStart={minimumMonthStart}
                    today={today}
                    primaryText={primaryText}
                    secondaryText={secondaryText}
                    selectedDateKey={selectedDateKey}
                    selectionAccentColor={selectionAccentColor}
                    showTrailingChevron
                    onPressTrailingChevron={openDetailPage}
                    onSelectDate={handleSelectDate}
                  />
                </View>

                <TouchableOpacity
                  activeOpacity={0.78}
                  style={styles.somedayRow}
                  onPress={() => {
                    onSelectSomeday?.();
                    onClose();
                  }}
                >
                  <View style={styles.rowLabelContent}>
                    <Icon
                      name="someday"
                      size={TODAY_ROW_STAR_SIZE}
                      color="var(--color-someday)"
                      weight="light"
                    />
                    <Text
                      className="ml-2 font-semibold"
                      variant="labelSm"
                      style={{ color: primaryText }}
                    >
                      Someday
                    </Text>
                  </View>
                  {isSomedaySelected ? (
                    <Icon
                      name="check"
                      size={18}
                      color={selectionAccentColor}
                      weight="medium"
                    />
                  ) : null}
                </TouchableOpacity>

                {canClearSelection ? (
                  <View style={styles.quickPageFooter}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.clearButton}
                      onPress={handleClearSelection}
                    >
                      <Text variant="labelSm" style={styles.clearButtonText}>
                        Clear
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>

              <View style={{ width: pageWidth, flex: 1 }}>
                <DetailWeeksGrid
                  weeks={detailWeeks}
                  today={today}
                  borderColor={borderColor}
                  primaryText={primaryText}
                  secondaryText={secondaryText}
                  selectedDateKey={selectedDateKey}
                  selectionAccentColor={selectionAccentColor}
                  onSelectDate={handleSelectDate}
                  listVersion={detailListVersion}
                />
              </View>
            </Animated.View>
          ) : pageWidth > 0 ? (
            <View style={{ width: pageWidth, flex: 1 }}>
              <DetailWeeksGrid
                weeks={detailWeeks}
                today={today}
                borderColor={borderColor}
                primaryText={primaryText}
                secondaryText={secondaryText}
                selectedDateKey={selectedDateKey}
                selectionAccentColor={selectionAccentColor}
                onSelectDate={handleSelectDate}
                listVersion={detailListVersion}
              />

              {canClearDeadlineSelection ? (
                <View pointerEvents="box-none" style={styles.deadlineClearOverlay}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.clearButton}
                    onPress={handleClearSelection}
                  >
                    <Text variant="labelSm" style={styles.clearButtonText}>
                      Clear
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </TransparentModalShell>
    </View>
  );
}

const styles = StyleSheet.create({
  clearButton: {
    alignSelf: "stretch",
    height: 40,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: CLEAR_ACTION_COLOR,
    backgroundColor: CLEAR_ACTION_COLOR,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    marginTop: 8,
    marginHorizontal: 16,
    paddingHorizontal: 16,
  },
  clearButtonText: {
    color: COLOR_TOKENS.light["bg.base"],
    fontFamily: "Inter-Medium",
  },
  dayCell: {
    width: "14.285%",
    height: DETAIL_DAY_CELL_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  dayContent: {
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingTop: 4,
    paddingHorizontal: 2,
  },
  detailSeparatorTop: {
    position: "absolute",
    top: -DETAIL_WEEK_ROW_MARGIN,
    left: 0,
    right: 0,
    height: DETAIL_SEPARATOR_STROKE,
    borderRadius: 0,
  },
  detailSeparatorSvg: {
    position: "absolute",
    left: DETAIL_WEEK_ROW_HORIZONTAL_PADDING,
  },
  detailGrid: {
    flex: 1,
  },
  detailWeekRow: {
    position: "relative",
    flexDirection: "row",
    paddingHorizontal: DETAIL_WEEK_ROW_HORIZONTAL_PADDING,
    paddingVertical: DETAIL_WEEK_ROW_VERTICAL_PADDING,
    marginTop: DETAIL_WEEK_ROW_MARGIN,
    marginBottom: DETAIL_WEEK_ROW_MARGIN,
  },
  detailWeeksList: {
    flex: 1,
  },
  detailWeeksListContent: {
    paddingTop: 2,
    paddingBottom: 64,
  },
  deadlineClearOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 6,
  },
  header: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    marginTop: 6,
  },
  headerLeftButton: {
    position: "absolute",
    top: 8,
    left: 16,
  },
  headerRightButton: {
    position: "absolute",
    top: 8,
    right: 16,
  },
  headerTitle: {
    textAlign: "center",
  },
  modalWindow: {
    width: "85%",
    height: "60%",
    borderWidth: 0.5,
    borderRadius: 28,
    overflow: "hidden",
    paddingBottom: 14,
  },
  modalWindowShadow: {
    ...Platform.select({
      ios: {
        ...SHADOW_TOKENS.card.ios,
      },
      android: {
        elevation: SHADOW_TOKENS.card.android.elevation,
      },
    }),
  },
  overlay: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  pagesTrack: {
    flexDirection: "row",
    flex: 1,
  },
  pagesViewport: {
    flex: 1,
    overflow: "hidden",
  },
  quickPage: {
    flex: 1,
  },
  quickCalendarWrap: {
    marginTop: 4,
    paddingHorizontal: 10,
  },
  quickPageFooter: {
    marginTop: "auto",
  },
  rowLabelContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectedDayCircle: {
    marginTop: 1,
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingTop: 0,
  },
  selectedDayCircleText: {
    lineHeight: 12,
  },
  somedayRow: {
    marginTop: 10,
    marginLeft: 16,
    marginRight: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  todayRow: {
    marginLeft: 16,
    marginTop: 16,
    marginBottom: 16,
    marginRight: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weekdayCell: {
    width: "14.285%",
    alignItems: "center",
    justifyContent: "center",
  },
  weekdayRow: {
    flexDirection: "row",
    paddingHorizontal: 2,
  },
});
