/**
 * Here I Stand — Map Interaction
 *
 * Pan, zoom, and interaction handling for the SVG map.
 */

export class MapInteraction {
  /**
   * @param {SVGElement} svg - The map SVG element
   */
  constructor(svg) {
    this._svg = svg;
    this._isPanning = false;
    this._startX = 0;
    this._startY = 0;
    this._viewBox = { x: 0, y: 0, w: 1700, h: 1133 };
    this._minZoom = 0.3;
    this._maxZoom = 3;
    this._currentZoom = 1;

    this._bindEvents();
  }

  /** Reset view to default */
  resetView() {
    this._viewBox = { x: 0, y: 0, w: 1700, h: 1133 };
    this._currentZoom = 1;
    this._applyViewBox();
    this._svg.style.cursor = 'grab';
  }

  /** Zoom to fit a specific region */
  zoomToRegion(cx, cy, radius) {
    this._viewBox.x = cx - radius;
    this._viewBox.y = cy - radius;
    this._viewBox.w = radius * 2;
    this._viewBox.h = radius * 2;
    this._currentZoom = 1700 / (radius * 2);
    this._applyViewBox();
  }

  /** Get current zoom level */
  getZoom() { return this._currentZoom; }

  // ── Private ────────────────────────────────────────────────────

  _bindEvents() {
    // Wheel zoom
    this._svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.15 : 0.87;
      this._zoom(delta, e.clientX, e.clientY);
    }, { passive: false });

    // Pan start
    this._svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      // Only pan if clicking on background (not a space)
      if (e.target === this._svg || e.target.tagName === 'line') {
        this._isPanning = true;
        this._startX = e.clientX;
        this._startY = e.clientY;
        this._svg.style.cursor = 'grabbing';
        this._svg.setPointerCapture(e.pointerId);
      }
    });

    // Pan move
    this._svg.addEventListener('pointermove', (e) => {
      if (!this._isPanning) return;
      const rect = this._svg.getBoundingClientRect();
      const scaleX = this._viewBox.w / rect.width;
      const scaleY = this._viewBox.h / rect.height;
      const dx = (e.clientX - this._startX) * scaleX;
      const dy = (e.clientY - this._startY) * scaleY;

      this._viewBox.x -= dx;
      this._viewBox.y -= dy;
      this._startX = e.clientX;
      this._startY = e.clientY;
      this._applyViewBox();
    });

    // Pan end
    this._svg.addEventListener('pointerup', () => {
      this._isPanning = false;
      this._svg.style.cursor = 'grab';
    });

    // Touch pinch zoom
    let lastTouchDist = 0;
    this._svg.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        lastTouchDist = this._touchDist(e.touches);
      }
    }, { passive: true });

    this._svg.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const dist = this._touchDist(e.touches);
        if (lastTouchDist > 0) {
          const delta = lastTouchDist / dist;
          const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          this._zoom(delta, cx, cy);
        }
        lastTouchDist = dist;
      }
    }, { passive: true });
  }

  _zoom(factor, clientX, clientY) {
    const newZoom = this._currentZoom / factor;
    if (newZoom < this._minZoom || newZoom > this._maxZoom) return;

    const rect = this._svg.getBoundingClientRect();
    const mouseX = this._viewBox.x
      + ((clientX - rect.left) / rect.width) * this._viewBox.w;
    const mouseY = this._viewBox.y
      + ((clientY - rect.top) / rect.height) * this._viewBox.h;

    this._viewBox.w *= factor;
    this._viewBox.h *= factor;
    this._viewBox.x = mouseX - ((clientX - rect.left) / rect.width)
      * this._viewBox.w;
    this._viewBox.y = mouseY - ((clientY - rect.top) / rect.height)
      * this._viewBox.h;
    this._currentZoom = newZoom;
    this._applyViewBox();
  }

  _applyViewBox() {
    const { x, y, w, h } = this._viewBox;
    this._svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  }

  _touchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
