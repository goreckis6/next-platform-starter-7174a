import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-300 w-full">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Linki */}
        <nav className="flex flex-wrap justify-center gap-6 mb-4 text-sm text-gray-700">
          <Link href="/api-docs" className="hover:text-blue-600 transition-colors">
            API Docs
          </Link>
          <Link href="/about" className="hover:text-blue-600 transition-colors">
            About
          </Link>
          <Link href="/terms" className="hover:text-blue-600 transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-blue-600 transition-colors">
            Privacy
          </Link>
          <Link href="/blog" className="hover:text-blue-600 transition-colors">
            Blog
          </Link>
        </nav>

        {/* Copyright */}
        <div className="text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Smart Statement
        </div>
      </div>
    </footer>
  );
}
