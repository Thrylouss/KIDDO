import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  suffix?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, suffix, className = "", id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--text)]">
            {label}
            {props.required && <span className="text-[#EF4444] ml-0.5">*</span>}
          </label>
        )}

        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={[
              "w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-[var(--text)]",
              "placeholder:text-[var(--text-3)] outline-none transition-all duration-150 kiddo-input",
              error
                ? "border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/20"
                : "border-[var(--border)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[#8E315D]/15",
              suffix ? "pr-11" : "",
              className,
            ].join(" ")}
            {...props}
          />
          {suffix && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {suffix}
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-[#EF4444] flex items-center gap-1">
            <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}

        {hint && !error && (
          <p className="text-xs text-[var(--text-2)]">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
