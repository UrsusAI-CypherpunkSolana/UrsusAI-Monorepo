import { chatWithGroq } from "./providers/groq";
import { chatWithTogether } from "./providers/together";
import { chatWithGemini } from "./providers/gemini";
import { chatWithOllama } from "./providers/ollama";
import { chatWithHuggingFace } from "./providers/huggingface";

export interface LLMInput {
  instruction: string;
  input: string;
  model: string;
}

// Metni temizlemek için yardımcı fonksiyon
function cleanResponse(text: string): string {
  return text
    .replace(/\n/g, " ")
    .replace(/\*+/g, "")
    .replace(/_+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function chatWithLLM({ instruction, input, model }: LLMInput): Promise<string> {
  let rawResponse: string;

  if (model.startsWith("llama3") || model.startsWith("mixtral")) {
    rawResponse = await chatWithGroq(instruction, input, model);
  } else if (
    model.startsWith("deepseek") ||
    model.startsWith("deepseek-ai") ||
    model.startsWith("mistral") ||
    model.startsWith("mistralai") ||
    model.startsWith("meta-llama")
  ) {
    rawResponse = await chatWithTogether(instruction, input, model);
  } else if (model.startsWith("models/gemini")) {
    rawResponse = await chatWithGemini(instruction, input, model);
  } else if (model.startsWith("ollama-")) {
    rawResponse = await chatWithOllama(instruction, input, model.replace("ollama-", ""));
  } 
  //else if (model.startsWith("huggingface/")) {
    //rawResponse = await chatWithHuggingFace(instruction, input, model.replace("huggingface/", ""));
  //} 
  else {
    return "Unsupported model.";
  }

  return cleanResponse(rawResponse);
}
