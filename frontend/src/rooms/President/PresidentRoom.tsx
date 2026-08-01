import React, { useEffect, useRef, useState } from "react";
import type {
  AgentOut,
  TaskOut,
  TaskStatus,
  RoleOut,
  SkillOut,
  AIModelOut,
  PendingReportOut,
} from "../../api/types";
import * as api from "../../api/client";
import { CharacterSprite, type CharacterState, type SpriteDirection } from "../../components/Character/CharacterSprite";
import { Modal } from "../../components/Common/Modal";
import {
  FurniturePiece,
  RoomBackground,
  obstaclesFromLayout,
  collidesAt,
  type FurnitureLayout,
  type FurnitureVisual,
} from "../../components/Room/Furniture";

interface AgentPositionData {
  x: number | string;
  y: number | string;
  dir: SpriteDirection;
  state: CharacterState;
  speech?: string;
  noTransition?: boolean;
}

interface PresidentRoomProps {
  agents: AgentOut[];
  tasks: TaskOut[];
  busyAgentIds: number[];
  pendingReports: PendingReportOut[];
  agentPositions: Record<number, AgentPositionData>;
  onOpenHiring: () => void;
  addToast: (text: string, type?: "info" | "success") => void;
  refetchAgents: () => void;
  refetchTasks: () => void;
  refetchPendingReports: () => void;
  refetchBusyAgents: () => void;
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  awaiting_meeting: "会議待ち",
  meeting_in_progress: "会議中",
  awaiting_approval: "承認待ち",
  ready_for_work: "作業可能",
  work_in_progress: "作業中",
  completed: "完了",
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  awaiting_meeting: "var(--text-secondary)",
  meeting_in_progress: "var(--accent-neon)",
  awaiting_approval: "var(--warning-color)",
  ready_for_work: "var(--secondary-color)",
  work_in_progress: "var(--primary-color)",
  completed: "var(--success-color)",
};

const StatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => (
  <span
    style={{
      fontSize: "0.7rem",
      fontWeight: "bold",
      color: STATUS_COLOR[status],
      border: `1px solid ${STATUS_COLOR[status]}`,
      background: "rgba(255,255,255,0.04)",
      padding: "3px 8px",
      borderRadius: "10px",
      whiteSpace: "nowrap",
    }}
  >
    {STATUS_LABEL[status]}
  </span>
);

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

type ModalKind =
  | "none"
  | "createTask"
  | "editTask"
  | "deleteTaskConfirm"
  | "assignWork"
  | "reports"
  | "reportDetail"
  | "editAgent"
  | "deleteAgentConfirm";

const PLAYER_SPEED = 3.2; // 1フレームあたりの移動量(px)
const DEFAULT_CONTAINER_WIDTH = 400; // sceneWidthの初期値（実測前のフォールバック）と揃える
const PLAYER_SPAWN = { x: DEFAULT_CONTAINER_WIDTH / 2, y: 60 }; // 実測幅が分かり次第、中央に再配置する
const KEY_DIRECTION: Record<string, SpriteDirection> = {
  w: "back",
  s: "front",
  a: "left",
  d: "right",
};

// 執務机と椅子の間の隙間(px)。机にぴったりくっつけず、作業室のデスクと同じ感覚で少し離して置く。
const CHAIR_DESK_GAP = 15;

// 執務椅子に座った際のシート位置（部屋の中央に配置する。xはコンテナ幅に応じて動的に決まる）。
const CHAIR_Y = 120 - CHAIR_DESK_GAP - 36; // 机の下端(120)から隙間+椅子の高さ(36)ぶん離す
const CHAIR_SEAT_Y = CHAIR_Y + 10;
const CHAIR_SEAT_DIRECTION: SpriteDirection = "back";
const SIT_PROXIMITY = 45; // px, この距離以内でEキーが反応する

// 部屋に置かれた家具の当たり判定（left/bottom/width/heightで実際に描画している座標と一致させる）
const PLAYER_HITBOX_HALF_WIDTH = 14;
const PLAYER_HITBOX_HEIGHT = 12;

