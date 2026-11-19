import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import StaffLoginForm from "@/components/auth/StaffLoginForm";
import { createStaffClient } from "@/lib/supabase/staff-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { staffDestination } from "@/lib/auth/staff-session";
export const dynamic = "force-dynamic";
export default async function AdminLoginPage({searchParams}:{searchParams:Promise<{next?:string}>}) {
  const next=staffDestination((await searchParams).next);
  const {data}=await (await createStaffClient()).auth.getUser();
  if(data.user && !data.user.is_anonymous && data.user.email_confirmed_at) {
    const {data:staff,error}=await createAdminClient().from("staff").select("user_id").eq("user_id",data.user.id).maybeSingle();
    if(!error && staff) redirect(next);
  }
  return <AuthShell area="Staff"><StaffLoginForm next={next}/></AuthShell>;
}
