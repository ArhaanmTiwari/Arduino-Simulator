// Arduino Simulator Engine
let simInterval = null;
let simState = {
  pins: {},
  analogPins: {},
  variables: {},
  functions: {},
  millis: 0,
  running: false
};

let setupCode = '';
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
    serialLog('Upload complete. Running...', 'info');
    setStatus('Running', 'running');

    document.getElementById('btn-run').disabled = true;
    document.getElementById('btn-stop').disabled = false;

    simState.running = true;
    simState.millis = 0;
    simState.pins = {};
    simState.pins["5V"] = 1;
    simState.pins["3V3"] = 1;
    simState.pins["VIN"] = 1;
    simState.pins["GND"] = 0;
    simState.pins["5v"] = 1;
    simState.pins["3v3"] = 1;
    simState.pins["gnd"] = 0;
    simState.analogPins = {};
    simState.variables = {};
    loopIndex = 0;
    waitUntil = 0;

    // Run setup once
    if (setupCode) {
      executeBlock(setupCode, {});
    }

    // Run loop statement by statement
    simInterval = setInterval(() => {
      try {
        simState.millis += 50;

        // Still waiting for delay?
        if (simState.millis < waitUntil) {
          updateComponents();
          return;
        }

        if (loopStatements.length === 0) return;

        // Reset to start of loop
        if (loopIndex >= loopStatements.length) loopIndex = 0;

        // Execute one statement
        const stmt = loopStatements[loopIndex].trim();
        loopIndex++;

        if (!stmt) {
          updateComponents();
          return;
        }

        // Handle delay specially
        const delayMatch = stmt.match(/^delay\s*\(\s*(.+?)\s*\);$/);
        if (delayMatch) {
          const ms = evalExpr(delayMatch[1], simState.variables);
          waitUntil = simState.millis + parseInt(ms);
        } else {
          executeStatement(stmt, simState.variables, loopStatements, loopIndex);
        }

        updateComponents();

      } catch (err) {
        serialLog('Runtime error: ' + err.message, 'error');
        stopSimulation();
      }
    }, 50);

  } catch (err) {
    serialLog('Compile error: ' + err.message, 'error');
    setStatus('Error', 'error');
  }
}

function stopSimulation() {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
  simState.running = false;
  simState.pins = {};
    simState.pins["5V"] = 1;
    simState.pins["3V3"] = 1;
    simState.pins["VIN"] = 1;
    simState.pins["GND"] = 0;
    simState.pins["5v"] = 1;
    simState.pins["3v3"] = 1;
    simState.pins["gnd"] = 0;
  simState.analogPins = {};
  simState.variables = {};
  simState.millis = 0;
  loopIndex = 0;
  waitUntil = 0;

  document.getElementById('btn-run').disabled = false;
  document.getElementById('btn-stop').disabled = true;
  setStatus('Ready', '');
  updateComponents();
  stopBuzzer('active'); stopBuzzer('passive'); serialLog('Simulation stopped.', 'info');
}

function parseCode(code) {
  setupCode = '';
  loopStatements = [];
  simState.functions = {};

  // Remove comments
  code = code.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  // Find all function definitions
  const funcRegex = /\w[\w\s*]*?\s+(\w+)\s*\([^)]*\)\s*\{/g;
  let match;
  const funcPositions = [];

  while ((match = funcRegex.exec(code)) !== null) {
    funcPositions.push({
      name: match[1],
      start: match.index,
      bodyStart: match.index + match[0].length - 1
    });
  }

  funcPositions.forEach(func => {
    const body = extractBlock(code, func.bodyStart);
    if (func.name === 'setup') {
      setupCode = body;
    } else if (func.name === 'loop') {
      loopStatements = tokenizeStatements(body).filter(s => s.trim());
    } else {
      const fullMatch = code.substring(func.start);
      const paramMatch = fullMatch.match(/\(([^)]*)\)/);
      simState.functions[func.name] = {
        params: paramMatch ? paramMatch[1] : '',
        body
      };
    }
  });
}

function extractBlock(code, start) {
  let depth = 0;
  let i = start;
  let body = '';
  let started = false;

  while (i < code.length) {
    if (code[i] === '{') {
      depth++;
      if (!started) { started = true; i++; continue; }
    }
    if (code[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
    if (started) body += code[i];
    i++;
  }
  return body;
}

function tokenizeStatements(code) {
  const stmts = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '{') depth++;
    if (c === '}') depth--;
    current += c;
    if ((c === ';' || (c === '}' && depth === 0)) && depth === 0) {
      const s = current.trim();
      if (s) stmts.push(s);
      current = '';
    }
  }
  if (current.trim()) stmts.push(current.trim());
  return stmts;
}

function executeBlock(code, localVars) {
  code = code.replace(/\/\/[^\n]*/g, '');
  const statements = tokenizeStatements(code).filter(s => s.trim());
  for (let i = 0; i < statements.length; i++) {
    executeStatement(statements[i].trim(), localVars, statements, i);
  }
}

