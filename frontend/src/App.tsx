import { useState, useEffect } from "react";
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
import { type CharacterState, type SpriteDirection } from "./components/Character/CharacterSprite";

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

  // Agent visual coordinates state
  const [agentPositions, setAgentPositions] = useState<Record<number, AgentPosition>>({});

  // Work Room living logs
  const [workLogs, setWorkLogs] = useState<string[]>([
    "[システム] 作業室が初期化されました。",
    "[システム] 会議レポートの受信を待機中..."
  ]);

  const addToast = (text: string, type: "info" | "success" = "info") => {
    setToasts((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, text, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Agent Walking Trigger Helper
  const triggerAgentWalk = (
    agentId: number,
    start: { x: number | string; y: number | string },
    end: { x: number | string; y: number | string },
    duration: number,
    finalState: CharacterState,
    finalDir: SpriteDirection,
    speech?: string
  ) => {
    // 1. Teleport to start position
    let initialDir: SpriteDirection = "front";
    if (typeof start.x === "number" && typeof end.x === "number") {
      initialDir = end.x > start.x ? "right" : "left";
    }

    setAgentPositions((prev) => ({
      ...prev,
      [agentId]: {
        x: start.x,
        y: start.y,
        dir: initialDir,
        state: "walking",
        noTransition: true,
        speech,
      }
    }));

    // 2. Start moving after a brief render delay
    setTimeout(() => {
      setAgentPositions((prev) => {
        if (!prev[agentId]) return prev;
        const startX = typeof prev[agentId].x === "number" ? (prev[agentId].x as number) : 0;
        const endX = typeof end.x === "number" ? (end.x as number) : 0;
        let walkDir: SpriteDirection = "right";
        if (endX < startX) walkDir = "left";

        return {
          ...prev,
          [agentId]: {
            ...prev[agentId],
            x: end.x,
            y: end.y,
            dir: walkDir,
            state: "walking",
            noTransition: false,
          }
        };
      });
    }, 50);

    // 3. Set to final static state when the walk concludes
    setTimeout(() => {
      setAgentPositions((prev) => {
        if (!prev[agentId]) return prev;
        return {
          ...prev,
          [agentId]: {
            ...prev[agentId],
            state: finalState,
            dir: finalDir,
            noTransition: false,
          }
        };
      });
    }, duration + 50);
  };

  // Sync Positions: Init or trigger hire walk when a new agent is added
  useEffect(() => {
    hiredAgents.forEach((agent) => {
      if (!agentPositions[agent.id]) {
        // Compute spawn coordinates
        const isInitial = agent.id === 1; // ひらめきポン太 is pre-hired
        const targetX = 35 + (agent.id * 10) % 45;
        const targetY = 70 + (agent.id * 5) % 15;

        if (isInitial) {
          setAgentPositions((prev) => ({
            ...prev,
            [agent.id]: {
              x: targetX,
              y: targetY,
              dir: "front",
              state: "idle",
              noTransition: true,
            }
          }));
        } else {
          // Hiring spawn desk is at (x: 80%, y: 50px)
          // Walks to idle area
          triggerAgentWalk(
            agent.id,
            { x: 80, y: 50 },
            { x: targetX, y: targetY },
            2000,
            "idle",
            "front",
            "社長！雇用ありがとうございます！"
          );
        }
      }
    });
  }, [hiredAgents]);

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

    // Leader walks from left door to table head
    triggerAgentWalk(
      leaderId,
      { x: -10, y: 70 },
      { x: 50, y: 115 },
      2000,
      "discussing",
      "front",
      "ミーティングを始めよう！"
    );

    // Participants walk to side seats
    participantsIds.forEach((pid, index) => {
      const side = index % 2 === 0 ? "left" : "right";
      const seatX = side === "left" ? 25 - index * 10 : 75 + index * 10;
      triggerAgentWalk(
        pid,
        { x: -15, y: 45 },
        { x: seatX, y: 45 },
        2000,
        "sitting",
        side === "left" ? "right" : "left"
      );
    });
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

  // Send Direct Instruction (Shiji) to an Agent
  const handleSendShiji = (agentId: number, text: string) => {
    const agent = hiredAgents.find(a => a.id === agentId);
    if (!agent) return;

    // Show dynamic chat bubble on the agent
    setAgentPositions((prev) => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        speech: `了解！「${text}」を受信しました！`,
      }
    }));

    // Reset speech bubble after 4 seconds
    setTimeout(() => {
      setAgentPositions((prev) => {
        if (!prev[agentId]) return prev;
        return {
          ...prev,
          [agentId]: {
            ...prev[agentId],
            speech: undefined,
          }
        };
      });
    }, 4000);

    // Append logs to the Work Room terminal
    const shijiTime = new Date().toLocaleTimeString();
    setWorkLogs((prev) => [
      ...prev,
      `[${shijiTime}] [システム] 社長より指示：「${text}」を受信しました。`,
      `[${shijiTime}] [${agent.name}] 了解！指示された仕様でロジックを最適化します。`
    ]);

    addToast(`${agent.name}へ指示を送信しました！`, "success");
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

    addToast("返信を送信しました！作業を開始します", "info");

    // Trigger walk to Work Room workstations immediately
    if (activeMeeting) {
      const workingAgents = [activeMeeting.leaderId, ...activeMeeting.participantsIds];
      workingAgents.forEach((pid, index) => {
        const seatX = 20 + index * 30; // workstations are distributed at 20%, 50%, 80%
        triggerAgentWalk(
          pid,
          { x: -10, y: 50 },
          { x: seatX, y: 50 },
          2000,
          "working",
          "back",
          "実装に入ります！"
        );
      });
    }

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
        createdBy: `${activeThread.agentName} & チーム`,
        content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>プロジェクト: ${targetTask.title}</title>
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

      // Trigger return walk to President Room
      if (activeMeeting) {
        const workingAgents = [activeMeeting.leaderId, ...activeMeeting.participantsIds];
        
        // 1. Walk off-screen left of Work Room
        workingAgents.forEach((pid, index) => {
          triggerAgentWalk(
            pid,
            { x: 20 + index * 30, y: 50 },
            { x: -20, y: 50 },
            1500,
            "idle",
            "left",
            "作業完了！社長室へ戻ります！"
          );
        });

        // 2. Walk into President Room from right side
        setTimeout(() => {
          workingAgents.forEach((pid) => {
            const targetX = 35 + (pid * 10) % 45;
            const targetY = 70 + (pid * 5) % 15;
            triggerAgentWalk(
              pid,
              { x: 120, y: 70 },
              { x: targetX, y: targetY },
              2000,
              "idle",
              "front"
            );
          });
        }, 1600);
      }

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
              addToast(`リーダーを選択して会議を開始してください: ${task.title}`, "info");
            }}
            agentPositions={agentPositions}
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
            agentPositions={agentPositions}
          />
        )}

        {activeRoom === "work" && (
          <WorkRoom
            hiredAgents={hiredAgents}
            artifacts={artifacts}
            onViewArtifact={handleViewArtifact}
            isMeetingCompleted={!!activeMeeting}
            logs={workLogs}
            setLogs={setWorkLogs}
            onSendShiji={handleSendShiji}
            activeMeeting={activeMeeting}
            agentPositions={agentPositions}
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
