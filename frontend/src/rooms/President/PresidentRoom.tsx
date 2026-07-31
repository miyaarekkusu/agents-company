import React from "react";
import { type Agent } from "../../mocks/agents";
import { type Task } from "../../mocks/tasks";
import { CharacterSprite } from "../../components/Character/CharacterSprite";

interface PresidentRoomProps {
  hiredAgents: Agent[];
  tasks: Task[];
  onOpenHiring: () => void;
  onSelectTask: (task: Task) => void;
  agentPositions: Record<number, any>;
}

export const PresidentRoom: React.FC<PresidentRoomProps> = ({
  hiredAgents,
  tasks,
  onOpenHiring,
  onSelectTask,
  agentPositions,
}) => {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "1.5rem", alignItems: "start" }}>
      {/* Left Column: Management Panels */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* スタッフ管理パネル */}
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>👥 雇用中のエージェント ({hiredAgents.length})</h3>
            <button onClick={onOpenHiring} className="btn-primary" style={{ padding: "4px 10px", fontSize: "0.8rem" }}>
              + 採用
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
            {hiredAgents.map((agent) => (
              <div
                key={agent.id}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  padding: "10px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px"
                }}
              >
                <div style={{ fontSize: "1.5rem" }}>🤖</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{agent.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    {agent.role.name} • <span style={{ color: "var(--secondary-color)" }}>{agent.aiModel.display_name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* お題・タスク管理パネル */}
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>📋 依頼中のお題 (タスク)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
            {tasks.map((task) => (
              <div
                key={task.id}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  padding: "10px",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div style={{ flex: 1, paddingRight: "8px" }}>
                  <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{task.title}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: "1.4" }}>
                    {task.description}
                  </div>
                </div>
                <div>
                  {task.status === "pending" ? (
                    <button
                      onClick={() => onSelectTask(task)}
                      className="btn-primary"
                      style={{ padding: "4px 10px", fontSize: "0.75rem", background: "var(--success-color)", boxShadow: "0 0 8px var(--success-glow)" }}
                    >
                      会議にかける
                    </button>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", background: "rgba(255,255,255,0.08)", padding: "3px 8px", borderRadius: "10px" }}>
                      完了
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: 2D Visual Room */}
      <div
        className="glass-panel floor-wood"
        style={{
          height: "480px",
          position: "relative",
          overflow: "hidden",
          padding: "20px"
        }}
      >
        {/* 部屋の情報テキスト */}
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.85rem", position: "absolute", top: "15px", left: "20px", zIndex: 10 }}>
          🏢 社長室
        </div>

        {/* 中央の豪華なレッドカーペット */}
        <div className="president-carpet" style={{ height: "160px" }} />

        {/* 社長の執務机 */}
        <div
          style={{
            position: "absolute",
            bottom: "120px",
            left: "160px",
            transform: "translateX(-50%)",
            width: "130px",
            height: "48px",
            background: "linear-gradient(180deg, #5c3a21 0%, #362213 100%)",
            borderRadius: "6px",
            boxShadow: "0 8px 16px rgba(0,0,0,0.6)",
            border: "2px solid #82522e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.8rem",
            color: "#ffedd5",
            fontWeight: "bold",
            zIndex: 6
          }}
        >
          💻 執務机
        </div>

        {/* 社長キャラクター（執務机の奥に配置） */}
        <CharacterSprite
          name="社長 (あなた)"
          roleId="president"
          state="idle"
          direction="front"
          style={{ position: "absolute", bottom: "155px", left: "160px", transform: "translateX(-50%)", zIndex: 5 }}
        />

        {/* 雇用中のエージェントたちの動的配置と描画 */}
        {hiredAgents.map((agent) => {
          const pos = agentPositions[agent.id];
          if (!pos) return null;
          return (
            <CharacterSprite
              key={agent.id}
              name={agent.name}
              roleId={agent.role.id}
              state={pos.state}
              direction={pos.dir}
              speechBubble={pos.speech}
              style={{
                position: "absolute",
                left: typeof pos.x === "number" ? `${pos.x}%` : pos.x,
                bottom: typeof pos.y === "number" ? `${pos.y * 1.7}px` : pos.y,
                transition: pos.noTransition ? "none" : "left 2s ease-in-out, bottom 2s ease-in-out",
                transform: "translateX(-50%)",
                zIndex: 8
              }}
            />
          );
        })}

        {/* 採用デスクステーション */}
        <div
          onClick={onOpenHiring}
          style={{
            position: "absolute",
            bottom: "120px",
            right: "120px",
            width: "110px",
            height: "60px",
            background: "linear-gradient(180deg, #0891b2 0%, #0e7490 100%)",
            borderRadius: "12px",
            boxShadow: "0 0 15px rgba(6, 182, 212, 0.4)",
            border: "2px solid #fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            color: "#fff",
            fontWeight: "bold",
            cursor: "pointer",
            animation: "pulseGlow 2s infinite",
            zIndex: 6
          }}
        >
          <span>🤝 採用デスク</span>
          <span style={{ fontSize: "0.6rem", opacity: 0.8 }}>(エージェント採用)</span>
        </div>
      </div>
    </div>
  );
};
