import React from "react";

export type CharacterState = "idle" | "walking" | "discussing" | "sitting" | "working";
export type SpriteDirection = "front" | "back" | "right" | "left";

interface CharacterSpriteProps {
  name: string;
  roleId: number | string; // 1: フロントエンド, 2: バックエンドなど、または "president"
  state: CharacterState;
  direction?: SpriteDirection;
  speechBubble?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

// 画像素材は使わず、役職ごとに複数種類の絵文字を使い分けて表現する。
// state（座っている/作業中等）によって絵文字自体は変えない。椅子や机の上にそのまま乗っているように見せる。

export const CharacterSprite: React.FC<CharacterSpriteProps> = ({
  name,
  roleId,
  state,
  direction = "front",
  speechBubble,
  onClick,
  style,
}) => {
  // 役割に対応するアクセサリーアイコン・役職名・キャラクター本体の絵文字を割り当て（役職ごとに絵文字を変えて多様性を出す）
  let accessoryIcon = "⚙️";
  let roleTitle = "エージェント";
  let bodyEmoji = "🤖";

  if (roleId === "president") {
    accessoryIcon = "👑";
    roleTitle = "社長";
    bodyEmoji = "🧑‍💼";
  } else {
    switch (Number(roleId)) {
      case 1: // Frontend
        accessoryIcon = "🎨";
        roleTitle = "フロントエンド";
        bodyEmoji = "🧑‍💻";
        break;
      case 2: // Backend
        accessoryIcon = "💪";
        roleTitle = "バックエンド";
        bodyEmoji = "🧑‍🔧";
        break;
      case 3: // Fullstack
        accessoryIcon = "⚡";
        roleTitle = "フルスタック";
        bodyEmoji = "🧑‍🚀";
        break;
      case 4: // Tech Lead
        accessoryIcon = "👓";
        roleTitle = "テックリード";
        bodyEmoji = "🧑‍🏫";
        break;
      case 5: // PM
        accessoryIcon = "📋";
        roleTitle = "プロジェクトマネージャー";
        bodyEmoji = "🧑‍💼";
        break;
      case 6: // Idea Agent (Ponta)
        accessoryIcon = "💡";
        roleTitle = "アイデア出し";
        bodyEmoji = "🧑‍🔬";
        break;
      case 7: // Designer
        accessoryIcon = "✏️";
        roleTitle = "デザイナー";
        bodyEmoji = "🧑‍🎨";
        break;
      default:
        accessoryIcon = "🤖";
        roleTitle = "AIアシスタント";
        bodyEmoji = "🤖";
    }
  }

  const animClass = `state-${state}`;
  const mirrored = direction === "right";

  return (
    <div
      className={`mascot-container ${animClass}`}
      onClick={onClick}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        position: "absolute",
        cursor: "pointer",
        zIndex: 10,
        ...style,
      }}
    >
      {/* 吹き出し(Speech/Instruction Bubble)の表示 */}
      {speechBubble && (
        <div
          className="speech-bubble-popup"
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%) translateY(-8px)",
            background: "rgba(15, 23, 42, 0.95)",
            border: "2px solid var(--secondary-color)",
            color: "#fff",
            padding: "6px 12px",
            borderRadius: "12px",
            fontSize: "0.75rem",
            whiteSpace: "normal",
            maxWidth: "180px",
            textAlign: "center",
            boxShadow: "0 4px 15px var(--secondary-glow)",
            pointerEvents: "none",
            animation: "float 2s ease-in-out infinite",
            wordBreak: "break-word"
          }}
        >
          {speechBubble}
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "0",
              height: "0",
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid var(--secondary-color)",
            }}
          />
        </div>
      )}

      {/* 名前と役割タグ（キャラクターの頭上に表示） */}
      <span className="mascot-name" style={{ marginBottom: "4px" }}>
        {name}
        <div className="mascot-role" style={{ textAlign: "center", opacity: 0.85, fontSize: "0.65rem" }}>
          {accessoryIcon} {roleTitle}
        </div>
      </span>

      {/* スプライト表示エリア: 全キャラクター共通の絵文字を表示。状態はCSSアニメーション(state-*)、向きは左右反転で表現 */}
      <div
        style={{
          position: "relative",
          display: "inline-flex",
          justifyContent: "center",
        }}
      >
        {/* 接地シャドウ：足元の真下に固定表示する */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: "-2px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "60%",
            height: "8px",
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 70%)",
            pointerEvents: "none",
          }}
        />
        <span
          role="img"
          aria-label={`${name} (${roleTitle})`}
          style={{
            fontSize: "2.6rem",
            lineHeight: 1,
            display: "inline-block",
            transform: mirrored ? "scaleX(-1)" : undefined,
            filter: "drop-shadow(0 6px 6px rgba(0,0,0,0.4))",
          }}
        >
          {bodyEmoji}
        </span>
      </div>
    </div>
  );
};
