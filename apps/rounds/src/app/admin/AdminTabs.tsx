"use client";

import { usePathname } from "next/navigation";
import { t } from "@/copy";

const TABS = [
  { href: "/admin/events", label: t("admin.tabs.events") },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/territories", label: "Territories" },
  { href: "/admin/copy", label: "Copy" },
  { href: "/admin/review", label: t("admin.tabs.review") },
  { href: "/admin/library", label: t("admin.tabs.library") },
  { href: "/admin/users", label: t("admin.tabs.users") },
  { href: "/admin/keys", label: "Keys" },
  { href: "/admin/settings", label: t("admin.tabs.settings") },
] as const;

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="admin-tabs" aria-label={t("admin.tabs.nav")}>
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        return (
          <a
            key={tab.href}
            href={tab.href}
            className={`admin-tab${active ? " admin-tab--active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
}
