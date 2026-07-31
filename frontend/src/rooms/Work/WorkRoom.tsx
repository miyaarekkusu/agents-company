import React, { useState, useEffect } from "react";
import { type Agent } from "../../mocks/agents";
import { type Artifact } from "../../mocks/tasks";
import { CharacterSprite } from "../../components/Character/CharacterSprite";

interface WorkRoomProps {
  hiredAgents: Agent[];
  artifacts: Artifact[];
  onViewArtifact: (artifact: Artifact) => void;
  isMeetingCompleted: boolean;
  logs: string[];
  setLogs: React.Dispatch<React.SetStateAction<string[]>>;
  onSendShiji: (agentId: number, text: string) => void;
  activeMeeting: {
    taskId: number;
    leaderId: number;
    participantsIds: number[];
    status: "discussing" | "completed";
  } | null;
  agentPositions: Record<number, any>;
}

export const WorkRoom: React.FC<WorkRoomProps> = ({
  hiredAgents,
  artifacts,
  onViewArtifact,
  isMeetingCompleted,
  logs,
  setLogs,
  onSendShiji,
  activeMeeting,
  agentPositions,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<number | "">("");
  const [shijiText, setShijiText] = useState("");

  const activeWorkers = hiredAgents.filter(
    (a) => activeMeeting && (a.id === activeMeeting.leaderId || activeMeeting.participantsIds.includes(a.id))
  );

  // 選択が空の場合、初期値として最初の作業中エージェントを選択
  useEffect(() => {
    if (activeWorkers.length > 0 && selectedAgentId === "") {
      setSelectedAgentId(activeWorkers[0].id);
    }
  }, [activeWorkers, selectedAgentId]);

  // 会議完了後の作業中ログをシミュレート
  useEffect(() => {
    if (!isMeetingCompleted || activeWorkers.length === 0) return;

    const interval = setInterval(() => {
      const activeAgent = activeWorkers[Math.floor(Math.random() * activeWorkers.length)];
      const templates = [
        `[${activeAgent.name}] メインモジュールの開発を開始中...`,
        `[${activeAgent.name}] 単体テストを作成し、応答をモック中...`,
        `[${activeAgent.name}] コンテナログを分析し、依存関係を解決中...`,
        `[${activeAgent.name}] UIのリファクタリングとレスポンシブ動作を検証中...`,
        `[${activeAgent.name}] Viteを使用したパフォーマンス最適化とビルドを実行中...`,
        `[${activeAgent.name}] 継続的インテグレーション：すべてのテストに合格しました！✨`,
      ];
      const randomLog = templates[Math.floor(Math.random() * templates.length)];
      const logTime = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev.slice(-28), `[${logTime}] ${randomLog}`]);
    }, 4500);

    return () => clearInterval(interval);
  }, [isMeetingCompleted, activeWorkers, setLogs]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "1.5rem", alignItems: "start" }}>
      {/* Left Column: Management Panels, Logs & Artifacts */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* エージェントへの指示出しフォーム */}
        {isMeetingCompleted && activeWorkers.length > 0 ? (
          <div className="glass-panel" style={{ padding: "1.5rem", borderLeft: "4px solid var(--secondary-color)" }}>
            <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "8px" }}>
              ⚡ エージェント指示 (Shiji)
            </h3>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (selectedAgentId !== "" && shijiText.trim() !== "") {
                  onSendShiji(Number(selectedAgentId), shijiText.trim());
                  setShijiText("");
                }
              }}
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "500" }}>対象エージェント</label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(Number(e.target.value))}
                  style={{
                    background: "#0f172a",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.15)",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    width: "100%",
                    cursor: "pointer"
                  }}
                >
                  {activeWorkers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.role.name})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "500" }}>指示内容 (お仕事指示)</label>
                <input
                  type="text"
                  placeholder="例: UIの色を鮮やかにして！"
                  value={shijiText}
                  onChange={(e) => setShijiText(e.target.value)}
                  style={{
                    background: "#0f172a",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.15)",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    outline: "none"
                  }}
                />
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                style={{ 
                  background: "var(--secondary-color)", 
                  boxShadow: "0 0 10px var(--secondary-glow)", 
                  padding: "10px 20px",
                  fontSize: "0.85rem",
                  width: "100%"
                }}
                disabled={shijiText.trim() === ""}
              >
                指示を送る
              </button>
            </form>
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: "1.5rem", color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center" }}>
            現在指示を出せるエージェントはいません。
          </div>
        )}

        {/* 作業ログのリアルタイムストリーム表示 */}
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
              height: "180px",
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

        {/* 生成された成果物の一覧表示 */}
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>📦 成果物 (アーティファクト)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "150px", overflowY: "auto" }}>
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
                    justifyContent: "space-between",
                    alignItems: "center"
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

      {/* Right Column: 2D Visual Room */}
      <div
        className="glass-panel floor-tiles"
        style={{
          height: "480px",
          position: "relative",
          overflow: "hidden",
          padding: "20px"
        }}
      >
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.85rem", position: "absolute", top: "15px", left: "20px", zIndex: 10 }}>
          💻 作業室
        </div>

        {/* 右上のサーバーラックと点滅するLEDインジケータ */}
        <div className="server-rack" style={{ top: "30px", right: "25px" }}>
          <div className="server-led-row">
            <span className="server-led green"></span>
            <span className="server-led green"></span>
            <span className="server-led red"></span>
          </div>
          <div className="server-led-row">
            <span className="server-led green"></span>
            <span className="server-led blue"></span>
            <span className="server-led green"></span>
          </div>
          <div className="server-led-row">
            <span className="server-led red"></span>
            <span className="server-led green"></span>
            <span className="server-led blue"></span>
          </div>
        </div>

        <div className="server-rack" style={{ top: "30px", right: "75px" }}>
          <div className="server-led-row">
            <span className="server-led green"></span>
            <span className="server-led blue"></span>
            <span className="server-led green"></span>
          </div>
          <div className="server-led-row">
            <span className="server-led red"></span>
            <span className="server-led green"></span>
            <span className="server-led red"></span>
          </div>
          <div className="server-led-row">
            <span className="server-led green"></span>
            <span className="server-led green"></span>
            <span className="server-led blue"></span>
          </div>
        </div>

        {/* 壁面のカンバンホワイトボード */}
        <div className="kanban-whiteboard" style={{ top: "25px" }} />

        {/* 観葉植物 of デコレーション */}
        <div className="office-plant" style={{ top: "30px", left: "25px" }} />
        <div className="office-plant" style={{ bottom: "25px", left: "25px" }} />

        {/* 各エージェントのデスク位置設定 */}
        {activeWorkers.length === 0 ? (
          <div 
            style={{ 
              position: "absolute", 
              top: "50%", 
              left: "50%", 
              transform: "translate(-50%, -50%)", 
              color: "var(--text-muted)", 
              fontSize: "0.95rem",
              zIndex: 10
            }}
          >
            現在、稼働中のエージェントはいません。会議室でプランを策定してください。
          </div>
        ) : (
          activeWorkers.map((agent) => {
            const pos = agentPositions[agent.id];
            if (!pos) return null;
            return (
              <div
                key={agent.id}
                style={{
                  position: "absolute",
                  left: typeof pos.x === "number" ? `${pos.x}%` : pos.x,
                  bottom: typeof pos.y === "number" ? `${pos.y * 1.6}px` : pos.y,
                  transition: pos.noTransition ? "none" : "left 2s ease-in-out, bottom 2s ease-in-out",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: "120px",
                  transform: "translateX(-50%)",
                  zIndex: 5
                }}
              >
                {/* キャラクター背後のオフィスチェアベース */}
                <div 
                  className="chair-topdown"
                  style={{
                    position: "absolute",
                    top: "35px",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    transition: pos.noTransition ? "none" : "left 2s ease-in-out, bottom 2s ease-in-out",
                  }}
                />

                {/* エージェントキャラクター */}
                <CharacterSprite
                  name={agent.name}
                  roleId={agent.role.id}
                  state={pos.state}
                  direction={pos.dir}
                  speechBubble={pos.speech}
                  style={{ position: "relative", bottom: "auto", left: "auto" }}
                />

                {/* デスクとモニターのグラフィック表現 */}
                <div
                  style={{
                    width: "80px",
                    height: "36px",
                    background: "linear-gradient(180deg, #cfd8dc 0%, #90a4ae 100%)",
                    border: "1px solid #b0bec5",
                    borderRadius: "4px 4px 0 0",
                    marginTop: "12px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    paddingTop: "2px",
                    boxShadow: "0 6px 12px rgba(0,0,0,0.5)",
                    position: "relative",
                    zIndex: 4
                  }}
                >
                  {/* 点灯するデュアルモニター */}
                  <div 
                    className="monitor-topdown" 
                    style={{ 
                      width: "28px",
                      left: "30%",
                      background: pos.state === "working" ? "#06b6d4" : "#334155", 
                      boxShadow: pos.state === "working" ? "0 0 8px rgba(6, 182, 212, 0.8)" : "none" 
                    }} 
                  />
                  <div 
                    className="monitor-topdown" 
                    style={{ 
                      width: "28px",
                      left: "70%",
                      background: pos.state === "working" ? "#06b6d4" : "#334155", 
                      boxShadow: pos.state === "working" ? "0 0 8px rgba(6, 182, 212, 0.8)" : "none" 
                    }} 
                  />

                  {/* メカニカルキーボード */}
                  <div className="keyboard-topdown" />

                  {/* コーヒーカップ */}
                  <div className="coffee-topdown" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
