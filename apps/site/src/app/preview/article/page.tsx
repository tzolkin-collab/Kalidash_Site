"use client";
import { ArticleView } from "../../blog/views";
import type { ArticleViewData } from "../../blog/views";
import { usePreviewData } from "../usePreviewData";

export default function PreviewArticlePage() {
  const draft = usePreviewData<ArticleViewData>("article");
  if (!draft) return null; // espera o admin mandar o rascunho
  return <ArticleView article={draft} />;
}
