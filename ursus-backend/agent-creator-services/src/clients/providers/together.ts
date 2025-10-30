// src/clients/providers/together.ts

import axios from "axios";
import { buildChatPrompt } from "@/core/promptBuilder";
import { ENV } from "@/config/env";

const TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions";

export async function chatWithTogether(
  instruction: string,
  input: string,
  model: string
): Promise<string> {
  const messages = buildChatPrompt(instruction, input);

  try {
    const response = await axios.post(
      TOGETHER_API_URL,
      {
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      },
      {
        headers: {
          Authorization: `Bearer ${ENV.TOGETHER_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    return content || "No response from Together.ai.";
  } catch (error: any) {
    console.error("[TOGETHER ERROR]", error?.response?.data || error.message);
    return "Error contacting Together.ai.";
  }
}
