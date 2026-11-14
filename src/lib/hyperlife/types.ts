export type Sex = "male" | "female" | "other";
export type AvatarKind = "male" | "female" | "alien";
export type EnvironmentKind = "moon" | "mars" | "ship";

export interface CrewMember {
  id: string;
  crewId: string;
  age: number;
  sex: Sex;
  weightKg: number;
  heightCm: number;
  avatar: AvatarKind;
  environment: EnvironmentKind;
  /** ISO date (yyyy-MM-dd) of mission day 1 */
  missionStart: string;
}

/** 1 = worst, 5 = best */
export type FaceScale = 1 | 2 | 3 | 4 | 5;
export type FamilyContact = "today" | "week" | "not-recently";

export interface MoodLog {
  feeling: FaceScale;
  /** 1 = overloaded, 5 = calm (higher is better, matches the faces) */
  calm: FaceScale;
  sleepHours: number;
  /** 1..10 */
  workload: number;
  familyContact: FamilyContact;
  crewRelationship: FaceScale;
}

export type Symptom = "sore-throat" | "fatigue" | "congestion" | "rash";

export interface HealthLog {
  exercised: boolean;
  exerciseMinutes: number;
  /** 0..10 */
  painLevel: number;
  symptoms: Symptom[];
}

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface Meal {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
}

export interface FoodLog {
  meals: Partial<Record<MealSlot, Meal>>;
  waterMl: number;
  supplements: boolean;
}

export interface DayLog {
  mood?: MoodLog;
  health?: HealthLog;
  food?: FoodLog;
}

export type RegistrationDraft = Partial<Omit<CrewMember, "id" | "missionStart">>;