function getPresidentFurnitureLayout(containerWidth: number): FurnitureLayout[] {
  const centerX = containerWidth / 2;
  return [
    // 机は見た目の箱より少し外側まで当たり判定を広げる（際どく縁を掠める操作感を避けるため）
    { id: "desk", x: centerX, y: 120, width: 130, height: 48, collidable: true, zIndex: 6, collisionPadding: 10 },
    // 椅子は当たり判定を持たせない（座席アンカーが椅子の真上にあるため、当たり判定があると
    // 立ち上がった瞬間に自分自身の位置が障害物と重なり、二度と動けなくなるバグの原因になる）
    { id: "chair", x: centerX, y: CHAIR_Y, width: 36, height: 36, collidable: false, zIndex: 4 },
    // right: 120px, width: 110px相当のleft基準中心座標（コンテナ幅に応じて右寄せを維持する）
    { id: "hiring-desk", x: containerWidth - 175, y: 120, width: 110, height: 60, collidable: true, zIndex: 6, collisionPadding: 10 },
  ];
}

function getPresidentFurnitureVisuals(onOpenHiring: () => void): Record<string, FurnitureVisual> {
  return {
    desk: {
      fallbackStyle: {
        background: "linear-gradient(180deg, #5c3a21 0%, #362213 100%)",
        borderRadius: "6px",
        boxShadow: "0 8px 16px rgba(0,0,0,0.6)",
        border: "2px solid #82522e",
        fontSize: "0.8rem",
        color: "#ffedd5",
        fontWeight: "bold",
      },
      fallbackContent: "💻 執務机",
    },
    chair: {
      fallbackStyle: {
        background: "linear-gradient(180deg, #4c1d95 0%, #2e1065 100%)",
        borderRadius: "8px 8px 4px 4px",
        boxShadow: "0 6px 12px rgba(0,0,0,0.5)",
        border: "2px solid #7c3aed",
      },
    },
    "hiring-desk": {
      onClick: onOpenHiring,
      fallbackStyle: {
        background: "linear-gradient(180deg, #0891b2 0%, #0e7490 100%)",
        borderRadius: "12px",
        boxShadow: "0 0 15px rgba(6, 182, 212, 0.4)",
        border: "2px solid #fff",
        flexDirection: "column",
        fontSize: "0.75rem",
        color: "#fff",
        fontWeight: "bold",
        animation: "pulseGlow 2s infinite",
      },
      fallbackContent: (
        <>
          <span>🤝 採用デスク</span>
          <span style={{ fontSize: "0.6rem", opacity: 0.8 }}>(エージェント採用)</span>
        </>
      ),
    },
  };
}

