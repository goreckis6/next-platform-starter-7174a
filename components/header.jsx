import Image from "next/image";
import Link from "next/link";
import netlifyLogo from "public/netlify-logo.svg";
import githubLogo from "public/images/github-mark-white.svg";

const navItems = [
  { linkText: "Home", href: "/" },
  { linkText: "Revalidation", href: "/revalidation" },
  { linkText: "Image CDN", href: "/image-cdn" },
  { linkText: "Edge Function", href: "/edge" },
  { linkText: "Blobs", href: "/blobs" },
  { linkText: "Classics", href: "/classics" },
  { linkText: "Pricing", href: "/pricing" },
  { linkText: "Login", href: "/login" },
  { linkText: "Register", href: "/register" },
  { linkText: "English", href: "/en" },
];

export function Header() {
  return (
    <header className="bg-white shadow">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo po lewej */}
        <Link href="/" className="flex items-center gap-2">
          <Image src={netlifyLogo} alt="Logo" width={120} height={40} />
        </Link>

        {/* Menu po prawej */}
        <ul className="hidden md:flex items-center gap-6 text-gray-700 font-medium">
          {navItems.map((item, index) => (
            <li key={index}>
              <Link
                href={item.href}
                className="hover:text-blue-600 transition-colors"
              >
                {item.linkText}
              </Link>
            </li>
          ))}
        </ul>

        {/* GitHub ikona po prawej stronie */}
        <Link
          href="https://github.com/netlify-templates/next-platform-starter"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:inline-flex"
        >
          <Image src={githubLogo} alt="GitHub" width={28} height={28} />
        </Link>
      </nav>
    </header>
  );
}
