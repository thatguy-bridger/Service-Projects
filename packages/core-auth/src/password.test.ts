import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, isPasswordStrongEnough } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("a hashed password verifies against its own plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("the wrong plaintext does not verify", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong password entirely", hash)).toBe(false);
  });

  it("never stores the plaintext in the hash", async () => {
    const plaintext = "correct horse battery staple";
    const hash = await hashPassword(plaintext);
    expect(hash).not.toContain(plaintext);
  });

  it("hashing the same password twice produces different hashes (salted)", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same password", a)).toBe(true);
    expect(await verifyPassword("same password", b)).toBe(true);
  });
});

describe("isPasswordStrongEnough", () => {
  it("rejects anything under 10 characters", () => {
    expect(isPasswordStrongEnough("short123")).toBe(false);
    expect(isPasswordStrongEnough("")).toBe(false);
  });

  it("accepts exactly 10 characters and up", () => {
    expect(isPasswordStrongEnough("1234567890")).toBe(true);
    expect(isPasswordStrongEnough("a very long passphrase")).toBe(true);
  });
});
