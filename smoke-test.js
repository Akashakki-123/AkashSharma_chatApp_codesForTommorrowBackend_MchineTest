const BASE_URL = (process.env.BASE_URL || "http://localhost:8000").replace(/\/$/, "");

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
};

async function request(path, options = {}) {
  const { method = "GET", body, token } = options;
  const headers = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const start = performance.now();
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const latencyMs = (performance.now() - start).toFixed(1);

  const rawText = await response.text();
  let json = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    json = { raw: rawText };
  }

  return {
    status: response.status,
    latencyMs,
    json,
  };
}

async function runTest(name, fn) {
  stats.total += 1;
  const start = performance.now();

  try {
    const result = await fn();
    const status = result?.status ?? "-";
    const latency = result?.latencyMs ?? (performance.now() - start).toFixed(1);
    stats.passed += 1;
    console.log(
      `${COLORS.green}✓ [PASS]${COLORS.reset} ${name} ${COLORS.dim}(status: ${status}, ${latency}ms)${COLORS.reset}`
    );
    return result;
  } catch (error) {
    const latency = (performance.now() - start).toFixed(1);
    stats.failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.log(
      `${COLORS.red}✗ [FAIL]${COLORS.reset} ${name} ${COLORS.dim}(${latency}ms)${COLORS.reset}`
    );
    console.log(`         ${COLORS.red}↳ ${message}${COLORS.reset}`);
    return null;
  }
}

