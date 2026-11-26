import { describe, expect, it, vi } from "vite-plus/test";

import { fakeTimers } from "../test/render";
import { trackScrollActivity } from "./scrollActivity";

describe("trackScrollActivity", () => {
  it("marks a scroller while it scrolls and clears it once scrolling stops", () => {
    using _timers = fakeTimers();
    const scroller = document.body.appendChild(document.createElement("div"));
    const stop = trackScrollActivity(document);
    try {
      scroller.dispatchEvent(new Event("scroll"));
      expect(scroller.hasAttribute("data-scrolling")).toBe(true);

      // Continued scrolling keeps it marked past the first idle window.
      vi.advanceTimersByTime(600);
      scroller.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(600);
      expect(scroller.hasAttribute("data-scrolling")).toBe(true);

      vi.advanceTimersByTime(300);
      expect(scroller.hasAttribute("data-scrolling")).toBe(false);
    } finally {
      stop();
      scroller.remove();
    }
  });
});
