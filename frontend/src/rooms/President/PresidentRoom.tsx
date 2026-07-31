import React from "react";
import { type Agent } from "../../mocks/agents";
import { type Task } from "../../mocks/tasks";
import { CharacterSprite } from "../../components/Character/CharacterSprite";

interface PresidentRoomProps {
  hiredAgents: Agent[];
  tasks: Task[];
  onOpenHiring: () => void;
  onSelectTask: (task: Task) => void;
}

export const PresidentRoom: React.FC<PresidentRoomProps> = ({
  hiredAgents,
  tasks,
  onOpenHiring,
  onSelectTask,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* 2D Room visualization area */}
      <div
        className="glass-panel"
        style={{
          height: "260px",
          position: "relative",
          backgroundImage: "linear-gradient(to bottom, #111827 0%, #1e293b 100%)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "16px",
          overflow: "hidden",
          padding: "20px"
        }}
      >
        {/* Office details */}
        <div style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.85rem", position: "absolute", top: "15px", left: "20px" }}>
          🏢 社長室
        </div>

        {/* President desk */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            left: "100px",
            width: "120px",
            height: "50px",
            background: "#4f46e5",
            borderRadius: "6px",
            boxShadow: "0 10px 20px rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.8rem",
            color: "#fff",
            fontWeight: "bold"
          }}
        >
          💻 執務机
        </div>

        {/* President Mascot Character */}
        <CharacterSprite
          name="社長 (あなた)"
          roleId="president"
          state="idle"
          style={{ position: "absolute", bottom: "85px", left: "130px" }}
        />

        {/* Tech Hiring Station */}
        <div
          onClick={onOpenHiring}
          style={{
            position: "absolute",
            bottom: "40px",
            right: "120px",
            width: "110px",
            height: "60px",
            background: "#06b6d4",
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
            animation: "pulseGlow 2s infinite"
          }}
        >
          <span>🤝 採用デスク</span>
          <span style={{ fontSize: "0.6rem", opacity: 0.8 }}>(エージェント採用)</span>
        </div>
      </div>

      {/* Control Panels below visualization */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Staff Management Panel */}
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

        {/* Task Board Panel */}
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
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
    </div>
  );
};
