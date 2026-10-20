
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
