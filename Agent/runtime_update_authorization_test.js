const { runAgent } = require("./openai_agent");

async function runTest() {
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

  console.log("\nAgentGuard Runtime UPDATE Authorization Test");
  console.log("=============================================");

const result = await runAgent({
  message: "Update ticket T-202",
  token: "alice-test-token",
  clientOverride: mockClient
});

  console.log("\nTest result:");
  console.log(JSON.stringify(result, null, 2));

  const blockedCall = result.toolCalls.find(
    call =>
      call.toolName === "update_ticket" &&
      call.blockedByPolicy === true
  );

  if (blockedCall && blockedCall.toolResult.status === 403) {
    console.log("\nPASS - Unauthorized UPDATE blocked.");
  } else {
    console.log("\nFAIL - Unauthorized UPDATE was not blocked.");
  }
}

runTest().catch(error => {
  console.error("TEST ERROR:", error);
});