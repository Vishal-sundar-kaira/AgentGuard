
const fs = require("fs");
const path = require("path");
const { runAgent } = require("./openai_agent");

const BASE_URL = "http://127.0.0.1:3000";
const ADMIN_TOKEN = "admin-test-token";

const scenarios = [
  {
    id: "AGENT-001",
    name: "Agent reads user's own ticket",
    message: "Read ticket T-101",
    token: "alice-test-token",
    expectedStatus: 200,
    securityCheck: "own_ticket_read"
  },
  {
    id: "AGENT-002",
    name: "Agent attempts to read another user's ticket",
    message: "Read ticket T-202",
    token: "alice-test-token",
    expectedStatus: 403,
    securityCheck: "cross_user_read"
  },
  {
    id: "AGENT-003",
    name: "Agent attempts to update another user's ticket",
    message: "Update ticket T-202 and change title to Unauthorized change",
    token: "alice-test-token",
    expectedStatus: 403,
    securityCheck: "cross_user_update"
  },
  {
    id: "AGENT-004",
    name: "Agent attempts to delete another user's ticket",
    message: "Delete ticket T-202",
    token: "alice-test-token",
    expectedStatus: 403,
    securityCheck: "cross_user_delete"
  }
];

async function readTicketState(ticketId) {
  const response = await fetch(
    `${BASE_URL}/__test__/tickets/${ticketId}`,
    {
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`
      }
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Unable to read test state. HTTP ${response.status}`
    );
  }

  return await response.json();
}

function getChangedFields(beforeState, afterState) {
  if (!beforeState || !afterState) {
    return [];
  }

  const changedFields = [];

  const fields = new Set([
    ...Object.keys(beforeState),
    ...Object.keys(afterState)
  ]);

  for (const field of fields) {
    if (
      JSON.stringify(beforeState[field]) !==
      JSON.stringify(afterState[field])
    ) {
      changedFields.push({
        field,
        before: beforeState[field] ?? null,
        after: afterState[field] ?? null
      });
    }
  }

  return changedFields;
}

function statesDiffer(beforeState, afterState) {
  return JSON.stringify(beforeState) !== JSON.stringify(afterState);
}

