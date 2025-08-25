import Link from "next/link";
import DropZone from "../components/DropZone";

export default function Page() {
  return (
    <main className="bg-white text-black">
      {/* HERO */}
      <section className="text-center py-16 px-6">
        <h1 className="text-4xl font-bold mb-4">
          The most reliable bank statement converter
        </h1>
        <p className="text-lg max-w-2xl mx-auto mb-6 text-gray-800">
          Convert PDF bank statements from thousands of banks into clean Excel (XLS) and CSV files.
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
      <section className="max-w-4xl mx-auto mb-16">
        <DropZone />
      </section>

      {/* FREEMIUM TIERS */}
      <section className="bg-white py-16 px-6">
        <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
          <div className="p-6 border rounded-lg text-center shadow-sm bg-white">
            <h2 className="text-2xl font-bold mb-2">Anonymous</h2>
            <p className="text-gray-700 mb-4">No sign-up required</p>
            <ul className="mb-4">
              <li>1 page every 24 hours</li>
            </ul>
            <div className="font-semibold mb-4">Free</div>
            <Link
              className="rounded-md bg-blue-600 px-5 py-2 text-white font-semibold hover:bg-blue-700 transition"
              href="/dashboard"
            >
              Convert now
            </Link>
          </div>

          <div className="p-6 border rounded-lg text-center shadow-sm bg-white">
            <h2 className="text-2xl font-bold mb-2">Registered</h2>
            <p className="text-gray-700 mb-4">Registration is free</p>
            <ul className="mb-4">
              <li>5 pages every 24 hours</li>
            </ul>
            <div className="font-semibold mb-4">Free</div>
            <Link
              className="rounded-md bg-blue-600 px-5 py-2 text-white font-semibold hover:bg-blue-700 transition"
              href="/login"
            >
              Create account
            </Link>
          </div>

          <div className="p-6 border rounded-lg text-center shadow-sm bg-white">
            <h2 className="text-2xl font-bold mb-2">Subscribe</h2>
            <p className="text-gray-700 mb-4">
              Convert more documents with higher limits
            </p>
            <ul className="mb-4">
              <li>Starter / Professional / Business plans</li>
            </ul>
            <div className="font-semibold mb-4">From $15 / month</div>
            <Link
              className="rounded-md bg-gray-200 px-5 py-2 text-black font-semibold hover:bg-gray-300 transition"
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

      {/* FOOTER */}
      <footer className="bg-white border-t py-8">
        <nav className="flex flex-wrap justify-center gap-6 mb-4 text-sm text-gray-700">
          <Link href="/api-docs">API Docs</Link>
          <Link href="/about">About</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/blog">Blog</Link>
        </nav>
        <div className="text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Smart Statement
        </div>
      </footer>
    </main>
  );
}
