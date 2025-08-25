import Link from "next/link";
import DropZone from "../components/DropZone";
import {
  ShieldCheckIcon,
  BuildingOffice2Icon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";

export default function Page() {
  return (
    <main className="flex flex-col gap-16">
      {/* Dropzone */}
      <section>
        <DropZone />
      </section>

      {/* FEATURES */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-6 sm:px-12">
          <div className="grid gap-8 md:grid-cols-3">
            {/* Secure */}
            <div className="p-6 border rounded-lg shadow-sm bg-white flex flex-col items-start">
              <ShieldCheckIcon className="h-10 w-10 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Secure</h3>
              <p className="text-gray-700">
                With years of experience in banking we comply with strict
                standards when handling your files.
              </p>
            </div>

            {/* Institutional */}
            <div className="p-6 border rounded-lg shadow-sm bg-white flex flex-col items-start">
              <BuildingOffice2Icon className="h-10 w-10 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Institutional</h3>
              <p className="text-gray-700">
                We&apos;ve provided our services to thousands of reputable
                financial, accounting and legal firms.
              </p>
            </div>

            {/* Accurate */}
            <div className="p-6 border rounded-lg shadow-sm bg-white flex flex-col items-start">
              <CheckBadgeIcon className="h-10 w-10 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Accurate</h3>
              <p className="text-gray-700">
                We&apos;re continually improving our algorithms. If a file
                doesn&apos;t convert to your expectations, email us and we&apos;ll
                fix it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TIERS */}
      <section>
        {/* Anonymous / Registered / Subscribe ... */}
      </section>
    </main>
  );
}
