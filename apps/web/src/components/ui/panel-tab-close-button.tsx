import { X } from "lucide-react";
import type { ReactNode } from "react";
import { SharedTooltipTrigger } from "~/components/ui/shared-tooltip";

interface PanelTabCloseButtonProps {
  /** The tab icon the close glyph replaces on hover. Without it, the button trails the title. */
  children?: ReactNode;
  label: string;
  onClick: () => void;
  tooltip?: string;
}

export function PanelTabCloseButton({
  children,
  label,
  onClick,
  tooltip,
}: PanelTabCloseButtonProps) {
  const button =
    children === undefined ? (
      <button
        type="button"
        // Floats over the end of the title, which fades out beneath it while the tab is hovered.
        className="absolute inset-y-0 right-1 my-auto hidden size-5 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:flex group-hover/tab:flex"
        aria-label={label}
        onClick={onClick}
      >
        <X className="size-3" />
      </button>
    ) : (
      <button
        type="button"
        className="cursor-pointer group/close relative flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-muted"
        aria-label={label}
        onClick={onClick}
      >
        <span className="relative flex size-3 items-center justify-center group-hover/tab:hidden group-focus-visible/close:hidden">
          {children}
        </span>
        <X className="hidden size-3 group-hover/tab:block group-focus-visible/close:block" />
      </button>
    );

  if (!tooltip) return button;

  return <SharedTooltipTrigger render={button} label={tooltip} />;
}
