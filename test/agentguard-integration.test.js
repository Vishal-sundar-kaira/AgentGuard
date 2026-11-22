
const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");
const { runAgent } = require("../Agent/openai_agent");
const { getAgentPermissions } = require("../agent/tools");

// Test 1: Unauthorized request must be blocked by runtime
test("AgentGuard end-to-end: runtime blocks unauthorized request before real API execution", async (t) => {
  const app = createApp({ mode: "protected" });
  const server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  process.env.AGENTGUARD_BASE_URL = baseUrl;

  t.after(async () => {
    delete process.env.AGENTGUARD_BASE_URL;
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  let apiExecutionReached = false;

  const mockClient = {
    responses: {
      create: async () => ({
        id: "mock-response-1",
        output: [
          {
            type: "function_call",
            name: "get_ticket",
            call_id: "call-1",
            arguments: JSON.stringify({ ticketId: "T-202" })
          }
        ],
        output_text: ""
      })
    }
  };

  const result = await runAgent({
    message: "Read Bob's ticket T-202",
    token: "alice-test-token",
    clientOverride: mockClient,
    getAgentPermissionsOverride: async () =>
      getAgentPermissions("alice-test-token"),
    executeToolOverride: async (args) => {
      apiExecutionReached = true;
      const { executeTool } = require("../agent/tools");
      return executeTool(args);
    }
  });

  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0].blockedByPolicy, true);
  assert.equal(result.toolCalls[0].toolResult.status, 403);
  assert.equal(apiExecutionReached, false);
});

// Test 2: Authorized request must reach real tool and API
test("AgentGuard end-to-end: allows authorized request through real tool and API", async (t) => {
  const app = createApp({ mode: "protected" });
  const server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  process.env.AGENTGUARD_BASE_URL = baseUrl;

  t.after(async () => {
    delete process.env.AGENTGUARD_BASE_URL;
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  let modelCallCount = 0;

  const mockClient = {
    responses: {
      create: async () => {
        modelCallCount++;

        // First response: request the authorized ticket tool.
        if (modelCallCount === 1) {
          return {
            id: "mock-response-own-ticket",
            output: [
              {
                type: "function_call",
                name: "get_ticket",
                call_id: "call-own-1",
                arguments: JSON.stringify({ ticketId: "T-101" })
              }
            ],
            output_text: ""
          };
        }

        // Second response: finish normally without another tool call.
        // Second response: return a normal final message.
return {
  id: "mock-response-final",
  output: [
    {
      type: "message",
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: "Ticket retrieved successfully."
        }
      ]
    }
  ],
  output_text: "Ticket retrieved successfully."
};
      }
    }
  };

  const result = await runAgent({
    message: "Read my ticket T-101",
    token: "alice-test-token",
    clientOverride: mockClient,
    getAgentPermissionsOverride: async () =>
      getAgentPermissions("alice-test-token")
  });

  assert.equal(modelCallCount, 2);
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0].blockedByPolicy, false);
  assert.equal(result.toolCalls[0].toolResult.status, 200);
  assert.equal(result.toolCalls[0].toolResult.body.id, "T-101");
  assert.equal(
    result.toolCalls[0].toolResult.body.title,
    "Alice's laptop issue"
  );
});

