"use client";
import { BlogGalleryView } from "../../blog/views";
import type { GalleryItem } from "../../blog/views";
import { usePreviewData } from "../usePreviewData";

type GalleryDraft = { heroHtml: string | null; items: GalleryItem[] };

export default function PreviewBlogPage() {
  const draft = usePreviewData<GalleryDraft>("gallery");
  if (!draft) return null; // espera o admin mandar o rascunho
  return <BlogGalleryView heroHtml={draft.heroHtml} items={draft.items} />;
}
