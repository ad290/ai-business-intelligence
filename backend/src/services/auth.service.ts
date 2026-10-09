import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "../lib/errors.js";
import {
  getRefreshTokenExpiry,
  hashRefreshToken,
} from "../lib/refreshToken.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/tokens.js";
import type { LoginInput, RegisterInput } from "../validation/auth.schemas.js";

const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  companyId: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const companyPublicSelect = {
  id: true,
  name: true,
  createdAt: true,
} satisfies Prisma.CompanySelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof userPublicSelect }>;

export type RegisterResult = {
  user: PublicUser;
  company: Prisma.CompanyGetPayload<{ select: typeof companyPublicSelect }>;
};

export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: PublicUser;
};

export type LoginSessionMeta = {
  userAgent?: string;
  ipAddress?: string;
};

export type RefreshSessionResult = {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

const refreshUnauthorizedMessage = "Invalid or expired refresh token";

async function revokeRefreshTokenFamily(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: {
      familyId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new ConflictError("An account with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    return await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: input.companyName },
        select: companyPublicSelect,
      });

      const user = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          companyId: company.id,
        },
        select: userPublicSelect,
      });

      return { user, company };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError("An account with this email already exists");
    }
    throw error;
  }
}

export async function loginUser(
  input: LoginInput,
  meta: LoginSessionMeta = {}
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      ...userPublicSelect,
      passwordHash: true,
    },
  });

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const passwordMatches = await verifyPassword(
    input.password,
    user.passwordHash
  );

  if (!passwordMatches) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const tokenId = randomUUID();
  const familyId = randomUUID();

  const accessToken = signAccessToken({
    userId: user.id,
    companyId: user.companyId,
  });

  const refreshToken = signRefreshToken({
    userId: user.id,
    tokenId,
    familyId,
  });

  const refreshExpiresAt = getRefreshTokenExpiry(refreshToken);

  await prisma.refreshToken.create({
    data: {
      id: tokenId,
      tokenHash: hashRefreshToken(refreshToken),
      userId: user.id,
      familyId,
      expiresAt: refreshExpiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    },
  });

  const { passwordHash: _passwordHash, ...publicUser } = user;

  return {
    accessToken,
    refreshToken,
    refreshExpiresAt,
    user: publicUser,
  };
}

export async function refreshSession(
  refreshTokenJwt: string,
  meta: LoginSessionMeta = {}
): Promise<RefreshSessionResult> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshTokenJwt);
  } catch {
    throw new UnauthorizedError(refreshUnauthorizedMessage);
  }

  const presentedHash = hashRefreshToken(refreshTokenJwt);

  const session = await prisma.refreshToken.findUnique({
    where: { id: payload.tokenId },
    include: {
      user: {
        select: {
          id: true,
          companyId: true,
        },
      },
    },
  });

  if (!session || session.userId !== payload.userId) {
    throw new UnauthorizedError(refreshUnauthorizedMessage);
  }

  if (session.tokenHash !== presentedHash) {
    throw new UnauthorizedError(refreshUnauthorizedMessage);
  }

  if (session.revokedAt !== null || session.replacedById !== null) {
    await revokeRefreshTokenFamily(session.familyId);
    throw new UnauthorizedError(refreshUnauthorizedMessage);
  }

  if (session.expiresAt <= new Date()) {
    await prisma.refreshToken.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError(refreshUnauthorizedMessage);
  }

  const newTokenId = randomUUID();
  const newRefreshToken = signRefreshToken({
    userId: session.userId,
    tokenId: newTokenId,
    familyId: session.familyId,
  });
  const refreshExpiresAt = getRefreshTokenExpiry(newRefreshToken);

  const accessToken = signAccessToken({
    userId: session.user.id,
    companyId: session.user.companyId,
  });

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        replacedById: newTokenId,
        lastUsedAt: new Date(),
      },
    });

    await tx.refreshToken.create({
      data: {
        id: newTokenId,
        tokenHash: hashRefreshToken(newRefreshToken),
        userId: session.userId,
        familyId: session.familyId,
        expiresAt: refreshExpiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    refreshExpiresAt,
  };
}

/**
 * Best-effort revocation of the refresh session for logout. Does not throw when the
 * token is missing, invalid, or already revoked (idempotent, no existence leak).
 */
export async function logoutSession(refreshTokenJwt: string): Promise<void> {
  const tokenHash = hashRefreshToken(refreshTokenJwt);
  const now = new Date();

  try {
    const payload = verifyRefreshToken(refreshTokenJwt);

    await prisma.refreshToken.updateMany({
      where: {
        id: payload.tokenId,
        tokenHash,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
    return;
  } catch {
    // JWT invalid or expired — still attempt revocation by stored hash.
  }

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: { revokedAt: now },
  });
}

const currentUserSelect = {
  id: true,
  name: true,
  email: true,
  companyId: true,
  company: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.UserSelect;

export type MeResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    companyId: string;
  };
  company: {
    id: string;
    name: string;
  };
};

export async function getCurrentUser(
  userId: string,
  expectedCompanyId: string
): Promise<MeResponse> {
  const record = await prisma.user.findUnique({
    where: { id: userId },
    select: currentUserSelect,
  });

  if (!record || record.company.id !== expectedCompanyId) {
    throw new NotFoundError("User not found");
  }

  return {
    user: {
      id: record.id,
      name: record.name,
      email: record.email,
      companyId: record.companyId,
    },
    company: record.company,
  };
}