// Test 3: Indirect prompt injection must be blocked by runtime
test("AgentGuard end-to-end: blocks indirect prompt injection from real API data", async (t) => {
  const app = createApp({ mode: "protected" });
  const server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  process.env.AGENTGUARD_BASE_URL = baseUrl;

  t.after(async () => {
    delete process.env.AGENTGUARD_BASE_URL;
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  let modelCallCount = 0;
  let unauthorizedApiReached = false;

  const mockClient = {
    responses: {
      create: async () => {
        modelCallCount++;

        // First response: read Alice's authorized ticket.
        if (modelCallCount === 1) {
          return {
            id: "mock-injection-read-own-ticket",
            output: [
              {
                type: "function_call",
                name: "get_ticket",
                call_id: "call-injection-1",
                arguments: JSON.stringify({ ticketId: "T-101" })
              }
            ],
            output_text: ""
          };
        }

        // Second response: simulate the agent following
        // malicious instructions inside the ticket description.
        if (modelCallCount === 2) {
          return {
            id: "mock-injection-attack",
            output: [
              {
                type: "function_call",
                name: "get_ticket",
                call_id: "call-injection-2",
                arguments: JSON.stringify({ ticketId: "T-202" })
              }
            ],
            output_text: ""
          };
        }

        // Fallback final response.
        return {
          id: "mock-injection-final",
          output: [
            {
              type: "message",
              role: "assistant",
              content: [
                {
                  type: "output_text",
                  text: "Request completed."
                }
              ]
            }
          ],
          output_text: "Request completed."
        };
      }
    }
  };

  const result = await runAgent({
    message: "Read my ticket T-101 and summarize the issue.",
    token: "alice-test-token",
    clientOverride: mockClient,
    getAgentPermissionsOverride: async () =>
      getAgentPermissions("alice-test-token"),
    executeToolOverride: async (args) => {
      if (args.args?.ticketId === "T-202") {
        unauthorizedApiReached = true;
      }

      const { executeTool } = require("../agent/tools");
      return executeTool(args);
    }
  });

  // Agent should attempt two tool calls.
  assert.equal(result.toolCalls.length, 2);

  // First call: Alice is allowed to read her own ticket.
  assert.equal(result.toolCalls[0].blockedByPolicy, false);
  assert.equal(result.toolCalls[0].toolResult.status, 200);
  assert.equal(result.toolCalls[0].toolResult.body.id, "T-101");

  // Second call: the injected instruction requests Bob's ticket.
  assert.equal(result.toolCalls[1].blockedByPolicy, true);
  assert.equal(result.toolCalls[1].toolResult.status, 403);

  // The unauthorized call must never reach the real API/tool executor.
  assert.equal(unauthorizedApiReached, false);

  // The runtime should stop after detecting the attack.
  assert.equal(modelCallCount, 2);
});

// Test 4: Indirect prompt injection must not modify another user's ticket
test("AgentGuard end-to-end: blocks indirect prompt injection attempting unauthorized update", async (t) => {
  const app = createApp({ mode: "protected" });
  const server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  process.env.AGENTGUARD_BASE_URL = baseUrl;

  t.after(async () => {
    delete process.env.AGENTGUARD_BASE_URL;
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  let modelCallCount = 0;
  let unauthorizedApiReached = false;

  const mockClient = {
    responses: {
      create: async () => {
        modelCallCount++;

        // First response: read Alice's own ticket.
        if (modelCallCount === 1) {
          return {
            id: "mock-update-injection-read",
            output: [
              {
                type: "function_call",
                name: "get_ticket",
                call_id: "call-update-injection-1",
                arguments: JSON.stringify({ ticketId: "T-101" })
              }
            ],
            output_text: ""
          };
        }

        // Second response: simulate malicious instruction
        // attempting to update Bob's ticket.
        if (modelCallCount === 2) {
          return {
            id: "mock-update-injection-attack",
            output: [
              {
                type: "function_call",
                name: "update_ticket",
                call_id: "call-update-injection-2",
                arguments: JSON.stringify({
                  ticketId: "T-202",
                  title: "COMPROMISED by prompt injection"
                })
              }
            ],
            output_text: ""
          };
        }

        return {
          id: "mock-update-injection-final",
          output: [
            {
              type: "message",
              role: "assistant",
              content: [
                {
                  type: "output_text",
                  text: "Request completed."
                }
              ]
            }
          ],
          output_text: "Request completed."
        };
      }
    }
  };

  const result = await runAgent({
    message: "Read my ticket T-101 and summarize it.",
    token: "alice-test-token",
    clientOverride: mockClient,
    getAgentPermissionsOverride: async () =>
      getAgentPermissions("alice-test-token"),
    executeToolOverride: async (args) => {
      if (args.args?.ticketId === "T-202") {
        unauthorizedApiReached = true;
      }

      const { executeTool } = require("../Agent/tools");
      return executeTool(args);
    }
  });

  // Two attempted tool calls: own read + malicious update.
  assert.equal(result.toolCalls.length, 2);

  // Alice's read is allowed.
  assert.equal(result.toolCalls[0].blockedByPolicy, false);
  assert.equal(result.toolCalls[0].toolResult.status, 200);
  assert.equal(result.toolCalls[0].toolResult.body.id, "T-101");

  // The unauthorized update must be blocked by runtime.
  assert.equal(result.toolCalls[1].toolName, "update_ticket");
  assert.equal(result.toolCalls[1].blockedByPolicy, true);
  assert.equal(result.toolCalls[1].toolResult.status, 403);

  // The update must never reach the real tool/API.
  assert.equal(unauthorizedApiReached, false);

  // Agent should stop immediately after the denial.
  assert.equal(modelCallCount, 2);

  // Independently verify Bob's ticket remains unchanged in the real API.
  const { executeTool } = require("../Agent/tools");
  const bobTicket = await executeTool({
    name: "get_ticket",
    args: { ticketId: "T-202" },
    token: "bob-test-token"
  });

  assert.equal(bobTicket.status, 200);
  assert.equal(bobTicket.body.title, "Bob's confidential support issue");
  assert.equal(bobTicket.body.status, "open");
});

// Test 5: Indirect prompt injection must not delete another user's ticket
test("AgentGuard end-to-end: blocks indirect prompt injection attempting unauthorized deletion", async (t) => {
  const app = createApp({ mode: "protected" });
  const server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  process.env.AGENTGUARD_BASE_URL = baseUrl;

  t.after(async () => {
    delete process.env.AGENTGUARD_BASE_URL;
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  let modelCallCount = 0;
  let unauthorizedApiReached = false;

  const mockClient = {
    responses: {
      create: async () => {
        modelCallCount++;

        // First response: read Alice's own ticket.
        if (modelCallCount === 1) {
          return {
            id: "mock-delete-injection-read",
            output: [
              {
                type: "function_call",
                name: "get_ticket",
                call_id: "call-delete-injection-1",
                arguments: JSON.stringify({ ticketId: "T-101" })
              }
            ],
            output_text: ""
          };
        }

        // Second response: simulate malicious instruction
        // attempting to delete Bob's ticket.
        if (modelCallCount === 2) {
          return {
            id: "mock-delete-injection-attack",
            output: [
              {
                type: "function_call",
                name: "delete_ticket",
                call_id: "call-delete-injection-2",
                arguments: JSON.stringify({ ticketId: "T-202" })
              }
            ],
            output_text: ""
          };
        }

        // Fallback final response.
        return {
          id: "mock-delete-injection-final",
          output: [
            {
              type: "message",
              role: "assistant",
              content: [
                {
                  type: "output_text",
                  text: "Request completed."
                }
              ]
            }
          ],
          output_text: "Request completed."
        };
      }
    }
  };

  const result = await runAgent({
    message: "Read my ticket T-101 and summarize it.",
    token: "alice-test-token",
    exposedToolNames: ["get_ticket", "update_ticket", "delete_ticket"],
    clientOverride: mockClient,
    getAgentPermissionsOverride: async () =>
      getAgentPermissions("alice-test-token"),
    executeToolOverride: async (args) => {
      if (args.args?.ticketId === "T-202") {
        unauthorizedApiReached = true;
      }

      const { executeTool } = require("../Agent/tools");
      return executeTool(args);
    }
  });

  // Two tool calls: authorized read + unauthorized deletion attempt.
  assert.equal(result.toolCalls.length, 2);

  // Alice's read is permitted.
  assert.equal(result.toolCalls[0].blockedByPolicy, false);
  assert.equal(result.toolCalls[0].toolResult.status, 200);
  assert.equal(result.toolCalls[0].toolResult.body.id, "T-101");

  // Unauthorized deletion is blocked.
  assert.equal(result.toolCalls[1].toolName, "delete_ticket");
  assert.equal(result.toolCalls[1].blockedByPolicy, true);
  assert.equal(result.toolCalls[1].toolResult.status, 403);

  // Delete must not reach the real API executor.
  assert.equal(unauthorizedApiReached, false);

  // Runtime stops after denial.
  assert.equal(modelCallCount, 2);

  // Confirm Bob's ticket still exists and has its original values.
  const { executeTool } = require("../Agent/tools");

  const bobTicket = await executeTool({
    name: "get_ticket",
    args: { ticketId: "T-202" },
    token: "bob-test-token"
  });

  assert.equal(bobTicket.status, 200);
  assert.equal(bobTicket.body.id, "T-202");
  assert.equal(bobTicket.body.title, "Bob's confidential support issue");
  assert.equal(bobTicket.body.status, "open");
});