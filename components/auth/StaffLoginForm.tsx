"use client";
import { useState } from "react";
import Link from "next/link";
export default function StaffLoginForm({next}:{next:string}) {
  const [email,setEmail]=useState(""),[password,setPassword]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError("");
    try {
      const res=await fetch("/auth/staff/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password,next}),signal:AbortSignal.timeout(20000)});
      const data=await res.json();
      if(!res.ok) {setError(data.error||"Unable to sign in.");return;}
      window.location.replace(data.next);
    } catch {setError("Couldn’t connect. Please try again.");}
    finally {setPassword("");setBusy(false);}
  }
  return <>
    <h1 className="font-serif text-3xl">Staff log in</h1>
    <form onSubmit={submit} className="mt-6 space-y-5">
      <div><label htmlFor="staff-email" className="mb-2 block text-sm">Email</label><input id="staff-email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-xl border border-sand px-4 py-3" /></div>
      <div><div className="mb-2 flex items-center justify-between gap-2"><label htmlFor="staff-password" className="text-sm">Password</label><Link href="/auth/recovery?next=%2Fadmin" className="text-xs underline underline-offset-4">Forgot password?</Link></div><input id="staff-password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} className="w-full rounded-xl border border-sand px-4 py-3" /></div>
      {error && <p role="alert" className="text-sm">{error}</p>}
      <button disabled={busy} className="min-h-11 w-full rounded-full bg-ink px-5 py-3 text-cream disabled:opacity-50">{busy?"Signing in…":"Open admin dashboard"}</button>
    </form>
  </>;
}
