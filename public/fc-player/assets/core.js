(function () {
'use strict';
const WIDTH = 256;
const HEIGHT = 240;
const FRAMEBUFFER_SIZE = WIDTH * HEIGHT;
let stateKey = 'nes_save_state_super_mario_bros_world';
const STATE_DB_NAME = 'ucg999-fc-save-states';
const STATE_DB_STORE = 'states';
function openStateDb() {
return new Promise((resolve, reject) => {
if (!window.indexedDB) { reject(new Error('当前浏览器不支持本地存档')); return; }
const request = window.indexedDB.open(STATE_DB_NAME, 1);
request.onupgradeneeded = function () {
if (!request.result.objectStoreNames.contains(STATE_DB_STORE)) request.result.createObjectStore(STATE_DB_STORE);
};
request.onsuccess = function () { resolve(request.result); };
request.onerror = function () { reject(request.error || new Error('无法打开本地存档')); };
});
}
async function writeState(value) {
const db = await openStateDb();
try {
await new Promise((resolve, reject) => {
const transaction = db.transaction(STATE_DB_STORE, 'readwrite');
transaction.objectStore(STATE_DB_STORE).put(value, stateKey);
transaction.oncomplete = resolve;
transaction.onerror = function () { reject(transaction.error || new Error('写入存档失败')); };
transaction.onabort = function () { reject(transaction.error || new Error('写入存档中断')); };
});
} finally { db.close(); }
}
async function readState() {
const db = await openStateDb();
try {
return await new Promise((resolve, reject) => {
const transaction = db.transaction(STATE_DB_STORE, 'readonly');
const request = transaction.objectStore(STATE_DB_STORE).get(stateKey);
request.onsuccess = function () { resolve(request.result || null); };
request.onerror = function () { reject(request.error || new Error('读取存档失败')); };
});
} finally { db.close(); }
}
let nes = null;
let ready = false;
let paused = false;
const offscreen = document.createElement('canvas');
offscreen.width = WIDTH;
offscreen.height = HEIGHT;
const offCtx = offscreen.getContext('2d');
const imageData = offCtx.getImageData(0, 0, WIDTH, HEIGHT);
const buf = new ArrayBuffer(imageData.data.length);
const buf8 = new Uint8ClampedArray(buf);
const buf32 = new Uint32Array(buf);
for (let i = 0; i < FRAMEBUFFER_SIZE; i++) buf32[i] = 0xff000000;
function onFrame(framebuffer24) {
for (let i = 0; i < FRAMEBUFFER_SIZE; i++) buf32[i] = 0xff000000 | framebuffer24[i];
imageData.data.set(buf8);
offCtx.putImageData(imageData, 0, 0);
}
const AUDIO_BUFFERING = 512;
const SAMPLE_COUNT = 4 * 1024;
const SAMPLE_MASK = SAMPLE_COUNT - 1;
const samplesL = new Float32Array(SAMPLE_COUNT);
const samplesR = new Float32Array(SAMPLE_COUNT);
let writeCursor = 0;
let readCursor = 0;
let audioCtx = null;
let scriptProcessor = null;
function initAudio() {
if (audioCtx) return;
try {
const Ctor = window.AudioContext || window.webkitAudioContext;
if (!Ctor) return;
audioCtx = new Ctor({ sampleRate: 44100 });
scriptProcessor = audioCtx.createScriptProcessor(AUDIO_BUFFERING, 0, 2);
scriptProcessor.onaudioprocess = function (e) {
const dstL = e.outputBuffer.getChannelData(0);
const dstR = e.outputBuffer.getChannelData(1);
for (let i = 0; i < AUDIO_BUFFERING; i++) {
if (readCursor !== writeCursor) {
dstL[i] = samplesL[readCursor];
dstR[i] = samplesR[readCursor];
readCursor = (readCursor + 1) & SAMPLE_MASK;
} else {
dstL[i] = 0;
dstR[i] = 0;
}
}
};
scriptProcessor.connect(audioCtx.destination);
} catch (e) {
console.log('Web Audio API is not supported');
}
}
function onAudioSample(left, right) {
samplesL[writeCursor] = left;
samplesR[writeCursor] = right;
writeCursor = (writeCursor + 1) & SAMPLE_MASK;
}
function prepareMapper15Rom(binary) {
const bytes = new Uint8Array(binary.length);
for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
bytes[6] = (bytes[6] & 0x0f) | 0x20;
let patched = '';
const step = 8192;
for (let i = 0; i < bytes.length; i += step) {
patched += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + step, bytes.length)));
}
return patched;
}
function installMapper15() {
const mapper = nes.mmap;
const originalWrite = mapper.write.bind(mapper);
mapper.write = function (address, value) {
if (address < 0x8000) {
originalWrite(address, value);
return;
}
const mode = address & 0x03;
const prg16 = value & 0x3f;
const base8 = prg16 * 2;
if (mode === 0) {
// NROM-256: bit 0 comes from CPU A14, so select an aligned 32 KiB pair.
const aligned = (prg16 & 0x3e) * 2;
mapper.load8kRomBank(aligned, 0x8000);
mapper.load8kRomBank(aligned + 1, 0xa000);
mapper.load8kRomBank(aligned + 2, 0xc000);
mapper.load8kRomBank(aligned + 3, 0xe000);
} else if (mode === 1) {
// UNROM: switch the lower 16 KiB and keep the last bank of its 128 KiB block fixed.
const fixed8 = ((prg16 & 0x38) | 0x07) * 2;
mapper.load8kRomBank(base8, 0x8000);
mapper.load8kRomBank(base8 + 1, 0xa000);
mapper.load8kRomBank(fixed8, 0xc000);
mapper.load8kRomBank(fixed8 + 1, 0xe000);
} else if (mode === 2) {
// NROM-64: bit 7 supplies PRG A13; mirror one 8 KiB bank four times.
const selected = base8 + ((value >> 7) & 1);
mapper.load8kRomBank(selected, 0x8000);
mapper.load8kRomBank(selected, 0xa000);
mapper.load8kRomBank(selected, 0xc000);
mapper.load8kRomBank(selected, 0xe000);
} else {
// NROM-128: mirror the selected 16 KiB bank into both halves.
mapper.load8kRomBank(base8, 0x8000);
mapper.load8kRomBank(base8 + 1, 0xa000);
mapper.load8kRomBank(base8, 0xc000);
mapper.load8kRomBank(base8 + 1, 0xe000);
}
nes.ppu.setMirroring((value & 0x40) ? nes.rom.HORIZONTAL_MIRRORING : nes.rom.VERTICAL_MIRRORING);
};
mapper.load8kRomBank(0, 0x8000);
mapper.load8kRomBank(1, 0xa000);
mapper.load8kRomBank(2, 0xc000);
mapper.load8kRomBank(3, 0xe000);
nes.cpu.requestIrq(nes.cpu.IRQ_RESET);
}
const BUTTONS = {
a: 'BUTTON_A', b: 'BUTTON_B', select: 'BUTTON_SELECT', start: 'BUTTON_START',
up: 'BUTTON_UP', down: 'BUTTON_DOWN', left: 'BUTTON_LEFT', right: 'BUTTON_RIGHT'
};
window.GGEMU_CORE = {
id: 'nes',
name: 'NES',
pad: {
actions: [{ id: 'b', label: 'B' }, { id: 'a', label: 'A' }],
capsules: [{ id: 'select', label: 'SELECT' }, { id: 'start', label: 'START' }]
},
video: function () { return { w: WIDTH, h: HEIGHT }; },
source: function () { return offscreen; },
boot: function (romData, api) {
stateKey = 'nes_save_state_' + String(api.gameId || 'super_mario_bros_world').replace(/[^a-z0-9_-]/gi, '_');
const previousNes = nes;
const previousReady = ready;
ready = false;
paused = false;
writeCursor = 0;
readCursor = 0;
samplesL.fill(0);
samplesR.fill(0);
try {
const bytes = typeof romData === 'string'
? Uint8Array.from(window.atob(romData), char => char.charCodeAt(0))
: (romData instanceof Uint8Array ? romData : new Uint8Array(romData));
if (bytes.length < 16 || bytes[0] !== 0x4e || bytes[1] !== 0x45 || bytes[2] !== 0x53 || bytes[3] !== 0x1a) throw new Error('无效的NES文件头');
const trainerSize = (bytes[6] & 0x04) ? 512 : 0;
const expectedSize = 16 + trainerSize + bytes[4] * 16384 + bytes[5] * 8192;
if (bytes.length < expectedSize) throw new Error('ROM文件不完整');
let binary = '';
const chunkSize = 0x8000;
for (let offset = 0; offset < bytes.length; offset += chunkSize) {
binary += String.fromCharCode.apply(null, bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
}
const mapper = ((binary.charCodeAt(6) >> 4) | (binary.charCodeAt(7) & 0xf0));
if (mapper !== 0 && mapper !== 4 && mapper !== 15) throw new Error('暂不支持Mapper ' + mapper);
nes = new window.jsnes.NES({ onFrame: onFrame, onAudioSample: onAudioSample });
nes.loadROM(mapper === 15 ? prepareMapper15Rom(binary) : binary);
if (mapper === 15) installMapper15();
} catch (e) {
nes = previousNes;
ready = previousReady;
api.toast('ROM 解析失败');
console.error(e);
throw e;
}
ready = true;
api.onReady();
return true;
},
tick: function () {
if (!ready || paused || document.hidden) return;
nes.frame();
},
setPaused: function (value) {
paused = !!value;
if (paused && audioCtx && audioCtx.state === 'running') audioCtx.suspend().catch(() => {});
if (!paused && audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
},
setButton: function (id, pressed) {
if (!nes) return;
const name = BUTTONS[id];
if (!name) return;
const code = window.jsnes.Controller[name];
if (pressed) nes.buttonDown(1, code); else nes.buttonUp(1, code);
},
activateAudio: function () {
initAudio();
if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
},
resumeAudio: function () {
if (audioCtx && audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
},
saveState: async function () {
if (!nes) return;
try {
await writeState(nes.toJSON());
window.GGEMU_TOAST('存档成功！');
} catch (e) {
window.GGEMU_TOAST('存档失败：' + e.message);
}
},
loadState: async function () {
if (!nes) return;
try {
let state = await readState();
if (!state) {
const legacyState = localStorage.getItem(stateKey);
if (legacyState) {
state = JSON.parse(legacyState);
await writeState(state);
try { localStorage.removeItem(stateKey); } catch (error) {}
}
}
if (!state) { window.GGEMU_TOAST('没有找到存档记录！'); return; }
nes.fromJSON(state);
window.GGEMU_TOAST('读档成功！');
} catch (e) {
window.GGEMU_TOAST('读档失败：' + e.message);
}
},
connectRecordingAudio: function () {
if (!audioCtx || !scriptProcessor) return null;
const dest = audioCtx.createMediaStreamDestination();
scriptProcessor.connect(dest);
const tracks = dest.stream.getAudioTracks();
return tracks.length ? tracks[0] : null;
}
};
})();
