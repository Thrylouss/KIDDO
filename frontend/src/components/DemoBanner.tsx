import uz from "@/i18n";

export default function DemoBanner() {
  return (
    <div
      className="flex items-center justify-center gap-2.5 flex-shrink-0 px-4 py-2.5 text-sm font-medium z-10"
      style={{
        background: "linear-gradient(90deg, var(--warning-bg) 0%, var(--warning-border) 50%, var(--warning-bg) 100%)",
        borderBottom: "2px solid #F59E0B",
        color: "var(--warning-text)",
      }}
    >
      <svg
        className="h-4 w-4 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
        />
      </svg>
      <span>
        <strong>{uz.ui.demo_rejimi_katta}</strong>
        {" "}—{" "}
        {uz.ui.demo_banner}
      </span>
    </div>
  );
}
