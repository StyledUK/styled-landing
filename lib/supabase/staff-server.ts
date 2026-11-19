import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/server/env";
import { staffCookieOptions } from "@/lib/auth/staff-session";

// Staff credentials stay in HttpOnly cookies, never in the public auth client.
export async function createStaffClient() {
  const store = await cookies();
  const { name: _storageKey, ...securityOptions } = staffCookieOptions;
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookieOptions: staffCookieOptions,
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try { values.forEach(({name,value,options}) => store.set(name,value,{...options,...securityOptions})); }
        catch { /* Read-only server component. Staff middleware refreshes these cookies. */ }
      },
    },
  });
}
