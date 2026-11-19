import { NextResponse } from "next/server";
import { createStaffClient } from "@/lib/supabase/staff-server";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const reply = (status:number) => NextResponse.json({ok:status===200},{status,headers:{"Cache-Control":"private, no-store"}});
  if (req.headers.get("origin") !== new URL(req.url).origin) return reply(403);
  try {
    const {error} = await (await createStaffClient()).auth.signOut({scope:"local"});
    return reply(error ? 503 : 200);
  } catch { return reply(503); }
}
