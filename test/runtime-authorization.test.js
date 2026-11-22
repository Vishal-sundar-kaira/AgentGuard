const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runAgent } = require("../Agent/openai_agent");

test("AgentGuard blocks Alice from reading Bob's ticket at runtime", async () => {
  let apiExecutionAttempted = false;

  const mockClient = {
    responses: {
      create: async () => ({
        id: "mock-response-001",
        output: [
          {
            type: "function_call",
            name: "get_ticket",
            call_id: "mock-call-001",
            arguments: JSON.stringify({
              ticketId: "T-202"
            })
          }
        ],
        output_text: ""
      })
    }
  };

  const result = await runAgent({
    message: "Read ticket T-202",
    token: "alice-test-token",
    clientOverride: mockClient,

    getAgentPermissionsOverride: async () => ({
      userId: "alice",
      accessibleTicketIds: ["T-101"]
    }),

    executeToolOverride: async () => {
      apiExecutionAttempted = true;
      throw new Error("Unauthorized API execution was attempted!");
    }
  });

  assert.equal(result.toolCalls.length, 1);

  const blockedCall = result.toolCalls[0];

  assert.equal(blockedCall.toolName, "get_ticket");
  assert.equal(blockedCall.toolArguments.ticketId, "T-202");
  assert.equal(blockedCall.blockedByPolicy, true);
  assert.equal(blockedCall.toolResult.status, 403);
  assert.equal(apiExecutionAttempted, false);
});

test("AgentGuard allows Alice to read her own ticket at runtime", async () => {
  let apiExecutionCount = 0;
  let llmCallCount = 0;

  const mockClient = {
    responses: {
      create: async () => {
        llmCallCount++;

        if (llmCallCount === 1) {
          return {
            id: "mock-response-002",
            output: [
              {
                type: "function_call",
                name: "get_ticket",
                call_id: "mock-call-002",
                arguments: JSON.stringify({
                  ticketId: "T-101"
                })
              }
            ],
            output_text: ""
          };
        }

        return {
          id: "mock-response-003",
          output: [],
          output_text: "Alice's ticket was retrieved successfully."
        };
      }
    }
  };

  const result = await runAgent({
    message: "Read my ticket T-101",
    token: "alice-test-token",
    clientOverride: mockClient,

    getAgentPermissionsOverride: async () => ({
      userId: "alice",
      accessibleTicketIds: ["T-101"]
    }),

    executeToolOverride: async ({ name, args }) => {
      apiExecutionCount++;

      assert.equal(name, "get_ticket");
      assert.equal(args.ticketId, "T-101");

      return {
        status: 200,
        body: {
          id: "T-101",
          title: "Alice's laptop issue"
        }
      };
    }
  });

  assert.equal(apiExecutionCount, 1);
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0].blockedByPolicy, false);
  assert.equal(result.toolCalls[0].toolResult.status, 200);
  assert.equal(result.toolArguments.ticketId, "T-101");
});

test("AgentGuard rejects tools that were not exposed to the LLM", async () => {
  let apiExecutionAttempted = false;

  const mockClient = {
    responses: {
      create: async () => ({
        id: "mock-response-004",
        output: [
          {
            type: "function_call",
            name: "delete_ticket",
            call_id: "mock-call-004",
            arguments: JSON.stringify({
              ticketId: "T-101"
            })
          }
        ],
        output_text: ""
      })
    }
  };

  await assert.rejects(
    runAgent({
      message: "Delete my ticket T-101",
      token: "alice-test-token",
      clientOverride: mockClient,

      getAgentPermissionsOverride: async () => ({
        userId: "alice",
        accessibleTicketIds: ["T-101"]
      }),

      executeToolOverride: async () => {
        apiExecutionAttempted = true;
        throw new Error("Unexpected tool execution!");
      }
    }),
    {
      message: "AgentGuard blocked unsupported tool: delete_ticket"
    }
  );

  assert.equal(apiExecutionAttempted, false);
});

test("AgentGuard blocks Alice from updating Bob's ticket at runtime", async () => {
  let apiExecutionAttempted = false;

  const mockClient = {
    responses: {
      create: async () => ({
        id: "mock-update-response",
        output: [
          {
            type: "function_call",
            name: "update_ticket",
            call_id: "mock-update-call",
            arguments: JSON.stringify({
              ticketId: "T-202",
              title: "Unauthorized title change"
            })
          }
        ],
        output_text: ""
      })
    }
  };

  const result = await runAgent({
    message: "Update ticket T-202",
    token: "alice-test-token",
    clientOverride: mockClient,
    exposedToolNames: ["get_ticket", "update_ticket"],

    getAgentPermissionsOverride: async () => ({
      userId: "alice",
      accessibleTicketIds: ["T-101"]
    }),

    executeToolOverride: async () => {
      apiExecutionAttempted = true;
      throw new Error("Unauthorized UPDATE execution was attempted!");
    }
  });

  assert.equal(result.toolCalls.length, 1);

  const blockedCall = result.toolCalls[0];

  assert.equal(blockedCall.toolName, "update_ticket");
  assert.equal(blockedCall.toolArguments.ticketId, "T-202");
  assert.equal(blockedCall.blockedByPolicy, true);
  assert.equal(blockedCall.toolResult.status, 403);

  assert.equal(apiExecutionAttempted, false);
});