/** 社長キャラクターをWASDキーで動かすためのフック。部屋のビジュアル(2Dシーン)コンテナのサイズを基準に移動範囲をクランプし、家具の上には移動できないようにする。 */
function usePlayerMovement(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [pos, setPos] = useState(PLAYER_SPAWN);
  const [direction, setDirection] = useState<SpriteDirection>("front");
  const [isMoving, setIsMoving] = useState(false);
  const [isSitting, setIsSitting] = useState(false);
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const lastKeyRef = useRef<string | null>(null);
  const posRef = useRef(pos);
  const isSittingRef = useRef(isSitting);
  const skipMoveRef = useRef(false);
  const hasCenteredRef = useRef(false);

  // 椅子の座席アンカー座標。部屋の中央（コンテナ幅の半分）を都度読み直すことで、
  // 実測幅が判明した後も常に部屋の中央に一致させる。
  const getChairSeat = () => {
    const width = containerRef.current?.clientWidth ?? DEFAULT_CONTAINER_WIDTH;
    return { x: width / 2, y: CHAIR_SEAT_Y, direction: CHAIR_SEAT_DIRECTION };
  };

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);
  useEffect(() => {
    isSittingRef.current = isSitting;
  }, [isSitting]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const tag = (target as HTMLElement | null)?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();

      if (key === "e") {
        if (e.repeat) return; // キー長押しでの連続トグルを防ぐ
        if (isSittingRef.current) {
          setIsSitting(false);
        } else {
          const seat = getChairSeat();
          const dx = posRef.current.x - seat.x;
          const dy = posRef.current.y - seat.y;
          if (Math.hypot(dx, dy) <= SIT_PROXIMITY) {
            setPos({ x: seat.x, y: seat.y });
            setIsSitting(true);
          }
        }
        return;
      }

      if (!(key in KEY_DIRECTION)) return;

      if (isSittingRef.current) {
        // WASDでも立ち上がる。ただし「立ち上がった瞬間」に同時に移動が適用されるとカクつくので、
        // このフレームの移動は見送り、次フレーム以降で通常通り反映させる。
        setIsSitting(false);
        skipMoveRef.current = true;
      }
      pressedKeysRef.current.add(key);
      lastKeyRef.current = key;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeysRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      pressedKeysRef.current.clear();
    };
  }, []);

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      // 実測されたコンテナ幅が判明した時点で一度だけ、初期スポーン位置を部屋の中央に合わせ直す
      if (!hasCenteredRef.current) {
        const width = containerRef.current?.clientWidth;
        if (width && width !== DEFAULT_CONTAINER_WIDTH) {
          hasCenteredRef.current = true;
          setPos({ x: width / 2, y: PLAYER_SPAWN.y });
        }
      }
      if (isSittingRef.current) {
        setIsMoving(false);
        rafId = requestAnimationFrame(tick);
        return;
      }
      if (skipMoveRef.current) {
        // 直前のフレームで立ち上がったばかりなので、このフレームは移動を適用しない
        skipMoveRef.current = false;
        setIsMoving(false);
        rafId = requestAnimationFrame(tick);
        return;
      }
      const keys = pressedKeysRef.current;
      if (keys.size > 0) {
        let dx = 0;
        let dy = 0;
        if (keys.has("w")) dy += PLAYER_SPEED;
        if (keys.has("s")) dy -= PLAYER_SPEED;
        if (keys.has("a")) dx -= PLAYER_SPEED;
        if (keys.has("d")) dx += PLAYER_SPEED;
        if (dx !== 0 && dy !== 0) {
          dx *= Math.SQRT1_2;
          dy *= Math.SQRT1_2;
        }
        if (dx !== 0 || dy !== 0) {
          const bounds = containerRef.current;
          const width = bounds?.clientWidth ?? 400;
          const height = bounds?.clientHeight ?? 480;
          const obstacles = obstaclesFromLayout(getPresidentFurnitureLayout(width));
          setPos((prev) => {
            // x軸・y軸を別々に判定することで、家具の角に沿ってスライドできるようにする
            const candidateX = Math.min(Math.max(prev.x + dx, 40), width - 40);
            const nextX = collidesAt(candidateX, prev.y, obstacles, PLAYER_HITBOX_HALF_WIDTH, PLAYER_HITBOX_HEIGHT) ? prev.x : candidateX;
            const candidateY = Math.min(Math.max(prev.y + dy, 20), height - 110);
            const nextY = collidesAt(nextX, candidateY, obstacles, PLAYER_HITBOX_HALF_WIDTH, PLAYER_HITBOX_HEIGHT) ? prev.y : candidateY;
            return { x: nextX, y: nextY };
          });
          setIsMoving(true);
          const dirKey = lastKeyRef.current && keys.has(lastKeyRef.current) ? lastKeyRef.current : Array.from(keys)[0];
          setDirection(KEY_DIRECTION[dirKey]);
        } else {
          setIsMoving(false);
        }
      } else {
        setIsMoving(false);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [containerRef]);

  return { pos, direction, isMoving, isSitting, getChairSeat };
}

