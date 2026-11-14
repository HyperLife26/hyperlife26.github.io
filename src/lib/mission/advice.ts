import type { Suggestion } from "@/lib/hyperlife/scoring";
import { ENVIRONMENTS } from "@/lib/hyperlife/constants";
import type { MissionSnapshot } from "./snapshot";
import { SCENARIO_LABEL } from "./scenario";

export function missionAdvice(snap: MissionSnapshot): Suggestion[] {
  const out: Suggestion[] = [];
  const { vitals, behavior, hardware, scenario, profile } = snap;
  const env = ENVIRONMENTS[profile.environment];

  if (scenario.active && scenario.scenario !== "nominal") {
    const text =
      scenario.scenario === "cardiac"
        ? "Heart rate and SpO₂ are outside the normal band for this drill. Stop tasks, sit down and keep the watch streaming until values recover."
        : scenario.scenario === "radiation"
          ? "Dose rate is elevated for the drill. Move to the shielded module and wait for the all-clear before resuming surface work."
          : scenario.scenario === "bone"
            ? "Loading is low. Use the resistance harness for 20 minutes and keep the spine stretch routine."
            : "Temperature is climbing. Hydrate, rest and re-check in 15 minutes; report any worsening symptoms.";
    out.push({ tone: "warn", title: SCENARIO_LABEL[scenario.scenario], text });
  }

  if (behavior.sleepHours < 7) {
    out.push({
      tone: "warn",
      title: "Protect sleep",
      text: `${behavior.sleepHours.toFixed(1)} h logged. Target 7–8 h: dim the cabin an hour before rest and keep the sleep station cool.`,
    });
  }
  if (behavior.exerciseMinutes < 45) {
    out.push({
      tone: "warn",
      title: "Load the skeleton",
      text: `${behavior.exerciseMinutes} min of exercise. Aim for 90 min of resistance + cardio to counter ${env.gravityG === 0 ? "microgravity" : `${env.gravityG}g`} bone loss.`,
    });
  }
  if (behavior.stress > 0.55) {
    out.push({
      tone: "tip",
      title: "Lower the pressure",
      text: "Workload and stress are high. Take a 10 minute breathing break and flag non-critical tasks to mission control.",
    });
  }
  if (behavior.hydration < 0.75) {
    out.push({
      tone: "tip",
      title: "Hydrate",
      text: `Fluid intake is at ${Math.round(behavior.hydration * 100)}% of target. Fluid shifts make dehydration easy to miss here.`,
    });
  }
  if (behavior.nutritionScore < 70) {
    out.push({
      tone: "tip",
      title: "Rebalance the tray",
      text: `Nutrition score is ${behavior.nutritionScore}/100. Add protein and fibre, and keep sugar below the daily cap.`,
    });
  }
  if (behavior.symptoms.length > 0) {
    out.push({
      tone: "warn",
      title: "Report symptoms",
      text: `Logged: ${behavior.symptoms.join(", ").replace(/-/g, " ")}. Tell the flight surgeon and keep monitoring temperature.`,
    });
  }
  if (hardware.fused.radiation > 55 || env.radiation > 1.5) {
    out.push({
      tone: "tip",
      title: "Radiation shelter",
      text: `${env.radiation} mSv/day at ${env.name}. Sleep in the shielded module and watch for solar particle alerts.`,
    });
  }
  if (hardware.cardiacEvent >= 0.55) {
    out.push({
      tone: "warn",
      title: "Cardiac watch",
      text: "The model raised an acute cardiac flag. This is a risk flag, not a diagnosis: notify the flight surgeon and repeat vitals.",
    });
  }
  if (out.length < 3) {
    out.push({
      tone: "good",
      title: "Vitals steady",
      text: `Heart rate ${vitals.hr} bpm, SpO₂ ${vitals.spo2}%, temperature ${vitals.temp}°C. Keep the routine going.`,
    });
  }
  if (out.length < 3) {
    out.push({
      tone: "good",
      title: "On track",
      text: "The on-device model sees no elevated hazard domain right now. Log today's data to sharpen the next brief.",
    });
  }

  return out.slice(0, 6);
}
