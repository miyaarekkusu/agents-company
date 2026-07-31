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
}

export const MeetingRoom: React.FC<MeetingRoomProps> = ({
  hiredAgents,
  tasks,
  activeMeeting,
  onStartMeeting,
  onCompleteMeeting,
  meetingReport,
  onViewReport,
}) => {
  const [wizardStep, setWizardStep] = useState<"idle" | "select_task" | "select_leader" | "select_participants">("idle");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedLeaderId, setSelectedLeaderId] = useState<number | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);

  const pendingTasks = tasks.filter((t) => t.status === "pending");

  const handleStartWizard = () => {
    if (hiredAgents.length === 0) {
      alert("Contrate ao menos um agente na Sala do Presidente antes de iniciar reuniões!");
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
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* 2D Room Area */}
      <div
        className="glass-panel"
        style={{
          height: "300px",
          position: "relative",
          backgroundImage: "linear-gradient(to bottom, #0f172a 0%, #1e1b4b 100%)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "16px",
          overflow: "hidden",
          padding: "20px"
        }}
      >
        <div style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.85rem", position: "absolute", top: "15px", left: "20px" }}>
          🤝 会議室
        </div>

        {/* Conference Table */}
        <div
          style={{
            position: "absolute",
            bottom: "45px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "300px",
            height: "75px",
            background: "radial-gradient(ellipse at center, #312e81 0%, #1e1b4b 100%)",
            borderRadius: "50%",
            boxShadow: "0 12px 24px rgba(0,0,0,0.6)",
            border: "2px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: "0.85rem",
            fontWeight: "bold",
            letterSpacing: "2px"
          }}
        >
          {activeMeeting && activeMeeting.status === "discussing" ? "💭 会議進行中" : "円卓会議テーブル"}
        </div>

        {/* Render gathered agents if active meeting */}
        {activeMeeting && (
          <>
            {/* Leader at the head of the table */}
            {currentLeader && (
              <CharacterSprite
                name={`👑 ${currentLeader.name}`}
                roleId={currentLeader.role.id}
                state={activeMeeting.status === "discussing" ? "discussing" : "idle"}
                style={{ position: "absolute", bottom: "115px", left: "50%", transform: "translateX(-50%)" }}
              />
            )}

            {/* Support participants */}
            {currentParticipants.map((p, idx) => {
              // Position participants on the sides of the table
              const offset = 80 + idx * 80;
              const side = idx % 2 === 0 ? "left" : "right";
              const positionStyle =
                side === "left"
                  ? { bottom: "45px", left: `${offset}px` }
                  : { bottom: "45px", right: `${offset}px` };

              return (
                <CharacterSprite
                  key={p.id}
                  name={p.name}
                  roleId={p.role.id}
                  state={activeMeeting.status === "discussing" ? "discussing" : "sitting"}
                  style={{ position: "absolute", ...positionStyle }}
                />
              );
            })}
          </>
        )}

        {/* Empty room action button */}
        {!activeMeeting && wizardStep === "idle" && (
          <div
            onClick={handleStartWizard}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "var(--primary-color)",
              padding: "15px 30px",
              borderRadius: "30px",
              fontWeight: "bold",
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 0 20px var(--primary-glow)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center"
            }}
          >
            <span>💬 会議を始める</span>
            <span style={{ fontSize: "0.7rem", fontWeight: "normal", opacity: 0.8 }}>新規設計・立案</span>
          </div>
        )}
      </div>

      {/* Wizard Flow Controls */}
      {wizardStep === "select_task" && (
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>ステップ 1: お題 (タスク) の選択</h3>
          {pendingTasks.length === 0 ? (
            <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)" }}>
              未着手のお題はありません！社長室で新しい仕事を選択してください。
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
          <button className="btn-secondary" style={{ marginTop: "1rem" }} onClick={() => setWizardStep("idle")}>
            キャンセル
          </button>
        </div>
      )}

      {wizardStep === "select_leader" && (
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>ステップ 2: 会議の議長 (リーダー) を選出</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
            {hiredAgents.map((a) => (
              <button
                key={a.id}
                className="btn-secondary"
                style={{ padding: "12px", textAlign: "center" }}
                onClick={() => handleLeaderConfirm(a.id)}
              >
                <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>👤</div>
                <strong>{a.name}</strong>
                <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{a.role.name}</div>
              </button>
            ))}
          </div>
          <button className="btn-secondary" style={{ marginTop: "1rem" }} onClick={() => setWizardStep("select_task")}>
            戻る
          </button>
        </div>
      )}

      {wizardStep === "select_participants" && (
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>ステップ 3: 会議に参加させるメンバーの選択</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "1rem" }}>
            {hiredAgents
              .filter((a) => a.id !== selectedLeaderId)
              .map((a) => (
                <label
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: "8px",
                    cursor: "pointer"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedParticipants.includes(a.id)}
                    onChange={() => handleToggleParticipant(a.id)}
                  />
                  <div>
                    <strong>{a.name}</strong>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "8px" }}>
                      ({a.role.name})
                    </span>
                  </div>
                </label>
              ))}
            {hiredAgents.filter((a) => a.id !== selectedLeaderId).length === 0 && (
              <div style={{ color: "var(--text-muted)", padding: "10px" }}>会議に参加可能な他のエージェントがいません。</div>
            )}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn-secondary" onClick={() => setWizardStep("select_leader")}>
              戻る
            </button>
            <button className="btn-primary" onClick={handleLaunchMeeting}>
              会議を開始してプランを策定する
            </button>
          </div>
        </div>
      )}

      {/* Meeting Active Controls */}
      {activeMeeting && (
        <div className="glass-panel" style={{ padding: "1.5rem", borderLeft: "4px solid var(--accent-neon)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                {activeMeeting.status === "discussing" ? "💭 アイデア出しと議論中" : "✅ 会議レポートが完成しました！"}
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                議長: {currentLeader?.name} • 参加メンバー: {currentParticipants.length}人
              </p>
            </div>
            <div>
              {activeMeeting.status === "discussing" ? (
                <button
                  className="btn-primary"
                  onClick={onCompleteMeeting}
                  style={{ background: "var(--accent-neon)", boxShadow: "0 0 10px var(--accent-glow)" }}
                >
                  会議を結了する
                </button>
              ) : (
                meetingReport && (
                  <button className="btn-primary" onClick={onViewReport}>
                    📄 会議レポートを読む
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
