type Variant = "success" | "warning" | "error" | "info" | "neutral";

const cls: Record<Variant, string> = {
  success: "bg-[var(--success-bg)] text-[var(--success)]",
  warning: "bg-[var(--warning-bg)] text-[var(--warning)]",
  error:   "bg-[var(--error-bg)] text-[var(--error)]",
  info:    "bg-[var(--info-bg)] text-[var(--primary)]",
  neutral: "bg-[var(--border-2)] text-[var(--text-2)]",
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
