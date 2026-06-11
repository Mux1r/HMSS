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
const retryWithBackoff = async <T = any>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
  backoffFactor = 2
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit =
      error?.status === 429 ||
      error?.statusCode === 429 ||
      (error?.message && error.message.includes("429")) ||
      (error?.message && error.message.toLowerCase().includes("too many requests")) ||
      (error?.message && error.message.toLowerCase().includes("quota")) ||
      (error?.message && error.message.toLowerCase().includes("exhausted"));

    if (retries > 0 && isRateLimit) {
      console.warn(`Gemini API rate limited (429) on server. Retrying in ${delay}ms... (${retries} retries left)`);
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
      const response = await retryWithBackoff(() =>
        client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.MINIMAL,
            },
          },
        })
      );

      const text = response.text || "";
      res.json({ text });
    } catch (error: any) {
      console.error("Server API Error (/api/gemini/symptom):", error);
      res.status(500).json({ error: error.message || "An error occurred with Gemini on the server." });
    }
  });

  app.post("/api/gemini/analyze", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).send("Prompt is required");
      }

      const client = getGeminiClient();
      
      const responseStream = await retryWithBackoff(() =>
        client.models.generateContentStream({
          model: "gemini-3.5-flash",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW,
            },
          },
        })
      );

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");

      for await (const chunk of responseStream) {
        const chunkText = chunk.text || "";
        res.write(chunkText);
      }

      res.end();
    } catch (error: any) {
      console.error("Server API Error (/api/gemini/analyze):", error);
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
