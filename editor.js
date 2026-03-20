const DEFAULT_CODE = `#include <Servo.h>

Servo myServo;
int btnPin = 2;
int ledPin = 13;

void setup() {
  Serial.begin(9600);
  pinMode(ledPin, OUTPUT);
  pinMode(btnPin, INPUT);
  myServo.attach(9);
  Serial.println("Arduino ready!");
}

void loop() {
  // Read button
  int btn = digitalRead(btnPin);
  
  if (btn == HIGH) {
    digitalWrite(ledPin, HIGH);
    myServo.write(90);
    tone(8, 1000);
    Serial.println("Button pressed!");
  } else {
    digitalWrite(ledPin, LOW);
    myServo.write(0);
    noTone(8);
  }
  
  delay(100);
}`;

const editor = document.getElementById('code-editor');
editor.value = DEFAULT_CODE;
updateLineNumbers();

function updateLineNumbers() {
  const lines = editor.value.split('\n').length;
  const nums = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
  document.getElementById('line-numbers').textContent = nums;
}

function handleEditorKey(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
    editor.selectionStart = editor.selectionEnd = start + 2;
    updateLineNumbers();
  }
}

editor.addEventListener('scroll', () => {
  document.getElementById('line-numbers').scrollTop = editor.scrollTop;
});

// Expose globally
window.updateLineNumbers = updateLineNumbers;
window.handleEditorKey = handleEditorKey;
