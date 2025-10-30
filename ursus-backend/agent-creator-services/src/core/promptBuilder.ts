export function buildChatPrompt(instruction: string, input: string) {
    return [
      {
        role: "system",
        content: instruction,
      },
      {
        role: "user",
        content: input,
      },
    ];
  }
  
export function buildGeminiPrompt(instruction: string, input: string) {
    return `${instruction}\n\nUser: ${input}\n\nAssistant:`;
  }
  
export function buildSimplePrompt(instruction: string, input: string) {
    return `${instruction}\n\n${input}`;
  }
  