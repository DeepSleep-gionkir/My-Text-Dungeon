import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 22000;
const MAX_PROMPT_CHARS = 24000;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const sanitizePrompt = (prompt: string): string => {
  const trimmed = prompt.trim();
  if (trimmed.length <= MAX_PROMPT_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_PROMPT_CHARS)}\n\n[TRUNCATED]`;
};

const withTimeout = async <T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} 요청이 시간 제한(${ms}ms)을 초과했습니다.`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const isRetryableError = (error: unknown): boolean => {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate") ||
    msg.includes("quota") ||
    msg.includes("temporar") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("network") ||
    msg.includes("503") ||
    msg.includes("internal")
  );
};

async function runWithRetry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetryableError(error)) break;
      await wait(320 * Math.pow(2, attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini 요청 실패");
}

const requireApiKey = (apiKey: string): string => {
  const key = apiKey.trim();
  if (!key) throw new Error("API Key is missing");
  return key;
};

export const generateGeminiContent = async (apiKey: string, prompt: string) => {
  const key = requireApiKey(apiKey);
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const safePrompt = sanitizePrompt(prompt);

  try {
    const text = await runWithRetry(async () => {
      const result = await withTimeout(
        model.generateContent(safePrompt),
        GEMINI_TIMEOUT_MS,
        "Gemini 텍스트 생성",
      );
      const response = await result.response;
      return response.text();
    }, 2);
    return text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateGeminiJSON = async (apiKey: string, prompt: string) => {
  const key = requireApiKey(apiKey);
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });
  const safePrompt = sanitizePrompt(prompt);

  const stripCodeFences = (text: string) =>
    text
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();

  const repairCommonJsonIssues = (text: string) => {
    let out = text.trim();
    out = out.replace(/\/\*[\s\S]*?\*\//g, "");
    out = out.replace(/^\s*\/\/.*$/gm, "");
    out = out.replace(
      /'([^'\\]*(?:\\.[^'\\]*)*)'/g,
      (_m, inner: string) => JSON.stringify(inner),
    );
    out = out.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*):/g, '$1"$2"$3:');
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
      model: GEMINI_MODEL,
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

    const repaired = await runWithRetry(async () => {
      return withTimeout(
        repairModel.generateContent(sanitizePrompt(repairPrompt)),
        GEMINI_TIMEOUT_MS,
        "Gemini JSON 복구",
      );
    }, 1);

    const repairedText = stripCodeFences((await repaired.response).text());
    return tryParse(repairCommonJsonIssues(repairedText));
  };

  try {
    const raw = await runWithRetry(async () => {
      const result = await withTimeout(
        model.generateContent(safePrompt),
        GEMINI_TIMEOUT_MS,
        "Gemini JSON 생성",
      );
      const response = await result.response;
      return response.text();
    }, 2);

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
        // continue
      }
    }

    return await repairJSON(extracted ?? text);
  } catch (error) {
    console.error("Gemini JSON Error:", error);
    throw error;
  }
};
