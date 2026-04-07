/**
 * LabelCanvas - HTML5 Canvas based image annotation drawing.
 */
class LabelCanvas {
  constructor(canvasEl, containerEl) {
    this.canvas = canvasEl;
    this.container = containerEl;
    this.ctx = canvasEl.getContext('2d');

    this.image = null;
    this.imgWidth = 0;
    this.imgHeight = 0;

    // View transform
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // Shapes
    this.shapes = [];
    this.selectedIndex = -1;

    // Drawing state
    this.mode = 'create'; // 'create' | 'edit'
    this.drawing = false;
    this.drawStart = null;
    this.drawEnd = null;

    // Drag state
    this.dragging = false;
    this.dragType = null; // 'move' | 'resize'
    this.dragCorner = -1;
    this.dragStart = null;
    this.dragOrigShape = null;

    // Pan state
    this.panning = false;
    this.panStart = null;
    this.panOffsetStart = null;

    // Callbacks
    this.onShapeCreated = null;
    this.onShapeSelected = null;
    this.onShapeModified = null;
    this.onMouseMove = null;

    // Corner handle size
    this.handleSize = 6;

    this._bindEvents();
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.render();
  }

  _bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this._onWheel(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Convert screen coords to image coords
  screenToImage(sx, sy) {
    return {
      x: (sx - this.offsetX) / this.scale,
      y: (sy - this.offsetY) / this.scale
    };
  }

  // Convert image coords to screen coords
  imageToScreen(ix, iy) {
    return {
      x: ix * this.scale + this.offsetX,
      y: iy * this.scale + this.offsetY
    };
  }

  _onMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Middle mouse button or right button for panning
    if (e.button === 1 || e.button === 2) {
      this.panning = true;
      this.panStart = { x: sx, y: sy };
      this.panOffsetStart = { x: this.offsetX, y: this.offsetY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    const imgPos = this.screenToImage(sx, sy);

    // Always check corner handles of selected shape first
    if (this.selectedIndex >= 0) {
      const corner = this._hitCorner(sx, sy, this.shapes[this.selectedIndex]);
      if (corner >= 0) {
        this.dragging = true;
        this.dragType = 'resize';
        this.dragCorner = corner;
        this.dragStart = imgPos;
        this.dragOrigShape = JSON.parse(JSON.stringify(this.shapes[this.selectedIndex]));
        return;
      }
    }

    // Always check if clicking inside any shape (regardless of mode)
    const hitIdx = this._hitShape(imgPos.x, imgPos.y);
    if (hitIdx >= 0) {
      this.selectedIndex = hitIdx;
      this.dragging = true;
      this.dragType = 'move';
      this.dragStart = imgPos;
      this.dragOrigShape = JSON.parse(JSON.stringify(this.shapes[hitIdx]));
      if (this.onShapeSelected) this.onShapeSelected(hitIdx);
      this.render();
      return;
    }

    // Clicked empty area
    if (this.mode === 'create') {
      // Deselect
      if (this.selectedIndex >= 0) {
        this.selectedIndex = -1;
        if (this.onShapeSelected) this.onShapeSelected(-1);
      }
      this.drawing = true;
      this.drawStart = imgPos;
      this.drawEnd = imgPos;
    } else {
      // Edit mode, clicked empty area - deselect
      this.selectedIndex = -1;
      if (this.onShapeSelected) this.onShapeSelected(-1);
      this.render();
    }
  }

  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const imgPos = this.screenToImage(sx, sy);

    if (this.onMouseMove) {
      this.onMouseMove(Math.round(imgPos.x), Math.round(imgPos.y));
    }

    if (this.panning) {
      this.offsetX = this.panOffsetStart.x + (sx - this.panStart.x);
      this.offsetY = this.panOffsetStart.y + (sy - this.panStart.y);
      this.render();
      return;
    }

    if (this.drawing) {
      this.drawEnd = imgPos;
      this.render();
      return;
    }

    if (this.dragging) {
      const dx = imgPos.x - this.dragStart.x;
      const dy = imgPos.y - this.dragStart.y;
      const shape = this.shapes[this.selectedIndex];

      if (this.dragType === 'move') {
        const orig = this.dragOrigShape;
        shape.points = orig.points.map(p => [p[0] + dx, p[1] + dy]);
      } else if (this.dragType === 'resize') {
        const orig = this.dragOrigShape;
        const pts = orig.points.map(p => [...p]);
        // corners: 0=TL, 1=TR, 2=BR, 3=BL
        switch (this.dragCorner) {
          case 0: pts[0][0] += dx; pts[0][1] += dy; pts[1][1] += dy; pts[3][0] += dx; break;
          case 1: pts[1][0] += dx; pts[1][1] += dy; pts[0][1] += dy; pts[2][0] += dx; break;
          case 2: pts[2][0] += dx; pts[2][1] += dy; pts[1][0] += dx; pts[3][1] += dy; break;
          case 3: pts[3][0] += dx; pts[3][1] += dy; pts[0][0] += dx; pts[2][1] += dy; break;
        }
        shape.points = pts;
      }

      this.render();
      return;
    }

    // Update cursor based on hover state
    if (this.selectedIndex >= 0) {
      const corner = this._hitCorner(sx, sy, this.shapes[this.selectedIndex]);
      if (corner >= 0) {
        this.canvas.style.cursor = (corner === 0 || corner === 2) ? 'nwse-resize' : 'nesw-resize';
        return;
      }
    }

    const hitIdx = this._hitShape(imgPos.x, imgPos.y);
    if (hitIdx >= 0 && this.mode === 'edit') {
      this.canvas.style.cursor = 'move';
    } else {
      this.canvas.style.cursor = this.mode === 'create' ? 'crosshair' : 'default';
    }
  }

  _onMouseUp(e) {
    if (this.panning) {
      this.panning = false;
      this.canvas.style.cursor = this.mode === 'create' ? 'crosshair' : 'default';
      return;
    }

    if (this.drawing && this.drawStart && this.drawEnd) {
      const x1 = Math.min(this.drawStart.x, this.drawEnd.x);
      const y1 = Math.min(this.drawStart.y, this.drawEnd.y);
      const x2 = Math.max(this.drawStart.x, this.drawEnd.x);
      const y2 = Math.max(this.drawStart.y, this.drawEnd.y);

      // Minimum size check
      if (Math.abs(x2 - x1) > 5 && Math.abs(y2 - y1) > 5) {
        // Clamp to image bounds
        const cx1 = Math.max(0, Math.min(x1, this.imgWidth));
        const cy1 = Math.max(0, Math.min(y1, this.imgHeight));
        const cx2 = Math.max(0, Math.min(x2, this.imgWidth));
        const cy2 = Math.max(0, Math.min(y2, this.imgHeight));

        if (this.onShapeCreated) {
          this.onShapeCreated([
            [cx1, cy1], [cx2, cy1], [cx2, cy2], [cx1, cy2]
          ]);
        }
      }

      this.drawing = false;
      this.drawStart = null;
      this.drawEnd = null;
      this.render();
      return;
    }

    if (this.dragging) {
      this.dragging = false;
      this.dragType = null;
      this.dragCorner = -1;
      if (this.onShapeModified) this.onShapeModified(this.selectedIndex);
      return;
    }
  }

  _onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const oldScale = this.scale;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    this.scale = Math.max(0.1, Math.min(20, this.scale * factor));

    // Zoom towards mouse
    this.offsetX = mx - (mx - this.offsetX) * (this.scale / oldScale);
    this.offsetY = my - (my - this.offsetY) * (this.scale / oldScale);

    this.render();
    if (this.onZoomChanged) this.onZoomChanged(this.scale);
  }

