// app/page.jsx
import Link from "next/link";
import DropZone from "../components/DropZone";
import {
  ShieldCheckIcon,
  BuildingOffice2Icon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";

export default function Page() {
  return (
    <main className="bg-white text-black">
      {/* HERO */}
      <section className="text-center py-16 px-6">
        <h1 className="text-4xl font-bold mb-4">
          The world&apos;s most trusted bank statement converter
        </h1>
        <p className="text-lg max-w-3xl mx-auto mb-6 text-gray-800">
          Easily convert PDF bank statements from 1000s of banks world wide into clean Excel (XLS) format.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            className="rounded-md bg-blue-600 px-6 py-3 text-white font-semibold shadow hover:bg-blue-700 transition"
            href="/dashboard"
          >
            Try for free
          </Link>
          <Link
            className="rounded-md bg-gray-200 px-6 py-3 text-black font-semibold hover:bg-gray-300 transition"
            href="/pricing"
          >
            See pricing
          </Link>
        </div>
      </section>

      {/* DROPZONE */}
      <section className="max-w-5xl mx-auto px-6 sm:px-12 mb-16">
        <DropZone />
      </section>
         {/* FEATURES (3 boxy, bez obramowania, ikony wyśrodkowane) */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-6 sm:px-12">
          <div className="grid gap-8 md:grid-cols-3 items-stretch text-center">
            {/* Secure */}
            <div className="p-6 bg-white flex flex-col h-full items-center">
              <ShieldCheckIcon className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Secure</h3>
              <p className="text-gray-800">
                With years of experience in banking we comply with strict
                standards when handling your files.
              </p>
              <div className="mt-auto" />
            </div>

            {/* Institutional */}
            <div className="p-6 bg-white flex flex-col h-full items-center">
              <BuildingOffice2Icon className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Institutional</h3>
              <p className="text-gray-800">
                We&apos;ve provided our services to thousands of reputable
                financial, accounting and legal firms.
              </p>
              <div className="mt-auto" />
            </div>

            {/* Accurate */}
            <div className="p-6 bg-white flex flex-col h-full items-center">
              <CheckBadgeIcon className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Accurate</h3>
              <p className="text-gray-800">
                We&apos;re continually improving our algorithms. If a file
                doesn&apos;t convert to your expectations, email us and we&apos;ll
                fix it.
              </p>
              <div className="mt-auto" />
            </div>
          </div>
        </div>
      </section>

          {/* TIERS */}
      <section className="bg-white py-16 px-6">
        <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
          {/* Anonymous */}
          <div className="p-6 border border-gray-300 rounded-lg text-center bg-white flex flex-col">
            <h2 className="text-2xl font-bold mb-2">Anonymous</h2>
            <p className="text-gray-700 mb-4">
              Anonymous conversions with no need to sign up
            </p>
            <ul className="mb-4">
              <li>1 page every 24 hours</li>
            </ul>
            <div className="font-semibold mb-4">Free</div>
            <Link
              className="rounded-md bg-blue-600 px-5 py-2 text-white font-semibold hover:bg-blue-700 transition mt-auto"
              href="/dashboard"
            >
              Convert now
            </Link>
          </div>

          {/* Registered */}
          <div className="p-6 border border-gray-300 rounded-lg text-center bg-white flex flex-col">
            <h2 className="text-2xl font-bold mb-2">Registered</h2>
            <p className="text-gray-700 mb-4">Registration is free</p>
            <ul className="mb-4">
              <li>5 pages every 24 hours</li>
            </ul>
            <div className="font-semibold mb-4">Free</div>
            <Link
              className="rounded-md bg-blue-600 px-5 py-2 text-white font-semibold hover:bg-blue-700 transition mt-auto"
              href="/login"
            >
              Register
            </Link>
          </div>

          {/* Subscribe */}
          <div className="p-6 border border-gray-300 rounded-lg text-center bg-white flex flex-col">
            <h2 className="text-2xl font-bold mb-2">Subscribe</h2>
            <p className="text-gray-700 mb-4">
              Subscribe to convert more documents
            </p>
            <ul className="mb-4">
              <li>Starter / Professional / Business plans</li>
            </ul>
            <div className="font-semibold mb-4">From $15 / month</div>
            <Link
              className="rounded-md bg-gray-200 px-5 py-2 text-black font-semibold hover:bg-gray-300 transition mt-auto"
              href="/pricing"
            >
              See plans
            </Link>
          </div>
        </div>
      </section>

      {/* NEED MORE */}
      <section className="bg-white py-16 px-6 text-center max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Need more?</h2>
        <p className="mb-6 text-gray-700">
          We can build bespoke processing for other document formats and custom workflows.
        </p>
        <Link
          className="rounded-md bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700 transition"
          href="/contact"
        >
          Contact us
        </Link>
      </section>
    </main>
  );
}
