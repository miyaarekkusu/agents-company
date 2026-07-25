import React from "react";

export type CharacterState = "idle" | "walking" | "discussing" | "sitting";

interface CharacterSpriteProps {
  name: string;
  roleId: number | string; // 1: Frontend, 2: Backend, etc., or "president"
  state: CharacterState;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const CharacterSprite: React.FC<CharacterSpriteProps> = ({
  name,
  roleId,
  state,
  onClick,
  style,
}) => {
  // Determine mascot visual parameters based on roleId
  let bodyColor = "#4f46e5"; // default purple
  let accessoryIcon = "⚙️";
  let faceType = "smile";

  if (roleId === "president") {
    bodyColor = "#1e293b"; // dark slate
    accessoryIcon = "👑";
    faceType = "cool";
  } else {
    switch (Number(roleId)) {
      case 1: // Frontend
        bodyColor = "#ec4899"; // pink
        accessoryIcon = "🎨";
        faceType = "dizzy"; // clumsy
        break;
      case 2: // Backend
        bodyColor = "#ef4444"; // red/orange
        accessoryIcon = "💪";
        faceType = "happy";
        break;
      case 4: // Tech Lead
        bodyColor = "#06b6d4"; // cyan
        accessoryIcon = "👓";
        faceType = "glasses";
        break;
      case 6: // Idea Agent (Ponta)
        bodyColor = "#eab308"; // yellow
        accessoryIcon = "💡";
        faceType = "excited";
        break;
      case 7: // Designer
        bodyColor = "#a855f7"; // purple
        accessoryIcon = "✏️";
        faceType = "sparkle";
        break;
      default:
        bodyColor = "#3b82f6"; // blue
        accessoryIcon = "🤖";
        faceType = "smile";
    }
  }

  // Define eyes and mouth based on expression faceType
  let eyesSvg = (
    <>
      <circle cx="28" cy="28" r="3" fill="#fff" />
      <circle cx="36" cy="28" r="3" fill="#fff" />
    </>
  );
  let mouthSvg = <path d="M 28 36 Q 32 40 36 36" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />;

  if (faceType === "dizzy") {
    // Clumsy/Dizzy eyes: x shapes
    eyesSvg = (
      <>
        <path d="M 26 26 L 30 30 M 30 26 L 26 30" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <path d="M 34 26 L 38 30 M 38 26 L 34 30" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </>
    );
    mouthSvg = <path d="M 29 37 Q 32 34 35 37" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />;
  } else if (faceType === "cool") {
    // Cool sunglasses
    eyesSvg = (
      <path d="M 24 26 H 40 V 30 H 24 V 26 Z M 24 28 Q 32 34 40 28" fill="#111" stroke="#fff" strokeWidth="1" />
    );
    mouthSvg = <path d="M 29 37 H 35" stroke="#fff" strokeWidth="2" strokeLinecap="round" />;
  } else if (faceType === "glasses") {
    eyesSvg = (
      <>
        <circle cx="27" cy="28" r="4.5" stroke="#fff" strokeWidth="1.5" fill="none" />
        <circle cx="37" cy="28" r="4.5" stroke="#fff" strokeWidth="1.5" fill="none" />
        <line x1="31.5" y1="28" x2="32.5" y2="28" stroke="#fff" strokeWidth="1.5" />
        <circle cx="27" cy="28" r="1.5" fill="#fff" />
        <circle cx="37" cy="28" r="1.5" fill="#fff" />
      </>
    );
  } else if (faceType === "excited") {
    eyesSvg = (
      <>
        <path d="M 25 29 Q 28 25 31 29" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 33 29 Q 36 25 39 29" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    );
    mouthSvg = <path d="M 27 34 Q 32 42 37 34" stroke="#fff" strokeWidth="2" fill="#fff" strokeLinecap="round" />;
  }

  const animClass = `state-${state}`;

  return (
    <div
      className={`mascot-container ${animClass}`}
      onClick={onClick}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        ...style,
      }}
    >
      <svg
        className="mascot-avatar"
        viewBox="0 0 64 64"
        width="64"
        height="64"
        style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.3))" }}
      >
        {/* Shadow */}
        <ellipse cx="32" cy="58" rx="20" ry="4" fill="rgba(0,0,0,0.25)" />

        {/* Body (Cute rounded slime/robot shape) */}
        <rect
          x="12"
          y="16"
          width="40"
          height="38"
          rx="18"
          ry="18"
          fill={bodyColor}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="2"
        />

        {/* Accessory on the side or head */}
        <text x="44" y="22" fontSize="16" textAnchor="middle">
          {accessoryIcon}
        </text>

        {/* Face Display Panel */}
        <rect x="20" y="22" width="24" height="18" rx="6" ry="6" fill="rgba(0,0,0,0.2)" />

        {/* Face Elements */}
        {eyesSvg}
        {mouthSvg}

        {/* Hands */}
        <circle cx="9" cy="38" r="4" fill={bodyColor} />
        <circle cx="55" cy="38" r="4" fill={bodyColor} />
      </svg>
      <span className="mascot-name">
        {name}
        <div className="mascot-role" style={{ textAlign: "center" }}>
          {roleId === "president" ? "社長" : accessoryIcon}
        </div>
      </span>
    </div>
  );
};
