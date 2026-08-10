"use client";

import { useEffect, useRef, useState } from "react";

export interface NavItem {
  label: string;
  href: string;
}

export interface NavCategory {
  label: string;
  items: NavItem[];
}

// A small dropdown-per-category nav bar. Server-filtered before this
// ever renders (AppTopbar decides which categories/items a role can
// see), so this component only has to worry about open/close/click-
// outside behavior, not permissions.
export function TopNavMenu({ categories }: { categories: NavCategory[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenIndex(null);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIndex(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const visibleCategories = categories.filter((c) => c.items.length > 0);
  if (visibleCategories.length === 0) return null;

  return (
    <nav ref={rootRef} style={{ display: "flex", gap: "var(--space-1)", position: "relative" }} aria-label="Main">
      {visibleCategories.map((category, index) => {
        const open = openIndex === index;
        // A single-item category is just a direct link -- no dropdown
        // affordance needed for one destination.
        if (category.items.length === 1) {
          return (
            <a
              key={category.label}
              href={category.items[0].href}
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-accent-600)",
                padding: "var(--space-2) var(--space-2)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {category.label}
            </a>
          );
        }
        return (
          <div key={category.label} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : index)}
              aria-expanded={open}
              aria-haspopup="menu"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: "var(--text-sm)",
                color: "var(--color-accent-600)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "var(--space-2) var(--space-2)",
                whiteSpace: "nowrap",
              }}
            >
              {category.label}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {open && (
              <div
                role="menu"
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: 4,
                  minWidth: 200,
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-md)",
                  padding: "var(--space-1)",
                  zIndex: 40,
                }}
              >
                {category.items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setOpenIndex(null)}
                    style={{
                      display: "block",
                      padding: "var(--space-2) var(--space-3)",
                      fontSize: "var(--text-sm)",
                      color: "var(--text-primary)",
                      textDecoration: "none",
                      borderRadius: "var(--radius-sm)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
