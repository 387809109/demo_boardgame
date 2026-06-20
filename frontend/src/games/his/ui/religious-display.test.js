/**
 * ReligiousDisplay — result modals auto-dismiss so bot-driven reformation /
 * debate results don't pile up behind a backdrop and force the human to click
 * 关闭 during bot turns (2026-06-20 playability pass, item 3).
 *
 * Runs in the node env (no jsdom dependency) by mocking the overlay element —
 * we exercise the show/hide + auto-dismiss timer logic, not real DOM layout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReligiousDisplay, RESULT_AUTO_HIDE_MS } from './religious-display.js';

/** A ReligiousDisplay with a stubbed overlay element (no DOM needed). */
function mount() {
  const rd = new ReligiousDisplay();
  rd._overlayEl = { innerHTML: '', style: { display: 'none' }, appendChild() {} };
  return rd;
}

describe('ReligiousDisplay auto-dismiss', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows a result, then hides itself after RESULT_AUTO_HIDE_MS', () => {
    const rd = mount();
    rd._show({});
    expect(rd.visible).toBe(true);
    expect(rd._overlayEl.style.display).toBe('flex');

    vi.advanceTimersByTime(RESULT_AUTO_HIDE_MS);
    expect(rd.visible).toBe(false);
    expect(rd._overlayEl.style.display).toBe('none');
  });

  it('a new result resets the timer (rapid bot sequence flashes only the latest)', () => {
    const rd = mount();
    rd._show({});
    vi.advanceTimersByTime(RESULT_AUTO_HIDE_MS - 500); // not yet hidden
    expect(rd.visible).toBe(true);

    rd._show({}); // resets the timer
    vi.advanceTimersByTime(RESULT_AUTO_HIDE_MS - 500); // past the FIRST deadline
    expect(rd.visible).toBe(true); // still up — second timer hasn't elapsed

    vi.advanceTimersByTime(500); // now the second timer fires
    expect(rd.visible).toBe(false);
  });

  it('manual hide() clears the pending timer (no resurrection on a later tick)', () => {
    const rd = mount();
    rd._show({});
    rd.hide(); // e.g. 关闭 button / backdrop click
    expect(rd.visible).toBe(false);
    expect(rd._autoHideTimer).toBe(null);

    vi.advanceTimersByTime(RESULT_AUTO_HIDE_MS * 2);
    expect(rd.visible).toBe(false);
  });
});
