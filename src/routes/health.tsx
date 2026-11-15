import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { RequireCrew } from "@/components/pixel/RequireCrew";
import { ScreenShell } from "@/components/pixel/ScreenShell";
import { Panel } from "@/components/pixel/Panel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { SegmentInput } from "@/components/pixel/SegmentBar";
import { ChoiceRow, Stepper } from "@/components/pixel/FaceScalePicker";
import { SYMPTOMS } from "@/lib/hyperlife/constants";
import { actions, energyFor } from "@/lib/hyperlife/store";
import type { CrewMember, DayLog, HealthLog, Symptom } from "@/lib/hyperlife/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "General Health · HyperLife" },
      { name: "description", content: "Log exercise, back and joint pain, and symptoms for today." },
      { property: "og:title", content: "General Health · HyperLife" },
      { property: "og:description", content: "Log exercise, back and joint pain, and symptoms for today." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <RequireCrew>{(ctx) => <HealthForm {...ctx} />}</RequireCrew>,
});

function HealthForm({ user, todayLog, today, logs }: { user: CrewMember; todayLog?: DayLog; today: string; logs: Record<string, DayLog> }) {
  const navigate = useNavigate();
  const prev = todayLog?.health;
  const [exercised, setExercised] = useState<"yes" | "no" | null>(prev ? (prev.exercised ? "yes" : "no") : null);
  const [minutes, setMinutes] = useState(prev?.exerciseMinutes ?? 30);
  const [pain, setPain] = useState(prev?.painLevel ?? 0);
  const [symptoms, setSymptoms] = useState<Symptom[]>(prev?.symptoms ?? []);
  const [noSymptoms, setNoSymptoms] = useState(prev ? prev.symptoms.length === 0 : false);

  const toggle = (s: Symptom) => {
    setNoSymptoms(false);
    setSymptoms((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  };

  const save = () => {
    if (!exercised) return toast("Tell us if you exercised today.");
    if (!noSymptoms && symptoms.length === 0) return toast("Tick your symptoms, or choose “None”.");
    const health: HealthLog = {
      exercised: exercised === "yes",
      exerciseMinutes: exercised === "yes" ? minutes : 0,
      painLevel: pain,
      symptoms: noSymptoms ? [] : symptoms,
    };
    actions.saveLog(user.id, today, "health", health);
    toast("Health log saved ★");
    navigate({ to: "/base" });
  };

  return (
    <ScreenShell icon="health" title="General health form" user={user} energy={energyFor(user, logs)}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel kicker="Question 1" title="Have you exercised today?">
          <ChoiceRow
            name="Exercised"
            value={exercised}
            onChange={setExercised}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
        </Panel>

        <Panel kicker="Question 2" title="Exercise activity (minutes)">
          <div className="flex flex-wrap items-center gap-6">
            <Stepper label="Exercise minutes" value={exercised === "no" ? 0 : minutes} onChange={setMinutes} step={15} min={0} max={240} unit="min" disabled={exercised !== "yes"} />
            <p className="text-xl leading-tight text-muted-foreground">
              Target <span className="text-gold">90 min</span>
              <br />
              cardio + resistance
            </p>
          </div>
        </Panel>

        <Panel kicker="Question 3" title="Back / joints pain levels">
          <SegmentInput
            label="Pain level"
            value={pain}
            onChange={setPain}
            min={0}
            max={10}
            lowLabel="No pain"
            highLabel="Severe"
            tones={(i) => (i < 4 ? "mint" : i < 7 ? "peach" : "warn")}
          />
        </Panel>

        <Panel kicker="Question 4" title="Do you feel any symptoms?">
          <div className="grid grid-cols-2 gap-3">
            {SYMPTOMS.map((s) => (
              <Check key={s.key} label={s.label} checked={symptoms.includes(s.key)} onToggle={() => toggle(s.key)} />
            ))}
            <Check
              label="None"
              checked={noSymptoms}
              onToggle={() => {
                setNoSymptoms((v) => !v);
                setSymptoms([]);
              }}
              className="col-span-2"
            />
          </div>
        </Panel>
      </div>

      <div className="mt-6 flex justify-end">
        <PixelButton variant="gold" size="lg" onClick={save}>
          ★ Save health log
        </PixelButton>
      </div>
    </ScreenShell>
  );
}

function Check({ label, checked, onToggle, className }: { label: string; checked: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        "pixel-focus flex h-14 cursor-pointer items-center gap-4 border-[3px] bg-space px-4 text-2xl",
        checked ? "border-gold text-gold" : "border-input text-foreground hover:border-lavender",
        className,
      )}
    >
      <span className={cn("flex h-6 w-6 items-center justify-center border-[3px]", checked ? "border-gold bg-gold" : "border-lavender")}>
        {checked && <span className="h-2 w-2 bg-space" />}
      </span>
      {label}
    </button>
  );
}
