const { isTicketAuthorized } = require("./openai_agent");

const userId = "alice";
const accessibleTicketIds = ["T-101"];

const testCases = [
  {
    name: "Alice accesses her own ticket",
    ticketId: "T-101",
    expected: true
  },
  {
    name: "Alice attempts to access Bob's ticket",
    ticketId: "T-202",
    expected: false
  },
  {
    name: "Alice attempts to access a nonexistent ticket",
    ticketId: "T-999",
    expected: false
  }
];

console.log("\nAgentGuard Authorization Gate Tests\n");

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const actual = isTicketAuthorized(
    test.ticketId,
    accessibleTicketIds
  );

  if (actual === test.expected) {
    console.log(`PASS: ${test.name}`);
    passed++;
  } else {
    console.log(`FAIL: ${test.name}`);
    failed++;
  }
}

console.log("\n========== SUMMARY ==========");
console.log("Passed:", passed);
console.log("Failed:", failed);