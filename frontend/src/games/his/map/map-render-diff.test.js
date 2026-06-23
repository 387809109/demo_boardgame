/**
 * Diff-based map updates — MapOverlay unit stacks + MapRenderer siege/unrest
 * indicators only touch the DOM for spaces that actually changed. These tests
 * pin both correctness (right stacks/indicators present) and the performance
 * guarantee (an unchanged update creates zero nodes; a one-space change rebuilds
 * only that space). Runs in the node env with a minimal fake SVG DOM, matching
 * this suite's "mock the DOM" convention (no jsdom dependency).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { buildInitialState } from '../state/state-init.js';
import { TEST_PLAYERS } from '../test-helpers.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

let created = 0;

class FakeNode {
  constructor(tag) {
    this.tagName = tag; this.attributes = {}; this.children = [];
    this.textContent = ''; this.parentNode = null;
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k]; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    c.parentNode = null; return c;
  }
  get firstChild() { return this.children[0] || null; }
  get parentElement() { return this.parentNode; }
}

beforeEach(() => {
  created = 0;
  globalThis.document = {
    createElementNS: (_ns, tag) => { created++; return new FakeNode(tag); }
  };
});

function occupiedSpaceNames(state) {
  return Object.entries(state.spaces)
    .filter(([, s]) => s.units && s.units.length > 0)
    .map(([name]) => name);
}

describe('MapOverlay — diff-based unit-stack updates', () => {
  let MapOverlay, state, group, overlay;

  beforeEach(async () => {
    ({ MapOverlay } = await import('./map-overlay.js'));
    state = buildInitialState(TEST_PLAYERS, {});
    group = new FakeNode('g');
    overlay = new MapOverlay(group);
  });

  it('renders exactly one stack per occupied space', () => {
    overlay.update(state);
    const occupied = occupiedSpaceNames(state);
    expect(occupied.length).toBeGreaterThan(30); // 1517 map is densely populated
    expect(group.children.length).toBe(occupied.length);
    expect(Object.keys(overlay._unitNodes).sort()).toEqual(occupied.slice().sort());
    for (const node of group.children) {
      expect(node.getAttribute('data-space')).toBeTruthy();
    }
  });

  it('creates no nodes and preserves identity when state is unchanged', () => {
    overlay.update(state);
    const childrenBefore = group.children.slice();
    const sampleName = occupiedSpaceNames(state)[0];
    const nodeBefore = overlay._unitNodes[sampleName];

    created = 0;
    overlay.update(state); // identical state

    expect(created).toBe(0);
    expect(group.children).toEqual(childrenBefore);
    expect(overlay._unitNodes[sampleName]).toBe(nodeBefore);
  });

  it('rebuilds only the changed space, leaving others untouched', () => {
    overlay.update(state);
    const [changed, other] = occupiedSpaceNames(state);
    const changedBefore = overlay._unitNodes[changed];
    const otherBefore = overlay._unitNodes[other];

    state.spaces[changed].units[0].regulars =
      (state.spaces[changed].units[0].regulars || 0) + 1;
    overlay.update(state);

    expect(overlay._unitNodes[changed]).not.toBe(changedBefore); // rebuilt
    expect(overlay._unitNodes[other]).toBe(otherBefore);         // untouched
    expect(group.children.length).toBe(occupiedSpaceNames(state).length);
  });

  it('removes a stack when its space empties out', () => {
    overlay.update(state);
    const name = occupiedSpaceNames(state)[0];
    expect(overlay._unitNodes[name]).toBeTruthy();

    state.spaces[name].units = [];
    overlay.update(state);

    expect(overlay._unitNodes[name]).toBeUndefined();
    expect(group.children.some(n => n.getAttribute('data-space') === name)).toBe(false);
  });

  it('drops a stack whose units all become non-renderable (all-zero)', () => {
    overlay.update(state);
    const name = occupiedSpaceNames(state)[0];
    for (const u of state.spaces[name].units) {
      u.regulars = 0; u.mercenaries = 0; u.cavalry = 0;
      u.squadrons = 0; u.corsairs = 0; u.leaders = [];
    }
    overlay.update(state);
    expect(overlay._unitNodes[name]).toBeUndefined();
  });

  it('clears every stack when state has no spaces', () => {
    overlay.update(state);
    expect(group.children.length).toBeGreaterThan(0);
    overlay.update({ spaces: null });
    expect(group.children.length).toBe(0);
    expect(Object.keys(overlay._unitNodes)).toHaveLength(0);
  });
});

describe('MapRenderer — diff-based siege/unrest indicators', () => {
  let MapRenderer, renderer, state;
  const SPACE = 'Vienna';

  beforeEach(async () => {
    ({ MapRenderer } = await import('./map-renderer.js'));
    renderer = new MapRenderer();
    renderer._indicatorGroup = new FakeNode('g');
    state = buildInitialState(TEST_PLAYERS, {});
  });

  it('renders an indicator only for besieged/unrest spaces', () => {
    state.spaces[SPACE].besieged = true;
    renderer._updateIndicators(state);
    expect(renderer._indicatorGroup.children.length).toBe(1);
    expect(renderer._indicatorNodes[SPACE]).toBeTruthy();
  });

  it('creates no nodes when no indicator changed', () => {
    state.spaces[SPACE].besieged = true;
    renderer._updateIndicators(state);
    const node = renderer._indicatorNodes[SPACE].node;

    created = 0;
    renderer._updateIndicators(state);

    expect(created).toBe(0);
    expect(renderer._indicatorNodes[SPACE].node).toBe(node);
  });

  it('rebuilds an indicator when its condition changes (siege -> +unrest)', () => {
    state.spaces[SPACE].besieged = true;
    renderer._updateIndicators(state);
    const before = renderer._indicatorNodes[SPACE].node;

    state.spaces[SPACE].unrest = true;
    renderer._updateIndicators(state);

    expect(renderer._indicatorNodes[SPACE].node).not.toBe(before);
    expect(renderer._indicatorGroup.children.length).toBe(1);
  });

  it('removes an indicator when the condition clears', () => {
    state.spaces[SPACE].besieged = true;
    renderer._updateIndicators(state);
    state.spaces[SPACE].besieged = false;
    renderer._updateIndicators(state);
    expect(renderer._indicatorNodes[SPACE]).toBeUndefined();
    expect(renderer._indicatorGroup.children.length).toBe(0);
  });
});
