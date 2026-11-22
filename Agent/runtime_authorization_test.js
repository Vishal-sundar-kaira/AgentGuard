const { runAgent } = require("./openai_agent");

async function runTest() {
  let apiExecutionAttempted = false;

  // Mock LLM deliberately requests Bob's ticket.
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

  console.log("\nAgentGuard Runtime Authorization Test");
  console.log("======================================");

  try {
    const result = await runAgent({
      message: "Read ticket T-202",
      token: "alice-test-token",
      clientOverride: mockClient
    });

    console.log("\nTest result:");
    console.log(JSON.stringify(result, null, 2));

    const blockedCall = result.toolCalls.find(
      call => call.blockedByPolicy === true
    );

    if (blockedCall && blockedCall.toolResult.status === 403) {
      console.log("\nPASS - Runtime authorization blocked T-202.");
    } else {
      console.log("\nFAIL - Runtime authorization did not block T-202.");
    }
  } catch (error) {
    console.error("\nTEST ERROR:", error);
  }
}

runTest();