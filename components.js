// Web Audio API for buzzer sounds
let audioCtx = null;
let activeBuzzerNode = null;
let passiveBuzzerNode = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function startBuzzer(type, freq) {
  const ctx = getAudioCtx();
  if (type === 'active') {
    if (activeBuzzerNode) return;
    activeBuzzerNode = ctx.createOscillator();
    const gain = ctx.createGain();
    activeBuzzerNode.type = 'square';
    activeBuzzerNode.frequency.value = 2000;
    gain.gain.value = 0.08;
    activeBuzzerNode.connect(gain);
    gain.connect(ctx.destination);
    activeBuzzerNode.start();
  } else {
    if (passiveBuzzerNode) return;
    passiveBuzzerNode = ctx.createOscillator();
    const gain = ctx.createGain();
    passiveBuzzerNode.type = 'sine';
    passiveBuzzerNode.frequency.value = freq || 1000;
    gain.gain.value = 0.08;
    passiveBuzzerNode.connect(gain);
    gain.connect(ctx.destination);
    passiveBuzzerNode.start();
  }
}

function stopBuzzer(type) {
  if (type === 'active' && activeBuzzerNode) {
    activeBuzzerNode.stop();
    activeBuzzerNode = null;
  } else if (type === 'passive' && passiveBuzzerNode) {
    passiveBuzzerNode.stop();
    passiveBuzzerNode = null;
  }
}

