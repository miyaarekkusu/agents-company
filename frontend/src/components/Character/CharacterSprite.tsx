import React, { useState, useEffect } from "react";
import { getTransparentImage } from "./transparentImageLoader";
import cookAgentImg from "../../image/cook_agent2.jpg";
import cookAgentStaticImg from "../../image/cook_agent.jpg";
import designerAgentImg from "../../image/designer_agent2.jpg";
import designerAgentStaticImg from "../../image/designer_agent.jpg";
import doctorAgentImg from "../../image/doctor_agent2.jpg";
import doctorAgentStaticImg from "../../image/doctor_agent.jpg";
import presidentAgentImg from "../../image/president_agent2.jpg";
import presidentAgentStaticImg from "../../image/president_agent.jpg";
import programmingAgentImg from "../../image/programming_agent2.jpg";
import programmingAgentStaticImg from "../../image/programming_agent.jpg";

export type CharacterState = "idle" | "walking" | "discussing" | "sitting" | "working";
export type SpriteDirection = "front" | "back" | "right" | "left";

interface CharacterSpriteProps {
  name: string;
  roleId: number | string; // 1: フロントエンド, 2: バックエンドなど、または "president"
  state: CharacterState;
  direction?: SpriteDirection;
  speechBubble?: string;
  gridType?: "4x1" | "4x2"; // グリッドの自動判定を上書きするオプション
  useStaticOnly?: boolean;   // 4x1の静的スプライトのみを強制するオプション
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const CharacterSprite: React.FC<CharacterSpriteProps> = ({
  name,
  roleId,
  state,
  direction = "front",
  speechBubble,
  gridType,
  useStaticOnly = false,
  onClick,
  style,
}) => {
  // 役割に対応するスプライト画像を割り当て
  let rawSpriteImg = programmingAgentImg;
  let accessoryIcon = "⚙️";
  let roleTitle = "エージェント";

  if (roleId === "president") {
    rawSpriteImg = useStaticOnly ? presidentAgentStaticImg : presidentAgentImg;
    accessoryIcon = "👑";
    roleTitle = "社長";
  } else {
    switch (Number(roleId)) {
      case 1: // Frontend
        rawSpriteImg = useStaticOnly ? programmingAgentStaticImg : programmingAgentImg;
        accessoryIcon = "🎨";
        roleTitle = "フロントエンド";
        break;
      case 2: // Backend
        rawSpriteImg = useStaticOnly ? programmingAgentStaticImg : programmingAgentImg;
        accessoryIcon = "💪";
        roleTitle = "バックエンド";
        break;
      case 3: // Fullstack
        rawSpriteImg = useStaticOnly ? programmingAgentStaticImg : programmingAgentImg;
        accessoryIcon = "⚡";
        roleTitle = "フルスタック";
        break;
      case 4: // Tech Lead
        rawSpriteImg = useStaticOnly ? doctorAgentStaticImg : doctorAgentImg;
        accessoryIcon = "👓";
        roleTitle = "テックリード";
        break;
      case 5: // PM
        rawSpriteImg = useStaticOnly ? doctorAgentStaticImg : doctorAgentImg;
        accessoryIcon = "📋";
        roleTitle = "プロジェクトマネージャー";
        break;
      case 6: // Idea Agent (Ponta)
        rawSpriteImg = useStaticOnly ? cookAgentStaticImg : cookAgentImg;
        accessoryIcon = "💡";
        roleTitle = "アイデア出し";
        break;
      case 7: // Designer
        rawSpriteImg = useStaticOnly ? designerAgentStaticImg : designerAgentImg;
        accessoryIcon = "✏️";
        roleTitle = "デザイナー";
        break;
      default:
        rawSpriteImg = useStaticOnly ? programmingAgentStaticImg : programmingAgentImg;
        accessoryIcon = "🤖";
        roleTitle = "AIアシスタント";
    }
  }

  // ファイル名からスプライトの種類（4x2歩行か4x1静的か）を自動判定
  const detectedGrid = gridType || 
    (rawSpriteImg.includes("2.jpg") || rawSpriteImg.includes("2-") || rawSpriteImg.includes("agent2") 
      ? "4x2" 
      : "4x1");

  // 背景透過された画像の読み込み状態管理
  const [displayImg, setDisplayImg] = useState(rawSpriteImg);

  useEffect(() => {
    let active = true;
    setDisplayImg(rawSpriteImg); // Reset to raw fallback while processing
    getTransparentImage(rawSpriteImg).then((transparentUrl) => {
      if (active) {
        setDisplayImg(transparentUrl);
      }
    });
    return () => {
      active = false;
    };
  }, [rawSpriteImg]);

  // 歩行時の足踏みアニメーション切り替え用のローカル状態
  const [walkFrame, setWalkFrame] = useState(0);

  useEffect(() => {
    if (state !== "walking" || detectedGrid !== "4x2") {
      setWalkFrame(0);
      return;
    }

    // 歩行状態の場合、250ms毎に足踏みフレームを交互に入れ替え
    const interval = setInterval(() => {
      setWalkFrame((prev) => (prev === 0 ? 1 : 0));
    }, 250);

    return () => clearInterval(interval);
  }, [state, detectedGrid]);

  // 向き(direction)に対応するスプライトの横位置X(列数)のオフセットを取得
  const getBackgroundPositionX = (dir: SpriteDirection) => {
    switch (dir) {
      case "front": return "0%";
      case "back": return "33.333%";
      case "right": return "66.666%";
      case "left": return "100%";
      default: return "0%";
    }
  };

  // 足踏みアニメーションに対応するスプライトの縦位置Y(行数)のオフセットを取得
  const getBackgroundPositionY = () => {
    if (detectedGrid === "4x2" && walkFrame === 1) {
      return "100%";
    }
    return "0%";
  };

  // 画像縦横比崩れ防止のためのセルサイズ計算とCSS属性
  const spriteWidth = 64;
  const spriteHeight = detectedGrid === "4x2" ? 72 : 143;
  const backgroundSize = detectedGrid === "4x2" ? "400% 200%" : "400% 100%";

  const animClass = `state-${state}`;

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

      {/* スプライト表示用エリア */}
      <div
        style={{
          width: `${spriteWidth}px`,
          height: `${spriteHeight}px`,
          backgroundImage: `url(${displayImg})`,
          backgroundSize: backgroundSize,
          backgroundPositionX: getBackgroundPositionX(direction),
          backgroundPositionY: getBackgroundPositionY(),
          backgroundRepeat: "no-repeat",
          borderRadius: "8px",
          filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.4))",
          transition: "background-position 0.1s steps(1)",
        }}
      />

      {/* 名前と役割タグ */}
      <span className="mascot-name" style={{ marginTop: "4px" }}>
        {name}
        <div className="mascot-role" style={{ textAlign: "center", opacity: 0.85, fontSize: "0.65rem" }}>
          {accessoryIcon} {roleTitle}
        </div>
      </span>
    </div>
  );
};