export const PresidentRoom: React.FC<PresidentRoomProps> = ({
  agents,
  tasks,
  busyAgentIds,
  pendingReports,
  agentPositions,
  onOpenHiring,
  addToast,
  refetchAgents,
  refetchTasks,
  refetchPendingReports,
  refetchBusyAgents,
}) => {
  const [modal, setModal] = useState<ModalKind>("none");
  const [targetTask, setTargetTask] = useState<TaskOut | null>(null);
  const [targetAgent, setTargetAgent] = useState<AgentOut | null>(null);
  const [targetReport, setTargetReport] = useState<PendingReportOut | null>(null);

  const [roles, setRoles] = useState<RoleOut[]>([]);
  const [skills, setSkills] = useState<SkillOut[]>([]);

  const sceneRef = useRef<HTMLDivElement>(null);
  const { pos: playerPos, direction: playerDirection, isMoving: playerIsMoving, isSitting, getChairSeat } = usePlayerMovement(sceneRef);
  const chairSeat = getChairSeat();
  const isNearChair = Math.hypot(playerPos.x - chairSeat.x, playerPos.y - chairSeat.y) <= SIT_PROXIMITY;

  // 家具（採用デスク・執務机等）の中央/右寄せ位置を描画するため、シーンの実幅を追従して保持する
  const [sceneWidth, setSceneWidth] = useState(DEFAULT_CONTAINER_WIDTH);
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const update = () => setSceneWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const furnitureLayout = getPresidentFurnitureLayout(sceneWidth);
  const furnitureVisuals = getPresidentFurnitureVisuals(onOpenHiring);

  useEffect(() => {
    api.listRoles().then(setRoles).catch((e) => addToast(`⚠️ 役割一覧の取得に失敗: ${errMsg(e)}`, "info"));
    api.listSkills().then(setSkills).catch((e) => addToast(`⚠️ スキル一覧の取得に失敗: ${errMsg(e)}`, "info"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeModal = () => {
    setModal("none");
    setTargetTask(null);
    setTargetAgent(null);
    setTargetReport(null);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "1.5rem", alignItems: "start" }}>
      {/* Left Column: Management Panels */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* スタッフ管理パネル */}
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>👥 エージェント一覧 ({agents.length})</h3>
            <button onClick={onOpenHiring} className="btn-primary" style={{ padding: "4px 10px", fontSize: "0.8rem" }}>
              + 採用
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "220px", overflowY: "auto" }}>
            {agents.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", textAlign: "center", padding: "8px" }}>
                まだ誰も雇用していません。
              </div>
            )}
            {agents.map((agent) => (
              <div
                key={agent.id}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  padding: "10px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div style={{ fontSize: "1.5rem" }}>{busyAgentIds.includes(agent.id) ? "⚙️" : "🤖"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{agent.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    {agent.role.name} • <span style={{ color: "var(--secondary-color)" }}>{agent.ai_model.display_name}</span>
                  </div>
                  {agent.skills.length > 0 && (
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      {agent.skills.map((s) => s.name).join(" / ")}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <button
                    className="btn-secondary"
                    style={{ padding: "2px 8px", fontSize: "0.7rem" }}
                    onClick={() => {
                      setTargetAgent(agent);
                      setModal("editAgent");
                    }}
                  >
                    ✎ 編集
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ padding: "2px 8px", fontSize: "0.7rem", color: "var(--danger-color)" }}
                    onClick={() => {
                      setTargetAgent(agent);
                      setModal("deleteAgentConfirm");
                    }}
                  >
                    🗑 解雇
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* お題・タスク管理パネル */}
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>📋 お題一覧 ({tasks.length})</h3>
            <button onClick={() => setModal("createTask")} className="btn-primary" style={{ padding: "4px 10px", fontSize: "0.8rem" }}>
              + お題を作成
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "260px", overflowY: "auto" }}>
            {tasks.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", textAlign: "center", padding: "8px" }}>
                依頼中のお題はありません。
              </div>
            )}
            {tasks.map((task) => (
              <div
                key={task.id}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  padding: "10px",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{task.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: "1.4" }}>{task.description}</div>
                    {task.in_progress_agent_names.length > 0 && (
                      <div style={{ fontSize: "0.7rem", color: "var(--secondary-color)", marginTop: "2px" }}>
                        担当: {task.in_progress_agent_names.join(", ")}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={task.status} />
                </div>
                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                  <button
                    className="btn-secondary"
                    style={{ padding: "2px 8px", fontSize: "0.7rem" }}
                    onClick={() => {
                      setTargetTask(task);
                      setModal("editTask");
                    }}
                  >
                    ✎ 編集
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ padding: "2px 8px", fontSize: "0.7rem", color: "var(--danger-color)" }}
                    onClick={() => {
                      setTargetTask(task);
                      setModal("deleteTaskConfirm");
                    }}
                  >
                    🗑 削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* アクションセンター */}
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>🛠 アクションセンター</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button className="btn-primary" style={{ padding: "10px" }} onClick={() => setModal("assignWork")}>
              💻 作業を割り当てる
            </button>
            <button
              className="btn-primary"
              style={{ padding: "10px", background: "var(--accent-neon)", boxShadow: "0 0 10px var(--accent-glow)" }}
              onClick={() => setModal("reports")}
            >
              📄 レポートを確認して承認する {pendingReports.length > 0 ? `(${pendingReports.length})` : ""}
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: 2D Visual Room */}
      <div
        ref={sceneRef}
        className="glass-panel floor-wood"
        style={{
          height: "480px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <RoomBackground label="🏢 社長室" />
        <div className="president-carpet" />

        <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.7rem", position: "absolute", top: "15px", right: "20px", zIndex: 10 }}>
          ⌨️ WASDで移動
        </div>

        {/* 家具（執務机・椅子・採用デスク）: 座標・当たり判定はgetPresidentFurnitureLayoutが唯一の情報源 */}
        {furnitureLayout.map((item) => (
          <FurniturePiece key={item.id} layout={item} visual={furnitureVisuals[item.id]} />
        ))}

        {(isNearChair || isSitting) && (
          <div
            style={{
              position: "absolute",
              left: `${chairSeat.x}px`,
              bottom: `${chairSeat.y + 50}px`,
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
            {isSitting ? "⌨️ Eキーで立つ" : "⌨️ Eキーで座る"}
          </div>
        )}

        <CharacterSprite
          name="社長 (あなた)"
          roleId="president"
          state={isSitting ? "sitting" : playerIsMoving ? "walking" : "idle"}
          direction={isSitting ? chairSeat.direction : playerDirection}
          style={{
            position: "absolute",
            bottom: `${isSitting ? chairSeat.y : playerPos.y}px`,
            left: `${isSitting ? chairSeat.x : playerPos.x}px`,
            transform: "translateX(-50%)",
            transition: playerIsMoving ? "none" : "left 0.15s ease-out, bottom 0.15s ease-out",
            // 机(zIndex:6)より前面に表示し、座った時に机の下に隠れないようにする
            zIndex: 8,
          }}
        />

        {agents.map((agent) => {
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
                zIndex: 8,
              }}
            />
          );
        })}
      </div>

      {/* お題作成モーダル */}
      <Modal isOpen={modal === "createTask"} onClose={closeModal} title="お題を作成する">
        <CreateTaskForm
          onSubmit={async (req) => {
            try {
              await api.createTask(req);
              addToast("お題を作成しました！", "success");
              refetchTasks();
              closeModal();
            } catch (e) {
              addToast(`⚠️ お題の作成に失敗しました: ${errMsg(e)}`, "info");
            }
          }}
        />
      </Modal>

      {/* お題編集モーダル */}
      <Modal isOpen={modal === "editTask"} onClose={closeModal} title="お題を編集する">
        {targetTask && (
          <EditTaskForm
            task={targetTask}
            onCancel={closeModal}
            onSubmit={async (req) => {
              try {
                await api.updateTask(targetTask.id, req);
                addToast("お題を更新しました！", "success");
                refetchTasks();
                closeModal();
              } catch (e) {
                addToast(`⚠️ お題の更新に失敗しました: ${errMsg(e)}`, "info");
              }
            }}
          />
        )}
      </Modal>

      {/* お題削除確認モーダル */}
      <Modal isOpen={modal === "deleteTaskConfirm"} onClose={closeModal} title="お題の削除確認">
        {targetTask && (
          <ConfirmPanel
            message={`お題「${targetTask.title}」を削除しますか？この操作は取り消せません。`}
            onCancel={closeModal}
            onConfirm={async () => {
              try {
                await api.deleteTask(targetTask.id);
                addToast("お題を削除しました。", "success");
                refetchTasks();
                closeModal();
              } catch (e) {
                addToast(`⚠️ お題の削除に失敗しました: ${errMsg(e)}`, "info");
              }
            }}
          />
        )}
      </Modal>

      {/* 作業割り当てウィザードモーダル */}
      <Modal isOpen={modal === "assignWork"} onClose={closeModal} title="作業を割り当てる">
        <AssignWorkWizard
          tasks={tasks.filter((t) => t.status === "ready_for_work")}
          agents={agents.filter((a) => !busyAgentIds.includes(a.id))}
          onCancel={closeModal}
          onSubmit={async (req) => {
            try {
              await api.startWork(req);
              addToast("作業を割り当てました！", "success");
              refetchTasks();
              refetchBusyAgents();
              closeModal();
            } catch (e) {
              addToast(`⚠️ 作業の割り当てに失敗しました: ${errMsg(e)}`, "info");
            }
          }}
        />
      </Modal>

      {/* レポート一覧モーダル */}
      <Modal isOpen={modal === "reports"} onClose={closeModal} title="レポートの確認と承認">
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {pendingReports.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "1rem" }}>
              承認待ちのレポートはありません。
            </div>
          ) : (
            pendingReports.map((r) => (
              <div
                key={r.task_id}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  padding: "10px",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{r.task_title}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{new Date(r.created_at).toLocaleString()}</div>
                </div>
                <button
                  className="btn-primary"
                  style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                  onClick={() => {
                    setTargetReport(r);
                    setModal("reportDetail");
                  }}
                >
                  内容を読む
                </button>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* レポート詳細・承認モーダル */}
      <Modal isOpen={modal === "reportDetail"} onClose={() => setModal("reports")} title="会議レポート">
        {targetReport && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ fontWeight: "bold" }}>{targetReport.task_title}</div>
            <div
              style={{
                whiteSpace: "pre-wrap",
                background: "rgba(0,0,0,0.2)",
                padding: "1.2rem",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.05)",
                fontSize: "0.85rem",
                lineHeight: "1.6",
                maxHeight: "320px",
                overflowY: "auto",
              }}
            >
              {targetReport.report_content}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setModal("reports")}>
                戻る
              </button>
              <button
                className="btn-primary"
                style={{ flex: 2, background: "var(--success-color)", boxShadow: "0 0 10px var(--success-glow)" }}
                onClick={async () => {
                  try {
                    await api.approveReport(targetReport.task_id);
                    addToast("レポートを承認しました！", "success");
                    refetchPendingReports();
                    refetchTasks();
                    closeModal();
                  } catch (e) {
                    addToast(`⚠️ 承認に失敗しました: ${errMsg(e)}`, "info");
                  }
                }}
              >
                ✅ 承認する
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* エージェント編集モーダル */}
      <Modal isOpen={modal === "editAgent"} onClose={closeModal} title="エージェント情報の編集">
        {targetAgent && (
          <AgentEditForm
            agent={targetAgent}
            roles={roles}
            skills={skills}
            onCancel={closeModal}
            onSubmit={async (req) => {
              try {
                await api.updateAgent(targetAgent.id, req);
                addToast("エージェント情報を更新しました！", "success");
                refetchAgents();
                closeModal();
              } catch (e) {
                addToast(`⚠️ 更新に失敗しました: ${errMsg(e)}`, "info");
              }
            }}
          />
        )}
      </Modal>

      {/* エージェント解雇確認モーダル */}
      <Modal isOpen={modal === "deleteAgentConfirm"} onClose={closeModal} title="解雇の確認">
        {targetAgent && (
          <ConfirmPanel
            message={`${targetAgent.name} を解雇しますか？この操作は取り消せません。`}
            onCancel={closeModal}
            onConfirm={async () => {
              try {
                await api.deleteAgent(targetAgent.id);
                addToast(`${targetAgent.name} を解雇しました。`, "success");
                refetchAgents();
                closeModal();
              } catch (e) {
                addToast(`⚠️ 解雇に失敗しました: ${errMsg(e)}`, "info");
              }
            }}
          />
        )}
      </Modal>
    </div>
  );
};

