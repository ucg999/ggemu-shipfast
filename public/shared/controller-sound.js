(function () {
  'use strict';

  var context = null;
  var lastClickAt = 0;

  function getContext() {
    if (context) return context;
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    try { context = new AudioContextClass(); } catch (error) { return null; }
    return context;
  }

  function unlock() {
    var audioContext = getContext();
    if (!audioContext) return false;
    if (audioContext.state === 'suspended') audioContext.resume().catch(function () {});
    return true;
  }

  function click() {
    var nowMs = performance.now();
    if (nowMs - lastClickAt < 42) return false;
    var audioContext = getContext();
    if (!audioContext) return false;
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(click).catch(function () {});
      return false;
    }
    if (audioContext.state !== 'running') return false;
    lastClickAt = nowMs;
    var now = audioContext.currentTime;
    var oscillator = audioContext.createOscillator();
    var transient = audioContext.createOscillator();
    var filter = audioContext.createBiquadFilter();
    var gain = audioContext.createGain();
    var transientGain = audioContext.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(1050, now);
    oscillator.frequency.exponentialRampToValueAtTime(720, now + 0.022);
    filter.type = 'bandpass';
    filter.frequency.value = 980;
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.026);
    transient.type = 'square';
    transient.frequency.setValueAtTime(2100, now);
    transient.frequency.exponentialRampToValueAtTime(1250, now + 0.009);
    transientGain.gain.setValueAtTime(0.025, now);
    transientGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.011);
    oscillator.connect(filter).connect(gain).connect(audioContext.destination);
    transient.connect(transientGain).connect(audioContext.destination);
    oscillator.start(now);
    transient.start(now);
    oscillator.stop(now + 0.027);
    transient.stop(now + 0.012);
    return true;
  }

  window.UCG_CONTROLLER_SOUND = {
    unlock: unlock,
    click: click,
    supported: function () { return Boolean(window.AudioContext || window.webkitAudioContext); }
  };
})();
