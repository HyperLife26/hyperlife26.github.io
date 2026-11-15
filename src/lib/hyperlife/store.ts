import { useSyncExternalStore } from "react";
import { format, subDays } from "date-fns";
import type { CrewMember, DayLog, FoodLog, HealthLog, MoodLog, RegistrationDraft, FaceScale } from "./types";
import { MEAL_PRESETS } from "./constants";
import { seededRandom, hashString } from "./scoring";
import { buildSnapshot } from "@/lib/mission/snapshot";
import { FIXED_MISSION_START, missionDayAt } from "@/lib/mission/profiles";

interface State {
  users: CrewMember[];
  logs: Record<string, Record<string, DayLog>>;
  currentUserId: string | null;
  draft: RegistrationDraft | null;
}

const KEY = "hyperlife:v1";
const EMPTY: State = { users: [], logs: {}, currentUserId: null, draft: null };

let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

export const todayKey = () => format(new Date(), "yyyy-MM-dd");

function normalizeState(s: State): State {
  const users = s.users.map((u) =>
    FIXED_MISSION_START[u.id] && u.missionStart !== FIXED_MISSION_START[u.id]
      ? { ...u, missionStart: FIXED_MISSION_START[u.id]! }
      : u,
  );
  return users === s.users ? s : { ...s, users };
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    state = normalizeState(raw ? { ...EMPTY, ...JSON.parse(raw) } : seedCrew());
    if (!raw) persist();
  } catch {
    state = seedCrew();
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full / disabled */
  }
}

function setState(updater: (s: State) => State) {
  load();
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY && e.newValue) {
      state = { ...EMPTY, ...JSON.parse(e.newValue) };
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  load();
  return state;
}

export function useHyperLife() {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

const noopSubscribe = () => () => {};
/** false during SSR + hydration, true once the browser store is readable */
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function useCurrentUser() {
  const s = useHyperLife();
  const user = s.users.find((u) => u.id === s.currentUserId) ?? null;
  const today = todayKey();
  const todayLog = user ? s.logs[user.id]?.[today] : undefined;
  return { user, todayLog, today, logs: user ? (s.logs[user.id] ?? {}) : {} };
}

export const missionDay = (u: CrewMember, at = new Date()) => missionDayAt(u, at.getTime());

/* ---------------- actions ---------------- */

const uid = () => Math.random().toString(36).slice(2, 10);

export const actions = {
  selectUser(id: string | null) {
    setState((s) => ({ ...s, currentUserId: id }));
  },
  setDraft(draft: RegistrationDraft | null) {
    setState((s) => ({ ...s, draft }));
  },
  registerFromDraft(environment: CrewMember["environment"]) {
    load();
    const d = state.draft;
    if (!d?.crewId || !d.avatar || !d.sex || !d.age || !d.weightKg || !d.heightCm) return null;
    const user: CrewMember = {
      id: uid(),
      crewId: d.crewId,
      age: d.age,
      sex: d.sex,
      weightKg: d.weightKg,
      heightCm: d.heightCm,
      avatar: d.avatar,
      environment,
      missionStart: todayKey(),
    };
    setState((s) => ({ ...s, users: [...s.users, user], currentUserId: user.id, draft: null }));
    return user;
  },
  removeUser(id: string) {
    setState((s) => {
      const logs = { ...s.logs };
      delete logs[id];
      return {
        ...s,
        users: s.users.filter((u) => u.id !== id),
        logs,
        currentUserId: s.currentUserId === id ? null : s.currentUserId,
      };
    });
  },
  saveLog<K extends keyof DayLog>(userId: string, date: string, key: K, value: DayLog[K] | undefined) {
    setState((s) => {
      const userLogs = { ...(s.logs[userId] ?? {}) };
      const day = { ...(userLogs[date] ?? {}) };
      if (value === undefined) delete day[key];
      else day[key] = value;
      userLogs[date] = day;
      return { ...s, logs: { ...s.logs, [userId]: userLogs } };
    });
  },
};

/* ---------------- crew comparison ---------------- */

export interface CrewStanding {
  user: CrewMember;
  score: number | null;
  rank: string | null;
  date: string | null;
  previous: number | null;
}

export function crewStandings(s: State, at = Date.now()): CrewStanding[] {
  return s.users
    .map((user) => {
      const logs = s.logs[user.id] ?? {};
      const now = buildSnapshot(user, logs, at);
      const previous = buildSnapshot(user, logs, at - 86_400_000).score;
      return {
        user,
        score: now.score,
        rank: now.rank,
        date: format(new Date(at), "yyyy-MM-dd"),
        previous,
      };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

/* ---------------- seed crew ---------------- */

function seedCrew(): State {
  const now = new Date();
  const roster: (Omit<CrewMember, "missionStart"> & { vibe: number })[] = [
    { id: "crew-orion", crewId: "CDR-ORION", age: 41, sex: "female", weightKg: 64, heightCm: 168, avatar: "female", environment: "mars", vibe: 0.85 },
    { id: "crew-vega", crewId: "SCI-VEGA", age: 34, sex: "male", weightKg: 78, heightCm: 181, avatar: "male", environment: "moon", vibe: 0.6 },
    { id: "crew-kito", crewId: "ENG-KITO", age: 29, sex: "other", weightKg: 58, heightCm: 172, avatar: "alien", environment: "ship", vibe: 0.4 },
  ];
  const users: CrewMember[] = [];
  const logs: State["logs"] = {};

  for (const d of roster) {
    const { vibe, ...rest } = d;
    users.push({ ...rest, missionStart: FIXED_MISSION_START[d.id]! });
    const rand = seededRandom(hashString(d.id));
    const r = (lo: number, hi: number) => lo + rand() * (hi - lo);
    const face = (bias: number) => Math.min(5, Math.max(1, Math.round(1 + 4 * (bias * 0.7 + rand() * 0.3)))) as FaceScale;
    logs[d.id] = {};
    // previous 6 days complete, today left empty for the seed crew
    for (let i = 6; i >= 1; i--) {
      const date = format(subDays(now, i), "yyyy-MM-dd");
      const mood: MoodLog = {
        feeling: face(vibe),
        calm: face(vibe),
        sleepHours: Math.round(r(5 + vibe * 2, 7 + vibe * 1.5) * 2) / 2,
        workload: Math.round(r(4, 9 - vibe * 3)),
        familyContact: rand() < vibe ? "today" : rand() < 0.5 ? "week" : "not-recently",
        crewRelationship: face(vibe + 0.1),
      };
      const health: HealthLog = {
        exercised: rand() < 0.5 + vibe * 0.5,
        exerciseMinutes: Math.round(r(30, 60 + vibe * 60) / 5) * 5,
        painLevel: Math.round(r(0, 7 - vibe * 5)),
        symptoms: rand() > vibe + 0.2 ? ["fatigue"] : [],
      };
      const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
      const food: FoodLog = {
        meals: {
          breakfast: pick(MEAL_PRESETS.breakfast),
          lunch: pick(MEAL_PRESETS.lunch),
          dinner: pick(MEAL_PRESETS.dinner),
          ...(rand() < 0.7 ? { snack: pick(MEAL_PRESETS.snack) } : {}),
        },
        waterMl: Math.round(r(1250, 2750) / 250) * 250,
        supplements: rand() < vibe + 0.2,
      };
      logs[d.id][date] = { mood, health, food };
    }
  }
  return { users, logs, currentUserId: null, draft: null };
}

/** Energy shown in the HUD: the live mission score from the on-device model. */
export function energyFor(user: CrewMember, logs: Record<string, DayLog>) {
  return buildSnapshot(user, logs, Date.now()).score;
}
