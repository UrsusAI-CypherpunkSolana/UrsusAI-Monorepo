import axios from "axios";
import { buildChatPrompt } from "@/core/promptBuilder";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

if (!GROQ_API_KEY) {
  throw new Error("Missing GROQ_API_KEY in environment variables.");
}

export async function chatWithGroq(instruction: string, input: string, model: string): Promise<string> {
  const messages = buildChatPrompt(instruction, input);

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    return content || "No response from model.";
  } catch (error: any) {
    console.error("[GROQ ERROR]", error?.response?.data || error.message);
    return "Error contacting Groq.";
  }
}
