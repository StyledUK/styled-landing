import { safeLocalRedirect } from "@/lib/auth/navigation";

// Separate from the customer/supplier browser client's storage key.
export const STAFF_COOKIE_NAME = "styled-staff-auth";
export const staffCookieOptions = {
  name: STAFF_COOKIE_NAME,
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
export function staffDestination(value?: string | null) {
  const next = safeLocalRedirect(value, "/admin");
  const path = new URL(next, "https://local.invalid").pathname;
  return /^\/admin(?:\/|$)/.test(path) && path !== "/admin/login" ? next : "/admin";
}
