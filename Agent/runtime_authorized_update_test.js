const { runAgent } = require("./openai_agent");

async function runTest() {
  let callCount = 0;

  const mockClient = {
    responses: {
      create: async () => {
        callCount++;

        if (callCount === 1) {
          return {
            id: "authorized-update-response",
            output: [
              {
                type: "function_call",
                name: "update_ticket",
                call_id: "authorized-update-call",
                arguments: JSON.stringify({
                  ticketId: "T-101",
                  title: "AgentGuard Authorized Update Test"
                })
              }
            ],
            output_text: ""
          };
        }

        return {
          id: "authorized-update-complete",
          output: [],
          output_text: "Update completed."
        };
      }
    }
  };

  console.log("\nAuthorized UPDATE Test");
  console.log("======================");

const result = await runAgent({
  message: "Update ticket T-202",
  token: "alice-test-token",
  clientOverride: mockClient
});

  console.log("\nResult:");
  console.log(JSON.stringify(result, null, 2));

  const successfulUpdate = result.toolCalls.some(
    call =>
      call.toolName === "update_ticket" &&
      call.blockedByPolicy === false &&
      call.toolResult.status === 200
  );

  console.log(
    successfulUpdate
      ? "\nPASS - Authorized UPDATE executed."
      : "\nFAIL - Authorized UPDATE did not execute."
  );
}

runTest().catch(console.error);