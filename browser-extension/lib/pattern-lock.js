/**
 * MagpieAuth Pattern Lock Component
 * 
 * Canvas-based 4x4 pattern lock matching the main app's PatternLock.tsx.
 * Supports mouse drag, intermediate point detection, error states,
 * and auto-reset after pattern completion.
 */

class PatternLock {
  /**
   * @param {HTMLCanvasElement} canvas - The canvas element to render on
   * @param {object} options
   * @param {function} options.onComplete - Callback when pattern is drawn, receives array of indices
   * @param {number} [options.gridSize=4] - Grid dimensions (4 = 4x4 = 16 dots)
   * @param {number} [options.dotRadius=8] - Radius of each dot
   * @param {number} [options.hitRadius=24] - Hit detection radius (larger than visual dot)
   * @param {number} [options.lineWidth=3] - Width of connecting lines
   * @param {number} [options.resetDelay=600] - Ms to wait before auto-reset after completion
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onComplete = options.onComplete || (() => {});

    // Configuration
    this.gridSize = options.gridSize || 4;
    this.dotRadius = options.dotRadius || 8;
    this.hitRadius = options.hitRadius || 24;
    this.lineWidth = options.lineWidth || 3;
    this.resetDelay = options.resetDelay || 600;

    // State
    this.selectedDots = [];
    this.isDrawing = false;
    this.currentPos = null; // Current mouse/touch position
    this.errorState = false;
    this.disabled = false;

    // Colors
    this.colors = {
      dotIdle: 'rgba(255, 255, 255, 0.25)',
      dotIdleBorder: 'rgba(255, 255, 255, 0.35)',
      dotActive: '#a78bfa',
      dotActiveGlow: 'rgba(167, 139, 250, 0.5)',
      dotError: '#ef4444',
      dotErrorGlow: 'rgba(239, 68, 68, 0.5)',
      lineActive: 'rgba(167, 139, 250, 0.7)',
      lineError: 'rgba(239, 68, 68, 0.6)',
    };

    // Calculate dot positions
    this._calculateDotPositions();

    // Bind event handlers
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);

    // Attach events
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('mouseleave', this._onMouseUp);

    // Prevent text selection / context menu
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.style.userSelect = 'none';
    this.canvas.style.touchAction = 'none';

    // Initial render
    this._render();
  }

  // ── Layout Calculation ──────────────────────────────────────────

  /**
   * Compute the (x, y) center of each dot on the canvas.
   * Dots are evenly distributed within the canvas with padding.
   */
  _calculateDotPositions() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const padding = 30;
    const cols = this.gridSize;
    const rows = this.gridSize;

    const cellW = (w - padding * 2) / (cols - 1);
    const cellH = (h - padding * 2) / (rows - 1);

