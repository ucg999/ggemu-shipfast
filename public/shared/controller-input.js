(function () {
  'use strict';

  const DEFAULT_KEYBOARD_MAP = {
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    KeyK: 'a', KeyJ: 'b', ShiftLeft: 'select', ShiftRight: 'select', Enter: 'start'
  };

  function bind(options) {
    const canvas = options.canvas;
    const pointers = new Map();
    const keyboard = new Set();
    const keyboardMap = options.keyboardMap || DEFAULT_KEYBOARD_MAP;
    let rapidTimer = 0;
    let rapidInterval = 0;
    let rapidPhase = true;

    canvas.style.touchAction = 'none';

    function setButton(button, pressed) {
      try { options.setButton(button, pressed); } catch (error) { console.error(error); }
    }

    function collectActive() {
      const active = new Set(keyboard);
      pointers.forEach(function (pointer) {
        options.hitTest(pointer.x, pointer.y).forEach(function (button) { active.add(button); });
      });
      if (active.has('ab')) {
        active.add('a');
        active.add('b');
      }
      return active;
    }

    function sync(haptic) {
      const active = collectActive();
      const newlyPressed = [];
      let changed = false;
      Object.keys(options.uiState).forEach(function (button) {
        const pressed = active.has(button);
        if (pressed && !options.uiState[button]) newlyPressed.push(button);
        if (pressed === options.uiState[button]) return;
        options.uiState[button] = pressed;
        changed = true;
        setButton(button, pressed);
      });
      if (haptic && newlyPressed.length && (!options.getHapticsEnabled || options.getHapticsEnabled())) {
        if (options.haptics) options.haptics.press(newlyPressed);
        else if (navigator.vibrate) navigator.vibrate(8);
      }
      if (newlyPressed.length && options.sound && (!options.getSoundEnabled || options.getSoundEnabled())) {
        options.sound.click();
      }
      updateRapidFire();
      if (changed) options.render();
    }

    function stopRapidFire() {
      if (rapidTimer) window.clearInterval(rapidTimer);
      rapidTimer = 0;
      rapidInterval = 0;
      rapidPhase = true;
      ['a', 'b'].forEach(function (button) {
        if (options.uiState[button]) setButton(button, true);
      });
    }

    function updateRapidFire() {
      const interval = Number(options.getRapidFireInterval && options.getRapidFireInterval()) || 0;
      const hasAction = options.uiState.a || options.uiState.b;
      if (!interval || !hasAction) {
        stopRapidFire();
        return;
      }
      if (rapidTimer && interval === rapidInterval) return;
      stopRapidFire();
      rapidInterval = interval;
      rapidTimer = window.setInterval(function () {
        rapidPhase = !rapidPhase;
        ['a', 'b'].forEach(function (button) {
          if (options.uiState[button]) setButton(button, rapidPhase);
        });
      }, interval);
    }

    function pointerPosition(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * canvas.width / rect.width,
        y: (event.clientY - rect.top) * canvas.height / rect.height
      };
    }

    function onPointerDown(event) {
      if (event.button !== undefined && event.button !== 0 && event.pointerType === 'mouse') return;
      event.preventDefault();
      options.activateAudio();
      if (options.sound) options.sound.unlock();
      try { canvas.setPointerCapture(event.pointerId); } catch (error) {}
      pointers.set(event.pointerId, pointerPosition(event));
      sync(event.pointerType !== 'mouse');
    }

    function onPointerMove(event) {
      if (!pointers.has(event.pointerId)) return;
      event.preventDefault();
      pointers.set(event.pointerId, pointerPosition(event));
      sync(event.pointerType !== 'mouse');
    }

    function onPointerEnd(event) {
      if (!pointers.has(event.pointerId)) return;
      event.preventDefault();
      pointers.delete(event.pointerId);
      try { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch (error) {}
      sync(false);
    }

    function onKey(event, pressed) {
      const button = keyboardMap[event.code];
      if (!button) return;
      event.preventDefault();
      options.activateAudio();
      if (pressed) keyboard.add(button); else keyboard.delete(button);
      sync(false);
    }

    function releaseAll() {
      pointers.clear();
      keyboard.clear();
      stopRapidFire();
      let changed = false;
      Object.keys(options.uiState).forEach(function (button) {
        if (!options.uiState[button]) return;
        options.uiState[button] = false;
        changed = true;
        setButton(button, false);
      });
      if (options.haptics) options.haptics.cancel();
      if (changed) options.render();
    }

    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerEnd, { passive: false });
    canvas.addEventListener('pointercancel', onPointerEnd, { passive: false });
    canvas.addEventListener('lostpointercapture', onPointerEnd, { passive: false });
    document.addEventListener('keydown', function (event) { onKey(event, true); });
    document.addEventListener('keyup', function (event) { onKey(event, false); });
    window.addEventListener('blur', releaseAll);
    window.addEventListener('pagehide', releaseAll);
    window.addEventListener('orientationchange', releaseAll);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') releaseAll();
    });

    return { releaseAll: releaseAll, refreshRapidFire: updateRapidFire };
  }

  window.UCG_CONTROLLER_INPUT = { bind: bind };
})();
