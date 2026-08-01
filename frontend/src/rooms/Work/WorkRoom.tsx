import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentOut, ArtifactOut, TaskOut } from "../../api/types";
import { CharacterSprite } from "../../components/Character/CharacterSprite";
import { FurniturePiece, RoomBackground, type FurnitureLayout, type FurnitureVisual } from "../../components/Room/Furniture";
import { usePlayerMovement, type SeatDefinition } from "../../components/Room/usePlayerMovement";
import { Modal } from "../../components/Common/Modal";
import { WorkProgressModal } from "../../features/work-progress/WorkProgressModal";

interface WorkRoomProps {
  artifacts: ArtifactOut[];
  inProgressTasks: TaskOut[];
  agents: AgentOut[];
  onViewArtifact: (artifact: ArtifactOut) => void;
}

const DEFAULT_WORK_WIDTH = 400;
// デスクの列オフセット（部屋中央からの相対x）と行(y)。「もっと机を並べて」の要望に合わせ、2列×4台=8台に増やす。
const DESK_COLUMN_OFFSETS = [-300, -100, 100, 300];
const DESK_ROWS = [260, 90];
const CHAIR_OFFSET_Y = 45; // デスクの手前(下)に椅子を置く距離

// 作業室の家具配置（座標は部屋コンテナのleft/bottom基準、px）。画像素材は使わず、CSSのみで表現する。
// 部屋の中央（コンテナ幅の半分）を基準に配置する。デスクごとに椅子を1脚セットで配置する。
function getWorkFurnitureLayout(centerX: number): FurnitureLayout[] {
  const items: FurnitureLayout[] = [];
  DESK_ROWS.forEach((y, rowIndex) => {
    DESK_COLUMN_OFFSETS.forEach((offset, colIndex) => {
      items.push({
        id: `desk-${rowIndex}-${colIndex}`,
        x: centerX + offset,
        y,
        width: 140,
        height: 60,
        collidable: true,
        zIndex: 6,
        // 机は見た目の箱より少し外側まで当たり判定を広げる（際どく縁を掠める操作感を避けるため）
        collisionPadding: 10,
      });
      // 椅子は当たり判定を持たせない（座席アンカーが椅子の真上にあるため、当たり判定があると
      // 立ち上がった瞬間に自分自身の位置が障害物と重なり、二度と動けなくなるバグの原因になる）
      items.push({
        id: `chair-${rowIndex}-${colIndex}`,
        x: centerX + offset,
        y: y - CHAIR_OFFSET_Y,
        width: 32,
        height: 32,
        collidable: false,
        zIndex: 5,
      });
    });
  });
  return items;
}

// 各デスク手前の椅子に座るための座席アンカー（机側を向いて座る）
function getWorkSeats(): SeatDefinition[] {
  const seats: SeatDefinition[] = [];
  DESK_ROWS.forEach((y, rowIndex) => {
    DESK_COLUMN_OFFSETS.forEach((offset, colIndex) => {
      seats.push({
        id: `seat-${rowIndex}-${colIndex}`,
        getPosition: (containerWidth) => ({
          x: containerWidth / 2 + offset,
          y: y - CHAIR_OFFSET_Y,
          direction: "back",
        }),
      });
    });
  });
  return seats;
}

const deskVisual: FurnitureVisual = {
  fallbackStyle: {
    background: "linear-gradient(180deg, #5c3a21 0%, #362213 100%)",
    borderRadius: "6px",
    boxShadow: "0 8px 16px rgba(0,0,0,0.6)",
    border: "2px solid #82522e",
    fontSize: "0.75rem",
    color: "#ffedd5",
    fontWeight: "bold",
  },
  fallbackContent: "💻",
};

const chairVisual: FurnitureVisual = {
  fallbackStyle: {
    background: "radial-gradient(circle at center, #374151 0%, #1f2937 100%)",
    border: "2px solid rgba(255,255,255,0.15)",
    borderRadius: "50%",
    boxShadow: "0 4px 8px rgba(0,0,0,0.5)",
  },
};

