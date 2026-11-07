"use client";

import MessagesManager from "@/components/messages/MessagesManager";
import uz from "@/i18n/uz";

export default function BogchaXabarlarPage() {
  return (
    <MessagesManager
      messagesPath="/v1/admin/messages"
      childrenPath="/v1/admin/children"
      description={uz.bogcha_panel.xabarlar_tavsif}
      noGroupsText={uz.dashboard.guruh_yoq}
    />
  );
}
