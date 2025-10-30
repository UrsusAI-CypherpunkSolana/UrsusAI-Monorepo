export const ENV = {
  PORT: process.env.PORT || "4000",
  GROQ_API_KEY: process.env.GROQ_API_KEY ?? "",
  TOGETHER_API_KEY: process.env.TOGETHER_API_KEY ?? "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
  HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY ?? "",
};

if (!ENV.GROQ_API_KEY) {
  throw new Error("Missing GROQ_API_KEY in environment variables.");
}

if (!ENV.TOGETHER_API_KEY) {
  throw new Error("Missing TOGETHER_API_KEY in environment variables.");
}

if (!ENV.GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY in environment variables.");
}

//if (!ENV.HUGGINGFACE_API_KEY) {
//  throw new Error("Missing HUGGINGFACE_API_KEY in environment variables.");
//}
