import type { Database } from "./database.types";
import { assertSupabaseConfigured } from "./supabase";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type LegacyProjectRow = ProjectRow & {
  title?: string | null;
  description?: string | null;
};

type ProjectView = {
  id: string;
  user_id: string | null;
  name: string | null;
  note: string | null;
  created_at: string | null;
};

function normalizeProjectRow(row: LegacyProjectRow): ProjectView {
  return {
    id: row.id,
    user_id: row.user_id ?? null,
    name: row.name ?? row.title ?? null,
    note: row.note ?? row.description ?? null,
    created_at: row.created_at ?? null,
  };
}

function isMissingColumnError(
  error: { message?: string } | null | undefined,
  columnName: string,
) {
  const message = (error?.message ?? "").toLowerCase();
  return message.includes(columnName.toLowerCase()) && message.includes("column");
}

async function requireCurrentUser() {
  const supabase = assertSupabaseConfigured();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  const user = authData.user;

  if (!user?.id) {
    throw new Error("Morate biti prijavljeni da biste nastavili.");
  }

  // Some existing accounts can miss a row in public.users (legacy data),
  // which then breaks FK inserts into projects/jobs.
  const { error: ensureUserError } = await supabase.from("users").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      name: ((user.user_metadata?.display_name ??
        user.user_metadata?.name) as string | undefined) ?? null,
    },
    { onConflict: "id" },
  );

  if (ensureUserError) {
    throw ensureUserError;
  }

  return { supabase, user };
}

export interface HomeData {
  metrics: {
    clients: number;
    todayJobs: number;
    allJobs: number;
    unscheduledJobs: number;
    scheduledJobs: number;
    completedJobs: number;
    archivedJobs: number;
    invoices: number;
  };
  clients: Array<ProjectView & { jobCount: number }>;
}

