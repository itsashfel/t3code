import type { ComponentProps, ReactNode } from "react";

import { cn } from "../../lib/utils";

export function ThreadDetailsSection({
  headingId,
  title,
  actions,
  showHeading = true,
  children,
  ...props
}: Omit<ComponentProps<"section">, "className" | "style" | "title" | "aria-labelledby"> & {
  headingId: string;
  title: string;
  actions?: ReactNode;
  showHeading?: boolean;
}) {
  return (
    <section
      {...props}
      aria-labelledby={showHeading ? headingId : undefined}
      aria-label={showHeading ? undefined : title}
      // A row can still render nothing (a fresh draft quiets Git actions), so an empty section collapses.
      className="px-2 pt-2 has-[>div:last-child:empty]:hidden has-[>div:last-child>:only-child:empty]:hidden"
    >
      <div
        className={cn(
          "flex min-h-7 min-w-0 items-center justify-between gap-2 px-2.5",
          !showHeading && "hidden",
        )}
      >
        <h3
          id={headingId}
          className="min-w-0 truncate text-2xs font-medium text-muted-foreground select-none"
        >
          {title}
        </h3>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      <div className="rounded-xl bg-black/[0.025] p-0.5 dark:bg-white/[0.035]">{children}</div>
    </section>
  );
}
