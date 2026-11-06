import { matchPath } from "react-router";

export const SITE_NAME = "campus-hub";

// Most specific patterns first: the first match names the tab.
const titles: [pattern: string, title: string][] = [
  ["/", "Home"],
  ["/login", "Log in"],
  ["/register", "Sign up"],
  ["/verify", "Verify your email"],
  ["/forgot-password", "Forgot password"],
  ["/reset-password", "Reset password"],
  ["/terms", "Terms & Conditions"],
  ["/about", "About"],
  ["/profile", "Your profile"],
  ["/profile/edit", "Edit profile"],
  ["/u/:userId", "Student profile"],
  ["/members", "Find students"],
  ["/messages", "Messages"],
  ["/messages/:conversationId", "Messages"],
  ["/study-groups", "Study groups"],
  ["/study-groups/:id", "Study group"],
  ["/files", "Course files"],
  ["/marketplace", "Marketplace"],
  ["/marketplace/new", "Sell an item"],
  ["/marketplace/:id/edit", "Edit listing"],
  ["/marketplace/:id", "Listing"],
  ["/lost-found", "Lost & Found"],
  ["/lost-found/new", "Report an item"],
  ["/events", "Events"],
  ["/events/new", "Create an event"],
  ["/events/manage", "Event management"],
  ["/events/:id/edit", "Edit event"],
  ["/admin/reports", "Admin · Reports"],
  ["/admin/users", "Admin · Users"],
];

export function pageTitle(pathname: string): string {
  const match = titles.find(([pattern]) => matchPath(pattern, pathname));
  return `${match ? match[1] : "Page not found"} · ${SITE_NAME}`;
}
