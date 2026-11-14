import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { RequireCrew } from "@/components/pixel/RequireCrew";
import { ScreenShell } from "@/components/pixel/ScreenShell";
import { Panel } from "@/components/pixel/Panel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { SegmentInput, SegmentBar } from "@/components/pixel/SegmentBar";
import { ChoiceRow, FaceScalePicker, Stepper } from "@/components/pixel/FaceScalePicker";
import { CALM_LABELS, CREW_LABELS, FEELING_LABELS } from "@/lib/hyperlife/constants";
import { actions, energyFor } from "@/lib/hyperlife/store";
import type { CrewMember, DayLog, FaceScale, FamilyContact, MoodLog } from "@/lib/hyperlife/types";

export const Route = createFileRoute("/mood")({
  head: () => ({
    meta: [
      { title: "Mood Log — HyperLife" },
      { name: "description", content: "Log how you feel, stress, sleep, workload and crew relations." },
      { property: "og:title", content: "Mood Log — HyperLife" },
      { property: "og:description", content: "Log how you feel, stress, sleep, workload and crew relations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <RequireCrew>{(ctx) => <MoodForm {...ctx} />}</RequireCrew>,
});

function MoodForm({ user, todayLog, today, logs }: { user: CrewMember; todayLog?: DayLog; today: string; logs: Record<string, DayLog> }) {
  const navigate = useNavigate();
  const prev = todayLog?.mood;
  const [feeling, setFeeling] = useState<FaceScale | null>(prev?.feeling ?? null);
  const [calm, setCalm] = useState<FaceScale | null>(prev?.calm ?? null);
  const [sleep, setSleep] = useState(prev?.sleepHours ?? 7);
  const [workload, setWorkload] = useState(prev?.workload ?? 5);
  const [family, setFamily] = useState<FamilyContact | null>(prev?.familyContact ?? null);
  const [crew, setCrew] = useState<FaceScale | null>(prev?.crewRelationship ?? null);

  const answered = [feeling, calm, family, crew].filter((v) => v !== null).length + 2;
  const missing = 6 - answered;

  const save = () => {
    if (!feeling || !calm || !family || !crew) {
      toast("Answer every question to save your mood log.");
      return;
    }
    const mood: MoodLog = { feeling, calm, sleepHours: sleep, workload, familyContact: family, crewRelationship: crew };
    actions.saveLog(user.id, today, "mood", mood);
    toast("Mood log saved ★");
    navigate({ to: "/base" });
  };

  return (
    <ScreenShell icon="mood" title="Mood form" user={user} energy={energyFor(user, logs)}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Q n={1} title="How are you feeling today?">
          <FaceScalePicker name="Feeling" value={feeling} onChange={setFeeling} labels={FEELING_LABELS} />
        </Q>
        <Q n={2} title="Stress levels?">
          <FaceScalePicker name="Stress" value={calm} onChange={setCalm} labels={CALM_LABELS} />
        </Q>
        <Q n={3} title="How many hours have you slept?">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <Stepper label="Hours slept" value={sleep} onChange={setSleep} step={0.5} min={0} max={14} unit="hrs" />
            <div className="flex-1">
              <SegmentBar value={sleep} max={10} segments={10} tone={sleep < 6 ? "warn" : sleep < 7 ? "peach" : "sky"} height="h-6" />
              <p className="mt-2 text-lg text-muted-foreground">Target 7–8 hrs</p>
            </div>
          </div>
        </Q>
        <Q n={4} title="Workload">
          <SegmentInput
            label="Workload"
            value={workload}
            onChange={setWorkload}
            min={1}
            max={10}
            lowLabel="Light"
            highLabel="Overloaded"
            tones={(i) => (i < 4 ? "mint" : i < 7 ? "gold" : "warn")}
          />
        </Q>
        <Q n={5} title="Have you contacted your family recently?">
          <ChoiceRow<FamilyContact>
            name="Family contact"
            value={family}
            onChange={setFamily}
            options={[
              { value: "today", label: "Yes, today" },
              { value: "week", label: "This week" },
              { value: "not-recently", label: "Not recently" },
            ]}
          />
        </Q>
        <Q n={6} title="How is your relationship with other crew members?">
          <FaceScalePicker name="Crew relationship" value={crew} onChange={setCrew} labels={CREW_LABELS} />
        </Q>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="pixel-label text-muted-foreground">
          {missing > 0 ? `${missing} question${missing > 1 ? "s" : ""} left` : "All set — ready to save"}
        </p>
        <PixelButton variant="gold" size="lg" onClick={save}>
          ★ Save mood log
        </PixelButton>
      </div>
    </ScreenShell>
  );
}

function Q({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <Panel kicker={`Question ${n}`} title={title}>
      {children}
    </Panel>
  );
}
