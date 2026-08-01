import React, { useEffect, useState } from "react";
import type { AgentOut, ArtifactOut, TaskOut } from "../../api/types";
import { CharacterSprite } from "../../components/Character/CharacterSprite";
import { ReportViewer } from "../report-viewer/ReportViewer";
import { usePolling } from "../../api/hooks";
import * as api from "../../api/client";

interface WorkProgressModalProps {
  task: TaskOut;
  agents: AgentOut[];
  artifacts: ArtifactOut[];
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}分${seconds.toString().padStart(2, "0")}秒`;
}

/**
 * 作業室の「リアルタイムで見る」モーダル。game_cliの作業室（担当エージェント表示・完了確認）を
 * 元に、Web版ではポーリングで進行状況が自動更新される形にしたもの。
 * バックエンドはLLM呼び出しを1回のグラフ実行として行っており、途中経過のストリーミングは
 * 持たないため、ここでの「リアルタイム」は数秒おきのポーリングによる自動更新を指す。
 */
export const WorkProgressModal: React.FC<WorkProgressModalProps> = ({ task, agents, artifacts }) => {
  const sessionPoll = usePolling(() => api.getTaskWorkSession(task.id), 2000, [task.id]);

  // 経過時間を1秒おきに更新するためのローカル時計
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const session = sessionPoll.data;

  if (!session) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
        {sessionPoll.error ? `読み込みに失敗しました: ${sessionPoll.error}` : "作業状況を読み込み中..."}
      </div>
    );
  }

  const leader = agents.find((a) => a.id === session.leader_agent_id);
  const workers = agents.filter(
    (a) => session.worker_agent_ids.includes(a.id) && a.id !== session.leader_agent_id,
  );
  const elapsedMs = now - new Date(session.created_at).getTime();
  const artifact = artifacts.find((a) => a.task_id === task.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      <div>
        <strong style={{ fontSize: "1rem" }}>{task.title}</strong>
        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>
          {task.description}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "8px",
          padding: "10px 14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {session.status === "in_progress" && (
            <span
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                background: "var(--success-color)",
                boxShadow: "0 0 8px var(--success-glow)",
                animation: "pulseGlow 1.2s infinite",
              }}
            />
          )}
          <span style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
            {session.status === "in_progress" && "🖥️ 作業中"}
            {session.status === "completed" && "✅ 完了"}
            {session.status === "failed" && "⚠️ 失敗"}
          </span>
        </div>
        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          経過時間: {formatElapsed(elapsedMs)}
        </span>
      </div>

      {/* 担当エージェントを実際にキャラクターとして表示（リーダーは冠アイコンで明示） */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1.5rem",
          justifyContent: "center",
          background: "rgba(0,0,0,0.2)",
          borderRadius: "10px",
          padding: "1.5rem 1rem 0.5rem",
          minHeight: "120px",
          position: "relative",
        }}
      >
        {leader && (
          <div style={{ position: "relative" }}>
            <CharacterSprite name={leader.name} roleId={leader.role.id} state="working" direction="front" style={{ position: "static" }} />
          </div>
        )}
        {workers.map((w) => (
          <CharacterSprite key={w.id} name={w.name} roleId={w.role.id} state="working" direction="front" style={{ position: "static" }} />
        ))}
      </div>

      {session.status === "completed" && artifact && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "1rem" }}>
          <h4 style={{ margin: 0, marginBottom: "0.75rem" }}>📦 完成した成果物</h4>
          <ReportViewer artifact={artifact} />
        </div>
      )}

      {session.status === "completed" && !artifact && (
        <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center" }}>
          完了しましたが、成果物の取得待ちです。少し待ってから開き直してください。
        </div>
      )}

      {session.status === "failed" && (
        <div style={{ color: "var(--warning-color)", fontSize: "0.85rem", textAlign: "center" }}>
          作業中にエラーが発生しました。社長室の「作業を割り当てる」からやり直してください。
        </div>
      )}
    </div>
  );
};
