import type { AvatarKind, EnvironmentKind, MealSlot, Meal, Symptom } from "./types";

export interface EnvironmentInfo {
  kind: EnvironmentKind;
  name: string;
  short: string;
  /** m/s² */
  gravity: number;
  /** fraction of Earth gravity */
  gravityG: number;
  /** mSv per day */
  radiation: number;
  blurb: string;
}

export const ENVIRONMENTS: Record<EnvironmentKind, EnvironmentInfo> = {
  moon: {
    kind: "moon",
    name: "Moon Base",
    short: "MOON",
    gravity: 1.62,
    gravityG: 0.17,
    radiation: 1.37,
    blurb: "Lunar south pole outpost. Low gravity, no atmosphere.",
  },
  mars: {
    kind: "mars",
    name: "Mars Base",
    short: "MARS",
    gravity: 3.71,
    gravityG: 0.38,
    radiation: 0.67,
    blurb: "Jezero colony. Thin CO₂ atmosphere, dust storms.",
  },
  ship: {
    kind: "ship",
    name: "Spaceship",
    short: "SHIP",
    gravity: 0,
    gravityG: 0,
    radiation: 1.84,
    blurb: "Deep-space transit vessel. Microgravity, cosmic rays.",
  },
};

export const AVATARS: { kind: AvatarKind; label: string }[] = [
  { kind: "male", label: "Male astronaut" },
  { kind: "female", label: "Female astronaut" },
  { kind: "alien", label: "Alien" },
];

export const MEAL_SLOTS: { slot: MealSlot; label: string }[] = [
  { slot: "breakfast", label: "Breakfast" },
  { slot: "lunch", label: "Lunch" },
  { slot: "dinner", label: "Dinner" },
  { slot: "snack", label: "Snack" },
];

export const MEAL_PRESETS: Record<MealSlot, Meal[]> = {
  breakfast: [
    { name: "Yogurt Parfait", kcal: 300, protein: 20, carbs: 40, fat: 8, fiber: 4, sugar: 22 },
    { name: "Oatmeal & Berries", kcal: 320, protein: 12, carbs: 54, fat: 6, fiber: 8, sugar: 14 },
    { name: "Scrambled Eggs", kcal: 280, protein: 20, carbs: 4, fat: 20, fiber: 0, sugar: 2 },
  ],
  lunch: [
    { name: "Chicken Salad Wrap", kcal: 480, protein: 42, carbs: 40, fat: 16, fiber: 6, sugar: 5 },
    { name: "Rehydrated Pasta", kcal: 520, protein: 18, carbs: 80, fat: 12, fiber: 5, sugar: 8 },
    { name: "Tuna Tortilla", kcal: 430, protein: 32, carbs: 38, fat: 15, fiber: 4, sugar: 3 },
  ],
  dinner: [
    { name: "Steak & Veggies", kcal: 680, protein: 50, carbs: 30, fat: 36, fiber: 8, sugar: 6 },
    { name: "Shrimp & Rice", kcal: 550, protein: 34, carbs: 70, fat: 10, fiber: 3, sugar: 9 },
    { name: "Lentil Curry", kcal: 600, protein: 26, carbs: 85, fat: 14, fiber: 16, sugar: 10 },
  ],
  snack: [
    { name: "Carrots & Hummus", kcal: 150, protein: 5, carbs: 16, fat: 8, fiber: 5, sugar: 6 },
    { name: "Nut Mix", kcal: 200, protein: 6, carbs: 8, fat: 16, fiber: 3, sugar: 2 },
    { name: "Choc Pudding", kcal: 220, protein: 4, carbs: 36, fat: 7, fiber: 1, sugar: 26 },
  ],
};

export const SYMPTOMS: { key: Symptom; label: string }[] = [
  { key: "sore-throat", label: "Sore throat" },
  { key: "fatigue", label: "Fatigue" },
  { key: "congestion", label: "Congestion" },
  { key: "rash", label: "Rash" },
];

export const FEELING_LABELS = ["Awful", "Low", "Okay", "Good", "Great"] as const;
export const CALM_LABELS = ["Overloaded", "Stressed", "Okay", "Relaxed", "Calm"] as const;
export const CREW_LABELS = ["Conflict", "Tense", "Okay", "Good", "Great"] as const;
