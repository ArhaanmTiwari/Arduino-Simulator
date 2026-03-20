// Canvas state
let droppedComponents = [];
let wires = [];
let selectedPin = null;
let compCounter = 0;
let zoom = 1;

// Wire colors like real jumper wires
const WIRE_COLORS = ['#ff4444', '#4488ff', '#44cc44', '#ffcc00', '#ff44ff', '#44ffcc', '#ff8800', '#ffffff', '#cc44ff', '#44ffff'];
let wireColorIndex = 0;

// Breadboard connection logic
// Returns the "net" ID for a given hole
// Holes in same column (a-e or f-j) share a net
// Power rails share their entire row
function getBBNet(holeId) {
  // Power rails - entire row connected
  if (holeId.startsWith('tp-')) return 'power-pos-top';
  if (holeId.startsWith('tn-')) return 'power-neg-top';
  if (holeId.startsWith('bp-')) return 'power-pos-bot';
  if (holeId.startsWith('bn-')) return 'power-neg-bot';

  // Main holes: letter + number e.g. a5
  const match = holeId.match(/^([a-j])(\d+)$/);
  if (match) {
    const row = match[1];
    const col = match[2];
    // a-e are connected, f-j are connected, same column
    if (['a','b','c','d','e'].includes(row)) return `top-col-${col}`;
    if (['f','g','h','i','j'].includes(row)) return `bot-col-${col}`;
  }
  return holeId; // fallback
}

// Get the board pin ID that a breadboard net is connected to
function getBBNetBoardPin(net) {
  // Check all wires for board-bb connections
  for (const wire of wires) {
    if (wire.type === 'board-bb') {
      if (getBBNet(wire.toPin) === net) return wire.fromPin;
      if (getBBNet(wire.fromPin) === net) return wire.toPin;
    }
    if (wire.type === 'bb-bb') {
      // Could chain - for now just direct
    }
  }
  // Power rail connections
  if (net === 'power-pos-top' || net === 'power-pos-bot') return '5V';
  if (net === 'power-neg-top' || net === 'power-neg-bot') return 'GND';
  return null;
}

// Resolve a component's pinMap through breadboard nets
function resolvePin(pinValue) {
  if (pinValue === null) return null;
  // If it's a breadboard hole, resolve through net
  const net = getBBNet(String(pinValue));
  if (net !== pinValue) {
    // It's a breadboard hole, find what board pin it connects to
    const boardPin = getBBNetBoardPin(net);
    if (boardPin !== null) return boardPin;
  }
  return pinValue;
}

function initBoard() {
  const digitalPins = document.getElementById('digital-pins');
  const analogPins = document.getElementById('analog-pins');
  const powerPins = document.getElementById('power-pins');

  // Digital pins 0-13
  for (let i = 0; i <= 13; i++) {
    const pin = createBoardPin(`D${i}`, 'digital', i);
    digitalPins.appendChild(pin);
  }

  // Analog pins A0-A5
  for (let i = 0; i <= 5; i++) {
    const pin = createBoardPin(`A${i}`, 'analog', `A${i}`);
    analogPins.appendChild(pin);
  }

  // Power pins
  const powerConfig = [
    { label: '5V', id: '5V', cls: 'vcc' },
    { label: '3V3', id: '3V3', cls: 'v33' },
    { label: 'GND', id: 'GND', cls: 'gnd' },
    { label: 'GND', id: 'GND2', cls: 'gnd' },
    { label: 'VIN', id: 'VIN', cls: 'vcc' },
  ];
  powerConfig.forEach(p => {
    const pin = createBoardPin(p.label, `power ${p.cls}`, p.id);
    powerPins.appendChild(pin);
  });

  // Init breadboard
  initBreadboard();
}

