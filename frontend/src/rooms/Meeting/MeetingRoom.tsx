import React, { useState } from "react";
import { type Agent } from "../../mocks/agents";
import { type Task, type MeetingReport } from "../../mocks/tasks";
import { CharacterSprite } from "../../components/Character/CharacterSprite";

interface MeetingRoomProps {
  hiredAgents: Agent[];
  tasks: Task[];
  activeMeeting: {
    taskId: number;
    leaderId: number;
    participantsIds: number[];
    status: "discussing" | "completed";
  } | null;
  onStartMeeting: (taskId: number, leaderId: number, participantsIds: number[]) => void;
  onCompleteMeeting: () => void;
  meetingReport: MeetingReport | null;
  onViewReport: () => void;
  agentPositions: Record<number, any>;
}

export const MeetingRoom: React.FC<MeetingRoomProps> = ({
  hiredAgents,
  tasks,
  activeMeeting,
  onStartMeeting,
  onCompleteMeeting,
  meetingReport,
  onViewReport,
  agentPositions,
}) => {
  const [wizardStep, setWizardStep] = useState<"idle" | "select_task" | "select_leader" | "select_participants">("idle");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedLeaderId, setSelectedLeaderId] = useState<number | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);

  const pendingTasks = tasks.filter((t) => t.status === "pending");

  const handleStartWizard = () => {
    if (hiredAgents.length === 0) {
      alert("社長室の「採用デスク」でエージェントを雇用してから会議を開始してください！");
      return;
    }
    setWizardStep("select_task");
  };

  const handleTaskConfirm = (taskId: number) => {
    setSelectedTaskId(taskId);
    setWizardStep("select_leader");
  };

  const handleLeaderConfirm = (leaderId: number) => {
    setSelectedLeaderId(leaderId);
    setSelectedParticipants([]);
    setWizardStep("select_participants");
  };

  const handleToggleParticipant = (id: number) => {
    if (selectedParticipants.includes(id)) {
      setSelectedParticipants(selectedParticipants.filter((pid) => pid !== id));
    } else {
      setSelectedParticipants([...selectedParticipants, id]);
    }
  };

  const handleLaunchMeeting = () => {
    if (selectedTaskId && selectedLeaderId) {
      onStartMeeting(selectedTaskId, selectedLeaderId, selectedParticipants);
      setWizardStep("idle");
    }
  };

  // Find participants for active meeting
  const currentLeader = activeMeeting
    ? hiredAgents.find((a) => a.id === activeMeeting.leaderId)
    : null;
  const currentParticipants = activeMeeting
    ? hiredAgents.filter((a) => activeMeeting.participantsIds.includes(a.id))
    : [];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "1.5rem", alignItems: "start" }}>
      {/* Left Column: Meeting Control / Wizard */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* 会議が開始されていない状態のデフォルトパネル */}
        {!activeMeeting && wizardStep === "idle" && (
          <div className="glass-panel" style={{ padding: "1.5rem" }}>
            <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>🤝 会議コントロール</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.5rem", lineHeight: "1.5" }}>
              新規プロジェクトの設計や、仕様策定のための会議を開始できます。エージェントが集まり議論します。
            </p>
            <button
              onClick={handleStartWizard}
              className="btn-primary"
              style={{ width: "100%", padding: "12px", borderRadius: "10px", fontWeight: "bold" }}
            >
              💬 会議を始める
            </button>
          </div>
        )}

        {/* ウィザード形式の会議設定パネル */}
        {wizardStep === "select_task" && (
          <div className="glass-panel" style={{ padding: "1.5rem" }}>
            <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>ステップ 1: お題 (タスク) の選択</h3>
            {pendingTasks.length === 0 ? (
              <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                未着手のお題はありません！社長室で新しい仕事を選択してください。
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto" }}>
                {pendingTasks.map((t) => (
                  <button
                    key={t.id}
                    className="btn-secondary"
                    style={{ textAlign: "left", padding: "12px", display: "flex", flexDirection: "column", gap: "4px" }}
                    onClick={() => handleTaskConfirm(t.id)}
                  >
                    <strong style={{ fontSize: "0.95rem" }}>{t.title}</strong>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{t.description}</span>
                  </button>
                ))}
              </div>
            )}
            <button className="btn-secondary" style={{ marginTop: "1rem", width: "100%" }} onClick={() => setWizardStep("idle")}>
              キャンセル
            </button>
          </div>
        )}

        {wizardStep === "select_leader" && (
          <div className="glass-panel" style={{ padding: "1.5rem" }}>
            <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>ステップ 2: 議長 (リーダー) を選出</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", maxHeight: "250px", overflowY: "auto" }}>
              {hiredAgents.map((a) => (
                <button
                  key={a.id}
                  className="btn-secondary"
                  style={{ padding: "12px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}
                  onClick={() => handleLeaderConfirm(a.id)}
                >
                  <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>👤</div>
                  <strong style={{ fontSize: "0.85rem" }}>{a.name}</strong>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{a.role.name}</div>
                </button>
              ))}
            </div>
            <button className="btn-secondary" style={{ marginTop: "1rem", width: "100%" }} onClick={() => setWizardStep("select_task")}>
              戻る
            </button>
          </div>
        )}

        {wizardStep === "select_participants" && (
          <div className="glass-panel" style={{ padding: "1.5rem" }}>
            <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>ステップ 3: 参加メンバーの選択</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto", marginBottom: "1rem" }}>
              {hiredAgents
                .filter((a) => a.id !== selectedLeaderId)
                .map((a) => (
                  <div
                    key={a.id}
                    onClick={() => handleToggleParticipant(a.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px",
                      background: selectedParticipants.includes(a.id) 
                        ? "rgba(168, 85, 247, 0.12)" 
                        : "rgba(255,255,255,0.03)",
                      border: selectedParticipants.includes(a.id)
                        ? "2px solid var(--accent-neon)"
                        : "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: "12px",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ fontSize: "1.2rem" }}>🤖</div>
                      <div>
                        <strong style={{ fontSize: "0.85rem" }}>{a.name}</strong>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                          {a.role.name}
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        background: selectedParticipants.includes(a.id) ? "var(--accent-neon)" : "transparent",
                        border: selectedParticipants.includes(a.id) ? "none" : "1px solid rgba(255,255,255,0.2)",
                        color: "#fff",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "0.7rem",
                        fontWeight: "bold"
                      }}
                    >
                      {selectedParticipants.includes(a.id) ? "✓ 参加" : "追加"}
                    </span>
                  </div>
                ))}
              {hiredAgents.filter((a) => a.id !== selectedLeaderId).length === 0 && (
                <div style={{ color: "var(--text-muted)", padding: "10px", textAlign: "center", fontSize: "0.8rem" }}>
                  会議に参加可能な他のエージェントがいません。
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setWizardStep("select_leader")}>
                戻る
              </button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={handleLaunchMeeting}>
                会議を開始する
              </button>
            </div>
          </div>
        )}

        {/* アクティブな会議の進行コントロールパネル */}
        {activeMeeting && (
          <div className="glass-panel" style={{ padding: "1.5rem", borderLeft: "4px solid var(--accent-neon)" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
              {activeMeeting.status === "discussing" ? "💭 アイデア出しと議論中" : "✅ 会議が結了しました"}
            </h3>
            <p style={{ margin: "4px 0 16px 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              議長: {currentLeader?.name} • 参加メンバー: {currentParticipants.length}人
            </p>
            <div>
              {activeMeeting.status === "discussing" ? (
                <button
                  className="btn-primary"
                  onClick={onCompleteMeeting}
                  style={{ width: "100%", background: "var(--accent-neon)", boxShadow: "0 0 10px var(--accent-glow)", padding: "10px" }}
                >
                  会議を結了する
                </button>
              ) : (
                meetingReport && (
                  <button className="btn-primary" style={{ width: "100%", padding: "10px" }} onClick={onViewReport}>
                    📄 会議レポートを読む
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: 2D Visual Room */}
      <div
        className="glass-panel floor-carpet"
        style={{
          height: "480px",
          position: "relative",
          overflow: "hidden",
          padding: "20px"
        }}
      >
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.85rem", position: "absolute", top: "15px", left: "20px", zIndex: 10 }}>
          🤝 会議室
        </div>

        {/* 円卓会議用テーブル */}
        <div
          className="meeting-table-oval"
          style={{
            position: "absolute",
            bottom: "150px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "320px",
            height: "80px",
            background: "radial-gradient(ellipse at center, #2e2a72 0%, #16143c 100%)",
            borderRadius: "50%",
            boxShadow: "0 12px 24px rgba(0,0,0,0.6)",
            border: "2px solid rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: "0.85rem",
            fontWeight: "bold",
            letterSpacing: "2px",
            zIndex: 4
          }}
        >
          {activeMeeting && activeMeeting.status === "discussing" ? "💭 会議進行中" : "円卓会議テーブル"}
        </div>

        {/* 会議進行中のエージェントと椅子の描画 */}
        {activeMeeting && (
          <>
            {hiredAgents
              .filter((a) => a.id === activeMeeting.leaderId || activeMeeting.participantsIds.includes(a.id))
              .map((agent) => {
                const pos = agentPositions[agent.id];
                if (!pos) return null;
                return (
                  <React.Fragment key={agent.id}>
                    {/* エージェント背後のオフィスチェアの描画 */}
                    <div 
                      className="chair-topdown" 
                      style={{ 
                        left: typeof pos.x === "number" ? `${pos.x}%` : pos.x,
                        bottom: typeof pos.y === "number" ? `${pos.y * 1.6 + 12}px` : pos.y,
                        transition: pos.noTransition ? "none" : "left 2s ease-in-out, bottom 2s ease-in-out",
                      }}
                    />
                    
                    {/* エージェントキャラクター */}
                    <CharacterSprite
                      name={agent.id === activeMeeting.leaderId ? `👑 ${agent.name}` : agent.name}
                      roleId={agent.role.id}
                      state={pos.state}
                      direction={pos.dir}
                      speechBubble={pos.speech}
                      style={{
                        position: "absolute",
                        left: typeof pos.x === "number" ? `${pos.x}%` : pos.x,
                        bottom: typeof pos.y === "number" ? `${pos.y * 1.6}px` : pos.y,
                        transition: pos.noTransition ? "none" : "left 2s ease-in-out, bottom 2s ease-in-out",
                        transform: "translateX(-50%)",
                        zIndex: 5
                      }}
                    />
                  </React.Fragment>
                );
              })}
          </>
        )}
      </div>
    </div>
  );
};
