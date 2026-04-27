import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "@/lib/supabase";

export type ReminderStatus = "active" | "done" | "dismissed";

export type ReminderItem = {
  id: string;
  title: string;
  note: string | null;
  remindAt: string;
  jobId: string | null;
  jobTitle: string | null;
  clientName: string | null;
  status: ReminderStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type ReminderCreateInput = {
  title?: string | null;
  note?: string | null;
  remindAt: Date;
  jobId?: string | null;
  jobTitle?: string | null;
  clientName?: string | null;
};

type ReminderUpdateInput = {
  title?: string | null;
  note?: string | null;
  remindAt?: Date;
  jobId?: string | null;
  jobTitle?: string | null;
  clientName?: string | null;
};

const REMINDERS_STORAGE_PREFIX = "@notaro/reminders/v1";

function normalizeTitle(value: string | null | undefined) {
  const next = value?.trim() ?? "";
  return next.length > 0 ? next : "Reminder";
}

function normalizeOptionalText(value: string | null | undefined) {
  const next = value?.trim() ?? "";
  return next.length > 0 ? next : null;
}

function sortByRemindAtAsc(left: ReminderItem, right: ReminderItem) {
  const leftTimestamp = Date.parse(left.remindAt);
  const rightTimestamp = Date.parse(right.remindAt);

  if (leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }

  return left.createdAt.localeCompare(right.createdAt, "sr");
}

function normalizeReminderRecord(value: unknown): ReminderItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Partial<ReminderItem>;
  const id = typeof record.id === "string" ? record.id : null;
  const remindAt = typeof record.remindAt === "string" ? record.remindAt : null;
  const createdAt = typeof record.createdAt === "string" ? record.createdAt : null;
  const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : null;

  if (!id || !remindAt || !createdAt || !updatedAt) {
    return null;
  }

  if (!Number.isFinite(Date.parse(remindAt))) {
    return null;
  }

  const status: ReminderStatus =
    record.status === "done" || record.status === "dismissed"
      ? record.status
      : "active";

  return {
    id,
    title: normalizeTitle(record.title),
    note: normalizeOptionalText(record.note),
    remindAt: new Date(remindAt).toISOString(),
    jobId: typeof record.jobId === "string" ? record.jobId : null,
    jobTitle: normalizeOptionalText(record.jobTitle),
    clientName: normalizeOptionalText(record.clientName),
    status,
    createdAt: new Date(createdAt).toISOString(),
    updatedAt: new Date(updatedAt).toISOString(),
    completedAt:
      typeof record.completedAt === "string" && Number.isFinite(Date.parse(record.completedAt))
        ? new Date(record.completedAt).toISOString()
        : null,
  };
}

async function resolveReminderStorageKey() {
  try {
    if (!supabase) {
      return `${REMINDERS_STORAGE_PREFIX}/guest`;
    }

    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id ?? null;

    if (!userId) {
      return `${REMINDERS_STORAGE_PREFIX}/guest`;
    }

    return `${REMINDERS_STORAGE_PREFIX}/${userId}`;
  } catch {
    return `${REMINDERS_STORAGE_PREFIX}/guest`;
  }
}

async function loadAllReminders() {
  const storageKey = await resolveReminderStorageKey();
  const raw = await AsyncStorage.getItem(storageKey);
  if (!raw) {
    return [] as ReminderItem[];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [] as ReminderItem[];
    }

    return parsed
      .map((entry) => normalizeReminderRecord(entry))
      .filter((entry): entry is ReminderItem => Boolean(entry))
      .sort(sortByRemindAtAsc);
  } catch {
    return [] as ReminderItem[];
  }
}

async function saveAllReminders(reminders: ReminderItem[]) {
  const storageKey = await resolveReminderStorageKey();
  await AsyncStorage.setItem(storageKey, JSON.stringify(reminders));
}

export async function fetchReminderById(reminderId: string) {
  const reminders = await loadAllReminders();
  return reminders.find((item) => item.id === reminderId) ?? null;
}

export async function fetchActiveReminders() {
  const reminders = await loadAllReminders();
  return reminders.filter((item) => item.status === "active");
}

export async function fetchActiveRemindersForJob(jobId: string) {
  const reminders = await fetchActiveReminders();
  return reminders.filter((item) => item.jobId === jobId);
}

export async function createReminder(input: ReminderCreateInput) {
  const reminders = await loadAllReminders();
  const nowIso = new Date().toISOString();
  const remindAtIso = input.remindAt.toISOString();
  const reminder: ReminderItem = {
    id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: normalizeTitle(input.title),
    note: normalizeOptionalText(input.note),
    remindAt: remindAtIso,
    jobId: input.jobId ?? null,
    jobTitle: normalizeOptionalText(input.jobTitle),
    clientName: normalizeOptionalText(input.clientName),
    status: "active",
    createdAt: nowIso,
    updatedAt: nowIso,
    completedAt: null,
  };

  const nextReminders = [...reminders, reminder].sort(sortByRemindAtAsc);
  await saveAllReminders(nextReminders);
  return reminder;
}

export async function updateReminder(reminderId: string, input: ReminderUpdateInput) {
  const reminders = await loadAllReminders();
  const current = reminders.find((item) => item.id === reminderId);
  if (!current) {
    throw new Error("Reminder not found.");
  }

  const nextReminder: ReminderItem = {
    ...current,
    title: input.title !== undefined ? normalizeTitle(input.title) : current.title,
    note: input.note !== undefined ? normalizeOptionalText(input.note) : current.note,
    remindAt: input.remindAt ? input.remindAt.toISOString() : current.remindAt,
    jobId: input.jobId !== undefined ? input.jobId : current.jobId,
    jobTitle:
      input.jobTitle !== undefined
        ? normalizeOptionalText(input.jobTitle)
        : current.jobTitle,
    clientName:
      input.clientName !== undefined
        ? normalizeOptionalText(input.clientName)
        : current.clientName,
    updatedAt: new Date().toISOString(),
    status: "active",
    completedAt: null,
  };

  const nextReminders = reminders
    .map((item) => (item.id === reminderId ? nextReminder : item))
    .sort(sortByRemindAtAsc);
  await saveAllReminders(nextReminders);
  return nextReminder;
}

export async function markReminderDone(reminderId: string) {
  const reminders = await loadAllReminders();
  const nowIso = new Date().toISOString();
  const nextReminders = reminders.map((item) =>
    item.id === reminderId
      ? {
          ...item,
          status: "done" as const,
          updatedAt: nowIso,
          completedAt: nowIso,
        }
      : item,
  );
  await saveAllReminders(nextReminders);
}

export async function dismissReminder(reminderId: string) {
  const reminders = await loadAllReminders();
  const nowIso = new Date().toISOString();
  const nextReminders = reminders.map((item) =>
    item.id === reminderId
      ? {
          ...item,
          status: "dismissed" as const,
          updatedAt: nowIso,
        }
      : item,
  );
  await saveAllReminders(nextReminders);
}

export async function snoozeReminder(reminderId: string, nextRemindAt: Date) {
  const reminders = await loadAllReminders();
  const nextRemindAtIso = nextRemindAt.toISOString();
  const nowIso = new Date().toISOString();
  const nextReminders = reminders
    .map((item) =>
      item.id === reminderId
        ? {
            ...item,
            remindAt: nextRemindAtIso,
            status: "active" as const,
            completedAt: null,
            updatedAt: nowIso,
          }
        : item,
    )
    .sort(sortByRemindAtAsc);
  await saveAllReminders(nextReminders);
}
