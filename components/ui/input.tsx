import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Base class untuk semua kontrol formulir.
 * Border, radius, tinggi, warna, dan focus ring hanya didefinisikan di sini —
 * halaman yang butuh `<select>` atau padding berbeda cukup `cn(FIELD, override)`.
 */
export const FIELD =
  "flex h-10 w-full rounded-[var(--radius-md)] border border-black/[0.12] bg-[var(--surface)] px-3 text-body text-[var(--ink)] shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] placeholder:text-[var(--ink-2)] focus-visible:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand)]/25 disabled:cursor-not-allowed disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(FIELD, className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(FIELD, "appearance-none pr-8", className)} {...props} />
  ),
);
Select.displayName = "Select";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(FIELD, "h-auto min-h-[80px] py-2", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("block text-caption font-medium text-[var(--ink)]", className)} {...props} />
  ),
);
Label.displayName = "Label";

/** Input + label + pesan error. Satu komponen, dipakai di semua form. */
export function Field({
  label,
  error,
  hint,
  required,
  className,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-[var(--danger-ink)]"> *</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-label text-[var(--danger-ink)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-label text-[var(--ink-2)]">{hint}</p>
      ) : null}
    </div>
  );
}
