/**
 * Owner session management (no-login design)
 *
 * Security model:
 * - Server generates a cryptographically random session id
 * - Stored in an HttpOnly, Secure, SameSite=Lax cookie
 * - Client never controls the value used for authorization
 * - All document queries are filtered by this server-side session id
 *
 * Limitations (explicitly accepted by product owner):
 * - Clearing cookies / changing browser / device loses access to documents
 * - No recovery mechanism without adding login later
 * - Suitable for internal department use only
 */

export const OWNER_COOKIE_NAME = "sop_owner_session";

/** Generate a new high-entropy session id (server-side only) */
export function generateOwnerSessionId(): string {
  // 32 bytes → 64 hex chars
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cookie options for the owner session */
export function ownerCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 365) {
  return {
    httpOnly: true,
    secure: true, // requires HTTPS in production
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
