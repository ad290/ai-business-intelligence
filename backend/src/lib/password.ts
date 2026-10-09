import bcrypt from "bcrypt";

/** Work factor for bcrypt (12 is a common production default). */
const BCRYPT_ROUNDS = 12;

export type PasswordHash = string;

export class PasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordError";
  }
}

/**
 * Hash a plaintext password for storage. Never persist or log the input password.
 */
export async function hashPassword(plaintext: string): Promise<PasswordHash> {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new PasswordError("Password is required");
  }

  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/**
 * Compare a plaintext password with a stored bcrypt hash. Returns false on mismatch
 * or invalid input — does not throw for wrong passwords.
 */
export async function verifyPassword(
  plaintext: string,
  passwordHash: PasswordHash
): Promise<boolean> {
  if (
    typeof plaintext !== "string" ||
    plaintext.length === 0 ||
    typeof passwordHash !== "string" ||
    passwordHash.length === 0
  ) {
    return false;
  }

  try {
    return await bcrypt.compare(plaintext, passwordHash);
  } catch {
    return false;
  }
}
