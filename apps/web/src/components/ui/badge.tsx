import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "bg-foreground/90 text-background [a&]:hover:bg-foreground",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive border-destructive/20 [a&]:hover:bg-destructive/15 dark:bg-destructive/20 dark:text-destructive-foreground",
        success:
          "bg-success/10 text-success border-success/25 [a&]:hover:bg-success/15 dark:bg-success/20 dark:text-success-foreground",
        warning:
          "bg-warning/15 text-warning-foreground border-warning/30 [a&]:hover:bg-warning/20",
        outline:
          "border-border text-muted-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "text-muted-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
