import type { Database } from "./database.types";
import { assertSupabaseConfigured } from "./supabase";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
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

export type ClientView = ProjectView & {
  address: string | null;
  phone: string | null;
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

function normalizeClientRow(row: ClientRow): ClientView {
  return {
    id: row.id,
    user_id: row.user_id ?? null,
    name: row.name ?? null,
    note: row.note ?? null,
    address: row.address ?? null,
    phone: row.phone ?? null,
    created_at: row.created_at ?? null,
  };
}

function projectViewToClientView(view: ProjectView): ClientView {
  return {
    ...view,
    address: null,
    phone: null,
  };
}

function isMissingColumnError(
  error: { message?: string } | null | undefined,
  columnName: string,
) {
  const message = (error?.message ?? "").toLowerCase();
  return message.includes(columnName.toLowerCase()) && message.includes("column");
}

function isMissingRelationError(
  error: { message?: string } | null | undefined,
  relationName: string,
) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    message.includes("relation") &&
    message.includes("does not exist") &&
    message.includes(relationName.toLowerCase())
  );
}

function getTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeClientViews(
  preferred: ClientView[],
  fallback: ClientView[],
): ClientView[] {
  const mergedById = new Map<string, ClientView>();

  for (const item of fallback) {
    mergedById.set(item.id, item);
  }

  for (const item of preferred) {
    const current = mergedById.get(item.id);

    if (!current) {
      mergedById.set(item.id, item);
      continue;
    }

    mergedById.set(item.id, {
      id: item.id,
      user_id: item.user_id ?? current.user_id,
      name: item.name ?? current.name,
      note: item.note ?? current.note,
      address: item.address ?? current.address,
      phone: item.phone ?? current.phone,
      created_at: item.created_at ?? current.created_at,
    });
  }

  return Array.from(mergedById.values()).sort(
    (left, right) => getTimestamp(right.created_at) - getTimestamp(left.created_at),
  );
}

