// Default starter code
const DEFAULT_CODE = `void setup() {
  Serial.begin(9600);
  pinMode(13, OUTPUT);
  Serial.println("Arduino ready!");
}

void loop() {
  digitalWrite(13, HIGH);
  Serial.println("LED ON");
  delay(1000);
  
  digitalWrite(13, LOW);
  Serial.println("LED OFF");
  delay(1000);
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

  // Sync scroll between editor and line numbers
  editor.addEventListener('scroll', () => {
    document.getElementById('line-numbers').scrollTop = editor.scrollTop;
  });
}

// Sync editor scroll with line numbers
editor.addEventListener('scroll', () => {
  document.getElementById('line-numbers').scrollTop = editor.scrollTop;
});
