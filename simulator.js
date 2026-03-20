// Arduino Simulator Engine - Clean Rewrite
let simInterval = null;
let simState = {
  pins: {},
  analogPins: {},
  variables: {},
  functions: {},
  millis: 0,
  running: false
};

const servoObjects = {};
const lcdObjects = {};
let setupCode = '';
let loopCode = '';
let loopStatements = [];
let loopIndex = 0;
let waitUntil = 0;

function runSimulation() {
  const code = document.getElementById('code-editor').value;
  stopSimulation();
  clearSerial();
  serialLog('Compiling...', 'info');

  try {
    parseCode(code);
    setStatus('Running', 'running');
    document.getElementById('btn-run').disabled = true;
    document.getElementById('btn-stop').disabled = false;

    simState.running = true;
    simState.millis = 0;
    simState.pins = { '5V':1,'3V3':1,'VIN':1,'GND':0,'5v':1,'3v3':1,'gnd':0 };
    simState.analogPins = {};
    simState.variables = {};
    waitUntil = 0;

    // Run setup once
    if (setupCode) executeBlock(setupCode, {});
    serialLog('Ready!', 'info');

    // Prepare loop statements
    loopStatements = loopCode ? tokenize(loopCode).filter(s => s.trim()) : [];
    loopIndex = 0;

    // Run loop repeatedly
    simInterval = setInterval(() => {
      try {
        simState.millis += 100;
        // Update inputs BEFORE running loop
        updateInputComponents();
        // Wait for delay
        if (simState.millis < waitUntil) { updateComponents(); return; }
        // Run loop statements one by one
        if (loopStatements.length > 0) runLoop();
        updateComponents();
      } catch(err) {
        serialLog('Error: ' + err.message, 'error');
        stopSimulation();
      }
    }, 100);

  } catch(err) {
    serialLog('Compile error: ' + err.message, 'error');
    setStatus('Error', 'error');
  }
}

function runLoop() {
  // Execute statements from loopIndex, pause on delay
  while (loopIndex < loopStatements.length) {
    const s = loopStatements[loopIndex].trim();
    loopIndex++;
    if (!s) continue;
    const dm = s.match(/^delay\s*\(\s*(.+?)\s*\);$/);
    if (dm) {
      waitUntil = simState.millis + parseInt(evalExpr(dm[1], simState.variables));
      return; // pause here, resume from loopIndex next tick
    }
    executeStatement(s, simState.variables);
  }
  // Loop finished - restart
  loopIndex = 0;
}

function stopSimulation() {
  if (simInterval) { clearInterval(simInterval); simInterval = null; }
  simState.running = false;
  simState.pins = {};
  simState.variables = {};
  simState.millis = 0;
  waitUntil = 0;
  loopIndex = 0;
  Object.keys(servoObjects).forEach(k => delete servoObjects[k]);
  document.getElementById('btn-run').disabled = false;
  document.getElementById('btn-stop').disabled = true;
  setStatus('Ready', '');
  updateComponents();
  if (typeof stopBuzzer === 'function') { stopBuzzer('active'); stopBuzzer('passive'); }
  serialLog('Stopped.', 'info');
}

