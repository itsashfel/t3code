import { resolvePullRequestDetailChecks } from "@t3tools/client-runtime/pull-request-checks";
import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import { changeRequestTermKind } from "../pullRequest/changeRequestTerm";
import { T, useGT, useMessages, Var } from "gt-react";
import { PullRequestChangeBreakdownRows } from "../pullRequest/PullRequestChangeBreakdownStat";
import { ThreadDetailsControl } from "./ThreadDetailsControl";
import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { selectEnvironmentQueryData } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, ProjectId, PullRequestRef } from "@t3tools/contracts";
import { EyeIcon, EyeOffIcon, FileDiffIcon, GitBranchIcon, TriangleAlertIcon } from "lucide-react";
import { AsyncResult } from "effect/reactivity";
import type { MouseEvent as ReactMouseEvent } from "react";

import { useLiveRefresh } from "~/hooks/useLiveRefresh";
import { usePullRequestChecksRefresh } from "~/hooks/usePullRequestChecksRefresh";
import { cn } from "~/lib/utils";
import { useServerConfigs } from "~/state/entities";
import { pullRequestEnvironment } from "~/state/pullRequests";
import {
  useEnvironmentQueryIsNewer,
  useEnvironmentQueryRefresh,
  useEnvironmentQuerySelector,
} from "~/state/query";

import {
  classifyPullRequestChecks,
  describePullRequestChecks,
  isPullRequestConflicting,
} from "../pullRequest/pullRequestDetail.logic";
import { PullRequestChecksPopover } from "../pullRequest/PullRequestChecksPopover";
import {
  pullRequestChecksState,
  pullRequestChecksStatePresentation,
  PullRequestCheckStatusIcon,
  PullRequestDiffStat,
  resolvePullRequestState,
} from "../pullRequest/pullRequestPresentation";
import {
  ChangeRequestStatusIcon,
  type PrStatusIndicator,
  type ThreadPr,
} from "../ThreadStatusIndicators";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { SharedTooltipTrigger } from "../ui/shared-tooltip";
import {
  THREAD_DETAILS_PANEL_ICON_CLASS,
  THREAD_DETAILS_PANEL_LABEL_CLASS,
  THREAD_DETAILS_PANEL_SPLIT_GROUP_CLASS,
} from "./threadDetailsPanelStyles";

// A null checks response is settled; polling cannot find checks.
const isSettledWithoutChecks = (result: AsyncResult.AsyncResult<unknown, unknown>) =>
  result._tag === "Success" && result.value === null;

