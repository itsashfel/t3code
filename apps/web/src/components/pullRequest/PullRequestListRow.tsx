import type {
  PullRequestActor,
  PullRequestMergeability,
  PullRequestState,
} from "@t3tools/contracts";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";
import { RelativeTime } from "~/components/RelativeTime";

import { MiddleTruncate } from "../ui/middle-truncate";
import {
  PullRequestActorAvatar,
  PullRequestConflictGlyph,
  PullRequestStateGlyph,
} from "./pullRequestPresentation";
import { SharedTooltipTrigger } from "../ui/shared-tooltip";

/** A stacked row's own box; the intrinsic size matches three lines so skipped rows keep their height. */
export const STACKED_ROW_CLASS =
  "flex items-center rounded-lg [content-visibility:auto] [contain-intrinsic-block-size:80px]";

export const PULL_REQUEST_ROW_CLASS =
  "group/pr-row flex w-full items-center gap-2 rounded-md py-1 pr-1 text-left";

export const PULL_REQUEST_ROW_NUMBER_CLASS = "shrink-0 text-xs tabular-nums text-muted-foreground";

export function PullRequestRowGlyph({
  state,
  isDraft,
  mergeability,
  baseBranch,
  below,
  className,
  glyphClassName,
}: {
  state: PullRequestState;
  isDraft: boolean;
  mergeability?: PullRequestMergeability | undefined;
  baseBranch?: string | undefined;
  below?: ReactNode;
  className?: string;
  glyphClassName?: string;
}) {
  return (
    <span className={cn("flex w-4 shrink-0 flex-col items-center gap-0.5", className)}>
      <span className="relative inline-flex">
        <PullRequestStateGlyph
          state={state}
          isDraft={isDraft}
          {...(glyphClassName === undefined ? {} : { className: glyphClassName })}
        />
        {/* Offset the wrapper to keep the badge-sized tooltip trigger anchored. */}
        <span className="absolute -right-1 -bottom-1 inline-flex">
          <PullRequestConflictGlyph
            state={state}
            isDraft={isDraft}
            {...(mergeability === undefined ? {} : { mergeability })}
            {...(baseBranch === undefined ? {} : { baseBranch })}
            className="size-3 fill-background [stroke-width:2.5]"
          />
        </span>
      </span>
      {below ? <span className="inline-flex text-2xs">{below}</span> : null}
    </span>
  );
}

export function PullRequestRowLines({
  number,
  title,
  status,
  signals,
  meta,
  metaClassName,
  updatedAt,
}: {
  number: ReactNode;
  title: ReactNode;
  status?: ReactNode;
  signals?: ReactNode;
  meta?: ReactNode;
  metaClassName?: string;
  updatedAt?: string | null | undefined;
}) {
  return (
    <span className="min-w-0 flex-1">
      <span className="flex min-w-0 items-center gap-1.5">
        {number}
        <span className="min-w-0 truncate text-sm">{title}</span>
        {signals ? (
          <span className="flex shrink-0 items-center gap-1 text-2xs">{signals}</span>
        ) : null}
        {status ? (
          <span className="ml-auto flex shrink-0 items-center gap-1.5 text-2xs">{status}</span>
        ) : null}
      </span>
      <span
        className={cn(
          "flex min-w-0 items-center gap-1.5 overflow-hidden text-2xs text-muted-foreground",
          metaClassName,
        )}
      >
        {meta}
        {updatedAt ? (
          <span className="ml-auto shrink-0 whitespace-nowrap tabular-nums">
            <RelativeTime timestamp={updatedAt} />
          </span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * The list pages' row, shaped like a thread in the sidebar: where it lives on top, the title in
 * the middle, who and what underneath. `dimmed` is a parent shown only to hold its children.
 */
export function StackedRowLines({
  glyph,
  heading,
  title,
  meta,
  trailing,
  updatedAt,
  dimmed = false,
}: {
  glyph: ReactNode;
  heading: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  updatedAt?: string | null | undefined;
  dimmed?: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="flex h-4 min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        {glyph}
        <span className="flex min-w-0 items-center gap-1 truncate">{heading}</span>
        {updatedAt ? (
          <span className="ml-auto shrink-0 whitespace-nowrap pl-2 tabular-nums">
            <RelativeTime timestamp={updatedAt} />
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "min-w-0 truncate text-sm leading-5",
          dimmed ? "text-muted-foreground" : "font-medium text-foreground",
        )}
      >
        {title}
      </span>
      {meta || trailing ? (
        <span className="flex h-4 min-w-0 items-center gap-1.5 overflow-hidden text-xs text-muted-foreground">
          {meta}
          {trailing ? (
            <span className="ml-auto flex shrink-0 items-center gap-2 pl-2">{trailing}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

/** Children of a row sit under it on a guide that starts below the parent's glyph. */
export function StackedRowChildren({ children }: { children: ReactNode }) {
  return (
    <div className="ml-4.75 flex flex-col gap-1 border-l border-border/70 pl-1">{children}</div>
  );
}

export function PullRequestRowAuthor({
  actor,
  className,
  labelClassName,
}: {
  actor: PullRequestActor | null;
  className?: string;
  labelClassName?: string;
}) {
  const login = actor?.login ?? "ghost";
  return (
    <SharedTooltipTrigger
      render={<span className={cn("inline-flex min-w-0 items-center gap-1", className)} />}
      label={actor?.name && actor.name !== login ? `${actor.name} (@${login})` : login}
    >
      <PullRequestActorAvatar actor={actor} className="size-3.5" />
      <span className={cn("truncate", labelClassName)}>{login}</span>
    </SharedTooltipTrigger>
  );
}

export function PullRequestRowBranches({ head, base }: { head: string; base: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1 tabular-nums">
      <MiddleTruncate value={head} />
      <span className="shrink-0">→</span>
      <MiddleTruncate value={base} className="max-w-[45%] shrink-0" />
    </span>
  );
}
