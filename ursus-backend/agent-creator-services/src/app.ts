// src/app.ts

import express from "express";
import cors from "cors";
import agentRoute from "@/routes/agentRoute";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api", agentRoute);

export default app;
