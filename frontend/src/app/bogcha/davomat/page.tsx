"use client";

import { IS_DEMO } from "@/lib/demo-data";
import PageHeader from "@/components/ui/PageHeader";
import AttendanceManager from "@/components/attendance/AttendanceManager";
import AttendanceTabs from "@/components/attendance/AttendanceTabs";
import MonthlyAttendance from "@/components/attendance/MonthlyAttendance";
import type { AttendanceDay } from "@/types";
import uz from "@/i18n/uz";

export default function DavomatPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title={uz.davomat.sarlavha} description={uz.davomat.tavsif} />
      {IS_DEMO ? (
        <p role="note" className="rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-sm px-4 py-3">
          {uz.davomat.demo_admin}
        </p>
      ) : (
        <AttendanceTabs
          daily={
            <AttendanceManager<AttendanceDay>
              loadPath="/v1/admin/attendance"
              savePath="/v1/admin/attendance"
              noGroupsText={uz.davomat.guruh_yoq_admin}
            />
          }
          monthly={<MonthlyAttendance basePath="/v1/admin/attendance" noGroupsText={uz.davomat.guruh_yoq_admin} />}
        />
      )}
    </div>
  );
}
