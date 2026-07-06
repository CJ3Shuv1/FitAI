import type { Food } from "./types";

export const UNIT_OPTIONS = ["Stück", "g", "kg", "ml", "l", "EL", "TL", "Prise"] as const;
export type Unit = (typeof UNIT_OPTIONS)[number];

// Rough conversion to grams (or ml, treated as equivalent for density~1 foods)
// so ingredient rows in different units can be matched against a food's
// per-100g/ml library entry.
const APPROX_GRAMS: Record<Unit, number | null> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  EL: 15,
  TL: 5,
  Prise: 1,
  Stück: null, // resolved via food.piece_weight_g below
};

export function findFoodMatch(name: string, foods: Food[]): Food | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  return (
    foods.find((f) => f.name.toLowerCase() === q) ||
    foods.find((f) => f.name.toLowerCase().includes(q) || q.includes(f.name.toLowerCase())) ||
    null
  );
}

export type Macros = { kcal: number; protein: number; carbs: number; fett: number; zucker: number };

// Converts an ingredient row (amount + unit) matched to a food into grams,
// then scales the food's per-100g macros. Returns null if the unit can't be
// resolved to a weight for this food (e.g. "Stück" with no piece_weight_g).
export function computeMacrosForRow(
  food: Food,
  amount: number,
  unit: Unit
): Macros | null {
  let grams: number | null;
  if (unit === "Stück") {
    grams = food.piece_weight_g ? amount * food.piece_weight_g : null;
  } else {
    grams = APPROX_GRAMS[unit] !== null ? amount * (APPROX_GRAMS[unit] as number) : null;
  }
  if (grams == null) return null;

  const factor = grams / 100;
  return {
    kcal: Math.round(food.kcal_per_100g * factor),
    protein: Math.round(food.protein_per_100g * factor * 10) / 10,
    carbs: Math.round(food.carbs_per_100g * factor * 10) / 10,
    fett: Math.round(food.fett_per_100g * factor * 10) / 10,
    zucker: Math.round(food.zucker_per_100g * factor * 10) / 10,
  };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fett: acc.fett + m.fett,
      zucker: acc.zucker + m.zucker,
    }),
    { kcal: 0, protein: 0, carbs: 0, fett: 0, zucker: 0 }
  );
}
