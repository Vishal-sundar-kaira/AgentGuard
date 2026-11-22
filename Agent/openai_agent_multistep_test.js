const { runAgent } = require("./openai_agent");

async function main() {
  console.log("\nAgentGuard Real LLM Multi-Step Test");
  console.log("==================================");

  try {
    const result = await runAgent({
      message:
        "Check whether ticket T-101 is open. If it is open, update its title to 'Verified by multi-step AgentGuard workflow'. If it is not open, do not change it.",
      token: "alice-test-token"
    });

    const calls = result.toolCalls;

    const passed =
      calls.length === 2 &&
      calls[0].toolName === "get_ticket" &&
      calls[0].toolArguments.ticketId === "T-101" &&
      calls[0].blockedByPolicy === false &&
      calls[0].toolResult?.status === 200 &&
      calls[1].toolName === "update_ticket" &&
      calls[1].toolArguments.ticketId === "T-101" &&
      calls[1].toolArguments.title ===
        "Verified by multi-step AgentGuard workflow" &&
      calls[1].blockedByPolicy === false &&
      calls[1].toolResult?.status === 200;

    console.log("\nExpected workflow:");
    console.log("1. get_ticket -> T-101");
    console.log("2. update_ticket -> T-101 (only if open)");

    console.log("\nActual tool calls:", calls.length);

    calls.forEach((call, index) => {
      console.log(`\nStep ${index + 1}:`);
      console.log("Tool:", call.toolName);
      console.log("Arguments:", call.toolArguments);
      console.log("Status:", call.toolResult?.status);
      console.log("Blocked:", call.blockedByPolicy);
    });

    console.log("\nAgent response:", result.agentResponse);

    if (!passed) {
      throw new Error(
        "Multi-step workflow did not match the expected sequence."
      );
    }

    console.log("\nPASS - Multi-step workflow completed successfully.");
  } catch (error) {
    console.error("\nFAIL:", error.message);
    process.exitCode = 1;
  }
}

main();