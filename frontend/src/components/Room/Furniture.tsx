import React from "react";

/**
 * 部屋の家具レイアウト（座標・当たり判定の唯一の情報源）。
 * 見た目(FurnitureVisual)とは分離してあるので、`imageUrl`を使った画像表示に差し替える際も
 * ここの座標・当たり判定はそのまま使い回せる。社長室・会議室・作業室で共通して使う。
 */
export interface FurnitureLayout {
  id: string;
  x: number; // 中心x座標（left基準、translateX(-50%)で中央寄せする前提）
  y: number; // bottom座標
  width: number;
  height: number;
  collidable: boolean;
  zIndex?: number;
  // 当たり判定を見た目の箱より少し外側まで広げるための余白(px)。机など「囲むように」当たり判定を
  // 持たせたい家具に指定する（見た目の箱ぴったりだと、キャラクターが際どく縁を掠める操作感になるため）。
  collisionPadding?: number;
}

/**
 * 家具の「見た目」（`imageUrl`未設定の間はCSSのフォールバック表示、設定したら画像表示に切り替わる）。
 * `FurnitureLayout`のidに対応させて使う。
 */
export interface FurnitureVisual {
  imageUrl?: string;
  fallbackStyle?: React.CSSProperties;
  fallbackContent?: React.ReactNode;
  onClick?: () => void;
}

export interface ObstacleRect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** collidable指定の家具から、当たり判定の矩形一覧を導出する（見た目と当たり判定がズレないようにするため）。 */
export function obstaclesFromLayout(layout: FurnitureLayout[]): ObstacleRect[] {
  return layout
    .filter((f) => f.collidable)
    .map((f) => {
      const pad = f.collisionPadding ?? 0;
      return {
        minX: f.x - f.width / 2 - pad,
        maxX: f.x + f.width / 2 + pad,
        minY: f.y - pad,
        maxY: f.y + f.height + pad,
      };
    });
}

export function collidesAt(
  x: number,
  y: number,
  obstacles: ObstacleRect[],
  hitboxHalfWidth: number,
  hitboxHeight: number,
): boolean {
  const left = x - hitboxHalfWidth;
  const right = x + hitboxHalfWidth;
  const bottom = y;
  const top = y + hitboxHeight;
  return obstacles.some((o) => left < o.maxX && right > o.minX && bottom < o.maxY && top > o.minY);
}

/** 家具1点の描画。`visual.imageUrl`が設定されていれば画像、無ければCSSのフォールバック表示にする。 */
export const FurniturePiece: React.FC<{ layout: FurnitureLayout; visual?: FurnitureVisual }> = ({ layout, visual }) => {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: `${layout.x}px`,
    bottom: `${layout.y}px`,
    transform: "translateX(-50%)",
    width: `${layout.width}px`,
    height: `${layout.height}px`,
    zIndex: layout.zIndex ?? 5,
    cursor: visual?.onClick ? "pointer" : undefined,
  };

  if (visual?.imageUrl) {
    return (
      <img
        src={visual.imageUrl}
        alt=""
        onClick={visual.onClick}
        style={{ ...baseStyle, objectFit: "contain", filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.4))" }}
      />
    );
  }

  return (
    <div
      onClick={visual?.onClick}
      style={{ ...baseStyle, display: "flex", alignItems: "center", justifyContent: "center", ...visual?.fallbackStyle }}
    >
      {visual?.fallbackContent}
    </div>
  );
};

/** 部屋のラベル表示。背景自体はCSSのfloor-*クラスを部屋コンテナに直接あてる方式なので、ここではラベルのみ表示する。 */
export const RoomBackground: React.FC<{ imageUrl?: string; label: string }> = ({ imageUrl, label }) => (
  <>
    {imageUrl && (
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center bottom",
          zIndex: 0,
        }}
      />
    )}
    <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.85rem", position: "absolute", top: "15px", left: "20px", zIndex: 10, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
      {label}
    </div>
  </>
);
