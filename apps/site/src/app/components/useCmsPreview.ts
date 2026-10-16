"use client";
import { useEffect, useState } from "react";
import { parseContent, DRAFT_KEY, PUBLISHED_KEY } from "../admin/content";
import type { MotionContent } from "../admin/content";

/**
 * Hook que monitora o CMS preview via query param e localStorage.
 * Usado apenas quando ?cmsPreview=draft ou ?cmsPreview=published.
 */
export function useCmsPreview(initial: MotionContent): MotionContent {
  const [content, setContent] = useState(initial);

  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get("cmsPreview");
    if (mode !== "draft" && mode !== "published") return;

    const update = () => {
      try {
        setContent(
          parseContent(
            localStorage.getItem(mode === "draft" ? DRAFT_KEY : PUBLISHED_KEY),
          ),
        );
      } catch {
        /* Keep default when storage is unavailable. */
      }
    };

    update();
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);

  return content;
}