function executeStatement(stmt, localVars, allStmts, idx) {
  if (!stmt) return;
  const vars = Object.assign({}, simState.variables, localVars);

  // Variable declaration
  const varDecl = stmt.match(/^(?:int|float|long|bool|byte|char|double|unsigned\s+int|unsigned\s+long|String)\s+(\w+)\s*(?:=\s*(.+?))?;$/);
  if (varDecl) {
    const val = varDecl[2] !== undefined ? evalExpr(varDecl[2], vars) : 0;
    localVars[varDecl[1]] = val;
    simState.variables[varDecl[1]] = val;
    return;
  }

  // Assignment
  const assign = stmt.match(/^(\w+)\s*(=|\+=|-=|\*=|\/=)\s*(.+?);$/);
  if (assign && !['if', 'for', 'while', 'void', 'int', 'bool', 'float'].includes(assign[1])) {
    let cur = simState.variables[assign[1]] !== undefined ? simState.variables[assign[1]] : 0;
    const val = evalExpr(assign[3], vars);
    if (assign[2] === '=') cur = val;
    else if (assign[2] === '+=') cur += val;
    else if (assign[2] === '-=') cur -= val;
    else if (assign[2] === '*=') cur *= val;
    else if (assign[2] === '/=') cur /= val;
    localVars[assign[1]] = cur;
    simState.variables[assign[1]] = cur;
    return;
  }

  // i++ / i--
  const incMatch = stmt.match(/^(\w+)(\+\+|--);$/);
  if (incMatch) {
    const n = incMatch[1];
    simState.variables[n] = (simState.variables[n] || 0) + (incMatch[2] === '++' ? 1 : -1);
    return;
  }

  // pinMode
  if (stmt.match(/^pinMode\s*\(/)) return;

  // digitalWrite
  const dw = stmt.match(/^digitalWrite\s*\(\s*(.+?)\s*,\s*(.+?)\s*\);$/);
  if (dw) {
    const pin = evalExpr(dw[1], vars);
    const val = evalExpr(dw[2], vars);
    const isHigh = (val === 1 || val === true || String(val).toUpperCase() === 'HIGH');
    simState.pins[pin] = isHigh ? 1 : 0;
    simState.pins[String(pin)] = isHigh ? 1 : 0;
    return;
  }

  // analogWrite
  const aw = stmt.match(/^analogWrite\s*\(\s*(.+?)\s*,\s*(.+?)\s*\);$/);
  if (aw) {
    const pin = evalExpr(aw[1], vars);
    const val = Math.max(0, Math.min(255, evalExpr(aw[2], vars)));
    simState.analogPins[pin] = val;
    simState.pins[pin] = val > 0 ? 1 : 0;
    simState.pins[String(pin)] = val > 0 ? 1 : 0;
    return;
  }

  // Serial.begin
  if (stmt.match(/^Serial\.begin\s*\(/)) return;

  // Serial.println
  const println = stmt.match(/^Serial\.println\s*\(\s*(.*?)\s*\);$/);
  if (println) { serialLog(String(evalExpr(println[1], vars))); return; }

  // Serial.print
  const print = stmt.match(/^Serial\.print\s*\(\s*(.*?)\s*\);$/);
  if (print) { serialLog(String(evalExpr(print[1], vars))); return; }

  // delay - handled in main loop for loopStatements, here for setup
  const delayM = stmt.match(/^delay\s*\(\s*(.+?)\s*\);$/);
  if (delayM) { simState.millis += evalExpr(delayM[1], vars); return; }

  // if/else
  if (stmt.startsWith('if')) {
    const m = stmt.match(/^if\s*\((.+?)\)\s*\{([\s\S]*?)\}(?:\s*else\s*\{([\s\S]*?)\})?/);
    if (m) {
      if (evalCondition(m[1], vars)) executeBlock(m[2], localVars);
      else if (m[3]) executeBlock(m[3], localVars);
    }
    return;
  }

  // for loop
  if (stmt.startsWith('for')) {
    const m = stmt.match(/^for\s*\(\s*(.+?);\s*(.+?);\s*(.+?)\s*\)\s*\{([\s\S]*?)\}/);
    if (m) {
      executeStatement(m[1].trim() + ';', localVars, [], 0);
      let limit = 0;
      while (evalCondition(m[2], Object.assign({}, simState.variables, localVars)) && limit++ < 1000) {
        executeBlock(m[4], localVars);
        executeStatement(m[3].trim() + ';', localVars, [], 0);
      }
    }
    return;
  }

  // while loop
  if (stmt.startsWith('while')) {
    const m = stmt.match(/^while\s*\(\s*(.+?)\s*\)\s*\{([\s\S]*?)\}/);
    if (m) {
      let limit = 0;
      while (evalCondition(m[1], Object.assign({}, simState.variables, localVars)) && limit++ < 1000) {
        executeBlock(m[2], localVars);
      }
    }
    return;
  }

  // Custom function call
  const fc = stmt.match(/^(\w+)\s*\(([^)]*)\);$/);
  if (fc && simState.functions[fc[1]]) {
    const func = simState.functions[fc[1]];
    const args = fc[2] ? fc[2].split(',').map(a => evalExpr(a.trim(), vars)) : [];
    const paramNames = func.params ? func.params.split(',').map(p => p.trim().split(/\s+/).pop()).filter(Boolean) : [];
    const fvars = {};
    paramNames.forEach((p, i) => fvars[p] = args[i] !== undefined ? args[i] : 0);
    executeBlock(func.body, Object.assign({}, localVars, fvars));
    return;
  }
}

function evalExpr(expr, vars) {
  if (!expr) return 0;
  expr = String(expr).trim();

  if (expr === 'HIGH' || expr === 'true' || expr === 'OUTPUT') return 1;
  if (expr === 'LOW' || expr === 'false' || expr === 'INPUT') return 0;
  if (expr === 'millis()') return simState.millis;
  if (expr.startsWith('"') && expr.endsWith('"')) return expr.slice(1, -1);
  if (expr.startsWith("'") && expr.endsWith("'")) return expr.charCodeAt(1);

  const dr = expr.match(/^digitalRead\s*\(\s*(.+?)\s*\)$/);
  if (dr) { const p = evalExpr(dr[1], vars); return simState.pins[p] || 0; }

  const ar = expr.match(/^analogRead\s*\(\s*(.+?)\s*\)$/);
  if (ar) { const p = evalExpr(ar[1], vars); return simState.analogPins[p] || simState.analogPins['A' + p] || Math.floor(Math.random() * 1023); }

  const mapM = expr.match(/^map\s*\(\s*(.+?),\s*(.+?),\s*(.+?),\s*(.+?),\s*(.+?)\s*\)$/);
  if (mapM) {
    const [v, fl, fh, tl, th] = [mapM[1], mapM[2], mapM[3], mapM[4], mapM[5]].map(x => evalExpr(x, vars));
    return (v - fl) * (th - tl) / (fh - fl) + tl;
  }

  const mathM = expr.match(/^(abs|min|max|sqrt|pow|random|millis)\s*\((.+?)\)$/);
  if (mathM) {
    const args = mathM[2].split(',').map(a => evalExpr(a.trim(), vars));
    const fns = { abs: Math.abs, min: Math.min, max: Math.max, sqrt: Math.sqrt, pow: Math.pow, millis: () => simState.millis, random: (a, b) => b !== undefined ? Math.floor(Math.random() * (b - a) + a) : Math.floor(Math.random() * a) };
    return fns[mathM[1]](...args);
  }

  if (vars && vars[expr] !== undefined) return vars[expr];
  if (simState.variables[expr] !== undefined) return simState.variables[expr];
  if (!isNaN(expr)) return parseFloat(expr);

  try {
    const safe = expr.replace(/\b([a-zA-Z_]\w*)\b/g, m => {
      if (['true','false','HIGH','LOW','Math','INPUT','OUTPUT'].includes(m)) return m === 'HIGH' ? '1' : m === 'LOW' ? '0' : m;
      const v = vars && vars[m] !== undefined ? vars[m] : (simState.variables[m] !== undefined ? simState.variables[m] : 0);
      return String(v);
    });
    return Function('"use strict";return(' + safe + ')')();
  } catch(e) { return 0; }
}

function evalCondition(cond, vars) {
  cond = cond.trim();
  if (cond.includes('&&')) return cond.split('&&').every(c => evalCondition(c.trim(), vars));
  if (cond.includes('||')) return cond.split('||').some(c => evalCondition(c.trim(), vars));

  for (const op of ['==','!=','>=','<=','>','<']) {
    const idx = cond.indexOf(op);
    if (idx > 0) {
      const l = evalExpr(cond.substring(0, idx).trim(), vars);
      const r = evalExpr(cond.substring(idx + op.length).trim(), vars);
      return op === '==' ? l == r : op === '!=' ? l != r : op === '>=' ? l >= r : op === '<=' ? l <= r : op === '>' ? l > r : l < r;
    }
  }
  return Boolean(evalExpr(cond, vars));
}

function updateComponents() {
  droppedComponents.forEach(comp => {
    const compDef = COMPONENTS.find(c => c.id === comp.compId);
    if (compDef && compDef.onSimulate) {
      // Resolve breadboard pins through nets
      const resolvedPinMap = {};
      Object.keys(comp.pinMap).forEach(key => {
        const raw = comp.pinMap[key];
        resolvedPinMap[key] = typeof resolvePin === 'function' ? resolvePin(raw) : raw;
      });
      compDef.onSimulate(comp.el, simState, resolvedPinMap);
    }
  });
}
