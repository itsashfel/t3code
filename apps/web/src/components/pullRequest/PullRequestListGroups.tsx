import type { EnvironmentId, PullRequestAction } from "@t3tools/contracts";
import { EyeIcon, LayersIcon, PenLineIcon, UsersIcon, type LucideIcon } from "lucide-react";
import { useMessages } from "gt-react";
import { useDeferredValue, type ReactNode, type RefCallback } from "react";

import { nestListRows, type ListTreeItem } from "~/lib/nestListRows";

import { cn } from "~/lib/utils";
import { Separator } from "../ui/separator";
import {
  pullRequestEntryKey,
  scorePullRequestMatch,
  type EnvironmentPullRequestEntry,
  type PullRequestGroup,
} from "./pullRequestList.logic";
import { PullRequestRow, type PullRequestRowTarget } from "./PullRequestRow";
import { StackedRowChildren } from "./PullRequestListRow";
import {
  PullRequestSpeedModeProvider,
  type PullRequestSpeedActionResult,
} from "./PullRequestSpeedActions";

const GROUP_ICONS: Record<string, LucideIcon> = {
  authored: PenLineIcon,
  reviewRequested: EyeIcon,
  others: UsersIcon,
};

const MATCHED_ELSEWHERE_SCORE = 10;

const branchKey = (entry: EnvironmentPullRequestEntry, branch: string) =>
  `${entry.environmentId}\u0000${entry.host.toLowerCase()}\u0000${entry.repository.toLowerCase()}\u0000${branch}`;

/** A pull request based on another open one's branch sits under it, as its stack reads. */
function nestStackedPullRequests(entries: ReadonlyArray<EnvironmentPullRequestEntry>) {
  const openHeads = new Map(
    entries.flatMap((entry) =>
      entry.state === "open"
        ? [[branchKey(entry, entry.headBranch), pullRequestEntryKey(entry)] as const]
        : [],
    ),
  );
  return nestListRows(entries, pullRequestEntryKey, (entry) =>
    openHeads.get(branchKey(entry, entry.baseBranch)),
  );
}

function PullRequestTreeItems({
  items,
  renderRow,
}: {
  items: ReadonlyArray<ListTreeItem<EnvironmentPullRequestEntry>>;
  renderRow: (entry: EnvironmentPullRequestEntry) => ReactNode;
}) {
  return items.map((item) =>
    item.kind === "row" ? (
      <div key={pullRequestEntryKey(item.row)} className="flex flex-col gap-1">
        {renderRow(item.row)}
        {item.children.length === 0 ? null : (
          <StackedRowChildren>
            <PullRequestTreeItems items={item.children} renderRow={renderRow} />
          </StackedRowChildren>
        )}
      </div>
    ) : (
      // Only listed parents are named, so every child here is a row of its own.
      <PullRequestTreeItems key={item.parentKey} items={item.children} renderRow={renderRow} />
    ),
  );
}
const FIRST_PAINT_ROWS = 24;

function firstPaintGroups<Group extends { entries: ReadonlyArray<unknown> }>(
  groups: ReadonlyArray<Group>,
): ReadonlyArray<Group> {
  let left = FIRST_PAINT_ROWS;
  return groups.flatMap((group) => {
    const entries = group.entries.slice(0, left);
    left -= entries.length;
    return entries.length === 0 ? [] : [{ ...group, entries }];
  });
}

function PullRequestGroupHeader({
  group,
  count,
}: {
  group: { key: string; label: string };
  count: number;
}) {
  const resolve = useMessages();
  const Icon = GROUP_ICONS[group.key] ?? LayersIcon;
  return (
    <div className="sticky top-0 z-10 flex h-7 items-center gap-2 bg-background px-3 text-xs font-medium text-muted-foreground">
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <h2 className="shrink-0 text-foreground/85">{resolve(group.label)}</h2>
      <span className="shrink-0 font-normal tabular-nums text-muted-foreground/70">{count}</span>
      <Separator className="min-w-2 flex-1" />
    </div>
  );
}

export function PullRequestListGroups({
  groups,
  environmentLabels,
  query,
  selected,
  showProvider,
  statsRef,
  onSelect,
  onIntent,
  hostActionsOf,
  onActed,
  closingKeys,
  sweepingKeys,
  onCloseSweepStart,
}: {
  groups: ReadonlyArray<PullRequestGroup<EnvironmentPullRequestEntry>>;
  /** Only when rows come from more than one server, so each says which. */
  environmentLabels: ReadonlyMap<EnvironmentId, string> | null;
  query: string;
  selected: {
    readonly environmentId: string | undefined;
    readonly repository: string;
    readonly host: string | undefined;
    readonly number: number;
  } | null;
  showProvider: boolean;
  statsRef: RefCallback<HTMLDivElement>;
  onSelect: (entry: PullRequestRowTarget) => void;
  onIntent: (entry: PullRequestRowTarget | null) => void;
  hostActionsOf: (entry: EnvironmentPullRequestEntry) => ReadonlySet<PullRequestAction>;
  onActed: (result: PullRequestSpeedActionResult) => void;
  closingKeys: ReadonlySet<string>;
  sweepingKeys: ReadonlySet<string>;
  onCloseSweepStart: (entry: EnvironmentPullRequestEntry, event: PointerEvent) => void;
}) {
  // Every row mounts tooltips and actions; painting a first screenful before the rest keeps
  // opening the page from blocking on the whole list.
  const shownGroups = useDeferredValue(groups, firstPaintGroups(groups));
  const counts = new Map(groups.map((group) => [group.key, group.entries.length]));
  const renderRow = (entry: EnvironmentPullRequestEntry) => {
    const entryKey = pullRequestEntryKey(entry);
    const environmentLabel = environmentLabels?.get(entry.environmentId);
    return (
      <PullRequestRow
        statsKey={entryKey}
        statsRef={statsRef}
        entry={entry}
        showProjectTitle
        showProvider={showProvider}
        {...(environmentLabel !== undefined ? { environmentLabel } : {})}
        matchedElsewhere={
          query.length > 0 && scorePullRequestMatch(entry, query) <= MATCHED_ELSEWHERE_SCORE
        }
        selected={
          selected?.environmentId === entry.environmentId &&
          selected.repository === entry.repository &&
          selected.host?.toLowerCase() === entry.host.toLowerCase() &&
          selected.number === entry.number
        }
        onSelect={onSelect}
        onIntent={onIntent}
        hostActions={hostActionsOf(entry)}
        onActed={onActed}
        closing={closingKeys.has(entryKey)}
        sweeping={sweepingKeys.has(entryKey)}
        onCloseSweepStart={onCloseSweepStart}
      />
    );
  };
  return (
    <PullRequestSpeedModeProvider>
      {/* Rows carry their own inset, so the list widens by it to line row text up with the toolbar. */}
      <div
        className={cn(
          "-mx-3 flex flex-col gap-4",
          sweepingKeys.size > 0 && "**:pointer-events-none",
        )}
      >
        {shownGroups.map((group) => (
          <div key={group.key} className="flex flex-col gap-1">
            {group.label ? (
              <PullRequestGroupHeader
                group={group}
                count={counts.get(group.key) ?? group.entries.length}
              />
            ) : null}
            <PullRequestTreeItems
              items={nestStackedPullRequests(group.entries)}
              renderRow={renderRow}
            />
          </div>
        ))}
      </div>
    </PullRequestSpeedModeProvider>
  );
}
