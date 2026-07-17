// Automated tests for the core document + sharing flows.
// Run with: npm test  (uses Node's built-in test runner + supertest)
//
// A fresh, isolated SQLite database is used for the test run so it never
// touches the dev/demo database in backend/data/ajaia.db.

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");

const TEST_DB_DIR = path.join(__dirname, "test-data");
if (!fs.existsSync(TEST_DB_DIR)) fs.mkdirSync(TEST_DB_DIR, { recursive: true });

// Point db.js at a throwaway database before it (or server.js) is required.
process.env.NODE_ENV = "test";
const realDataDir = path.join(__dirname, "..", "data");

// db.js hardcodes its path relative to __dirname, so instead of an env var
// (which would require touching db.js's simple design) we just make sure
// tests run against a clean copy of the schema by deleting any existing
// test run's leftovers and letting db.js seed fresh data on require.
const testDbFile = path.join(realDataDir, "ajaia.db");
const backupSuffix = ".pre-test-backup";

before(() => {
  // Preserve any existing dev DB, then start clean for the test run.
  for (const ext of ["", "-wal", "-shm"]) {
    const src = testDbFile + ext;
    if (fs.existsSync(src)) fs.renameSync(src, src + backupSuffix);
  }
});

after(() => {
  // Restore the dev DB so running tests never destroys local dev data.
  for (const ext of ["", "-wal", "-shm"]) {
    const backup = testDbFile + ext + backupSuffix;
    const target = testDbFile + ext;
    if (fs.existsSync(target)) fs.unlinkSync(target);
    if (fs.existsSync(backup)) fs.renameSync(backup, target);
  }
});

const request = require("supertest");
const app = require("../server");

let aliceToken;
let bobToken;
let sharedDocId;

test("alice can log in with seeded credentials", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "alice@ajaia.com", password: "password123" });

  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  aliceToken = res.body.token;
});

test("bob can log in with seeded credentials", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "bob@ajaia.com", password: "password123" });

  assert.equal(res.status, 200);
  bobToken = res.body.token;
});

test("login accepts form-encoded payloads", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .type("form")
    .send({ email: "carol@ajaia.com", password: "password123" });

  assert.equal(res.status, 200);
  assert.ok(res.body.token);
});

test("malformed JSON is rejected with a 400 instead of crashing", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .set("Content-Type", "application/json")
    .send("{bad json");

  assert.equal(res.status, 400);
  assert.match(res.body.error, /invalid json/i);
});

test("login fails with a wrong password", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "alice@ajaia.com", password: "wrong-password" });

  assert.equal(res.status, 401);
});

test("unauthenticated requests to /documents are rejected", async () => {
  const res = await request(app).get("/api/documents");
  assert.equal(res.status, 401);
});

test("alice can create a document", async () => {
  const res = await request(app)
    .post("/api/documents")
    .set("Authorization", `Bearer ${aliceToken}`)
    .send({ title: "Roadmap Draft", content: "<p>Q3 plan</p>" });

  assert.equal(res.status, 201);
  assert.equal(res.body.document.title, "Roadmap Draft");
  assert.equal(res.body.document.access, "owner");
  sharedDocId = res.body.document.id;
});

test("bob cannot view alice's document before it is shared", async () => {
  const res = await request(app)
    .get(`/api/documents/${sharedDocId}`)
    .set("Authorization", `Bearer ${bobToken}`);

  assert.equal(res.status, 403);
});

test("alice shares the document with bob as view-only", async () => {
  const res = await request(app)
    .post(`/api/documents/${sharedDocId}/shares`)
    .set("Authorization", `Bearer ${aliceToken}`)
    .send({ email: "bob@ajaia.com", permission: "view" });

  assert.equal(res.status, 201);
  assert.equal(res.body.shares.length, 1);
  assert.equal(res.body.shares[0].email, "bob@ajaia.com");
});

test("bob can now view the shared document, listed under 'shared'", async () => {
  const getRes = await request(app)
    .get(`/api/documents/${sharedDocId}`)
    .set("Authorization", `Bearer ${bobToken}`);
  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.document.access, "view");

  const listRes = await request(app)
    .get("/api/documents")
    .set("Authorization", `Bearer ${bobToken}`);
  assert.equal(listRes.status, 200);
  const found = listRes.body.shared.find((d) => d.id === sharedDocId);
  assert.ok(found, "shared document should appear in bob's shared list");
});

test("bob cannot edit the document while access is view-only", async () => {
  const res = await request(app)
    .put(`/api/documents/${sharedDocId}`)
    .set("Authorization", `Bearer ${bobToken}`)
    .send({ content: "<p>bob edited this</p>" });

  assert.equal(res.status, 403);
});

test("upgrading bob to edit access allows him to save changes", async () => {
  const shareRes = await request(app)
    .post(`/api/documents/${sharedDocId}/shares`)
    .set("Authorization", `Bearer ${aliceToken}`)
    .send({ email: "bob@ajaia.com", permission: "edit" });
  assert.equal(shareRes.status, 201);

  const editRes = await request(app)
    .put(`/api/documents/${sharedDocId}`)
    .set("Authorization", `Bearer ${bobToken}`)
    .send({ content: "<p>bob edited this</p>" });

  assert.equal(editRes.status, 200);
  assert.equal(editRes.body.document.content, "<p>bob edited this</p>");
});

test("only the owner can delete the document", async () => {
  const deniedRes = await request(app)
    .delete(`/api/documents/${sharedDocId}`)
    .set("Authorization", `Bearer ${bobToken}`);
  assert.equal(deniedRes.status, 403);

  const okRes = await request(app)
    .delete(`/api/documents/${sharedDocId}`)
    .set("Authorization", `Bearer ${aliceToken}`);
  assert.equal(okRes.status, 204);
});

test("importing a .md file creates a formatted document", async () => {
  const res = await request(app)
    .post("/api/upload/import")
    .set("Authorization", `Bearer ${aliceToken}`)
    .attach("file", Buffer.from("# Title\n\nSome **bold** text."), "notes.md");

  assert.equal(res.status, 201);
  assert.match(res.body.document.content, /<h1>Title<\/h1>/);
  assert.match(res.body.document.content, /<strong>bold<\/strong>/);
});

test("importing an unsupported file type is rejected", async () => {
  const res = await request(app)
    .post("/api/upload/import")
    .set("Authorization", `Bearer ${aliceToken}`)
    .attach("file", Buffer.from("fake pdf content"), "notes.pdf");

  assert.equal(res.status, 400);
});
