import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { RequireCrew } from "@/components/pixel/RequireCrew";
import { ScreenShell } from "@/components/pixel/ScreenShell";
import { Panel } from "@/components/pixel/Panel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelIcon } from "@/components/pixel/PixelIcon";
import { SegmentBar } from "@/components/pixel/SegmentBar";
import { MEAL_PRESETS, MEAL_SLOTS } from "@/lib/hyperlife/constants";
import { actions, energyFor } from "@/lib/hyperlife/store";
import { FOOD_SCORE_MAX, foodScore, foodTargets, foodTotals, isFoodLogged, rankFor } from "@/lib/hyperlife/scoring";
import type { CrewMember, DayLog, FoodLog, Meal, MealSlot } from "@/lib/hyperlife/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/food")({
  head: () => ({
    meta: [
      { title: "Food Diary · HyperLife" },
      { name: "description", content: "Log meals, water and supplements and track your daily fuel gauges." },
      { property: "og:title", content: "Food Diary · HyperLife" },
      { property: "og:description", content: "Log meals, water and supplements and track your daily fuel gauges." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <RequireCrew>{(ctx) => <FoodDiary {...ctx} />}</RequireCrew>,
});

const EMPTY_FOOD: FoodLog = { meals: {}, waterMl: 0, supplements: false };

function FoodDiary({ user, today, logs }: { user: CrewMember; todayLog?: DayLog; today: string; logs: Record<string, DayLog> }) {
  const navigate = useNavigate();
  const [viewDate, setViewDate] = useState(today);
  const [draft, setDraft] = useState<FoodLog>(logs[today]?.food ?? EMPTY_FOOD);
  const [editing, setEditing] = useState<MealSlot | null>(null);

  const isToday = viewDate === today;
  const food = isToday ? draft : (logs[viewDate]?.food ?? EMPTY_FOOD);
  const targets = useMemo(() => foodTargets(user), [user]);
  const totals = foodTotals(food);
  const score = foodScore(food, targets);
  const rank = rankFor(score.total);

  const saves = Object.entries(logs)
    .filter(([d, l]) => d !== today && isFoodLogged(l.food))
    .sort(([a], [b]) => (a < b ? 1 : -1));
  const savedToday = isFoodLogged(logs[today]?.food);
  const daysLogged = saves.length + (savedToday ? 1 : 0);

  const setMeal = (slot: MealSlot, meal: Meal | undefined) =>
    setDraft((d) => {
      const meals = { ...d.meals };
      if (meal) meals[slot] = meal;
      else delete meals[slot];
      return { ...d, meals };
    });

  const saveDay = () => {
    if (!isFoodLogged(draft)) return toast("Log at least one meal before saving.");
    actions.saveLog(user.id, today, "food", draft);
    toast(`Food diary saved: day score ${score.total} (rank ${rank}) ★`);
    navigate({ to: "/base" });
  };

  return (
    <ScreenShell
      icon="food"
      title="Food diary"
      user={user}
      energy={energyFor(user, logs)}
      right={
        <p className="text-2xl leading-none text-muted-foreground">
          {daysLogged} save{daysLogged === 1 ? "" : "s"} <span className="pixel-label ml-2 text-sky">{isToday ? "Editing today" : "Viewing save"}</span>
        </p>
      }
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_1fr_360px]">
        {/* ---------- save files ---------- */}
        <Panel as="aside" kicker="Save files" title={`${daysLogged} day${daysLogged === 1 ? "" : "s"} logged`} className="flex flex-col">
          <ul className="-mx-2 flex-1 space-y-2">
            <SaveRow active={isToday} onClick={() => setViewDate(today)} date={today} food={draft} targets={targets} label="Today" />
            {saves.map(([d, l]) => (
              <SaveRow key={d} active={viewDate === d} onClick={() => setViewDate(d)} date={d} food={l.food!} targets={targets} />
            ))}
          </ul>
          <PixelButton variant="ghost" className="mt-4 w-full" onClick={() => setViewDate(today)}>
            + Today
          </PixelButton>
        </Panel>

        {/* ---------- day ---------- */}
        <Panel kicker="Save file" title={format(parseISO(viewDate), "EEEE, MMMM d, yyyy")}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {MEAL_SLOTS.map(({ slot, label }) => {
              const m = food.meals[slot];
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={!isToday}
                  onClick={() => setEditing(slot)}
                  className={cn(
                    "pixel-focus flex min-h-[230px] flex-col items-center justify-center gap-2 border-[3px] bg-space px-3 py-5 text-center transition-transform",
                    m ? "border-lavender" : "border-dashed border-input",
                    isToday && "cursor-pointer hover:-translate-y-1 hover:border-gold",
                  )}
                >
                  <PixelIcon name={slot} size={44} className={m ? undefined : "opacity-40 grayscale"} />
                  <span className="pixel-label mt-2 text-foreground">{label}</span>
                  {m ? (
                    <>
                      <span className="flex items-center gap-2 text-2xl leading-none text-mint">
                        <span className="h-3 w-3 bg-mint" /> COMPLETE
                      </span>
                      <span className="w-full truncate text-2xl leading-none text-muted-foreground">{m.name}</span>
                      <span className="text-2xl leading-tight text-foreground">
                        {m.kcal} kcal · {m.protein}g P
                      </span>
                    </>
                  ) : (
                    <span className="text-2xl leading-none text-pink">{isToday ? "+ Log meal" : "Skipped"}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="my-6 h-[3px] bg-lavender" />

          <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
            <span className="pixel-label text-sky">Mission report</span>
            <div className="flex items-center gap-3 text-3xl leading-none">
              Water:
              {isToday && (
                <PixelButton size="sm" variant="ghost" aria-label="Less water" onClick={() => setDraft((d) => ({ ...d, waterMl: Math.max(0, d.waterMl - 250) }))}>
                  −
                </PixelButton>
              )}
              <span className="text-sky">{food.waterMl.toLocaleString()} ml</span>
              {isToday && (
                <PixelButton size="sm" variant="sky" aria-label="More water" onClick={() => setDraft((d) => ({ ...d, waterMl: Math.min(5000, d.waterMl + 250) }))}>
                  <PixelIcon name="drop" size={14} /> +250
                </PixelButton>
              )}
            </div>
            <div className="flex items-center gap-3 text-3xl leading-none">
              Supplements:
              <button
                type="button"
                disabled={!isToday}
                onClick={() => setDraft((d) => ({ ...d, supplements: !d.supplements }))}
                className={cn("pixel-focus cursor-pointer", food.supplements ? "text-mint" : "text-muted-foreground")}
              >
                {food.supplements ? "Yes" : "No"}
                {isToday && <span className="pixel-label ml-2 text-muted-foreground">toggle</span>}
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {(
              [
                ["Calories", score.parts.calories, FOOD_SCORE_MAX.calories],
                ["Protein", score.parts.protein, FOOD_SCORE_MAX.protein],
                ["Water", score.parts.water, FOOD_SCORE_MAX.water],
                ["Low sugar", score.parts.lowSugar, FOOD_SCORE_MAX.lowSugar],
                ["Fiber", score.parts.fiber, FOOD_SCORE_MAX.fiber],
                ["Supplements", score.parts.supplements, FOOD_SCORE_MAX.supplements],
              ] as const
            ).map(([label, v, max]) => {
              const r = v / max;
              return (
                <div key={label} className="flex items-center justify-between bg-panel-raised px-4 py-3 text-3xl leading-none">
                  <span>{label}</span>
                  <span className={r >= 0.9 ? "text-mint" : r >= 0.5 ? "text-gold" : "text-peach"}>
                    {v}/{max}
                  </span>
                </div>
              );
            })}
          </div>

          {isToday && (
            <div className="mt-6 flex justify-between">
              <PixelButton variant="ghost" onClick={() => setDraft(EMPTY_FOOD)}>
                Clear day
              </PixelButton>
              <PixelButton variant="gold" size="lg" onClick={saveDay}>
                ★ Save day
              </PixelButton>
            </div>
          )}
        </Panel>

        {/* ---------- score + gauges ---------- */}
        <div className="flex flex-col gap-6">
          <Panel className="text-center">
            <p className="pixel-label text-muted-foreground">Day score</p>
            <p className="mt-3 text-7xl leading-none text-gold">
              {score.total}
              <span className="text-2xl text-muted-foreground">/100</span>
            </p>
            <p className="pixel-label mt-3 text-foreground">
              Rank <span className="text-sky">{rank}</span>
            </p>
          </Panel>
          <Panel kicker="Fuel gauges" className="flex-1">
            <div className="space-y-4">
              <Gauge label="Calories" v={totals.kcal} max={targets.kcal} unit="kcal" tone="lavender" />
              <Gauge label="Protein" v={totals.protein} max={targets.protein} unit="g" tone="mint" />
              <Gauge label="Carbs" v={totals.carbs} max={targets.carbs} unit="g" tone="gold" />
              <Gauge label="Fat" v={totals.fat} max={targets.fat} unit="g" tone="peach" />
              <Gauge label="Fiber" v={totals.fiber} max={targets.fiber} unit="g" tone="sky" />
              <Gauge label="Sugar" v={totals.sugar} max={targets.sugarMax} unit="g" tone={totals.sugar > targets.sugarMax ? "warn" : "gold"} />
              <Gauge label="Water" v={food.waterMl} max={targets.waterMl} unit="ml" tone="sky" />
            </div>
          </Panel>
        </div>
      </div>

      {editing && (
        <MealEditor
          slot={editing}
          initial={draft.meals[editing]}
          onClose={() => setEditing(null)}
          onSave={(m) => {
            setMeal(editing, m);
            setEditing(null);
          }}
        />
      )}
    </ScreenShell>
  );
}

function SaveRow({
  date,
  food,
  targets,
  active,
  onClick,
  label,
}: {
  date: string;
  food: FoodLog;
  targets: ReturnType<typeof foodTargets>;
  active: boolean;
  onClick: () => void;
  label?: string;
}) {
  const s = foodScore(food, targets).total;
  const t = foodTotals(food);
  const logged = isFoodLogged(food);
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "pixel-focus flex w-full cursor-pointer items-center gap-3 border-[3px] px-2 py-2 text-left",
          active ? "border-space bg-panel-raised shadow-[3px_3px_0_0_var(--space)]" : "border-transparent hover:bg-muted",
        )}
      >
        <span className={cn("pixel-label flex h-10 w-10 shrink-0 items-center justify-center border-[3px] border-space", logged ? "bg-sky text-space" : "bg-muted text-muted-foreground")}>
          {logged ? rankFor(s) : "–"}
        </span>
        <span className="min-w-0">
          <span className="block text-2xl leading-none">{label ?? format(parseISO(date), "EEE, MMM d")}</span>
          <span className="block truncate text-xl leading-tight text-muted-foreground">
            {t.kcal} kcal · {food.waterMl} ml
          </span>
        </span>
      </button>
    </li>
  );
}

function Gauge({ label, v, max, unit, tone }: { label: string; v: number; max: number; unit: string; tone: Parameters<typeof SegmentBar>[0]["tone"] }) {
  return (
    <div>
      <div className="flex justify-between text-2xl leading-none">
        <span>{label}</span>
        <span>
          {v}
          <span className="text-muted-foreground">
            /{max} {unit}
          </span>
        </span>
      </div>
      <SegmentBar value={v} max={max} segments={16} tone={tone} className="mt-1" />
    </div>
  );
}

function MealEditor({ slot, initial, onClose, onSave }: { slot: MealSlot; initial?: Meal; onClose: () => void; onSave: (m: Meal | undefined) => void }) {
  const [m, setM] = useState<Meal>(initial ?? { name: "", kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 });
  const label = MEAL_SLOTS.find((s) => s.slot === slot)!.label;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const num = (k: keyof Omit<Meal, "name">, l: string, unit: string) => (
    <label className="block">
      <span className="pixel-label mb-1 block text-muted-foreground">
        {l} <span className="text-sky">{unit}</span>
      </span>
      <input
        type="number"
        min={0}
        value={m[k]}
        onChange={(e) => setM({ ...m, [k]: Math.max(0, Number(e.target.value) || 0) })}
        className="pixel-focus h-11 w-full border-[3px] border-input bg-space px-3 text-2xl outline-none focus:border-sky"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-space/80 p-3 md:p-6" role="dialog" aria-modal aria-label={`Log ${label}`} onClick={onClose}>
      <div className="pixel-panel my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto p-4 md:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-4">
          <PixelIcon name={slot} size={40} />
          <h2 className="pixel-title text-gold">Log {label}</h2>
        </div>

        <p className="pixel-label mt-5 text-sky">Quick pick · space rations</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MEAL_PRESETS[slot].map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => setM(p)}
              className={cn(
                "pixel-focus cursor-pointer border-[3px] px-3 py-1 text-xl",
                m.name === p.name ? "border-gold bg-gold text-space" : "border-input bg-space hover:border-lavender",
              )}
            >
              {p.name} · {p.kcal}
            </button>
          ))}
        </div>

        <label className="mt-5 block">
          <span className="pixel-label mb-1 block text-muted-foreground">Meal name</span>
          <input
            value={m.name}
            maxLength={40}
            onChange={(e) => setM({ ...m, name: e.target.value })}
            placeholder="e.g. Thermostabilized beef stew"
            className="pixel-focus h-11 w-full border-[3px] border-input bg-space px-3 text-2xl outline-none placeholder:text-muted-foreground/50 focus:border-sky"
          />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {num("kcal", "Calories", "kcal")}
          {num("protein", "Protein", "g")}
          {num("carbs", "Carbs", "g")}
          {num("fat", "Fat", "g")}
          {num("fiber", "Fiber", "g")}
          {num("sugar", "Sugar", "g")}
        </div>

        <div className="mt-6 flex justify-between">
          {initial ? (
            <PixelButton variant="pink" onClick={() => onSave(undefined)}>
              Remove meal
            </PixelButton>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <PixelButton variant="ghost" onClick={onClose}>
              Cancel
            </PixelButton>
            <PixelButton
              variant="gold"
              onClick={() => {
                if (!m.name.trim()) return toast("Give the meal a name.");
                if (m.kcal <= 0) return toast("Add the calories for this meal.");
                onSave({ ...m, name: m.name.trim() });
              }}
            >
              ★ Save meal
            </PixelButton>
          </div>
        </div>
      </div>
    </div>
  );
}
