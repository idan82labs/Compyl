"use client";

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--compyl-status-error-bg)]">
        <svg
          className="h-6 w-6 text-[var(--compyl-status-error-dot)]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-[var(--compyl-status-error-text)]">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md bg-[var(--compyl-accent)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--compyl-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--compyl-accent)] focus:ring-offset-2"
        >
          Retry
        </button>
      )}
    </div>
  );
}
