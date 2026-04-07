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
      dialog.style.display = 'flex';
      input.value = defaultLabel || '';
      updateDialogSuggestions();

      setTimeout(() => input.focus(), 50);

      function onOk() {
        cleanup();
        resolve(input.value.trim());
      }

      function onCancel() {
        cleanup();
        resolve(null);
      }

      function onKeyDown(e) {
        if (e.key === 'Enter') onOk();
        if (e.key === 'Escape') onCancel();
      }

      function cleanup() {
        dialog.style.display = 'none';
        document.getElementById('dialog-ok').removeEventListener('click', onOk);
        document.getElementById('dialog-cancel').removeEventListener('click', onCancel);
        input.removeEventListener('keydown', onKeyDown);
      }

      document.getElementById('dialog-ok').addEventListener('click', onOk);
      document.getElementById('dialog-cancel').addEventListener('click', onCancel);
      input.addEventListener('keydown', onKeyDown);
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

    shapes.forEach((shape, i) => {
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

  function updateFilesList() {
    filesList.innerHTML = '';
    fileCount.textContent = `(${files.length})`;

    files.forEach((file, i) => {
      const item = document.createElement('div');
      item.className = 'file-item';
      if (currentImageData && currentImageData.index === i) {
        item.classList.add('active');
      }
      item.textContent = file.name;
      item.addEventListener('click', () => loadImageByIndex(i));
      filesList.appendChild(item);
    });
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

  async function openDirectory() {
    try {
      const dir = await window.go.main.App.SelectDirectory();
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
      updateFilesList();
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
      updateFilesList();
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
      updateFilesList();
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

  document.getElementById('btn-open').addEventListener('click', openDirectory);
  document.getElementById('btn-save').addEventListener('click', saveAnnotations);
  document.getElementById('btn-load-classes').addEventListener('click', loadClassFile);
  document.getElementById('btn-prev').addEventListener('click', prevImage);
  document.getElementById('btn-next').addEventListener('click', nextImage);
  document.getElementById('btn-zoomin').addEventListener('click', () => lc.zoomIn());
  document.getElementById('btn-zoomout').addEventListener('click', () => lc.zoomOut());
  document.getElementById('btn-fit').addEventListener('click', () => lc.fitWindow());
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

})();
