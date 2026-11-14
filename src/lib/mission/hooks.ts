import { useEffect, useMemo, useRef, useState } from "react";
import type { DayLog, CrewMember } from "@/lib/hyperlife/types";
import { briefFacts, clearBriefCache, generateBrief, templateBrief, type MissionBrief } from "./brief";
import { buildMissionView, buildSnapshot, type MissionView } from "./snapshot";

/** Wall-clock tick. The dashboard is client-rendered, so a local initial value is safe. */
export function useMissionClock(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useMissionView(
  user: CrewMember,
  logs: Record<string, DayLog>,
  at: number,
  modelEpoch = 0,
) {
  return useMemo(() => buildMissionView(user, logs, at), [user, logs, at, modelEpoch]);
}

export function useLiveSnapshot(user: CrewMember, logs: Record<string, DayLog>, at: number, modelEpoch = 0) {
  return useMemo(() => buildSnapshot(user, logs, at), [user, logs, at, modelEpoch]);
}

export function useMissionBrief(snap: MissionView["snapshot"], view: MissionView, enabled = true) {
  const bucket = Math.floor(snap.at / 300_000);
  const latest = useRef({ snap, view });
  latest.current = { snap, view };
  const [nonce, setNonce] = useState(0);
  const [brief, setBrief] = useState<MissionBrief>(() => {
    const facts = briefFacts(snap, view);
    return { text: templateBrief(facts), source: "template", generatedAt: Date.now() };
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const facts = briefFacts(latest.current.snap, latest.current.view);
    setBrief((current) =>
      current.source === "template" ? { text: templateBrief(facts), source: "template", generatedAt: Date.now() } : current,
    );
    setLoading(true);
    generateBrief(facts)
      .then((next) => {
        if (alive) {
          setBrief(next);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [bucket, enabled, nonce, snap.profile.key]);

  return {
    brief,
    loading,
    refresh: () => {
      clearBriefCache();
      setNonce((n) => n + 1);
    },
  };
}
