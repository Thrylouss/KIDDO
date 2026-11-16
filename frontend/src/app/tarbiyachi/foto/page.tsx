"use client";

import PhotoGallery from "@/components/photos/PhotoGallery";
import uz from "@/i18n";
import { useLocale } from "@/contexts/PreferencesContext";

export default function TarbiyachiFotoPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  return <PhotoGallery basePath="/v1/teacher" description={uz.foto.tavsif_tarbiyachi} />;
}
