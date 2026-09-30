import { useEffect } from "react";
import { useLocation } from "react-router";

/**
 * Client-side navigation keeps the previous scroll position, so a link in the
 * footer would open the next page at the bottom. Start every new page at the
 * top, unless the link targets a section (#hash) on that page.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