function createBoardPin(label, type, pinId) {
  const pin = document.createElement('div');
  pin.className = `board-pin ${type}`;
  pin.dataset.pinId = String(pinId);
  pin.title = `Pin ${label} — Click to wire`;
  pin.style.cssText = `width:12px; height:12px; border-radius:50%; cursor:pointer; border:1.5px solid; position:relative; transition: all 0.15s; display:inline-block;`;

  // Color by type
  if (type.includes('digital')) {
    pin.style.background = 'radial-gradient(circle at 35% 35%, #1a3a5c, #0a1a2e)';
    pin.style.borderColor = '#1f6feb';
  } else if (type.includes('analog')) {
    pin.style.background = 'radial-gradient(circle at 35% 35%, #1a3a1a, #0a1a0a)';
    pin.style.borderColor = '#238636';
  } else if (type.includes('vcc')) {
    pin.style.background = 'radial-gradient(circle at 35% 35%, #5c1a1a, #2e0a0a)';
    pin.style.borderColor = '#cc0000';
  } else if (type.includes('gnd')) {
    pin.style.background = 'radial-gradient(circle at 35% 35%, #1a1a1a, #0a0a0a)';
    pin.style.borderColor = '#555';
  } else if (type.includes('v33')) {
    pin.style.background = 'radial-gradient(circle at 35% 35%, #3a2a1a, #1e150a)';
    pin.style.borderColor = '#cc7700';
  }

  pin.addEventListener('mouseenter', () => {
    pin.style.transform = 'scale(1.5)';
    pin.style.zIndex = '50';
    pin.style.boxShadow = '0 0 8px currentColor';
  });
  pin.addEventListener('mouseleave', () => {
    if (!pin.classList.contains('connected') && !pin.classList.contains('selecting')) {
      pin.style.transform = '';
      pin.style.zIndex = '';
      pin.style.boxShadow = '';
    }
  });
  pin.addEventListener('click', () => onBoardPinClick(pin, String(pinId)));
  return pin;
}

function initBreadboard() {
  const board = document.getElementById('canvas-board');
  const bb = document.createElement('div');
  bb.className = 'breadboard';
  bb.id = 'breadboard';
  bb.style.left = '420px';
  bb.style.top = '30px';

  let html = '<div class="breadboard-label">BREADBOARD</div>';

  // Column numbers
  html += '<div class="breadboard-numbers">';
  for (let i = 1; i <= 30; i++) html += `<span class="bb-num">${i}</span>`;
  html += '</div>';

  // Power rails top
  html += '<div class="bb-power-row" id="bb-power-top-pos">';
  for (let i = 1; i <= 30; i++) {
    html += `<div class="bb-hole power-pos" data-bb-id="tp-${i}" data-bb-rail="power-pos" title="+${i}" onclick="onBBHoleClick(this, 'tp-${i}')"></div>`;
  }
  html += '</div>';
  html += '<div class="bb-power-row" id="bb-power-top-neg">';
  for (let i = 1; i <= 30; i++) {
    html += `<div class="bb-hole power-neg" data-bb-id="tn-${i}" data-bb-rail="power-neg" title="-${i}" onclick="onBBHoleClick(this, 'tn-${i}')"></div>`;
  }
  html += '</div>';

  html += '<div class="bb-gap"></div>';

  // Main holes a-e
  const rowsTop = ['a', 'b', 'c', 'd', 'e'];
  rowsTop.forEach(row => {
    html += `<div class="breadboard-row">`;
    html += `<span class="breadboard-row-label">${row.toUpperCase()}</span>`;
    for (let col = 1; col <= 30; col++) {
      const id = `${row}${col}`;
      html += `<div class="bb-hole" data-bb-id="${id}" title="${row.toUpperCase()}${col}" onclick="onBBHoleClick(this, '${id}')"></div>`;
    }
    html += `</div>`;
  });

  html += '<div class="bb-divider"></div>';

  // Main holes f-j
  const rowsBot = ['f', 'g', 'h', 'i', 'j'];
  rowsBot.forEach(row => {
    html += `<div class="breadboard-row">`;
    html += `<span class="breadboard-row-label">${row.toUpperCase()}</span>`;
    for (let col = 1; col <= 30; col++) {
      const id = `${row}${col}`;
      html += `<div class="bb-hole" data-bb-id="${id}" title="${row.toUpperCase()}${col}" onclick="onBBHoleClick(this, '${id}')"></div>`;
    }
    html += `</div>`;
  });

  html += '<div class="bb-gap"></div>';

  // Power rails bottom
  html += '<div class="bb-power-row">';
  for (let i = 1; i <= 30; i++) {
    html += `<div class="bb-hole power-pos" data-bb-id="bp-${i}" data-bb-rail="power-pos" title="+${i}" onclick="onBBHoleClick(this, 'bp-${i}')"></div>`;
  }
  html += '</div>';
  html += '<div class="bb-power-row">';
  for (let i = 1; i <= 30; i++) {
    html += `<div class="bb-hole power-neg" data-bb-id="bn-${i}" data-bb-rail="power-neg" title="-${i}" onclick="onBBHoleClick(this, 'bn-${i}')"></div>`;
  }
  html += '</div>';

  bb.innerHTML = html;
  makeDraggable(bb);
  board.appendChild(bb);
}

