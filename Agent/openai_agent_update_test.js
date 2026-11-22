const { runAgent } = require("./openai_agent");

async function main() {
  console.log("\nAgentGuard Real LLM Update Test");
  console.log("===============================");

  try {
    const result = await runAgent({
      message: "Update the title of my ticket T-101 to 'Updated through AgentGuard real LLM test'.",
      token: "alice-test-token"
    });

    const passed =
      result.toolName === "update_ticket" &&
      result.toolResult?.status === 200 &&
      result.toolCalls.length >= 1 &&
      result.toolCalls.every(
        call =>
          call.toolName === "update_ticket" &&
          call.toolArguments.ticketId === "T-101" &&
          call.blockedByPolicy === false &&
          call.toolResult?.status === 200
      );

    console.log("Expected tool: update_ticket");
    console.log("Selected tool:", result.toolName);
    console.log("HTTP status:", result.toolResult?.status);
    console.log("Total tool calls:", result.toolCalls.length);
    console.log("Agent response:", result.agentResponse);

    if (!passed) {
      throw new Error("Real LLM update test failed.");
    }

    console.log("\nPASS - Authorized update completed successfully.");
  } catch (error) {
    console.error("\nFAIL:", error.message);
    process.exitCode = 1;
  }
}

main();