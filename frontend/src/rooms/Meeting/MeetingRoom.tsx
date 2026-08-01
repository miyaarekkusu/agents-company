import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentOut, TaskOut, StartMeetingRequest } from "../../api/types";
import { CharacterSprite } from "../../components/Character/CharacterSprite";
import { FurniturePiece, RoomBackground, type FurnitureLayout, type FurnitureVisual } from "../../components/Room/Furniture";
import { usePlayerMovement, type SeatDefinition } from "../../components/Room/usePlayerMovement";

interface MeetingRoomProps {
  agents: AgentOut[];
  busyAgentIds: number[];
  awaitingMeetingTasks: TaskOut[];
  meetingBusy: boolean;
  leaderAgentId: number | null;
  participantAgentIds: number[];
  onStartMeeting: (req: StartMeetingRequest) => Promise<void>;
}

type WizardStep = "idle" | "select_task" | "select_participants" | "select_leader";

const DEFAULT_MEETING_WIDTH = 400;

// テーブルと椅子の間の隙間(px)。作業室のデスクと椅子の間隔に合わせ、椅子をテーブルにぴったり
// くっつけず少し離して置く。
const CHAIR_TABLE_GAP = 15;

// 会議室の家具配置（座標は部屋コンテナのleft/bottom基準、px）。画像素材は使わず、CSSのみで表現する。
// 部屋の中央（コンテナ幅の半分）を基準に、テーブルからのオフセットで配置する。テーブルと椅子のみのシンプルな構成にする。
function getMeetingFurnitureLayout(centerX: number): FurnitureLayout[] {
  return [
    // テーブルは見た目の箱より少し外側まで当たり判定を広げる（際どく縁を掠める操作感を避けるため）
    { id: "table", x: centerX, y: 145, width: 260, height: 121, collidable: true, zIndex: 6, collisionPadding: 10 },
    { id: "chair-1", x: centerX - 130 - CHAIR_TABLE_GAP - 24, y: 100, width: 48, height: 48, collidable: false, zIndex: 5 },
    { id: "chair-2", x: centerX - 130 - CHAIR_TABLE_GAP - 24, y: 195, width: 48, height: 48, collidable: false, zIndex: 5 },
    { id: "chair-3", x: centerX + 130 + CHAIR_TABLE_GAP + 24, y: 100, width: 48, height: 48, collidable: false, zIndex: 5 },
    { id: "chair-4", x: centerX + 130 + CHAIR_TABLE_GAP + 24, y: 195, width: 48, height: 48, collidable: false, zIndex: 5 },
    { id: "chair-5", x: centerX, y: 145 - CHAIR_TABLE_GAP - 48, width: 48, height: 48, collidable: false, zIndex: 5 },
    { id: "chair-6", x: centerX, y: 266 + CHAIR_TABLE_GAP, width: 48, height: 48, collidable: false, zIndex: 5 },
  ];
}

const boxVisual = (
  emoji: string,
  label: string,
  colorFrom: string,
  colorTo: string,
  borderColor: string,
  textColor: string = "#fff",
): FurnitureVisual => ({
  fallbackStyle: {
    background: `linear-gradient(180deg, ${colorFrom} 0%, ${colorTo} 100%)`,
    borderRadius: "8px",
    boxShadow: "0 6px 12px rgba(0,0,0,0.5)",
    border: `2px solid ${borderColor}`,
    fontSize: "0.65rem",
    color: textColor,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: "1.2",
  },
  fallbackContent: (
    <>
      <div style={{ fontSize: "1.1rem" }}>{emoji}</div>
      {label}
    </>
  ),
});

const chairVisual: FurnitureVisual = {
  fallbackStyle: {
    background: "radial-gradient(circle at center, #374151 0%, #1f2937 100%)",
    border: "2px solid rgba(255,255,255,0.15)",
    borderRadius: "50%",
    boxShadow: "0 4px 8px rgba(0,0,0,0.5)",
  },
};