async function fetchMergedClientsForUser(
  userId: string,
): Promise<ClientView[]> {
  const supabase = assertSupabaseConfigured();
  const [clientsResult, projectsResult] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (clientsResult.error && !isMissingRelationError(clientsResult.error, "clients")) {
    throw clientsResult.error;
  }

  if (projectsResult.error && !isMissingRelationError(projectsResult.error, "projects")) {
    throw projectsResult.error;
  }

  const normalizedClients = clientsResult.data
    ? clientsResult.data.map((row) => normalizeClientRow(row as ClientRow))
    : [];
  const normalizedProjects = projectsResult.data
    ? projectsResult.data.map((row) =>
        projectViewToClientView(normalizeProjectRow(row as LegacyProjectRow)),
      )
    : [];

  return mergeClientViews(normalizedClients, normalizedProjects);
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

function normalizeChecklistItems(
  checklistItems: Array<unknown> | null | undefined,
) {
  if (!checklistItems?.length) {
    return [] as string[];
  }

  return checklistItems
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

export async function fetchHomeData(): Promise<HomeData> {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const [clientsData, jobsResult, invoicesResult] = await Promise.all([
    fetchMergedClientsForUser(userId),
    supabase
      .from("jobs")
      .select("id, client_id, title, status, scheduled_date, created_at, completed_at, archived_at")
      .eq("user_id", userId),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

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

  const clients = clientsData.map((client) => {
    const normalized: ProjectView = {
      id: client.id,
      user_id: client.user_id,
      name: client.name,
      note: client.note,
      created_at: client.created_at,
    };

    return {
      ...normalized,
      jobCount: jobCountByProject.get(normalized.id) ?? 0,
    };
  });

  const todayDate = toDateOnlyIso(new Date());
  const metrics = {
    clients: clientsData.length,
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

export type JobsListItem = {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  scheduled_date: string | null;
  deadline_date: string | null;
  client_id: string | null;
  created_at: string | null;
};

export async function fetchJobsList(): Promise<JobsListItem[]> {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const result = await supabase
    .from("jobs")
    .select(
      "id, title, description, status, scheduled_date, deadline_date, client_id, created_at",
    )
    .eq("user_id", userId)
    .is("completed_at", null)
    .is("archived_at", null)
    .or("status.is.null,status.neq.someday")
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export type JobDetail = JobsListItem & {
  checklist_items: string[];
  price: number | null;
  completed_at: string | null;
  archived_at: string | null;
  client_name: string | null;
};

export async function fetchJobById(jobId: string): Promise<JobDetail> {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const result = await supabase
    .from("jobs")
    .select(
      "id, title, description, status, scheduled_date, deadline_date, client_id, created_at, checklist_items, price, completed_at, archived_at",
    )
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    throw new Error("Posao nije pronadjen.");
  }

  let clientName: string | null = null;
  if (result.data.client_id) {
    const clientsData = await fetchMergedClientsForUser(userId);
    clientName =
      clientsData.find((client) => client.id === result.data?.client_id)?.name ??
      null;
  }

  return {
    ...result.data,
    checklist_items: normalizeChecklistItems(
      Array.isArray(result.data.checklist_items) ? result.data.checklist_items : [],
    ),
    client_name: clientName,
  };
}

export async function fetchInboxTodos() {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const result = await supabase
    .from("jobs")
    .select("id, title, description, client_id, deadline_date, checklist_items")
    .eq("user_id", userId)
    .is("scheduled_date", null)
    .is("completed_at", null)
    .is("archived_at", null)
    .or("status.is.null,status.neq.someday")
    .order("created_at", { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return result.data.map((todo) => ({
    ...todo,
    checklist_items: normalizeChecklistItems(
      Array.isArray(todo.checklist_items) ? todo.checklist_items : [],
    ),
  }));
}

export async function fetchTodayTodos() {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const todayDate = toDateOnlyIso(new Date());
  const result = await supabase
    .from("jobs")
    .select(
      "id, title, description, client_id, scheduled_date, status, deadline_date, checklist_items",
    )
    .eq("user_id", userId)
    .eq("scheduled_date", todayDate)
    .is("completed_at", null)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return result.data.map((todo) => ({
    ...todo,
    checklist_items: normalizeChecklistItems(
      Array.isArray(todo.checklist_items) ? todo.checklist_items : [],
    ),
  }));
}

export async function fetchUpcomingTodos() {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const todayDate = toDateOnlyIso(new Date());
  const result = await supabase
    .from("jobs")
    .select("id, title, description, client_id, scheduled_date, deadline_date, checklist_items")
    .eq("user_id", userId)
    .gt("scheduled_date", todayDate)
    .is("completed_at", null)
    .is("archived_at", null)
    .or("status.is.null,status.neq.someday")
    .order("scheduled_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return result.data.map((todo) => ({
    ...todo,
    checklist_items: normalizeChecklistItems(
      Array.isArray(todo.checklist_items) ? todo.checklist_items : [],
    ),
  }));
}

export async function fetchSomedayTodos() {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const result = await supabase
    .from("jobs")
    .select(
      "id, title, description, client_id, scheduled_date, status, deadline_date, checklist_items",
    )
    .eq("user_id", userId)
    .eq("status", "someday")
    .is("completed_at", null)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return result.data.map((todo) => ({
    ...todo,
    checklist_items: normalizeChecklistItems(
      Array.isArray(todo.checklist_items) ? todo.checklist_items : [],
    ),
  }));
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
  const [clientsData, jobsResult] = await Promise.all([
    fetchMergedClientsForUser(userId),
    supabase
      .from("jobs")
      .select(
        "id, title, description, status, scheduled_date, deadline_date, checklist_items, price, completed_at, archived_at",
      )
      .eq("client_id", clientId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (jobsResult.error) {
    throw jobsResult.error;
  }

  const project = clientsData.find((client) => client.id === clientId);

  if (!project) {
    throw new Error("Projekat nije pronadjen.");
  }

  return {
    project: {
      id: project.id,
      user_id: project.user_id,
      name: project.name,
      note: project.note,
      created_at: project.created_at,
    },
    todos: jobsResult.data.map((todo) => ({
      ...todo,
      checklist_items: normalizeChecklistItems(
        Array.isArray(todo.checklist_items) ? todo.checklist_items : [],
      ),
    })),
  };
}

export async function createTodo(input: {
  title: string;
  notes?: string;
  projectId?: string | null;
  scheduledDate?: Date | null;
  deadlineDate?: Date | null;
  checklistItems?: string[];
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
      deadline_date: input.deadlineDate ? toDateOnlyIso(input.deadlineDate) : null,
      checklist_items: normalizeChecklistItems(input.checklistItems),
      client_id: input.projectId ?? null,
      status: normalizedStatus,
      scheduled_date: input.scheduledDate ? toDateOnlyIso(input.scheduledDate) : null,
      user_id: userId,
    })
    .select(
      "id, title, description, client_id, status, scheduled_date, deadline_date, checklist_items, created_at",
    )
    .single();

  if (result.error) {
    throw new Error(`Nisam uspeo da sacuvam zadatak: ${result.error.message}`);
  }

  return {
    ...result.data,
    checklist_items: normalizeChecklistItems(
      Array.isArray(result.data.checklist_items) ? result.data.checklist_items : [],
    ),
  };
}

export async function fetchClients(): Promise<ClientView[]> {
  const { user } = await requireCurrentUser();
  return fetchMergedClientsForUser(user.id);
}

function buildLegacyClientNote(
  address: string | null,
  phone: string | null,
) {
  const sections = [
    address ? `Address: ${address}` : null,
    phone ? `Phone: ${phone}` : null,
  ].filter((value): value is string => Boolean(value));

  return sections.length > 0 ? sections.join("\n") : null;
}

export async function createClient(input: {
  name: string;
  address?: string | null;
  phone?: string | null;
}) {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const normalizedName = input.name.trim();
  const normalizedAddress = input.address?.trim() || null;
  const normalizedPhone = input.phone?.trim() || null;

  if (!normalizedName) {
    throw new Error("Ime klijenta je obavezno.");
  }

  const insertClientResult = await supabase
    .from("clients")
    .insert({
      name: normalizedName,
      address: normalizedAddress,
      phone: normalizedPhone,
      user_id: userId,
    })
    .select("*")
    .single();

  if (insertClientResult.error && isMissingRelationError(insertClientResult.error, "clients")) {
    const legacyNote = buildLegacyClientNote(normalizedAddress, normalizedPhone);
    const insertByNameResult = await supabase
      .from("projects")
      .insert({ name: normalizedName, note: legacyNote, user_id: userId })
      .select("*")
      .single();

    if (insertByNameResult.error && isMissingColumnError(insertByNameResult.error, "name")) {
      const insertByTitleResult = await supabase
        .from("projects")
        .insert({
          title: normalizedName,
          description: legacyNote,
          user_id: userId,
        } as never)
        .select("*")
        .single();

      if (insertByTitleResult.error) {
        throw new Error(`Nisam uspeo da sacuvam klijenta: ${insertByTitleResult.error.message}`);
      }

      return projectViewToClientView(
        normalizeProjectRow(insertByTitleResult.data as LegacyProjectRow),
      );
    }

    if (insertByNameResult.error) {
      throw new Error(`Nisam uspeo da sacuvam klijenta: ${insertByNameResult.error.message}`);
    }

    return projectViewToClientView(
      normalizeProjectRow(insertByNameResult.data as LegacyProjectRow),
    );
  }

  if (insertClientResult.error) {
    throw new Error(`Nisam uspeo da sacuvam klijenta: ${insertClientResult.error.message}`);
  }

  return normalizeClientRow(insertClientResult.data as ClientRow);
}

export async function updateClient(input: {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
}) {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const normalizedName = input.name.trim();
  const normalizedAddress = input.address?.trim() || null;
  const normalizedPhone = input.phone?.trim() || null;

  if (!normalizedName) {
    throw new Error("Ime klijenta je obavezno.");
  }

  const updateClientResult = await supabase
    .from("clients")
    .update({
      name: normalizedName,
      address: normalizedAddress,
      phone: normalizedPhone,
    })
    .eq("id", input.id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (updateClientResult.error && !isMissingRelationError(updateClientResult.error, "clients")) {
    throw new Error(`Nisam uspeo da izmenim klijenta: ${updateClientResult.error.message}`);
  }

  if (updateClientResult.data) {
    return normalizeClientRow(updateClientResult.data as ClientRow);
  }

  const legacyNote = buildLegacyClientNote(normalizedAddress, normalizedPhone);
  const updateByNameResult = await supabase
    .from("projects")
    .update({ name: normalizedName, note: legacyNote })
    .eq("id", input.id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (updateByNameResult.error && isMissingColumnError(updateByNameResult.error, "name")) {
    const updateByTitleResult = await supabase
      .from("projects")
      .update({ title: normalizedName, description: legacyNote } as never)
      .eq("id", input.id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (updateByTitleResult.error) {
      throw new Error(`Nisam uspeo da izmenim klijenta: ${updateByTitleResult.error.message}`);
    }

    if (!updateByTitleResult.data) {
      throw new Error("Klijent nije pronadjen.");
    }

    return projectViewToClientView(
      normalizeProjectRow(updateByTitleResult.data as LegacyProjectRow),
    );
  }

  if (updateByNameResult.error) {
    throw new Error(`Nisam uspeo da izmenim klijenta: ${updateByNameResult.error.message}`);
  }

  if (!updateByNameResult.data) {
    throw new Error("Klijent nije pronadjen.");
  }

  return projectViewToClientView(
    normalizeProjectRow(updateByNameResult.data as LegacyProjectRow),
  );
}

export async function deleteClient(clientId: string) {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;

  const deleteClientResult = await supabase
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (deleteClientResult.error && !isMissingRelationError(deleteClientResult.error, "clients")) {
    throw new Error(`Nisam uspeo da obrisem klijenta: ${deleteClientResult.error.message}`);
  }

  if (deleteClientResult.data?.id) {
    return;
  }

  const deleteProjectResult = await supabase
    .from("projects")
    .delete()
    .eq("id", clientId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (deleteProjectResult.error) {
    throw new Error(`Nisam uspeo da obrisem klijenta: ${deleteProjectResult.error.message}`);
  }

  if (!deleteProjectResult.data?.id) {
    throw new Error("Klijent nije pronadjen.");
  }
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

export async function deleteInboxTodo(jobId: string) {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const result = await supabase
    .from("jobs")
    .delete()
    .eq("id", jobId)
    .eq("user_id", userId);

  if (result.error) {
    throw result.error;
  }
}

export async function assignClientToInboxTodo(
  jobId: string,
  clientId: string | null,
) {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const result = await supabase
    .from("jobs")
    .update({ client_id: clientId })
    .eq("id", jobId)
    .eq("user_id", userId);

  if (result.error) {
    throw result.error;
  }
}

export async function updateInboxTodo(
  jobId: string,
  input: {
    title: string;
    description?: string | null;
    scheduledDateIso?: string | null;
    deadlineDateIso?: string | null;
    checklistItems?: string[] | null;
    status?: "new" | "someday" | null;
  },
) {
  const { supabase, user } = await requireCurrentUser();
  const userId = user.id;
  const updatePayload: Database["public"]["Tables"]["jobs"]["Update"] = {
    title: input.title.trim(),
  };

  if (input.description !== undefined) {
    updatePayload.description = input.description?.trim() || null;
  }

  if (input.scheduledDateIso !== undefined) {
    updatePayload.scheduled_date = input.scheduledDateIso;
  }

  if (input.deadlineDateIso !== undefined) {
    updatePayload.deadline_date = input.deadlineDateIso;
  }

  if (input.checklistItems !== undefined) {
    updatePayload.checklist_items = normalizeChecklistItems(input.checklistItems);
  }

  if (input.status !== undefined) {
    updatePayload.status =
      input.status === "someday" ? "someday" : null;
  }

  const result = await supabase
    .from("jobs")
    .update(updatePayload)
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
