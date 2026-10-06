import assert from "node:assert/strict";
import { safeNext, ageOn } from "./auth-navigation.js";

for (const path of ["/", "/create", "/invite/token", "/games/123?tab=players#details", "/update-password"]) {
  assert.equal(safeNext(path), path);
}
for (const path of ["https://evil.example", "//evil.example", "/\\evil.example", "/\n/evil.example", "javascript:alert(1)", null, undefined]) {
  assert.equal(safeNext(path), "/");
}
const now = new Date("2026-10-06T12:00:00Z");
assert.equal(ageOn("2010-10-06", now), 16);
assert.equal(ageOn("2010-10-07", now), 15);
assert.equal(ageOn("2008-10-06", now), 18);
assert.equal(ageOn("2008-10-07", now), 17);
for (const invalid of ["2010-02-30", "2010-13-01", "bad", "", "2010-1-1"]) {
  assert.ok(Number.isNaN(ageOn(invalid, now)));
}
console.log("All authentication navigation and age tests passed");
