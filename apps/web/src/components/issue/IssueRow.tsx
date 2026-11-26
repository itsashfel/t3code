import type { EnvironmentIssueEntry } from "@t3tools/client-runtime/issue-list";
import type { IssueParent } from "@t3tools/contracts";
import { MessageSquareIcon } from "lucide-react";
import { memo } from "react";

import { cn } from "~/lib/utils";

import {
  PullRequestRowAuthor,
  STACKED_ROW_CLASS,
  StackedRowLines,
} from "../pullRequest/PullRequestListRow";
import {
  PullRequestLabelChip,
  PullRequestActorAvatar,
} from "../pullRequest/pullRequestPresentation";
import { IssuePriorityGlyph, IssueStateGlyph } from "./issuePresentation";

export type IssueRowTarget = Pick<
  EnvironmentIssueEntry,
  "environmentId" | "projectId" | "tracker" | "host" | "scope" | "key" | "url"
>;

export interface IssueRowSlots {
  readonly priority: boolean;
  readonly assignees: boolean;
}

const ROW_BUTTON_CLASS =
  "flex min-w-0 flex-1 cursor-pointer items-center rounded-lg px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring";

function IssueRowImpl({
  entry,
  selected,
  showScope,
  slots,
  environmentLabel,
  onSelect,
}: {
  entry: EnvironmentIssueEntry;
  selected: boolean;
  /** Which property columns the list holds, so they line up across rows without empty gaps. */
  slots: IssueRowSlots;
  /** Only when the list spans more than one scope, where the key alone is ambiguous. */
  showScope: boolean;
  /** Names the server this row was read from, where the list spans more than one. */
  environmentLabel?: string | undefined;
  onSelect: (entry: IssueRowTarget) => void;
}) {
  const extraLabels = entry.labels.length - 2;
  return (
    <div className={cn(STACKED_ROW_CLASS, selected ? "bg-accent" : "hover:bg-accent/60")}>
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={() => onSelect(entry)}
        className={ROW_BUTTON_CLASS}
      >
        <StackedRowLines
          glyph={<IssueStateGlyph state={entry.state} className="size-3.5" />}
          heading={
            <>
              <span className="shrink-0 tabular-nums">{entry.displayKey}</span>
              {showScope ? <span className="truncate">· {entry.scope}</span> : null}
              {environmentLabel ? <span className="truncate">· {environmentLabel}</span> : null}
            </>
          }
          title={entry.title}
          updatedAt={entry.updatedAt}
          meta={
            <>
              <PullRequestRowAuthor actor={entry.author} className="max-w-40 shrink-0" />
              {entry.labels.slice(0, 2).map((label) => (
                <PullRequestLabelChip key={label.name} label={label} />
              ))}
              {extraLabels > 0 ? <span className="shrink-0">+{extraLabels}</span> : null}
            </>
          }
          trailing={
            <>
              {entry.commentCount > 0 ? (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <MessageSquareIcon aria-hidden className="size-3" />
                  {entry.commentCount}
                </span>
              ) : null}
              {/* Fixed slots, so priority and assignee line up down the list. */}
              {slots.priority ? (
                <span className="inline-flex w-3.5 justify-center">
                  {entry.priority === undefined ? null : (
                    <IssuePriorityGlyph priority={entry.priority} />
                  )}
                </span>
              ) : null}
              {slots.assignees ? (
                <span className="flex min-w-4 items-center justify-end -space-x-1">
                  {entry.assignees.slice(0, 3).map((assignee) => (
                    <PullRequestActorAvatar
                      key={assignee.login}
                      actor={assignee}
                      className="size-4 ring-1 ring-background"
                    />
                  ))}
                </span>
              ) : null}
            </>
          }
        />
      </button>
    </div>
  );
}

export const IssueRow = memo(IssueRowImpl);

/**
 * A parent the list does not hold, shown quietly so its sub-issues read as one piece of work.
 * Choosing it opens the parent like any other issue.
 */
export function IssueParentRow({
  parent,
  child,
  selected,
  onSelect,
}: {
  parent: IssueParent;
  /** Any listed sub-issue, which says where the parent lives. */
  child: EnvironmentIssueEntry;
  selected: boolean;
  onSelect: (entry: IssueRowTarget) => void;
}) {
  return (
    <div
      className={cn(
        "flex h-7 items-center rounded-lg",
        selected ? "bg-accent" : "hover:bg-accent/60",
      )}
    >
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={() => onSelect({ ...child, key: parent.key, url: parent.url })}
        className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-left text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <IssueStateGlyph state={parent.state} className="size-3.5 opacity-60" />
        <span className="shrink-0 tabular-nums">{parent.displayKey}</span>
        <span className="shrink-0 text-muted-foreground/60">· {parent.state.name} ·</span>
        <span className="min-w-0 truncate">{parent.title}</span>
      </button>
    </div>
  );
}
