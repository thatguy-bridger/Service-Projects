"use client";

import { usePathname } from "next/navigation";
import { t } from "@/copy";

const TABS = [
  { href: "/admin/events", label: t("admin.tabs.events") },
  { href: "/admin/users", label: t("admin.tabs.users") },
] as const;

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="admin-tabs" aria-label={t("admin.tabs.nav")}>
      {TABS.map((tab) => (
        <a
          key={tab.href}
          href={tab.href}
          className={`admin-tab${pathname === tab.href ? " admin-tab--active" : ""}`}
          aria-current={pathname === tab.href ? "page" : undefined}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
