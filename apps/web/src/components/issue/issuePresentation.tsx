import type { IssuePriority, IssueState, IssueTrackerKind } from "@t3tools/contracts";
import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import { CircleCheckIcon, CircleDotIcon, CircleSlashIcon, TicketIcon } from "lucide-react";
import { msg, useMessages } from "gt-react";

import { cn } from "~/lib/utils";
import { LinearIcon, type Icon } from "~/components/Icons";
import { getSourceControlPresentationForKind } from "~/sourceControlPresentation";

import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { PULL_REQUEST_STATE_PRESENTATION } from "../pullRequest/pullRequestIcons";

export const IssueGlyph = { issue: CircleDotIcon } as const;

/** Name and mark per standalone tracker kind; one missing here falls back to its kind and a ticket. */
const STANDALONE_TRACKERS: Partial<Record<string, { providerName: string; Icon: Icon }>> = {
  linear: { providerName: "Linear", Icon: LinearIcon },
};

/** A git host's tracker wears the host's own icon and name; a standalone tracker wears its kind. */
export function issueTrackerPresentation(tracker: IssueTrackerKind | string) {
  if (sourceControlClients.find(tracker) !== undefined) {
    return getSourceControlPresentationForKind(tracker);
  }
  return STANDALONE_TRACKERS[tracker] ?? { providerName: tracker, Icon: TicketIcon };
}

/**
 * Open and completed borrow the ink the pull-request states use for open and merged, so green
 * and violet mean the same thing on both pages; closed any other way than completed wears a
 * draft's grey, because work that stopped must not look like work that finished. The tracker's own state name is the label,
 * so a workflow tracker's "In Review" reads as itself.
 */
export function issueStatePresentation(state: IssueState) {
  if (state.category === "open") {
    return {
      ...PULL_REQUEST_STATE_PRESENTATION.open,
      label: state.name,
      Icon: CircleDotIcon,
    };
  }
  if (state.closeReason !== undefined && state.closeReason !== "completed") {
    return {
      ...PULL_REQUEST_STATE_PRESENTATION.draft,
      label: state.name,
      Icon: CircleSlashIcon,
    };
  }
  return {
    ...PULL_REQUEST_STATE_PRESENTATION.merged,
    label: state.name,
    Icon: CircleCheckIcon,
  };
}

export function IssueStateGlyph({ state, className }: { state: IssueState; className?: string }) {
  const presentation = issueStatePresentation(state);
  return (
    <Tooltip>
      {/* The list row is itself a button, so the trigger stays a span. */}
      <TooltipTrigger render={<span className="inline-flex shrink-0" />}>
        <presentation.Icon
          role="img"
          aria-label={presentation.label}
          className={cn("size-4 shrink-0", presentation.toneClassName, className)}
        />
      </TooltipTrigger>
      <TooltipPopup>{presentation.label}</TooltipPopup>
    </Tooltip>
  );
}

const PRIORITY_LABELS = {
  1: msg("Urgent", { $context: "issue priority" }),
  2: msg("High", { $context: "issue priority" }),
  3: msg("Medium", { $context: "issue priority" }),
  4: msg("Low", { $context: "issue priority" }),
} as const;

/** Linear's marks: a filled square for urgent, then three bars lit by how high the rest go. */
export function IssuePriorityGlyph({ priority }: { priority: IssuePriority }) {
  const resolve = useMessages();
  const label = resolve(PRIORITY_LABELS[priority]);
  const lit = 4 - priority + 1;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex shrink-0" />}>
        {priority === 1 ? (
          <svg role="img" aria-label={label} viewBox="0 0 14 14" className="size-3.5 shrink-0">
            <rect width="14" height="14" rx="3" className="fill-warning/20" />
            <path
              d="M7 3.5v4.25M7 10.25v.25"
              className="stroke-warning"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg role="img" aria-label={label} viewBox="0 0 14 14" className="size-3.5 shrink-0">
            {[0, 1, 2].map((bar) => (
              <rect
                key={bar}
                x={1.5 + bar * 4}
                y={8 - bar * 3}
                width="3"
                height={5 + bar * 3}
                rx="1"
                className={bar < lit ? "fill-current" : "fill-current opacity-30"}
              />
            ))}
          </svg>
        )}
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}
