// app/dashboard/page.jsx
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardRedirect({ searchParams }) {
  const uuid = searchParams?.uuid || "";
  const key = searchParams?.key || "";

  // jeśli nie ma uuid, pokaż prostą info (żeby nie zapętlać się)
  if (!uuid) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-2">Nothing to show</h1>
        <p className="text-gray-700">Missing <code>uuid</code> in the URL.</p>
      </main>
    );
  }

  // przekieruj na /inspect z tym samym uuid (key nie jest tu konieczny)
  redirect(`/inspect?uuid=${encodeURIComponent(uuid)}&env=prod`);
}
