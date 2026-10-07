import test from "node:test";
import assert from "node:assert/strict";
import { workspaceIdentity } from "../server/session";
test("anonymous workspaces are independent HttpOnly capabilities and malformed cookies rotate", async () => {
  const a = await workspaceIdentity(new Request("https://test.local")),
    b = await workspaceIdentity(new Request("https://test.local"));
  assert.notEqual(a.owner, b.owner);
  assert.match(a.setCookie!, /HttpOnly; Secure; SameSite=Lax/);
  const replay = await workspaceIdentity(
    new Request("https://test.local", {
      headers: { cookie: a.setCookie!.split(";")[0] },
    }),
  );
  assert.equal(replay.owner, a.owner);
  assert.equal(replay.setCookie, null);
  const invalid = await workspaceIdentity(
    new Request("https://test.local", {
      headers: { cookie: "utopia_session=shared" },
    }),
  );
  assert.notEqual(invalid.owner, a.owner);
  assert.ok(invalid.setCookie);
});
test("trusted signed-in identity is hashed and cannot collide with guest namespace", async () => {
  const a = await workspaceIdentity(
    new Request("https://test.local", {
      headers: { "oai-authenticated-user-id": "identity-123" },
    }),
  );
  assert.ok(a.owner.startsWith("user:"));
  assert.ok(!a.owner.includes("identity-123"));
  assert.equal(a.setCookie, null);
});
