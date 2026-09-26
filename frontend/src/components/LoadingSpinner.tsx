export default function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = { sm: "h-4 w-4 border-2", md: "h-7 w-7 border-2", lg: "h-10 w-10 border-[3px]" }[size];
  return (
    <div className="flex items-center justify-center">
      <div className={`${s} rounded-full border-[#E5E7EB] border-t-[#2563EB] animate-spin`} />
    </div>
  );
}
