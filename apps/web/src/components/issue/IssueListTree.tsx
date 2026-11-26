import type { EnvironmentIssueEntry } from "@t3tools/client-runtime/issue-list";
import { issueEntryKey } from "@t3tools/client-runtime/state/issues";
import type { IssueState } from "@t3tools/contracts";

import { nestListRows, type ListTreeItem } from "~/lib/nestListRows";

import { Separator } from "../ui/separator";
import { StackedRowChildren } from "../pullRequest/PullRequestListRow";
import { IssueParentRow, IssueRow, type IssueRowSlots, type IssueRowTarget } from "./IssueRow";
import { IssueStateGlyph } from "./issuePresentation";

// Rows are already one per issue across environments, so a parent matches on its tracker alone.
const treeKey = (row: EnvironmentIssueEntry, key = row.key) =>
  `${row.host.toLowerCase()}\u0000${key}`;

export const issueRowSelectionKey = (
  row: Pick<EnvironmentIssueEntry, "projectId" | "host" | "scope" | "key"> & {
    readonly environmentId: string | undefined;
  },
) => `${row.environmentId}:${issueEntryKey(row)}`;

/** Workflow order where the tracker gives one; otherwise open before closed. */
const stateRank = (state: IssueState) =>
  state.order ?? (state.category === "open" ? 50_000_000 : 90_000_000);

/** Rows split by status in workflow order, each keeping the list's own order within it. */
function groupIssuesByState(rows: ReadonlyArray<EnvironmentIssueEntry>) {
  const groups = new Map<string, { state: IssueState; rows: EnvironmentIssueEntry[] }>();
  for (const row of rows) {
    const key = `${row.state.category}\u0000${row.state.name.toLowerCase()}`;
    const group = groups.get(key);
    if (group) group.rows.push(row);
    else groups.set(key, { state: row.state, rows: [row] });
  }
  return [...groups.entries()]
    .map(([key, group]) => ({ key, ...group }))
    .sort(
      (left, right) =>
        stateRank(left.state) - stateRank(right.state) ||
        left.state.name.localeCompare(right.state.name),
    );
}

interface RowProps {
  selectedKey: string | null;
  slots: IssueRowSlots;
  showScope: boolean;
  environmentLabelOf: (row: EnvironmentIssueEntry) => string | undefined;
  onSelect: (entry: IssueRowTarget) => void;
}

function IssueTreeItems({
  items,
  ...props
}: RowProps & { items: ReadonlyArray<ListTreeItem<EnvironmentIssueEntry>> }) {
  return items.map((item) => {
    const children =
      item.children.length === 0 ? null : (
        <StackedRowChildren>
          <IssueTreeItems items={item.children} {...props} />
        </StackedRowChildren>
      );
    if (item.kind === "context") {
      const parent = item.first.parent;
      if (parent === undefined) return null;
      return (
        <div key={`context:${item.parentKey}`} className="flex flex-col gap-1 not-first:mt-1.5">
          <IssueParentRow
            parent={parent}
            child={item.first}
            selected={
              props.selectedKey === issueRowSelectionKey({ ...item.first, key: parent.key })
            }
            onSelect={props.onSelect}
          />
          {children}
        </div>
      );
    }
    const row = item.row;
    return (
      <div key={treeKey(row)} className="flex flex-col gap-1">
        <IssueRow
          entry={row}
          selected={props.selectedKey === issueRowSelectionKey(row)}
          showScope={props.showScope}
          slots={props.slots}
          environmentLabel={props.environmentLabelOf(row)}
          onSelect={props.onSelect}
        />
        {children}
      </div>
    );
  });
}

function nestIssues(rows: ReadonlyArray<EnvironmentIssueEntry>) {
  return nestListRows(rows, treeKey, (row) =>
    row.parent === undefined ? undefined : treeKey(row, row.parent.key),
  );
}

/**
 * One tracker's rows, with sub-issues under their parents. Grouped, each status gets a header and
 * nests on its own: a sub-issue in another status than its parent shows the parent dimmed there.
 */
export function IssueListTree({
  rows,
  grouped,
  ...rest
}: Omit<RowProps, "slots"> & { rows: ReadonlyArray<EnvironmentIssueEntry>; grouped: boolean }) {
  const props = {
    ...rest,
    slots: {
      priority: rows.some((row) => row.priority !== undefined),
      assignees: rows.some((row) => row.assignees.length > 0),
    },
  };
  if (!grouped) {
    return (
      <div className="flex flex-col gap-1">
        <IssueTreeItems items={nestIssues(rows)} {...props} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {groupIssuesByState(rows).map((group) => (
        <section key={group.key} className="flex flex-col gap-1">
          <h3 className="sticky top-0 z-10 flex h-7 items-center gap-2 bg-background px-3 text-xs font-medium text-muted-foreground">
            <IssueStateGlyph state={group.state} className="size-3.5" />
            <span className="shrink-0 text-foreground/85">{group.state.name}</span>
            <span className="shrink-0 font-normal tabular-nums text-muted-foreground/70">
              {group.rows.length}
            </span>
            <Separator className="min-w-2 flex-1" />
          </h3>
          <IssueTreeItems items={nestIssues(group.rows)} {...props} />
        </section>
      ))}
    </div>
  );
}
