export type Goal = "bulk" | "cut" | "maintenance";

export type Profile = {
  user_id: string;
  weight: number | null;
  height: number | null;
  age: number | null;
  goal: Goal | null;
  activity_factor: number | null;
  protein_per_kg: number | null;
  fat_percent: number | null;
  kcal_adjust: number | null;
  sugar_percent: number | null;
};

export function isProfileComplete(p: Profile | null): p is Profile & {
  weight: number;
  height: number;
  age: number;
  goal: Goal;
  activity_factor: number;
  protein_per_kg: number;
  fat_percent: number;
  kcal_adjust: number;
  sugar_percent: number;
} {
  if (!p) return false;
  return (
    p.weight != null &&
    p.height != null &&
    p.age != null &&
    p.goal != null &&
    p.activity_factor != null &&
    p.protein_per_kg != null &&
    p.fat_percent != null &&
    p.kcal_adjust != null &&
    p.sugar_percent != null
  );
}

export type Targets = {
  bmr: number;
  tdee: number;
  kcal: number;
  protein: number;
  carbs: number;
  fett: number;
  zucker: number;
};

// Mifflin-St-Jeor + Aktivitätsfaktor + Phasen-Anpassung, unverändert aus dem
// Original portiert (Silverback_Trainingsplan_1.html: computeTargets()).
export function computeTargets(p: {
  weight: number;
  height: number;
  age: number;
  activity_factor: number;
  protein_per_kg: number;
  fat_percent: number;
  kcal_adjust: number;
  sugar_percent: number;
}): Targets {
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + 5;
  const tdee = bmr * p.activity_factor;
  const kcal = Math.round(tdee + p.kcal_adjust);
  const protein = Math.round(p.weight * p.protein_per_kg);
  const fett = Math.round((kcal * p.fat_percent) / 100 / 9);
  const carbs = Math.round(Math.max(0, (kcal - protein * 4 - fett * 9) / 4));
  const zucker = Math.round((kcal * p.sugar_percent) / 100 / 4);
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, carbs, fett, zucker };
}

export const PHASE_DEFAULTS: Record<Goal, { protein_per_kg: number; kcal_adjust: number }> = {
  bulk: { protein_per_kg: 2.2, kcal_adjust: 400 },
  cut: { protein_per_kg: 2.4, kcal_adjust: -500 },
  maintenance: { protein_per_kg: 2.0, kcal_adjust: 0 },
};

export type TrainingDay = {
  id: string;
  user_id: string;
  key: string;
  label: string;
  sub: string | null;
  position: number;
};

export type Exercise = {
  id: string;
  user_id: string;
  day_id: string;
  name: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  notes: string | null;
  manual_group: string | null;
  position: number;
};

export type NutritionEntry = {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  text: string | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fett: number | null;
  zucker: number | null;
};

export type Recipe = {
  id: string;
  user_id: string;
  title: string;
  kcal_per_serving: number | null;
  protein_per_serving: number | null;
  carbs_per_serving: number | null;
  fett_per_serving: number | null;
  zucker_per_serving: number | null;
  image_url: string | null;
  cook_time_minutes: number | null;
  difficulty: "einfach" | "mittel" | "anspruchsvoll" | null;
  ingredients: { name: string; amount: string; unit: string }[];
  steps: string[];
};

export type NutritionRecipeEntry = {
  id: string;
  user_id: string;
  date: string;
  recipe_id: string;
  qty: number;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fett: number | null;
  zucker: number | null;
};

export type ShoppingListItem = {
  id: string;
  user_id: string;
  name: string;
  amount: string | null;
  checked: boolean;
};

export type WeightLogEntry = {
  id: string;
  user_id: string;
  date: string;
  weight: number;
};

export type UserSettings = {
  user_id: string;
  ai_provider: "groq" | "gemini";
  groq_key: string | null;
  gemini_key: string | null;
  pexels_key: string | null;
  api_ninjas_key: string | null;
  nutrition_method: "ai" | "apininjas";
  theme: import("./themes").ThemeName;
};

export type MuscleGroup =
  | "brust"
  | "ruecken"
  | "schultern"
  | "bizeps"
  | "trizeps"
  | "beine"
  | "core"
  | "ganzkoerper";

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  brust: "Brust",
  ruecken: "Rücken",
  schultern: "Schultern",
  bizeps: "Bizeps",
  trizeps: "Trizeps",
  beine: "Beine",
  core: "Core",
  ganzkoerper: "Ganzkörper",
};

export type ExerciseLibraryItem = {
  id: string;
  user_id: string | null;
  name: string;
  muscle_group: MuscleGroup;
};

export type Food = {
  id: string;
  user_id: string | null;
  name: string;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fett_per_100g: number;
  zucker_per_100g: number;
  default_unit: "g" | "ml" | "Stück";
  piece_weight_g: number | null;
};
