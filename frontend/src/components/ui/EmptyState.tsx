import Button from "./Button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F3F4F6] text-[#9CA3AF]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-[#111827] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[#6B7280] max-w-sm">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          <Button onClick={action.onClick} size="sm">
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