// All available components
const COMPONENTS = [
  {
    id: 'led',
    name: 'LED',
    icon: '⚫',
    desc: 'Light Emitting Diode',
    color: '#f0883e',
    pins: [
      { id: 'anode', label: '+', type: 'anode' },
      { id: 'cathode', label: '-', type: 'cathode' }
    ],
    onSimulate: function(el, state, pinMap) {
      const anodePin = pinMap['anode'];
      const on = anodePin !== null && anodePin !== undefined && (state.pins[anodePin] === 1 || state.pins[String(anodePin)] === 1);
      const icon = el.querySelector('.comp-icon');
      icon.style.filter = on ? 'drop-shadow(0 0 12px orange) brightness(2)' : '';
      icon.textContent = on ? '🌕' : '⚫';
    }
  },
  {
    id: 'led_red',
    name: 'Red LED',
    icon: '⚫',
    desc: 'Red LED',
    color: '#f85149',
    pins: [
      { id: 'anode', label: '+', type: 'anode' },
      { id: 'cathode', label: '-', type: 'cathode' }
    ],
    onSimulate: function(el, state, pinMap) {
      const anodePin = pinMap['anode'];
      const on = anodePin !== null && anodePin !== undefined && (state.pins[anodePin] === 1 || state.pins[String(anodePin)] === 1);
      const icon = el.querySelector('.comp-icon');
      icon.style.filter = on ? 'drop-shadow(0 0 12px red) brightness(2)' : '';
      icon.textContent = on ? '🔴' : '⚫';
    }
  },
  {
    id: 'led_green',
    name: 'Green LED',
    icon: '⚫',
    desc: 'Green LED',
    color: '#238636',
    pins: [
      { id: 'anode', label: '+', type: 'anode' },
      { id: 'cathode', label: '-', type: 'cathode' }
    ],
    onSimulate: function(el, state, pinMap) {
      const anodePin = pinMap['anode'];
      const on = anodePin !== null && anodePin !== undefined && (state.pins[anodePin] === 1 || state.pins[String(anodePin)] === 1);
      const icon = el.querySelector('.comp-icon');
      icon.style.filter = on ? 'drop-shadow(0 0 12px lime) brightness(2)' : '';
      icon.textContent = on ? '🟢' : '⚫';
    }
  },
  {
    id: 'button',
    name: 'Button',
    icon: '🔘',
    desc: 'Push Button — Click to toggle',
    color: '#1f6feb',
    pins: [
      { id: 'pin1', label: 'PIN', type: 'signal' },
      { id: 'gnd', label: 'GND', type: 'gnd' }
    ],
    extraHTML: `<button class="comp-btn" 
      onclick="var d=this.closest('.dropped-component'); d.dataset.pressed=d.dataset.pressed==='1'?'0':'1'; this.textContent=d.dataset.pressed==='1'?'RELEASE':'PRESS'; event.stopPropagation();"
      style="margin-top:6px;width:100%;padding:4px;background:#1f6feb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-family:DM Sans,sans-serif;">
      PRESS
    </button>`,
    onSimulate: function(el, state, pinMap) {
      const rawPin = pinMap['pin1'];
      const outPin = typeof resolvePin === 'function' ? resolvePin(rawPin) : rawPin;
      const pressed = el.dataset.pressed === '1';

      // Set all possible pin formats
      if (outPin !== null && outPin !== undefined) {
        state.pins[outPin] = pressed ? 1 : 0;
        state.pins[String(outPin)] = pressed ? 1 : 0;
        const numPin = parseInt(outPin);
        if (!isNaN(numPin)) state.pins[numPin] = pressed ? 1 : 0;
      }
      // Also directly set pin 2 if wired to it
      if (String(outPin) === '2' || String(rawPin) === '2') {
        state.pins[2] = pressed ? 1 : 0;
      }

      const icon = el.querySelector('.comp-icon');
      icon.textContent = pressed ? '🔵' : '🔘';
      icon.style.filter = pressed ? 'drop-shadow(0 0 8px #58a6ff)' : '';
      const btn = el.querySelector('.comp-btn');
      if (btn) btn.style.background = pressed ? '#58a6ff' : '#1f6feb';
    }
  },
  {
    id: 'buzzer_active',
    name: 'Active Buzzer',
    icon: '🔕',
    desc: 'Buzzes when VCC on',
    color: '#f0883e',
    pins: [
      { id: 'vcc', label: 'VCC', type: 'vcc' },
      { id: 'gnd', label: 'GND', type: 'gnd' }
    ],
    onSimulate: function(el, state, pinMap) {
      const vccPin = pinMap['vcc'];
      const on = vccPin !== null && vccPin !== undefined && (
        state.pins[vccPin] === 1 || state.pins[String(vccPin)] === 1 ||
        String(vccPin).toUpperCase() === '5V' || String(vccPin).toUpperCase() === '3V3' || String(vccPin).toUpperCase() === 'VIN'
      );
      const icon = el.querySelector('.comp-icon');
      icon.textContent = on ? '🔔' : '🔕';
      icon.style.filter = on ? 'drop-shadow(0 0 8px orange) brightness(1.5)' : '';
      el.querySelector('.comp-name').textContent = on ? 'Active Buzzer 🔊' : 'Active Buzzer';
      if (on) startBuzzer('active'); else stopBuzzer('active');
    }
  },
  {
    id: 'buzzer_passive',
    name: 'Passive Buzzer',
    icon: '🔕',
    desc: 'Needs PWM signal',
    color: '#1f6feb',
    pins: [
      { id: 'vcc', label: 'VCC', type: 'vcc' },
      { id: 'gnd', label: 'GND', type: 'gnd' }
    ],
    onSimulate: function(el, state, pinMap) {
      const vccPin = pinMap['vcc'];
      const val = vccPin !== null && vccPin !== undefined ? (state.analogPins[vccPin] || 0) : 0;
      const on = val > 0;
      const icon = el.querySelector('.comp-icon');
      icon.textContent = on ? '🔔' : '🔕';
      icon.style.filter = on ? 'drop-shadow(0 0 8px cyan) brightness(1.5)' : '';
      el.querySelector('.comp-name').textContent = on ? `Passive ~${val}` : 'Passive Buzzer';
      const freq = Math.round((val / 255) * 2000) + 200;
      if (on) startBuzzer('passive', freq); else stopBuzzer('passive');
    }
  },
  {
    id: 'servo',
    name: 'Servo Motor',
    icon: '⚙️',
    desc: 'Rotates based on PWM',
    color: '#1f6feb',
    pins: [
      { id: 'vcc', label: 'VCC', type: 'vcc' },
      { id: 'signal', label: 'SIG', type: 'signal' },
      { id: 'gnd', label: 'GND', type: 'gnd' }
    ],
    extraHTML: `<div style="margin-top:8px;text-align:center;">
      <canvas class="servo-canvas" width="90" height="90" style="background:#0d1117;border-radius:8px;border:2px solid #1f6feb;"></canvas>
      <div class="servo-angle" style="font-size:12px;color:#58a6ff;margin-top:4px;font-family:JetBrains Mono,monospace;font-weight:700;">0°</div>
    </div>`,
    onSimulate: function(el, state, pinMap) {
      const sigPin = pinMap['signal'];
      let angle = 0;

      // First try pin map
      if (sigPin !== null && sigPin !== undefined) {
        const val = state.analogPins[sigPin] || state.analogPins[String(sigPin)] || 0;
        if (val > 0) angle = Math.round((val / 255) * 180);
      }

      // Then check servoObjects directly (when using Servo library)
      if (typeof servoObjects !== 'undefined') {
        Object.values(servoObjects).forEach(servo => {
          if (servo.angle !== undefined) angle = servo.angle;
        });
      }

      const canvas = el.querySelector('.servo-canvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const W = 90, H = 90, cx = 45, cy = 50;
        ctx.clearRect(0, 0, W, H);

        // Draw servo body (grey rectangle)
        ctx.fillStyle = '#2a2a3a';
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(10, 35, 70, 40, 4);
        ctx.fill();
        ctx.stroke();

        // Screw holes
        [[18, 42], [72, 42], [18, 67], [72, 67]].forEach(([x, y]) => {
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#1a1a2a';
          ctx.fill();
          ctx.strokeStyle = '#555';
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        // Arc range indicator
        ctx.beginPath();
        ctx.arc(cx, cy, 28, Math.PI, 0, false);
        ctx.strokeStyle = '#1f3a5f';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Current angle arc
        const startRad = Math.PI;
        const endRad = Math.PI - (angle / 180) * Math.PI;
        ctx.beginPath();
        ctx.arc(cx, cy, 28, startRad, endRad, true);
        ctx.strokeStyle = '#1f6feb';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Servo horn (white arm)
        const rad = Math.PI - (angle / 180) * Math.PI;
        const armX = cx + Math.cos(rad) * 26;
        const armY = cy + Math.sin(rad) * 26;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(armX, armY);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Horn tip circle
        ctx.beginPath();
        ctx.arc(armX, armY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Center gear circle
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ddd';
        ctx.fill();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#333';
        ctx.fill();

        // Angle markers 0° and 180°
        ctx.fillStyle = '#444';
        ctx.font = '8px JetBrains Mono';
        ctx.textAlign = 'center';
        ctx.fillText('0°', 12, 52);
        ctx.fillText('180°', 78, 52);
      }
      const angleEl = el.querySelector('.servo-angle');
      if (angleEl) angleEl.textContent = angle + '°';
    }
  },
  {
    id: 'sensor_temp',
    name: 'Temp Sensor',
    icon: '🌡️',
    desc: 'Temperature sensor',
    color: '#238636',
    pins: [
      { id: 'vcc', label: 'VCC', type: 'vcc' },
      { id: 'out', label: 'OUT', type: 'signal' },
      { id: 'gnd', label: 'GND', type: 'gnd' }
    ],
    extraHTML: `<div style="margin-top:6px;">
      <input type="range" min="0" max="100" value="25" class="temp-slider"
        style="width:100%;" oninput="this.nextElementSibling.textContent=this.value+'°C'" />
      <div style="font-size:11px;color:#7d8590;text-align:center;">25°C</div>
    </div>`,
    onSimulate: function(el, state, pinMap) {
      const outPin = pinMap['out'];
      const slider = el.querySelector('.temp-slider');
      const temp = slider ? parseInt(slider.value) : 25;
      // Map 0-100°C to 0-1023 analog value
      const analogVal = Math.round((temp / 100) * 1023);
      if (outPin !== null && outPin !== undefined) {
        state.analogPins[outPin] = analogVal;
        state.analogPins[String(outPin)] = analogVal;
      }
    }
  },
  {
    id: 'sensor_pir',
    name: 'PIR Sensor',
    icon: '👁️',
    desc: 'Motion sensor — click to trigger',
    color: '#f0883e',
    pins: [
      { id: 'vcc', label: 'VCC', type: 'vcc' },
      { id: 'out', label: 'OUT', type: 'signal' },
      { id: 'gnd', label: 'GND', type: 'gnd' }
    ],
    extraHTML: `<button class="comp-btn"
      onclick="var d=this.closest('.dropped-component'); d.dataset.motion=d.dataset.motion==='1'?'0':'1'; this.textContent=d.dataset.motion==='1'?'MOTION ON':'TRIGGER'; event.stopPropagation();"
      style="margin-top:6px;width:100%;padding:4px;background:#f0883e;color:#000;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-family:DM Sans,sans-serif;">
      TRIGGER
    </button>`,
    onSimulate: function(el, state, pinMap) {
      const outPin = pinMap['out'];
      const motion = el.dataset.motion === '1';
      if (outPin !== null && outPin !== undefined) {
        state.pins[outPin] = motion ? 1 : 0;
        state.pins[String(outPin)] = motion ? 1 : 0;
      }
      const icon = el.querySelector('.comp-icon');
      icon.style.filter = motion ? 'drop-shadow(0 0 8px orange)' : '';
    }
  },
  {
    id: 'potentiometer',
    name: 'Potentiometer',
    icon: '🎛️',
    desc: 'Variable resistor',
    color: '#238636',
    pins: [
      { id: 'vcc', label: 'VCC', type: 'vcc' },
      { id: 'out', label: 'OUT', type: 'signal' },
      { id: 'gnd', label: 'GND', type: 'gnd' }
    ],
    extraHTML: `<div style="margin-top:6px;">
      <input type="range" min="0" max="1023" value="512" class="pot-slider"
        style="width:100%;" oninput="this.nextElementSibling.textContent=this.value" />
      <div style="font-size:11px;color:#7d8590;text-align:center;">512</div>
    </div>`,
    onSimulate: function(el, state, pinMap) {
      const outPin = pinMap['out'];
      const slider = el.querySelector('.pot-slider');
      const val = slider ? parseInt(slider.value) : 512;
      if (outPin !== null && outPin !== undefined) {
        state.analogPins[outPin] = val;
        state.analogPins[String(outPin)] = val;
      }
    }
  },
  {
    id: 'lcd',
    name: 'LCD Display',
    icon: '📺',
    desc: '16x2 LCD Screen',
    color: '#1f6feb',
    pins: [
      { id: 'vcc', label: 'VCC', type: 'vcc' },
      { id: 'sda', label: 'SDA', type: 'signal' },
      { id: 'scl', label: 'SCL', type: 'signal' },
      { id: 'gnd', label: 'GND', type: 'gnd' }
    ],
    extraHTML: `<div style="margin-top:6px;background:#1a2e1a;border:1px solid #238636;border-radius:4px;padding:6px;font-family:JetBrains Mono,monospace;">
      <div class="lcd-line1" style="font-size:10px;color:#00ff88;min-height:14px;letter-spacing:1px;">Ready...</div>
      <div class="lcd-line2" style="font-size:10px;color:#00ff88;min-height:14px;letter-spacing:1px;"></div>
    </div>`,
    onSimulate: function(el, state, pinMap) {
      // Show serial output on LCD
      const output = document.getElementById('serial-output');
      if (output) {
        const lines = output.querySelectorAll('.serial-line:not(.error):not(.info)');
        const lcd1 = el.querySelector('.lcd-line1');
        const lcd2 = el.querySelector('.lcd-line2');
        if (lcd1 && lines.length > 0) {
          lcd1.textContent = lines[lines.length - 1]?.textContent?.substring(0, 16) || '';
        }
        if (lcd2 && lines.length > 1) {
          lcd2.textContent = lines[lines.length - 2]?.textContent?.substring(0, 16) || '';
        }
      }
    }
  }
];

function initComponents() {
  const list = document.getElementById('component-list');
  COMPONENTS.forEach(comp => {
    const el = document.createElement('div');
    el.className = 'component-item';
    el.draggable = true;
    el.dataset.compId = comp.id;
    el.innerHTML = `
      <div class="comp-icon">${comp.icon}</div>
      <div class="comp-name">${comp.name}</div>
      <div class="comp-desc">${comp.desc}</div>
    `;
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('compId', comp.id);
    });
    list.appendChild(el);
  });
}

initComponents();

// Expose globally
window.COMPONENTS = COMPONENTS;
window.startBuzzer = startBuzzer;
window.stopBuzzer = stopBuzzer;
