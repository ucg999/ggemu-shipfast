(function () {
  'use strict';

  var lastPulseAt = 0;
  var lastSignature = '';
  var profiles = {
    direction: { pattern: 7, interval: 42 },
    action: { pattern: 10, interval: 48 },
    system: { pattern: 10, interval: 55 },
    special: { pattern: [10, 20, 10], interval: 90 },
    hit: { pattern: 30, interval: 90 }
  };

  function canVibrate() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  function chooseProfile(keys) {
    if (keys.some(function (key) { return key === 'start' || key === 'select'; })) return profiles.system;
    if (keys.some(function (key) { return key === 'a' || key === 'b' || key === 'ab'; })) return profiles.action;
    return profiles.direction;
  }

  function press(keys) {
    if (!canVibrate() || !Array.isArray(keys) || keys.length === 0) return false;
    var now = performance.now();
    var signature = keys.slice().sort().join('+');
    var profile = chooseProfile(keys);
    var repeatedTooSoon = signature === lastSignature && now - lastPulseAt < profile.interval;
    var anyPulseTooSoon = now - lastPulseAt < 24;
    if (repeatedTooSoon || anyPulseTooSoon) return false;
    lastPulseAt = now;
    lastSignature = signature;
    try {
      navigator.vibrate(profile.pattern);
      return true;
    } catch (error) {
      return false;
    }
  }

  function cancel() {
    if (!canVibrate()) return;
    try { navigator.vibrate(0); } catch (error) {}
  }

  // Reserved for emulator cores that can report semantic in-game events.
  // Unsupported browsers silently return false; callers should never depend on vibration.
  function gameEvent(type) {
    if (!canVibrate()) return false;
    var profile = type === 'hit' ? profiles.hit : profiles.special;
    var now = performance.now();
    if (now - lastPulseAt < profile.interval) return false;
    lastPulseAt = now;
    lastSignature = 'event:' + type;
    try {
      return navigator.vibrate(profile.pattern);
    } catch (error) {
      return false;
    }
  }

  window.UCG_CONTROLLER_HAPTICS = {
    press: press,
    gameEvent: gameEvent,
    cancel: cancel,
    supported: canVibrate
  };
})();
