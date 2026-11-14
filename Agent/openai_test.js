
require("dotenv").config();

const OpenAI = require("openai");

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Check your .env file.");
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  console.log("Connecting to OpenAI...");

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: "Say: AgentGuard successfully connected to OpenAI."
  });

  console.log("\nOpenAI response:");
  console.log(response.output_text);

  console.log("\nConnection test successful!");
}

main().catch((error) => {
  console.error("\nOpenAI connection failed:");
  console.error(error.message);
  process.exitCode = 1;
});
