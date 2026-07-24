import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        neutral: "bg-muted text-muted-foreground",
        success: "bg-emerald-500/12 text-emerald-700",
        warning: "bg-amber-500/15 text-amber-700",
        danger: "bg-destructive/12 text-destructive",
        info: "bg-accent/12 text-accent",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export type BadgeVariant = NonNullable<
  VariantProps<typeof badgeVariants>["variant"]
>;

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/** Map an attendance status to a badge variant. */
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  PRESENT: "success",
  LATE: "warning",
  OUTSIDE_LOCATION: "danger",
  LOW_GPS_ACCURACY: "warning",
  MANUAL: "info",
  REJECTED: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  const t = useT();
  const key = `status.${status}` as MessageKey;
  const label = t(key);
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "neutral"}>
      {label === key ? status.replace(/_/g, " ") : label}
    </Badge>
  );
}

export { Badge, badgeVariants };
