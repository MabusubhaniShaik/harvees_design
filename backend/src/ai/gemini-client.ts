const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
const GEMINI_API_BASE =
  process.env.GEMINI_API_BASE_URL ||
  "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_FALLBACK_MODELS = (
  process.env.GEMINI_FALLBACK_MODELS ||
  "gemini-2.5-flash,gemini-2.0-flash"
)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);

type GeminiGenerationResult = {
  model: string;
  text: string;
};

type GeminiPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
    finishReason?: string;
  }>;
  error?: {
    message?: string;
  };
};

type ProviderError = Error & {
  statusCode?: number;
  model?: string;
};

const createProviderError = (
  message: string,
  statusCode: number,
  model?: string
): ProviderError =>
  Object.assign(new Error(message), {
    statusCode,
    model,
  });

const isHighDemandError = (statusCode: number, message: string) =>
  statusCode === 429 ||
  statusCode === 503 ||
  /high demand|temporar|overloaded|unavailable|resource exhausted/i.test(message);

const modelChain = () =>
  [DEFAULT_GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS].filter(
    (model, index, list) => list.indexOf(model) === index
  );

export const getGeminiConfig = () => ({
  enabled: GEMINI_API_KEY.length > 0,
  provider: "Google Gemini",
  model: DEFAULT_GEMINI_MODEL,
  fallbackModels: GEMINI_FALLBACK_MODELS,
  endpoint: `${GEMINI_API_BASE}/${DEFAULT_GEMINI_MODEL}:generateContent`,
});

const requestGeminiModel = async (
  prompt: string,
  model: string
): Promise<GeminiGenerationResult> => {
  const response = await fetch(
    `${GEMINI_API_BASE}/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          maxOutputTokens: 500,
        },
      }),
    }
  );

  const payload = (await response.json()) as GeminiResponse;

  if (!response.ok) {
    const message = payload.error?.message || "Gemini request failed.";
    throw createProviderError(message, response.status, model);
  }

  const answer = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!answer) {
    throw createProviderError("Gemini returned an empty response.", 502, model);
  }

  return {
    model,
    text: answer,
  };
};

export const generateGeminiText = async (
  prompt: string
): Promise<GeminiGenerationResult> => {
  if (!GEMINI_API_KEY) {
    throw createProviderError(
      "Gemini API key is not configured in the backend environment.",
      500
    );
  }

  const errors: ProviderError[] = [];

  for (const model of modelChain()) {
    try {
      return await requestGeminiModel(prompt, model);
    } catch (error) {
      const providerError = error as ProviderError;
      errors.push(providerError);

      if (!isHighDemandError(providerError.statusCode || 500, providerError.message)) {
        throw providerError;
      }
    }
  }

  const attemptedModels = modelChain().join(", ");
  throw createProviderError(
    `Gemini is temporarily under high demand. Tried: ${attemptedModels}. Please retry in a moment.`,
    503
  );
};
