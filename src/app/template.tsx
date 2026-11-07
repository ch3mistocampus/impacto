import { ViewTransition } from "react";

/**
 * Templates re-mount on navigation, so this boundary gets a real enter/exit on every route
 * change: the old page fades out fast, the new one fades in with a small rise. Same-page
 * updates (search params, live Convex data) don't animate (`default="none"`).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
