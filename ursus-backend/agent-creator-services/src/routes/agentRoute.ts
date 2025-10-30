// src/routes/agentRoute.ts

import express from "express";
import { runAgent } from "@/core/agentRunner";
import { AgentSession } from "@/models/AgentSession";

const router = express.Router();

/**
 * POST /ask
 * Body: { model: string, instruction: string, input: string }
 */
router.post("/ask", async (req, res) => {
  const { model, instruction, input } = req.body as AgentSession;

  if (!model || !instruction || !input) {
    return res.status(400).json({ error: "Missing model, instruction or input." });
  }

  try {
    const output = await runAgent({ model, instruction, input });
    res.json({ output });
  } catch (err) {
    console.error("[Agent Error]", err);
    res.status(500).json({ error: "Something went wrong while running the agent." });
  }
});

export default router;
