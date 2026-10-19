import { test } from "node:test";
import assert from "node:assert/strict";
import { SESSION_SECONDS, createSession, hashPassword, passwordMatches, sessionValid } from "./admin-auth.ts";

const SECRET = hashPassword("test-secret");

test("password check: exact match only; no password configured means no login", () => {
  assert.equal(passwordMatches("test-secret", SECRET), true);
  assert.equal(passwordMatches("test-secre", SECRET), false);
  assert.equal(passwordMatches("", SECRET), false);
  assert.equal(passwordMatches("anything", undefined), false);
  assert.equal(passwordMatches("", ""), false);
});

test("the stored value is a salted hash, and a malformed one never matches", () => {
  assert.doesNotMatch(SECRET, /test-secret/);
  assert.notEqual(hashPassword("test-secret"), SECRET); // fresh salt each time
  assert.equal(passwordMatches("test-secret", hashPassword("test-secret")), true);
  for (const bad of ["test-secret", "abc", ":", `${SECRET.split(":")[0]}:`, `:${SECRET.split(":")[1]}`, `${SECRET}:x`])
    assert.equal(passwordMatches("test-secret", bad), false);
});

test("a fresh session is valid, and expires after its lifetime", () => {
  const now = 1_800_000_000_000;
  const token = createSession(SECRET, now);
  assert.equal(sessionValid(token, SECRET, now), true);
  assert.equal(sessionValid(token, SECRET, now + (SESSION_SECONDS - 1) * 1000), true);
  assert.equal(sessionValid(token, SECRET, now + SESSION_SECONDS * 1000), false);
});

test("forged, tampered or foreign sessions are rejected", () => {
  const now = 1_800_000_000_000;
  const token = createSession(SECRET, now);
  const [expiry, mac] = token.split(".");
  assert.equal(sessionValid(`${Number(expiry) + 999999}.${mac}`, SECRET, now), false); // extended expiry
  assert.equal(sessionValid(`${expiry}.${"0".repeat(64)}`, SECRET, now), false); // made-up signature
  assert.equal(sessionValid(token, "other-secret", now), false); // password changed
  for (const bad of [undefined, "", "abc", ".", `${expiry}.`, `x.${mac}`]) assert.equal(sessionValid(bad, SECRET, now), false);
  assert.equal(sessionValid(token, undefined, now), false);
});
