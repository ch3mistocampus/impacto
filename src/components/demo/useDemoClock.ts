"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "impacto.demo.clock";
const TAB_KEY = "impacto.demo.newTab";

type ClockState = {
  /** Epoch ms when the stopwatch was last started; null when paused/stopped. */
  runningSince: number | null;
  /** Ms accumulated before the current run. */
  accumulated: number;
  /** 0-based current step. */
  step: number;
  /** Elapsed ms (on the stopwatch) when the current step began. */
  stepStartedAt: number;
};

const INITIAL: ClockState = { runningSince: null, accumulated: 0, step: 0, stepStartedAt: 0 };

function elapsedAt(s: ClockState, now: number) {
  return s.accumulated + (s.runningSince !== null ? Math.max(0, now - s.runningSince) : 0);
}

/**
 * Stopwatch + current step for the presenter console. Persisted in localStorage so it survives a
 * same-tab navigation to a role page and back.
 */
export function useDemoClock() {
  const [state, setState] = useState<ClockState>(INITIAL);
  const [now, setNow] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // Hydrate from localStorage after mount (avoids SSR mismatch).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setState({ ...INITIAL, ...(JSON.parse(raw) as Partial<ClockState>) });
    } catch {}
    setNow(Date.now());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state, hydrated]);

  const running = state.runningSince !== null;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  const start = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setState((s) => (s.runningSince !== null ? s : { ...s, runningSince: t }));
  }, []);

  const pause = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setState((s) => (s.runningSince === null ? s : { ...s, accumulated: elapsedAt(s, t), runningSince: null }));
  }, []);

  const reset = useCallback(() => {
    setNow(Date.now());
    setState(INITIAL);
  }, []);

  /** Make `step` current; its timer starts now. Starts the stopwatch if it is not running. */
  const goToStep = useCallback((step: number, autoStart = false) => {
    const t = Date.now();
    setNow(t);
    setState((s) => {
      const el = elapsedAt(s, t);
      const runningSince = autoStart && s.runningSince === null ? t : s.runningSince;
      const accumulated = autoStart && s.runningSince === null ? el : s.accumulated;
      return { runningSince, accumulated, step, stepStartedAt: el };
    });
  }, []);

  const elapsedMs = elapsedAt(state, now || state.runningSince || 0);
  return {
    hydrated,
    running,
    step: state.step,
    elapsed: elapsedMs / 1000,
    stepElapsed: Math.max(0, elapsedMs - state.stepStartedAt) / 1000,
    start,
    pause,
    reset,
    goToStep,
  };
}

/** "Open steps in a new tab" preference (default on). */
export function useNewTabPref() {
  const [newTab, setNewTabState] = useState(true);
  useEffect(() => {
    try {
      const v = localStorage.getItem(TAB_KEY);
      // Hydrate from localStorage after mount (avoids SSR mismatch).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v === "0") setNewTabState(false);
    } catch {}
  }, []);
  const setNewTab = useCallback((on: boolean) => {
    setNewTabState(on);
    try {
      localStorage.setItem(TAB_KEY, on ? "1" : "0");
    } catch {}
  }, []);
  return [newTab, setNewTab] as const;
}
