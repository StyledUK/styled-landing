import Link from "next/link";
import type { ReactNode } from "react";

/** Shared presentation only. Each entry keeps its own access and session checks. */
export default function AuthShell({ children, area = "Customer", supplier = false }: {
  children: ReactNode; area?: string; supplier?: boolean;
}) {
  return <main className={`${supplier ? "workspace-portal " : area === "Staff" ? "workspace-admin " : ""}min-h-dvh bg-cream px-5 py-8 text-ink sm:py-12`}>
    <header className="mx-auto flex w-full max-w-md items-center justify-between gap-4">
      <Link href="/" aria-label="Styled home" className="font-serif text-3xl">Styled.</Link>
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-ink/70 hover:text-ink"><span aria-hidden="true">←</span> Main website</Link>
    </header>
    <section aria-label={`${area} account access`} className="mx-auto mt-8 w-full max-w-md rounded-2xl border border-sand bg-white px-6 py-8 sm:mt-12 sm:p-9">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-ink/60">{area}</p>
      {children}
    </section>
    <footer className="mx-auto mt-5 flex max-w-md flex-wrap items-center justify-center gap-x-5 text-xs text-ink/65">
      <Link href={supplier ? "mailto:support@styleduk.com?subject=Supplier%20portal%20access" : "mailto:support@styleduk.com"} className="inline-flex min-h-11 items-center hover:underline">Contact support</Link>
      <Link href="/privacy" className="inline-flex min-h-11 items-center hover:underline">Privacy</Link>
      <Link href="/terms" className="inline-flex min-h-11 items-center hover:underline">Terms</Link>
    </footer>
  </main>;
}