const MEETING_VISUALS: Record<string, FurnitureVisual> = {
  table: boxVisual("🪑", "会議テーブル", "#5c3a21", "#362213", "#82522e"),
  "chair-1": chairVisual,
  "chair-2": chairVisual,
  "chair-3": chairVisual,
  "chair-4": chairVisual,
  "chair-5": chairVisual,
  "chair-6": chairVisual,
};

// 椅子の座席アンカー（キャラクターを実際に部屋の中、椅子に座らせて表示するための位置。テーブル側を向くようにdirectionを設定）
function getMeetingSeats(centerX: number) {
  return [
    { x: centerX - 130 - CHAIR_TABLE_GAP - 24, y: 110, direction: "right" as const },
    { x: centerX - 130 - CHAIR_TABLE_GAP - 24, y: 205, direction: "right" as const },
    { x: centerX + 130 + CHAIR_TABLE_GAP + 24, y: 110, direction: "left" as const },
    { x: centerX + 130 + CHAIR_TABLE_GAP + 24, y: 205, direction: "left" as const },
    { x: centerX, y: 145 - CHAIR_TABLE_GAP - 48 + 10, direction: "back" as const },
    { x: centerX, y: 266 + CHAIR_TABLE_GAP + 10, direction: "front" as const },
  ];
}

// 社長(プレイヤー)がEキーで座れるように、同じ椅子の座席アンカーをSeatDefinition形式でも用意する
function getMeetingPlayerSeats(): SeatDefinition[] {
  return getMeetingSeats(0).map((_, i) => ({
    id: `player-seat-${i}`,
    getPosition: (containerWidth: number) => getMeetingSeats(containerWidth / 2)[i],
  }));
}

