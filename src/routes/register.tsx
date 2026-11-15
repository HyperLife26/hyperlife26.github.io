import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { z } from "zod";
import { Starfield } from "@/components/pixel/Starfield";
import { Panel } from "@/components/pixel/Panel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { StepHeader } from "@/components/pixel/StepHeader";
import { AVATARS } from "@/lib/hyperlife/constants";
import { AVATAR_IMG } from "@/lib/hyperlife/media";
import { actions, useHydrated, useHyperLife } from "@/lib/hyperlife/store";
import type { AvatarKind, Sex } from "@/lib/hyperlife/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register Astronaut · HyperLife" },
      { name: "description", content: "Enter baseline data and choose your astronaut profile image." },
      { property: "og:title", content: "Register Astronaut · HyperLife" },
      { property: "og:description", content: "Enter baseline data and choose your astronaut profile image." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Register,
});

const schema = z.object({
  crewId: z
    .string()
    .trim()
    .min(2, "Crew ID needs at least 2 characters")
    .max(16, "Crew ID max 16 characters")
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only"),
  age: z.coerce.number().int().min(18, "Age 18–80").max(80, "Age 18–80"),
  sex: z.enum(["male", "female", "other"], { message: "Pick one" }),
  weightKg: z.coerce.number().min(35, "Weight 35–150 kg").max(150, "Weight 35–150 kg"),
  heightCm: z.coerce.number().min(140, "Height 140–210 cm").max(210, "Height 140–210 cm"),
  avatar: z.enum(["male", "female", "alien"], { message: "Choose a profile image" }),
});

type Form = { crewId: string; age: string; sex: Sex | ""; weightKg: string; heightCm: string; avatar: AvatarKind | "" };

function Register() {
  const navigate = useNavigate();
  const hydrated = useHydrated();
  const { draft, users } = useHyperLife();
  const [form, setForm] = useState<Form>({ crewId: "", age: "", sex: "", weightKg: "", heightCm: "", avatar: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});

  useEffect(() => {
    if (hydrated && draft)
      setForm({
        crewId: draft.crewId ?? "",
        age: draft.age?.toString() ?? "",
        sex: draft.sex ?? "",
        weightKg: draft.weightKg?.toString() ?? "",
        heightCm: draft.heightCm?.toString() ?? "",
        avatar: draft.avatar ?? "",
      });
    // only on first hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: typeof errors = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as keyof Form] ??= i.message));
      setErrors(errs);
      return;
    }
    const id = parsed.data.crewId.toUpperCase();
    if (users.some((u) => u.crewId === id)) {
      setErrors({ crewId: "That Crew ID is already registered" });
      return;
    }
    actions.setDraft({ ...parsed.data, crewId: id });
    navigate({ to: "/environment" });
  };

  return (
    <main className="relative min-h-screen bg-space">
      <Starfield count={80} seed={21} />
      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <StepHeader step={1} title="New crew member" />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.15fr]">
          <Panel kicker="Baseline data" title="Astronaut file">
            <div className="space-y-5">
              <Field label="Crew ID" error={errors.crewId}>
                <input
                  value={form.crewId}
                  onChange={(e) => set("crewId", e.target.value.toUpperCase())}
                  placeholder="CDR-NOVA"
                  maxLength={16}
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Age" error={errors.age}>
                  <input type="number" inputMode="numeric" value={form.age} onChange={(e) => set("age", e.target.value)} placeholder="34" className={inputCls} />
                </Field>
                <Field label="Weight kg" error={errors.weightKg}>
                  <input type="number" inputMode="decimal" value={form.weightKg} onChange={(e) => set("weightKg", e.target.value)} placeholder="70" className={inputCls} />
                </Field>
                <Field label="Height cm" error={errors.heightCm}>
                  <input type="number" inputMode="numeric" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} placeholder="175" className={inputCls} />
                </Field>
              </div>
              <Field label="Sex" error={errors.sex}>
                <div className="grid grid-cols-3 gap-3">
                  {(["male", "female", "other"] as Sex[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set("sex", s)}
                      className={cn(
                        "pixel-focus h-12 cursor-pointer border-[3px] text-2xl capitalize",
                        form.sex === s ? "border-gold bg-gold text-space" : "border-input bg-space text-foreground hover:border-lavender",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </Panel>

          <Panel kicker="Profile image" title="Choose your sprite">
            <div className="grid grid-cols-3 gap-4">
              {AVATARS.map((a) => {
                const on = form.avatar === a.kind;
                return (
                  <button
                    key={a.kind}
                    type="button"
                    onClick={() => set("avatar", a.kind)}
                    className={cn(
                      "pixel-focus group cursor-pointer border-[3px] bg-space p-2 text-left transition-transform hover:-translate-y-1",
                      on ? "border-gold shadow-[0_0_0_3px_var(--space),0_0_0_6px_var(--gold)]" : "border-input hover:border-lavender",
                    )}
                    aria-pressed={on}
                  >
                    <img src={AVATAR_IMG[a.kind]} alt={a.label} width={240} height={240} loading="lazy" className="pixelated aspect-square w-full object-cover" />
                    <span className={cn("pixel-label mt-3 block text-center", on ? "text-gold" : "text-muted-foreground")}>
                      {on ? "▶ " : ""}
                      {a.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {errors.avatar && <p className="mt-3 text-xl text-warn">{errors.avatar}</p>}
          </Panel>
        </div>

        <div className="mt-8 flex justify-end">
          <PixelButton variant="gold" size="lg" onClick={submit}>
            Next: environment ▶
          </PixelButton>
        </div>
      </div>
    </main>
  );
}

const inputCls =
  "pixel-focus h-12 w-full border-[3px] border-input bg-space px-3 text-2xl text-foreground placeholder:text-muted-foreground/50 focus:border-sky outline-none";

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="pixel-label mb-2 block text-muted-foreground">{label}</span>
      {children}
      {error && <span className="mt-1 block text-lg leading-tight text-warn">{error}</span>}
    </label>
  );
}
