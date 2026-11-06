import type { MouseEvent } from "react";

/** First focusable element on every page; jumps keyboard users past the header */
export function SkipLink() {
  function skip(event: MouseEvent<HTMLAnchorElement>) {
    const main = document.getElementById("main");
    if (!main) return;
    // Focus the region itself so the next Tab starts inside the page content
    event.preventDefault();
    main.setAttribute("tabindex", "-1");
    main.focus();
    main.scrollIntoView?.();
  }

  return (
    <a
      href="#main"
      onClick={skip}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-lg focus:ring-2 focus:ring-brand"
    >
      Skip to content
    </a>
  );
}
