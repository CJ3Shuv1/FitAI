import * as XLSX from "xlsx";
import { callAI } from "./ai";
import type { ExtractedDay } from "@/app/(app)/training/upload/actions";

const EXTRACTION_INSTRUCTIONS =
  'Extrahiere den abgebildeten/beschriebenen Trainingsplan. Antworte AUSSCHLIESSLICH mit einem JSON-Objekt: ' +
  '{"days": [{"label": string, "sub": string, "exercises": [{"name": string, "sets": number|null, "weight": number|null, "notes": string}]}]}. ' +
  "Ein Eintrag pro Trainingstag (z.B. 'Push A', 'Beine', 'Tag 1'). sets ist die Anzahl Sätze (Zahl), weight das Arbeitsgewicht in kg falls angegeben (sonst null). " +
  "Erfinde keine Übungen, die nicht im Dokument stehen.";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractWithGeminiInline(
  geminiKey: string,
  base64Data: string,
  mimeType: string
): Promise<ExtractedDay[]> {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: EXTRACTION_INSTRUCTIONS },
              { inlineData: { mimeType, data: base64Data } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error("HTTP " + res.status + (errText ? ": " + errText.slice(0, 200) : ""));
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Keine Antwort von Gemini erhalten");
  const parsed = JSON.parse(text);
  return normalizeDays(parsed.days);
}

function normalizeDays(days: unknown): ExtractedDay[] {
  if (!Array.isArray(days)) return [];
  return days.map((d) => {
    const day = d as Record<string, unknown>;
    const exercises = Array.isArray(day.exercises) ? day.exercises : [];
    return {
      label: String(day.label || "Trainingstag"),
      sub: day.sub ? String(day.sub) : undefined,
      exercises: exercises.map((e) => {
        const ex = e as Record<string, unknown>;
        const sets = ex.sets == null ? null : Number(ex.sets);
        const weight = ex.weight == null ? null : Number(ex.weight);
        return {
          name: String(ex.name || "Übung"),
          sets: Number.isNaN(sets) ? null : sets,
          weight: Number.isNaN(weight) ? null : weight,
          notes: ex.notes ? String(ex.notes) : "",
        };
      }),
    };
  });
}

function sheetToText(file: ArrayBuffer): string {
  const workbook = XLSX.read(file, { type: "array" });
  let out = "";
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    out += `--- ${sheetName} ---\n${csv}\n`;
  });
  return out;
}

// Extracts a training plan from a PDF, PNG/JPG, or XLSX file using Gemini
// (multimodal for PDF/images; text extraction for spreadsheets). Requires a
// Gemini key to be set in the user's settings.
export async function extractPlanFromFile(file: File, geminiKey: string): Promise<ExtractedDay[]> {
  if (!geminiKey) throw new Error("Bitte zuerst einen Gemini API-Key in den Einstellungen hinterlegen");

  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");
  const isXlsx =
    file.type.includes("spreadsheet") ||
    file.name.toLowerCase().endsWith(".xlsx") ||
    file.name.toLowerCase().endsWith(".xls");

  if (isPdf || isImage) {
    const base64 = await fileToBase64(file);
    return extractWithGeminiInline(geminiKey, base64, file.type || "application/pdf");
  }

  if (isXlsx) {
    const buffer = await file.arrayBuffer();
    const text = sheetToText(buffer);
    const content = await callAI(
      "gemini",
      geminiKey,
      EXTRACTION_INSTRUCTIONS,
      "Trainingsplan als Tabelle (CSV je Blatt):\n\n" + text,
      { json: true }
    );
    return normalizeDays(JSON.parse(content).days);
  }

  throw new Error("Nicht unterstütztes Dateiformat. Bitte PDF, PNG/JPG oder XLSX hochladen.");
}
