import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { T, useGT, useMessages } from "gt-react";
import { reviewCommentRangeText } from "~/lib/composerContextRecords";
import { Trash2 } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "~/components/ui/button";
import {
  PullRequestMarkdownTextarea,
  type PullRequestCompletionScope,
} from "~/components/pullRequest/PullRequestMarkdownTextarea";
import {
  SpeechTextField,
  TextFieldSpeechControls,
  type TextFieldSpeech,
} from "~/speech/useTextFieldSpeech";
import { textDirection } from "~/textDirection";

import { cn } from "~/lib/utils";

import { isCommentSubmitShortcut } from "./commentSubmitShortcut";

const COMMENT_CARD_CLASS =
  "my-1.5 ms-1 me-3 min-w-0 rounded-xl border bg-card font-sans text-foreground shadow-xs selection:bg-primary selection:text-primary-foreground";

interface DiffCommentSecondaryAction {
  readonly label: string;
  readonly icon?: ReactNode;
  readonly allowEmpty?: boolean;
  readonly onAction: (text: string) => void;
}

interface DiffCommentAnnotationProps {
  /** With an environment, the draft can be dictated; its project supplies vocabulary. */
  environmentId?: EnvironmentId | undefined;
  projectId?: ProjectId | null | undefined;
  ownerKey?: string;
  kind: "draft" | "comment";
  rangeLabel: string;
  text: string;
  onTextChange?: (text: string) => void;
  onCancel: () => void;
  onComment: (text: string) => void;
  onDelete?: () => void;
  placeholder?: string;
  submitLabel?: string;
  pending?: boolean;
  secondaryAction?: DiffCommentSecondaryAction;
  focusOnMount?: boolean;
  /** Set only for pull request comments, where `@` completes the repository's users. */
  completionScope?: PullRequestCompletionScope | null;
}

export function DiffCommentAnnotation({
  environmentId,
  projectId,
  ownerKey,
  kind,
  rangeLabel,
  text,
  onTextChange,
  onCancel,
  onComment,
  onDelete,
  placeholder,
  submitLabel,
  pending = false,
  secondaryAction,
  focusOnMount = true,
  completionScope = null,
}: DiffCommentAnnotationProps) {
  const gt = useGT();
  const messages = useMessages();
  const [localDraftText, setLocalDraftText] = useState("");
  const displayedText = kind === "draft" && !onTextChange ? localDraftText : text;
  const trimmedText = displayedText.trim();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- focuses the draft textarea on the next animation frame after mount
  useLayoutEffect(() => {
    if (kind !== "draft" || !focusOnMount) return;
    const frame = window.requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusOnMount, kind]);

  const rangeTag = (
    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-2xs font-medium text-foreground/85 tabular-nums">
      {reviewCommentRangeText(rangeLabel, messages)}
    </span>
  );

  if (kind === "comment") {
    return (
      <div
        data-diff-comment-annotation
        className={cn(COMMENT_CARD_CLASS, "group/comment")}
        contentEditable={false}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <p
          className="whitespace-pre-wrap px-2.5 pt-1 text-sm leading-5"
          dir={textDirection(displayedText)}
        >
          {displayedText}
        </p>
        <div className="flex h-10 items-center gap-1 px-2">
          {rangeTag}
          {onDelete ? (
            <span className="ms-auto flex shrink-0 opacity-0 transition-opacity group-hover/comment:opacity-100 focus-within:opacity-100 max-sm:opacity-100">
              <Button
                variant="ghost-muted"
                size="icon-xs"
                aria-label={gt("Delete comment")}
                onClick={onDelete}
              >
                <Trash2 className="size-3" />
              </Button>
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  const submit = (
    speech: TextFieldSpeech | undefined,
    action: (text: string) => void,
    allowEmpty = false,
  ) => {
    const finish = (value: string) => {
      if (!pending && (allowEmpty || value.trim())) action(value.trim());
    };
    if (speech) speech.submitAfterDictation(finish);
    else finish(displayedText);
  };

  // Pierre hides native carets and selection; textarea comments need their own visible feedback.
  const renderDraft = (speech?: TextFieldSpeech) => (
    <div
      data-diff-comment-annotation
      className={cn(
        COMMENT_CARD_CLASS,
        "caret-foreground transition-colors focus-within:border-foreground/24",
      )}
      contentEditable={false}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <PullRequestMarkdownTextarea
        ref={textareaRef}
        completionScope={completionScope}
        readOnly={speech?.freezesEditor}
        autoFocus={focusOnMount}
        unstyled
        size="sm"
        rows={2}
        style={{ resize: "none", minHeight: "calc(2lh + 0.375rem)" }}
        value={displayedText}
        dir={textDirection(displayedText)}
        placeholder={placeholder ?? gt("Add a comment…")}
        aria-label={gt("Comment on lines {rangeLabel}", {
          rangeLabel: reviewCommentRangeText(rangeLabel, messages),
        })}
        onValueChange={onTextChange ?? setLocalDraftText}
        onFocus={(event) => {
          const end = event.currentTarget.value.length;
          event.currentTarget.setSelectionRange(end, end);
        }}
        onKeyDown={(event) => {
          // Unclaimed, an IME Escape would close the right panel sheet or leave the pull requests page.
          if (event.nativeEvent.isComposing || event.keyCode === 229) {
            event.stopPropagation();
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (speech && speech.state.phase !== "idle") speech.cancel();
            else onCancel();
          }
          if (isCommentSubmitShortcut(event, trimmedText, pending, speech?.blocksSubmission)) {
            event.preventDefault();
            submit(speech, onComment);
          }
        }}
      />
      <div className="flex min-h-10 flex-wrap items-center gap-1 px-2">
        <span className="me-auto">{rangeTag}</span>
        {speech ? <TextFieldSpeechControls speech={speech} disabled={pending} /> : null}
        <Button variant="ghost-muted" size="xs" onClick={onCancel}>
          <T>Cancel</T>
        </Button>
        {secondaryAction ? (
          <Button
            size="xs"
            variant="outline"
            disabled={
              speech?.preparing ||
              pending ||
              (!speech?.blocksSubmission && !secondaryAction.allowEmpty && !trimmedText)
            }
            onClick={() => submit(speech, secondaryAction.onAction, secondaryAction.allowEmpty)}
          >
            {secondaryAction.icon}
            {secondaryAction.label}
          </Button>
        ) : null}
        <Button
          size="xs"
          disabled={speech?.preparing || pending || (!speech?.blocksSubmission && !trimmedText)}
          onClick={() => submit(speech, onComment)}
        >
          {submitLabel ?? gt("Comment", { $context: "verb, submit button" })}
        </Button>
      </div>
    </div>
  );

  return environmentId ? (
    <SpeechTextField
      environmentId={environmentId}
      projectId={projectId}
      ownerKey={ownerKey ?? rangeLabel}
      text={displayedText}
      textareaRef={textareaRef}
      onTextChange={onTextChange ?? setLocalDraftText}
      disabled={pending}
    >
      {renderDraft}
    </SpeechTextField>
  ) : (
    renderDraft()
  );
}
