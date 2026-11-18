"use client";

import { IS_DEMO } from "@/lib/demo-data";
import PageHeader from "@/components/ui/PageHeader";
import AttendanceManager from "@/components/attendance/AttendanceManager";
import AttendanceTabs from "@/components/attendance/AttendanceTabs";
import MonthlyAttendance from "@/components/attendance/MonthlyAttendance";
import type { TeacherDashboard } from "@/types";
import uz from "@/i18n";
import { useLocale } from "@/contexts/PreferencesContext";

export default function TarbiyachiDavomatPage() {
  useLocale(); // til almashganda holat saqlangan holda qayta render
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title={uz.davomat.sarlavha} description={uz.davomat.tavsif} />
      {IS_DEMO ? (
        <p role="note" className="rounded-lg bg-[var(--warning-soft)] border border-[var(--warning-border)] text-[var(--warning-text)] text-sm px-4 py-3">{uz.davomat.demo_admin}</p>
      ) : (
        <AttendanceTabs
          daily={
            <AttendanceManager<TeacherDashboard>
              loadPath="/v1/teacher/dashboard"
              savePath="/v1/teacher/attendance"
              noGroupsText={uz.davomat.guruh_yoq_tarbiyachi}
            />
          }
          monthly={<MonthlyAttendance basePath="/v1/teacher/attendance" noGroupsText={uz.davomat.guruh_yoq_tarbiyachi} />}
        />
      )}
    </div>
  );
}