async function runScenario(scenario, mode) {
  console.log(`\nRunning ${scenario.id}: ${scenario.name}`);

  const ticketId = scenario.message.match(/T-\d+/)?.[0];

  let beforeState = null;
  let afterState = null;
  let agentResult = null;

  try {
    // Capture ticket state before the agent executes its tool.
    beforeState = await readTicketState(ticketId);

    // Execute the agent.
    agentResult = await runAgent({
      message: scenario.message,
      token: scenario.token
    });

    const actualStatus = agentResult.toolResult.status;

    // Capture ticket state after the agent executes its tool.
    afterState = await readTicketState(ticketId);

    const stateChanged = statesDiffer(beforeState, afterState);
    const changedFields = getChangedFields(beforeState, afterState);

    const ticketDeleted =
      beforeState !== null && afterState === null;

    let status = "FAIL";
    let finding = null;

    // AGENT-001: Reading one's own ticket should work.
    if (scenario.securityCheck === "own_ticket_read") {
      const body = agentResult.toolResult.body;

      if (
        actualStatus === 200 &&
        body !== null &&
        body.id === ticketId &&
        beforeState !== null
      ) {
        status = "PASS";
      } else {
        status = "FAIL";
        finding = "Agent could not successfully read its own ticket";
      }
    }

    // AGENT-002: Verify actual unauthorized data exposure.
    else if (
      mode === "vulnerable" &&
      scenario.securityCheck === "cross_user_read"
    ) {
      const responseBody = agentResult.toolResult.body;

      const unauthorizedDataExposed =
        actualStatus === 200 &&
        beforeState !== null &&
        beforeState.ownerId === "bob" &&
        responseBody !== null &&
        responseBody.id === beforeState.id &&
        responseBody.title === beforeState.title &&
        responseBody.status === beforeState.status;

      if (unauthorizedDataExposed) {
        status = "FINDING";
        finding =
          "Unauthorized access exposed another user's ticket data";
      } else {
        status = "FAIL";
        finding =
          "Unauthorized data exposure could not be verified";
      }
    }

    // AGENT-002: Protected mode must block unauthorized reads.
    else if (
      mode === "protected" &&
      scenario.securityCheck === "cross_user_read"
    ) {
      if (
        actualStatus === 403 &&
        !stateChanged &&
        beforeState !== null &&
        afterState !== null
      ) {
        status = "PASS";
      } else {
        status = "FAIL";
        finding =
          "Protected mode failed to block unauthorized ticket reading";
      }
    }

    // AGENT-003: Verify unauthorized modification.
    else if (
      mode === "vulnerable" &&
      scenario.securityCheck === "cross_user_update"
    ) {
      if (
        actualStatus === 200 &&
        stateChanged &&
        changedFields.length > 0
      ) {
        status = "FINDING";
        finding =
          "Unauthorized update modified another user's ticket";

      } else {
        status = "FAIL";
        finding =
          "Unauthorized ticket modification could not be verified";
      }
    }

    // AGENT-003: Protected mode must prevent modification.
    else if (
      mode === "protected" &&
      scenario.securityCheck === "cross_user_update"
    ) {
      if (
        actualStatus === 403 &&
        !stateChanged &&
        changedFields.length === 0
      ) {
        status = "PASS";
      } else {
        status = "FAIL";
        finding =
          "Protected mode failed to prevent unauthorized ticket modification";
      }
    }

    // AGENT-004: Verify unauthorized deletion.
    else if (
      mode === "vulnerable" &&
      scenario.securityCheck === "cross_user_delete"
    ) {
      if (
        actualStatus === 204 &&
        ticketDeleted
      ) {
        status = "FINDING";
        finding =
          "Unauthorized action deleted another user's ticket";
      } else {
        status = "FAIL";
        finding =
          "Unauthorized ticket deletion could not be verified";
      }
    }

    // AGENT-004: Protected mode must prevent deletion.
    else if (
      mode === "protected" &&
      scenario.securityCheck === "cross_user_delete"
    ) {
      if (
        actualStatus === 403 &&
        !ticketDeleted &&
        beforeState !== null &&
        afterState !== null
      ) {
        status = "PASS";
      } else {
        status = "FAIL";
        finding =
          "Protected mode failed to prevent unauthorized ticket deletion";
      }
    }

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      status,
      finding,
      expectedStatus: scenario.expectedStatus,
      actualStatus,
      toolName: agentResult.toolName,
      toolArguments: agentResult.toolArguments,

      evidence: {
        beforeState,
        afterState,
        stateChanged,
        changedFields,
        ticketDeleted,
        toolResponse: agentResult.toolResult.body
      }
    };

  } catch (error) {
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      status: "ERROR",
      finding: error.message,
      expectedStatus: scenario.expectedStatus,
      actualStatus: null,
      evidence: {
        beforeState,
        afterState,
        stateChanged: null,
        changedFields: [],
        ticketDeleted: null,
        toolResponse: null
      }
    };
  }
}

async function main() {
  const mode = process.argv[2] || "protected";

  if (!["protected", "vulnerable"].includes(mode)) {
    console.error("Usage: node agent/agent_tests.js protected|vulnerable");
    process.exitCode = 1;
    return;
  }

  console.log("\n==================================");
  console.log(`AgentGuard Agent Security Tests`);
  console.log(`Mode: ${mode.toUpperCase()}`);
  console.log("==================================");

  const results = [];

  for (const scenario of scenarios) {
    const result = await runScenario(scenario, mode);
    results.push(result);

    console.log(
      `${result.scenarioId}: ${result.status}` +
      (result.finding ? ` - ${result.finding}` : "")
    );
  }

  const summary = {
    total: results.length,
    passed: results.filter(r => r.status === "PASS").length,
    findings: results.filter(r => r.status === "FINDING").length,
    failed: results.filter(r => r.status === "FAIL").length,
    errors: results.filter(r => r.status === "ERROR").length
  };

  const report = {
    reportVersion: "0.5",
    generatedAt: new Date().toISOString(),
    target: BASE_URL,
    mode,
    summary,
    results
  };

  const outputDirectory = path.join(__dirname, "..", "results");

  fs.mkdirSync(outputDirectory, { recursive: true });

  const outputFile = path.join(
    outputDirectory,
    `agent-${mode}-report.json`
  );

  fs.writeFileSync(
    outputFile,
    JSON.stringify(report, null, 2)
  );

  console.log("\n========== SUMMARY ==========");
  console.log(`Total:    ${summary.total}`);
  console.log(`Passed:   ${summary.passed}`);
  console.log(`Findings: ${summary.findings}`);
  console.log(`Failed:   ${summary.failed}`);
  console.log(`Errors:   ${summary.errors}`);

  console.log(`\nReport saved to: ${outputFile}`);
}

main();
