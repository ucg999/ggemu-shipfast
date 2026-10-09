(function () {
'use strict';
var WIDTH = 160;
var HEIGHT = 144;
var activeGameId = 'kof-96';
var currentRomBase64 = '';
var FRAME_MS = 8;
var emulator = null;
var ready = false;
var lastTick = 0;
var accumulated = 0;
var offscreen = document.createElement('canvas');
offscreen.width = WIDTH;
offscreen.height = HEIGHT;
var audioServer = null;
var activeCheats = [];
var STATE_DB_NAME = 'ucg999-gb-save-states';
var STATE_DB_STORE = 'states';

function stateKey() { return 'gb_save_state_' + activeGameId; }
function openStateDb() {
return new Promise(function (resolve, reject) {
if (!window.indexedDB) { reject(new Error('当前浏览器不支持本地存档')); return; }
var request = window.indexedDB.open(STATE_DB_NAME, 1);
request.onupgradeneeded = function () { if (!request.result.objectStoreNames.contains(STATE_DB_STORE)) request.result.createObjectStore(STATE_DB_STORE); };
request.onsuccess = function () { resolve(request.result); };
request.onerror = function () { reject(request.error || new Error('无法打开本地存档')); };
});
}
async function writeState(value) {
var db = await openStateDb();
try {
await new Promise(function (resolve, reject) {
var transaction = db.transaction(STATE_DB_STORE, 'readwrite');
var store = transaction.objectStore(STATE_DB_STORE);
var currentKey = stateKey() + ':current';
var request = store.get(currentKey);
request.onsuccess = function () { if (request.result) store.put(request.result, stateKey() + ':backup'); store.put(value, currentKey); };
request.onerror = function () { transaction.abort(); };
transaction.oncomplete = resolve;
transaction.onerror = function () { reject(transaction.error || new Error('写入存档失败')); };
transaction.onabort = function () { reject(transaction.error || new Error('写入存档中断')); };
});
} finally { db.close(); }
}
async function readState() {
var db = await openStateDb();
try {
return await new Promise(function (resolve, reject) {
var store = db.transaction(STATE_DB_STORE, 'readonly').objectStore(STATE_DB_STORE);
var current = store.get(stateKey() + ':current');
current.onsuccess = function () {
if (current.result) { resolve(current.result); return; }
var backup = store.get(stateKey() + ':backup');
backup.onsuccess = function () { resolve(backup.result || null); };
backup.onerror = function () { reject(backup.error || new Error('读取备份存档失败')); };
};
current.onerror = function () { reject(current.error || new Error('读取存档失败')); };
});
} finally { db.close(); }
}
function bytesToBase64(bytes) { var value = ''; for (var offset = 0; offset < bytes.length; offset += 0x8000) value += String.fromCharCode.apply(null, bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length))); return window.btoa(value); }
function base64ToBytes(value) { var binary = window.atob(value); var bytes = new Uint8Array(binary.length); for (var index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index); return bytes; }
async function checksumBytes(bytes) { var digest = await window.crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(digest), function (byte) { return byte.toString(16).padStart(2, '0'); }).join(''); }
async function encodeCloudState(state) {
if (!window.CompressionStream || !window.crypto || !window.crypto.subtle) throw new Error('当前浏览器不支持云存档压缩');
var raw = new TextEncoder().encode(JSON.stringify(state));
var compressed = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
return { format: 'gzip-base64-v1', data: bytesToBase64(compressed), checksum: await checksumBytes(compressed), rawSize: raw.length };
}
async function decodeCloudState(payload) {
if (!payload || payload.format !== 'gzip-base64-v1') throw new Error('云存档格式无效');
var compressed = base64ToBytes(payload.data);
if (await checksumBytes(compressed) !== payload.checksum) throw new Error('云存档校验失败');
var raw = await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
return JSON.parse(raw);
}

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

function disposeEmulator() {
ready = false;
lastTick = 0;
accumulated = 0;
if (typeof window.GGEMU_RUMBLE === 'function') window.GGEMU_RUMBLE(false);
if (emulator) emulator.stopEmulator |= 2;
emulator = null;
if (audioServer) {
if (audioServer.processor) {
audioServer.processor.onaudioprocess = null;
try { audioServer.processor.disconnect(); } catch (error) {}
}
if (audioServer.context) {
try { audioServer.context.close().catch(function () {}); } catch (error) {}
}
audioServer = null;
}
}

