import { chatWithLLM } from "@/clients/llmClient";
import { AgentSession } from "@/models/AgentSession";

/**
 * Verilen agent session bilgisine göre AI modelinden yanıt alır.
 */
export async function runAgent(session: AgentSession): Promise<string> {
  const { instruction, input, model } = session;

  const output = await chatWithLLM({ instruction, input, model });

  return output;
}
