type Variant = "success" | "warning" | "error" | "info" | "neutral";

const cls: Record<Variant, string> = {
  success: "bg-[#DCFCE7] text-[#166534]",
  warning: "bg-[#FEF9C3] text-[#854D0E]",
  error:   "bg-[#FEE2E2] text-[#991B1B]",
  info:    "bg-[#DBEAFE] text-[#1E40AF]",
  neutral: "bg-[#F3F4F6] text-[#374151]",
};

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
}

export default function Badge({ variant = "neutral", children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls[variant]}`}>
      {children}
    </span>
  );
}