function getWorkVisuals(): Record<string, FurnitureVisual> {
  const visuals: Record<string, FurnitureVisual> = {};
  DESK_ROWS.forEach((_, rowIndex) => {
    DESK_COLUMN_OFFSETS.forEach((_, colIndex) => {
      visuals[`desk-${rowIndex}-${colIndex}`] = deskVisual;
      visuals[`chair-${rowIndex}-${colIndex}`] = chairVisual;
    });
  });
  return visuals;
}
const WORK_VISUALS = getWorkVisuals();

export const WorkRoom: React.FC<WorkRoomProps> = ({ artifacts, inProgressTasks, agents, onViewArtifact }) => {
  // 進行中タスクに紐づく「作業中のエージェント名」を全タスクから集約する（重複除去）。
  const workingAgentNames = React.useMemo(() => {
    const names = new Set<string>();
    inProgressTasks.forEach((task) => task.in_progress_agent_names.forEach((n) => names.add(n)));
    return names;
  }, [inProgressTasks]);

  // 名前をキーに agents（roleId等を含む完全なAgentOut）と突き合わせる。
  const workingAgents = React.useMemo(
    () => agents.filter((a) => workingAgentNames.has(a.name)),
    [agents, workingAgentNames],
  );
  // 誰も作業していない間は部屋を無人にする（特定の1人が常に居座って見える問題を避けるため、
  // 「待機中の雰囲気付け」に固定のagents[0]を表示することはしない）。

  // 社長がWASDで自由に部屋の中を歩き回れるようにする
  const sceneRef = useRef<HTMLDivElement>(null);
  const [sceneWidth, setSceneWidth] = useState(DEFAULT_WORK_WIDTH);
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const update = () => setSceneWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const centerX = sceneWidth / 2;
  const workFurniture = getWorkFurnitureLayout(centerX);
  // getFurnitureLayout/seatsは移動フック内のuseEffectの依存配列に使われるため、毎レンダー新しい参照を
  // 渡すとRAFループが再生成され続けて移動できなくなる。安定した参照になるようメモ化する。
  const getFurnitureLayoutForPlayer = useCallback((w: number) => getWorkFurnitureLayout(w / 2), []);
  const workSeats = useMemo(() => getWorkSeats(), []);
  const {
    pos: playerPos,
    direction: playerDirection,
    isMoving: playerIsMoving,
    isSitting: playerIsSitting,
    sittingSeat: playerSittingSeat,
    getNearSeat,
  } = usePlayerMovement(sceneRef, getFurnitureLayoutForPlayer, { spawnY: 15, seats: workSeats });
  const nearSeat = getNearSeat();

  // 「リアルタイムで見る」モーダルで表示中のお題（nullなら非表示）
  const [progressTask, setProgressTask] = useState<TaskOut | null>(null);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "1.5rem", alignItems: "start" }}>
      {/* Left Column: 進行中タスク & 成果物一覧 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* 進行中の作業（閲覧専用） */}
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "8px" }}>
            🖥️ 作業中のお題
            {inProgressTasks.length > 0 && (
              <span style={{ fontSize: "0.75rem", background: "var(--success-color)", color: "#fff", padding: "2px 6px", borderRadius: "10px", animation: "pulseGlow 1.5s infinite" }}>
                稼働中
              </span>
            )}
          </h3>
          {inProgressTasks.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "10px", textAlign: "center" }}>
              現在作業中のお題はありません。
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {inProgressTasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.9rem" }}>{task.title}</strong>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                      {task.in_progress_agent_names.length > 0
                        ? `${task.in_progress_agent_names.join("、")} が作業中...`
                        : "作業中のエージェント情報を取得中..."}
                    </div>
                  </div>
                  <button
                    className="btn-secondary"
                    style={{ alignSelf: "flex-start", padding: "4px 10px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "6px" }}
                    onClick={() => setProgressTask(task)}
                  >
                    <span
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: "var(--success-color)",
                        boxShadow: "0 0 6px var(--success-glow)",
                        animation: "pulseGlow 1.2s infinite",
                      }}
                    />
                    リアルタイムで見る
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 生成された成果物の一覧表示 */}
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>📦 成果物 (アーティファクト)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "320px", overflowY: "auto" }}>
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
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {art.task_title ?? "（お題不明）"}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                      {art.agent_name ?? "エージェント不明"} • {new Date(art.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => onViewArtifact(art)}
                    className="btn-primary"
                    style={{ padding: "4px 8px", fontSize: "0.75rem", background: "var(--secondary-color)", boxShadow: "0 0 8px var(--secondary-glow)", flexShrink: 0 }}
                  >
                    成果物を確認
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right Column: 2D Visual Room（CSSのみで表現） */}
      <div
        ref={sceneRef}
        className="glass-panel floor-tiles"
        style={{
          height: "480px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <RoomBackground label="💻 作業室" />

        <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.7rem", position: "absolute", top: "15px", right: "20px", zIndex: 10 }}>
          ⌨️ WASDで移動
        </div>

        {workFurniture.map((item) => (
          <FurniturePiece key={item.id} layout={item} visual={WORK_VISUALS[item.id]} />
        ))}

        {/* デスクで作業中のエージェント（各デスク手前の椅子に1人ずつ着席させる。デスク数を超える分は最後の椅子にずらして重ねる） */}
        {workingAgents.map((agent, i) => {
          const seat = workSeats[i % workSeats.length].getPosition(sceneWidth);
          const overflow = Math.floor(i / workSeats.length);
          return (
            <CharacterSprite
              key={agent.id}
              name={agent.name}
              roleId={agent.role.id}
              state="sitting"
              direction={seat.direction}
              style={{
                position: "absolute",
                left: `${seat.x + overflow * 24}px`,
                bottom: `${seat.y}px`,
                transform: "translateX(-50%)",
                // 机(zIndex:6)より前面に表示し、机の下に隠れないようにする
                zIndex: 7,
              }}
            />
          );
        })}

        {(nearSeat || playerIsSitting) && (
          <div
            style={{
              position: "absolute",
              left: `${(playerIsSitting ? playerSittingSeat! : nearSeat!).x}px`,
              bottom: `${(playerIsSitting ? playerSittingSeat! : nearSeat!).y + 55}px`,
              transform: "translateX(-50%)",
              color: "rgba(255,255,255,0.75)",
              fontSize: "0.7rem",
              background: "rgba(0,0,0,0.35)",
              padding: "3px 8px",
              borderRadius: "6px",
              whiteSpace: "nowrap",
              zIndex: 9,
            }}
          >
            {playerIsSitting ? "⌨️ Eキーで立つ" : "⌨️ Eキーで座る"}
          </div>
        )}

        {/* 社長本人（プレイヤー）。WASDで部屋の中を自由に移動でき、デスクの椅子にEキーで座れる */}
        <CharacterSprite
          name="社長 (あなた)"
          roleId="president"
          state={playerIsSitting ? "sitting" : playerIsMoving ? "walking" : "idle"}
          direction={playerIsSitting ? playerSittingSeat!.direction : playerDirection}
          style={{
            position: "absolute",
            bottom: `${playerIsSitting ? playerSittingSeat!.y : playerPos.y}px`,
            left: `${playerIsSitting ? playerSittingSeat!.x : playerPos.x}px`,
            transform: "translateX(-50%)",
            transition: playerIsMoving ? "none" : "left 0.15s ease-out, bottom 0.15s ease-out",
            zIndex: 9,
          }}
        />

        <div
          style={{
            position: "absolute",
            bottom: "16px",
            right: "16px",
            maxWidth: "260px",
            color: "#fff",
            fontSize: "0.85rem",
            textAlign: "right",
            textShadow: "0 1px 4px rgba(0,0,0,0.9)",
            zIndex: 10,
          }}
        >
          {inProgressTasks.length > 0
            ? `${inProgressTasks.length}件のお題が作業中です。左のパネルで進捗と成果物を確認できます。`
            : "現在、稼働中のお題はありません。"}
        </div>
      </div>

      {/* 作業状況をリアルタイム(数秒おきのポーリング)で確認するモーダル */}
      <Modal
        isOpen={progressTask !== null}
        onClose={() => setProgressTask(null)}
        title="🖥️ 作業状況をリアルタイムで見る"
      >
        {progressTask && <WorkProgressModal task={progressTask} agents={agents} artifacts={artifacts} />}
      </Modal>
    </div>
  );
};
