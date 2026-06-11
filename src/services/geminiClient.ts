import { get, set } from 'idb-keyval';

const API_KEY_STORAGE_KEY = 'user_gemini_api_key';
const MODEL_STORAGE_KEY = 'user_gemini_model';

export const getStoredApiKey = (): string => {
  return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
};

export const setStoredApiKey = (key: string): void => {
  if (key) {
    localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  }
};

export const getStoredModel = (): string => {
  return localStorage.getItem(MODEL_STORAGE_KEY) || 'gemini-2.5-flash';
};

export const setStoredModel = (model: string): void => {
  localStorage.setItem(MODEL_STORAGE_KEY, model);
};

/**
 * Direct fetch client-side for symptom matching to bypass missing backend on GitHub Pages.
 */
export async function directGeminiSymptomFetch(prompt: string, apiKey: string): Promise<any> {
  const model = getStoredModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || response.statusText;
    throw new Error(`Direct Gemini API 呼叫失敗: ${message}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return { text };
}

/**
 * Direct client-side stream fetch for AI clinical analysis.
 */
export async function directGeminiAnalyzeStream(
  prompt: string,
  apiKey: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const model = getStoredModel();
  // Using alt=sse for Server Sent Events streaming style
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || response.statusText;
    throw new Error(`Direct Gemini 串流建立失敗: ${message}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('無法讀取 Direct Gemini 串流回應體');
  }

  const decoder = new TextDecoder('utf-8');
  let accumulatedText = '';
  let lineBuffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      lineBuffer += chunk;

      const lines = lineBuffer.split('\n');
      // Save the last incomplete line back to the buffer
      lineBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.substring(5).trim();
          if (!jsonStr) continue;
          try {
            const data = JSON.parse(jsonStr);
            const chunkText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (chunkText) {
              accumulatedText += chunkText;
              onChunk(accumulatedText);
            }
          } catch (e) {
            console.warn('解析 Direct Gemini SSE JSON 失敗:', e, jsonStr);
          }
        }
      }
    }

    // Process leftover buffer if any
    if (lineBuffer) {
      const trimmed = lineBuffer.trim();
      if (trimmed.startsWith('data:')) {
        const jsonStr = trimmed.substring(5).trim();
        try {
          const data = JSON.parse(jsonStr);
          const chunkText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (chunkText) {
            accumulatedText += chunkText;
            onChunk(accumulatedText);
          }
        } catch (e) {
          // ignore
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return accumulatedText;
}
