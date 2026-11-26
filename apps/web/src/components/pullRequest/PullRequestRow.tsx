import type { PullRequestAction } from "@t3tools/contracts";
import { contextMenuSourceOf } from "../../contextMenuSource";
import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import { T } from "gt-react";
import { SearchIcon } from "lucide-react";
import { PullRequestChangeBreakdownStat } from "./PullRequestChangeBreakdownStat";
import { PullRequestStackPopover } from "./PullRequestStackPopover";
import {
  PullRequestSpeedActions,
  type PullRequestSpeedActionResult,
} from "./PullRequestSpeedActions";
import { memo, type RefCallback } from "react";

import { cn } from "~/lib/utils";
import { getSourceControlPresentationForKind } from "~/sourceControlPresentation";

import { SharedTooltipTrigger } from "../ui/shared-tooltip";
import { PullRequestChecksPopover } from "./PullRequestChecksPopover";
import { pullRequestPanelReference } from "./usePullRequestDetail";
import type { EnvironmentPullRequestEntry } from "./pullRequestList.logic";
import { openOnHostLabel, showPullRequestLinkContextMenu } from "./pullRequestLinkContextMenu";
import {
  PullRequestRowAuthor,
  PullRequestRowGlyph,
  STACKED_ROW_CLASS,
  StackedRowLines,
} from "./PullRequestListRow";
import { PullRequestPrivateMark } from "./PullRequestDetailLayout";
import { PullRequestLabelChip, PullRequestReviewDecisionGlyph } from "./pullRequestPresentation";

/** Each wider row shows one more chip; the count of the rest sits after the last chip shown. */
function PullRequestRowLabels({ labels }: { labels: EnvironmentPullRequestEntry["labels"] }) {
  const [first, second, third] = labels;
  if (!first) return null;
  const overflow = (shown: number) => labels.length - shown;
  return (
    <span className="flex min-w-0 items-center gap-1">
      <PullRequestLabelChip label={first} />
      {second ? (
        <PullRequestLabelChip label={second} className="hidden @xl/pr-row-meta:inline-flex" />
      ) : null}
      {third ? (
        <PullRequestLabelChip label={third} className="hidden @3xl/pr-row-meta:inline-flex" />
      ) : null}
      {overflow(1) > 0 ? (
        <span className="ml-0.5 shrink-0 tabular-nums @xl/pr-row-meta:hidden">+{overflow(1)}</span>
      ) : null}
      {overflow(2) > 0 ? (
        <span className="ml-0.5 hidden shrink-0 tabular-nums @xl/pr-row-meta:inline @3xl/pr-row-meta:hidden">
          +{overflow(2)}
        </span>
      ) : null}
      {overflow(3) > 0 ? (
        <span className="ml-0.5 hidden shrink-0 tabular-nums @3xl/pr-row-meta:inline">
          +{overflow(3)}
        </span>
      ) : null}
    </span>
  );
}

export type PullRequestRowTarget = Pick<
  EnvironmentPullRequestEntry,
  "environmentId" | "projectId" | "host" | "repository" | "number"
>;

