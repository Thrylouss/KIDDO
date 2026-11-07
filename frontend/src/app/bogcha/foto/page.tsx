"use client";

import PhotoGallery from "@/components/photos/PhotoGallery";
import uz from "@/i18n/uz";

export default function BogchaFotoPage() {
  return <PhotoGallery basePath="/v1/admin" description={uz.foto.tavsif_rahbar} canDeleteAll />;
}
