import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import { useColorScheme } from "nativewind";
import { Platform } from "react-native";
import { COLOR_TOKENS } from "@/lib/design-system/tokens";

const ICON_MAP = {
  inbox: {
    ios: "tray.fill",
    android: "inbox",
  },
  today: {
    ios: "star.fill",
    android: "star",
  },
  sun: {
    ios: "sun.max.fill",
    android: "white-balance-sunny",
  },
  upcoming: {
    ios: "calendar",
    android: "calendar-blank",
  },
  anytime: {
    ios: "square.grid.2x2.fill",
    android: "view-grid",
  },
  someday: {
    ios: "archivebox.fill",
    android: "archive",
  },
  logbook: {
    ios: "book.closed.fill",
    android: "book",
  },
  plus: {
    ios: "plus.circle.fill",
    android: "plus-circle",
  },
  plusfab: {
    ios: "plus",
    android: "plus",
  },
  check: {
    ios: "checkmark",
    android: "check",
  },
  area: {
    ios: "square.stack.3d.up.fill",
    android: "layers",
  },
  project: {
    ios: "folder.fill",
    android: "folder-outline",
  },
  todo: {
    ios: "circle",
    android: "checkbox-blank-circle-outline",
  },
  close: {
    ios: "xmark",
    android: "close",
  },
  gear: {
    ios: "gear",
    android: "cog",
  },
  sliders: {
    ios: "slider.horizontal.3",
    android: "tune-variant",
  },
  search: {
    ios: "magnifyingglass",
    android: "magnify",
  },
  chevronLeft: {
    ios: "chevron.left",
    android: "chevron-left",
  },
  chevronRight: {
    ios: "chevron.right",
    android: "chevron-right",
  },
  cloud: {
    ios: "icloud.fill",
    android: "cloud",
  },
  clipboard: {
    ios: "clipboard.fill",
    android: "clipboard-text-outline",
  },
  zap: {
    ios: "bolt.fill",
    android: "flash-outline",
  },
  chevronsRight: {
    ios: "chevron.forward.2",
    android: "chevron-double-right",
  },
  checkCircle: {
    ios: "checkmark.circle.fill",
    android: "check-circle-outline",
  },
  appearance: {
    ios: "circle.lefthalf.filled",
    android: "theme-light-dark",
  },
  general: {
    ios: "gearshape.fill",
    android: "cog",
  },
  tag: {
    ios: "tag",
    android: "tag",
  },
  ellipsis: {
    ios: "ellipsis.circle",
    android: "dots-horizontal-circle-outline",
  },
  ellipsisPlain: {
    ios: "ellipsis",
    android: "dots-horizontal",
  },
  share: {
    ios: "square.and.arrow.up",
    android: "share-variant",
  },
  key: {
    ios: "key",
    android: "key-variant",
  },
  duplicate: {
    ios: "plus.square.on.square",
    android: "content-copy",
  },
  trash: {
    ios: "trash",
    android: "delete",
  },
  eye: {
    ios: "eye",
    android: "eye-outline",
  },
  eyeOff: {
    ios: "eye.slash",
    android: "eye-off-outline",
  },
} as const;

export type IconName = keyof typeof ICON_MAP;

interface IconProps {
  name: IconName;
  color: string;
  size?: number;
  className?: string;
  weight?:
    | "ultraLight"
    | "thin"
    | "light"
    | "regular"
    | "medium"
    | "semibold"
    | "bold"
    | "heavy"
    | "black";
}

const LIST_ICON_COLORS = {
  "--color-today": "#fdd92b",
  "--color-upcoming": "#d63d6b",
  "--color-anytime": "#4eb2a8",
  "--color-someday": "#d0c38c",
  "--color-logbook": "#4cbf60",
} as const;

const LIGHT_THEME_COLORS = {
  ...LIST_ICON_COLORS,
  "--color-inbox": COLOR_TOKENS.light["icon.inbox"],
  "--color-bg": COLOR_TOKENS.light["bg.base"],
  "--color-card": COLOR_TOKENS.light["bg.modal"],
  "--color-sidebar": COLOR_TOKENS.light["bg.modal"],
  "--color-text": COLOR_TOKENS.light["text.primary"],
  "--color-muted": COLOR_TOKENS.light["text.secondary"],
  "--color-border": COLOR_TOKENS.light["border.default"],
  "--color-tag": COLOR_TOKENS.light["bg.input"],
  "--color-checkbox": COLOR_TOKENS.light["border.default"],
  "--color-auth-action-bg": COLOR_TOKENS.light["primary.default"],
  "--color-auth-action-text": COLOR_TOKENS.light["bg.base"],
} as const;

const DARK_THEME_COLORS = {
  ...LIGHT_THEME_COLORS,
  "--color-inbox": COLOR_TOKENS.dark["icon.inbox"],
  "--color-bg": COLOR_TOKENS.dark["bg.base"],
  "--color-card": COLOR_TOKENS.dark["bg.modal"],
  "--color-sidebar": COLOR_TOKENS.dark["bg.modal"],
  "--color-text": COLOR_TOKENS.dark["text.primary"],
  "--color-muted": COLOR_TOKENS.dark["text.secondary"],
  "--color-border": COLOR_TOKENS.dark["border.default"],
  "--color-tag": COLOR_TOKENS.dark["bg.input"],
  "--color-checkbox": COLOR_TOKENS.dark["border.default"],
  "--color-auth-action-bg": COLOR_TOKENS.dark["primary.default"],
  "--color-auth-action-text": COLOR_TOKENS.dark["bg.base"],
} as const;

function resolveColorToken(
  color: string,
  scheme: "light" | "dark" | "system" | undefined,
) {
  const match = color.match(/^var\((--[^)]+)\)$/);

  if (!match) {
    return color;
  }

  const token = match[1] as keyof typeof LIGHT_THEME_COLORS;
  const palette = scheme === "dark" ? DARK_THEME_COLORS : LIGHT_THEME_COLORS;

  return palette[token] ?? color;
}

export function Icon({
  name,
  color,
  size = 24,
  className,
  weight,
}: IconProps) {
  const mapping = ICON_MAP[name];
  const { colorScheme } = useColorScheme();
  const resolvedColor = resolveColorToken(color, colorScheme);

  if (Platform.OS === "ios") {
    return (
      <SymbolView
        name={mapping.ios as never}
        tintColor={resolvedColor}
        weight={weight as never}
        resizeMode="scaleAspectFit"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <MaterialCommunityIcons
      name={mapping.android as never}
      size={size}
      color={resolvedColor}
      className={className}
    />
  );
}
