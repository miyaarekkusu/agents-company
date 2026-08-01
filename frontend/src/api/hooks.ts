// 汎用ポーリングフック。App.tsx / MeetingRoom / WorkRoom / MobileChat が共通で利用する契約なので
// エクスポート名とシグネチャは変更しないこと。
import { useCallback, useEffect, useRef, useState } from "react";

export interface UsePollingResult<T> {
  data: T | null;
  error: string | null;
  refetch: () => void;
}

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  intervalMs: number,
  deps: unknown[] = []
): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 最新の fetchFn を常に参照できるようにしておく（依存配列に関数自体を含めずに済ませるため）
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  // アンマウント後やdeps変更後に古いレスポンスで状態を汚さないためのガード
  const requestIdRef = useRef(0);

  const runFetch = useCallback(() => {
    const requestId = ++requestIdRef.current;
    fetchFnRef.current()
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  useEffect(() => {
    runFetch();
    const timer = setInterval(runFetch, intervalMs);
    return () => {
      clearInterval(timer);
      // 進行中のレスポンスが古いdepsに紐づいた状態更新をしないよう無効化する
      requestIdRef.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, runFetch, ...deps]);

  return { data, error, refetch: runFetch };
}
