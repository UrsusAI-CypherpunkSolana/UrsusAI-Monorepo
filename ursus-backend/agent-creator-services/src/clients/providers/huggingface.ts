import axios from "axios";
import { ENV } from "@/config/env";

const HF_API_URL = "https://api-inference.huggingface.co/models";

export async function chatWithHuggingFace(
  instruction: string,
  input: string,
  model: string
): Promise<string> {
  const prompt = `${instruction} ${input}`;

  try {
    const response = await axios.post(
      `${HF_API_URL}/${model}`,
      { inputs: prompt },
      {
        headers: {
          Authorization: `Bearer ${ENV.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    const generatedText = response.data?.generated_text || response.data?.[0]?.generated_text;

    return generatedText || "No response from Hugging Face.";
  } catch (error: any) {
    console.error("[HUGGINGFACE ERROR]", error?.response?.data || error.message);
    return "Error contacting Hugging Face.";
  }
}
