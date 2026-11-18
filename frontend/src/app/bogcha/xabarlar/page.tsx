"use client";

import MessagesManager from "@/components/messages/MessagesManager";
import uz from "@/i18n";
import { useLocale } from "@/contexts/PreferencesContext";

export default function BogchaXabarlarPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  return (
    <MessagesManager
      messagesPath="/v1/admin/messages"
      childrenPath="/v1/admin/children"
      description={uz.bogcha_panel.xabarlar_tavsif}
      noGroupsText={uz.dashboard.guruh_yoq}
    />
  );
}
