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

> AgentGuard is currently a local security prototype for educational, defensive security testing, and research purposes. It is not a production-ready security product.

### Author
Vishal Kaira
