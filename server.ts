import "dotenv/config";
import express from "express";
import path from "path";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { createServer as createViteServer } from "vite";

let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please make sure to add it under Settings > Secrets in AI Studio.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Helper function to retry Gemini API calls with exponential backoff on 429 Too Many Requests errors.
const isHighDemandOrRateLimit = (error: any): boolean => {
  if (!error) return false;
  const status = error?.status || error?.statusCode;
  if (status === 429 || status === 403 || status === 503) {
    return true;
  }
  const msg = (error?.message || "").toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("too many requests") ||
    msg.includes("quota") ||
    msg.includes("exhausted") ||
    msg.includes("limit") ||
    msg.includes("overload") ||
    msg.includes("demand") ||
    msg.includes("capacity") ||
    msg.includes("service unavailable")
  );
};

const retryWithBackoff = async <T = any>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
  backoffFactor = 2
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && isHighDemandOrRateLimit(error)) {
      console.warn(`Gemini API rate limited (429/high-demand) on server. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * backoffFactor, backoffFactor);
    }
    throw error;
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API endpoints FIRST
  app.post("/api/gemini/symptom", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const client = getGeminiClient();
      let text = "";
      let response;

      try {
        console.log("[api/gemini/symptom] Attempting high-quota, ultra-fast primary model gemini-3.1-flash-lite with JSON response config...");
        response = await retryWithBackoff(() =>
          client.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
            },
          })
        );
      } catch (error: any) {
        console.warn("[api/gemini/symptom] gemini-3.1-flash-lite JSON call failed, trying standard fallback on gemini-3.1-flash-lite without explicit JSON type...", error.message);
        try {
          response = await retryWithBackoff(() =>
            client.models.generateContent({
              model: "gemini-3.1-flash-lite",
              contents: prompt + "\n\nCRITICAL: Return ONLY valid raw JSON array or object structure. Do not wrap in markdown codeblocks.",
            })
          );
        } catch (innerError: any) {
          console.warn("[api/gemini/symptom] gemini-3.1-flash-lite failed completely. Falling back to gemini-3.5-flash...", innerError.message);
          try {
            response = await retryWithBackoff(() =>
              client.models.generateContent({
                model: "gemini-3.5-flash",
                contents: prompt,
                config: {
                  responseMimeType: "application/json",
                },
              })
            );
          } catch (flashError: any) {
            console.warn("[api/gemini/symptom] gemini-3.5-flash failed. Falling back to gemini-flash-latest...", flashError.message);
            response = await retryWithBackoff(() =>
              client.models.generateContent({
                model: "gemini-flash-latest",
                contents: prompt,
                config: {
                  responseMimeType: "application/json",
                },
              })
            );
          }
        }
      }

      text = response.text || "";
      res.json({ text });
    } catch (error: any) {
      console.error("Server API Error (/api/gemini/symptom):", error);
      res.status(500).json({ error: error.message || "An error occurred with Gemini on the server." });
    }
  });

  app.post("/api/gemini/analyze", async (req, res) => {
    let responseStream: any = null;
    let modelUsed = "gemini-3.1-flash-lite";

    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).send("Prompt is required");
      }

      const client = getGeminiClient();
      
      try {
        console.log("[api/gemini/analyze] Attempting high-quota, ultra-fast primary streaming model gemini-3.1-flash-lite...");
        responseStream = await retryWithBackoff(() =>
          client.models.generateContentStream({
            model: "gemini-3.1-flash-lite",
            contents: [{ parts: [{ text: prompt }] }],
          })
        );
      } catch (error: any) {
        console.warn("[api/gemini/analyze] Primary gemini-3.1-flash-lite streaming call failed, falling back to gemini-3.5-flash...", error.message);
        modelUsed = "gemini-3.5-flash";
        try {
          responseStream = await retryWithBackoff(() =>
            client.models.generateContentStream({
              model: "gemini-3.5-flash",
              contents: [{ parts: [{ text: prompt }] }],
            })
          );
        } catch (innerError: any) {
          console.warn("[api/gemini/analyze] Fallback to gemini-3.5-flash streaming failed. Falling back to gemini-flash-latest...", innerError.message);
          modelUsed = "gemini-flash-latest";
          responseStream = await retryWithBackoff(() =>
            client.models.generateContentStream({
              model: "gemini-flash-latest",
              contents: [{ parts: [{ text: prompt }] }],
            })
          );
        }
      }

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");

      for await (const chunk of responseStream) {
        const chunkText = chunk.text || "";
        res.write(chunkText);
      }

      res.end();
    } catch (error: any) {
      console.error(`Server API Error (/api/gemini/analyze) [Model: ${modelUsed}]:`, error);
      if (!res.headersSent) {
        res.status(500).send(error.message || "An error occurred with Gemini on the server.");
      } else {
        res.write(`\n\n⚠️ Error: ${error.message || "An error occurred during streaming."}`);
        res.end();
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