function PullRequestRowImpl({
  entry,
  selected,
  showProjectTitle,
  showProvider,
  environmentLabel,
  matchedElsewhere,
  statsKey,
  statsRef,
  onSelect,
  onIntent,
  hostActions,
  onActed,
  closing = false,
  sweeping = false,
  onCloseSweepStart,
}: {
  entry: EnvironmentPullRequestEntry;
  selected: boolean;
  showProjectTitle: boolean;
  showProvider: boolean;
  environmentLabel?: string;
  matchedElsewhere?: boolean;
  /** Visibility key for deferred line-count reads. */
  statsKey?: string;
  statsRef?: RefCallback<HTMLDivElement>;
  onSelect: (entry: PullRequestRowTarget) => void;
  /** The row the pointer or focus rests on, or null when it leaves. */
  onIntent?: (entry: PullRequestRowTarget | null) => void;
  hostActions: ReadonlySet<PullRequestAction>;
  onActed: (result: PullRequestSpeedActionResult) => void;
  closing?: boolean;
  sweeping?: boolean;
  onCloseSweepStart?: (entry: EnvironmentPullRequestEntry, event: PointerEvent) => void;
}) {
  const { Icon, providerName, terminology } = getSourceControlPresentationForKind(entry.provider);
  return (
    <div
      ref={statsRef}
      data-pull-request-stats-key={statsKey}
      data-pull-request-key={statsKey}
      className={cn(STACKED_ROW_CLASS, selected ? "bg-accent" : "hover:bg-accent/60")}
    >
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={() => onSelect(entry)}
        onPointerEnter={() => onIntent?.(entry)}
        onPointerLeave={(event) => {
          if (event.currentTarget !== document.activeElement) onIntent?.(null);
        }}
        onFocus={() => onIntent?.(entry)}
        onBlur={(event) => {
          if (!event.currentTarget.matches(":hover")) onIntent?.(null);
        }}
        className="@container/pr-row-meta flex min-w-0 flex-1 cursor-pointer items-center rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <StackedRowLines
          glyph={
            <PullRequestRowGlyph
              state={entry.state}
              isDraft={entry.isDraft}
              mergeability={entry.mergeability}
              baseBranch={entry.baseBranch}
              glyphClassName="size-3.5"
            />
          }
          heading={
            <>
              <span
                className="shrink-0 tabular-nums"
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void showPullRequestLinkContextMenu({
                    url: entry.url,
                    openLabel: openOnHostLabel(sourceControlClients.get(entry.provider)),
                    position: { x: event.clientX, y: event.clientY },
                    source: contextMenuSourceOf(event),
                  });
                }}
              >
                #{entry.number}
              </span>
              {showProvider ? (
                <SharedTooltipTrigger
                  render={<span className="inline-flex shrink-0" />}
                  label={providerName}
                >
                  <Icon aria-label={providerName} className="size-3" />
                </SharedTooltipTrigger>
              ) : null}
              {entry.visibility === "private" ? (
                <PullRequestPrivateMark className="size-3 shrink-0" />
              ) : null}
              {showProjectTitle ? <span className="truncate">· {entry.repository}</span> : null}
              {environmentLabel ? (
                <span className="min-w-0 max-w-32 truncate">· {environmentLabel}</span>
              ) : null}
            </>
          }
          title={entry.title}
          updatedAt={entry.updatedAt}
          meta={
            <>
              {matchedElsewhere ? (
                <SharedTooltipTrigger
                  render={
                    <span className="flex min-w-6 shrink-0 items-center gap-1 overflow-hidden rounded-full border border-border/80 px-1 text-3xs" />
                  }
                  label={
                    <>
                      <T>Matched in the description</T>
                    </>
                  }
                >
                  <span className="sr-only">
                    <T>matched in the description</T>
                  </span>
                  <SearchIcon aria-hidden className="size-3 shrink-0" />
                </SharedTooltipTrigger>
              ) : null}
              <PullRequestRowAuthor actor={entry.author} className="max-w-40 shrink-0" />
              {entry.labels.length > 0 ? <PullRequestRowLabels labels={entry.labels} /> : null}
            </>
          }
          trailing={
            <>
              {/* Fixed slots, so checks, review, and line counts line up down the list. */}
              <span className="inline-flex w-4 justify-center">
                {entry.checksState === undefined ? null : (
                  <PullRequestChecksPopover
                    checksState={entry.checksState}
                    environmentId={entry.environmentId}
                    reference={{
                      ...pullRequestPanelReference({ ...entry, host: entry.host.toLowerCase() }),
                      allowStale: false,
                    }}
                  />
                )}
              </span>
              <span className="inline-flex w-4 justify-center">
                {entry.reviewDecision === undefined ? null : (
                  <PullRequestReviewDecisionGlyph decision={entry.reviewDecision} />
                )}
              </span>
              {entry.stack ? (
                <PullRequestStackPopover
                  environmentId={entry.environmentId}
                  reference={{
                    projectId: entry.projectId,
                    host: entry.host,
                    repository: entry.repository,
                    number: entry.number,
                  }}
                  membership={entry.stack}
                  onSelect={(target) =>
                    onSelect({ ...target, host: entry.host, environmentId: entry.environmentId })
                  }
                />
              ) : null}
              <span className="inline-flex min-w-20 justify-end">
                <PullRequestChangeBreakdownStat
                  environmentId={entry.environmentId}
                  reference={{
                    projectId: entry.projectId,
                    host: entry.host,
                    repository: entry.repository,
                    number: entry.number,
                  }}
                  additions={entry.additions}
                  deletions={entry.deletions}
                  className="tabular-nums"
                />
              </span>
            </>
          }
        />
      </button>
      {hostActions.size > 0 ? (
        <PullRequestSpeedActions
          entry={entry}
          hostActions={hostActions}
          terminology={terminology}
          onActed={onActed}
          closing={closing}
          sweeping={sweeping}
          {...(onCloseSweepStart ? { onCloseSweepStart } : {})}
        />
      ) : null}
    </div>
  );
}

export const PullRequestRow = memo(PullRequestRowImpl);