function parseCode(code) {
  setupCode = '';
  loopCode = '';
  simState.functions = {};
  Object.keys(servoObjects).forEach(k => delete servoObjects[k]);
  Object.keys(lcdObjects).forEach(k => delete lcdObjects[k]);

  // Remove comments
  code = code.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  // Find global Servo/LCD declarations
  code.split('\n').forEach(line => {
    line = line.trim();
    const sd = line.match(/^Servo\s+(\w+)\s*;$/);
    if (sd) { servoObjects[sd[1]] = { pin: null, angle: 0 }; window.servoObjects = servoObjects; }
    const ld = line.match(/^LiquidCrystal_I2C\s+(\w+)\s*\(/);
    if (ld) { lcdObjects[ld[1]] = { line1:'', line2:'', col:0, row:0 }; }
  });

  // Extract functions
  const funcRegex = /\w[\w\s*]*?\s+(\w+)\s*\([^)]*\)\s*\{/g;
  let match;
  const positions = [];
  while ((match = funcRegex.exec(code)) !== null) {
    positions.push({ name: match[1], braceStart: match.index + match[0].length - 1 });
  }
  positions.forEach(f => {
    const body = extractBlock(code, f.braceStart);
    if (f.name === 'setup') setupCode = body;
    else if (f.name === 'loop') loopCode = body;
    else {
      const fm = code.substring(f.braceStart - 100).match(/\(([^)]*)\)/);
      simState.functions[f.name] = { params: fm ? fm[1] : '', body };
    }
  });
}

function extractBlock(code, start) {
  let depth = 0, i = start, body = '', started = false;
  while (i < code.length) {
    if (code[i] === '{') { depth++; if (!started) { started = true; i++; continue; } }
    if (code[i] === '}') { depth--; if (depth === 0) break; }
    if (started) body += code[i];
    i++;
  }
  return body;
}

function tokenize(code) {
  const stmts = [];
  let cur = '', depth = 0;
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '{') depth++;
    if (code[i] === '}') depth--;
    cur += code[i];
    if ((code[i] === ';' || (code[i] === '}' && depth === 0)) && depth === 0) {
      if (cur.trim()) stmts.push(cur.trim());
      cur = '';
    }
  }
  if (cur.trim()) stmts.push(cur.trim());
  return stmts;
}

function executeBlock(code, localVars) {
  code = code.replace(/\/\/[^\n]*/g, '');
  tokenize(code).forEach(s => { if (s.trim()) executeStatement(s.trim(), localVars); });
}

