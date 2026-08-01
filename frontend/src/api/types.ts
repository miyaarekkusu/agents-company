// フロントエンドAPI型定義
// 正: backend-core/app/schemas/ (Pydanticモデル) — フィールド名はsnake_caseのまま保持する。

export interface RoleOut {
  id: number;
  name: string;
  requires_design_capable_model: boolean;
}

export interface AIModelOut {
  id: number;
  provider: string;
  model_name: string;
  display_name: string;
  description: string;
  capability_tags: string[];
}

export interface SkillOut {
  id: number;
  name: string;
  description: string;
}

export interface AgentOut {
  id: number;
  name: string;
  personality: string;
  role: RoleOut;
  ai_model: AIModelOut;
  skills: SkillOut[];
  hired_at: string;
}

export interface HireAgentRequest {
  name: string;
  personality: string;
  role_id: number;
  ai_model_id: number;
  skill_ids: number[];
}

export interface UpdateAgentRequest {
  name?: string;
  personality?: string;
  role_id?: number;
  ai_model_id?: number;
  skill_ids?: number[];
}

export type TaskStatus =
  | "awaiting_meeting"
  | "meeting_in_progress"
  | "awaiting_approval"
  | "ready_for_work"
  | "work_in_progress"
  | "completed";

export interface TaskOut {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  requires_meeting: boolean;
  created_at: string;
  in_progress_agent_names: string[];
}

export interface CreateTaskRequest {
  task_text: string;
  requires_meeting: boolean;
}

export interface UpdateTaskRequest {
  task_text?: string;
  requires_meeting?: boolean;
}

export interface MeetingOut {
  id: number;
  task_id: number;
  leader_agent_id: number;
  status: string;
  created_at: string;
}

export interface MeetingStatusOut {
  busy: boolean;
  leader_agent_id: number | null;
  participant_agent_ids: number[];
}

export interface StartMeetingRequest {
  task_id: number;
  leader_agent_id: number;
  participant_agent_ids: number[];
}

export interface PendingReportOut {
  task_id: number;
  task_title: string;
  meeting_id: number;
  report_content: string;
  created_at: string;
}

export interface WorkSessionOut {
  id: number;
  task_id: number;
  leader_agent_id: number;
  status: string;
  created_at: string;
}

export interface WorkSessionDetailOut {
  id: number;
  task_id: number;
  leader_agent_id: number;
  worker_agent_ids: number[];
  status: string;
  created_at: string;
}

export interface StartWorkRequest {
  task_id: number;
  worker_agent_ids: number[];
  leader_agent_id: number;
}

export type ArtifactType = "website" | "report" | "proposal";

export interface ArtifactOut {
  id: number;
  task_id: number;
  task_title: string;
  type: ArtifactType;
  content: string;
  created_by_agent_id: number;
  agent_name: string;
  created_at: string;
}

export type NotificationStatus = "open" | "closed";

export interface NotificationOut {
  id: number;
  task_id: number;
  agent_id: number;
  subject: string;
  status: NotificationStatus;
  body: string;
  created_at: string;
}
