"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Handshake, SlidersHorizontal } from "lucide-react";
import { cn } from "@/components/ui";

const LINKS = [
  {
    href: "/",
    label: "Negotiations",
    icon: Handshake,
    match: (p: string) => p === "/" || p.startsWith("/negotiations"),
  },
  {
    href: "/settings",
    label: "Rules & Settings",
    icon: SlidersHorizontal,
    match: (p: string) => p.startsWith("/settings"),
  },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 text-sm">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-label={l.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors",
              active
                ? "bg-teal-50 font-medium text-teal-700"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
