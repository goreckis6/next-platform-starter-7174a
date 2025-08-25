"use client";

import { useState } from "react";
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
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-300 w-full">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image src={netlifyLogo} alt="Logo" width={120} height={40} priority />
        </Link>

        {/* Desktop menu */}
        <ul className="hidden md:flex items-center gap-6 text-gray-700 font-medium">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="hover:text-blue-600 transition-colors"
              >
                {item.linkText}
              </Link>
            </li>
          ))}
        </ul>

        {/* Mobile toggle */}
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">Toggle menu</span>
          <div className="relative h-5 w-6">
            <span
              className={`absolute left-0 top-0 block h-0.5 w-6 bg-current transition-transform ${
                open ? "translate-y-2 rotate-45" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-2 block h-0.5 w-6 bg-current transition-opacity ${
                open ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute left-0 top-4 block h-0.5 w-6 bg-current transition-transform ${
                open ? "-translate-y-2 -rotate-45" : ""
              }`}
            />
          </div>
        </button>
      </nav>

      {/* Mobile panel */}
      {open && (
        <div className="md:hidden border-t border-gray-300">
          <ul className="mx-auto max-w-7xl px-4 py-3 space-y-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100"
                  onClick={() => setOpen(false)}
                >
                  {item.linkText}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
