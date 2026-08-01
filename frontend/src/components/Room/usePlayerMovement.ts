import { useEffect, useRef, useState } from "react";
import { obstaclesFromLayout, collidesAt, type FurnitureLayout } from "./Furniture";
import type { SpriteDirection } from "../Character/CharacterSprite";

const KEY_DIRECTION: Record<string, SpriteDirection> = {
  w: "back",
  s: "front",
  a: "left",
  d: "right",
};

// sceneWidth実測前のフォールバック値。ResizeObserverで実測できた時点で一度だけ中央に再配置する。
const DEFAULT_CONTAINER_WIDTH = 400;

export interface SeatPosition {
  x: number;
  y: number;
  direction: SpriteDirection;
}

export interface SeatDefinition {
  id: string;
  // containerWidthを受け取って座席の座標を計算する（部屋の中央基準レイアウトに追従させるため）
  getPosition: (containerWidth: number) => SeatPosition;
}

export interface PlayerMovementOptions {
  speed?: number;
  hitboxHalfWidth?: number;
  hitboxHeight?: number;
  spawnY?: number;
  // 指定すると、近くの座席でEキーによる座る/立つ操作ができるようになる（社長室の椅子と同じ仕組み）
  seats?: SeatDefinition[];
  sitProximity?: number;
}

/**
 * プレイヤー(社長)をWASDキーで自由に動かすための共通フック。家具レイアウト(containerWidthを
 * 受け取って計算する関数)との当たり判定を行う。seatsを指定した場合のみ、Eキーでの着席/起立にも対応する。
 * 家具・部屋のコンテナ幅に応じた配置は各部屋のgetXxxFurnitureLayout(containerWidth)側で行う。
 *
 * 座席の当たり判定については要注意: 座席アンカーが家具の当たり判定(collidable)の内側にあると、
 * 立ち上がった瞬間に自分の位置がすでに障害物と重なり、二度と動けなくなるバグの原因になる
 * （社長室の椅子で実際に発生し修正済み）。座席として使う家具はcollidable:falseにすること。
 */
export function usePlayerMovement(
  containerRef: React.RefObject<HTMLDivElement | null>,
  getFurnitureLayout: (containerWidth: number) => FurnitureLayout[],
  options: PlayerMovementOptions = {},
) {
  const speed = options.speed ?? 3.2;
  const hitboxHalfWidth = options.hitboxHalfWidth ?? 14;
  const hitboxHeight = options.hitboxHeight ?? 12;
  const spawnY = options.spawnY ?? 30;
  const seats = options.seats;
  const sitProximity = options.sitProximity ?? 45;

  const [pos, setPos] = useState({ x: DEFAULT_CONTAINER_WIDTH / 2, y: spawnY });
  const [direction, setDirection] = useState<SpriteDirection>("front");
  const [isMoving, setIsMoving] = useState(false);
  const [isSitting, setIsSitting] = useState(false);
  const [sittingSeat, setSittingSeat] = useState<SeatPosition | null>(null);
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const lastKeyRef = useRef<string | null>(null);
  const hasCenteredRef = useRef(false);
  const posRef = useRef(pos);
  const isSittingRef = useRef(isSitting);
  const skipMoveRef = useRef(false);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);
  useEffect(() => {
    isSittingRef.current = isSitting;
  }, [isSitting]);

  // 現在地から一定距離内にある座席のうち最も近いものを探す
  const findNearestSeat = (x: number, y: number, containerWidth: number): SeatPosition | null => {
    if (!seats || seats.length === 0) return null;
    let best: SeatPosition | null = null;
    let bestDist = Infinity;
    for (const seat of seats) {
      const p = seat.getPosition(containerWidth);
      const dist = Math.hypot(x - p.x, y - p.y);
      if (dist <= sitProximity && dist < bestDist) {
        best = p;
        bestDist = dist;
      }
    }
    return best;
  };

  // 部屋コンポーネント側で「Eキーで座る」プロンプトを出すために、今近くにある座席を取得する
  const getNearSeat = (): SeatPosition | null => {
    if (!seats || isSittingRef.current) return null;
    const width = containerRef.current?.clientWidth ?? DEFAULT_CONTAINER_WIDTH;
    return findNearestSeat(posRef.current.x, posRef.current.y, width);
  };

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const tag = (target as HTMLElement | null)?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();

      if (key === "e" && seats) {
        if (e.repeat) return; // キー長押しでの連続トグルを防ぐ
        if (isSittingRef.current) {
          setIsSitting(false);
          setSittingSeat(null);
        } else {
          const width = containerRef.current?.clientWidth ?? DEFAULT_CONTAINER_WIDTH;
          const seat = findNearestSeat(posRef.current.x, posRef.current.y, width);
          if (seat) {
            setPos({ x: seat.x, y: seat.y });
            setIsSitting(true);
            setSittingSeat(seat);
          }
        }
        return;
      }

      if (!(key in KEY_DIRECTION)) return;

      if (isSittingRef.current) {
        // WASDでも立ち上がる。ただし「立ち上がった瞬間」に同時に移動が適用されるとカクつくので、
        // このフレームの移動は見送り、次フレーム以降で通常通り反映させる。
        setIsSitting(false);
        setSittingSeat(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats]);

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      // 実測されたコンテナ幅が判明した時点で一度だけ、初期スポーン位置を部屋の中央に合わせ直す
      if (!hasCenteredRef.current) {
        const width = containerRef.current?.clientWidth;
        if (width && width !== DEFAULT_CONTAINER_WIDTH) {
          hasCenteredRef.current = true;
          setPos({ x: width / 2, y: spawnY });
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
        if (keys.has("w")) dy += speed;
        if (keys.has("s")) dy -= speed;
        if (keys.has("a")) dx -= speed;
        if (keys.has("d")) dx += speed;
        if (dx !== 0 && dy !== 0) {
          dx *= Math.SQRT1_2;
          dy *= Math.SQRT1_2;
        }
        if (dx !== 0 || dy !== 0) {
          const bounds = containerRef.current;
          const width = bounds?.clientWidth ?? DEFAULT_CONTAINER_WIDTH;
          const height = bounds?.clientHeight ?? 480;
          const obstacles = obstaclesFromLayout(getFurnitureLayout(width));
          setPos((prev) => {
            // x軸・y軸を別々に判定することで、家具の角に沿ってスライドできるようにする
            const candidateX = Math.min(Math.max(prev.x + dx, 30), width - 30);
            const nextX = collidesAt(candidateX, prev.y, obstacles, hitboxHalfWidth, hitboxHeight) ? prev.x : candidateX;
            const candidateY = Math.min(Math.max(prev.y + dy, 15), height - 110);
            const nextY = collidesAt(nextX, candidateY, obstacles, hitboxHalfWidth, hitboxHeight) ? prev.y : candidateY;
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
  }, [containerRef, getFurnitureLayout, speed, hitboxHalfWidth, hitboxHeight, spawnY]);

  return { pos, direction, isMoving, isSitting, sittingSeat, getNearSeat };
}
