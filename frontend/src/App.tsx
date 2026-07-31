import { useState } from "react";
import { type Agent, INITIAL_HIRED_AGENTS } from "./mocks/agents";
import { type Task, MOCK_TASKS, MOCK_ARTIFACTS, type Artifact, type MeetingReport } from "./mocks/tasks";
import { type EmailThread, MOCK_EMAIL_THREADS } from "./mocks/messages";
import { PresidentRoom } from "./rooms/President/PresidentRoom";
import { MeetingRoom } from "./rooms/Meeting/MeetingRoom";
import { WorkRoom } from "./rooms/Work/WorkRoom";
import { HiringScreen } from "./features/hiring/HiringScreen";
import { ReportViewer } from "./features/report-viewer/ReportViewer";
import { MobileChat } from "./features/mobile-chat/MobileChat";
import { Modal } from "./components/Common/Modal";
import { Toast, type ToastMessage } from "./components/Common/Toast";

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

function App() {
  // Navigation & States
  const [activeRoom, setActiveRoom] = useState<RoomId>("president");
  const [roomChangeTarget, setRoomChangeTarget] = useState<RoomId | null>(null);

  // Entities Data
  const [hiredAgents, setHiredAgents] = useState<Agent[]>(INITIAL_HIRED_AGENTS);
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [emailThreads, setEmailThreads] = useState<EmailThread[]>(MOCK_EMAIL_THREADS);
  const [artifacts, setArtifacts] = useState<Artifact[]>(MOCK_ARTIFACTS);
  
  // Meeting State
  const [activeMeeting, setActiveMeeting] = useState<{
    taskId: number;
    leaderId: number;
    participantsIds: number[];
    status: "discussing" | "completed";
  } | null>(null);
  const [currentMeetingReport, setCurrentMeetingReport] = useState<MeetingReport | null>(null);

  // Modals Visibility
  const [isHiringOpen, setIsHiringOpen] = useState(false);
  const [isReportViewerOpen, setIsReportViewerOpen] = useState(false);
  
  // Active Viewer Selection
  const [selectedReport, setSelectedReport] = useState<MeetingReport | undefined>(undefined);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | undefined>(undefined);

  // Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (text: string, type: "info" | "success" = "info") => {
    setToasts((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, text, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Door click room-transition confirmation
  const handleRoomNavClick = (targetId: RoomId) => {
    if (targetId === activeRoom) return;
    setRoomChangeTarget(targetId);
  };

  const confirmRoomChange = () => {
    if (roomChangeTarget) {
      setActiveRoom(roomChangeTarget);
      setRoomChangeTarget(null);
      addToast(`${ROOMS.find((r) => r.id === roomChangeTarget)?.title}に入室しました`, "info");
    }
  };

  // Hiring Handler
  const handleHireAgent = (newAgent: Agent) => {
    setHiredAgents((prev) => [...prev, newAgent]);
    setIsHiringOpen(false);
    addToast(`${newAgent.name} (${newAgent.role.name}) を雇用しました！`, "success");
  };

  // Meeting Flow Handlers
  const handleStartMeeting = (taskId: number, leaderId: number, participantsIds: number[]) => {
    setActiveMeeting({
      taskId,
      leaderId,
      participantsIds,
      status: "discussing",
    });
    
    // Set task to in_progress
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "in_progress" } : t))
    );

    addToast("会議室で会議が始まりました！", "info");
  };

  const handleCompleteMeeting = () => {
    if (!activeMeeting) return;

    // Generate meeting report based on mock data
    const leaderAgent = hiredAgents.find((a) => a.id === activeMeeting.leaderId)!;
    const task = tasks.find((t) => t.id === activeMeeting.taskId)!;

    const newReport: MeetingReport = {
      meetingId: Date.now(),
      taskId: activeMeeting.taskId,
      leaderName: leaderAgent.name,
      content: `# 会議レポート: ${task.title} 📝\n\n## プロジェクト詳細\nリーダーの ${leaderAgent.name} とチームは、プロジェクト「${task.title}」の要件定義と設計を完了しました。\n\n## 技術決定事項\n- 担当AIモデル: ${leaderAgent.aiModel.display_name}\n- 技術スタック: フロントエンド React / バックエンド FastAPI\n- 開発ステータス: 設計完了。作業室での実装フェーズへ移行します。\n\n---\n*署名: ${leaderAgent.name}*`,
      createdAt: new Date().toISOString(),
    };

    setCurrentMeetingReport(newReport);
    setActiveMeeting({ ...activeMeeting, status: "completed" });
    addToast("設計レポートが正常に生成されました！", "success");
  };

  const handleViewReport = () => {
    if (currentMeetingReport) {
      setSelectedReport(currentMeetingReport);
      setSelectedArtifact(undefined);
      setIsReportViewerOpen(true);
    }
  };

  const handleViewArtifact = (artifact: Artifact) => {
    setSelectedArtifact(artifact);
    setSelectedReport(undefined);
    setIsReportViewerOpen(true);
  };

  // Chat Interactive Simulation Handlers
  const handleChatReply = (threadId: number, optionText: string) => {
    setEmailThreads((prev) =>
      prev.map((thread) => {
        if (thread.id === threadId) {
          const updatedMessages = [
            ...thread.messages,
            {
              id: Date.now(),
              threadId,
              direction: "inbound" as const,
              senderName: "社長",
              body: optionText,
              sentAt: new Date().toISOString(),
            },
          ];

          return {
            ...thread,
            status: "closed" as const,
            messages: updatedMessages,
          };
        }
        return thread;
      })
    );

    addToast("返信を送信しました！", "info");

    // Simulate agent programming and producing artifact after 4 seconds
    setTimeout(() => {
      const activeThread = emailThreads.find((t) => t.id === threadId)!;
      const targetTask = tasks.find((t) => t.id === activeThread.taskId)!;

      // Mark task as completed
      setTasks((prev) =>
        prev.map((t) => (t.id === targetTask.id ? { ...t, status: "completed" } : t))
      );

      // Create new website/app artifact
      const newArtifact: Artifact = {
        id: Date.now(),
        taskId: targetTask.id,
        type: "website",
        createdBy: `${activeThread.agentName} & Equipe`,
        content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Projeto: ${targetTask.title}</title>
  <style>
    body {
      background: #0f172a;
      color: #f8fafc;
      font-family: sans-serif;
      text-align: center;
      padding: 50px;
    }
    .container {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 30px;
      display: inline-block;
    }
    h1 { color: #38bdf8; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 ${targetTask.title}</h1>
    <p>このサイトは社長の指示に従って自動生成されました。</p>
    <div style="font-size: 1.5rem; margin-top: 20px;">⚡ 稼働コードのビルド完了 ⚡</div>
  </div>
</body>
</html>`,
        createdAt: new Date().toISOString(),
      };

      setArtifacts((prev) => [...prev, newArtifact]);

      // Add follow up message closing the thread
      setEmailThreads((prev) =>
        prev.map((thread) => {
          if (thread.id === threadId) {
            return {
              ...thread,
              messages: [
                ...thread.messages,
                {
                  id: Date.now() + 1,
                  threadId,
                  direction: "outbound" as const,
                  senderName: thread.agentName,
                  body: `社長！プロジェクト「${targetTask.title}」の実装とテストが完了しました！作業室で成果物を確認できますよ！🍡`,
                  sentAt: new Date().toISOString(),
                },
              ],
            };
          }
          return thread;
        })
      );

      // Reset meeting room state
      setActiveMeeting(null);
      setCurrentMeetingReport(null);

      addToast(`タスク完了: ${targetTask.title}!`, "success");
    }, 4000);
  };

  const activeNotificationsCount = emailThreads.filter(
    (t) => t.status === "open" && t.messages[t.messages.length - 1].direction === "outbound"
  ).length;

  return (
    <div className="app">
      <header>
        <h1>AIエージェントお仕事ゲーム</h1>
        <p className="subtitle">
          プレイヤーは社長！マスコット風エージェントたちが奮闘するお仕事解決ゲーム
        </p>
      </header>

      {/* Main Glassmorphic Room Navigation Tabs */}
      <nav className="room-nav">
        {ROOMS.map((r) => (
          <button
            key={r.id}
            className={r.id === activeRoom ? "room-button active" : "room-button"}
            onClick={() => handleRoomNavClick(r.id)}
          >
            <span>{r.emoji}</span>
            {r.title}
          </button>
        ))}
      </nav>

      {/* Primary Room View Grid */}
      <main className="room-view">
        {activeRoom === "president" && (
          <PresidentRoom
            hiredAgents={hiredAgents}
            tasks={tasks}
            onOpenHiring={() => setIsHiringOpen(true)}
            onSelectTask={(task) => {
              handleRoomNavClick("meeting");
              addToast(`Selecione o Líder para iniciar: ${task.title}`, "info");
            }}
          />
        )}

        {activeRoom === "meeting" && (
          <MeetingRoom
            hiredAgents={hiredAgents}
            tasks={tasks}
            activeMeeting={activeMeeting}
            onStartMeeting={handleStartMeeting}
            onCompleteMeeting={handleCompleteMeeting}
            meetingReport={currentMeetingReport}
            onViewReport={handleViewReport}
          />
        )}

        {activeRoom === "work" && (
          <WorkRoom
            hiredAgents={hiredAgents}
            artifacts={artifacts}
            onViewArtifact={handleViewArtifact}
            isMeetingCompleted={!!activeMeeting}
          />
        )}
      </main>

      {/* Interactive Mobile Chat Overlay */}
      <MobileChat
        threads={emailThreads}
        onReply={handleChatReply}
        activeNotificationsCount={activeNotificationsCount}
      />

      {/* Hiring Modal */}
      <Modal isOpen={isHiringOpen} onClose={() => setIsHiringOpen(false)} title="雇用オフィス">
        <HiringScreen onHire={handleHireAgent} hiredAgents={hiredAgents} />
      </Modal>

      {/* Report / Artifact Viewer Modal */}
      <Modal
        isOpen={isReportViewerOpen}
        onClose={() => setIsReportViewerOpen(false)}
        title={selectedReport ? "技術設計レポート" : "成果物プレビュー"}
      >
        <ReportViewer report={selectedReport} artifact={selectedArtifact} />
      </Modal>

      {/* Room Transition Confirmation Modal */}
      <Modal
        isOpen={roomChangeTarget !== null}
        onClose={() => setRoomChangeTarget(null)}
        title="エリア移動確認"
      >
        <div style={{ textAlign: "center", padding: "1rem" }}>
          <p style={{ fontSize: "1.1rem", marginBottom: "1.5rem" }}>
            ドアを開けて <strong>{ROOMS.find((r) => r.id === roomChangeTarget)?.title}</strong> に移動しますか？
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
            <button className="btn-secondary" onClick={() => setRoomChangeTarget(null)}>
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
