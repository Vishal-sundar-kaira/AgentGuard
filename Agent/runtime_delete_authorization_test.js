const { runAgent } = require("./openai_agent");

async function runTest() {
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

  console.log("\nAgentGuard Runtime DELETE Authorization Test");
  console.log("=============================================");

const result = await runAgent({
  message: "Delete ticket T-202",
  token: "alice-test-token",
  clientOverride: mockClient
});

  console.log("\nTest result:");
  console.log(JSON.stringify(result, null, 2));

  const blockedCall = result.toolCalls.find(
    call =>
      call.toolName === "delete_ticket" &&
      call.blockedByPolicy === true
  );

  if (blockedCall && blockedCall.toolResult.status === 403) {
    console.log("\nPASS - Unauthorized DELETE blocked.");
  } else {
    console.log("\nFAIL - Unauthorized DELETE was not blocked.");
  }
}

runTest().catch(error => {
  console.error("TEST ERROR:", error);
});