// ---------------------------------------------------------------------------
// サブコンポーネント群
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid var(--panel-border)",
  borderRadius: "6px",
  color: "#fff",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.85rem",
  color: "var(--text-secondary)",
  marginBottom: "4px",
};

const ConfirmPanel: React.FC<{ message: string; onCancel: () => void; onConfirm: () => void }> = ({
  message,
  onCancel,
  onConfirm,
}) => (
  <div style={{ textAlign: "center", padding: "1rem" }}>
    <p style={{ fontSize: "1rem", marginBottom: "1.5rem" }}>{message}</p>
    <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
      <button className="btn-secondary" onClick={onCancel}>
        キャンセル
      </button>
      <button className="btn-primary" style={{ background: "var(--danger-color)" }} onClick={onConfirm}>
        実行する
      </button>
    </div>
  </div>
);

const CreateTaskForm: React.FC<{
  onSubmit: (req: { task_text: string; requires_meeting: boolean }) => Promise<void>;
}> = ({ onSubmit }) => {
  const [taskText, setTaskText] = useState("");
  const [requiresMeeting, setRequiresMeeting] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskText.trim()) return;
    setSubmitting(true);
    await onSubmit({ task_text: taskText.trim(), requires_meeting: requiresMeeting });
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <label style={labelStyle}>お題の内容</label>
        <textarea
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          required
          rows={4}
          style={{ ...inputStyle, resize: "vertical" }}
          placeholder="例: 老舗和菓子屋のコーポレートサイトを作りたい"
        />
      </div>
      <div>
        <label style={labelStyle}>会議が必要ですか？</label>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: 1, background: requiresMeeting ? "var(--primary-color)" : undefined }}
            onClick={() => setRequiresMeeting(true)}
          >
            必要
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: 1, background: !requiresMeeting ? "var(--primary-color)" : undefined }}
            onClick={() => setRequiresMeeting(false)}
          >
            不要
          </button>
        </div>
      </div>
      <button type="submit" className="btn-primary" disabled={submitting || !taskText.trim()}>
        作成する
      </button>
    </form>
  );
};