  _hitShape(ix, iy) {
    // Check from top (last drawn) to bottom
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const s = this.shapes[i];
      const bbox = this._shapeBBox(s);
      if (ix >= bbox.x1 && ix <= bbox.x2 && iy >= bbox.y1 && iy <= bbox.y2) {
        return i;
      }
    }
    return -1;
  }

  _hitCorner(sx, sy, shape) {
    if (!shape) return -1;
    const pts = shape.points;
    const bbox = {
      x1: Math.min(pts[0][0], pts[2][0]),
      y1: Math.min(pts[0][1], pts[2][1]),
      x2: Math.max(pts[0][0], pts[2][0]),
      y2: Math.max(pts[0][1], pts[2][1])
    };

    const corners = [
      [bbox.x1, bbox.y1],
      [bbox.x2, bbox.y1],
      [bbox.x2, bbox.y2],
      [bbox.x1, bbox.y2]
    ];

    const hs = this.handleSize + 2;
    for (let i = 0; i < 4; i++) {
      const sp = this.imageToScreen(corners[i][0], corners[i][1]);
      if (Math.abs(sx - sp.x) <= hs && Math.abs(sy - sp.y) <= hs) {
        return i;
      }
    }
    return -1;
  }

  _shapeBBox(shape) {
    const pts = shape.points;
    return {
      x1: Math.min(pts[0][0], pts[1][0], pts[2][0], pts[3][0]),
      y1: Math.min(pts[0][1], pts[1][1], pts[2][1], pts[3][1]),
      x2: Math.max(pts[0][0], pts[1][0], pts[2][0], pts[3][0]),
      y2: Math.max(pts[0][1], pts[1][1], pts[2][1], pts[3][1])
    };
  }

  loadImage(dataUrl, width, height) {
    this.imgWidth = width;
    this.imgHeight = height;

    this.image = new Image();
    this.image.onload = () => {
      this.fitWindow();
    };
    this.image.src = dataUrl;
  }

  setShapes(shapes) {
    this.shapes = shapes.map(s => ({
      label: s.label,
      points: s.points.map(p => [...p]),
      difficult: s.difficult || false
    }));
    this.selectedIndex = -1;
    this.render();
  }

  addShape(label, points, difficult) {
    this.shapes.push({
      label,
      points: points.map(p => [...p]),
      difficult: difficult || false
    });
    this.selectedIndex = this.shapes.length - 1;
    this.render();
    return this.selectedIndex;
  }

  deleteSelected() {
    if (this.selectedIndex < 0) return false;
    this.shapes.splice(this.selectedIndex, 1);
    this.selectedIndex = -1;
    this.render();
    return true;
  }

  selectShape(index) {
    this.selectedIndex = index;
    this.render();
  }

  fitWindow() {
    if (!this.image) return;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const padding = 40;

    const scaleX = (cw - padding * 2) / this.imgWidth;
    const scaleY = (ch - padding * 2) / this.imgHeight;
    this.scale = Math.min(scaleX, scaleY, 1);

    this.offsetX = (cw - this.imgWidth * this.scale) / 2;
    this.offsetY = (ch - this.imgHeight * this.scale) / 2;

    this.render();
    if (this.onZoomChanged) this.onZoomChanged(this.scale);
  }

  zoomIn() {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const oldScale = this.scale;
    this.scale = Math.min(20, this.scale * 1.2);
    this.offsetX = cx - (cx - this.offsetX) * (this.scale / oldScale);
    this.offsetY = cy - (cy - this.offsetY) * (this.scale / oldScale);
    this.render();
    if (this.onZoomChanged) this.onZoomChanged(this.scale);
  }

  zoomOut() {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const oldScale = this.scale;
    this.scale = Math.max(0.1, this.scale / 1.2);
    this.offsetX = cx - (cx - this.offsetX) * (this.scale / oldScale);
    this.offsetY = cy - (cy - this.offsetY) * (this.scale / oldScale);
    this.render();
    if (this.onZoomChanged) this.onZoomChanged(this.scale);
  }

  getShapesData() {
    return this.shapes.map(s => ({
      label: s.label,
      points: s.points.map(p => [...p]),
      difficult: s.difficult
    }));
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Draw image
    if (this.image && this.image.complete) {
      ctx.save();
      ctx.translate(this.offsetX, this.offsetY);
      ctx.scale(this.scale, this.scale);
      ctx.drawImage(this.image, 0, 0, this.imgWidth, this.imgHeight);
      ctx.restore();
    }

    // Draw shapes
    for (let i = 0; i < this.shapes.length; i++) {
      this._drawShape(ctx, this.shapes[i], i === this.selectedIndex);
    }

    // Draw current drawing rect
    if (this.drawing && this.drawStart && this.drawEnd) {
      const p1 = this.imageToScreen(this.drawStart.x, this.drawStart.y);
      const p2 = this.imageToScreen(this.drawEnd.x, this.drawEnd.y);
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
      ctx.setLineDash([]);
    }
  }

  _drawShape(ctx, shape, selected) {
    const pts = shape.points;
    if (pts.length < 4) return;

    const bbox = this._shapeBBox(shape);
    const tl = this.imageToScreen(bbox.x1, bbox.y1);
    const br = this.imageToScreen(bbox.x2, bbox.y2);
    const sw = br.x - tl.x;
    const sh = br.y - tl.y;

    // Generate color from label
    const color = this._labelColor(shape.label);

    // Fill
    ctx.fillStyle = selected
      ? `rgba(${color.r}, ${color.g}, ${color.b}, 0.25)`
      : `rgba(${color.r}, ${color.g}, ${color.b}, 0.1)`;
    ctx.fillRect(tl.x, tl.y, sw, sh);

    // Stroke
    ctx.strokeStyle = selected
      ? '#ffffff'
      : `rgb(${color.r}, ${color.g}, ${color.b})`;
    ctx.lineWidth = selected ? 2 : 1.5;
    ctx.strokeRect(tl.x, tl.y, sw, sh);

    // Label text
    const fontSize = Math.max(11, Math.min(14, 12 / this.scale * this.scale));
    ctx.font = `bold ${fontSize}px sans-serif`;
    const text = shape.label + (shape.difficult ? ' [D]' : '');
    const textMetrics = ctx.measureText(text);
    const textH = fontSize + 4;
    const textW = textMetrics.width + 8;

    // Label background
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.85)`;
    ctx.fillRect(tl.x, tl.y - textH, textW, textH);

    // Label text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, tl.x + 4, tl.y - 4);

    // Corner handles when selected
    if (selected) {
      const corners = [
        [bbox.x1, bbox.y1],
        [bbox.x2, bbox.y1],
        [bbox.x2, bbox.y2],
        [bbox.x1, bbox.y2]
      ];
      const hs = this.handleSize;
      for (const c of corners) {
        const sp = this.imageToScreen(c[0], c[1]);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sp.x - hs, sp.y - hs, hs * 2, hs * 2);
        ctx.strokeStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sp.x - hs, sp.y - hs, hs * 2, hs * 2);
      }
    }
  }

  _labelColor(label) {
    // Simple deterministic hash to color
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    const r = ((hash >> 0) & 0xff);
    const g = ((hash >> 8) & 0xff);
    const b = ((hash >> 16) & 0xff);
    // Ensure minimum brightness
    const br = Math.max(100, (r + g + b) / 3);
    const factor = br < 100 ? 100 / br : 1;
    return {
      r: Math.min(255, Math.round(r * factor + 50)),
      g: Math.min(255, Math.round(g * factor + 50)),
      b: Math.min(255, Math.round(b * factor + 50))
    };
  }
}
