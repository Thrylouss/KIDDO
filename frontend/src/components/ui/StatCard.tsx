interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: string; // kept for call-site compatibility, not used
}

export default function StatCard({ title, value, subtitle, icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-6 hover:shadow-sm transition-shadow duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-[var(--text-2)]">{title}</p>
        <div className="bg-[var(--primary-lt)] text-[var(--primary)] rounded-xl p-2.5 group-hover:bg-[var(--primary-md)] transition-colors duration-200">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold tracking-tight text-[var(--text)]">{value.toLocaleString()}</p>
      {subtitle && <p className="mt-1 text-xs text-[var(--text-3)]">{subtitle}</p>}
    </div>
  );
}