export function ThreadDetailsPrRow({
  environmentId,
  pr,
  number,
  reference: linkedReference,
  status,
  project,
  label,
  onOpen,
  onStopWatching,
}: {
  environmentId: EnvironmentId;
  pr: ThreadPr;
  number: number;
  reference?: Pick<PullRequestRef, "host" | "repository" | "number"> | null;
  status: PrStatusIndicator | null;
  project: EnvironmentProject | null;
  label: string;
  onOpen: (event: ReactMouseEvent<HTMLElement>) => void;
  onStopWatching?: (() => void) | undefined;
}) {
  const gt = useGT();
  const m = useMessages();
  const serverConfigs = useServerConfigs();
  const supportsPullRequests = serverConfigs.get(environmentId) !== undefined;
  const repository = sourceControlClients.repositorySelector(project?.repositoryIdentity);
  const reference: PullRequestRef | null =
    supportsPullRequests && project !== null
      ? linkedReference
        ? { ...linkedReference, projectId: project.id as ProjectId }
        : repository !== null
          ? { projectId: project.id as ProjectId, repository, number }
          : null
      : null;
  const detailAtom =
    reference === null
      ? null
      : pullRequestEnvironment.detail({
          environmentId,
          input: { ...reference, allowStale: false },
        });
  // Select query parts because polling rebuilds unchanged results.
  const detailData = useEnvironmentQuerySelector(detailAtom, selectEnvironmentQueryData);
  const detailQuery = useEnvironmentQueryRefresh(detailAtom);
  const supportsChecks =
    serverConfigs.get(environmentId)?.environment.capabilities.pullRequestChecks === true;
  const checksAtom =
    supportsChecks && reference !== null && detailData !== null
      ? pullRequestEnvironment.checks({ environmentId, input: reference })
      : null;
  const checksData = useEnvironmentQuerySelector(checksAtom, selectEnvironmentQueryData);
  const checksSettledEmpty = useEnvironmentQuerySelector(checksAtom, isSettledWithoutChecks);
  const checksQuery = useEnvironmentQueryRefresh(checksAtom);
  const checksAreNewer = useEnvironmentQueryIsNewer(checksAtom, detailAtom);
  const detail = resolvePullRequestDetailChecks(detailData, checksData, checksAreNewer);
  const terminology = sourceControlClients.get(
    detail?.provider ?? project?.repositoryIdentity?.provider,
  ).changeRequest;
  const term = changeRequestTermKind(terminology);
  const open = reference !== null && (detail?.state ?? pr?.state) === "open";
  const refreshKey = `${environmentId}:${project?.id}:${reference?.host}:${reference?.repository}:${number}`;
  useLiveRefresh(
    () => {
      if (!detailQuery.isPending()) detailQuery.refresh();
    },
    { enabled: open, key: `workspace-pr:${refreshKey}`, intervalMs: 10 * 60_000 },
  );
  usePullRequestChecksRefresh({
    refresh: () => {
      if (!checksQuery.isPending() && !detailQuery.isPending()) checksQuery.refresh();
    },
    enabled: open && supportsChecks && !checksSettledEmpty,
    key: `workspace-pr-checks:${refreshKey}`,
    checks: detail?.checks ?? [],
  });

  const conflicting = isPullRequestConflicting(detail);
  const checksState = detail === null ? "none" : classifyPullRequestChecks(detail.checks);
  const checksRollup = detail === null ? null : pullRequestChecksState(detail.checks);

  const statePresentation =
    detail === null
      ? null
      : resolvePullRequestState(
          {
            state: detail.state,
            isDraft: detail.isDraft,
          },
          m,
        );
  const icon = statePresentation ? (
    <statePresentation.Icon
      aria-hidden
      className={cn("size-4 shrink-0", statePresentation.toneClassName)}
    />
  ) : pr && status ? (
    <ChangeRequestStatusIcon
      state={pr.state}
      className={cn(THREAD_DETAILS_PANEL_ICON_CLASS, status.colorClass)}
    />
  ) : (
    <PullRequestGlyph.pullRequest className={THREAD_DETAILS_PANEL_ICON_CLASS} />
  );

  const stateLabel = (
    statePresentation ??
    (pr ? resolvePullRequestState({ state: pr.state, isDraft: pr.isDraft === true }, m) : null)
  )?.label.toLowerCase();
  const title = (detail?.title ?? pr?.title)?.trim();
  const openAriaLabel =
    stateLabel && title
      ? gt(
          "{term, select, mr {Merge request} cr {Change request} other {Pull request}} #{number}, {state}: {title}",
          { term, number, state: stateLabel, title },
        )
      : stateLabel
        ? gt(
            "{term, select, mr {Merge request} cr {Change request} other {Pull request}} #{number}, {state}",
            { term, number, state: stateLabel },
          )
        : title
          ? gt(
              "{term, select, mr {Merge request} cr {Change request} other {Pull request}} #{number}: {title}",
              { term, number, title },
            )
          : gt(
              "{term, select, mr {Merge request} cr {Change request} other {Pull request}} #{number}",
              { term, number },
            );

  const rowTooltip =
    detail === null || statePresentation === null ? (
      <TooltipPopup side="top">
        {status?.tooltip ??
          gt(
            "{term, select, mr {Merge request} cr {Change request} other {Pull request}} #{number}",
            {
              term,
              number,
            },
          )}
      </TooltipPopup>
    ) : (
      <TooltipPopup
        side="top"
        align="start"
        sideOffset={4}
        variant="glass"
        className="max-w-80 text-left whitespace-normal"
      >
        <div className="flex min-w-0 max-w-80 flex-col gap-2 px-1 py-2">
          <div className="flex min-w-0 items-baseline gap-1.5 text-xs leading-none">
            <span className="min-w-0 truncate font-medium text-foreground">{detail.title}</span>
            <span className="shrink-0 text-muted-foreground">#{detail.number}</span>
          </div>
          <div className="grid gap-1.5 pl-0.5 text-xs text-muted-foreground">
            <div className="flex min-w-0 items-center gap-2">
              <statePresentation.Icon
                aria-hidden
                className={cn("size-3 shrink-0", statePresentation.toneClassName)}
              />
              <div className="min-w-0 truncate text-foreground/85">{statePresentation.label}</div>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <GitBranchIcon className="size-3 shrink-0 stroke-muted-foreground" />
              <div className="min-w-0 truncate text-foreground/85">
                {detail.baseBranch} ← {detail.headBranch}
              </div>
            </div>
            {detail.state === "open" && checksState !== "none" ? (
              <div className="flex min-w-0 items-center gap-2">
                <PullRequestCheckStatusIcon
                  status={
                    checksState === "failing"
                      ? "failure"
                      : checksState === "pending"
                        ? "pending"
                        : "success"
                  }
                />
                <div className="min-w-0 truncate text-foreground/85">
                  {describePullRequestChecks(detail.checks, m)}
                </div>
              </div>
            ) : null}
            {detail.isDraft && conflicting ? (
              <div className="flex min-w-0 items-start gap-2 text-destructive">
                <TriangleAlertIcon aria-hidden className="mt-0.5 size-3 shrink-0 stroke-current" />
                <div className="min-w-0 flex-1 wrap-break-word">
                  <T>
                    Merge conflicts with <Var>{detail.baseBranch}</Var>
                  </T>
                </div>
              </div>
            ) : null}
            <div className="flex min-w-0 items-center gap-2">
              <FileDiffIcon className="size-3 shrink-0 stroke-muted-foreground" />
              <div className="min-w-0 flex items-baseline gap-1 truncate text-foreground/85">
                {gt("{count, plural, one {{formatted} file} other {{formatted} files}}", {
                  count: detail.changedFiles,
                  formatted: detail.changedFiles.toLocaleString(),
                })}
                <PullRequestDiffStat additions={detail.additions} deletions={detail.deletions} />
              </div>
            </div>
            {reference !== null && (detail.additions > 0 || detail.deletions > 0) ? (
              <PullRequestChangeBreakdownRows
                environmentId={environmentId}
                reference={reference}
                className="pl-5 text-foreground/85"
              />
            ) : null}
          </div>
        </div>
      </TooltipPopup>
    );

  const watching =
    onStopWatching !== undefined && (detail?.state ?? pr?.state ?? "open") === "open";
  const watchControl = watching ? (
    <SharedTooltipTrigger
      render={
        <ThreadDetailsControl
          type="button"
          variant="ghost"
          size="sm"
          part="icon"
          className="group/watch"
          aria-label={gt("Stop watching #{number}", { number })}
          onClick={onStopWatching}
        />
      }
      label={
        <T>
          Watching: the agent wakes when checks finish, someone comments, or the branch conflicts.
          Click to stop.
        </T>
      }
    >
      <EyeIcon aria-hidden className="size-3.5 group-hover/watch:hidden" />
      <EyeOffIcon aria-hidden className="hidden size-3.5 group-hover/watch:block" />
    </SharedTooltipTrigger>
  ) : null;

  const numberTag = title ? (
    <span aria-hidden className="shrink-0 text-xs tabular-nums text-muted-foreground">
      #{number}
    </span>
  ) : null;

  const showChecks =
    detail !== null &&
    detail.state === "open" &&
    checksRollup !== null &&
    !conflicting &&
    !detail.isDraft;

  const checksPresentation =
    showChecks && checksRollup !== null
      ? pullRequestChecksStatePresentation(checksRollup, m)
      : null;
  // Conflicts outrank checks: the PR view's Resolve is the next step.
  const checksIcon =
    detail?.state === "open" && conflicting ? (
      <PullRequestGlyph.conflicting aria-hidden className="size-3.5 shrink-0 text-destructive" />
    ) : checksPresentation ? (
      <checksPresentation.Icon
        aria-hidden
        className={cn("size-3.5 shrink-0", checksPresentation.toneClassName)}
      />
    ) : null;

  const openRow = (part: "row" | "primary", showNumber: boolean) => (
    <Tooltip>
      <TooltipTrigger
        render={
          <ThreadDetailsControl
            type="button"
            variant="ghost"
            size="sm"
            part={part}
            aria-label={openAriaLabel}
            onClick={onOpen}
            onAuxClick={onOpen}
          />
        }
      >
        {icon}
        <span className={cn("min-w-0 flex-1 truncate text-left", THREAD_DETAILS_PANEL_LABEL_CLASS)}>
          {title || label}
        </span>
        {showNumber ? checksIcon : null}
        {showNumber && numberTag}
      </TooltipTrigger>
      {rowTooltip}
    </Tooltip>
  );

  return (
    <>
      {watching ? (
        <div className={THREAD_DETAILS_PANEL_SPLIT_GROUP_CLASS}>
          {openRow("primary", false)}
          <div className="flex shrink-0 items-center gap-1.5 ps-1 pe-1.5 text-xs text-muted-foreground">
            {detail !== null && showChecks && checksRollup !== null ? (
              <PullRequestChecksPopover checksState={checksRollup} checks={detail.checks} />
            ) : null}
            {numberTag}
            {watchControl}
          </div>
        </div>
      ) : (
        openRow("row", true)
      )}
    </>
  );
}