const EditTaskForm: React.FC<{
  task: TaskOut;
  onCancel: () => void;
  onSubmit: (req: { task_text?: string; requires_meeting?: boolean }) => Promise<void>;
}> = ({ task, onCancel, onSubmit }) => {
  const [taskText, setTaskText] = useState(task.description || task.title);
  const [requiresMeeting, setRequiresMeeting] = useState(task.requires_meeting);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({ task_text: taskText.trim(), requires_meeting: requiresMeeting });
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
        現在のステータス: <StatusBadge status={task.status} />
      </div>
      <div>
        <label style={labelStyle}>お題の内容</label>
        <textarea
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          required
          rows={4}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>
      <div>
        <label style={labelStyle}>会議が必要ですか？</label>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: 1, background: requiresMeeting ? "var(--primary-color)" : undefined }}
            onClick={() => setRequiresMeeting(true)}
          >
            必要
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: 1, background: !requiresMeeting ? "var(--primary-color)" : undefined }}
            onClick={() => setRequiresMeeting(false)}
          >
            不要
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
          キャンセル
        </button>
        <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={submitting || !taskText.trim()}>
          更新する
        </button>
      </div>
    </form>
  );
};

const AssignWorkWizard: React.FC<{
  tasks: TaskOut[];
  agents: AgentOut[];
  onCancel: () => void;
  onSubmit: (req: { task_id: number; worker_agent_ids: number[]; leader_agent_id: number }) => Promise<void>;
}> = ({ tasks, agents, onCancel, onSubmit }) => {
  const [step, setStep] = useState<"task" | "workers" | "leader" | "confirm">("task");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<number[]>([]);
  const [selectedLeaderId, setSelectedLeaderId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  const toggleWorker = (id: number) => {
    setSelectedWorkerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleProceedFromWorkers = () => {
    if (selectedWorkerIds.length === 0) return;
    if (selectedWorkerIds.length === 1) {
      setSelectedLeaderId(selectedWorkerIds[0]);
      setStep("confirm");
    } else {
      setStep("leader");
    }
  };

  const handleLaunch = async () => {
    if (!selectedTaskId || !selectedLeaderId || selectedWorkerIds.length === 0) return;
    setSubmitting(true);
    await onSubmit({ task_id: selectedTaskId, worker_agent_ids: selectedWorkerIds, leader_agent_id: selectedLeaderId });
    setSubmitting(false);
  };

  if (step === "task") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h4 style={{ margin: 0 }}>ステップ 1: お題を選択</h4>
        {tasks.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "1rem" }}>
            作業可能なお題がありません（会議の承認が完了したお題のみ選択できます）。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "260px", overflowY: "auto" }}>
            {tasks.map((t) => (
              <button
                key={t.id}
                className="btn-secondary"
                style={{ textAlign: "left", padding: "12px" }}
                onClick={() => {
                  setSelectedTaskId(t.id);
                  setStep("workers");
                }}
              >
                <strong style={{ fontSize: "0.9rem" }}>{t.title}</strong>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{t.description}</div>
              </button>
            ))}
          </div>
        )}
        <button className="btn-secondary" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    );
  }

  if (step === "workers") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h4 style={{ margin: 0 }}>ステップ 2: 作業メンバーを選択（{selectedTask?.title}）</h4>
        {agents.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "1rem" }}>
            現在、空いているエージェントがいません。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "260px", overflowY: "auto" }}>
            {agents.map((a) => (
              <div
                key={a.id}
                onClick={() => toggleWorker(a.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px",
                  background: selectedWorkerIds.includes(a.id) ? "rgba(168, 85, 247, 0.12)" : "rgba(255,255,255,0.03)",
                  border: selectedWorkerIds.includes(a.id) ? "2px solid var(--accent-neon)" : "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "10px",
                  cursor: "pointer",
                }}
              >
                <div>
                  <strong style={{ fontSize: "0.85rem" }}>{a.name}</strong>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{a.role.name}</div>
                </div>
                <span style={{ fontSize: "0.7rem", fontWeight: "bold" }}>
                  {selectedWorkerIds.includes(a.id) ? "✓ 選択中" : "選択"}
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep("task")}>
            戻る
          </button>
          <button className="btn-primary" style={{ flex: 2 }} disabled={selectedWorkerIds.length === 0} onClick={handleProceedFromWorkers}>
            次へ
          </button>
        </div>
      </div>
    );
  }

  if (step === "leader") {
    const candidates = agents.filter((a) => selectedWorkerIds.includes(a.id));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h4 style={{ margin: 0 }}>ステップ 3: リーダーを選出</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {candidates.map((a) => (
            <button
              key={a.id}
              className="btn-secondary"
              style={{
                textAlign: "left",
                padding: "10px",
                background: selectedLeaderId === a.id ? "rgba(168, 85, 247, 0.12)" : undefined,
                borderColor: selectedLeaderId === a.id ? "var(--accent-neon)" : undefined,
              }}
              onClick={() => setSelectedLeaderId(a.id)}
            >
              👑 {a.name} <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>({a.role.name})</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep("workers")}>
            戻る
          </button>
          <button className="btn-primary" style={{ flex: 2 }} disabled={!selectedLeaderId} onClick={() => setStep("confirm")}>
            次へ
          </button>
        </div>
      </div>
    );
  }

  // step === "confirm"
  const leader = agents.find((a) => a.id === selectedLeaderId);
  const workers = agents.filter((a) => selectedWorkerIds.includes(a.id));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h4 style={{ margin: 0 }}>確認</h4>
      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "8px", padding: "12px", fontSize: "0.85rem" }}>
        <div>お題: <strong>{selectedTask?.title}</strong></div>
        <div>リーダー: <strong>👑 {leader?.name}</strong></div>
        <div>メンバー: {workers.map((w) => w.name).join(", ")}</div>
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(workers.length === 1 ? "workers" : "leader")}>
          戻る
        </button>
        <button className="btn-primary" style={{ flex: 2 }} disabled={submitting} onClick={handleLaunch}>
          🚀 割り当てを実行
        </button>
      </div>
    </div>
  );
};

