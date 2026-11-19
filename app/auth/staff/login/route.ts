import { NextResponse } from "next/server";
import { createStaffClient } from "@/lib/supabase/staff-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { supplierJson } from "@/lib/server/supplier-body";
import { clientIpHash } from "@/lib/server/limits";
import { staffDestination } from "@/lib/auth/staff-session";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const reply = (status: number, error: string) => NextResponse.json({error}, {status, headers:{"Cache-Control":"private, no-store"}});
  if (req.headers.get("origin") !== new URL(req.url).origin) return reply(403,"Request refused.");
  let body;
  try { body = await supplierJson(req,4096); } catch { return reply(400,"Enter your email and password."); }
  if (typeof body.email !== "string" || body.email.length > 254 || !body.email.includes("@") || typeof body.password !== "string" || !body.password || body.password.length > 1024) return reply(400,"Enter your email and password.");
  try {
    const admin = createAdminClient();
    const limit = await admin.rpc("hit_rate_limit",{p_key:`staff-login:${clientIpHash(req)}`,p_limit:20,p_window_seconds:900});
    if (limit.error) return reply(503,"Staff sign-in is temporarily unavailable.");
    if (limit.data !== true) return reply(429,"Too many attempts. Try again in 15 minutes.");
    const client = await createStaffClient();
    const {data,error} = await client.auth.signInWithPassword({email:body.email.trim(),password:body.password});
    if (error || !data.user || data.user.is_anonymous || !data.user.email_confirmed_at) {
      await client.auth.signOut({scope:"local"});
      return reply(401,"Unable to sign in with these staff details.");
    }
    const membership = await admin.from("staff").select("user_id").eq("user_id",data.user.id).maybeSingle();
    if (membership.error || !membership.data) {
      await client.auth.signOut({scope:"local"});
      return reply(membership.error ? 503 : 403,membership.error ? "Staff access is temporarily unavailable." : "Unable to sign in with these staff details.");
    }
    return NextResponse.json({ok:true,next:staffDestination(body.next)},{headers:{"Cache-Control":"private, no-store"}});
  } catch { return reply(503,"Staff sign-in is temporarily unavailable. Try again."); }
}
