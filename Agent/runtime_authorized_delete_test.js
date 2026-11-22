
const { runAgent } = require("./openai_agent");

async function runTest() {
  let callCount = 0;

  const mockClient = {
    responses: {
      create: async () => {
        callCount++;

        if (callCount === 1) {
          return {
            id: "authorized-delete-response",
            output: [
              {
                type: "function_call",
                name: "delete_ticket",
                call_id: "authorized-delete-call",
                arguments: JSON.stringify({
                  ticketId: "T-101"
                })
              }
            ],
            output_text: ""
          };
        }

        return {
          id: "authorized-delete-complete",
          output: [],
          output_text: "Delete completed."
        };
      }
    }
  };

  console.log("\nAuthorized DELETE Test");
  console.log("======================");

  const result = await runAgent({
  message: "Delete my ticket T-101",
  token: "alice-test-token",
  clientOverride: mockClient
});

  console.log("\nResult:");
  console.log(JSON.stringify(result, null, 2));

  const successfulDelete = result.toolCalls.some(
    call =>
      call.toolName === "delete_ticket" &&
      call.blockedByPolicy === false &&
      call.toolResult.status === 204
  );

  console.log(
    successfulDelete
      ? "\nPASS - Authorized DELETE executed."
      : "\nFAIL - Authorized DELETE did not execute."
  );
}

runTest().catch(console.error);
