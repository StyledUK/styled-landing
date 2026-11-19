import { redirect } from "next/navigation";
import { createStaffClient } from "@/lib/supabase/staff-server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminNav from "@/components/admin/AdminNav";

// Staff pages require the isolated staff session and an existing staff membership.
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { data } = await (await createStaffClient()).auth.getUser();
  const user = data.user;
  if (!user || user.is_anonymous || !user.email_confirmed_at) redirect("/admin/login");

  const { data: staff } = await createAdminClient().from("staff").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) redirect("/admin/login");

  return (
    <>
      <AdminNav email={user.email ?? ""} />
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </>
  );
}
