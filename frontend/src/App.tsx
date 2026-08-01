import { useCallback, useEffect, useRef, useState } from "react";
import { PresidentRoom } from "./rooms/President/PresidentRoom";
import { MeetingRoom } from "./rooms/Meeting/MeetingRoom";
import { WorkRoom } from "./rooms/Work/WorkRoom";
import { HiringScreen } from "./features/hiring/HiringScreen";
import { ReportViewer } from "./features/report-viewer/ReportViewer";
import { MobileChat } from "./features/mobile-chat/MobileChat";
import { Modal } from "./components/Common/Modal";
import { Toast, type ToastMessage } from "./components/Common/Toast";
import {
  type CharacterState,
  type SpriteDirection,
} from "./components/Character/CharacterSprite";
import { usePolling } from "./api/hooks";
import * as api from "./api/client";
import type { ArtifactOut, StartMeetingRequest, TaskOut } from "./api/types";

type RoomId = "president" | "meeting" | "work";

interface Room {
  id: RoomId;
  title: string;
  emoji: string;
}

const ROOMS: Room[] = [
  { id: "president", title: "社長室", emoji: "🏢" },
  { id: "meeting", title: "会議室", emoji: "🤝" },
  { id: "work", title: "作業室", emoji: "💻" },
];

interface AgentPosition {
  x: number | string;
  y: number | string;
  dir: SpriteDirection;
  state: CharacterState;
  speech?: string;
  noTransition?: boolean;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function computeAgentState(
  agentName: string,
  tasks: TaskOut[],
): CharacterState {
  for (const t of tasks) {
    if (t.in_progress_agent_names.includes(agentName)) {
      if (t.status === "meeting_in_progress") return "discussing";
      if (t.status === "work_in_progress") return "working";
    }
  }
  return "idle";
}

function App() {
  // Navigation & States
  const [activeRoom, setActiveRoom] = useState<RoomId>("president");
  const [roomChangeTarget, setRoomChangeTarget] = useState<RoomId | null>(null);
  // ドアの確認後、実際に部屋を切り替えるまでの「移動中」演出用（社長が部屋から部屋へ歩いて向かう感じを出す）
  const [transitioningTo, setTransitioningTo] = useState<RoomId | null>(null);

  // Modals Visibility
  const [isHiringOpen, setIsHiringOpen] = useState(false);
  const [isArtifactViewerOpen, setIsArtifactViewerOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<
    ArtifactOut | undefined
  >(undefined);

  // Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Agent visual coordinates state
  const [agentPositions, setAgentPositions] = useState<
    Record<number, AgentPosition>
  >({});

  // ポーリングで頻繁に再レンダリングされても関数の参照を固定し、
  // Toastの自動消去タイマー（onRemove依存のuseEffect）がリセットされ続けないようにする
  const addToast = useCallback(
    (text: string, type: "info" | "success" = "info") => {
      setToasts((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, text, type },
      ]);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // --- Real data polling (3秒間隔でバックエンドと同期) ---------------------------
  const agentsPoll = usePolling(api.listAgents, 3000);
  const tasksPoll = usePolling(api.listTasks, 3000);
  const busyAgentIdsPoll = usePolling(api.listBusyAgents, 3000);
  const meetingStatusPoll = usePolling(api.getMeetingStatus, 3000);
  const workStatusPoll = usePolling(api.getWorkStatus, 3000);
  const pendingReportsPoll = usePolling(api.listPendingReports, 3000);
  const artifactsPoll = usePolling(api.listArtifacts, 3000);
  const notificationsPoll = usePolling(api.listNotifications, 3000);

  const agents = agentsPoll.data ?? [];
  const tasks = tasksPoll.data ?? [];
  const busyAgentIds = busyAgentIdsPoll.data ?? [];
  const pendingReports = pendingReportsPoll.data ?? [];
  const artifacts = artifactsPoll.data ?? [];
  const notifications = notificationsPoll.data ?? [];

  // 新着通知が現れたらトーストで知らせる（前回ポーリング結果とidの差分を取る）
  const prevNotificationIdsRef = useRef<Set<number> | null>(null);
  useEffect(() => {
    if (!notificationsPoll.data) return;
    const currentIds = new Set(notificationsPoll.data.map((n) => n.id));
    const prevIds = prevNotificationIdsRef.current;
    if (prevIds) {
      notificationsPoll.data.forEach((n) => {
        if (!prevIds.has(n.id)) {
          addToast(`📩 ${n.subject}`, "info");
        }
      });
    }
    prevNotificationIdsRef.current = currentIds;
  }, [notificationsPoll.data]);

  // 社長室内のエージェント表示座標を算出する。以前はagent.idから疑似ランダムに散らしていたが、
  // 見た目が乱雑になるため、部屋奥（上部）に横一列に均等配置するようにした。
  useEffect(() => {
    if (!agentsPoll.data) return;
    const currentTasks = tasksPoll.data ?? [];
    const next: Record<number, AgentPosition> = {};
    const count = agentsPoll.data.length;
    agentsPoll.data.forEach((agent, index) => {
      const targetX = count <= 1 ? 50 : 12 + (index / (count - 1)) * 76;
      const targetY = 180; // 部屋奥（上部）に固定の高さで一列に並べる
      next[agent.id] = {
        x: targetX,
        y: targetY,
        dir: "front",
        state: computeAgentState(agent.name, currentTasks),
        noTransition: true,
      };
    });
    setAgentPositions(next);
  }, [agentsPoll.data, tasksPoll.data]);

  // Door click room-transition confirmation
  const handleRoomNavClick = (targetId: RoomId) => {
    if (targetId === activeRoom) return;
    setRoomChangeTarget(targetId);
  };

  const ROOM_TRANSITION_MS = 700;
  const confirmRoomChange = () => {
    if (!roomChangeTarget) return;
    const target = roomChangeTarget;
    setRoomChangeTarget(null);
    setTransitioningTo(target);
    // 「歩いて移動している」演出を少し見せてから、実際に部屋を切り替える
    window.setTimeout(() => {
      setActiveRoom(target);
      setTransitioningTo(null);
      addToast(`${ROOMS.find((r) => r.id === target)?.title}に入室しました`, "info");
    }, ROOM_TRANSITION_MS);
  };

  // 会議開始（MeetingRoomから呼び出される実データ連携ハンドラ）
  const handleStartMeeting = async (req: StartMeetingRequest) => {
    try {
      await api.startMeeting(req);
      addToast("会議室で会議が始まりました！", "success");
      tasksPoll.refetch();
      meetingStatusPoll.refetch();
    } catch (err) {
      addToast(`⚠️ 会議の開始に失敗しました: ${errMsg(err)}`, "info");
    }
  };

  // 成果物プレビューを開く（WorkRoomから呼び出される）
  const handleViewArtifact = (artifact: ArtifactOut) => {
    setSelectedArtifact(artifact);
    setIsArtifactViewerOpen(true);
  };

  // 通知既読化（MobileChatから呼び出される）
  const handleMarkNotificationRead = async (threadId: number) => {
    try {
      await api.markNotificationRead(threadId);
      notificationsPoll.refetch();
    } catch (err) {
      addToast(`⚠️ 既読化に失敗しました: ${errMsg(err)}`, "info");
    }
  };

  return (
    <div className="app">
      <header>
        <h1>AI秘密基地</h1>
      </header>

      {/* Main Glassmorphic Room Navigation Tabs */}
      <nav className="room-nav">
        {ROOMS.map((r) => {
          const isBusy =
            (r.id === "meeting" && (meetingStatusPoll.data?.busy ?? false)) ||
            (r.id === "work" && (workStatusPoll.data?.busy ?? false));
          return (
            <button
              key={r.id}
              className={
                r.id === activeRoom ? "room-button active" : "room-button"
              }
              onClick={() => handleRoomNavClick(r.id)}
            >
              <span>{r.emoji}</span>
              {r.title}
              {isBusy && (
                <span
                  title="稼働中"
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "var(--success-color)",
                    boxShadow: "0 0 6px var(--success-glow)",
                    animation: "pulseGlow 1.5s infinite",
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Primary Room View Grid */}
      <main className="room-view" style={{ position: "relative" }}>
        {transitioningTo && (
          <div className="room-transition-overlay">
            <div className="room-transition-walker">🚶</div>
            <div className="room-transition-label">
              {ROOMS.find((r) => r.id === transitioningTo)?.emoji}{" "}
              {ROOMS.find((r) => r.id === transitioningTo)?.title}へ移動中...
            </div>
          </div>
        )}

        {activeRoom === "president" && (
          <PresidentRoom
            agents={agents}
            tasks={tasks}
            busyAgentIds={busyAgentIds}
            pendingReports={pendingReports}
            agentPositions={agentPositions}
            onOpenHiring={() => setIsHiringOpen(true)}
            addToast={addToast}
            refetchAgents={agentsPoll.refetch}
            refetchTasks={tasksPoll.refetch}
            refetchPendingReports={pendingReportsPoll.refetch}
            refetchBusyAgents={busyAgentIdsPoll.refetch}
          />
        )}

        {activeRoom === "meeting" && (
          <MeetingRoom
            agents={agents}
            busyAgentIds={busyAgentIds}
            awaitingMeetingTasks={tasks.filter(
              (t) => t.status === "awaiting_meeting",
            )}
            meetingBusy={meetingStatusPoll.data?.busy ?? false}
            leaderAgentId={meetingStatusPoll.data?.leader_agent_id ?? null}
            participantAgentIds={meetingStatusPoll.data?.participant_agent_ids ?? []}
            onStartMeeting={handleStartMeeting}
          />
        )}

        {activeRoom === "work" && (
          <WorkRoom
            artifacts={artifacts}
            inProgressTasks={tasks.filter(
              (t) => t.status === "work_in_progress",
            )}
            agents={agents}
            onViewArtifact={handleViewArtifact}
          />
        )}
      </main>

      {/* Interactive Mobile Chat Overlay */}
      <MobileChat
        notifications={notifications}
        onMarkRead={handleMarkNotificationRead}
      />

      {/* Hiring Modal */}
      <Modal
        isOpen={isHiringOpen}
        onClose={() => setIsHiringOpen(false)}
        title="新規エージェント雇用"
      >
        <HiringScreen
          addToast={addToast}
          onHired={() => {
            setIsHiringOpen(false);
            agentsPoll.refetch();
          }}
        />
      </Modal>

      {/* Artifact Viewer Modal */}
      <Modal
        isOpen={isArtifactViewerOpen}
        onClose={() => setIsArtifactViewerOpen(false)}
        title="成果物プレビュー"
      >
        <ReportViewer artifact={selectedArtifact} />
      </Modal>

      {/* Room Transition Confirmation Modal */}
      <Modal
        isOpen={roomChangeTarget !== null}
        onClose={() => setRoomChangeTarget(null)}
        title="エリア移動確認"
      >
        <div style={{ textAlign: "center", padding: "1rem" }}>
          <p style={{ fontSize: "1.1rem", marginBottom: "1.5rem" }}>
            ドアを開けて{" "}
            <strong>
              {ROOMS.find((r) => r.id === roomChangeTarget)?.title}
            </strong>{" "}
            に移動しますか？
          </p>
          <div
            style={{ display: "flex", justifyContent: "center", gap: "12px" }}
          >
            <button
              className="btn-secondary"
              onClick={() => setRoomChangeTarget(null)}
            >
              ここに残る
            </button>
            <button className="btn-primary" onClick={confirmRoomChange}>
              ドアを開けて入室
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast Notifications Overlay */}
      <Toast messages={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
