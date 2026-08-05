import type { HTMLAttributes } from "react";

/**
 * Stand-in for a real photo until an org uploads one — a gradient panel
 * with an icon and caption, never disguised as an actual photograph.
 * SPEC.md §11.2 lets orgs override branding/imagery later; this is the
 * honest default in the meantime.
 */
export function ImagePlaceholder({
  caption,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { caption?: string }) {
  return (
    <div className={`image-placeholder ${className}`} {...props}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="white" strokeWidth="1.5" opacity="0.85" />
        <circle cx="9" cy="10" r="1.5" fill="white" opacity="0.85" />
        <path d="M4 16l5-4 4 3 3-2.5 4 3.5" stroke="white" strokeWidth="1.5" opacity="0.85" fill="none" />
      </svg>
      {caption && <span className="image-placeholder-caption">{caption}</span>}
    </div>
  );
}
