import {
  ASSISTANT_CITATION_MAX_TEXT_LENGTH,
  MessageId,
  type AssistantCitation,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import { useGT } from "gt-react";
import { ArrowUpIcon, MessageCircleIcon, TextQuoteIcon } from "lucide-react";
import { use, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  captureAssistantTextSelection,
  type AssistantCitationSourceAnchor,
} from "~/lib/assistantTextSelection";
import { isSelectionRectVisible, observeSelectionActions } from "~/lib/selectionActions";
import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { BackgroundThreadContext } from "./backgroundThread";

type Box = { left: number; right: number; top: number; bottom: number };
type ToolbarAnchor = { first: Box; last: Box; bounds: Box };

const TOOLBAR_GAP = 8;

/**
 * The selected text's lines. Element boxes are skipped, so a fully selected list item or
 * paragraph measures by its text rather than its whole width.
 */
function selectionTextLines(range: Range): Box[] {
  const lines: Box[] = [];
  const common = range.commonAncestorContainer;
  const walker = document.createTreeWalker(common, NodeFilter.SHOW_TEXT);
  let node = common.nodeType === Node.TEXT_NODE ? common : walker.nextNode();
  for (; node; node = walker.nextNode()) {
    if (!range.intersectsNode(node)) continue;
    const fragment = document.createRange();
    fragment.selectNodeContents(node);
    if (node === range.startContainer) fragment.setStart(node, range.startOffset);
    if (node === range.endContainer) fragment.setEnd(node, range.endOffset);
    if (!fragment.toString().trim()) continue;
    for (const rect of fragment.getClientRects()) {
      if (rect.width <= 0 || rect.height <= 0) continue;
      const middle = (rect.top + rect.bottom) / 2;
      const line = lines.find((box) => middle > box.top && middle < box.bottom);
      if (line) {
        line.left = Math.min(line.left, rect.left);
        line.right = Math.max(line.right, rect.right);
        line.top = Math.min(line.top, rect.top);
        line.bottom = Math.max(line.bottom, rect.bottom);
      } else {
        lines.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
      }
    }
  }
  return lines.toSorted((a, b) => a.top - b.top);
}

/** Centers the toolbar above the first line, or below the last when the top has no room. */
function placeToolbar(toolbar: HTMLElement, anchor: ToolbarAnchor) {
  const { width, height } = toolbar.getBoundingClientRect();
  const above = anchor.first.top - TOOLBAR_GAP - height;
  const below = anchor.last.bottom + TOOLBAR_GAP;
  const useAbove = above >= anchor.bounds.top || below + height > anchor.bounds.bottom;
  const line = useAbove ? anchor.first : anchor.last;
  const left = (line.left + line.right) / 2 - width / 2;
  const top = useAbove ? above : below;
  toolbar.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`;
  toolbar.style.top = `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`;
}

export function AssistantSelectionToolbar({
  viewport,
  threadRef,
  onCite,
  onAskInSideChat,
}: {
  viewport: HTMLElement | null;
  threadRef: ScopedThreadRef;
  onCite: (citation: AssistantCitation, sourceAnchor: AssistantCitationSourceAnchor) => boolean;
  /** Absent where side chats are not offered. */
  onAskInSideChat?: ((citation: AssistantCitation, question: string) => void) | undefined;
}) {
  const [selection, setSelection] = useState<{
    citation: AssistantCitation;
    anchor: ToolbarAnchor;
    sourceAnchor: AssistantCitationSourceAnchor;
  } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const actionsRef = useRef<ReturnType<typeof observeSelectionActions> | null>(null);
  const backgroundThread = use(BackgroundThreadContext);
  const gt = useGT();

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- measures the toolbar DOM node and clamps its position inside the window before paint
  useLayoutEffect(() => {
    if (toolbarRef.current && selection) placeToolbar(toolbarRef.current, selection.anchor);
  }, [selection]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- subscribes to document selectionchange and keydown to track text selections in the viewport
  useEffect(() => {
    if (!viewport) return;
    const clear = () => {
      setSelection(null);
      setQuestion(null);
    };
    const update = () => {
      const nativeSelection = window.getSelection();
      const captured = captureAssistantTextSelection(viewport, nativeSelection);
      const messageId = captured?.source.dataset.assistantCitationSource;
      if (!captured || !messageId) {
        clear();
        return;
      }
      const rect = captured.range.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      if (!isSelectionRectVisible(rect, [viewportRect])) {
        clear();
        return;
      }
      // A selection can cross blocks with different clipping ancestors.
      const common = captured.range.commonAncestorContainer;
      const walker = document.createTreeWalker(common, NodeFilter.SHOW_TEXT);
      let node = common.nodeType === Node.TEXT_NODE ? common : walker.nextNode();
      let visible = false;
      for (; node && !visible; node = walker.nextNode()) {
        if (!captured.range.intersectsNode(node)) continue;
        if (node.parentElement && getComputedStyle(node.parentElement).userSelect === "none")
          continue;
        const fragment = document.createRange();
        fragment.selectNodeContents(node);
        if (node === captured.range.startContainer) {
          fragment.setStart(node, captured.range.startOffset);
        }
        if (node === captured.range.endContainer) {
          fragment.setEnd(node, captured.range.endOffset);
        }
        if (!fragment.toString().trim()) continue;
        const lines = Array.from(fragment.getClientRects());
        if (!lines.some((line) => isSelectionRectVisible(line, [viewportRect]))) continue;
        const clips: Pick<DOMRect, "left" | "right" | "top" | "bottom">[] = [viewportRect];
        for (
          let element = node.parentElement;
          element && element !== viewport;
          element = element.parentElement
        ) {
          const style = getComputedStyle(element);
          const clipX = style.overflowX !== "visible";
          const clipY = style.overflowY !== "visible";
          if (!clipX && !clipY) continue;
          const bounds = element.getBoundingClientRect();
          const left = bounds.left + element.clientLeft;
          const top = bounds.top + element.clientTop;
          clips.push({
            left: clipX ? left : -Infinity,
            right: clipX ? left + element.clientWidth : Infinity,
            top: clipY ? top : -Infinity,
            bottom: clipY ? top + element.clientHeight : Infinity,
          });
        }
        visible = lines.some((line) => isSelectionRectVisible(line, clips));
      }
      if (!visible) {
        clear();
        return;
      }
      const lines = selectionTextLines(captured.range);
      const first = lines[0] ?? rect;
      const last = lines.at(-1) ?? rect;
      setSelection({
        sourceAnchor: { source: captured.source, range: captured.range, viewport },
        citation: {
          version: 1,
          ...threadRef,
          messageId: MessageId.make(messageId),
          ...captured.selector,
        },
        anchor: { first, last, bounds: viewportRect },
      });
    };
    const actions = observeSelectionActions({
      element: viewport,
      getActionElement: () => toolbarRef.current,
      restoreAfterScroll: true,
      immediateMultiClick: true,
      onSelection: update,
      onDismiss: clear,
    });
    actionsRef.current = actions;
    const focusActions = (event: KeyboardEvent) => {
      const toolbar = toolbarRef.current;
      if (
        event.key !== "Tab" ||
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.isComposing ||
        event.defaultPrevented ||
        !toolbar ||
        toolbar.contains(event.target as Node)
      ) {
        return;
      }
      const first = toolbar.querySelector<HTMLElement>("button:enabled, input");
      if (!first) return;
      event.preventDefault();
      event.stopPropagation();
      first.focus({ preventScroll: true });
    };
    // Tab belongs to the foreground chat; a background timeline only follows its selection.
    if (!backgroundThread) document.addEventListener("keydown", focusActions, true);
    document.addEventListener("selectionchange", actions.selectionChanged);
    return () => {
      document.removeEventListener("keydown", focusActions, true);
      document.removeEventListener("selectionchange", actions.selectionChanged);
      actions.dispose();
      actionsRef.current = null;
    };
  }, [backgroundThread, threadRef, viewport]);

  if (!selection) return null;
  const tooLong = selection.citation.text.length > ASSISTANT_CITATION_MAX_TEXT_LENGTH;
  const dismiss = () => {
    actionsRef.current?.cancel();
    setSelection(null);
    setQuestion(null);
  };
  const cite = () => {
    if (tooLong || !onCite(selection.citation, selection.sourceAnchor)) return false;
    window.getSelection()?.removeAllRanges();
    dismiss();
    return true;
  };
  const ask = () => {
    const text = question?.trim() ?? "";
    if (tooLong || !onAskInSideChat || text.length === 0) return;
    onAskInSideChat(selection.citation, text);
    window.getSelection()?.removeAllRanges();
    dismiss();
  };
  const separator = <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />;
  return createPortal(
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={gt("Selection actions")}
      className={cn(
        "fixed z-50 flex max-w-[calc(100vw-1rem)] items-center gap-0.5 rounded-xl border bg-message p-0.5 text-message-foreground shadow-lg",
        question !== null && "w-80",
      )}
      style={{ left: selection.anchor.first.left, top: selection.anchor.first.top }}
      onPointerDown={(event) => {
        if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          dismiss();
        }
      }}
    >
      {question === null ? (
        <>
          <Button
            type="button"
            size="compact"
            variant="ghost"
            disabled={tooLong}
            aria-label={
              tooLong ? gt("Selection is too long to cite") : gt("Quote selection in composer")
            }
            onClick={cite}
          >
            <TextQuoteIcon aria-hidden="true" strokeWidth={1.5} />
            {tooLong
              ? gt("Shorten selection")
              : gt("Quote", { $context: "verb, button that quotes the selected text" })}
          </Button>
          {onAskInSideChat && !tooLong ? (
            <>
              {separator}
              <Button type="button" size="compact" variant="ghost" onClick={() => setQuestion("")}>
                <MessageCircleIcon aria-hidden="true" strokeWidth={1.5} />
                {gt("Ask in side chat")}
              </Button>
            </>
          ) : null}
        </>
      ) : (
        <form
          // The ask field is wider than the buttons it replaces, so it is clamped again.
          ref={(form) => {
            if (form && toolbarRef.current) placeToolbar(toolbarRef.current, selection.anchor);
          }}
          className="flex min-w-0 flex-1 items-center gap-1.5 ps-2"
          onSubmit={(event) => {
            event.preventDefault();
            ask();
          }}
        >
          <MessageCircleIcon
            aria-hidden="true"
            strokeWidth={1.5}
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          <input
            autoFocus
            aria-label={gt("Question for the side chat")}
            placeholder={gt("Ask about this selection…")}
            className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            value={question}
            onChange={(event) => setQuestion(event.currentTarget.value)}
          />
          <Button
            type="submit"
            size="icon-xs"
            disabled={question.trim().length === 0}
            aria-label={gt("Start side chat")}
          >
            <ArrowUpIcon aria-hidden="true" />
          </Button>
        </form>
      )}
    </div>,
    document.body,
  );
}
