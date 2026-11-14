const { isTicketAuthorized } = require("./openai_agent");
const { executeTool } = require("./tools");

async function runTest() {
  const user = {
    id: "alice",
    token: "alice-test-token",
    accessibleTicketIds: ["T-101"]
  };

  // Simulate the LLM selecting this tool call.
  const simulatedToolCall = {
    name: "get_ticket",
    arguments: {
      ticketId: "T-202"
    }
  };

  console.log("\nAgentGuard Integration Test");
  console.log("---------------------------");
  console.log("User:", user.id);
  console.log("Selected tool:", simulatedToolCall.name);
  console.log("Requested ticket:", simulatedToolCall.arguments.ticketId);

  const authorized = isTicketAuthorized(
    simulatedToolCall.arguments.ticketId,
    user.accessibleTicketIds
  );

  if (!authorized) {
    console.log("\nAGENTGUARD: BLOCKED");
    console.log("Reason: Ticket is outside the user's allowed list.");
    console.log("API execution: NOT ATTEMPTED");

    console.log("\nRESULT: PASS - Unauthorized tool call blocked.");
    return;
  }

  const result = await executeTool({
    name: simulatedToolCall.name,
    args: simulatedToolCall.arguments,
    token: user.token
  });

  console.log("\nAPI result:", result);
  console.log("\nRESULT: FAIL - Unauthorized call was not blocked.");
}

runTest().catch(error => {
  console.error("Test error:", error);
});