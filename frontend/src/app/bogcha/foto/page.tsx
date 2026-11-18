"use client";

import PhotoGallery from "@/components/photos/PhotoGallery";
import uz from "@/i18n";
import { useLocale } from "@/contexts/PreferencesContext";

export default function BogchaFotoPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  return <PhotoGallery basePath="/v1/admin" description={uz.foto.tavsif_rahbar} canDeleteAll />;
}
