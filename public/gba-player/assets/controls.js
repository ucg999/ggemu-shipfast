(function () {
  var host = document.querySelector('.controls');
  if (!host) return;

  function mountNativeControls() {
    var pad = document.querySelector('.ejs_virtualGamepad_parent');
    if (!pad || pad.parentElement === host) return !!pad;
    host.appendChild(pad);
    pad.style.display = 'block';
    pad.setAttribute('aria-label', 'GBA 原生虚拟按键');
    enableMouseTouchBridge(pad);
    bindFunctionBar();
    return true;
  }

  function enableMouseTouchBridge(pad) {
    function input(index, value) {
      var manager = window.EJS_emulator && window.EJS_emulator.gameManager;
      if (manager && typeof manager.simulateInput === 'function') {
        manager.simulateInput(0, index, value);
        document.documentElement.dataset.gbaInput = index + ':' + value;
      }
    }

    var mapping = [
      ['.b_gba-b', 0], ['.b_gba-a', 8], ['.b_gba-l', 10], ['.b_gba-r', 11],
      ['.b_gba-select', 2], ['.b_gba-start', 3]
    ];
    mapping.forEach(function (item) {
      var control = pad.querySelector(item[0]);
      if (!control) return;
      control.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        control.setPointerCapture(event.pointerId);
        input(item[1], 1);
      });
      function release(event) {
        event.preventDefault();
        input(item[1], 0);
      }
      control.addEventListener('pointerup', release);
      control.addEventListener('pointercancel', release);
      control.addEventListener('lostpointercapture', release);
    });

    var dpad = pad.querySelector('.ejs_dpad_main');
    if (!dpad) return;
    var dpadPointer = null;
    function releaseDirections() { [4, 5, 6, 7].forEach(function (index) { input(index, 0); }); }
    function updateDirections(event) {
      var rect = dpad.getBoundingClientRect();
      var x = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      var y = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      input(4, y < -.22 ? 1 : 0);
      input(5, y > .22 ? 1 : 0);
      input(6, x < -.22 ? 1 : 0);
      input(7, x > .22 ? 1 : 0);
    }
    dpad.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      dpadPointer = event.pointerId;
      dpad.setPointerCapture(event.pointerId);
      updateDirections(event);
    });
    dpad.addEventListener('pointermove', function (event) {
      if (dpadPointer === event.pointerId) updateDirections(event);
    });
    function releaseDpad(event) {
      if (dpadPointer !== event.pointerId) return;
      releaseDirections();
      dpadPointer = null;
    }
    dpad.addEventListener('pointerup', releaseDpad);
    dpad.addEventListener('pointercancel', releaseDpad);
    dpad.addEventListener('lostpointercapture', releaseDpad);
  }

  function findEmulatorButton(pattern) {
    return Array.from(document.querySelectorAll('#game button')).find(function (button) {
      return pattern.test((button.textContent || '').trim());
    });
  }

  function bindFunctionBar() {
    document.querySelectorAll('.function-bar [data-action]').forEach(function (button) {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', function () {
        var action = button.dataset.action;
        if (action === 'save') findEmulatorButton(/^保存状态$/)?.click();
        if (action === 'load') findEmulatorButton(/^加载状态$/)?.click();
        if (action === 'pause') {
          var emulator = window.EJS_emulator;
          if (!emulator) return;
          if (emulator.paused) {
            emulator.play();
            button.textContent = '暂停';
            button.classList.remove('active');
          } else {
            emulator.pause();
            button.textContent = '继续';
            button.classList.add('active');
          }
        }
        if (action === 'record') toggleRecording(button);
      });
    });
  }

  var recorder = null;
  var recordedChunks = [];
  function toggleRecording(button) {
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
      button.textContent = '录像';
      button.classList.remove('active');
      return;
    }
    var canvas = document.querySelector('#game canvas');
    if (!canvas || !canvas.captureStream || typeof MediaRecorder !== 'function') return;
    recordedChunks = [];
    recorder = new MediaRecorder(canvas.captureStream(60), { mimeType: 'video/webm' });
    recorder.ondataavailable = function (event) { if (event.data.size) recordedChunks.push(event.data); };
    recorder.onstop = function () {
      var url = URL.createObjectURL(new Blob(recordedChunks, { type: 'video/webm' }));
      var link = document.createElement('a');
      link.href = url;
      link.download = 'UCG999-GBA-录像.webm';
      link.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    };
    recorder.start();
    button.textContent = '停止';
    button.classList.add('active');
  }

  if (!mountNativeControls()) {
    var observer = new MutationObserver(function () {
      if (mountNativeControls()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
