
const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");

test("vulnerable mode reproduces cross-user ticket disclosure", async () => {
  const app = createApp({ mode: "vulnerable" });

  const response = await request(app)
    .get("/tickets/T-202")
    .set("Authorization", "Bearer alice-test-token");

  assert.equal(response.status, 200);
  assert.equal(response.body.id, "T-202");

  // Prove that Alice actually received Bob's private ticket title.
  assert.equal(
    response.body.title,
    "Bob's confidential support issue"
  );
});

test("protected mode blocks Alice from reading Bob's ticket", async () => {
  const app = createApp({ mode: "protected" });

  const response = await request(app)
    .get("/tickets/T-202")
    .set("Authorization", "Bearer alice-test-token");

  assert.equal(response.status, 403);
  assert.equal(response.body.error, "Access denied");

  // The protected response must not disclose Bob's ticket.
  assert.equal(response.body.title, undefined);
});

test("protected mode allows Alice to read her own ticket", async () => {
  const app = createApp({ mode: "protected" });

  const response = await request(app)
    .get("/tickets/T-101")
    .set("Authorization", "Bearer alice-test-token");

  assert.equal(response.status, 200);
  assert.equal(response.body.id, "T-101");
  assert.equal(response.body.title, "Alice's laptop issue");
});

test("requests without valid authentication are rejected", async () => {
  const app = createApp({ mode: "protected" });

  const response = await request(app).get("/tickets/T-101");

  assert.equal(response.status, 401);
});


test("Bob can read his own ticket in protected mode", async () => {
  const app = createApp({ mode: "protected" });

  const response = await request(app)
    .get("/tickets/T-202")
    .set("Authorization", "Bearer bob-test-token");

  assert.equal(response.status, 200);
  assert.equal(response.body.id, "T-202");
  assert.equal(response.body.title, "Bob's confidential support issue");
});

test("Alice cannot read Bob's ticket even if she supplies Bob's ID in a query parameter", async () => {
  const app = createApp({ mode: "protected" });

  const response = await request(app)
    .get("/tickets/T-202?userId=bob")
    .set("Authorization", "Bearer alice-test-token");

  assert.equal(response.status, 403);
  assert.equal(response.body.error, "Access denied");
});

test("unknown ticket IDs do not disclose another ticket", async () => {
  const app = createApp({ mode: "protected" });

  const response = await request(app)
    .get("/tickets/T-999")
    .set("Authorization", "Bearer alice-test-token");

  assert.equal(response.status, 404);
  assert.equal(response.body.error, "Ticket not found");
});

test("invalid bearer tokens are rejected", async () => {
  const app = createApp({ mode: "protected" });

  const response = await request(app)
    .get("/tickets/T-101")
    .set("Authorization", "Bearer invalid-test-token");

  assert.equal(response.status, 401);
  assert.equal(response.body.error, "Authentication required");
});

test("Alice cannot access Bob's ticket by changing letter case in its ID", async () => {
  const app = createApp({ mode: "protected" });

  const response = await request(app)
    .get("/tickets/t-202")
    .set("Authorization", "Bearer alice-test-token");

  assert.equal(response.status, 404);
  assert.equal(response.body.error, "Ticket not found");
});

test("Alice can update her own ticket in protected mode", async () => {
  const app = createApp({ mode: "protected" });

  const response = await request(app)
    .patch("/tickets/T-101")
    .set("Authorization", "Bearer alice-test-token")
    .send({ title: "Updated laptop issue" });

  assert.equal(response.status, 200);
  assert.equal(response.body.title, "Updated laptop issue");
});

test("Alice cannot update Bob's ticket in protected mode", async () => {
  const app = createApp({ mode: "protected" });

  const response = await request(app)
    .patch("/tickets/T-202")
    .set("Authorization", "Bearer alice-test-token")
    .send({ title: "Unauthorized change" });

  assert.equal(response.status, 403);
  assert.equal(response.body.error, "Access denied");
});

test("Alice cannot delete Bob's ticket in protected mode", async () => {
  const app = createApp({ mode: "protected" });

  const response = await request(app)
    .delete("/tickets/T-202")
    .set("Authorization", "Bearer alice-test-token");

  assert.equal(response.status, 403);
  assert.equal(response.body.error, "Access denied");

  // Verify Bob's ticket still exists.
  const followUp = await request(app)
    .get("/tickets/T-202")
    .set("Authorization", "Bearer bob-test-token");

  assert.equal(followUp.status, 200);
});

test("vulnerable mode reproduces unauthorized ticket deletion", async () => {
  const app = createApp({ mode: "vulnerable" });

  const response = await request(app)
    .delete("/tickets/T-202")
    .set("Authorization", "Bearer alice-test-token");

  assert.equal(response.status, 204);

  // Verify the deletion actually happened.
  const followUp = await request(app)
    .get("/tickets/T-202")
    .set("Authorization", "Bearer bob-test-token");

  assert.equal(followUp.status, 404);
});
