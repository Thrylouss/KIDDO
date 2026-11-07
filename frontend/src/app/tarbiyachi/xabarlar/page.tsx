"use client";

import MessagesManager from "@/components/messages/MessagesManager";
import uz from "@/i18n/uz";

export default function TarbiyachiXabarlarPage() {
  return (
    <MessagesManager
      messagesPath="/v1/teacher/messages"
      childrenPath="/v1/teacher/children"
      description={uz.xabarlar.tavsif}
      noGroupsText={uz.xabarlar.guruh_yoq}
    />
  );
}
