interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: string; // kept for call-site compatibility, not used
}

export default function StatCard({ title, value, subtitle, icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 hover:shadow-sm transition-shadow duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-[#6B7280]">{title}</p>
        <div className="bg-[#F3F4F6] text-[#9CA3AF] rounded-xl p-2.5 group-hover:text-[#6B7280] transition-colors duration-200">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold tracking-tight text-[#111827]">{value.toLocaleString()}</p>
      {subtitle && <p className="mt-1 text-xs text-[#9CA3AF]">{subtitle}</p>}
    </div>
  );
}