// Drag and drop components onto canvas
const canvasBoard = document.getElementById('canvas-board');
canvasBoard.addEventListener('dragover', (e) => e.preventDefault());
canvasBoard.addEventListener('drop', (e) => {
  e.preventDefault();
  const compId = e.dataTransfer.getData('compId');
  if (!compId) return;
  const comp = COMPONENTS.find(c => c.id === compId);
  if (!comp) return;
  const rect = canvasBoard.getBoundingClientRect();
  const x = (e.clientX - rect.left) / zoom;
  const y = (e.clientY - rect.top) / zoom;
  dropComponent(comp, x, y);
});

function dropComponent(comp, x, y) {
  const id = `comp_${++compCounter}`;
  const el = document.createElement('div');
  el.className = 'dropped-component';
  el.id = id;
  el.style.left = x + 'px';
  el.style.top = y + 'px';

  const pinMap = {};
  comp.pins.forEach(p => pinMap[p.id] = null);

  const pinsHTML = comp.pins.map(p =>
    `<div class="comp-pin ${p.type}" data-pin-id="${p.id}" data-comp-id="${id}" title="${p.label}">${p.label}</div>`
  ).join('');

  el.innerHTML = `
    <button class="delete-btn" onclick="deleteComponent('${id}')">×</button>
    <div class="comp-icon">${comp.icon}</div>
    <div class="comp-name">${comp.name}</div>
    ${comp.extraHTML || ''}
    <div class="comp-pins">${pinsHTML}</div>
  `;

  makeDraggable(el);

  el.querySelectorAll('.comp-pin').forEach(pin => {
    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      onComponentPinClick(pin, id, pin.dataset.pinId);
    });
  });

  canvasBoard.appendChild(el);
  droppedComponents.push({ id, compId: comp.id, el, pinMap, comp });
}