const AgentEditForm: React.FC<{
  agent: AgentOut;
  roles: RoleOut[];
  skills: SkillOut[];
  onCancel: () => void;
  onSubmit: (req: {
    name?: string;
    personality?: string;
    role_id?: number;
    ai_model_id?: number;
    skill_ids?: number[];
  }) => Promise<void>;
}> = ({ agent, roles, skills, onCancel, onSubmit }) => {
  const [name, setName] = useState(agent.name);
  const [personality, setPersonality] = useState(agent.personality);
  const [roleId, setRoleId] = useState(agent.role.id);
  const [modelId, setModelId] = useState(agent.ai_model.id);
  const [skillIds, setSkillIds] = useState<number[]>(agent.skills.map((s) => s.id));
  const [models, setModels] = useState<AIModelOut[]>([agent.ai_model]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .listAiModels(roleId)
      .then((list) => {
        if (!active) return;
        setModels(list);
        if (!list.some((m) => m.id === modelId) && list.length > 0) {
          setModelId(list[0].id);
        }
      })
      .catch(() => {
        /* モデル一覧の再取得失敗はフォーム操作をブロックしない */
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  const toggleSkill = (id: number) => {
    setSkillIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({ name, personality, role_id: roleId, ai_model_id: modelId, skill_ids: skillIds });
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <label style={labelStyle}>名前</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>性格</label>
        <textarea value={personality} onChange={(e) => setPersonality(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
      </div>
      <div>
        <label style={labelStyle}>役割</label>
        <select value={roleId} onChange={(e) => setRoleId(Number(e.target.value))} style={inputStyle}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} {r.requires_design_capable_model ? "(上流モデル必須)" : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>AIモデル</label>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px", overflowY: "auto" }}>
          {models.map((m) => (
            <label
              key={m.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                padding: "8px",
                borderRadius: "6px",
                background: "rgba(0,0,0,0.2)",
                border: modelId === m.id ? "1px solid var(--primary-color)" : "1px solid transparent",
                cursor: "pointer",
              }}
            >
              <input type="radio" name="editAiModel" checked={modelId === m.id} onChange={() => setModelId(m.id)} style={{ marginTop: "3px" }} />
              <div>
                <strong style={{ fontSize: "0.85rem" }}>{m.display_name}</strong>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "8px" }}>[{m.provider}]</span>
              </div>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label style={labelStyle}>スキル</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {skills.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => toggleSkill(s.id)}
              className="btn-secondary"
              style={{
                fontSize: "0.75rem",
                padding: "4px 10px",
                background: skillIds.includes(s.id) ? "var(--primary-color)" : undefined,
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
          キャンセル
        </button>
        <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={submitting || !name.trim()}>
          更新する
        </button>
      </div>
    </form>
  );
};
