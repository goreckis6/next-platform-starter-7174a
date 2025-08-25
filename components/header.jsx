import Image from "next/image";
import Link from "next/link";
import netlifyLogo from "public/netlify-logo.svg";

const navItems = [
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
        <ul className="flex items-center gap-6 text-gray-700 font-medium">
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
      </nav>
    </header>
  );
}
