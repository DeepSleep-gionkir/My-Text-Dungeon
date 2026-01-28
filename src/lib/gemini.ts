import { GoogleGenerativeAI } from "@google/generative-ai";

// BYOK (Bring Your Own Key) approach as per docs
// Key is passed in from user settings or environment

export const generateGeminiContent = async (apiKey: string, prompt: string) => {
  if (!apiKey) throw new Error("API Key is missing");

  const genAI = new GoogleGenerativeAI(apiKey);
  // Strictly use gemini-2.5-flash as requested
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateGeminiJSON = async (apiKey: string, prompt: string) => {
  if (!apiKey) throw new Error("API Key is missing");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const stripCodeFences = (text: string) =>
    text
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();

  const repairCommonJsonIssues = (text: string) => {
    let out = text.trim();

    // Remove JS-style comments (best-effort).
    out = out.replace(/\/\*[\s\S]*?\*\//g, "");
    out = out.replace(/^\s*\/\/.*$/gm, "");

    // Convert single-quoted strings to double-quoted strings (best-effort).
    out = out.replace(
      /'([^'\\]*(?:\\.[^'\\]*)*)'/g,
      (_m, inner: string) => JSON.stringify(inner),
    );

    // Quote unquoted object keys (best-effort).
    out = out.replace(
      /([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*):/g,
      '$1"$2"$3:',
    );

    // Remove trailing commas.
    out = out.replace(/,(\s*[}\]])/g, "$1");

    return out.trim();
  };

  const extractFirstJSONObject = (text: string) => {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    return text.slice(start, end + 1);
  };

  const tryParse = (text: string) => {
    const cleaned = stripCodeFences(text);
    return JSON.parse(cleaned);
  };

  const repairJSON = async (badText: string) => {
    const repairModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0,
      },
    });

    const repairPrompt = `Fix the following into ONE valid JSON object.
OUTPUT RULES (STRICT):
- Output ONLY a single valid JSON object.
- Use double-quoted property names and double-quoted strings.
- No markdown, no code fences, no comments, no trailing commas.

INPUT:
${badText}`;

    const repaired = await repairModel.generateContent(repairPrompt);
    const repairedText = stripCodeFences((await repaired.response).text());
    // The model may still slip; try local repairs once more.
    return tryParse(repairCommonJsonIssues(repairedText));
  };

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const raw = response.text();
    const text = stripCodeFences(raw);

    const extracted = extractFirstJSONObject(text);
    const candidates = [
      text,
      extracted,
      repairCommonJsonIssues(text),
      extracted ? repairCommonJsonIssues(extracted) : null,
    ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

    for (const candidate of candidates) {
      try {
        return tryParse(candidate);
      } catch {
        // keep trying
      }
    }

    // Last resort: ask the model to repair the text.
    return await repairJSON(extracted ?? text);
  } catch (error) {
    console.error("Gemini JSON Error:", error);
    throw error;
  }
};
