import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

function Select({ className, children, ...props }: React.ComponentProps<"select">) {
    return (
        <div className="relative">
            <select
                data-slot="select"
                className={cn(
                    "border-input bg-background text-foreground h-9 w-full appearance-none rounded-md border px-3 py-1 pr-8 text-sm shadow-xs transition-[color,box-shadow] outline-none",
                    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                {...props}
            >
                {children}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
    )
}

// Minimal shadcn-compatible wrappers (noop wrappers for API compatibility)
function SelectTrigger({ children, className }: { children?: React.ReactNode; className?: string }) {
    return <div className={className}>{children}</div>
}
function SelectValue({ placeholder }: { placeholder?: string }) {
    return <span>{placeholder}</span>
}
function SelectContent({ children }: { children?: React.ReactNode }) {
    return <>{children}</>
}
function SelectItem({ value, children }: { value: string; children?: React.ReactNode }) {
    return <option value={value}>{children}</option>
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
