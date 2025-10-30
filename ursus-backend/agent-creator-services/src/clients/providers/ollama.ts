import axios from "axios";

export async function chatWithOllama(
  instruction: string,
  input: string,
  model: string
): Promise<string> {
  const prompt = `${instruction}\n\n${input}`;

  try {
    const response = await axios.post(
      "http://localhost:11434/api/generate",
      {
        model,
        prompt,
        stream: false,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.response;
  } catch (error) {
    console.error("[OLLAMA ERROR]", error);
    return "Error contacting Ollama.";
  }
}
