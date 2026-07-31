import React, { useState, useEffect } from "react";
import { type Agent } from "../../mocks/agents";
import { type Artifact } from "../../mocks/tasks";
import { CharacterSprite } from "../../components/Character/CharacterSprite";

interface WorkRoomProps {
  hiredAgents: Agent[];
  artifacts: Artifact[];
  onViewArtifact: (artifact: Artifact) => void;
  isMeetingCompleted: boolean;
}

export const WorkRoom: React.FC<WorkRoomProps> = ({
  hiredAgents,
  artifacts,
  onViewArtifact,
  isMeetingCompleted,
}) => {
  const [logs, setLogs] = useState<string[]>([
    "[システム] 作業室が初期化されました。",
    "[システム] 会議レポートの受信を待機中..."
  ]);

  // Simulate WebSocket stream of logs if a meeting is completed and agents are coding
  useEffect(() => {
    if (!isMeetingCompleted || hiredAgents.length === 0) return;

    const interval = setInterval(() => {
      const activeAgent = hiredAgents[Math.floor(Math.random() * hiredAgents.length)];
      const templates = [
        `[${activeAgent.name}] メインモジュールの開発を開始中...`,
        `[${activeAgent.name}] 単体テストを作成し、応答をモック中...`,
        `[${activeAgent.name}] コンテナログを分析し、依存関係を解決中...`,
        `[${activeAgent.name}] UIのリファクタリングとレスポンシブ動作を検証中...`,
        `[${activeAgent.name}] Viteを使用したパフォーマンス最適化とビルドを実行中...`,
        `[${activeAgent.name}] 継続的インテグレーション：すべてのテストに合格しました！✨`,
      ];
      const randomLog = templates[Math.floor(Math.random() * templates.length)];
      setLogs((prev) => [...prev.slice(-30), randomLog]); // Keep last 30 logs
    }, 4500);

    return () => clearInterval(interval);
  }, [isMeetingCompleted, hiredAgents]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* 2D Room Visualization */}
      <div
        className="glass-panel"
        style={{
          height: "300px",
          position: "relative",
          backgroundImage: "linear-gradient(to bottom, #090d16 0%, #1e1b4b 100%)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "16px",
          overflow: "hidden",
          padding: "20px"
        }}
      >
        <div style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.85rem", position: "absolute", top: "15px", left: "20px" }}>
          💻 作業室
        </div>

        {/* Workstations Grid */}
        <div style={{ display: "flex", justifyContent: "space-around", width: "100%", position: "absolute", bottom: "40px", left: 0, padding: "0 20px" }}>
          {hiredAgents.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", paddingBottom: "20px" }}>
              現在、稼働中のエージェントはいません。
            </div>
          ) : (
            hiredAgents.map((agent) => (
              <div
                key={agent.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  position: "relative",
                  width: "120px"
                }}
              >
                {/* Agent Mascot */}
                <CharacterSprite
                  name={agent.name}
                  roleId={agent.role.id}
                  state={isMeetingCompleted ? "walking" : "idle"}
                />

                {/* Desk and Monitor Visual */}
                <div
                  style={{
                    width: "80px",
                    height: "35px",
                    background: "#334155",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: "4px 4px 0 0",
                    marginTop: "50px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    paddingTop: "2px",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.5)"
                  }}
                >
                  {/* Miniature monitor */}
                  <div
                    style={{
                      width: "40px",
                      height: "20px",
                      background: isMeetingCompleted ? "#06b6d4" : "#1e293b",
                      borderRadius: "2px",
                      border: "1px solid #94a3b8",
                      boxShadow: isMeetingCompleted ? "0 0 10px rgba(6, 182, 212, 0.6)" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.5rem",
                      color: "#fff"
                    }}
                  >
                    {isMeetingCompleted ? "💻 100%" : "OFF"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Terminal Live Stream Logs & Output Panel */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
        {/* WebSocket log simulation panel */}
        <div className="glass-panel" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "8px" }}>
            🖥️ 作業ログ・ターミナル
            {isMeetingCompleted && <span style={{ fontSize: "0.75rem", background: "var(--success-color)", color: "#fff", padding: "2px 6px", borderRadius: "10px", animation: "pulseGlow 1.5s infinite" }}>稼働中</span>}
          </h3>
          <div
            style={{
              background: "#05070c",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px",
              padding: "12px",
              fontFamily: "monospace",
              fontSize: "0.8rem",
              height: "200px",
              overflowY: "auto",
              color: "#38bdf8",
              display: "flex",
              flexDirection: "column",
              gap: "4px"
            }}
          >
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>

        {/* Produced Artifacts Board */}
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>📦 成果物 (アーティファクト)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
            {artifacts.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", padding: "10px", textAlign: "center" }}>
                生成された成果物はまだありません。
              </div>
            ) : (
              artifacts.map((art) => (
                <div
                  key={art.id}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    padding: "10px",
                    borderRadius: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}
                >
                  <div style={{ fontSize: "0.85rem", fontWeight: "bold" }}>和菓子屋の紹介サイト</div>
                  <button
                    onClick={() => onViewArtifact(art)}
                    className="btn-primary"
                    style={{ padding: "4px 8px", fontSize: "0.75rem", background: "var(--secondary-color)", boxShadow: "0 0 8px var(--secondary-glow)" }}
                  >
                    成果物を確認
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