function executeStatement(stmt, localVars) {
  if (!stmt) return;
  const vars = Object.assign({}, simState.variables, localVars);

  // #include - ignore
  if (stmt.startsWith('#')) return;

  // Servo declaration
  const sd = stmt.match(/^Servo\s+(\w+);$/);
  if (sd) { servoObjects[sd[1]] = { pin:null, angle:0 }; window.servoObjects = servoObjects; return; }

  // Servo.attach
  const sa = stmt.match(/^(\w+)\.attach\s*\(\s*(.+?)\s*\);$/);
  if (sa && servoObjects[sa[1]] !== undefined) { servoObjects[sa[1]].pin = evalExpr(sa[2], vars); return; }

  // Servo.write
  const sw = stmt.match(/^(\w+)\.write\s*\(\s*(.+?)\s*\);$/);
  if (sw && servoObjects[sw[1]] !== undefined) {
    const angle = Math.max(0, Math.min(180, evalExpr(sw[2], vars)));
    servoObjects[sw[1]].angle = angle;
    window.servoObjects = servoObjects;
    if (servoObjects[sw[1]].pin !== null) {
      const pwm = Math.round((angle/180)*255);
      simState.analogPins[servoObjects[sw[1]].pin] = pwm;
    }
    return;
  }

  // LCD methods
  const lcdClear = stmt.match(/^(\w+)\.(begin|init|backlight|clear)\s*\([^)]*\);$/);
  if (lcdClear && lcdObjects[lcdClear[1]]) { if (lcdClear[2]==='clear') { lcdObjects[lcdClear[1]].line1=''; lcdObjects[lcdClear[1]].line2=''; } updateLCDDisplay(lcdClear[1]); return; }

  const lcdCursor = stmt.match(/^(\w+)\.setCursor\s*\(\s*(.+?)\s*,\s*(.+?)\s*\);$/);
  if (lcdCursor && lcdObjects[lcdCursor[1]]) { lcdObjects[lcdCursor[1]].col = evalExpr(lcdCursor[2],vars); lcdObjects[lcdCursor[1]].row = evalExpr(lcdCursor[3],vars); return; }

  const lcdPrint = stmt.match(/^(\w+)\.print\s*\(\s*(.+?)\s*\);$/);
  if (lcdPrint && lcdObjects[lcdPrint[1]]) {
    const lcd = lcdObjects[lcdPrint[1]];
    const text = String(evalExpr(lcdPrint[2], vars));
    if (lcd.row === 0) lcd.line1 = text.substring(0,16); else lcd.line2 = text.substring(0,16);
    updateLCDDisplay(lcdPrint[1]); return;
  }

  // tone / noTone
  const toneM = stmt.match(/^tone\s*\(\s*(.+?)\s*,\s*(.+?)(?:\s*,\s*(.+?))?\s*\);$/);
  if (toneM) { const freq = evalExpr(toneM[2],vars); if (typeof startBuzzer==='function') startBuzzer('passive', freq); return; }
  if (stmt.match(/^noTone\s*\(/)) { if (typeof stopBuzzer==='function') stopBuzzer('passive'); return; }

  // pinMode
  if (stmt.match(/^pinMode\s*\(/)) return;

  // Serial.begin
  if (stmt.match(/^Serial\.begin\s*\(/)) return;

  // Serial.println
  const pln = stmt.match(/^Serial\.println\s*\(\s*(.*?)\s*\);$/);
  if (pln) { serialLog(String(evalExpr(pln[1], vars))); return; }

  // Serial.print
  const pr = stmt.match(/^Serial\.print\s*\(\s*(.*?)\s*\);$/);
  if (pr) { serialLog(String(evalExpr(pr[1], vars))); return; }

  // delay
  const dm = stmt.match(/^delay\s*\(\s*(.+?)\s*\);$/);
  if (dm) { simState.millis += parseInt(evalExpr(dm[1],vars)); return; }

  // digitalWrite
  const dw = stmt.match(/^digitalWrite\s*\(\s*(.+?)\s*,\s*(.+?)\s*\);$/);
  if (dw) {
    const pin = evalExpr(dw[1], vars);
    const val = evalExpr(dw[2], vars);
    const high = (val===1||val===true||String(val).toUpperCase()==='HIGH');
    simState.pins[pin] = high?1:0;
    simState.pins[String(pin)] = high?1:0;
    return;
  }

  // analogWrite
  const aw = stmt.match(/^analogWrite\s*\(\s*(.+?)\s*,\s*(.+?)\s*\);$/);
  if (aw) {
    const pin = evalExpr(aw[1],vars);
    const val = Math.max(0,Math.min(255,evalExpr(aw[2],vars)));
    simState.analogPins[pin] = val;
    simState.pins[pin] = val>0?1:0;
    return;
  }

  // Variable declaration
  const vd = stmt.match(/^(?:int|float|long|bool|byte|char|double|unsigned\s+int|unsigned\s+long|String)\s+(\w+)\s*(?:=\s*(.+?))?;$/);
  if (vd) {
    const val = vd[2]!==undefined ? evalExpr(vd[2],vars) : 0;
    localVars[vd[1]] = val;
    simState.variables[vd[1]] = val;
    return;
  }

  // Assignment
  const asgn = stmt.match(/^(\w+)\s*(=|\+=|-=|\*=|\/=)\s*(.+?);$/);
  if (asgn && !['if','for','while','void','int','bool','float','long','byte','char','double'].includes(asgn[1])) {
    let cur = simState.variables[asgn[1]]!==undefined ? simState.variables[asgn[1]] : (localVars[asgn[1]]||0);
    const val = evalExpr(asgn[3],vars);
    if (asgn[2]==='=') cur=val;
    else if (asgn[2]==='+=') cur+=val;
    else if (asgn[2]==='-=') cur-=val;
    else if (asgn[2]==='*=') cur*=val;
    else if (asgn[2]==='/=') cur/=val;
    localVars[asgn[1]] = cur;
    simState.variables[asgn[1]] = cur;
    return;
  }

  // i++ / i--
  const inc = stmt.match(/^(\w+)(\+\+|--);$/);
  if (inc) { simState.variables[inc[1]] = (simState.variables[inc[1]]||0)+(inc[2]==='++' ? 1:-1); return; }

  // if/else
  if (stmt.startsWith('if')) {
    const m = stmt.match(/^if\s*\((.+?)\)\s*\{([\s\S]*?)\}(?:\s*else\s*(?:if\s*\(.+?\)\s*)?\{([\s\S]*?)\})?/);
    if (m) { if (evalCondition(m[1],vars)) executeBlock(m[2],localVars); else if (m[3]) executeBlock(m[3],localVars); }
    return;
  }

  // for loop
  if (stmt.startsWith('for')) {
    const m = stmt.match(/^for\s*\(\s*(.+?);\s*(.+?);\s*(.+?)\s*\)\s*\{([\s\S]*?)\}/);
    if (m) {
      executeStatement(m[1].trim()+';', localVars);
      let limit=0;
      while(evalCondition(m[2],Object.assign({},simState.variables,localVars))&&limit++<10000){
        executeBlock(m[4],localVars);
        executeStatement(m[3].trim()+';',localVars);
      }
    }
    return;
  }

  // while
  if (stmt.startsWith('while')) {
    const m = stmt.match(/^while\s*\(\s*(.+?)\s*\)\s*\{([\s\S]*?)\}/);
    if (m) { let limit=0; while(evalCondition(m[1],Object.assign({},simState.variables,localVars))&&limit++<10000) executeBlock(m[2],localVars); }
    return;
  }

  // Custom function call
  const fc = stmt.match(/^(\w+)\s*\(([^)]*)\);$/);
  if (fc && simState.functions[fc[1]]) {
    const func = simState.functions[fc[1]];
    const args = fc[2] ? fc[2].split(',').map(a=>evalExpr(a.trim(),vars)) : [];
    const pnames = func.params ? func.params.split(',').map(p=>p.trim().split(/\s+/).pop()).filter(Boolean) : [];
    const fvars = {};
    pnames.forEach((p,i)=>fvars[p]=args[i]!==undefined?args[i]:0);
    executeBlock(func.body, Object.assign({},localVars,fvars));
  }
}

function evalExpr(expr, vars) {
  if (!expr) return 0;
  expr = String(expr).trim();
  if (expr==='HIGH'||expr==='true'||expr==='OUTPUT') return 1;
  if (expr==='LOW'||expr==='false'||expr==='INPUT') return 0;
  if (expr==='millis()') return simState.millis;
  if (expr.startsWith('"')&&expr.endsWith('"')) return expr.slice(1,-1);
  if (expr.startsWith("'")&&expr.endsWith("'")) return expr.charCodeAt(1);

  const dr = expr.match(/^digitalRead\s*\(\s*(.+?)\s*\)$/);
  if (dr) { const p = evalExpr(dr[1],vars); return simState.pins[p]||simState.pins[String(p)]||0; }

  const ar = expr.match(/^analogRead\s*\(\s*(.+?)\s*\)$/);
  if (ar) { const p = evalExpr(ar[1],vars); return simState.analogPins[p]||simState.analogPins['A'+p]||0; }

  const mapM = expr.match(/^map\s*\(\s*(.+?),\s*(.+?),\s*(.+?),\s*(.+?),\s*(.+?)\s*\)$/);
  if (mapM) { const [v,fl,fh,tl,th]=[mapM[1],mapM[2],mapM[3],mapM[4],mapM[5]].map(x=>evalExpr(x,vars)); return (v-fl)*(th-tl)/(fh-fl)+tl; }

  const mathM = expr.match(/^(abs|min|max|sqrt|pow|random|constrain)\s*\((.+)\)$/);
  if (mathM) {
    const args = mathM[2].split(',').map(a=>evalExpr(a.trim(),vars));
    const fns = {abs:Math.abs,min:Math.min,max:Math.max,sqrt:Math.sqrt,pow:Math.pow,random:(a,b)=>b!==undefined?Math.floor(Math.random()*(b-a)+a):Math.floor(Math.random()*a),constrain:(v,mn,mx)=>Math.max(mn,Math.min(mx,v))};
    return fns[mathM[1]](...args);
  }

  if (vars&&vars[expr]!==undefined) return vars[expr];
  if (simState.variables[expr]!==undefined) return simState.variables[expr];
  if (!isNaN(expr)) return parseFloat(expr);

  try {
    const safe = expr.replace(/\b([a-zA-Z_]\w*)\b/g, m => {
      if (['true','false','HIGH','LOW','Math','INPUT','OUTPUT'].includes(m)) return m==='HIGH'?'1':m==='LOW'?'0':m;
      return String(vars&&vars[m]!==undefined?vars[m]:(simState.variables[m]!==undefined?simState.variables[m]:0));
    });
    return Function('"use strict";return('+safe+')')();
  } catch(e) { return 0; }
}

function evalCondition(cond, vars) {
  cond = cond.trim();
  if (cond.includes('&&')) return cond.split('&&').every(c=>evalCondition(c.trim(),vars));
  if (cond.includes('||')) return cond.split('||').some(c=>evalCondition(c.trim(),vars));
  for (const op of ['==','!=','>=','<=','>','<']) {
    const idx = cond.indexOf(op);
    if (idx>0) {
      const l=evalExpr(cond.substring(0,idx).trim(),vars);
      const r=evalExpr(cond.substring(idx+op.length).trim(),vars);
      return op==='=='?l==r:op==='!='?l!=r:op==='>='?l>=r:op==='<='?l<=r:op==='>'?l>r:l<r;
    }
  }
  return Boolean(evalExpr(cond,vars));
}

function updateLCDDisplay(lcdName) {
  droppedComponents.forEach(comp => {
    if (comp.compId==='lcd') {
      const lcd = lcdObjects[lcdName];
      if (!lcd) return;
      const l1 = comp.el.querySelector('.lcd-line1');
      const l2 = comp.el.querySelector('.lcd-line2');
      if (l1) l1.textContent = lcd.line1||'';
      if (l2) l2.textContent = lcd.line2||'';
    }
  });
}

function updateInputComponents() {
  droppedComponents.forEach(comp => {
    const compDef = COMPONENTS.find(c=>c.id===comp.compId);
    if (!compDef||!['button','sensor_pir','sensor_temp','potentiometer'].includes(comp.compId)) return;
    const resolvedPinMap = {};
    Object.keys(comp.pinMap).forEach(key => {
      const raw = comp.pinMap[key];
      resolvedPinMap[key] = typeof resolvePin==='function' ? resolvePin(raw) : raw;
    });
    compDef.onSimulate(comp.el, simState, resolvedPinMap);
  });
}

function updateComponents() {
  droppedComponents.forEach(comp => {
    const compDef = COMPONENTS.find(c=>c.id===comp.compId);
    if (!compDef||!compDef.onSimulate) return;
    const resolvedPinMap = {};
    Object.keys(comp.pinMap).forEach(key => {
      const raw = comp.pinMap[key];
      resolvedPinMap[key] = typeof resolvePin==='function' ? resolvePin(raw) : raw;
    });
    compDef.onSimulate(comp.el, simState, resolvedPinMap);
  });
}

// Expose globally
window._sim = { run: runSimulation, stop: stopSimulation };
window.runSimulation = runSimulation;
window.stopSimulation = stopSimulation;
window.servoObjects = servoObjects;
window.lcdObjects = lcdObjects;
window.simState = simState;
window.evalExpr = evalExpr;
window.evalCondition = evalCondition;
window.resolvePin = null; // set by canvas.js
