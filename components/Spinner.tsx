import * as React from "react";

type SpinnerProps = {
  size?: number;
  className?: string;
  label?: string;
};

/**
 * Tiny inline spinner used inside buttons / next to "Saving…" labels so the
 * user gets a clear visual cue that a background action is in flight.
 */
export function Spinner({ size = 14, className = "", label }: SpinnerProps) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-live={label ? "polite" : undefined}
      className={"inline-flex items-center gap-1.5 align-middle " + className}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="animate-spin"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="3"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span>{label}</span> : null}
    </span>
  );
}

export default Spinner;
