# AgentGuard 🛡️

**Runtime Authorization & Security Testing for AI Agents**

AgentGuard is a security testing project exploring authorization vulnerabilities in AI agents interacting with APIs and tools. It demonstrates how direct attacks and indirect prompt injection can manipulate agents into attempting unauthorized actions, and how runtime authorization enforcement can block those actions independently of the LLM's decisions.

### Features
- Vulnerable and protected API environments
- AI agent with tool-calling capabilities
- Runtime authorization enforcement
- Object-level access control
- Read, update, and delete authorization testing
- Direct unauthorized access and indirect prompt injection scenarios
- Automated API, runtime, and integration tests

### Security Scenarios
- **BOLA:** Unauthorized cross-user resource access
- **Indirect Prompt Injection:** Malicious instructions embedded in retrieved data
- **Unauthorized Read:** Attempt to retrieve another user's resource
- **Unauthorized Update:** Attempt to modify another user's resource
- **Unauthorized Delete:** Attempt to delete another user's resource

### Tech Stack
Node.js · Express · JavaScript · OpenAI API · REST APIs · Supertest


### Security Evaluation: Vulnerable vs. Protected Mode

AgentGuard evaluates authorization enforcement by comparing vulnerable and protected API/agent behavior across unauthorized access scenarios.

| Scenario | Vulnerable Mode | Protected Mode |
|---|---|---|
| Cross-user ticket read | Unauthorized access succeeds (200) | Blocked (403) |
| Cross-user ticket update | Unauthorized modification succeeds (200) | Blocked (403) |
| Cross-user ticket deletion | Unauthorized deletion succeeds (204) | Blocked (403) |
| Indirect prompt injection | Unauthorized tool actions can be attempted | Runtime authorization blocks unauthorized actions |
| Authorized owner access | Allowed | Allowed |

### Test Coverage

**29 automated tests passed (0 failures)** across API authorization, runtime enforcement, and agent integration testing.

- Validates owner-based resource access
- Reproduces cross-user authorization failures in vulnerable mode
- Verifies runtime blocking of unauthorized tool calls
- Tests malicious instructions embedded in retrieved ticket data
- Confirms unauthorized read, update, and delete attempts are blocked in protected scenarios
- Ensures legitimate authorized operations continue to work

The results demonstrate the importance of enforcing authorization at the tool execution layer rather than relying solely on the AI agent's instructions or decision-making.

### Test Results
| Metric | Result |
|---|---:|
| Total tests | 29 |
| Passed | 29 |
| Failed | 0 |

Run tests:

```bash
npm install
npm test
```

> AgentGuard is a local security testing prototype for defensive security experimentation. It is not a production-ready security product.

> AgentGuard is currently a local security prototype for educational, defensive security testing, and research purposes. It is not a production-ready security product.

### Author
Vishal Kaira