    this.dots = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        this.dots.push({
          x: padding + col * cellW,
          y: padding + row * cellH,
          index: row * cols + col,
        });
      }
    }
  }

  // ── Intermediate Point Detection ────────────────────────────────

  /**
   * Check if any unselected dots lie on the line between two dots.
   * This matches the main app's behavior: dragging from 0 → 2 auto-selects 1.
   * @param {number} fromIndex - Starting dot index
   * @param {number} toIndex - Target dot index
   * @returns {number[]} Array of intermediate dot indices (in order)
   */
  _getIntermediateDots(fromIndex, toIndex) {
    const from = this.dots[fromIndex];
    const to = this.dots[toIndex];
    const intermediates = [];

    for (const dot of this.dots) {
      if (dot.index === fromIndex || dot.index === toIndex) continue;
      if (this.selectedDots.includes(dot.index)) continue;

      // Check if this dot lies on the line segment from → to
      if (this._isPointOnSegment(from, to, dot)) {
        intermediates.push({
          index: dot.index,
          dist: Math.hypot(dot.x - from.x, dot.y - from.y),
        });
      }
    }

    // Sort by distance from 'from' so they are added in order
    intermediates.sort((a, b) => a.dist - b.dist);
    return intermediates.map((d) => d.index);
  }

  /**
   * Check if point P lies on the line segment from A to B,
   * within the hit detection tolerance.
   */
  _isPointOnSegment(a, b, p) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return false;

    // Project P onto line AB
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len);
    if (t < 0.01 || t > 0.99) return false; // Must be between A and B

    // Distance from P to the projected point
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    const dist = Math.hypot(p.x - projX, p.y - projY);

    return dist < 2; // Very tight tolerance for grid-aligned points
  }

  // ── Hit Detection ──────────────────────────────────────────────

  /**
   * Find which dot (if any) is under the given canvas coordinates.
   * @returns {number|null} Dot index or null
   */
  _hitTest(x, y) {
    for (const dot of this.dots) {
      const dist = Math.hypot(x - dot.x, y - dot.y);
      if (dist <= this.hitRadius) {
        return dot.index;
      }
    }
    return null;
  }

  /**
   * Get canvas-relative coordinates from a mouse event.
   */
  _getCanvasPos(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  // ── Event Handlers ─────────────────────────────────────────────

  _onMouseDown(event) {
    if (this.disabled) return;
    event.preventDefault();

    const pos = this._getCanvasPos(event);
    const dotIndex = this._hitTest(pos.x, pos.y);

    if (dotIndex !== null) {
      this.isDrawing = true;
      this.errorState = false;
      this.selectedDots = [dotIndex];
      this.currentPos = pos;
      this._render();
    }
  }

  _onMouseMove(event) {
    if (!this.isDrawing || this.disabled) return;
    event.preventDefault();

    const pos = this._getCanvasPos(event);
    this.currentPos = pos;

    const dotIndex = this._hitTest(pos.x, pos.y);
    if (dotIndex !== null && !this.selectedDots.includes(dotIndex)) {
      const lastSelected = this.selectedDots[this.selectedDots.length - 1];

      // Check for intermediate dots
      const intermediates = this._getIntermediateDots(lastSelected, dotIndex);
      for (const midIdx of intermediates) {
        if (!this.selectedDots.includes(midIdx)) {
          this.selectedDots.push(midIdx);
        }
      }

      this.selectedDots.push(dotIndex);
    }

    this._render();
  }

  _onMouseUp(event) {
    if (!this.isDrawing) return;
    event.preventDefault();

    this.isDrawing = false;
    this.currentPos = null;

    if (this.selectedDots.length >= 2) {
      // Pattern complete - notify callback
      const pattern = [...this.selectedDots];
      this._render();
      this.onComplete(pattern);
    } else {
      // Too short, reset immediately
      this.reset();
    }
  }

  // ── Rendering ─────────────────────────────────────────────────

  _render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    // Draw connecting lines between selected dots
    if (this.selectedDots.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = this.errorState
        ? this.colors.lineError
        : this.colors.lineActive;
      ctx.lineWidth = this.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const firstDot = this.dots[this.selectedDots[0]];
      ctx.moveTo(firstDot.x, firstDot.y);

      for (let i = 1; i < this.selectedDots.length; i++) {
        const dot = this.dots[this.selectedDots[i]];
        ctx.lineTo(dot.x, dot.y);
      }

      // Draw line to current mouse position while dragging
      if (this.isDrawing && this.currentPos) {
        ctx.lineTo(this.currentPos.x, this.currentPos.y);
      }

      ctx.stroke();
    }

    // Draw all dots
    for (const dot of this.dots) {
      const isSelected = this.selectedDots.includes(dot.index);

      if (isSelected) {
        // Active/selected dot with glow
        const glowColor = this.errorState
          ? this.colors.dotErrorGlow
          : this.colors.dotActiveGlow;
        const dotColor = this.errorState
          ? this.colors.dotError
          : this.colors.dotActive;

        // Outer glow
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, this.dotRadius + 8, 0, Math.PI * 2);
        ctx.fillStyle = glowColor;
        ctx.fill();

        // Inner dot
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, this.dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();

        // Center highlight
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, this.dotRadius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fill();
      } else {
        // Idle dot
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, this.dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = this.colors.dotIdle;
        ctx.fill();

        // Subtle border
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, this.dotRadius, 0, Math.PI * 2);
        ctx.strokeStyle = this.colors.dotIdleBorder;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  // ── Public Methods ─────────────────────────────────────────────

  /**
   * Set the pattern lock to error state (red color).
   */
  setError() {
    this.errorState = true;
    this._render();

    // Auto-reset after delay
    setTimeout(() => this.reset(), this.resetDelay);
  }

  /**
   * Reset the pattern lock to initial state.
   */
  reset() {
    this.selectedDots = [];
    this.isDrawing = false;
    this.currentPos = null;
    this.errorState = false;
    this._render();
  }

  /**
   * Enable or disable the pattern lock.
   */
  setDisabled(disabled) {
    this.disabled = disabled;
    this.canvas.style.opacity = disabled ? '0.5' : '1';
  }

  /**
   * Resize the canvas and recalculate positions.
   * Call this if the canvas container size changes.
   */
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this._calculateDotPositions();
    this._render();
  }

  /**
   * Clean up event listeners.
   */
  destroy() {
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('mouseleave', this._onMouseUp);
  }
}
