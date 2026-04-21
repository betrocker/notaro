import AsyncStorage from "@react-native-async-storage/async-storage";
import type { IconName } from "@/components/Icon";

const QUICK_FIND_RECENTS_KEY = "@quick_find_recent_links";
const QUICK_FIND_MAX_RECENTS = 4;

type QuickFindLinkConfig = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: IconName;
  iconColor: string;
  keywords: string[];
};

export type QuickFindLink = Omit<QuickFindLinkConfig, "keywords">;

const QUICK_FIND_LINKS_CONFIG: QuickFindLinkConfig[] = [
  {
    id: "home",
    title: "Home",
    subtitle: "Overview",
    href: "/",
    icon: "home",
    iconColor: "var(--color-muted)",
    keywords: ["home", "overview", "dashboard"],
  },
  {
    id: "projects",
    title: "Projects",
    subtitle: "All projects",
    href: "/jobs",
    icon: "project",
    iconColor: "var(--color-today)",
    keywords: ["projects", "jobs", "work"],
  },
  {
    id: "clients",
    title: "Clients",
    subtitle: "Client list",
    href: "/clients-home",
    icon: "client",
    iconColor: "var(--color-logbook)",
    keywords: ["clients", "people", "contacts"],
  },
  {
    id: "invoices",
    title: "Invoices",
    subtitle: "Billing overview",
    href: "/invoices",
    icon: "dollar",
    iconColor: "var(--color-inbox)",
    keywords: ["invoices", "billing", "payments", "money"],
  },
  {
    id: "today",
    title: "Today",
    subtitle: "Today tasks",
    href: "/today",
    icon: "today",
    iconColor: "var(--color-today)",
    keywords: ["today", "tasks", "current"],
  },
  {
    id: "quick-tasks",
    title: "Quick Tasks",
    subtitle: "Inbox",
    href: "/inbox",
    icon: "inbox",
    iconColor: "var(--color-inbox)",
    keywords: ["quick", "tasks", "inbox"],
  },
  {
    id: "upcoming",
    title: "Upcoming",
    subtitle: "Scheduled tasks",
    href: "/upcoming",
    icon: "upcoming",
    iconColor: "var(--color-upcoming)",
    keywords: ["upcoming", "schedule", "calendar"],
  },
  {
    id: "logbook",
    title: "Logbook",
    subtitle: "Completed tasks",
    href: "/logbook",
    icon: "logbook",
    iconColor: "var(--color-logbook)",
    keywords: ["logbook", "completed", "history"],
  },
];

const QUICK_FIND_LINKS: QuickFindLink[] = QUICK_FIND_LINKS_CONFIG.map(
  ({ keywords: _keywords, ...link }) => link,
);
const LINK_BY_HREF = new Map(QUICK_FIND_LINKS.map((link) => [link.href, link]));

function resolveQuickFindHrefFromSegment(segment: string | undefined): string | null {
  if (!segment || segment === "index") {
    return "/";
  }

  switch (segment) {
    case "jobs":
    case "job":
    case "project":
      return "/jobs";
    case "clients-home":
    case "clients":
      return "/clients-home";
    case "today":
      return "/today";
    case "inbox":
      return "/inbox";
    case "invoices":
      return "/invoices";
    case "upcoming":
      return "/upcoming";
    case "logbook":
      return "/logbook";
    default:
      return null;
  }
}

function toStoredRecents(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function getQuickFindLinks() {
  return QUICK_FIND_LINKS;
}

export function searchQuickFindLinks(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return QUICK_FIND_LINKS;
  }

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return QUICK_FIND_LINKS;
  }

  return QUICK_FIND_LINKS_CONFIG.filter((link) => {
    const searchSpace = `${link.title} ${link.subtitle} ${link.keywords.join(" ")}`.toLowerCase();
    return terms.every((term) => searchSpace.includes(term));
  }).map(({ keywords: _keywords, ...result }) => result);
}

export async function loadQuickFindRecents() {
  try {
    const raw = await AsyncStorage.getItem(QUICK_FIND_RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const hrefs = toStoredRecents(parsed).slice(0, QUICK_FIND_MAX_RECENTS);
    return hrefs
      .map((href) => LINK_BY_HREF.get(href) ?? null)
      .filter((entry): entry is QuickFindLink => Boolean(entry));
  } catch {
    return [];
  }
}

export async function recordQuickFindRecent(href: string) {
  if (!LINK_BY_HREF.has(href)) {
    return;
  }

  try {
    const raw = await AsyncStorage.getItem(QUICK_FIND_RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const current = toStoredRecents(parsed);
    const next = [href, ...current.filter((item) => item !== href)].slice(
      0,
      QUICK_FIND_MAX_RECENTS,
    );
    await AsyncStorage.setItem(QUICK_FIND_RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Ignore persistence failures for best-effort recents.
  }
}

export async function recordQuickFindRecentBySegment(segment: string | undefined) {
  const href = resolveQuickFindHrefFromSegment(segment);
  if (!href) {
    return;
  }

  await recordQuickFindRecent(href);
}
