import { useEffect } from "react";

export const CONTENT_REMOVED_EVENT = "campushub:content-removed";

/** Public moderation events also invalidate already-loaded content. */
export function useContentRemoval(targetType: "LISTING" | "LOST_FOUND_POST", onRemove: (id: string) => void) {
  useEffect(() => {
    function removed(event: Event) {
      const detail = (event as CustomEvent<{ targetType?: string; targetId?: string }>).detail;
      if (detail?.targetType === targetType && typeof detail.targetId === "string") onRemove(detail.targetId);
    }
    window.addEventListener(CONTENT_REMOVED_EVENT, removed);
    return () => window.removeEventListener(CONTENT_REMOVED_EVENT, removed);
  }, [targetType, onRemove]);
}
