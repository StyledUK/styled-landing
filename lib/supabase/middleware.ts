import { staffCookieOptions } from "@/lib/auth/staff-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require a real (non-anonymous) account.
const PROTECTED = ["/design"];

export async function updateSession(request: NextRequest) {
  const staffRoute = /^\/(?:admin|api\/admin)(?:\/|$)/.test(request.nextUrl.pathname);
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(staffRoute ? {cookieOptions:staffCookieOptions} : {}),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (staffRoute) {
    if (pathname !== "/admin/login" && pathname.startsWith("/admin") && (!user || user.is_anonymous || !user.email_confirmed_at)) {
      const target = new URL("/admin/login", request.url);
      target.searchParams.set("next", pathname + request.nextUrl.search);
      const redirected = NextResponse.redirect(target);
      response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
      return redirected;
    }
    return response;
  }

  if (pathname === "/" && user?.email_confirmed_at && !user.is_anonymous) {
    // The planner applies its existing supplier membership check on arrival.
    const redirect = NextResponse.redirect(new URL("/design?tab=wedding", request.url));
    redirect.headers.set("Cache-Control", "private, no-store");
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }

  const needsAuth = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (needsAuth && user && !user.is_anonymous) {
    try {
      const {data:membership,error} = await createAdminClient().from("supplier_users")
        .select("supplier_id").eq("user_id",user.id).maybeSingle();
      if(error) throw error;
      if(membership) {
        const target=request.nextUrl.clone();
        target.pathname="/portal/products";target.search="";
        const redirect=NextResponse.redirect(target);
        response.cookies.getAll().forEach(cookie=>redirect.cookies.set(cookie));
        return redirect;
      }
    } catch {
      return new NextResponse("We could not check your account access. Please refresh to try again.",{status:503});
    }
  }

  if (needsAuth && (!user || user.is_anonymous)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("mode", "login");
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