function makeDraggable(el) {
  let startX, startY, startLeft, startTop;
  el.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('comp-pin') ||
        e.target.classList.contains('delete-btn') ||
        e.target.classList.contains('bb-hole') ||
        e.target.classList.contains('board-pin')) return;
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseInt(el.style.left) || 0;
    startTop = parseInt(el.style.top) || 0;

    function onMove(e) {
      el.style.left = (startLeft + (e.clientX - startX) / zoom) + 'px';
      el.style.top = (startTop + (e.clientY - startY) / zoom) + 'px';
      updateWires();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function deleteComponent(id) {
  const idx = droppedComponents.findIndex(c => c.id === id);
  if (idx !== -1) { droppedComponents[idx].el.remove(); droppedComponents.splice(idx, 1); }
  wires = wires.filter(w => w.fromComp !== id);
  updateWires();
}

// Wiring
function onComponentPinClick(pin, compId, pinId) {
  if (selectedPin) {
    if (selectedPin.type === 'board' || selectedPin.type === 'breadboard') {
      createWire(compId, pinId, selectedPin.pinId, pin, selectedPin.el);
    } else {
      serialLog('Select a board or breadboard pin!', 'info');
    }
    clearSelection();
  } else {
    selectedPin = { type: 'component', compId, pinId, el: pin };
    pin.classList.add('selecting');
    setStatus('Click a board pin to connect...', '');
  }
}

function onBoardPinClick(pin, pinId) {
  if (selectedPin) {
    if (selectedPin.type === 'component') {
      createWire(selectedPin.compId, selectedPin.pinId, pinId, selectedPin.el, pin);
      clearSelection();
    } else if (selectedPin.type === 'breadboard') {
      // Breadboard hole → board pin
      createBoardToBBWire(pinId, pin, selectedPin.pinId, selectedPin.el);
      clearSelection();
    }
  } else {
    selectedPin = { type: 'board', pinId, el: pin };
    pin.classList.add('selecting');
    setStatus('Click a component pin or breadboard hole...', '');
  }
}

function onBBHoleClick(hole, holeId) {
  if (selectedPin) {
    if (selectedPin.type === 'component') {
      // Component pin → breadboard hole
      createWire(selectedPin.compId, selectedPin.pinId, holeId, selectedPin.el, hole);
      clearSelection();
    } else if (selectedPin.type === 'board') {
      // Board pin → breadboard hole (wire between board and breadboard)
      createBoardToBBWire(selectedPin.pinId, selectedPin.el, holeId, hole);
      clearSelection();
    } else if (selectedPin.type === 'breadboard') {
      // Breadboard hole → breadboard hole
      createBBToBBWire(selectedPin.pinId, selectedPin.el, holeId, hole);
      clearSelection();
    }
  } else {
    selectedPin = { type: 'breadboard', pinId: holeId, el: hole };
    hole.classList.add('selecting');
    setStatus('Click another pin or hole to connect...', '');
  }
}

function createWire(compId, compPinId, boardPinId, compPinEl, boardPinEl) {
  const comp = droppedComponents.find(c => c.id === compId);
  if (comp) comp.pinMap[compPinId] = boardPinId;

  const color = WIRE_COLORS[wireColorIndex % WIRE_COLORS.length];
  wireColorIndex++;

  wires.push({ fromComp: compId, fromPin: compPinId, toPin: boardPinId, compPinEl, boardPinEl, color });
  compPinEl.classList.add('connected');
  if (boardPinEl) boardPinEl.classList.add('connected');

  updateWires();
  serialLog(`Wired: ${compPinId} → Pin ${boardPinId}`, 'info');
}

function createBoardToBBWire(boardPinId, boardPinEl, bbHoleId, bbHoleEl) {
  const color = WIRE_COLORS[wireColorIndex % WIRE_COLORS.length];
  wireColorIndex++;
  wires.push({ type: 'board-bb', fromPin: boardPinId, fromEl: boardPinEl, toPin: bbHoleId, toEl: bbHoleEl, color });
  boardPinEl.classList.add('connected');
  bbHoleEl.classList.add('connected');
  updateWires();
  serialLog(`Wired: Board ${boardPinId} → BB ${bbHoleId}`, 'info');
}

function createBBToBBWire(fromId, fromEl, toId, toEl) {
  const color = WIRE_COLORS[wireColorIndex % WIRE_COLORS.length];
  wireColorIndex++;
  wires.push({ type: 'bb-bb', fromPin: fromId, fromEl, toPin: toId, toEl, color });
  fromEl.classList.add('connected');
  toEl.classList.add('connected');
  updateWires();
  serialLog(`Wired: BB ${fromId} → BB ${toId}`, 'info');
}

function updateWires() {
  const svg = document.getElementById('wire-layer');
  svg.innerHTML = '';

  // Remove old wire delete buttons
  document.querySelectorAll('.wire-delete-btn').forEach(b => b.remove());

  const svgRect = svg.getBoundingClientRect();

  wires.forEach((wire, i) => {
    let el1, el2;

    if (wire.type === 'board-bb' || wire.type === 'bb-bb') {
      el1 = wire.fromEl;
      el2 = wire.toEl;
    } else {
      el1 = wire.compPinEl;
      el2 = wire.boardPinEl || document.querySelector(`[data-pin-id="${wire.toPin}"]`) || document.querySelector(`[data-bb-id="${wire.toPin}"]`);
    }

    if (!el1 || !el2) return;

    const r1 = el1.getBoundingClientRect();
    const r2 = el2.getBoundingClientRect();

    const x1 = r1.left + r1.width / 2 - svgRect.left;
    const y1 = r1.top + r1.height / 2 - svgRect.top;
    const x2 = r2.left + r2.width / 2 - svgRect.left;
    const y2 = r2.top + r2.height / 2 - svgRect.top;

    const cx1 = x1;
    const cy1 = Math.min(y1, y2) - 30;
    const cx2 = x2;
    const cy2 = Math.min(y1, y2) - 30;

    // Wider invisible hit area path
    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`);
    hitPath.setAttribute('stroke', 'transparent');
    hitPath.setAttribute('stroke-width', '12');
    hitPath.setAttribute('fill', 'none');
    hitPath.style.cursor = 'pointer';
    hitPath.addEventListener('click', (e) => { e.stopPropagation(); deleteWire(i); });
    hitPath.addEventListener('contextmenu', (e) => { e.preventDefault(); deleteWire(i); });
    svg.appendChild(hitPath);

    // Visible wire
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`);
    path.setAttribute('class', 'wire-path');
    path.setAttribute('stroke', wire.color || '#58a6ff');
    path.style.pointerEvents = 'none';
    svg.appendChild(path);

    // Endpoints
    [{ x: x1, y: y1 }, { x: x2, y: y2 }].forEach(pt => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pt.x);
      circle.setAttribute('cy', pt.y);
      circle.setAttribute('r', 4);
      circle.setAttribute('fill', wire.color || '#58a6ff');
      circle.style.pointerEvents = 'none';
      svg.appendChild(circle);
    });

    // Delete button at midpoint
    const midX = (x1 + x2) / 2;
    const midY = Math.min(y1, y2) - 30;
    const btn = document.createElement('div');
    btn.className = 'wire-delete-btn';
    btn.textContent = '×';
    btn.style.cssText = `position:absolute; left:${midX + svgRect.left - canvasBoard.getBoundingClientRect().left - 10}px; top:${midY + svgRect.top - canvasBoard.getBoundingClientRect().top - 10}px; width:18px; height:18px; background:#f85149; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; cursor:pointer; z-index:50; font-weight:700; border:none;`;
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteWire(i); });
    canvasBoard.appendChild(btn);
  });
}