function createEmulator(romString) {
disposeEmulator();
emulator = new window.GameBoyCore(offscreen, romString);
emulator.openMBC = function () { return []; };
emulator.openRTC = function () { return []; };
emulator.onRumble = function (active) {
if (typeof window.GGEMU_RUMBLE === 'function') window.GGEMU_RUMBLE(active);
};
return emulator;
}

function parseCheatCodes(input) {
var parsed = [];
String(input || '').toUpperCase().split(/[\s,;]+/).forEach(function (rawCode) {
var code = rawCode.replace(/[^0-9A-F:=\-]/g, '');
var match = /^01([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/.exec(code);
if (match) {
parsed.push({ address: parseInt(match[3] + match[2], 16), value: parseInt(match[1], 16), code: rawCode });
return;
}
match = /^([0-9A-F]{4})[:=\-]([0-9A-F]{2})$/.exec(code);
if (match) parsed.push({ address: parseInt(match[1], 16), value: parseInt(match[2], 16), code: rawCode });
});
return parsed.slice(0, 32);
}

function applyCheats() {
if (!emulator || !activeCheats.length) return;
for (var index = 0; index < activeCheats.length; index++) {
var cheat = activeCheats[index];
try { emulator.memoryWrite(cheat.address, cheat.value); } catch (error) {}
}
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
activeGameId = String(api.gameId || 'kof-96').replace(/[^a-z0-9_-]/gi, '-');
currentRomBase64 = romBase64;
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
applyCheats();
accumulated -= FRAME_MS;
steps++;
}
},
setButton: function (id, pressed) {
if (!emulator || KEY_INDEX[id] === undefined) return;
emulator.JoyPadEvent(KEY_INDEX[id], pressed);
},
setCheatCodes: function (codes) {
activeCheats = parseCheatCodes(codes);
applyCheats();
return activeCheats.length;
},
clearCheats: function () { activeCheats = []; },
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
if (!currentRomBase64) return;
var instance = createEmulator(window.atob(currentRomBase64));
instance.start();
resumeCore();
instance.run();
ready = true;
},
saveState: async function () {
if (!emulator) return;
try {
var state = emulator.saveState();
state[0] = null;
await writeState(state);
var cloudSaved = false;
try {
var payload = await encodeCloudState(state);
var response = await fetch('/api/fc-save', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: 'gb-' + activeGameId, payload: payload }) });
cloudSaved = response.ok;
} catch (cloudError) { if (window.console && console.warn) console.warn('Unable to save GB cloud state', cloudError); }
window.GGEMU_TOAST(cloudSaved ? '存档成功，已同步玩家账号！' : '本机存档成功！');
} catch (error) {
window.GGEMU_TOAST('存档失败');
if (window.console && console.error) console.error(error);
}
},
loadState: async function () {
try {
var state = null;
var cloudLoaded = false;
try {
var response = await fetch('/api/fc-save?gameId=' + encodeURIComponent('gb-' + activeGameId), { credentials: 'same-origin', cache: 'no-store' });
if (response.ok) {
var data = await response.json();
if (data.payload) { try { state = await decodeCloudState(data.payload); cloudLoaded = true; } catch (primaryError) { if (data.backup) { state = await decodeCloudState(data.backup); cloudLoaded = true; } } }
}
} catch (cloudError) { if (window.console && console.warn) console.warn('Unable to load GB cloud state', cloudError); }
if (!state) state = await readState();
if (!state) {
var legacy = localStorage.getItem(stateKey());
if (legacy) { state = JSON.parse(legacy); await writeState(state); try { localStorage.removeItem(stateKey()); } catch (removeError) {} }
}
if (!state) {
window.GGEMU_TOAST('没有找到存档记录！');
return;
}
if (!emulator || !emulator.ROM || !emulator.ROM.length) {
window.GGEMU_TOAST('读档失败：游戏尚未载入');
return;
}
state[0] = emulator.fromTypedArray(emulator.ROM);
emulator.returnFromState(state);
resumeCore();
ready = true;
if (cloudLoaded) { var localCopy = state.slice(); localCopy[0] = null; await writeState(localCopy); }
window.GGEMU_TOAST(cloudLoaded ? '云存档读取成功！' : '读档成功！');
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
