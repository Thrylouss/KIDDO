import React from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size    = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantCls: Record<Variant, string> = {
  primary:   "bg-[#2563EB] text-white hover:bg-[#1D4ED8] focus-visible:ring-[#2563EB]/40 disabled:bg-[#2563EB]/50",
  secondary: "bg-white text-[#111827] border border-[#E5E7EB] hover:bg-[#F8FAFC] focus-visible:ring-[#2563EB]/30",
  danger:    "bg-[#EF4444] text-white hover:bg-[#DC2626] focus-visible:ring-[#EF4444]/40 disabled:bg-[#EF4444]/50",
  ghost:     "bg-transparent text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] focus-visible:ring-[#2563EB]/30",
};

const sizeCls: Record<Size, string> = {
  sm: "h-8  px-3   text-xs  gap-1.5",
  md: "h-10 px-4   text-sm  gap-2",
  lg: "h-11 px-5   text-sm  gap-2",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  fullWidth = false,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center font-medium rounded-lg",
        "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2",
        "disabled:cursor-not-allowed active:scale-[0.98]",
        variantCls[variant],
        sizeCls[size],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...props}
    >
      {loading ? (
        <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
