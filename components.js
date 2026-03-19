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
    gain.gain.value = 0.1;
    activeBuzzerNode.connect(gain);
    gain.connect(ctx.destination);
    activeBuzzerNode.start();
  } else {
    if (passiveBuzzerNode) return;
    passiveBuzzerNode = ctx.createOscillator();
    const gain = ctx.createGain();
    passiveBuzzerNode.type = 'sine';
    passiveBuzzerNode.frequency.value = freq || 1000;
    gain.gain.value = 0.1;
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
    icon: '💡',
    desc: 'Light Emitting Diode',
    color: '#f0883e',
    pins: [
      { id: 'anode', label: '+', type: 'anode' },
      { id: 'cathode', label: '-', type: 'cathode' }
    ],
    onSimulate: function(el, state, pinMap) {
      const anodePin = pinMap['anode'];
      const icon = el.querySelector('.comp-icon');
      // Check both digital and analog pin states
      const on = anodePin !== null && anodePin !== undefined && (state.pins[anodePin] === 1 || state.pins[String(anodePin)] === 1);
      icon.style.filter = on ? 'drop-shadow(0 0 12px orange) brightness(2)' : '';
      icon.style.fontSize = on ? '32px' : '24px';
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
    desc: 'Push Button',
    color: '#1f6feb',
    pins: [
      { id: 'out', label: 'OUT', type: 'signal' },
      { id: 'gnd', label: 'GND', type: 'gnd' }
    ],
    onSimulate: function(el, state, pinMap) {}
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
        state.pins[vccPin] === 1 ||
        state.pins[String(vccPin)] === 1 ||
        String(vccPin).toUpperCase() === '5V' ||
        String(vccPin).toUpperCase() === '3V3' ||
        String(vccPin).toUpperCase() === 'VIN'
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
      el.querySelector('.comp-name').textContent = on ? `Passive Buzzer ~${val}` : 'Passive Buzzer';
      const freq = Math.round((val / 255) * 2000) + 200;
      if (on) startBuzzer('passive', freq); else stopBuzzer('passive');
    }
  },
  {
    id: 'servo',
    name: 'Servo',
    icon: '⚙️',
    desc: 'Servo Motor',
    color: '#1f6feb',
    pins: [
      { id: 'vcc', label: 'VCC', type: 'vcc' },
      { id: 'signal', label: 'SIG', type: 'signal' },
      { id: 'gnd', label: 'GND', type: 'gnd' }
    ],
    onSimulate: function(el, state, pinMap) {
      const sigPin = pinMap['signal'];
      if (sigPin !== null && sigPin !== undefined) {
        const val = state.analogPins[sigPin] || 0;
        const angle = Math.round((val / 255) * 180);
        el.querySelector('.comp-name').textContent = `Servo: ${angle}°`;
      }
    }
  },
  {
    id: 'sensor_pir',
    name: 'PIR Sensor',
    icon: '👁️',
    desc: 'Motion Sensor',
    color: '#f0883e',
    pins: [
      { id: 'vcc', label: 'VCC', type: 'vcc' },
      { id: 'out', label: 'OUT', type: 'signal' },
      { id: 'gnd', label: 'GND', type: 'gnd' }
    ],
    onSimulate: function(el, state, pinMap) {
      const outPin = pinMap['out'];
      if (outPin !== null && outPin !== undefined) {
        state.pins[outPin] = Math.random() > 0.7 ? 1 : 0;
      }
    }
  },
  {
    id: 'potentiometer',
    name: 'Potentiometer',
    icon: '🎛️',
    desc: 'Variable Resistor',
    color: '#238636',
    pins: [
      { id: 'vcc', label: 'VCC', type: 'vcc' },
      { id: 'out', label: 'OUT', type: 'signal' },
      { id: 'gnd', label: 'GND', type: 'gnd' }
    ],
    onSimulate: function(el, state, pinMap) {
      const outPin = pinMap['out'];
      if (outPin !== null && outPin !== undefined) {
        const slider = el.querySelector('input[type=range]');
        if (slider) {
          state.analogPins[outPin] = parseInt(slider.value);
        }
      }
    },
    extraHTML: '<input type="range" min="0" max="1023" value="512" style="width:100%;margin-top:6px" />'
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
