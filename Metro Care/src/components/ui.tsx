import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react"
import { X } from "lucide-react"

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: "primary" | "secondary" | "danger" | "ghost"
}) {
  const styles = {
    primary: "bg-orange-500 text-white hover:bg-orange-600 shadow-sm",
    secondary:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-red-50 text-red-700 hover:bg-red-100",
    ghost: "text-slate-600 hover:bg-slate-100",
  }
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ${className}`}
    >
      {children}
    </section>
  )
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "neutral" | "red" | "orange" | "green" | "blue" | "purple"
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600",
    red: "bg-red-50 text-red-700 ring-red-600/10",
    orange: "bg-orange-50 text-orange-700 ring-orange-600/10",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    blue: "bg-blue-50 text-blue-700 ring-blue-600/10",
    purple: "bg-violet-50 text-violet-700 ring-violet-600/10",
  }
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
      {label}
      {children}
      {hint && (
        <span className="text-xs font-normal text-slate-500">{hint}</span>
      )}
    </label>
  )
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="text-lg font-bold text-slate-900">{title}</div>
          <Button
            variant="ghost"
            className="!min-h-9 !px-2"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const inputClass =
  "min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
