const SCROLL_IDLE_MS = 800;

/**
 * Marks an element with `data-scrolling` while it scrolls, so native scrollbars can stay hidden
 * until the user actually scrolls (see the `::-webkit-scrollbar-thumb` rules in index.css).
 * One capturing listener covers every scroller; the attribute changes only on start and stop.
 */
export function trackScrollActivity(target: Document | undefined = globalThis.document) {
  if (!target) return () => undefined;
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  const onScroll = (event: Event) => {
    const element = event.target instanceof Element ? event.target : target.scrollingElement;
    if (!element) return;
    const pending = timers.get(element);
    if (pending === undefined) element.setAttribute("data-scrolling", "");
    else clearTimeout(pending);
    timers.set(
      element,
      setTimeout(() => {
        timers.delete(element);
        element.removeAttribute("data-scrolling");
      }, SCROLL_IDLE_MS),
    );
  };
  target.addEventListener("scroll", onScroll, { capture: true, passive: true });
  return () => {
    target.removeEventListener("scroll", onScroll, { capture: true });
    for (const [element, timer] of timers) {
      clearTimeout(timer);
      element.removeAttribute("data-scrolling");
    }
    timers.clear();
  };
}
