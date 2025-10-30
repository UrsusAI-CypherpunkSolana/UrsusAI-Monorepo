// src/clients/providers/gemini.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { ENV } from "@/config/env";

export async function chatWithGemini(instruction: string, input: string, model: string): Promise<string> {
  try {
    const genAI = new GoogleGenerativeAI(ENV.GEMINI_API_KEY);

    const fullPrompt = `${instruction}\n\nUser: ${input}`;
    const geminiModel = genAI.getGenerativeModel({ model });

    const result = await geminiModel.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    return text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error contacting Gemini.";
  }
}
