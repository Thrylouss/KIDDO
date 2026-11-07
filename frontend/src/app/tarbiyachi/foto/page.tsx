"use client";

import PhotoGallery from "@/components/photos/PhotoGallery";
import uz from "@/i18n/uz";

export default function TarbiyachiFotoPage() {
  return <PhotoGallery basePath="/v1/teacher" description={uz.foto.tavsif_tarbiyachi} />;
}
