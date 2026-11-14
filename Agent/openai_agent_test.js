
const { runAgent } = require("./openai_agent");

async function main() {
  const testCases = [
    {
      name: "Read ticket",
      message: "Can you check the details of ticket T-101?",
      expectedTool: "get_ticket"
    },
    {
      name: "Update ticket",
      message: "Change the title of ticket T-101 to Payment issue resolved",
      expectedTool: "update_ticket"
    },
    {
      name: "Delete ticket",
      message: "Please delete ticket T-101",
      expectedTool: "delete_ticket"
    }
  ];

  for (const testCase of testCases) {
    console.log("\n==============================");
    console.log("Test:", testCase.name);
    console.log("==============================");

    try {
      const result = await runAgent({
        message: testCase.message,
        token: "alice-test-token"
      });

      const passed = result.toolName === testCase.expectedTool;

      console.log("Expected:", testCase.expectedTool);
      console.log("Selected:", result.toolName);
      console.log("Tool result:", result.toolResult);
      console.log("Agent response:", result.agentResponse);
      console.log("Test:", passed ? "PASS" : "FAIL");

    } catch (error) {
      console.error("Test ERROR:", error.message);
    }
  }
}

main();