function deleteWire(index) {
  if (index < 0 || index >= wires.length) return;
  const wire = wires[index];

  // Unmark connected pins
  if (wire.compPinEl) wire.compPinEl.classList.remove('connected');
  if (wire.boardPinEl) wire.boardPinEl.classList.remove('connected');
  if (wire.fromEl) wire.fromEl.classList.remove('connected');
  if (wire.toEl) wire.toEl.classList.remove('connected');

  // Update component pin map
  if (wire.fromComp) {
    const comp = droppedComponents.find(c => c.id === wire.fromComp);
    if (comp) comp.pinMap[wire.fromPin] = null;
  }

  wires.splice(index, 1);
  updateWires();
  setStatus('Wire deleted', '');
  serialLog('Wire removed', 'info');
}

// Delete key to remove highlighted wire
document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const highlighted = document.querySelector('.wire-path[stroke-width="5"]');
    if (highlighted) {
      // Find which wire this is
      const paths = document.querySelectorAll('.wire-path');
      paths.forEach((p, i) => {
        if (p === highlighted) deleteWire(i);
      });
    }
  }
  if (e.key === 'Escape') clearSelection();
});

function clearCanvas() {
  droppedComponents.forEach(c => c.el.remove());
  droppedComponents = [];
  wires = [];
  wireColorIndex = 0;
  updateWires();
  document.querySelectorAll('.board-pin, .bb-hole').forEach(p => p.classList.remove('connected'));
  serialLog('Canvas cleared', 'info');
}

function clearSelection() {
  if (selectedPin) { selectedPin.el.classList.remove('selecting'); selectedPin = null; }
  setStatus('Ready', '');
}

function zoomIn() { zoom = Math.min(zoom + 0.15, 2.5); applyZoom(); }
function zoomOut() { zoom = Math.max(zoom - 0.15, 0.4); applyZoom(); }
function resetZoom() { zoom = 1; applyZoom(); }
function applyZoom() { canvasBoard.style.transform = `scale(${zoom})`; canvasBoard.style.transformOrigin = 'top left'; }

function toggleHelp() {
  const modal = document.getElementById('help-modal');
  modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
}

function setStatus(text, type) {
  const chip = document.getElementById('status-chip');
  chip.textContent = '⬤ ' + text;
  chip.className = 'status-chip' + (type ? ' ' + type : '');
}

function serialLog(msg, type) {
  const out = document.getElementById('serial-output');
  const line = document.createElement('div');
  line.className = 'serial-line' + (type ? ' ' + type : '');
  const time = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  line.textContent = type === 'info' ? msg : `[${time}] ${msg}`;
  out.appendChild(line);
  out.scrollTop = out.scrollHeight;
}

function clearSerial() { document.getElementById('serial-output').innerHTML = ''; }

initBoard();

// Register with proxy system
window._canvas = {
  clear: clearCanvas,
  zoomIn: zoomIn,
  zoomOut: zoomOut,
  resetZoom: resetZoom,
  onBBHole: onBBHoleClick,
  deleteComp: deleteComponent
};
window.clearCanvas = clearCanvas;
window.toggleHelp = toggleHelp;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetZoom = resetZoom;
window.clearSerial = clearSerial;
window.onBBHoleClick = onBBHoleClick;
window.deleteComponent = deleteComponent;
window.deleteWire = deleteWire;
