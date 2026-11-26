import type { CSSProperties, PointerEvent } from "react";

export const PIERRE_TREE_UNSAFE_CSS = `
  :host {
    --trees-bg-override: transparent;
    --trees-selected-bg-override: color-mix(in srgb, currentColor 12%, transparent);
    --trees-hover-bg-override: color-mix(in srgb, currentColor 7%, transparent);
    --trees-border-color-override: color-mix(in srgb, currentColor 14%, transparent);
    --trees-font-family-override: var(--font-sans);
    --trees-font-size-override: 0.75rem;
  }
  [data-truncate-content='visible'] { overflow: hidden; text-overflow: ellipsis; }
  [data-truncate-marker] { display: none; }
  button[data-type='item'], button[data-type='item']::before { border-radius: var(--radius-md); }
  /* Change status reads from the colored letter at the row's end; names and icons stay neutral. */
  button[data-item-git-status] > [data-item-section='content'] { color: var(--trees-fg); }
  button[data-item-git-status] > [data-item-section='icon'] > :not([data-icon-token]):not([data-icon-name='file-tree-icon-chevron']) { color: var(--trees-fg-muted); }
  /* A light chevron and resting indent guides keep nesting readable without heavy marks. */
  svg[data-icon-name='file-tree-icon-chevron'] { width: 10px; height: 10px; color: var(--trees-fg-muted); }
  [data-item-section='spacing-item'] { opacity: 0.5; }
  svg[data-icon-name='t3-tree-icon-loading'] { opacity: 0.6; }
  @media (prefers-reduced-motion: no-preference) {
    svg[data-icon-name='t3-tree-icon-loading'] { animation: t3-tree-spin 1s linear infinite; }
  }
  @keyframes t3-tree-spin { to { transform: rotate(360deg); } }
`;

export function pierreTreeStyle(colorScheme: "light" | "dark"): CSSProperties {
  return {
    colorScheme,
    ["--trees-fg-override" as string]: "var(--contrast-foreground)",
    ["--trees-fg-muted-override" as string]: "var(--contrast-muted-foreground)",
    ["--trees-status-ignored-override" as string]: "var(--contrast-muted-foreground)",
    // Rows start near the pane edge and read a step larger than the library's 13px default.
    ["--trees-padding-inline-override" as string]: "4px",
    ["--trees-item-padding-x-override" as string]: "6px",
    // Each level then indents by half an icon plus the label gap, about 12px.
    ["--trees-level-gap-override" as string]: "0px",
    ["--trees-font-size-override" as string]: "14px",
  };
}

// Clipped labels are unreadable and the tree cannot scroll sideways, so a clipped row gets its full name as a native tooltip.
export function titleClippedPierreTreeRow(event: PointerEvent<HTMLElement>) {
  const row = event.nativeEvent
    .composedPath()
    .find(
      (node): node is HTMLElement =>
        node instanceof HTMLElement && node.matches("button[data-type='item']"),
    );
  if (!row) return;
  const label = row.getAttribute("aria-label");
  const clipped = Array.from(
    row.querySelectorAll<HTMLElement>("[data-truncate-content='visible']"),
  ).some((element) => element.scrollWidth > element.clientWidth);
  if (label && clipped) row.title = label;
  else row.removeAttribute("title");
}