export const MeetingRoom: React.FC<MeetingRoomProps> = ({
  agents,
  busyAgentIds,
  awaitingMeetingTasks,
  meetingBusy,
  leaderAgentId,
  participantAgentIds,
  onStartMeeting,
}) => {
  const [wizardStep, setWizardStep] = useState<WizardStep>("idle");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);
  const [selectedLeaderId, setSelectedLeaderId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 社長がWASDで自由に部屋の中を歩き回れるようにする
  const sceneRef = useRef<HTMLDivElement>(null);
  const [sceneWidth, setSceneWidth] = useState(DEFAULT_MEETING_WIDTH);
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
  const meetingFurniture = getMeetingFurnitureLayout(centerX);
  const meetingSeats = getMeetingSeats(centerX);
  // getFurnitureLayout/seatsは移動フック内のuseEffectの依存配列に使われるため、毎レンダー新しい参照を
  // 渡すとRAFループが再生成され続けて移動できなくなる。安定した参照になるようメモ化する。
  const getFurnitureLayoutForPlayer = useCallback((w: number) => getMeetingFurnitureLayout(w / 2), []);
  const meetingPlayerSeats = useMemo(() => getMeetingPlayerSeats(), []);
  const {
    pos: playerPos,
    direction: playerDirection,
    isMoving: playerIsMoving,
    isSitting: playerIsSitting,
    sittingSeat: playerSittingSeat,
    getNearSeat,
  } = usePlayerMovement(sceneRef, getFurnitureLayoutForPlayer, { spawnY: 15, seats: meetingPlayerSeats });
  const nearSeat = getNearSeat();

  const availableAgents = agents.filter((a) => !busyAgentIds.includes(a.id));
  const selectedTask = awaitingMeetingTasks.find((t) => t.id === selectedTaskId) ?? null;
  const leaderCandidates = agents.filter((a) => selectedParticipants.includes(a.id));

  const resetWizard = () => {
    setWizardStep("idle");
    setSelectedTaskId(null);
    setSelectedParticipants([]);
    setSelectedLeaderId(null);
  };

  const handleStartWizard = () => {
    if (meetingBusy) return;
    setWizardStep("select_task");
  };

  const handleTaskConfirm = (taskId: number) => {
    setSelectedTaskId(taskId);
    setSelectedParticipants([]);
    setSelectedLeaderId(null);
    setWizardStep("select_participants");
  };

  const handleToggleParticipant = (id: number) => {
    setSelectedParticipants((prev) => {
      const next = prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id];
      if (selectedLeaderId !== null && !next.includes(selectedLeaderId)) {
        setSelectedLeaderId(null);
      }
      return next;
    });
  };

  const handleParticipantsConfirm = () => {
    if (selectedParticipants.length < 2) return;
    setWizardStep("select_leader");
  };

  const handleLaunchMeeting = async () => {
    if (!selectedTaskId || !selectedLeaderId || selectedParticipants.length < 2) return;
    setSubmitting(true);
    try {
      await onStartMeeting({
        task_id: selectedTaskId,
        leader_agent_id: selectedLeaderId,
        participant_agent_ids: selectedParticipants,
      });
      resetWizard();
    } catch {
      // 親コンポーネント側でトースト表示される。ウィザードの選択状態は保持し、再試行できるようにする。
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "1.5rem", alignItems: "start" }}>
      {/* Left Column: Meeting Control / Wizard */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* 会議室が使用中の場合のブロッキング表示 */}
        {meetingBusy && (
          <div className="glass-panel" style={{ padding: "1.5rem", borderLeft: "4px solid var(--warning-color)" }}>
            <h3 style={{ margin: 0, marginBottom: "8px", fontSize: "1.1rem" }}>⏳ 会議室は使用中です</h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
              他の会議が進行中のため、新しい会議は開始できません。完了するまでお待ちください。
            </p>
          </div>
        )}

        {/* 会議が開始されていない状態のデフォルトパネル */}
        {!meetingBusy && wizardStep === "idle" && (
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
        {!meetingBusy && wizardStep === "select_task" && (
          <div className="glass-panel" style={{ padding: "1.5rem" }}>
            <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>ステップ 1: お題 (タスク) の選択</h3>
            {awaitingMeetingTasks.length === 0 ? (
              <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                会議での話し合いが必要なお題はありません！社長室で新しい仕事を作成してください。
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto" }}>
                {awaitingMeetingTasks.map((t) => (
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
            <button className="btn-secondary" style={{ marginTop: "1rem", width: "100%" }} onClick={resetWizard}>
              キャンセル
            </button>
          </div>
        )}

        {!meetingBusy && wizardStep === "select_participants" && (
          <div className="glass-panel" style={{ padding: "1.5rem" }}>
            <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>ステップ 2: 参加メンバーの選択（2人以上）</h3>
            {availableAgents.length < 2 ? (
              <div style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                参加可能な（会議・作業中でない）エージェントが2人未満のため、会議を開始できません。
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto", marginBottom: "1rem" }}>
                {availableAgents.map((a) => (
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
              </div>
            )}
            {availableAgents.length >= 2 && selectedParticipants.length < 2 && (
              <div style={{ fontSize: "0.75rem", color: "var(--warning-color)", marginBottom: "10px", textAlign: "center" }}>
                あと{2 - selectedParticipants.length}人選択してください（最低2人必要です）。
              </div>
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setWizardStep("select_task")}>
                戻る
              </button>
              <button
                className="btn-primary"
                style={{ flex: 2 }}
                onClick={handleParticipantsConfirm}
                disabled={selectedParticipants.length < 2}
              >
                次へ（議長を選ぶ）
              </button>
            </div>
          </div>
        )}

        {!meetingBusy && wizardStep === "select_leader" && (
          <div className="glass-panel" style={{ padding: "1.5rem" }}>
            <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>ステップ 3: 議長 (リーダー) を選出</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", maxHeight: "250px", overflowY: "auto" }}>
              {leaderCandidates.map((a) => (
                <button
                  key={a.id}
                  className="btn-secondary"
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    background: selectedLeaderId === a.id ? "rgba(168, 85, 247, 0.18)" : undefined,
                    border: selectedLeaderId === a.id ? "2px solid var(--accent-neon)" : undefined,
                  }}
                  onClick={() => setSelectedLeaderId(a.id)}
                >
                  <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>👤</div>
                  <strong style={{ fontSize: "0.85rem" }}>{a.name}</strong>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{a.role.name}</div>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "1rem" }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setWizardStep("select_participants")}>
                戻る
              </button>
              <button
                className="btn-primary"
                style={{ flex: 2 }}
                onClick={handleLaunchMeeting}
                disabled={!selectedLeaderId || submitting}
              >
                {submitting ? "開始中..." : "会議を開始する"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: 2D Visual Room（CSSのみで表現） */}
      <div
        ref={sceneRef}
        className="glass-panel floor-carpet"
        style={{
          height: "520px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <RoomBackground
          label={`🤝 会議室${selectedTask ? ` — お題: ${selectedTask.title}` : ""}${meetingBusy ? "（💭 会議進行中）" : ""}`}
        />

        <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.7rem", position: "absolute", top: "15px", right: "20px", zIndex: 10 }}>
          ⌨️ WASDで移動
        </div>

        {meetingFurniture.map((item) => (
          <FurniturePiece key={item.id} layout={item} visual={MEETING_VISUALS[item.id]} />
        ))}

        {/* エージェントは「会議が開かれている間・参加者のみ」部屋の中に現れる（常時全員は表示しない）。
            議長は見栄えの良い正面向きの席に固定し、頭上に「議長」タグを表示する。 */}
        {meetingBusy &&
          (() => {
            const leader = agents.find((a) => a.id === leaderAgentId);
            const otherParticipants = agents.filter(
              (a) => participantAgentIds.includes(a.id) && a.id !== leaderAgentId,
            );
            const orderedParticipants = leader ? [leader, ...otherParticipants] : otherParticipants;
            // 先頭(議長)をfront-center(正面向きで一番目立つ席)に、残りは順に他の席へ
            const seatOrder = [5, 0, 1, 2, 3, 4];
            return orderedParticipants.map((agent, idx) => {
              const isLeader = agent.id === leaderAgentId;
              const seat = meetingSeats[seatOrder[idx]];
              const pos = seat
                ? { x: seat.x, y: seat.y, direction: seat.direction, state: "sitting" as const }
                : { x: centerX - 210 + (idx - meetingSeats.length) * 55, y: 355, direction: "front" as const, state: "idle" as const };
              return (
                <React.Fragment key={agent.id}>
                  {isLeader && (
                    <div
                      style={{
                        position: "absolute",
                        left: `${pos.x}px`,
                        bottom: `${pos.y + 80}px`,
                        transform: "translateX(-50%)",
                        color: "#1f2937",
                        background: "linear-gradient(180deg, #fde68a 0%, #f59e0b 100%)",
                        fontSize: "0.7rem",
                        fontWeight: "bold",
                        padding: "2px 8px",
                        borderRadius: "10px",
                        boxShadow: "0 0 8px rgba(245, 158, 11, 0.6)",
                        whiteSpace: "nowrap",
                        zIndex: 9,
                      }}
                    >
                      👑 議長
                    </div>
                  )}
                  <CharacterSprite
                    name={agent.name}
                    roleId={agent.role.id}
                    state={pos.state}
                    direction={pos.direction}
                    style={{
                      position: "absolute",
                      left: `${pos.x}px`,
                      bottom: `${pos.y}px`,
                      transform: "translateX(-50%)",
                      zIndex: 7,
                    }}
                  />
                </React.Fragment>
              );
            });
          })()}

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

        {/* 社長本人（プレイヤー）。WASDで部屋の中を自由に移動でき、椅子にEキーで座れる */}
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
      </div>
    </div>
  );
};
