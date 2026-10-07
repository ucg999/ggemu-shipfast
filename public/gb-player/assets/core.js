(function () {
'use strict';
var WIDTH = 160;
var HEIGHT = 144;
var STATE_KEY = 'gb_kof96_save_state';
var FRAME_MS = 8;
var emulator = null;
var ready = false;
var lastTick = 0;
var accumulated = 0;
var offscreen = document.createElement('canvas');
offscreen.width = WIDTH;
offscreen.height = HEIGHT;
var audioServer = null;

window.XAudioServer = function (channels, sampleRate, minBuffer, maxBuffer, underRunCallback, volume, onFailure) {
this.channels = channels;
this.volume = volume;
this.capacity = Math.max(maxBuffer || 16384, 16384);
this.buffer = new Float32Array(this.capacity);
this.readIndex = 0;
this.writeIndex = 0;
this.available = 0;
this.context = null;
this.processor = null;
try {
var AudioContextCtor = window.AudioContext || window.webkitAudioContext;
if (!AudioContextCtor) throw new Error('Web Audio unavailable');
this.context = new AudioContextCtor({ sampleRate: sampleRate });
this.processor = this.context.createScriptProcessor(1024, 0, channels);
var self = this;
this.processor.onaudioprocess = function (event) {
var left = event.outputBuffer.getChannelData(0);
var right = channels > 1 ? event.outputBuffer.getChannelData(1) : left;
for (var i = 0; i < left.length; i++) {
left[i] = self.available > 0 ? self.buffer[self.readIndex] * self.volume : 0;
if (self.available > 0) { self.readIndex = (self.readIndex + 1) % self.capacity; self.available--; }
right[i] = self.available > 0 ? self.buffer[self.readIndex] * self.volume : left[i];
if (self.available > 0) { self.readIndex = (self.readIndex + 1) % self.capacity; self.available--; }
}
};
this.processor.connect(this.context.destination);
audioServer = this;
} catch (error) {
if (typeof onFailure === 'function') onFailure();
}
};
window.XAudioServer.prototype.writeAudioNoCallback = function (samples) {
for (var i = 0; i < samples.length; i++) {
if (this.available >= this.capacity) {
this.readIndex = (this.readIndex + 1) % this.capacity;
this.available--;
}
this.buffer[this.writeIndex] = samples[i];
this.writeIndex = (this.writeIndex + 1) % this.capacity;
this.available++;
}
};
window.XAudioServer.prototype.remainingBuffer = function () { return this.available; };
window.XAudioServer.prototype.changeVolume = function (value) { this.volume = value; };
window.XAudioServer.prototype.resume = function () {
if (this.context && this.context.state === 'suspended') this.context.resume().catch(function () {});
};
window.XAudioServer.prototype.recordingTrack = function () {
if (!this.context || !this.processor || !this.context.createMediaStreamDestination) return null;
var destination = this.context.createMediaStreamDestination();
this.processor.connect(destination);
var tracks = destination.stream.getAudioTracks();
return tracks.length ? tracks[0] : null;
};

window.settings = [true, true, false, 1, true, false, FRAME_MS, 10, 20, false, false, false, false, false, [true, true, true, true]];
window.cout = function (message, level) {
if (level >= 2 && window.console && console.error) console.error(message);
};
window.pause = function () {
if (emulator) emulator.stopEmulator |= 2;
};
window.initNewCanvas = function () {
offscreen.width = WIDTH;
offscreen.height = HEIGHT;
};

function resumeCore() {
if (!emulator) return;
emulator.stopEmulator &= 1;
lastTick = 0;
accumulated = 0;
}

function createEmulator(romString) {
emulator = new window.GameBoyCore(offscreen, romString);
emulator.openMBC = function () { return []; };
emulator.openRTC = function () { return []; };
emulator.onRumble = function (active) {
if (typeof window.GGEMU_RUMBLE === 'function') window.GGEMU_RUMBLE(active);
};
return emulator;
}

var KEY_INDEX = { right: 0, left: 1, up: 2, down: 3, a: 4, b: 5, select: 6, start: 7 };

window.GGEMU_CORE = {
id: 'gb',
name: 'Game Boy',
pad: {
actions: [{ id: 'b', label: 'B' }, { id: 'a', label: 'A' }],
capsules: [{ id: 'select', label: 'SELECT' }, { id: 'start', label: 'START' }]
},
video: function () { return { w: WIDTH, h: HEIGHT }; },
source: function () { return offscreen; },
boot: function (romBase64, api) {
try {
var instance = createEmulator(window.atob(romBase64));
instance.start();
resumeCore();
instance.run();
ready = true;
api.onReady();
} catch (error) {
api.toast('游戏载入失败');
if (window.console && console.error) console.error(error);
}
},
tick: function () {
if (!ready || !emulator || document.hidden) return;
var now = Date.now();
if (!lastTick) lastTick = now;
accumulated += Math.min(now - lastTick, 50);
lastTick = now;
var steps = 0;
while (accumulated >= FRAME_MS && steps < 7) {
emulator.run();
accumulated -= FRAME_MS;
steps++;
}
},
setButton: function (id, pressed) {
if (!emulator || KEY_INDEX[id] === undefined) return;
emulator.JoyPadEvent(KEY_INDEX[id], pressed);
},
activateAudio: function () {
if (audioServer) audioServer.resume();
},
resumeAudio: function () {
lastTick = 0;
accumulated = 0;
if (audioServer) audioServer.resume();
},
setPaused: function (paused) {
if (!emulator) return;
if (paused) emulator.stopEmulator |= 2;
else resumeCore();
},
reset: function () {
if (typeof window.GGEMU_RUMBLE === 'function') window.GGEMU_RUMBLE(false);
if (emulator) emulator.stopEmulator |= 2;
var instance = createEmulator(window.atob(window.ROM_DATA));
instance.start();
resumeCore();
instance.run();
ready = true;
},
saveState: function () {
if (!emulator) return;
try {
var state = emulator.saveState();
state[0] = null;
localStorage.setItem(STATE_KEY, JSON.stringify(state));
window.GGEMU_TOAST('存档成功！');
} catch (error) {
window.GGEMU_TOAST('存档失败：存储空间不足');
if (window.console && console.error) console.error(error);
}
},
loadState: function () {
try {
var saved = localStorage.getItem(STATE_KEY);
if (!saved) {
window.GGEMU_TOAST('没有找到存档记录！');
return;
}
if (!emulator || !emulator.ROM || !emulator.ROM.length) {
window.GGEMU_TOAST('读档失败：游戏尚未载入');
return;
}
var state = JSON.parse(saved);
state[0] = emulator.fromTypedArray(emulator.ROM);
emulator.returnFromState(state);
resumeCore();
ready = true;
window.GGEMU_TOAST('读档成功！');
} catch (error) {
window.GGEMU_TOAST('读档失败：存档已损坏');
if (window.console && console.error) console.error(error);
}
},
connectRecordingAudio: function () {
return audioServer ? audioServer.recordingTrack() : null;
}
};
})();
