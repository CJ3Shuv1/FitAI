// Client-side AI calls, ported from Silverback_Trainingsplan_1.html (callAI).
// Keys now come from Supabase (user_settings) instead of localStorage, but
// the calls themselves still go directly from the browser to the provider —
// no server-side AI proxy in this prototype.

export type AIProvider = "groq" | "gemini";

export async function callAI(
  provider: AIProvider,
  key: string,
  systemPrompt: string,
  userPrompt: string,
  opts: { json?: boolean; temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  if (provider === "gemini") {
    if (!key) throw new Error("Kein Gemini API-Key hinterlegt");
    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: opts.json ? { responseMimeType: "application/json" } : {},
    };
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error("HTTP " + res.status + (errText ? ": " + errText.slice(0, 200) : ""));
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Keine Antwort von Gemini erhalten");
    return text;
  }

  if (!key) throw new Error("Kein Groq API-Key hinterlegt");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens,
      response_format: opts.json ? { type: "json_object" } : undefined,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error("HTTP " + res.status + (errText ? ": " + errText.slice(0, 200) : ""));
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Keine Antwort von Groq erhalten");
  return content;
}

export type Macros = { kcal: number; protein: number; carbs: number; fett: number; zucker: number };

export async function fetchNutritionFromApiNinjas(key: string, text: string): Promise<Macros> {
  if (!key) throw new Error("Kein API Ninjas Key hinterlegt");
  const res = await fetch(
    "https://api.api-ninjas.com/v1/nutrition?query=" + encodeURIComponent(text),
    { headers: { "X-Api-Key": key } }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error("HTTP " + res.status + (errText ? ": " + errText.slice(0, 200) : ""));
  }
  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) throw new Error("Keine Lebensmittel erkannt");
  const total = { kcal: 0, protein: 0, carbs: 0, fett: 0, zucker: 0 };
  type NinjaItem = {
    calories?: number;
    protein_g?: number;
    carbohydrates_total_g?: number;
    fat_total_g?: number;
    sugar_g?: number;
  };
  (items as NinjaItem[]).forEach((it) => {
    total.kcal += it.calories || 0;
    total.protein += it.protein_g || 0;
    total.carbs += it.carbohydrates_total_g || 0;
    total.fett += it.fat_total_g || 0;
    total.zucker += it.sugar_g || 0;
  });
  return {
    kcal: Math.round(total.kcal),
    protein: Math.round(total.protein),
    carbs: Math.round(total.carbs),
    fett: Math.round(total.fett),
    zucker: Math.round(total.zucker),
  };
}
