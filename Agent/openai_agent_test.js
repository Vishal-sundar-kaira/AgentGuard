const { runAgent } = require("./openai_agent");

async function main() {
  console.log("\nAgentGuard Real LLM Read Test");
  console.log("=============================");

  try {
    const result = await runAgent({
      message: "Can you check the details of ticket T-101?",
      token: "alice-test-token"
    });

    const passed =
      result.toolName === "get_ticket" &&
      result.toolResult?.status === 200 &&
      result.toolCalls.length >= 1 &&
      result.toolCalls.every(
        call =>
          call.toolName === "get_ticket" &&
          call.toolArguments.ticketId === "T-101" &&
          call.blockedByPolicy === false
      );

    console.log("Expected tool: get_ticket");
    console.log("Selected tool:", result.toolName);
    console.log("HTTP status:", result.toolResult?.status);
    console.log("Total tool calls:", result.toolCalls.length);
    console.log("Agent response:", result.agentResponse);

    if (!passed) {
      throw new Error("Real LLM read test failed.");
    }

    console.log("\nPASS - Authorized read completed successfully.");
  } catch (error) {
    console.error("\nFAIL:", error.message);
    process.exitCode = 1;
  }
}

main();