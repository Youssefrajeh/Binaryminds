import { useEffect } from "react";
import { useLocation } from "react-router";
import { pageTitle } from "../lib/pageTitle";

/** Keeps the browser tab title in step with the current route */
export function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = pageTitle(pathname);
  }, [pathname]);
  return null;
}
