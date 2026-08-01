// バックエンドREST API (`/api/...`) 用のクライアント関数群。
// Viteの開発プロキシが `/api` を FastAPI (localhost:8000) へ転送するため、素の fetch で完結する。

import type {
  RoleOut,
  AIModelOut,
  SkillOut,
  AgentOut,
  HireAgentRequest,
  UpdateAgentRequest,
  TaskOut,
  CreateTaskRequest,
  UpdateTaskRequest,
  MeetingOut,
  MeetingStatusOut,
  StartMeetingRequest,
  PendingReportOut,
  WorkSessionOut,
  WorkSessionDetailOut,
  StartWorkRequest,
  ArtifactOut,
  NotificationOut,
} from "./types";

interface ErrorBody {
  detail?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as ErrorBody;
      if (body?.detail) message = body.detail;
    } catch {
      // レスポンスボディがJSONでない場合はステータス文言をそのまま使用
    }
    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

// --- Roles / AI Models / Skills -------------------------------------------------

export function listRoles(): Promise<RoleOut[]> {
  return request<RoleOut[]>("/api/roles");
}

export function listAiModels(roleId?: number): Promise<AIModelOut[]> {
  const query = roleId !== undefined ? `?role_id=${roleId}` : "";
  return request<AIModelOut[]>(`/api/ai-models${query}`);
}

export function listSkills(): Promise<SkillOut[]> {
  return request<SkillOut[]>("/api/skills");
}

// --- Agents -----------------------------------------------------------------------

export function listAgents(): Promise<AgentOut[]> {
  return request<AgentOut[]>("/api/agents");
}

export function listBusyAgents(): Promise<number[]> {
  return request<number[]>("/api/agents/busy");
}

export function hireAgent(req: HireAgentRequest): Promise<AgentOut> {
  return request<AgentOut>("/api/agents", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function updateAgent(id: number, req: UpdateAgentRequest): Promise<AgentOut> {
  return request<AgentOut>(`/api/agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(req),
  });
}

export function deleteAgent(id: number): Promise<void> {
  return request<void>(`/api/agents/${id}`, { method: "DELETE" });
}

// --- Tasks ------------------------------------------------------------------------

export function listTasks(): Promise<TaskOut[]> {
  return request<TaskOut[]>("/api/tasks");
}

export function listAwaitingMeetingTasks(): Promise<TaskOut[]> {
  return request<TaskOut[]>("/api/tasks/awaiting-meeting");
}

export function listReadyForWorkTasks(): Promise<TaskOut[]> {
  return request<TaskOut[]>("/api/tasks/ready-for-work");
}

export function createTask(req: CreateTaskRequest): Promise<TaskOut> {
  return request<TaskOut>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function updateTask(id: number, req: UpdateTaskRequest): Promise<TaskOut> {
  return request<TaskOut>(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(req),
  });
}

export function deleteTask(id: number): Promise<void> {
  return request<void>(`/api/tasks/${id}`, { method: "DELETE" });
}

// --- Meetings ---------------------------------------------------------------------

export function getMeetingStatus(): Promise<MeetingStatusOut> {
  return request<MeetingStatusOut>("/api/meetings/status");
}

export function startMeeting(req: StartMeetingRequest): Promise<MeetingOut> {
  return request<MeetingOut>("/api/meetings", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function listPendingReports(): Promise<PendingReportOut[]> {
  return request<PendingReportOut[]>("/api/meetings/pending-reports");
}

export function approveReport(taskId: number): Promise<void> {
  return request<void>(`/api/meetings/${taskId}/approve`, { method: "POST" });
}

// --- Work -------------------------------------------------------------------------

export function getWorkStatus(): Promise<{ busy: boolean }> {
  return request<{ busy: boolean }>("/api/work/status");
}

export function getTaskWorkSession(taskId: number): Promise<WorkSessionDetailOut> {
  return request<WorkSessionDetailOut>(`/api/tasks/${taskId}/work-session`);
}

export function startWork(req: StartWorkRequest): Promise<WorkSessionOut> {
  return request<WorkSessionOut>("/api/work-sessions", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function listArtifacts(): Promise<ArtifactOut[]> {
  return request<ArtifactOut[]>("/api/artifacts");
}

// --- Notifications ------------------------------------------------------------------

export function listNotifications(): Promise<NotificationOut[]> {
  return request<NotificationOut[]>("/api/notifications");
}

export function markNotificationRead(threadId: number): Promise<void> {
  return request<void>(`/api/notifications/${threadId}/read`, { method: "POST" });
}
