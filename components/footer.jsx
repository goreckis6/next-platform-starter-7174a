import Link from "next/link";

export function Footer() {
  return (
    // Pełna szerokość + szara linia
    <footer className="bg-white border-t border-gray-300 w-full">
      {/* Wewnętrzny kontener jak wcześniej */}
      <div className="max-w-5xl mx-auto px-6 sm:px-12 py-8">
        <nav className="flex flex-wrap justify-center gap-6 mb-4 text-sm text-gray-700">
          <Link href="/api-docs" className="hover:text-blue-600 transition-colors">API Docs</Link>
          <Link href="/about" className="hover:text-blue-600 transition-colors">About</Link>
          <Link href="/terms" className="hover:text-blue-600 transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-blue-600 transition-colors">Privacy</Link>
          <Link href="/blog" className="hover:text-blue-600 transition-colors">Blog</Link>
        </nav>
        <div className="text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Smart Statement
        </div>
      </div>
    </footer>
  );
}
