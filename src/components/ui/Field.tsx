"use client";

import { forwardRef, useId, useState } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/**
 * A labelled form control. The label, hint and error are wired to the control
 * with ids so screen readers announce them; pass the control as children or
 * use the Input / Select / Textarea shorthands below.
 */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

type Extra = { label?: ReactNode; hint?: ReactNode; error?: string | null };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Extra>(
  function Input({ label, hint, error, id, className = "", ...rest }, ref) {
    const auto = useId();
    const fieldId = id ?? auto;
    return (
      <Field label={label} hint={hint} error={error} htmlFor={fieldId}>
        <input ref={ref} id={fieldId} aria-invalid={!!error || undefined} className={`input ${className}`} {...rest} />
      </Field>
    );
  },
);

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement> & Extra) {
  const [shown, setShown] = useState(false);
  const auto = useId();
  const { label, hint, error, id, ...rest } = props;
  const fieldId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={fieldId}>
      <div className="relative">
        <input
          id={fieldId}
          type={shown ? "text" : "password"}
          aria-invalid={!!error || undefined}
          className="input pr-16"
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-primary"
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
    </Field>
  );
}

export function Select({
  label,
  hint,
  error,
  id,
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & Extra) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={fieldId}>
      <select id={fieldId} aria-invalid={!!error || undefined} className={`input ${className}`} {...rest}>
        {children}
      </select>
    </Field>
  );
}

export function Textarea({
  label,
  hint,
  error,
  id,
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & Extra) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={fieldId}>
      <textarea id={fieldId} aria-invalid={!!error || undefined} className={`input min-h-24 ${className}`} {...rest} />
    </Field>
  );
}

/** A 6-digit authenticator code. */
export function CodeInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & Extra) {
  return (
    <Input
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="123456"
      className="font-mono tracking-[0.3em]"
      {...props}
      onChange={(e) => {
        e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
        props.onChange?.(e);
      }}
    />
  );
}
