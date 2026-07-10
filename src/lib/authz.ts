/**
 * Role-based authorization helpers.
 *
 * Additive over the existing single-user auth. Roles form a hierarchy:
 *   viewer < analyst < admin
 * A user with a higher role satisfies any lower-role requirement.
 *
 * Single-user installs default every user to "admin", so existing behavior is
 * unchanged. Multi-user installs can assign narrower roles.
 */

import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type Role = "viewer" | "analyst" | "admin";

const RANK: Record<Role, number> = {
  viewer: 1,
  analyst: 2,
  admin: 3,
};

export function isRole(value: string): value is Role {
  return value === "viewer" || value === "analyst" || value === "admin";
}

export function roleSatisfies(userRole: string, required: Role): boolean {
  const ur = isRole(userRole) ? userRole : "viewer";
  return RANK[ur] >= RANK[required];
}

export interface AuthedUser {
  id: string;
  email: string;
  role: Role;
}

/**
 * Resolve the current session user with their role.
 * Returns null when unauthenticated.
 */
export async function currentUser(): Promise<AuthedUser | null> {
  const session = await verifySession();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, role: true },
  });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    role: isRole(user.role) ? user.role : "viewer",
  };
}

/**
 * Require at least the given role. Returns the user on success, or an error
 * object suitable for returning from a Server Action.
 */
export async function requireRole(
  required: Role
): Promise<{ user: AuthedUser } | { error: string }> {
  const user = await currentUser();
  if (!user) return { error: "Not authenticated" };
  if (!roleSatisfies(user.role, required)) {
    return { error: `Requires ${required} role or higher` };
  }
  return { user };
}
