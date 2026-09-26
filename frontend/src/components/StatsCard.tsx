interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "green" | "purple" | "orange";
}

const colorMap = {
  blue:   { bg: "bg-blue-50",   icon: "bg-blue-100 text-blue-600",   value: "text-blue-700" },
  green:  { bg: "bg-green-50",  icon: "bg-green-100 text-green-600", value: "text-green-700" },
  purple: { bg: "bg-purple-50", icon: "bg-purple-100 text-purple-600", value: "text-purple-700" },
  orange: { bg: "bg-orange-50", icon: "bg-orange-100 text-orange-600", value: "text-orange-700" },
};

export default function StatsCard({ title, value, icon, color }: StatsCardProps) {
  const c = colorMap[color];
  return (
    <div className={`${c.bg} rounded-2xl p-6 flex items-center gap-5`}>
      <div className={`${c.icon} rounded-xl p-3`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className={`text-3xl font-bold ${c.value}`}>{value}</p>
      </div>
    </div>
  );
}
