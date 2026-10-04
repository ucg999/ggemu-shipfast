(function () {
'use strict';
const WIDTH = 256;
const HEIGHT = 240;
const FRAMEBUFFER_SIZE = WIDTH * HEIGHT;
const STATE_KEY = 'nes_save_state';
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
const bank = (value & 0x3f) * 2;
const reverse = (value & 0x80) !== 0;
if (address === 0x8000) {
mapper.load8kRomBank(bank + (reverse ? 1 : 0), 0x8000);
mapper.load8kRomBank(bank + (reverse ? 0 : 1), 0xa000);
mapper.load8kRomBank(bank + (reverse ? 3 : 2), 0xc000);
mapper.load8kRomBank(bank + (reverse ? 2 : 3), 0xe000);
nes.ppu.setMirroring((value & 0x40) ? nes.rom.HORIZONTAL_MIRRORING : nes.rom.VERTICAL_MIRRORING);
} else if (address === 0x8001 || address === 0x8003) {
mapper.load8kRomBank(bank + (reverse ? 1 : 0), 0xc000);
mapper.load8kRomBank(bank + (reverse ? 0 : 1), 0xe000);
if (address === 0x8003) nes.ppu.setMirroring((value & 0x40) ? nes.rom.HORIZONTAL_MIRRORING : nes.rom.VERTICAL_MIRRORING);
} else if (address === 0x8002) {
const selected = bank + (reverse ? 1 : 0);
mapper.load8kRomBank(selected, 0x8000);
mapper.load8kRomBank(selected, 0xa000);
mapper.load8kRomBank(selected, 0xc000);
mapper.load8kRomBank(selected, 0xe000);
}
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
boot: function (romBase64, api) {
nes = new window.jsnes.NES({ onFrame: onFrame, onAudioSample: onAudioSample });
try {
const binary = window.atob(romBase64);
const mapper = ((binary.charCodeAt(6) >> 4) | (binary.charCodeAt(7) & 0xf0));
nes.loadROM(mapper === 15 ? prepareMapper15Rom(binary) : binary);
if (mapper === 15) installMapper15();
} catch (e) {
api.toast('ROM 解析失败');
console.error(e);
return;
}
ready = true;
api.onReady();
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
saveState: function () {
if (!nes) return;
try {
localStorage.setItem(STATE_KEY, JSON.stringify(nes.toJSON()));
window.GGEMU_TOAST('存档成功！');
} catch (e) {
window.GGEMU_TOAST('存档失败：' + e.message);
}
},
loadState: function () {
if (!nes) return;
try {
const s = localStorage.getItem(STATE_KEY);
if (!s) { window.GGEMU_TOAST('没有找到存档记录！'); return; }
nes.fromJSON(JSON.parse(s));
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
