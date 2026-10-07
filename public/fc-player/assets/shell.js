(async function () {
'use strict';
const core = window.GGEMU_CORE;
const CONFIG = window.GGEMU_CONFIG || {};
const mainCanvas = document.getElementById('main-canvas');
const mainCtx = mainCanvas.getContext('2d');
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
hitboxes.ab = {
type: 'rect', x: abX, y: abY, w: abWidth, h: abHeight,
hx: abX - 8, hy: abY - 7, hw: abWidth + 16, hh: abHeight + 14
};
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
mainCtx.filter = 'contrast(1.12) saturate(0.88) brightness(0.97)';
mainCtx.drawImage(src, hitboxes.game.x, hitboxes.game.y, hitboxes.game.w, hitboxes.game.h);
mainCtx.filter = 'none';
mainCtx.imageSmoothingEnabled = true;
mainCtx.save();
mainCtx.beginPath();
mainCtx.rect(hitboxes.game.x, hitboxes.game.y, hitboxes.game.w, hitboxes.game.h);
mainCtx.clip();
mainCtx.fillStyle = 'rgba(8, 16, 20, 0.12)';
const scanlineStep = Math.max(3, Math.round(hitboxes.game.h / 120));
for (let y = hitboxes.game.y + 1; y < hitboxes.game.y + hitboxes.game.h; y += scanlineStep) {
mainCtx.fillRect(hitboxes.game.x, y, hitboxes.game.w, 1);
}
const glow = mainCtx.createRadialGradient(
hitboxes.game.x + hitboxes.game.w / 2,
hitboxes.game.y + hitboxes.game.h / 2,
hitboxes.game.w * 0.2,
hitboxes.game.x + hitboxes.game.w / 2,
hitboxes.game.y + hitboxes.game.h / 2,
hitboxes.game.w * 0.72
);
glow.addColorStop(0, 'rgba(255,255,255,0)');
glow.addColorStop(1, 'rgba(0,8,12,0.16)');
mainCtx.fillStyle = glow;
mainCtx.fillRect(hitboxes.game.x, hitboxes.game.y, hitboxes.game.w, hitboxes.game.h);
mainCtx.restore();
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
mainCtx.fillStyle = 'rgba(112, 0, 0, 0.96)';
mainCtx.beginPath(); mainCtx.arc(hb.x, hb.y + 4, hb.r, 0, Math.PI * 2); mainCtx.fill();
}
mainCtx.fillStyle = active ? 'rgba(255, 52, 40, 0.99)' : 'rgba(218, 18, 18, 0.98)';
mainCtx.beginPath(); mainCtx.arc(hb.x, hb.y + (active ? 4 : 0), hb.r, 0, Math.PI * 2); mainCtx.fill();
mainCtx.strokeStyle = 'rgba(255, 128, 92, 0.9)';
mainCtx.lineWidth = 2;
mainCtx.stroke();
mainCtx.fillStyle = '#111114';
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
document.getElementById('btn-share').addEventListener('click', async () => {
let shareUrl = window.location.href;
try {
if (window.parent && window.parent !== window && window.parent.location.origin === window.location.origin) {
shareUrl = window.parent.location.origin + '/fc';
}
} catch (error) {}
const shareData = {
title: CONFIG.shareTitle || CONFIG.title || 'FC收藏馆',
text: CONFIG.shareContent || '手机打开即可玩的 FC 小工具',
url: shareUrl
};
if (navigator.share) {
try {
await navigator.share(shareData);
return;
} catch (error) {
if (error && error.name === 'AbortError') return;
}
}
try {
await navigator.clipboard.writeText(shareUrl);
showToast('页面链接已复制');
} catch (error) {
showToast('请复制浏览器地址分享');
}
});
document.getElementById('btn-save').addEventListener('click', () => {
try { core.saveState(); } catch (e) { showToast('存档失败'); console.error(e); }
});
document.getElementById('btn-load').addEventListener('click', () => {
try { core.loadState(); } catch (e) { showToast('读档失败'); console.error(e); }
});
const cartridgeButton = document.getElementById('btn-shot');
const cartridgeScreen = document.getElementById('cartridge-screen');
const closeCartridgeButton = document.getElementById('btn-close-cartridges');
const cartridgeList = document.getElementById('cartridge-list');
const allCartridgeCards = Array.from(document.querySelectorAll('.cartridge-card'));
const ownedCartridgesKey = 'ucg999-fc-owned-cartridges';
const ownedCartridgesMigrationKey = 'ucg999-fc-owned-cartridges-migrated';
let ownedCartridgeIds = [];
let legacyOwnedCartridgeIds = [];
try {
const parsedOwnedCartridges = JSON.parse(localStorage.getItem(ownedCartridgesKey) || '[]');
legacyOwnedCartridgeIds = Array.isArray(parsedOwnedCartridges) ? parsedOwnedCartridges.filter(value => typeof value === 'string') : [];
} catch (error) {}
try {
const collectionResponse = await fetch('/api/fc-cartridges', { credentials: 'same-origin', cache: 'no-store' });
if (collectionResponse.ok) {
let collection = await collectionResponse.json();
if (collection.authenticated === true && Array.isArray(collection.owned)) {
const accountKey = ownedCartridgesKey + ':' + collection.memberId;
const migrationKey = ownedCartridgesMigrationKey + ':' + collection.memberId;
if (legacyOwnedCartridgeIds.length && localStorage.getItem(migrationKey) !== 'yes') {
const migrationResponse = await fetch('/api/fc-cartridges', {
method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ cartridgeIds: legacyOwnedCartridgeIds })
});
if (migrationResponse.ok) {
collection = await migrationResponse.json();
localStorage.setItem(migrationKey, 'yes');
}
}
ownedCartridgeIds = collection.owned.filter(value => typeof value === 'string');
try { localStorage.setItem(accountKey, JSON.stringify(ownedCartridgeIds)); } catch (error) {}
} else {
ownedCartridgeIds = legacyOwnedCartridgeIds.slice(0, 2);
}
}
} catch (error) {
console.warn('Unable to synchronize FC cartridges', error);
ownedCartridgeIds = legacyOwnedCartridgeIds;
}
allCartridgeCards.forEach(card => {
const slide = card.closest('.cartridge-slide');
if (slide) slide.hidden = !ownedCartridgeIds.includes(card.dataset.gameId);
});
const cartridgeCards = allCartridgeCards
.filter(card => ownedCartridgeIds.includes(card.dataset.gameId))
.sort((left, right) => Number.parseInt(left.querySelector('.cartridge-number')?.textContent || '0', 10) - Number.parseInt(right.querySelector('.cartridge-number')?.textContent || '0', 10));
cartridgeCards.forEach(card => cartridgeList.appendChild(card.closest('.cartridge-slide')));
const cartridgeDots = document.getElementById('cartridge-dots');
const cartridgeCount = document.getElementById('cartridge-count');
const cartridgeSearchButton = document.getElementById('btn-search-cartridges');
const cartridgeSearchInput = document.getElementById('cartridge-search');
const previousCartridgeButton = document.getElementById('cartridge-prev');
const nextCartridgeButton = document.getElementById('cartridge-next');
const cartridgeEmpty = document.getElementById('cartridge-empty');
let cartridgeIndex = 0;
let cartridgeTouchStartX = 0;
let cartridgeLoading = false;
let visibleCartridgeCards = cartridgeCards.slice();
cartridgeCount.textContent = '（已收集' + cartridgeCards.length + '款）';
cartridgeEmpty.hidden = cartridgeCards.length > 0;
function syncCartridgeScreenBounds() {
const game = hitboxes.game;
if (!game) return;
const canvasRect = mainCanvas.getBoundingClientRect();
const scaleX = canvasRect.width / mainCanvas.width;
const scaleY = canvasRect.height / mainCanvas.height;
cartridgeScreen.style.left = Math.round(canvasRect.left + game.x * scaleX) + 'px';
cartridgeScreen.style.top = Math.round(canvasRect.top + game.y * scaleY) + 'px';
cartridgeScreen.style.width = Math.round(game.w * scaleX) + 'px';
cartridgeScreen.style.height = Math.round(game.h * scaleY) + 'px';
}
function renderCartridgeSelection() {
cartridgeList.style.transform = 'translateX(' + (-cartridgeIndex * 100) + '%)';
previousCartridgeButton.disabled = cartridgeIndex === 0;
nextCartridgeButton.disabled = visibleCartridgeCards.length < 2 || cartridgeIndex === visibleCartridgeCards.length - 1;
Array.from(cartridgeDots.children).forEach((dot, index) => dot.classList.toggle('is-active', index === cartridgeIndex));
}
function rebuildCartridgeDots() {
cartridgeDots.replaceChildren();
visibleCartridgeCards.forEach((card, index) => {
const dot = document.createElement('button');
dot.type = 'button';
dot.setAttribute('aria-label', '查看第' + (index + 1) + '张卡带');
dot.addEventListener('click', () => { cartridgeIndex = index; renderCartridgeSelection(); });
cartridgeDots.appendChild(dot);
});
}
function filterCollectedCartridges(value) {
const keyword = String(value || '').trim().toLocaleLowerCase();
visibleCartridgeCards = cartridgeCards.filter(card => {
const number = card.querySelector('.cartridge-number')?.textContent || '';
const matches = !keyword || card.dataset.gameName.toLocaleLowerCase().includes(keyword) || number.toLocaleLowerCase().includes(keyword);
const slide = card.closest('.cartridge-slide');
if (slide) slide.hidden = !matches;
return matches;
});
cartridgeIndex = 0;
cartridgeEmpty.hidden = visibleCartridgeCards.length > 0;
cartridgeEmpty.textContent = keyword ? '没有找到已收藏的卡带' : '还没有收藏卡带';
rebuildCartridgeDots();
renderCartridgeSelection();
}
cartridgeCards.forEach(card => {
card.addEventListener('click', async () => {
if (cartridgeLoading) return;
cartridgeLoading = true;
card.classList.add('is-inserting');
showToast('正在插入《' + card.dataset.gameName + '》');
await new Promise(resolve => setTimeout(resolve, 620));
setCartridgeScreen(false);
try {
await loadRom(card.dataset.rom, card.dataset.gameId, card.dataset.gameName);
showToast('《' + card.dataset.gameName + '》已启动');
} catch (error) {
// loadRom already reports the failure without interrupting the current page.
} finally {
card.classList.remove('is-inserting');
cartridgeLoading = false;
}
});
});
previousCartridgeButton.addEventListener('click', () => {
cartridgeIndex = Math.max(0, cartridgeIndex - 1);
renderCartridgeSelection();
});
nextCartridgeButton.addEventListener('click', () => {
cartridgeIndex = Math.min(visibleCartridgeCards.length - 1, cartridgeIndex + 1);
renderCartridgeSelection();
});
cartridgeList.addEventListener('touchstart', event => {
cartridgeTouchStartX = event.touches[0].clientX;
}, { passive: true });
cartridgeList.addEventListener('touchend', event => {
const distance = event.changedTouches[0].clientX - cartridgeTouchStartX;
if (Math.abs(distance) < 36) return;
cartridgeIndex = Math.max(0, Math.min(visibleCartridgeCards.length - 1, cartridgeIndex + (distance < 0 ? 1 : -1)));
renderCartridgeSelection();
}, { passive: true });
cartridgeSearchButton.addEventListener('click', () => {
const open = !cartridgeSearchInput.classList.contains('is-open');
cartridgeSearchInput.classList.toggle('is-open', open);
cartridgeSearchButton.setAttribute('aria-expanded', String(open));
if (open) cartridgeSearchInput.focus();
else {
cartridgeSearchInput.value = '';
filterCollectedCartridges('');
}
});
cartridgeSearchInput.addEventListener('input', () => filterCollectedCartridges(cartridgeSearchInput.value));
rebuildCartridgeDots();
renderCartridgeSelection();
function setCartridgeScreen(open) {
if (open) syncCartridgeScreenBounds();
cartridgeScreen.classList.toggle('is-open', open);
cartridgeScreen.setAttribute('aria-hidden', String(!open));
core.setPaused(open);
}
window.addEventListener('resize', () => {
if (cartridgeScreen.classList.contains('is-open')) syncCartridgeScreenBounds();
});
async function canOpenCartridgeScreen() {
if (ownedCartridgeIds.length > 0) return true;
try {
const response = await fetch('/api/member', { credentials: 'same-origin', cache: 'no-store' });
if (response.ok) {
const data = await response.json();
if (data && data.member) return true;
}
} catch (error) {
console.warn('Unable to verify player account', error);
}
showToast('请先到FC卡带收藏选择卡带');
if (window.parent && window.parent !== window) {
window.parent.postMessage({ type: 'fc-member-login-request' }, window.location.origin);
}
return false;
}
cartridgeButton.addEventListener('click', async () => {
if (await canOpenCartridgeScreen()) setCartridgeScreen(true);
});
closeCartridgeButton.addEventListener('click', () => setCartridgeScreen(false));
cartridgeScreen.addEventListener('click', event => {
if (event.target === cartridgeScreen) setCartridgeScreen(false);
});
resize();
bindControls();
async function loadRom(url, gameId, gameName) {
return fetch(url)
.then(function (response) {
if (!response.ok) throw new Error('ROM request failed: ' + response.status);
return response.arrayBuffer();
})
.then(function (buffer) {
core.boot(new Uint8Array(buffer), {
gameId: gameId,
toast: showToast,
onReady: function () {
document.title = 'FC收藏馆｜' + gameName;
renderUI();
startRenderLoop();
}
});
})
.catch(function (error) {
showToast('游戏加载失败，请重试');
console.error(error);
throw error;
});
}
const requestedCartridge = new URLSearchParams(window.location.search).get('cartridge');
const requestedCard = cartridgeCards.find(card => card.dataset.gameId === requestedCartridge && card.dataset.rom);
if (requestedCard) {
canOpenCartridgeScreen().then(allowed => {
if (allowed) loadRom(requestedCard.dataset.rom, requestedCard.dataset.gameId, requestedCard.dataset.gameName).catch(() => {});
else loadRom('./assets/super-mario-bros-world.nes', 'super-mario-bros-world', '超级马里奥兄弟').catch(() => {});
});
} else {
loadRom('./assets/super-mario-bros-world.nes', 'super-mario-bros-world', '超级马里奥兄弟').catch(() => {});
}
})();