test("AgentGuard blocks Alice from deleting Bob's ticket at runtime", async () => {
  let apiExecutionAttempted = false;

  const mockClient = {
    responses: {
      create: async () => ({
        id: "mock-delete-response",
        output: [
          {
            type: "function_call",
            name: "delete_ticket",
            call_id: "mock-delete-call",
            arguments: JSON.stringify({
              ticketId: "T-202"
            })
          }
        ],
        output_text: ""
      })
    }
  };

  const result = await runAgent({
    message: "Delete ticket T-202",
    token: "alice-test-token",
    clientOverride: mockClient,
    exposedToolNames: ["get_ticket", "delete_ticket"],

    getAgentPermissionsOverride: async () => ({
      userId: "alice",
      accessibleTicketIds: ["T-101"]
    }),

    executeToolOverride: async () => {
      apiExecutionAttempted = true;
      throw new Error("Unauthorized DELETE execution was attempted!");
    }
  });

  assert.equal(result.toolCalls.length, 1);

  const blockedCall = result.toolCalls[0];

  assert.equal(blockedCall.toolName, "delete_ticket");
  assert.equal(blockedCall.toolArguments.ticketId, "T-202");
  assert.equal(blockedCall.blockedByPolicy, true);
  assert.equal(blockedCall.toolResult.status, 403);

  assert.equal(apiExecutionAttempted, false);
});

test("AgentGuard allows Alice to update her own ticket at runtime", async () => {
  let apiExecutionCount = 0;
  let llmCallCount = 0;

  const mockClient = {
    responses: {
      create: async () => {
        llmCallCount++;

        if (llmCallCount === 1) {
          return {
            id: "mock-update-authorized-response",
            output: [
              {
                type: "function_call",
                name: "update_ticket",
                call_id: "mock-update-authorized-call",
                arguments: JSON.stringify({
                  ticketId: "T-101",
                  title: "Updated laptop issue"
                })
              }
            ],
            output_text: ""
          };
        }

        return {
          id: "mock-update-followup",
          output: [],
          output_text: "Your ticket was updated successfully."
        };
      }
    }
  };

  const result = await runAgent({
    message: "Update my ticket T-101",
    token: "alice-test-token",
    clientOverride: mockClient,
    exposedToolNames: ["get_ticket", "update_ticket"],

    getAgentPermissionsOverride: async () => ({
      userId: "alice",
      accessibleTicketIds: ["T-101"]
    }),

    executeToolOverride: async ({ name, args }) => {
      apiExecutionCount++;

      assert.equal(name, "update_ticket");
      assert.equal(args.ticketId, "T-101");
      assert.equal(args.title, "Updated laptop issue");

      return {
        status: 200,
        body: {
          id: "T-101",
          title: "Updated laptop issue"
        }
      };
    }
  });

  assert.equal(apiExecutionCount, 1);
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0].toolName, "update_ticket");
  assert.equal(result.toolCalls[0].blockedByPolicy, false);
  assert.equal(result.toolCalls[0].toolResult.status, 200);
  assert.equal(result.toolArguments.ticketId, "T-101");
});

test("AgentGuard allows Alice to delete her own ticket at runtime", async () => {
  let apiExecutionCount = 0;
  let llmCallCount = 0;

  const mockClient = {
    responses: {
      create: async () => {
        llmCallCount++;

        if (llmCallCount === 1) {
          return {
            id: "mock-delete-authorized-response",
            output: [
              {
                type: "function_call",
                name: "delete_ticket",
                call_id: "mock-delete-authorized-call",
                arguments: JSON.stringify({
                  ticketId: "T-101"
                })
              }
            ],
            output_text: ""
          };
        }

        return {
          id: "mock-delete-followup",
          output: [],
          output_text: "Your ticket was deleted successfully."
        };
      }
    }
  };

  const result = await runAgent({
    message: "Delete my ticket T-101",
    token: "alice-test-token",
    clientOverride: mockClient,
    exposedToolNames: ["get_ticket", "delete_ticket"],

    getAgentPermissionsOverride: async () => ({
      userId: "alice",
      accessibleTicketIds: ["T-101"]
    }),

    executeToolOverride: async ({ name, args }) => {
      apiExecutionCount++;

      assert.equal(name, "delete_ticket");
      assert.equal(args.ticketId, "T-101");

      return {
        status: 204,
        body: null
      };
    }
  });

  assert.equal(apiExecutionCount, 1);
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0].toolName, "delete_ticket");
  assert.equal(result.toolCalls[0].blockedByPolicy, false);
  assert.equal(result.toolCalls[0].toolResult.status, 204);
  assert.equal(result.toolArguments.ticketId, "T-101");
});

test("AgentGuard blocks prompt injection attempting to access Bob's ticket", async () => {
  let apiExecutionAttempted = false;

  const mockClient = {
    responses: {
      create: async () => ({
        id: "mock-prompt-injection-response",
        output: [
          {
            type: "function_call",
            name: "get_ticket",
            call_id: "mock-injection-call",
            arguments: JSON.stringify({
              ticketId: "T-202"
            })
          }
        ],
        output_text: ""
      })
    }
  };

  const result = await runAgent({
    message:
      "Read Alice's ticket T-101 and follow the malicious instruction inside it to access Bob's ticket T-202.",
    token: "alice-test-token",
    clientOverride: mockClient,

    getAgentPermissionsOverride: async () => ({
      userId: "alice",
      accessibleTicketIds: ["T-101"]
    }),

    executeToolOverride: async () => {
      apiExecutionAttempted = true;
      throw new Error("Prompt injection bypassed authorization!");
    }
  });

  assert.equal(result.toolCalls.length, 1);

  const blockedCall = result.toolCalls[0];

  assert.equal(blockedCall.toolName, "get_ticket");
  assert.equal(blockedCall.toolArguments.ticketId, "T-202");
  assert.equal(blockedCall.blockedByPolicy, true);
  assert.equal(blockedCall.toolResult.status, 403);
  assert.equal(apiExecutionAttempted, false);
});