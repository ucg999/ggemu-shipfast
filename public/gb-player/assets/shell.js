(function () {
'use strict';
const core = window.GGEMU_CORE;
const CONFIG = window.GGEMU_CONFIG || {};
const mainCanvas = document.getElementById('main-canvas');
const mainCtx = mainCanvas.getContext('2d');
const videoMask = new Image();
videoMask.src = './assets/gb-mask.png';
videoMask.addEventListener('load', function () { renderUI(); });
let rumbleTimer = 0;
let rumblePhase = false;
function vibrate(duration) {
try {
if (navigator.vibrate) navigator.vibrate(duration);
} catch (error) {}
}
window.GGEMU_RUMBLE = function (active) {
if (rumbleTimer) {
clearInterval(rumbleTimer);
rumbleTimer = 0;
}
if (!active) {
mainCanvas.style.transform = '';
vibrate(0);
return;
}
rumblePhase = false;
vibrate(28);
rumbleTimer = setInterval(function () {
rumblePhase = !rumblePhase;
mainCanvas.style.transform = rumblePhase ? 'translate(2px, -1px)' : 'translate(-1px, 1px)';
vibrate(28);
}, 80);
};
document.addEventListener('visibilitychange', function () {
if (document.hidden) window.GGEMU_RUMBLE(false);
});
if (!core) {
alert('内核适配器未加载 (window.GGEMU_CORE)');
return;
}
const ACTIONS = core.pad.actions || [];
const CAPSULES = core.pad.capsules || [];
const DIRECTIONS = ['up', 'down', 'left', 'right'];
const ACTION_IDS = ACTIONS.map(b => b.id);
const uiState = {};
DIRECTIONS.concat(ACTION_IDS, ['ab'], CAPSULES.map(b => b.id)).forEach(k => { uiState[k] = false; });
const hitboxes = {};
let layoutKey = '';
let animationFrameId = 0;
let animationRunning = false;
const SLOGAN = CONFIG.slogan || '玩怀旧游戏上 ggemu.com';
function videoSize() {
const v = core.video ? core.video() : null;
return { w: (v && v.w) || 256, h: (v && v.h) || 240 };
}
function resize() {
const viewport = window.visualViewport;
const viewportWidth = Math.round((viewport && viewport.width) || window.innerWidth);
const viewportHeight = Math.round((viewport && viewport.height) || window.innerHeight);
mainCanvas.width = viewportWidth;
mainCanvas.height = viewportHeight;
mainCanvas.style.width = viewportWidth + 'px';
mainCanvas.style.height = viewportHeight + 'px';
layoutKey = '';
renderUI();
}
window.addEventListener('resize', resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
function calculateLayout() {
const w = mainCanvas.width;
const h = mainCanvas.height;
const vs = videoSize();
const gameY = 8;
const reservedControlsH = Math.max(210, Math.min(280, h * 0.38));
const maxGameH = Math.max(160, h - gameY - reservedControlsH);
const scale = Math.min(w / vs.w, maxGameH / vs.h);
const gameW = vs.w * scale;
const gameH = vs.h * scale;
const gameX = (w - gameW) / 2;
hitboxes.game = { x: gameX, y: gameY, w: gameW, h: gameH };
const controlsY = gameY + gameH;
const controlsH = h - controlsY;
hitboxes.controls = { y: controlsY, h: controlsH };
const cy = controlsY + controlsH * 0.5 - 40;
const dpadSize = Math.min(w * 0.35, 150, Math.max(78, controlsH - 150));
const dpadX = w * 0.25;
const btnSize = dpadSize / 3;
hitboxes.up = { x: dpadX - btnSize / 2, y: cy - dpadSize / 2, w: btnSize, h: btnSize };
hitboxes.down = { x: dpadX - btnSize / 2, y: cy + dpadSize / 2 - btnSize, w: btnSize, h: btnSize };
hitboxes.left = { x: dpadX - dpadSize / 2, y: cy - btnSize / 2, w: btnSize, h: btnSize };
hitboxes.right = { x: dpadX + dpadSize / 2 - btnSize, y: cy - btnSize / 2, w: btnSize, h: btnSize };
hitboxes.dpadCenter = { x: dpadX, y: cy, size: btnSize };
hitboxes.dpadZone = { x: dpadX, y: cy, r: dpadSize / 2 + 30 };
const n = ACTIONS.length;
const padZoneRight = dpadX + dpadSize / 2 + 30;
const clusterLeft = padZoneRight + 14;
const clusterRight = w - 12;
const clusterWidth = Math.max(clusterRight - clusterLeft, 60);
const widthFactor = (n - 1) * 1.64 + 2;
const r = Math.max(Math.min(btnSize * 0.72, clusterWidth / widthFactor), 14);
const sx = r * 1.64;
const sy = r * 1.21;
const clusterCx = (clusterLeft + clusterRight) / 2;
const hr = r + 12;
ACTIONS.forEach((btn, i) => {
const t = i - (n - 1) / 2;
hitboxes[btn.id] = { type: 'circle', x: clusterCx + t * sx + (btn.id === 'a' ? r * 0.45 : 0), y: cy - t * sy, r: r, hr: hr };
});
const aButton = hitboxes.a;
if (aButton) {
const abWidth = 66;
const abHeight = 34;
const abX = aButton.x - abWidth / 2;
const abY = controlsY + 18;
hitboxes.ab = { type: 'rect', x: abX, y: abY, w: abWidth, h: abHeight, hx: abX - 8, hy: abY - 7, hw: abWidth + 16, hh: abHeight + 14 };
}
const actionBottom = ACTIONS.reduce((bottom, btn) => {
const box = hitboxes[btn.id];
return Math.max(bottom, box ? box.y + box.r + 22 : 0);
}, 0);
const dpadBottom = cy + dpadSize / 2;
const toolbarTop = Math.min(h - 70, Math.max(actionBottom, dpadBottom) + 20);
document.documentElement.style.setProperty('--toolbar-top', Math.round(toolbarTop) + 'px');
const topActionY = cy - ((n - 1) / 2) * sy;
const m = CAPSULES.length;
const cbtnW = 50;
const cbtnH = 15;
const capsulePad = 8;
const capsuleGap = 20;
const rowTotal = m * cbtnW + (m - 1) * capsuleGap;
const capsuleRow = Math.min(
Math.max(cy - 120, controlsY + 34),
topActionY - hr - (cbtnH + capsulePad)
);
const cbtnY = Math.max(capsuleRow, controlsY + 30);
CAPSULES.forEach((btn, i) => {
const x = w / 2 - rowTotal / 2 + i * (cbtnW + capsuleGap);
hitboxes[btn.id] = {
type: 'rect', x: x, y: cbtnY, w: cbtnW, h: cbtnH,
hx: x - 10, hy: cbtnY - capsulePad, hw: cbtnW + 20, hh: cbtnH + capsulePad * 2
};
});
hitboxes.capsuleRowY = cbtnY;
}
window.__ggemuLayout = function () {
return { core: core.id, video: videoSize(), canvas: { w: mainCanvas.width, h: mainCanvas.height }, hitboxes: hitboxes };
};
function drawRoundRect(ctx, x, y, w, h, r) {
ctx.beginPath();
ctx.moveTo(x + r, y);
ctx.lineTo(x + w - r, y);
ctx.quadraticCurveTo(x + w, y, x + w, y + r);
ctx.lineTo(x + w, y + h - r);
ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
ctx.lineTo(x + r, y + h);
ctx.quadraticCurveTo(x, y + h, x, y + h - r);
ctx.lineTo(x, y + r);
ctx.quadraticCurveTo(x, y, x + r, y);
ctx.closePath();
}
function renderUI() {
const vs = videoSize();
const key = vs.w + 'x' + vs.h + '@' + mainCanvas.width + 'x' + mainCanvas.height + '#' + ACTIONS.length;
if (key !== layoutKey) {
layoutKey = key;
calculateLayout();
}
const bg = mainCtx.createLinearGradient(0, 0, 0, mainCanvas.height);
bg.addColorStop(0, '#d9d9dc');
bg.addColorStop(1, '#b9b9be');
mainCtx.fillStyle = bg;
mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
const caseX = 8;
const caseY = 24;
const caseW = mainCanvas.width - 16;
const caseH = mainCanvas.height - 32;
const shell = mainCtx.createLinearGradient(caseX, caseY, caseX + caseW, caseY + caseH);
shell.addColorStop(0, 'rgba(242, 242, 244, 0.86)');
shell.addColorStop(0.5, 'rgba(211, 211, 215, 0.82)');
shell.addColorStop(1, 'rgba(171, 171, 178, 0.88)');
mainCtx.fillStyle = shell;
drawRoundRect(mainCtx, caseX, caseY, caseW, caseH, 28);
mainCtx.fill();
mainCtx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
mainCtx.lineWidth = 2;
mainCtx.stroke();
mainCtx.fillStyle = 'rgba(255, 255, 255, 0.1)';
drawRoundRect(mainCtx, caseX + 8, caseY + 8, caseW - 16, 8, 4);
mainCtx.fill();
const src = core.source ? core.source() : null;
if (hitboxes.game && src) {
mainCtx.fillStyle = 'rgba(8, 38, 41, 0.95)';
drawRoundRect(mainCtx, hitboxes.game.x - 11, hitboxes.game.y - 11, hitboxes.game.w + 22, hitboxes.game.h + 22, 13);
mainCtx.fill();
mainCtx.strokeStyle = 'rgba(215, 215, 220, 0.72)';
mainCtx.lineWidth = 2;
mainCtx.stroke();
mainCtx.imageSmoothingEnabled = false;
mainCtx.drawImage(src, hitboxes.game.x, hitboxes.game.y, hitboxes.game.w, hitboxes.game.h);
mainCtx.imageSmoothingEnabled = true;
if (videoMask.complete && videoMask.naturalWidth > 0) {
mainCtx.drawImage(videoMask, hitboxes.game.x, hitboxes.game.y, hitboxes.game.w, hitboxes.game.h);
}
}
mainCtx.fillStyle = 'rgba(95, 95, 102, 0.12)';
if (hitboxes.controls) {
mainCtx.fillRect(0, hitboxes.controls.y, mainCanvas.width, hitboxes.controls.h);
} else {
mainCtx.fillRect(0, mainCanvas.height * 0.5, mainCanvas.width, mainCanvas.height * 0.5);
}
const drawDRect = (hb, active) => {
if (!hb) return;
mainCtx.fillStyle = active ? 'rgba(55, 55, 60, 0.98)' : 'rgba(18, 18, 21, 0.94)';
drawRoundRect(mainCtx, hb.x, hb.y, hb.w, hb.h, 5);
mainCtx.fill();
mainCtx.strokeStyle = 'rgba(118, 118, 124, 0.72)';
mainCtx.lineWidth = 1;
mainCtx.stroke();
};
const drawDpadArrow = (hb, direction, active) => {
if (!hb) return;
const cx = hb.x + hb.w / 2;
const cy = hb.y + hb.h / 2;
const s = Math.min(hb.w, hb.h) * 0.23;
mainCtx.beginPath();
if (direction === 'up') {
mainCtx.moveTo(cx, cy - s);
mainCtx.lineTo(cx - s, cy + s * 0.7);
mainCtx.lineTo(cx + s, cy + s * 0.7);
} else if (direction === 'down') {
mainCtx.moveTo(cx, cy + s);
mainCtx.lineTo(cx - s, cy - s * 0.7);
mainCtx.lineTo(cx + s, cy - s * 0.7);
} else if (direction === 'left') {
mainCtx.moveTo(cx - s, cy);
mainCtx.lineTo(cx + s * 0.7, cy - s);
mainCtx.lineTo(cx + s * 0.7, cy + s);
} else {
mainCtx.moveTo(cx + s, cy);
mainCtx.lineTo(cx - s * 0.7, cy - s);
mainCtx.lineTo(cx - s * 0.7, cy + s);
}
mainCtx.closePath();
mainCtx.fillStyle = active ? 'rgba(255, 230, 236, 0.18)' : 'rgba(255, 255, 255, 0)';
mainCtx.fill();
mainCtx.strokeStyle = active ? 'rgba(255, 255, 255, 0.96)' : 'rgba(190, 190, 195, 0.78)';
mainCtx.lineWidth = 1.5;
mainCtx.stroke();
};
drawDRect(hitboxes.up, uiState.up);
drawDRect(hitboxes.down, uiState.down);
drawDRect(hitboxes.left, uiState.left);
drawDRect(hitboxes.right, uiState.right);
if (hitboxes.dpadCenter) {
const c = hitboxes.dpadCenter;
mainCtx.fillStyle = 'rgba(15, 15, 18, 0.96)';
mainCtx.fillRect(c.x - c.size / 2, c.y - c.size / 2, c.size, c.size);
}
drawDpadArrow(hitboxes.up, 'up', uiState.up);
drawDpadArrow(hitboxes.down, 'down', uiState.down);
drawDpadArrow(hitboxes.left, 'left', uiState.left);
drawDpadArrow(hitboxes.right, 'right', uiState.right);
const drawCircle = (hb, active, text) => {
if (!hb) return;
if (!active) {
mainCtx.fillStyle = 'rgba(73, 13, 30, 0.96)';
mainCtx.beginPath(); mainCtx.arc(hb.x, hb.y + 4, hb.r, 0, Math.PI * 2); mainCtx.fill();
}
mainCtx.fillStyle = active ? 'rgba(157, 43, 73, 0.99)' : 'rgba(124, 25, 52, 0.98)';
mainCtx.beginPath(); mainCtx.arc(hb.x, hb.y + (active ? 4 : 0), hb.r, 0, Math.PI * 2); mainCtx.fill();
mainCtx.strokeStyle = 'rgba(244, 193, 207, 0.82)';
mainCtx.lineWidth = 2;
mainCtx.stroke();
mainCtx.fillStyle = '#4b4b52';
mainCtx.font = '14px sans-serif';
mainCtx.textAlign = 'center';
mainCtx.textBaseline = 'middle';
mainCtx.fillText(text, hb.x, hb.y + hb.r + 20);
};
ACTIONS.forEach(btn => drawCircle(hitboxes[btn.id], uiState[btn.id], btn.label));
const drawCapsule = (hb, active, text) => {
if (!hb) return;
mainCtx.fillStyle = active ? 'rgba(96, 96, 103, 0.52)' : 'rgba(118, 118, 124, 0.28)';
drawRoundRect(mainCtx, hb.x, hb.y, hb.w, hb.h, hb.h / 2);
mainCtx.fill();
mainCtx.strokeStyle = 'rgba(255, 255, 255, 0.58)';
mainCtx.lineWidth = 1;
mainCtx.stroke();
mainCtx.fillStyle = '#333338';
mainCtx.font = '12px sans-serif';
mainCtx.textAlign = 'center';
mainCtx.textBaseline = 'middle';
mainCtx.fillText(text, hb.x + hb.w / 2, hb.y + hb.h + 15);
};
CAPSULES.forEach(btn => drawCapsule(hitboxes[btn.id], uiState[btn.id], btn.label));
if (hitboxes.ab) {
const combo = hitboxes.ab;
mainCtx.fillStyle = uiState.ab ? 'rgba(96, 96, 103, 0.58)' : 'rgba(178, 178, 184, 0.72)';
drawRoundRect(mainCtx, combo.x, combo.y, combo.w, combo.h, combo.h / 2);
mainCtx.fill();
mainCtx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
mainCtx.lineWidth = 1.5;
mainCtx.stroke();
mainCtx.fillStyle = '#4b4b52';
mainCtx.font = '400 14px sans-serif';
mainCtx.textAlign = 'center';
mainCtx.textBaseline = 'middle';
mainCtx.fillText('AB', combo.x + combo.w / 2, combo.y + combo.h / 2);
}
if (hitboxes.capsuleRowY !== undefined) {
mainCtx.fillStyle = 'rgba(17, 17, 20, 0.92)';
mainCtx.font = '12px sans-serif';
mainCtx.textAlign = 'center';
mainCtx.fillText(SLOGAN, mainCanvas.width / 2, hitboxes.capsuleRowY - 15);
}
}
function pointInRect(x, y, hb) {
if (!hb) return false;
const bx = hb.hx !== undefined ? hb.hx : hb.x;
const by = hb.hy !== undefined ? hb.hy : hb.y;
const bw = hb.hw !== undefined ? hb.hw : hb.w;
const bh = hb.hh !== undefined ? hb.hh : hb.h;
return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
}
function hitTest(x, y) {
const hits = [];
if (hitboxes.dpadZone) {
const z = hitboxes.dpadZone;
const dx = x - z.x;
const dy = y - z.y;
if (dx * dx + dy * dy <= z.r * z.r) {
const threshold = z.r * 0.25;
if (dx > threshold) hits.push('right');
if (dx < -threshold) hits.push('left');
if (dy > threshold) hits.push('down');
if (dy < -threshold) hits.push('up');
if (hits.length === 0) {
if (Math.abs(dx) > Math.abs(dy)) hits.push(dx > 0 ? 'right' : 'left');
else hits.push(dy > 0 ? 'down' : 'up');
}
}
}
let nearest = null;
let nearestDist = Infinity;
for (let i = 0; i < ACTION_IDS.length; i++) {
const hb = hitboxes[ACTION_IDS[i]];
if (!hb) continue;
const dx = x - hb.x;
const dy = y - hb.y;
const d = dx * dx + dy * dy;
if (d <= hb.hr * hb.hr && d < nearestDist) {
nearestDist = d;
nearest = ACTION_IDS[i];
}
}
if (nearest) hits.push(nearest);
CAPSULES.forEach(btn => {
if (pointInRect(x, y, hitboxes[btn.id])) hits.push(btn.id);
});
if (pointInRect(x, y, hitboxes.ab)) hits.push('ab');
return hits;
}
function activateAudio() {
if (core.activateAudio) {
try { core.activateAudio(); } catch (e) { console.error(e); }
}
}
function bindControls() {
const updateTouches = (touches) => {
const newActive = new Set();
for (let i = 0; i < touches.length; i++) {
hitTest(touches[i].clientX, touches[i].clientY).forEach(k => newActive.add(k));
}
if (newActive.has('ab')) {
newActive.add('a');
newActive.add('b');
}
let changed = false;
Object.keys(uiState).forEach(key => {
const isActive = newActive.has(key);
if (uiState[key] !== isActive) {
uiState[key] = isActive;
changed = true;
try { core.setButton(key, isActive); } catch (e) { console.error(e); }
}
});
if (changed) renderUI();
};
mainCanvas.addEventListener('touchstart', (e) => {
e.preventDefault(); activateAudio(); updateTouches(e.touches);
}, { passive: false });
mainCanvas.addEventListener('touchmove', (e) => {
e.preventDefault(); updateTouches(e.touches);
}, { passive: false });
mainCanvas.addEventListener('touchend', (e) => {
e.preventDefault(); updateTouches(e.touches);
}, { passive: false });
mainCanvas.addEventListener('touchcancel', (e) => {
e.preventDefault(); updateTouches(e.touches);
}, { passive: false });
let isMouseDown = false;
mainCanvas.addEventListener('mousedown', (e) => {
isMouseDown = true; activateAudio();
updateTouches([{ clientX: e.clientX, clientY: e.clientY }]);
});
mainCanvas.addEventListener('mousemove', (e) => {
if (!isMouseDown) return;
updateTouches([{ clientX: e.clientX, clientY: e.clientY }]);
});
window.addEventListener('mouseup', () => {
if (!isMouseDown) return;
isMouseDown = false;
updateTouches([]);
});
document.addEventListener('touchstart', activateAudio, { passive: true, capture: true });
document.addEventListener('click', activateAudio);
document.addEventListener('visibilitychange', () => {
if (document.visibilityState !== 'visible') {
stopRenderLoop();
return;
}
if (core.resumeAudio) { try { core.resumeAudio(); } catch (e) {} }
renderUI();
startRenderLoop();
});
}
function renderFrame() {
if (document.hidden) {
animationRunning = false;
return;
}
if (core.tick) {
try { core.tick(); } catch (e) { console.error(e); }
}
renderUI();
animationFrameId = requestAnimationFrame(renderFrame);
}
function startRenderLoop() {
if (animationRunning) return;
animationRunning = true;
animationFrameId = requestAnimationFrame(renderFrame);
}
function stopRenderLoop() {
if (!animationRunning) return;
animationRunning = false;
cancelAnimationFrame(animationFrameId);
}
let toastTimeout;
function showToast(msg) {
const el = document.getElementById('toast');
if (!el) return;
el.textContent = msg;
el.classList.add('show');
clearTimeout(toastTimeout);
toastTimeout = setTimeout(() => { el.classList.remove('show'); }, 2000);
}
window.GGEMU_TOAST = showToast;
document.getElementById('btn-save').addEventListener('click', () => {
try { core.saveState(); } catch (e) { showToast('存档失败'); console.error(e); }
});
document.getElementById('btn-load').addEventListener('click', () => {
try { core.loadState(); } catch (e) { showToast('读档失败'); console.error(e); }
});
const cartridgeScreen = document.getElementById('cartridge-screen');
const closeCartridgeButton = document.getElementById('btn-close-cartridges');
const gbCartridge = document.getElementById('gb-kof96-cartridge');
function syncCartridgeScreenBounds() {
if (!cartridgeScreen || !hitboxes.game) return;
const canvasRect = mainCanvas.getBoundingClientRect();
const scaleX = canvasRect.width / mainCanvas.width;
const scaleY = canvasRect.height / mainCanvas.height;
cartridgeScreen.style.left = Math.round(canvasRect.left + hitboxes.game.x * scaleX) + 'px';
cartridgeScreen.style.top = Math.round(canvasRect.top + hitboxes.game.y * scaleY) + 'px';
cartridgeScreen.style.width = Math.round(hitboxes.game.w * scaleX) + 'px';
cartridgeScreen.style.height = Math.round(hitboxes.game.h * scaleY) + 'px';
}
function setCartridgeScreen(open) {
if (!cartridgeScreen) return;
if (open) syncCartridgeScreenBounds();
cartridgeScreen.classList.toggle('is-open', open);
cartridgeScreen.setAttribute('aria-hidden', open ? 'false' : 'true');
if (core.setPaused) core.setPaused(open);
}
window.addEventListener('resize', syncCartridgeScreenBounds);
document.getElementById('btn-shot').addEventListener('click', event => {
event.stopImmediatePropagation();
setCartridgeScreen(true);
}, true);
closeCartridgeButton.addEventListener('click', () => setCartridgeScreen(false));
gbCartridge.addEventListener('click', () => {
gbCartridge.classList.add('is-inserting');
showToast('正在插入《热斗 格斗之王96》');
window.setTimeout(() => {
try { core.reset(); } catch (error) { console.error(error); }
gbCartridge.classList.remove('is-inserting');
setCartridgeScreen(false);
showToast('《热斗 格斗之王96》已启动');
}, 620);
});
document.getElementById('btn-record').addEventListener('click', async event => {
event.stopImmediatePropagation();
const shareUrl = window.parent && window.parent !== window ? window.parent.location.origin + '/gb' : window.location.href;
const shareData = { title: CONFIG.shareTitle || CONFIG.title, text: CONFIG.shareContent || '', url: shareUrl };
if (navigator.share) {
try { await navigator.share(shareData); return; } catch (error) { if (error && error.name === 'AbortError') return; }
}
try { await navigator.clipboard.writeText(shareUrl); showToast('页面链接已复制'); }
catch (error) { showToast('请复制浏览器地址分享'); }
}, true);
const videoButton = document.getElementById('btn-shot');
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let recordingTimeout = 0;
function stopVideoRecord() {
if (!isRecording) return;
isRecording = false;
clearTimeout(recordingTimeout);
videoButton.textContent = '录像';
if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
}
videoButton.addEventListener('click', () => {
if (isRecording) {
stopVideoRecord();
return;
}
if (!window.xhs || !window.xhs.miniTool) {
showToast('请在小红书 App 中使用录像');
return;
}
if (!window.MediaRecorder || typeof mainCanvas.captureStream !== 'function') {
showToast('当前设备不支持录像');
return;
}
recordedChunks = [];
const stream = mainCanvas.captureStream(30);
const options = { videoBitsPerSecond: 1500000 };
const types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm'];
const mimeType = typeof MediaRecorder.isTypeSupported === 'function' ? (types.find(type => MediaRecorder.isTypeSupported(type)) || '') : '';
if (mimeType) options.mimeType = mimeType;
try {
mediaRecorder = new MediaRecorder(stream, options);
} catch (error) {
showToast('录像启动失败');
return;
}
mediaRecorder.ondataavailable = event => {
if (event.data && event.data.size > 0) recordedChunks.push(event.data);
};
mediaRecorder.onstop = () => {
const type = (mediaRecorder.mimeType || mimeType || 'video/webm').split(';')[0];
const blob = new Blob(recordedChunks, { type: type });
if (!blob.size) {
showToast('没有生成有效录像');
return;
}
const reader = new FileReader();
reader.onloadend = async () => {
try {
const tempFile = await window.xhs.miniTool.writeTempFile({ data: reader.result });
await window.xhs.miniTool.postNote({
title: CONFIG.shareTitle || CONFIG.title,
content: CONFIG.shareContent || '',
pageType: 'video_publish',
mediaInfo: { video_resources: { video_url: tempFile.filePath } }
});
showToast('即将打开发布页面');
} catch (error) {
showToast('录像处理失败');
console.error(error);
}
};
reader.readAsDataURL(blob);
};
mediaRecorder.start();
isRecording = true;
videoButton.textContent = '停止';
showToast('开始录像');
recordingTimeout = setTimeout(stopVideoRecord, 60000);
});
let isPaused = false;
const pauseButton = document.getElementById('btn-record');
pauseButton.addEventListener('click', () => {
isPaused = !isPaused;
core.setPaused(isPaused);
pauseButton.textContent = isPaused ? '继续' : '暂停';
showToast(isPaused ? '游戏已暂停' : '继续游戏');
});
if (typeof window.ROM_DATA !== 'string' || window.ROM_DATA.length === 0) {
alert('ROM_DATA 缺失或为空,请用 build_rom.js 重新打包');
return;
}
resize();
bindControls();
core.boot(window.ROM_DATA, {
toast: showToast,
onReady: function () {
renderUI();
startRenderLoop();
}
});
})();
