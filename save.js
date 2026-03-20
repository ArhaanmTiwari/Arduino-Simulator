// Project Save/Load System
// Uses default Firebase app (same as index.html)

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAwb5U1WBStVmw84TgA0zdFISHux6MD0wg",
  authDomain: "ardsim.firebaseapp.com",
  projectId: "ardsim",
  storageBucket: "ardsim.firebasestorage.app",
  messagingSenderId: "842705186686",
  appId: "1:842705186686:web:e3aff325ea4bdd4c450d2f"
};

// Initialize default app (or reuse if already initialized)
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

const saveAuth = firebase.auth();
const saveDb = firebase.firestore();

let currentUser = null;
let currentProjectId = null;

// Wait for auth to be ready
saveAuth.onAuthStateChanged((user) => {
  currentUser = user;
  console.log('Auth state:', user ? user.email : 'not signed in');

  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('project');
  if (projectId && user) {
    currentProjectId = projectId;
    loadProject(projectId);
  }
});

window.saveProject = async function() {
  // Wait up to 3 seconds for auth
  if (!currentUser) {
    await new Promise(resolve => {
      let tries = 0;
      const check = setInterval(() => {
        tries++;
        if (saveAuth.currentUser || tries > 30) {
          clearInterval(check);
          currentUser = saveAuth.currentUser;
          resolve();
        }
      }, 100);
    });
  }

  if (!currentUser) {
    if (confirm('You are not signed in. Go to home page to sign in?')) {
      window.location.href = 'index.html';
    }
    return;
  }

  const code = document.getElementById('code-editor').value;

  let name = 'Untitled Project';
  if (currentProjectId) {
    try {
      const snap = await saveDb.collection('projects').doc(currentProjectId).get();
      if (snap.exists) name = snap.data().name || 'Untitled Project';
    } catch(e) {}
  } else {
    name = prompt('Project name:', 'My Arduino Project') || 'Untitled Project';
  }

  const componentData = droppedComponents.map(c => ({
    compId: c.compId,
    x: parseInt(c.el.style.left),
    y: parseInt(c.el.style.top),
    pinMap: c.pinMap
  }));

  // Save wires - handle all wire types
  const wireData = wires.map(w => {
    if (w.type === 'board-bb') {
      return {
        type: 'board-bb',
        fromPin: w.fromPin,
        toPin: w.toPin,
        color: w.color || '#58a6ff'
      };
    } else if (w.type === 'bb-bb') {
      return {
        type: 'bb-bb',
        fromPin: w.fromPin,
        toPin: w.toPin,
        color: w.color || '#58a6ff'
      };
    } else {
      return {
        type: 'comp-board',
        fromComp: w.fromComp || null,
        fromPin: w.fromPin || null,
        toPin: w.toPin || null,
        color: w.color || '#58a6ff'
      };
    }
  });

  const projectId = currentProjectId || `proj_${Date.now()}`;
  currentProjectId = projectId;

  try {
    await saveDb.collection('projects').doc(projectId).set({
      uid: currentUser.uid,
      name,
      code,
      components: componentData,
      wires: wireData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    serialLog(`Project "${name}" saved! ✅`, 'info');
    window.history.replaceState({}, '', `?project=${projectId}`);
  } catch(err) {
    serialLog('Save failed: ' + err.message, 'error');
    console.error(err);
  }
};

async function loadProject(projectId) {
  try {
    const snap = await saveDb.collection('projects').doc(projectId).get();
    if (!snap.exists) { serialLog('Project not found!', 'error'); return; }
    const data = snap.data();
    document.getElementById('code-editor').value = data.code || '';
    updateLineNumbers();
    clearCanvas();
    if (data.components) {
      data.components.forEach(c => {
        const comp = COMPONENTS.find(comp => comp.id === c.compId);
        if (comp) {
          dropComponent(comp, c.x, c.y);
          // Restore pin map
          const dropped = droppedComponents[droppedComponents.length - 1];
          if (dropped && c.pinMap) {
            dropped.pinMap = c.pinMap;
          }
        }
      });
    }

    // Restore wires after components are placed
    if (data.wires) {
      data.wires.forEach(w => {
        if (w.type === 'board-bb') {
          // Board pin → breadboard hole
          const fromEl = document.querySelector(`[data-pin-id="${w.fromPin}"]`);
          const toEl = document.querySelector(`[data-bb-id="${w.toPin}"]`);
          if (fromEl && toEl) {
            wires.push({ type: 'board-bb', fromPin: w.fromPin, fromEl, toPin: w.toPin, toEl, color: w.color });
            fromEl.classList.add('connected');
            toEl.classList.add('connected');
          }
        } else if (w.type === 'bb-bb') {
          // Breadboard hole → breadboard hole
          const fromEl = document.querySelector(`[data-bb-id="${w.fromPin}"]`);
          const toEl = document.querySelector(`[data-bb-id="${w.toPin}"]`);
          if (fromEl && toEl) {
            wires.push({ type: 'bb-bb', fromPin: w.fromPin, fromEl, toPin: w.toPin, toEl, color: w.color });
            fromEl.classList.add('connected');
            toEl.classList.add('connected');
          }
        } else {
          // Component pin → board/breadboard pin
          const comp = droppedComponents.find(c => c.id === w.fromComp);
          if (!comp) return;
          const compPinEl = comp.el.querySelector(`[data-pin-id="${w.fromPin}"]`);
          const boardPinEl = document.querySelector(`[data-pin-id="${w.toPin}"]`) ||
                             document.querySelector(`[data-bb-id="${w.toPin}"]`);
          if (compPinEl && boardPinEl) {
            wires.push({ fromComp: w.fromComp, fromPin: w.fromPin, toPin: w.toPin, color: w.color, compPinEl, boardPinEl });
            compPinEl.classList.add('connected');
            boardPinEl.classList.add('connected');
            comp.pinMap[w.fromPin] = w.toPin;
          }
        }
      });
      updateWires();
    }

    serialLog(`Project "${data.name}" loaded! ✅`, 'info');
  } catch(err) {
    serialLog('Load failed: ' + err.message, 'error');
  }
}

window.goHome = function() { window.location.href = 'index.html'; };
