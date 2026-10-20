
const express = require("express");

const VALID_TOKENS = {
  "alice-test-token": "alice",
  "bob-test-token": "bob",
  "admin-test-token": "admin",
};

function createApp({ mode = "protected" } = {}) {
  if (!["vulnerable", "protected"].includes(mode)) {
    throw new Error(`Unsupported security mode: ${mode}`);
  }

  const app = express();
  app.use(express.json());

  // Fresh test data for every app instance.
  const tickets = new Map([
    [
      "T-101",
      {
        id: "T-101",
        ownerId: "alice",
        title: "Alice's laptop issue",
        status: "open",
      },
    ],
    [
      "T-202",
      {
        id: "T-202",
        ownerId: "bob",
        title: "Bob's confidential support issue",
        status: "open",
      },
    ],
  ]);

  // Simulated authentication for this local lab.
  // Never use these hard-coded tokens in production.
  app.use((req, res, next) => {
    const authorization = req.get("Authorization") || "";
    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !VALID_TOKENS[token]) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Identity comes from the validated token, not request-body input.
    req.user = { id: VALID_TOKENS[token] };
    next();
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/tickets/:id", (req, res) => {
    const ticket = tickets.get(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Deliberate BOLA vulnerability in the isolated lab.
    // Protected mode enforces object ownership.
    if (
      mode === "protected" &&
      req.user.id !== "admin" &&
      ticket.ownerId !== req.user.id
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    return res.json({
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
    });
  });

  return app;
}

module.exports = { createApp };
