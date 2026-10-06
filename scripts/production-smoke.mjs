import assert from "node:assert/strict";

const base = new URL(process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "https://uzspelejam-app-prod.vercel.app");
assert.ok(["https:", "http:"].includes(base.protocol));
async function request(path, options = {}) {
  return fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(30000), ...options });
}

const pages = ["/", "/?quick=today", "/?date=2026-10-07", "/?mode=online&open=1", "/login", "/signup", "/forgot-password", "/update-password"];
await Promise.all(pages.map(async path => {
  const response = await request(path);
  const html = await response.text();
  assert.equal(response.status, 200, path);
  assert.ok(html.includes("<h1"), `${path}: page heading missing`);
  assert.ok(!html.includes("Application error:"), `${path}: application error`);
  console.log(`PASS render ${path}`);
}));

await Promise.all(["/create", "/profile", "/profile/edit", "/profile/preferences", "/my-games", "/messages", "/notifications"].map(async path => {
  const response = await request(path);
  assert.ok([303, 307].includes(response.status), `${path}: expected sign-in redirect`);
  const destination = new URL(response.headers.get("location"), base);
  assert.equal(destination.origin, base.origin);
  assert.equal(destination.pathname, "/login");
  console.log(`PASS guest guard ${path}`);
}));

for (const next of ["//example.com", "/\\example.com", "/update-password"]) {
  const response = await request(`/auth/callback?next=${encodeURIComponent(next)}`);
  assert.equal(response.status, 307);
  const destination = new URL(response.headers.get("location"), base);
  assert.equal(destination.origin, base.origin);
  assert.equal(destination.pathname, "/login");
  assert.ok(destination.searchParams.has("error"));
}
console.log("PASS callback stays on origin and reports missing/expired link");

// Reject invalid input before Auth signup; this never sends an email or creates an account.
const signup = await request("/signup");
const signupHtml = await signup.text();
const action = signupHtml.match(/name="(\$ACTION_ID_[^"]+)"/);
assert.ok(action, "Signup server action is missing");
for (const birthDate of ["2010-02-30", "2020-01-01"]) {
  const form = new FormData();
  form.set(action[1], "");
  form.set("display_name", "Verification");
  form.set("email", "verification@example.invalid");
  form.set("password", "Invalid-date-check-only");
  form.set("birth_date", birthDate);
  form.set("next", "//example.com");
  const response = await request("/signup", { method: "POST", headers: { Origin: base.origin }, body: form });
  assert.equal(response.status, 303, "Invalid birth date should redirect with an error");
  const destination = new URL(response.headers.get("location"), base);
  assert.equal(destination.origin, base.origin);
  assert.equal(destination.pathname, "/signup");
  assert.equal(destination.searchParams.get("next"), "/");
  assert.ok(destination.searchParams.get("error"));
}
console.log("PASS signup rejects invalid/underage dates before creating an account");
console.log("Production HTTP smoke checks passed");
