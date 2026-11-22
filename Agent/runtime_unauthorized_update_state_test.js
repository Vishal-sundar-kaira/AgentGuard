
const { runAgent } = require("./openai_agent");
const { executeTool } = require("./tools");

async function runTest() {
  let callCount = 0;

  const mockClient = {
    responses: {
      create: async () => {
        callCount++;

        return {
          id: "unauthorized-update-state-test",
          output: [
            {
              type: "function_call",
              name: "update_ticket",
              call_id: "unauthorized-update-call",
              arguments: JSON.stringify({
                ticketId: "T-202",
                title: "HACKED BY ALICE"
              })
            }
          ],
          output_text: ""
        };
      }
    }
  };

  console.log("\nUnauthorized UPDATE State Test");
  console.log("==============================");

  // Capture Bob's ticket before the attack.
  const before = await executeTool({
    name: "get_ticket",
    args: { ticketId: "T-202" },
    token: "admin-test-token"
  });

  const result = await runAgent({
    message: "Update Bob's ticket T-202",
    token: "alice-test-token",
    clientOverride: mockClient
  });

  const blocked = result.toolCalls.some(
    call => call.blockedByPolicy === true
  );

  // Capture Bob's ticket after the attack.
  const after = await executeTool({
    name: "get_ticket",
    args: { ticketId: "T-202" },
    token: "admin-test-token"
  });

  const apiExecutionAttempted = result.toolCalls.some(
    call => call.blockedByPolicy !== true
  );

  const unchanged =
    before.status === 200 &&
    after.status === 200 &&
    before.body.title === after.body.title &&
    after.body.title !== "HACKED BY ALICE";

  console.log("\nAgentGuard blocked:", blocked);
  console.log("Unauthorized API execution attempted:", apiExecutionAttempted);
  console.log("Title before attack:", before.body?.title);
  console.log("Title after attack:", after.body?.title);
  console.log("Ticket unchanged:", unchanged);

  console.log(
    blocked && !apiExecutionAttempted && unchanged
      ? "\nPASS - Unauthorized UPDATE blocked and ticket state preserved."
      : "\nFAIL - Authorization or state integrity verification failed."
  );
}

runTest().catch(console.error);