function toDateOnlyIso(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function fetchHomeData(): Promise<HomeData> {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const [projectsResult, jobsResult, invoicesResult] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("jobs")
      .select("id, client_id, title, status, scheduled_date, created_at, completed_at, archived_at")
      .eq("user_id", userId),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  if (projectsResult.error) {
    throw projectsResult.error;
  }

  if (jobsResult.error) {
    throw jobsResult.error;
  }

  if (invoicesResult.error) {
    throw invoicesResult.error;
  }

  const jobCountByProject = new Map<string, number>();

  for (const job of jobsResult.data) {
    if (!job.client_id) {
      continue;
    }

    jobCountByProject.set(job.client_id, (jobCountByProject.get(job.client_id) ?? 0) + 1);
  }

  const clients = projectsResult.data.map((project) => {
    const normalized = normalizeProjectRow(project as LegacyProjectRow);
    return {
      ...normalized,
      jobCount: jobCountByProject.get(normalized.id) ?? 0,
    };
  });

  const todayDate = toDateOnlyIso(new Date());
  const metrics = {
    clients: projectsResult.data.length,
    todayJobs: jobsResult.data.filter((job) => {
      return (
        job.scheduled_date === todayDate &&
        !job.completed_at &&
        !job.archived_at
      );
    }).length,
    allJobs: jobsResult.data.length,
    unscheduledJobs: jobsResult.data.filter(
      (job) =>
        !job.scheduled_date &&
        !job.completed_at &&
        !job.archived_at &&
        job.status !== "someday",
    ).length,
    scheduledJobs: jobsResult.data.filter(
      (job) => Boolean(job.scheduled_date) && !job.completed_at && !job.archived_at,
    ).length,
    completedJobs: jobsResult.data.filter((job) => Boolean(job.completed_at)).length,
    archivedJobs: jobsResult.data.filter(
      (job) => Boolean(job.archived_at) || job.status === "someday",
    ).length,
    invoices: invoicesResult.count ?? 0,
  };

  return { metrics, clients };
}

export async function fetchInboxTodos() {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const result = await supabase
    .from("jobs")
    .select("id, title, description, client_id")
    .eq("user_id", userId)
    .is("scheduled_date", null)
    .is("completed_at", null)
    .is("archived_at", null)
    .or("status.is.null,status.neq.someday")
    .order("created_at", { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export async function fetchTodayTodos() {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const todayDate = toDateOnlyIso(new Date());
  const result = await supabase
    .from("jobs")
    .select("id, title, description, client_id")
    .eq("user_id", userId)
    .eq("scheduled_date", todayDate)
    .is("completed_at", null)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export async function fetchSomedayTodos() {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const result = await supabase
    .from("jobs")
    .select("id, title, description, client_id")
    .eq("user_id", userId)
    .eq("status", "someday")
    .is("completed_at", null)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export async function fetchLogbookTodos() {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const result = await supabase
    .from("jobs")
    .select("id, title, completed_at")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .is("archived_at", null)
    .order("completed_at", { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export async function fetchProjectById(clientId: string) {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const [projectResult, jobsResult] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("id", clientId)
      .eq("user_id", userId)
      .single(),
    supabase
      .from("jobs")
      .select("id, title, description, status, scheduled_date, price, completed_at, archived_at")
      .eq("client_id", clientId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (projectResult.error) {
    throw projectResult.error;
  }

  if (jobsResult.error) {
    throw jobsResult.error;
  }

  return {
    project: normalizeProjectRow(projectResult.data as LegacyProjectRow),
    todos: jobsResult.data,
  };
}

export async function createTodo(input: {
  title: string;
  notes?: string;
  projectId?: string | null;
  scheduledDate?: Date | null;
  status?: "new" | "someday";
}) {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const normalizedStatus = input.status === "someday" ? "someday" : null;

  const result = await supabase
    .from("jobs")
    .insert({
      title: input.title,
      description: input.notes?.trim() || null,
      client_id: input.projectId ?? null,
      status: normalizedStatus,
      scheduled_date: input.scheduledDate ? toDateOnlyIso(input.scheduledDate) : null,
      user_id: userId,
    })
    .select("id, title, description, client_id, status, scheduled_date, created_at")
    .single();

  if (result.error) {
    throw new Error(`Nisam uspeo da sacuvam zadatak: ${result.error.message}`);
  }

  return result.data;
}

export async function createProject(title: string) {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;

  const normalizedTitle = title.trim();
  const insertByNameResult = await supabase
    .from("projects")
    .insert({ name: normalizedTitle, user_id: userId })
    .select("*")
    .single();

  if (insertByNameResult.error && isMissingColumnError(insertByNameResult.error, "name")) {
    const insertByTitleResult = await supabase
      .from("projects")
      .insert({ title: normalizedTitle, user_id: userId } as never)
      .select("*")
      .single();

    if (insertByTitleResult.error) {
      throw new Error(`Nisam uspeo da sacuvam projekat: ${insertByTitleResult.error.message}`);
    }

    return normalizeProjectRow(insertByTitleResult.data as LegacyProjectRow);
  }

  if (insertByNameResult.error) {
    throw new Error(`Nisam uspeo da sacuvam projekat: ${insertByNameResult.error.message}`);
  }

  return normalizeProjectRow(insertByNameResult.data as LegacyProjectRow);
}

export async function completeInboxTodo(jobId: string) {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const result = await supabase
    .from("jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("user_id", userId);

  if (result.error) {
    throw result.error;
  }
}

export async function seedStarterWorkspace() {
  const supabase = assertSupabaseConfigured();
  const { count, error } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  if ((count ?? 0) > 0) {
    return;
  }

  await createProject("Marko Petrovic");
  await Promise.all([
    createTodo({
      title: "Zamena brave na ulaznim vratima",
      notes: "Poneti novi cilindar i proveriti stok.",
    }),
    createTodo({
      title: "Hitna intervencija zbog zaglavljenih vrata",
      notes: "Klijent ocekuje dolazak danas.",
    }),
    createTodo({
      title: "Pozvati novog klijenta i potvrditi termin",
    }),
  ]);
}
