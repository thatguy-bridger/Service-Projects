import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

// One-way hashing, not encryption — a hash can't be reversed back to the
// plaintext password even if the database leaks. Never store or log a
// plaintext or reversibly-encrypted password.
export function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

export function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export function isPasswordStrongEnough(plaintext: string): boolean {
  return plaintext.length >= 10;
}