function assertStatus(res, expectedStatus, label = "") {
  if (res.status !== expectedStatus) {
    const serverMsg = res.json?.message ? ` | message: "${res.json.message}"` : "";
    throw new Error(
      `${label ? `${label}: ` : ""}Expected HTTP ${expectedStatus}, got ${res.status}${serverMsg}`
    );
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  console.log(
    `\n${COLORS.bold}${COLORS.cyan}Running End-to-End Smoke Tests against ${BASE_URL}${COLORS.reset}\n`
  );

  const runId = Date.now();
  const userAPayload = {
    fullName: "Alice Smoke",
    email: `alice.smoke.${runId}@example.com`,
    phone: "+919000000001",
    password: "Password@123",
  };
  const userBPayload = {
    fullName: "Bob Smoke",
    email: `bob.smoke.${runId}@example.com`,
    phone: "+919000000002",
    password: "Password@123",
  };
  const userCPayload = {
    fullName: "Charlie Smoke",
    email: `charlie.smoke.${runId}@example.com`,
    phone: "+919000000003",
    password: "Password@123",
  };

  let tokenA = "";
  let userAId = "";
  let tokenB = "";
  let userBId = "";
  let tokenC = "";
  let userCId = "";
  let chatId = "";
  let messageId = "";
  let messageId2 = "";
  let groupChatId = "";

  // 1. Public & Unauthenticated Guard Checks
  await runTest("GET /v1/health returns 200 OK (DB up)", async () => {
    const res = await request("/v1/health");
    assertStatus(res, 200);
    assert(res.json?.status === true, "Expected status: true");
    return res;
  });

  await runTest("GET /unknown-route returns 404 Not Found", async () => {
    const res = await request(`/unknown-route-${runId}`);
    assertStatus(res, 404);
    return res;
  });

  await runTest("GET /users without JWT returns 401 Unauthorized", async () => {
    const res = await request("/users");
    assertStatus(res, 401);
    return res;
  });

  await runTest("POST /chat/create without JWT returns 401 Unauthorized", async () => {
    const res = await request("/chat/create", { method: "POST", body: {} });
    assertStatus(res, 401);
    return res;
  });

  // 2. User Signup & Login (JWT Auth)
  await runTest("POST /auth/signup registers User A (201)", async () => {
    const res = await request("/auth/signup", { method: "POST", body: userAPayload });
    assertStatus(res, 201);
    userAId = res.json?.items?.user?.id || "";
    tokenA = res.json?.items?.token || "";
    assert(userAId && tokenA, "Missing userAId or tokenA in signup response");
    return res;
  });

  await runTest("POST /auth/signup registers User B (201)", async () => {
    const res = await request("/auth/signup", { method: "POST", body: userBPayload });
    assertStatus(res, 201);
    userBId = res.json?.items?.user?.id || "";
    tokenB = res.json?.items?.token || "";
    assert(userBId && tokenB, "Missing userBId or tokenB in signup response");
    return res;
  });

  await runTest("POST /auth/signup registers User C (201)", async () => {
    const res = await request("/auth/signup", { method: "POST", body: userCPayload });
    assertStatus(res, 201);
    userCId = res.json?.items?.user?.id || "";
    tokenC = res.json?.items?.token || "";
    assert(userCId && tokenC, "Missing userCId or tokenC in signup response");
    return res;
  });

  await runTest("POST /auth/login logs in User A and refreshes JWT (200)", async () => {
    const res = await request("/auth/login", {
      method: "POST",
      body: { email: userAPayload.email, password: userAPayload.password },
    });
    assertStatus(res, 200);
    assert(Boolean(res.json?.items?.token), "Expected JWT token on login");
    tokenA = res.json.items.token;
    return res;
  });

  await runTest("POST /auth/login with wrong password returns 401", async () => {
    const res = await request("/auth/login", {
      method: "POST",
      body: { email: userAPayload.email, password: "WrongPassword123" },
    });
    assertStatus(res, 401);
    return res;
  });

  // 3. User CRUD & Ownership Checks
  await runTest("GET /users returns paginated user list (200)", async () => {
    const res = await request("/users?page=1&limit=10", { token: tokenA });
    assertStatus(res, 200);
    assert(Array.isArray(res.json?.items?.users), "Expected users array");
    return res;
  });

  await runTest("GET /users/:id returns User A details without password (200)", async () => {
    const res = await request(`/users/${userAId}`, { token: tokenA });
    assertStatus(res, 200);
    assert(res.json?.items?.id === userAId, "Expected matching user ID");
    assert(res.json?.items?.password === undefined, "Password must not be exposed");
    return res;
  });

  await runTest("PATCH /users/:id updates User A fullName (200)", async () => {
    const res = await request(`/users/${userAId}`, {
      method: "PATCH",
      token: tokenA,
      body: { fullName: "Alice Smoke Updated" },
    });
    assertStatus(res, 200);
    assert(
      res.json?.items?.fullName === "Alice Smoke Updated",
      "Expected updated fullName"
    );
    return res;
  });

  await runTest("PATCH /users/:userBId by User A returns 403 Forbidden", async () => {
    const res = await request(`/users/${userBId}`, {
      method: "PATCH",
      token: tokenA,
      body: { fullName: "Hacked Name" },
    });
    assertStatus(res, 403);
    return res;
  });

  // 4. Core Chat APIs (PostgreSQL + Firestore)
  await runTest("POST /chat/create creates 1:1 chat between User A & User B (201)", async () => {
    const res = await request("/chat/create", {
      method: "POST",
      token: tokenA,
      body: { userAId, userBId },
    });
    assertStatus(res, 201);
    chatId = res.json?.items?.chatId || "";
    assert(Boolean(chatId), "Expected chatId in response");
    assert(res.json?.items?.isNew === true, "Expected isNew: true");
    return res;
  });

  await runTest("POST /chat/create with reversed IDs returns existing chat (200)", async () => {
    const res = await request("/chat/create", {
      method: "POST",
      token: tokenB,
      body: { userAId: userBId, userBId: userAId },
    });
    assertStatus(res, 200);
    assert(res.json?.items?.chatId === chatId, "Expected same chatId for existing 1:1 chat");
    assert(res.json?.items?.isNew === false, "Expected isNew: false");
    return res;
  });

  await runTest("POST /chat/:chatId/message/send stores User A message in Firestore (201)", async () => {
    const res = await request(`/chat/${chatId}/message/send`, {
      method: "POST",
      token: tokenA,
      body: { senderId: userAId, text: "Hello Bob! First message." },
    });
    assertStatus(res, 201);
    messageId = res.json?.items?.id || "";
    assert(Boolean(messageId), "Expected Firestore message ID");
    assert(res.json?.items?.senderId === userAId, "Expected matching senderId");
    return res;
  });

  await runTest("POST /chat/:chatId/message/send stores User B reply in Firestore (201)", async () => {
    const res = await request(`/chat/${chatId}/message/send`, {
      method: "POST",
      token: tokenB,
      body: { senderId: userBId, text: "Hi Alice! Got it." },
    });
    assertStatus(res, 201);
    messageId2 = res.json?.items?.id || "";
    assert(Boolean(messageId2), "Expected second Firestore message ID");
    return res;
  });

  await runTest("POST /chat/:chatId/message/send by non-member User C returns 403", async () => {
    const res = await request(`/chat/${chatId}/message/send`, {
      method: "POST",
      token: tokenC,
      body: { senderId: userCId, text: "Should be blocked" },
    });
    assertStatus(res, 403);
    return res;
  });

  await runTest("POST /chat/:chatId/message/send with spoofed senderId returns 403", async () => {
    const res = await request(`/chat/${chatId}/message/send`, {
      method: "POST",
      token: tokenB,
      body: { senderId: userAId, text: "Spoof attempt" },
    });
    assertStatus(res, 403);
    return res;
  });

  await runTest("GET /chat/:chatId/messages?limit=50 returns ordered messages (200)", async () => {
    const res = await request(`/chat/${chatId}/messages?limit=50`, { token: tokenB });
    assertStatus(res, 200);
    const messages = res.json?.items?.messages;
    assert(Array.isArray(messages) && messages.length >= 2, "Expected at least 2 messages");
    assert(messages[0].id === messageId, "Expected chronological ascending order");
    return res;
  });

  await runTest("GET /chat/:chatId/messages by non-member User C returns 403", async () => {
    const res = await request(`/chat/${chatId}/messages?limit=50`, { token: tokenC });
    assertStatus(res, 403);
    return res;
  });

  await runTest("POST /chat/:chatId/message/:messageId/read marks read receipt (200)", async () => {
    const res = await request(`/chat/${chatId}/message/${messageId}/read`, {
      method: "POST",
      token: tokenB,
      body: { userId: userBId },
    });
    assertStatus(res, 200);
    assert(Boolean(res.json?.items?.readBy?.[userBId]), "Expected readBy[userBId] timestamp");
    return res;
  });

  await runTest("POST /chat/:chatId/lastseen updates User B last seen message (200)", async () => {
    const res = await request(`/chat/${chatId}/lastseen`, {
      method: "POST",
      token: tokenB,
      body: { userId: userBId, messageId: messageId2 || messageId },
    });
    assertStatus(res, 200);
    assert(
      res.json?.items?.messageId === (messageId2 || messageId),
      "Expected updated lastSeen messageId"
    );
    return res;
  });

  await runTest("GET /user/:userId/chats lists User A chats with memberIds (200)", async () => {
    const res = await request(`/user/${userAId}/chats`, { token: tokenA });
    assertStatus(res, 200);
    const chats = res.json?.items?.chats;
    assert(Array.isArray(chats), "Expected chats array");
    const found = chats.find((c) => c.chatId === chatId);
    assert(Boolean(found), "Expected created 1:1 chat in user chat list");
    assert(
      found.memberIds.includes(userAId) && found.memberIds.includes(userBId),
      "Expected both memberIds in chat"
    );
    return res;
  });

  await runTest("GET /user/:userAId/chats by User B returns 403 Forbidden", async () => {
    const res = await request(`/user/${userAId}/chats`, { token: tokenB });
    assertStatus(res, 403);
    return res;
  });

  // 5. Bonus Features: Message Edit/Delete & Group Chat Management
  await runTest("PATCH /chat/:chatId/message/:messageId edits User A message (200)", async () => {
    const res = await request(`/chat/${chatId}/message/${messageId}`, {
      method: "PATCH",
      token: tokenA,
      body: { text: "Hello Bob! Edited message." },
    });
    assertStatus(res, 200);
    assert(res.json?.items?.isEdited === true, "Expected isEdited: true");
    assert(
      res.json?.items?.text === "Hello Bob! Edited message.",
      "Expected edited text"
    );
    return res;
  });

  await runTest("PATCH /chat/:chatId/message/:messageId by non-sender User B returns 403", async () => {
    const res = await request(`/chat/${chatId}/message/${messageId}`, {
      method: "PATCH",
      token: tokenB,
      body: { text: "Unauthorized edit" },
    });
    assertStatus(res, 403);
    return res;
  });

  await runTest("DELETE /chat/:chatId/message/:messageId soft-deletes User A message (200)", async () => {
    const res = await request(`/chat/${chatId}/message/${messageId}`, {
      method: "DELETE",
      token: tokenA,
    });
    assertStatus(res, 200);
    assert(res.json?.items?.isDeleted === true, "Expected isDeleted: true");
    return res;
  });

  await runTest("POST /chat/group creates a Group Chat (201)", async () => {
    const res = await request("/chat/group", {
      method: "POST",
      token: tokenA,
      body: { name: "Smoke Test Group", memberIds: [userBId] },
    });
    assertStatus(res, 201);
    groupChatId = res.json?.items?.chatId || "";
    assert(Boolean(groupChatId), "Expected groupChatId");
    assert(res.json?.items?.isGroup === true, "Expected isGroup: true");
    return res;
  });

  await runTest("POST /chat/:chatId/members adds User C to Group Chat (200)", async () => {
    const res = await request(`/chat/${groupChatId}/members`, {
      method: "POST",
      token: tokenA,
      body: { memberIds: [userCId] },
    });
    assertStatus(res, 200);
    assert(res.json?.items?.memberIds?.includes(userCId), "Expected User C in memberIds");
    return res;
  });

  await runTest("DELETE /chat/:chatId/members/:userBId by non-creator User C returns 403", async () => {
    const res = await request(`/chat/${groupChatId}/members/${userBId}`, {
      method: "DELETE",
      token: tokenC,
    });
    assertStatus(res, 403);
    return res;
  });

  await runTest("DELETE /chat/:chatId/members/:userCId by creator User A succeeds (200)", async () => {
    const res = await request(`/chat/${groupChatId}/members/${userCId}`, {
      method: "DELETE",
      token: tokenA,
    });
    assertStatus(res, 200);
    assert(!res.json?.items?.memberIds?.includes(userCId), "Expected User C removed");
    return res;
  });

  // 6. User Soft-Delete Check
  await runTest("DELETE /users/:userCId soft-deletes User C (200)", async () => {
    const res = await request(`/users/${userCId}`, {
      method: "DELETE",
      token: tokenC,
    });
    assertStatus(res, 200);
    return res;
  });

  await runTest("GET /users/:userCId after delete returns 404 Not Found", async () => {
    const res = await request(`/users/${userCId}`, { token: tokenA });
    assertStatus(res, 404);
    return res;
  });

  // Summary
  console.log(`\n${COLORS.bold}================ Smoke Test Summary ================${COLORS.reset}`);
  console.log(`Total Tests : ${stats.total}`);
  console.log(`${COLORS.green}Passed      : ${stats.passed}${COLORS.reset}`);
  console.log(
    `${stats.failed > 0 ? COLORS.red : COLORS.green}Failed      : ${stats.failed}${COLORS.reset}`
  );
  console.log(`${COLORS.bold}====================================================${COLORS.reset}\n`);

  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${COLORS.red}Fatal smoke test error:${COLORS.reset}`, err);
  process.exit(1);
});
