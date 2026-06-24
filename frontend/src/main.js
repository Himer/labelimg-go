/**
 * LabelImg Wails Frontend - Main Application Logic
 */
(function () {
  'use strict';

  // DOM elements
  const canvasEl = document.getElementById('canvas');
  const containerEl = document.getElementById('canvas-container');
  const statusFile = document.getElementById('status-file');
  const statusPos = document.getElementById('status-pos');
  const statusZoom = document.getElementById('status-zoom');
  const labelsList = document.getElementById('labels-list');
  const filesList = document.getElementById('files-list');
  const shapeCount = document.getElementById('shape-count');
  const fileCount = document.getElementById('file-count');
  const labelInput = document.getElementById('label-input');
  const labelSuggestions = document.getElementById('label-suggestions');
  const dialogLabelSuggestions = document.getElementById('dialog-label-suggestions');
  const useDefaultLabelCheckbox = document.getElementById('use-default-label');
  const btnSave = document.getElementById('btn-save');
  const formatSelect = document.getElementById('format-select');
  const labelsFilter = document.getElementById('labels-filter');
  const filesFilter = document.getElementById('files-filter');

  // State
  let files = [];
  let labelHistory = [];
  let currentImageData = null;
  let dirty = false;

  // --- Undo/Redo ---
  const MAX_UNDO = 50;
  let undoStack = [];
  let redoStack = [];

  function snapshotShapes() {
    return lc.shapes.map(s => ({
      label: s.label,
      points: s.points.map(p => [...p]),
      difficult: s.difficult
    }));
  }

  function pushUndo() {
    undoStack.push(snapshotShapes());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
  }

  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(snapshotShapes());
    const prev = undoStack.pop();
    lc.shapes = prev;
    lc.selectedIndex = -1;
    lc.render();
    dirty = true;
    updateLabelsPanel();
    updateSaveButton();
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(snapshotShapes());
    const next = redoStack.pop();
    lc.shapes = next;
    lc.selectedIndex = -1;
    lc.render();
    dirty = true;
    updateLabelsPanel();
    updateSaveButton();
  }

  function resetUndoRedo() {
    undoStack = [];
    redoStack = [];
  }

  // --- Save button state ---
  function updateSaveButton() {
    if (dirty) {
      btnSave.classList.add('dirty');
      btnSave.classList.remove('saved');
    } else {
      btnSave.classList.remove('dirty');
      btnSave.classList.add('saved');
    }
  }

  // Initialize canvas
  const lc = new LabelCanvas(canvasEl, containerEl);

  // --- Canvas callbacks ---

  lc.onShapeCreated = function (points) {
    const defaultLabel = useDefaultLabelCheckbox.checked ? labelInput.value.trim() : '';

    if (defaultLabel) {
      // Fast annotation mode: skip dialog
      pushUndo();
      lc.addShape(defaultLabel, points, false);
      addToLabelHistory(defaultLabel);
      dirty = true;
      updateLabelsPanel();
      updateSaveButton();
    } else {
      // Normal mode: show dialog
      showLabelDialog('').then(label => {
        if (label) {
          pushUndo();
          lc.addShape(label, points, false);
          addToLabelHistory(label);
          dirty = true;
          updateLabelsPanel();
          updateSaveButton();
        } else {
          lc.render();
        }
      });
    }
  };

  lc.onShapeSelected = function (index) {
    updateLabelsPanel();
    if (index >= 0) {
      labelInput.value = lc.shapes[index].label;
    }
  };

  lc.onShapeDoubleClick = function (index) {
    if (index < 0 || index >= lc.shapes.length) return;
    const current = lc.shapes[index].label;
    showLabelDialog(current).then(newLabel => {
      if (!newLabel || newLabel === current) {
        lc.render();
        return;
      }
      pushUndo();
      lc.shapes[index].label = newLabel;
      addToLabelHistory(newLabel);
      labelInput.value = newLabel;
      dirty = true;
      lc.render();
      updateLabelsPanel();
      updateSaveButton();
    });
  };

  const canvasTooltip = document.getElementById('canvas-tooltip');
  lc.canvas.addEventListener('mouseleave', () => {
    canvasTooltip.style.display = 'none';
  });
  lc.onHoverShape = function (idx, sx, sy) {
    if (idx < 0 || lc.panMode) {
      canvasTooltip.style.display = 'none';
      return;
    }
    canvasTooltip.textContent = 'Double-click to change label';
    canvasTooltip.style.display = 'block';
    // Position above-right of cursor; clamp to container.
    const cw = containerEl.clientWidth;
    let x = sx + 14;
    let y = sy - 28;
    if (x + canvasTooltip.offsetWidth > cw - 4) x = cw - canvasTooltip.offsetWidth - 4;
    if (y < 4) y = sy + 18;
    canvasTooltip.style.left = x + 'px';
    canvasTooltip.style.top = y + 'px';
  };

  lc.onShapeModified = function () {
    pushUndo();
    dirty = true;
    updateSaveButton();
  };

  // Capture shape state before drag starts (for undo on drag)
  const origOnMouseDown = lc._onMouseDown.bind(lc);
  lc._onMouseDown = function (e) {
    const rect = lc.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    // If left button and we might start a drag on existing shape, snapshot before
    if (e.button === 0 && lc.selectedIndex >= 0) {
      const imgPos = lc.screenToImage(sx, sy);
      const corner = lc._hitCorner(sx, sy, lc.shapes[lc.selectedIndex]);
      const hit = lc._hitShape(imgPos.x, imgPos.y);
      if (corner >= 0 || hit >= 0) {
        // Will be dragging - snapshot taken by onShapeModified after drag ends
      }
    }
    origOnMouseDown(e);
  };

  lc.onMouseMove = function (x, y) {
    if (currentImageData) {
      statusPos.textContent = `${x}, ${y}`;
    }
  };

  lc.onZoomChanged = function (scale) {
    statusZoom.textContent = Math.round(scale * 100) + '%';
  };

  // --- Label dialog ---

  function showLabelDialog(defaultLabel) {
    return new Promise((resolve) => {
      const dialog = document.getElementById('label-dialog');
      const input = document.getElementById('dialog-label-input');
      const ddBtn = document.getElementById('dialog-label-dropdown-btn');
      const dd = document.getElementById('dialog-label-dropdown');
      dialog.style.display = 'flex';
      input.value = defaultLabel || '';
      updateDialogSuggestions();
      let ddOpen = false;
      let activeIdx = -1;
      let ddFilterMode = false; // when true, filter by input text; otherwise show all

      function renderDropdown() {
        const filter = ddFilterMode ? input.value.trim().toLowerCase() : '';
        const items = labelHistory.filter(l => !filter || l.toLowerCase().includes(filter));
        dd.innerHTML = '';
        if (items.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'dd-empty';
          empty.textContent = labelHistory.length === 0
            ? 'No existing labels yet'
            : 'No match';
          dd.appendChild(empty);
          activeIdx = -1;
          return;
        }
        items.forEach((l, i) => {
          const it = document.createElement('div');
          it.className = 'dd-item';
          it.textContent = l;
          if (i === activeIdx) it.classList.add('active');
          it.addEventListener('mousedown', (e) => {
            // mousedown so it fires before input blur
            e.preventDefault();
            input.value = l;
            closeDropdown();
            input.focus();
          });
          dd.appendChild(it);
        });
      }

      function openDropdown() {
        ddOpen = true;
        activeIdx = -1;
        dd.classList.add('open');
        renderDropdown();
      }

      function openDropdownAll() {
        ddFilterMode = false;
        openDropdown();
      }

      function closeDropdown() {
        ddOpen = false;
        dd.classList.remove('open');
      }

      function toggleDropdown(e) {
        if (e) e.preventDefault();
        if (ddOpen) {
          closeDropdown();
        } else {
          openDropdownAll();
        }
        input.focus();
      }

      setTimeout(() => { input.focus(); input.select(); }, 50);

      function onOk() {
        cleanup();
        resolve(input.value.trim());
      }

      function onCancel() {
        cleanup();
        resolve(null);
      }

      function onKeyDown(e) {
        if (ddOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
          e.preventDefault();
          const items = dd.querySelectorAll('.dd-item');
          if (items.length === 0) return;
          if (e.key === 'ArrowDown') activeIdx = (activeIdx + 1) % items.length;
          else activeIdx = (activeIdx - 1 + items.length) % items.length;
          items.forEach((it, i) => it.classList.toggle('active', i === activeIdx));
          items[activeIdx].scrollIntoView({ block: 'nearest' });
          return;
        }
        if (e.key === 'Enter') {
          if (ddOpen && activeIdx >= 0) {
            const items = dd.querySelectorAll('.dd-item');
            input.value = items[activeIdx].textContent;
            closeDropdown();
            return;
          }
          onOk();
          return;
        }
        if (e.key === 'Escape') {
          if (ddOpen) { closeDropdown(); return; }
          onCancel();
        }
      }

      function onInput() {
        ddFilterMode = true;
        if (!ddOpen) openDropdown(); else renderDropdown();
      }

      function onDocClick(e) {
        if (!dialog.contains(e.target)) return;
        if (e.target.closest('#dialog-label-dropdown-btn')) return;
        if (e.target.closest('#dialog-label-dropdown')) return;
        if (e.target === input) return;
        if (ddOpen) closeDropdown();
      }

      function cleanup() {
        dialog.style.display = 'none';
        closeDropdown();
        document.getElementById('dialog-ok').removeEventListener('click', onOk);
        document.getElementById('dialog-cancel').removeEventListener('click', onCancel);
        input.removeEventListener('keydown', onKeyDown);
        input.removeEventListener('input', onInput);
        ddBtn.removeEventListener('mousedown', toggleDropdown);
        document.removeEventListener('mousedown', onDocClick);
      }

      document.getElementById('dialog-ok').addEventListener('click', onOk);
      document.getElementById('dialog-cancel').addEventListener('click', onCancel);
      input.addEventListener('keydown', onKeyDown);
      input.addEventListener('input', onInput);
      ddBtn.addEventListener('mousedown', toggleDropdown);
      document.addEventListener('mousedown', onDocClick);
    });
  }

  function updateDialogSuggestions() {
    dialogLabelSuggestions.innerHTML = '';
    labelHistory.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l;
      dialogLabelSuggestions.appendChild(opt);
    });
  }

  // --- Label history ---

  function addToLabelHistory(label) {
    if (!labelHistory.includes(label)) {
      labelHistory.push(label);
      updateLabelSuggestions();
    }
  }

  function updateLabelSuggestions() {
    labelSuggestions.innerHTML = '';
    labelHistory.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l;
      labelSuggestions.appendChild(opt);
    });
  }

  // --- UI update functions ---

  function updateLabelsPanel() {
    labelsList.innerHTML = '';
    const shapes = lc.shapes;
    shapeCount.textContent = `(${shapes.length})`;
    const filterText = labelsFilter.value.trim().toLowerCase();

    shapes.forEach((shape, i) => {
      if (filterText && !shape.label.toLowerCase().includes(filterText)) return;

      const item = document.createElement('div');
      item.className = 'label-item' + (i === lc.selectedIndex ? ' selected' : '');

      const color = lc._labelColor(shape.label);
      const dot = document.createElement('span');
      dot.className = 'color-dot';
      dot.style.background = `rgb(${color.r},${color.g},${color.b})`;

      const text = document.createElement('span');
      text.className = 'label-text';
      text.textContent = shape.label;

      item.appendChild(dot);
      item.appendChild(text);

      if (shape.difficult) {
        const diff = document.createElement('span');
        diff.className = 'label-difficult';
        diff.textContent = 'D';
        item.appendChild(diff);
      }

      item.addEventListener('click', () => {
        lc.selectShape(i);
        updateLabelsPanel();
        labelInput.value = shape.label;
      });

      labelsList.appendChild(item);
    });
  }

  // --- Virtualized files list ---
  // Render only the rows currently visible in the scroll viewport.
  // Avoids creating thousands of DOM nodes for large directories.
  const FILE_ROW_HEIGHT = 24;       // keep in sync with CSS .file-item height
  const FILE_OVERSCAN = 8;          // extra rows above/below viewport
  let filesSpacer = null;
  let filteredIndices = [];         // indices into `files`, after filter
  let visibleRowNodes = new Map();  // file index -> DOM node currently rendered
  let filesScrollScheduled = false;

  function ensureFilesScaffold() {
    if (filesSpacer && filesSpacer.parentNode === filesList) return;
    filesList.innerHTML = '';
    filesSpacer = document.createElement('div');
    filesSpacer.className = 'files-spacer';
    filesList.appendChild(filesSpacer);
    filesList.addEventListener('scroll', onFilesScroll);
  }

  function onFilesScroll() {
    if (filesScrollScheduled) return;
    filesScrollScheduled = true;
    requestAnimationFrame(() => {
      filesScrollScheduled = false;
      renderVisibleFiles();
    });
  }

  function rebuildFilteredIndices() {
    const filterText = filesFilter.value.trim().toLowerCase();
    filteredIndices.length = 0;
    if (filterText) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].name.toLowerCase().includes(filterText)) {
          filteredIndices.push(i);
        }
      }
    } else {
      for (let i = 0; i < files.length; i++) filteredIndices.push(i);
    }
  }

  function renderVisibleFiles() {
    if (!filesSpacer) return;
    const total = filteredIndices.length;
    filesSpacer.style.height = (total * FILE_ROW_HEIGHT) + 'px';

    const scrollTop = filesList.scrollTop;
    const viewH = filesList.clientHeight;
    let startRow = Math.floor(scrollTop / FILE_ROW_HEIGHT) - FILE_OVERSCAN;
    let endRow = Math.ceil((scrollTop + viewH) / FILE_ROW_HEIGHT) + FILE_OVERSCAN;
    if (startRow < 0) startRow = 0;
    if (endRow > total) endRow = total;

    const wantedFileIdx = new Set();
    for (let row = startRow; row < endRow; row++) {
      wantedFileIdx.add(filteredIndices[row]);
    }

    // Remove rows that scrolled out of view.
    for (const [fileIdx, node] of visibleRowNodes) {
      if (!wantedFileIdx.has(fileIdx)) {
        node.remove();
        visibleRowNodes.delete(fileIdx);
      }
    }

    // Add rows that scrolled into view.
    const activeIdx = currentImageData ? currentImageData.index : -1;
    for (let row = startRow; row < endRow; row++) {
      const fileIdx = filteredIndices[row];
      if (visibleRowNodes.has(fileIdx)) {
        // Reposition (filter could have changed the row index)
        visibleRowNodes.get(fileIdx).style.top = (row * FILE_ROW_HEIGHT) + 'px';
        continue;
      }
      const file = files[fileIdx];
      const item = document.createElement('div');
      item.className = 'file-item';
      if (fileIdx === activeIdx) item.classList.add('active');
      item.dataset.idx = String(fileIdx);
      item.style.top = (row * FILE_ROW_HEIGHT) + 'px';
      item.textContent = file.name;
      item.addEventListener('click', () => loadImageByIndex(fileIdx));
      filesSpacer.appendChild(item);
      visibleRowNodes.set(fileIdx, item);
    }
  }

  function updateFilesList() {
    ensureFilesScaffold();
    fileCount.textContent = `(${files.length})`;
    rebuildFilteredIndices();
    // Drop any stale rendered rows; positions/filter may have changed.
    for (const node of visibleRowNodes.values()) node.remove();
    visibleRowNodes.clear();
    renderVisibleFiles();
  }

  function setActiveFile(index) {
    // Remove active from any currently rendered row.
    for (const [idx, node] of visibleRowNodes) {
      if (idx !== index) node.classList.remove('active');
    }
    const node = visibleRowNodes.get(index);
    if (node) node.classList.add('active');
    scrollFileIntoView(index);
  }

  function scrollFileIntoView(fileIdx) {
    if (!filesSpacer) return;
    const row = filteredIndices.indexOf(fileIdx);
    if (row < 0) return; // hidden by filter
    const top = row * FILE_ROW_HEIGHT;
    const bottom = top + FILE_ROW_HEIGHT;
    const viewTop = filesList.scrollTop;
    const viewBottom = viewTop + filesList.clientHeight;
    if (top < viewTop) {
      filesList.scrollTop = top;
    } else if (bottom > viewBottom) {
      filesList.scrollTop = bottom - filesList.clientHeight;
    }
    renderVisibleFiles();
    // After scroll, ensure new row gets the active class.
    const node = visibleRowNodes.get(fileIdx);
    if (node) node.classList.add('active');
  }

  function updateStatus() {
    if (currentImageData) {
      const d = currentImageData;
      statusFile.textContent = `${d.filename} [${d.index + 1}/${d.total}] (${d.width}x${d.height})`;
    } else {
      statusFile.textContent = 'No image loaded';
    }
  }

  // --- Backend calls ---

  async function openDirectory(presetDir) {
    try {
      const dir = presetDir || await window.go.main.App.SelectDirectory();
      if (!dir) return;
      files = await window.go.main.App.OpenDirectory(dir);
      if (files && files.length > 0) {
        updateFilesList();
        await loadImageByIndex(0);
      }

      // Load class list from backend
      const classList = await window.go.main.App.GetClassList();
      if (classList) {
        labelHistory = classList;
        updateLabelSuggestions();
      }
    } catch (e) {
      console.error('OpenDirectory error:', e);
    }
  }

  async function loadImageByIndex(index) {
    try {
      // Auto-save if dirty
      if (dirty && currentImageData) {
        await saveAnnotations();
      }

      const data = await window.go.main.App.LoadImage(index);
      if (!data) return;

      currentImageData = data;
      lc.loadImage(data.base64, data.width, data.height);

      if (data.shapes) {
        lc.setShapes(data.shapes);
        // Collect labels
        data.shapes.forEach(s => addToLabelHistory(s.label));
      } else {
        lc.setShapes([]);
      }

      dirty = false;
      resetUndoRedo();
      updateLabelsPanel();
      setActiveFile(currentImageData.index);
      updateStatus();
      updateSaveButton();
    } catch (e) {
      console.error('LoadImage error:', e);
    }
  }

  async function saveAnnotations() {
    if (!currentImageData) return;
    try {
      const shapes = lc.getShapesData();
      await window.go.main.App.SaveAnnotations({ shapes });
      dirty = false;
      updateSaveButton();
    } catch (e) {
      console.error('SaveAnnotations error:', e);
    }
  }

  async function nextImage() {
    if (dirty) await saveAnnotations();
    try {
      const data = await window.go.main.App.NextImage();
      if (!data) return;
      currentImageData = data;
      lc.loadImage(data.base64, data.width, data.height);
      if (data.shapes) {
        lc.setShapes(data.shapes);
        data.shapes.forEach(s => addToLabelHistory(s.label));
      } else {
        lc.setShapes([]);
      }
      dirty = false;
      resetUndoRedo();
      updateLabelsPanel();
      setActiveFile(currentImageData.index);
      updateStatus();
      updateSaveButton();
    } catch (e) {
      console.error('NextImage error:', e);
    }
  }

  async function prevImage() {
    if (dirty) await saveAnnotations();
    try {
      const data = await window.go.main.App.PrevImage();
      if (!data) return;
      currentImageData = data;
      lc.loadImage(data.base64, data.width, data.height);
      if (data.shapes) {
        lc.setShapes(data.shapes);
        data.shapes.forEach(s => addToLabelHistory(s.label));
      } else {
        lc.setShapes([]);
      }
      dirty = false;
      resetUndoRedo();
      updateLabelsPanel();
      setActiveFile(currentImageData.index);
      updateStatus();
      updateSaveButton();
    } catch (e) {
      console.error('PrevImage error:', e);
    }
  }

  // --- Load classes file ---

  async function loadClassFile() {
    try {
      const classList = await window.go.main.App.LoadClassFile();
      if (classList && classList.length > 0) {
        labelHistory = classList;
        updateLabelSuggestions();
      }
    } catch (e) {
      console.error('LoadClassFile error:', e);
    }
  }

  // --- Label input handler ---

  labelInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && lc.selectedIndex >= 0) {
      const newLabel = labelInput.value.trim();
      if (newLabel) {
        pushUndo();
        lc.shapes[lc.selectedIndex].label = newLabel;
        addToLabelHistory(newLabel);
        dirty = true;
        lc.render();
        updateLabelsPanel();
        updateSaveButton();
      }
    }
  });

  // --- Toolbar buttons ---

  document.getElementById('btn-open').addEventListener('click', () => openDirectory());
  document.getElementById('btn-save').addEventListener('click', saveAnnotations);
  document.getElementById('btn-load-classes').addEventListener('click', loadClassFile);
  document.getElementById('btn-prev').addEventListener('click', prevImage);
  document.getElementById('btn-next').addEventListener('click', nextImage);
  document.getElementById('btn-zoomin').addEventListener('click', () => lc.zoomIn());
  document.getElementById('btn-zoomout').addEventListener('click', () => lc.zoomOut());
  document.getElementById('btn-fit').addEventListener('click', () => lc.fitWindow());
  const btnPan = document.getElementById('btn-pan');
  function togglePanMode(force) {
    const enabled = typeof force === 'boolean' ? force : !lc.panMode;
    lc.setPanMode(enabled);
    btnPan.classList.toggle('active', enabled);
    btnPan.title = enabled
      ? 'Pan Mode: ON — drag image with left mouse (H)'
      : 'Pan Mode (H): drag image with left mouse';
  }
  btnPan.addEventListener('click', () => togglePanMode());
  const btnLockZoom = document.getElementById('btn-lock-zoom');
  btnLockZoom.addEventListener('click', () => {
    const locked = !lc.zoomLocked;
    lc.setZoomLocked(locked);
    btnLockZoom.classList.toggle('active', locked);
    btnLockZoom.title = locked
      ? '锁定缩放：已开启（切换图片时保持当前缩放）'
      : '锁定缩放比例：切换图片时保持当前缩放';
  });

  const btnCopyPath = document.getElementById('btn-copy-path');
  btnCopyPath.addEventListener('click', async () => {
    if (!currentImageData || !currentImageData.path) {
      console.warn('CopyPath: no image loaded');
      return;
    }
    const path = currentImageData.path;
    const label = btnCopyPath.querySelector('span');
    const originalText = label.textContent;

    let ok = false;
    // Prefer Wails runtime clipboard (most reliable in webview).
    try {
      if (window.runtime && typeof window.runtime.ClipboardSetText === 'function') {
        ok = await window.runtime.ClipboardSetText(path);
      }
    } catch (e) {
      console.error('ClipboardSetText error:', e);
    }
    // Fallback: navigator.clipboard
    if (!ok && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(path);
        ok = true;
      } catch (e) {
        console.error('navigator.clipboard error:', e);
      }
    }
    // Last resort: execCommand
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = path;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) {
        console.error('execCommand copy error:', e);
      }
    }

    btnCopyPath.classList.add('active');
    label.textContent = ok ? 'Copied!' : 'Copy failed';
    setTimeout(() => {
      btnCopyPath.classList.remove('active');
      label.textContent = originalText;
    }, 1200);
  });
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);

  // --- Format selector ---
  formatSelect.addEventListener('change', async () => {
    await window.go.main.App.SetSaveFormat(formatSelect.value);
  });

  document.getElementById('btn-create').addEventListener('click', () => {
    lc.mode = 'create';
    document.getElementById('btn-create').classList.add('active');
    document.getElementById('btn-delete').classList.remove('active');
    lc.canvas.style.cursor = 'crosshair';
  });

  document.getElementById('btn-delete').addEventListener('click', () => {
    if (lc.selectedIndex >= 0) {
      pushUndo();
          lc.deleteSelected();
          dirty = true;
          updateLabelsPanel();
          updateSaveButton();
        }
      });

  // --- Keyboard shortcuts ---

  document.addEventListener('keydown', (e) => {
    // Skip if modal is open or input is focused
    if (document.getElementById('label-dialog').style.display === 'flex') return;
    if (document.activeElement === labelInput) return;
    if (document.activeElement === labelsFilter) return;
    if (document.activeElement === filesFilter) return;
    if (document.activeElement === formatSelect) return;

    const ctrl = e.ctrlKey || e.metaKey;

    switch (e.key) {
      case 'w':
      case 'W':
        lc.mode = 'create';
        document.getElementById('btn-create').classList.add('active');
        lc.canvas.style.cursor = 'crosshair';
        break;
      case 'e':
      case 'E':
        lc.mode = 'edit';
        document.getElementById('btn-create').classList.remove('active');
        lc.canvas.style.cursor = 'default';
        break;
      case 'h':
      case 'H':
        if (!ctrl) togglePanMode();
        break;
      case 'd':
      case 'D':
        if (!ctrl) nextImage();
        break;
      case 'a':
      case 'A':
        if (!ctrl) prevImage();
        break;
      case 's':
        if (ctrl) {
          e.preventDefault();
          saveAnnotations();
        }
        break;
      case 'z':
      case 'Z':
        if (ctrl && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (ctrl && e.shiftKey) {
          e.preventDefault();
          redo();
        }
        break;
      case 'y':
      case 'Y':
        if (ctrl) {
          e.preventDefault();
          redo();
        }
        break;
      case 'Delete':
      case 'Backspace':
        if (lc.selectedIndex >= 0) {
          pushUndo();
          lc.deleteSelected();
          dirty = true;
          updateLabelsPanel();
          updateSaveButton();
        }
        break;
      case '+':
      case '=':
        lc.zoomIn();
        break;
      case '-':
        lc.zoomOut();
        break;
      case 'f':
      case 'F':
        lc.fitWindow();
        break;
    }
  });

  // --- Filter inputs ---
  labelsFilter.addEventListener('input', () => updateLabelsPanel());
  filesFilter.addEventListener('input', () => updateFilesList());

  // Initial save button state
  updateSaveButton();

  // --- Stats Panel ---
  const statsToggle = document.getElementById('stats-toggle');
  const statsContent = document.getElementById('stats-content');
  const statsArrow = document.getElementById('stats-arrow');
  const statsSummary = document.getElementById('stats-summary');
  const statsClasses = document.getElementById('stats-classes');
  let statsOpen = false;

  statsToggle.addEventListener('click', () => {
    statsOpen = !statsOpen;
    statsContent.style.display = statsOpen ? 'block' : 'none';
    statsArrow.classList.toggle('open', statsOpen);
    if (statsOpen) refreshStats();
  });

  async function refreshStats() {
    try {
      const stats = await window.go.main.App.GetStats();
      if (!stats) return;

      statsSummary.innerHTML =
        `<span class="stat-item">Images: <span class="stat-value">${stats.totalImages}</span></span>` +
        `<span class="stat-item">Annotated: <span class="stat-value">${stats.annotatedCount}</span></span>` +
        `<span class="stat-item">Boxes: <span class="stat-value">${stats.totalBoxes}</span></span>`;

      const counts = stats.classCounts || {};
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const maxCount = entries.length > 0 ? entries[0][1] : 1;

      statsClasses.innerHTML = entries.map(([label, count]) => {
        const pct = Math.round(count / maxCount * 100);
        const color = lc._labelColor(label);
        return `<div class="stats-class-item">
          <span class="stats-class-name"><span class="color-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:rgb(${color.r},${color.g},${color.b})"></span>${label}</span>
          <span class="stats-class-count">${count}</span>
        </div>
        <div class="stats-class-bar" style="width:${pct}%;background:rgb(${color.r},${color.g},${color.b})"></div>`;
      }).join('');
    } catch (e) {
      console.error('GetStats error:', e);
    }
  }

  // --- Auto-open directory passed via CLI args ---
  (async () => {
    try {
      const initialDir = await window.go.main.App.GetInitialDir();
      if (initialDir) {
        await openDirectory(initialDir);
      }
    } catch (e) {
      console.error('GetInitialDir error:', e);
    }
  })();

})();
