(function () {
'use strict';
const core = window.GGEMU_CORE;
const CONFIG = window.GGEMU_CONFIG || {};
const mainCanvas = document.getElementById('main-canvas');
const mainCtx = mainCanvas.getContext('2d');
let soundEnabled = true;
let showAbButton = true;
let rapidFireEnabled = false;
let videoFilterEnabled = true;
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
if (document.body.classList.contains('cheat-open')) return;
const viewportWidth = Math.round(document.documentElement.clientWidth || window.innerWidth);
const viewportHeight = Math.round(document.documentElement.clientHeight || window.innerHeight);
document.documentElement.style.setProperty('--app-width', viewportWidth + 'px');
document.documentElement.style.setProperty('--app-height', viewportHeight + 'px');
mainCanvas.width = viewportWidth;
mainCanvas.height = viewportHeight;
mainCanvas.style.width = viewportWidth + 'px';
mainCanvas.style.height = viewportHeight + 'px';
layoutKey = '';
renderUI();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', function () { window.setTimeout(resize, 180); });
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
if (videoFilterEnabled && videoMask.complete && videoMask.naturalWidth > 0) {
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
if (showAbButton && hitboxes.ab) {
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
if (showAbButton && pointInRect(x, y, hitboxes.ab)) hits.push('ab');
return hits;
}
function activateAudio() {
if (core.activateAudio) {
try { core.activateAudio(); } catch (e) { console.error(e); }
}
}
function bindControls() {
let rapidPhase = true;
window.setInterval(function () {
if (!rapidFireEnabled) return;
rapidPhase = !rapidPhase;
['a', 'b'].forEach(function (button) {
if (uiState[button]) {
try { core.setButton(button, rapidPhase); } catch (error) { console.error(error); }
}
});
}, 85);
const updateTouches = (touches, haptic) => {
const newActive = new Set();
for (let i = 0; i < touches.length; i++) {
hitTest(touches[i].clientX, touches[i].clientY).forEach(k => newActive.add(k));
}
if (newActive.has('ab')) {
newActive.add('a');
newActive.add('b');
}
const newlyPressed = Object.keys(uiState).filter(key => newActive.has(key) && !uiState[key]);
if (haptic && newlyPressed.length && navigator.vibrate) {
const strongPress = newlyPressed.some(key => key === 'a' || key === 'b' || key === 'start' || key === 'select');
navigator.vibrate(strongPress ? 18 : 8);
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
e.preventDefault(); activateAudio(); updateTouches(e.touches, true);
}, { passive: false });
mainCanvas.addEventListener('touchmove', (e) => {
e.preventDefault(); updateTouches(e.touches, true);
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
const keyboardMap = {
KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
KeyK: 'a', KeyJ: 'b', ShiftLeft: 'select', ShiftRight: 'select', Enter: 'start'
};
const setKeyboardButton = (event, pressed) => {
const button = keyboardMap[event.code];
if (!button) return;
event.preventDefault();
if (uiState[button] === pressed) return;
activateAudio();
uiState[button] = pressed;
try { core.setButton(button, pressed); } catch (error) { console.error(error); }
renderUI();
};
document.addEventListener('keydown', event => setKeyboardButton(event, true));
document.addEventListener('keyup', event => setKeyboardButton(event, false));
window.addEventListener('blur', () => {
Object.keys(keyboardMap).forEach(code => {
const button = keyboardMap[code];
if (!uiState[button]) return;
uiState[button] = false;
try { core.setButton(button, false); } catch (error) { console.error(error); }
});
renderUI();
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
document.getElementById('btn-save').addEventListener('click', async () => {
if (!window.confirm('确认保存当前进度吗？这将覆盖当前游戏的原有存档。')) return;
try { await core.saveState(); } catch (e) { showToast('存档失败'); console.error(e); }
});
document.getElementById('btn-load').addEventListener('click', () => {
try { core.loadState({ userInitiated: true }); } catch (e) { showToast('读档失败'); console.error(e); }
});
const utilityMenu = document.createElement('section');
utilityMenu.id = 'utility-menu';
utilityMenu.setAttribute('aria-hidden', 'true');
utilityMenu.style.cssText = 'position:fixed;inset:0;z-index:120;display:none;place-items:center;background:rgba(20,20,24,.48);padding:20px';
utilityMenu.innerHTML = '<div style="width:min(82vw,280px);padding:18px;border:1px solid rgba(255,255,255,.7);border-radius:20px;background:#e8e8ea;box-shadow:0 20px 60px rgba(0,0,0,.38)"><strong style="display:block;margin-bottom:14px;text-align:center;color:#35353a;font-size:18px">游戏菜单</strong><button id="menu-load" type="button" style="width:100%;padding:12px;border:0;border-radius:12px;background:#fff;color:#35353a;font-size:15px;font-weight:700">读档</button><button id="menu-sound" type="button" style="width:100%;margin-top:9px;padding:12px;border:0;border-radius:12px;background:#fff;color:#35353a;font-size:15px;font-weight:700">声音（开）</button><button id="menu-ab" type="button" style="width:100%;margin-top:9px;padding:12px;border:0;border-radius:12px;background:#fff;color:#35353a;font-size:15px;font-weight:700">AB按键（开）</button><button id="menu-rapid" type="button" style="width:100%;margin-top:9px;padding:12px;border:0;border-radius:12px;background:#fff;color:#35353a;font-size:15px;font-weight:700">长按连击（关）</button><button id="menu-share" type="button" style="width:100%;margin-top:9px;padding:12px;border:0;border-radius:12px;background:#fff;color:#35353a;font-size:15px;font-weight:700">分享</button><button id="menu-close" type="button" style="width:100%;margin-top:12px;padding:9px;border:0;background:transparent;color:#696970;font-size:13px">关闭菜单</button></div>';
document.body.appendChild(utilityMenu);
const filterMenuButton = document.createElement('button');
filterMenuButton.id = 'menu-filter';
filterMenuButton.type = 'button';
filterMenuButton.textContent = '滤镜（开）';
filterMenuButton.style.cssText = 'width:100%;margin-top:9px;padding:12px;border:0;border-radius:12px;background:#fff;color:#35353a;font-size:15px;font-weight:700';
utilityMenu.querySelector('#menu-share').before(filterMenuButton);
function setUtilityMenu(open) { utilityMenu.style.display = open ? 'grid' : 'none'; utilityMenu.setAttribute('aria-hidden', open ? 'false' : 'true'); core.setPaused(open); }
let currentGameId = 'kof-96';
const isLocalDevelopment = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const cheatButton = document.createElement('button');
cheatButton.id = 'btn-cheats';
cheatButton.type = 'button';
cheatButton.textContent = '金手指';
const toolbar = document.getElementById('toolbar');
toolbar.insertBefore(cheatButton, document.getElementById('btn-shot'));
cheatButton.hidden = false;
const cheatPanel = document.createElement('section');
cheatPanel.id = 'cheat-panel';
cheatPanel.setAttribute('aria-hidden', 'true');
cheatPanel.innerHTML = '<div class="cheat-dialog"><header><div><small>CHEAT CODES</small><h2>金手指</h2></div><button id="btn-close-cheats" type="button" aria-label="关闭">×</button></header><div class="built-in-cheat" id="speed-cheat"><div><strong>加速 X2</strong><small><img alt="金币" src="/images/coin-rewards/floating-gold-coin.webp">1</small></div><button type="button" aria-pressed="false">开启</button></div><div id="gb-built-in-cheats" hidden></div><p id="cheat-pending">待添加</p><div id="custom-cheat-editor" hidden><p>支持 GB/GBC GameShark 01、91–97 银行代码，或“地址:数值”（如 D000:FF），每行一个。</p><textarea id="cheat-codes" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="每行输入一个金手指代码"></textarea><div class="cheat-actions"><button id="btn-clear-cheats" type="button">清除</button><button id="btn-apply-cheats" type="button">启用</button></div></div></div>';
document.body.appendChild(cheatPanel);
const cheatInput = document.getElementById('cheat-codes');
const customCheatEditor = document.getElementById('custom-cheat-editor');
const cheatPending = document.getElementById('cheat-pending');
const gbBuiltInCheats = document.getElementById('gb-built-in-cheats');
const builtInCheats = {
pikachu: { name: '抓皮卡丘', code: '911904D2', price: 1, enabled: false },
charmander: { name: '抓小火龙', code: '910404D2', price: 1, enabled: false },
bulbasaur: { name: '抓妙蛙种子', code: '910104D2', price: 1, enabled: false },
squirtle: { name: '抓杰尼龟', code: '910704D2', price: 1, enabled: false },
chikorita: { name: '抓菊草叶', code: '919804D2', price: 5, enabled: false },
cyndaquil: { name: '抓火球鼠', code: '919B04D2', price: 5, enabled: false },
totodile: { name: '抓小锯鳄', code: '919E04D2', price: 5, enabled: false },
raikou: { name: '抓雷皇', code: '91F304D2', price: 10, enabled: false },
entei: { name: '抓炎帝', code: '91F404D2', price: 10, enabled: false },
suicune: { name: '抓水君', code: '91F504D2', price: 10, enabled: false }
};
let speedMode = 1;
let selectedSpeed = 2;
let speedChangePending = false;
gbBuiltInCheats.innerHTML = Object.keys(builtInCheats).map(function (id) {
var cheat = builtInCheats[id];
return '<div class="built-in-cheat" data-cheat-id="' + id + '"><div><strong>' + cheat.name + '</strong><small><img alt="金币" src="/images/coin-rewards/floating-gold-coin.webp">' + cheat.price + '</small></div><button type="button" aria-pressed="false">开启</button></div>';
}).join('');
let canEnterCustomCheats = false;
fetch('/api/member', { credentials: 'same-origin', cache: 'no-store' }).then(function (response) {
return response.ok ? response.json() : null;
}).then(function (data) {
canEnterCustomCheats = Boolean(data && data.member && Number(data.member.playerNumber) === 1);
applyStoredCheats(currentGameId);
}).catch(function () {});
function cheatStorageKey() { return 'ucg999-gb-cheats:' + currentGameId; }
function hasFixedCheats() { return currentGameId === 'pokemon-crystal'; }
function renderBuiltInCheats() {
var visible = hasFixedCheats();
gbBuiltInCheats.hidden = !visible;
customCheatEditor.hidden = !canEnterCustomCheats;
cheatPending.hidden = visible || canEnterCustomCheats;
gbBuiltInCheats.querySelectorAll('[data-cheat-id]').forEach(function (row) {
var cheat = builtInCheats[row.dataset.cheatId];
var button = row.querySelector('button');
button.classList.toggle('is-active', cheat.enabled);
button.setAttribute('aria-pressed', cheat.enabled ? 'true' : 'false');
button.textContent = cheat.enabled ? '关闭' : '开启';
});
}
function combinedCheatCodes(customCodes) {
var fixedCodes = hasFixedCheats() ? Object.values(builtInCheats).filter(function (cheat) { return cheat.enabled; }).map(function (cheat) { return cheat.code; }) : [];
return [String(customCodes || '').trim()].concat(fixedCodes).filter(Boolean).join('\n');
}
function applyCurrentCheats(customCodes) {
return core.setCheatCodes ? core.setCheatCodes(combinedCheatCodes(customCodes)) : 0;
}
function spendCoins(amount) {
if (window.parent !== window) {
return new Promise(function (resolve) {
var requestId = 'gb-spend-' + Date.now() + '-' + Math.random().toString(36).slice(2);
var settled = false;
var finish = function (success) { if (settled) return; settled = true; window.removeEventListener('message', onMessage); resolve(Boolean(success)); };
var onMessage = function (event) {
if (event.origin !== window.location.origin || !event.data || event.data.type !== 'gb-spend-coins-result' || event.data.requestId !== requestId) return;
finish(event.data.success);
};
window.addEventListener('message', onMessage);
window.parent.postMessage({ type: 'gb-spend-coins-request', requestId: requestId, amount: amount }, window.location.origin);
window.setTimeout(function () { finish(false); }, 2500);
});
}
try {
var key = 'game-adventure-coin-balance';
var balance = Math.max(0, Math.floor(Number(localStorage.getItem(key)) || 0));
if (balance < amount) return Promise.resolve(false);
localStorage.setItem(key, String(balance - amount));
window.dispatchEvent(new CustomEvent('game-adventure-coin-balance-change', { detail: balance - amount }));
return Promise.resolve(true);
} catch (error) { return Promise.resolve(false); }
}
const speedCheat = document.getElementById('speed-cheat');
speedCheat.style.cursor = 'pointer';
speedCheat.setAttribute('role', 'button');
speedCheat.setAttribute('tabindex', '0');
function renderSpeedCheat() {
var price = selectedSpeed === 4 ? 2 : 1;
speedCheat.querySelector('strong').textContent = '加速 X' + selectedSpeed;
speedCheat.querySelector('small').innerHTML = '<img alt="金币" src="/images/coin-rewards/floating-gold-coin.webp">' + price;
speedCheat.setAttribute('aria-pressed', speedMode > 1 ? 'true' : 'false');
speedCheat.querySelector('button').textContent = speedMode === selectedSpeed ? '关闭' : '开启';
}
function selectSpeedCheat() { selectedSpeed = selectedSpeed === 2 ? 4 : 2; renderSpeedCheat(); }
async function applySpeedCheat() {
if (speedChangePending) return;
speedChangePending = true;
if (speedMode === selectedSpeed) {
speedMode = 1;
} else {
var price = selectedSpeed === 4 ? 2 : 1;
if (!(await spendCoins(price))) { speedChangePending = false; showToast('金币不足，无法开启加速'); return; }
speedMode = selectedSpeed;
}
if (core.setSpeed) core.setSpeed(speedMode);
renderSpeedCheat();
showToast(speedMode === 1 ? '已恢复正常速度' : '已开启 X' + speedMode + ' 加速');
speedChangePending = false;
}
speedCheat.addEventListener('click', function (event) { if (!event.target.closest('button')) selectSpeedCheat(); });
speedCheat.querySelector('button').addEventListener('click', function (event) { event.stopPropagation(); void applySpeedCheat(); });
speedCheat.addEventListener('keydown', function (event) { if ((event.key === 'Enter' || event.key === ' ') && event.target === speedCheat) { event.preventDefault(); selectSpeedCheat(); } });
renderSpeedCheat();
function applyStoredCheats(gameId) {
currentGameId = gameId;
if (!hasFixedCheats()) Object.values(builtInCheats).forEach(function (cheat) { cheat.enabled = false; });
let stored = '';
if (canEnterCustomCheats) {
try { stored = localStorage.getItem(cheatStorageKey()) || ''; } catch (error) {}
}
applyCurrentCheats(stored);
renderBuiltInCheats();
return stored;
}
function setCheatPanel(open) {
cheatPanel.classList.toggle('is-open', open);
cheatPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
document.body.classList.toggle('cheat-open', open);
if (open) { cheatInput.value = applyStoredCheats(currentGameId); core.setPaused(true); if (canEnterCustomCheats) window.setTimeout(function () { cheatInput.focus({ preventScroll: true }); }, 50); }
else { cheatInput.blur(); core.setPaused(false); window.setTimeout(resize, 320); }
}
cheatButton.addEventListener('click', function () { setCheatPanel(true); });
document.getElementById('btn-close-cheats').addEventListener('click', function () { setCheatPanel(false); });
gbBuiltInCheats.addEventListener('click', async function (event) {
var row = event.target.closest('[data-cheat-id]');
var button = event.target.closest('button');
if (!row || !button || !hasFixedCheats()) return;
var cheat = builtInCheats[row.dataset.cheatId];
if (!cheat) return;
if (cheat.enabled) {
cheat.enabled = false;
applyCurrentCheats(cheatInput.value);
renderBuiltInCheats();
showToast(cheat.name + '已关闭');
return;
}
button.disabled = true;
var paid = await spendCoins(cheat.price);
button.disabled = false;
if (!paid) { showToast('金币不足，无法开启' + cheat.name); return; }
Object.values(builtInCheats).forEach(function (entry) { entry.enabled = false; });
cheat.enabled = true;
applyCurrentCheats(cheatInput.value);
renderBuiltInCheats();
showToast('已花费 ' + cheat.price + ' 个金币，' + cheat.name + '已开启');
});
document.getElementById('btn-clear-cheats').addEventListener('click', function () {
if (!canEnterCustomCheats) return;
cheatInput.value = '';
try { localStorage.removeItem(cheatStorageKey()); } catch (error) {}
Object.values(builtInCheats).forEach(function (cheat) { cheat.enabled = false; });
if (core.clearCheats) core.clearCheats();
renderBuiltInCheats();
showToast('已关闭金手指');
});
document.getElementById('btn-apply-cheats').addEventListener('click', function () {
if (!canEnterCustomCheats) return;
const codes = cheatInput.value.trim();
const count = applyCurrentCheats(codes);
try { if (codes) localStorage.setItem(cheatStorageKey(), codes); else localStorage.removeItem(cheatStorageKey()); } catch (error) {}
showToast(count ? '已启用 ' + count + ' 条金手指' : '没有识别到有效代码');
if (count) setCheatPanel(false);
});
const cartridgeScreen = document.getElementById('cartridge-screen');
const closeCartridgeButton = document.getElementById('btn-close-cartridges');
const cartridgeList = cartridgeScreen.querySelector('.cartridge-list');
const cartridgeDots = cartridgeScreen.querySelector('.cartridge-dots');
const cartridgeArrows = cartridgeScreen.querySelectorAll('.cartridge-arrow');
const cartridgeCount = document.querySelector('#cartridge-title span');
const GB_CARTRIDGES = [
{ id: 'castlevania-2', number: '198号', title: '恶魔城传说2', system: 'gb', rom: './assets/roms/castlevania-2.gb', cover: './assets/cartridges/castlevania-2.webp' },
{ id: 'pokemon-gold', number: '908号', title: '宝可梦 金', system: 'gbc', rom: './assets/roms/pokemon-gold.gbc', cover: './assets/cartridges/pokemon-gold.webp' },
{ id: 'pokemon-silver', number: '909号', title: '宝可梦 银', system: 'gbc', rom: './assets/roms/pokemon-silver.gbc', cover: './assets/cartridges/pokemon-silver.webp' },
{ id: 'cyborg-kuro-chan-2', number: '1066号', title: '霹雳酷乐猫2', system: 'gbc', rom: './assets/roms/cyborg-kuro-chan-2.gbc', cover: './assets/cartridges/cyborg-kuro-chan-2.webp' },
{ id: 'pokemon-crystal', number: '1119号', title: '宝可梦 水晶', system: 'gbc', rom: './assets/roms/pokemon-crystal.gbc', cover: './assets/cartridges/pokemon-crystal.webp' }
];
let availableCartridges = [];
let cartridgeIndex = 0;
let switchingCartridge = false;
let cartridgeMemberAuthenticated = false;
let cartridgeMemberId = '';
let initialCartridgeResolved = false;
const lastCartridgeKey = 'ucg999-gb-last-cartridge';
const bootVideo = document.createElement('video');
const bootLayer = document.createElement('div');
bootLayer.id = 'gb-boot-layer';
bootVideo.id = 'gb-boot-video';
bootVideo.preload = 'metadata';
bootVideo.playsInline = true;
bootVideo.muted = false;
bootVideo.volume = 1;
bootVideo.setAttribute('playsinline', '');
bootVideo.setAttribute('webkit-playsinline', '');
bootLayer.appendChild(bootVideo);
document.body.appendChild(bootLayer);

function syncBootBackdropColor(system) {
const background = system === 'gb' ? '#fffbff' : '#f8f3f7';
bootLayer.style.backgroundColor = background;
bootVideo.style.backgroundColor = background;
}

function cartridgeMarkup(cartridge) {
const visual = cartridge.cover
? '<img alt="" src="' + cartridge.cover + '">'
: '<span class="gb-cartridge-shell"><strong>GAME BOY</strong><b>热斗96</b><small>格斗之王96</small></span>';
return '<figure class="cartridge-slide"><button class="cartridge-card" data-cartridge="' + cartridge.id + '" type="button"><span class="cartridge-number">' + cartridge.number + '</span>' + visual + '</button><figcaption>' + cartridge.title + '</figcaption></figure>';
}

function renderCartridges() {
cartridgeList.innerHTML = availableCartridges.map(cartridgeMarkup).join('');
cartridgeDots.innerHTML = availableCartridges.map(function (_, index) { return '<button class="' + (index === cartridgeIndex ? 'is-active' : '') + '" data-index="' + index + '" type="button" aria-label="第' + (index + 1) + '张卡带"></button>'; }).join('');
if (cartridgeCount) cartridgeCount.textContent = '（已收集' + availableCartridges.length + '款）';
cartridgeList.style.transform = 'translateX(-' + cartridgeIndex * 100 + '%)';
cartridgeArrows[0].disabled = availableCartridges.length < 2;
cartridgeArrows[1].disabled = availableCartridges.length < 2;
cartridgeList.querySelectorAll('[data-cartridge]').forEach(function (button) {
button.addEventListener('click', function () { void switchCartridge(button.dataset.cartridge, button); });
});
cartridgeDots.querySelectorAll('[data-index]').forEach(function (button) {
button.addEventListener('click', function () { cartridgeIndex = Number(button.dataset.index) || 0; renderCartridges(); });
});
}

async function loadOwnedCartridges() {
let owned = [];
try {
const response = await fetch('/api/gb-cartridges', { credentials: 'same-origin', cache: 'no-store' });
const result = response.ok ? await response.json() : null;
if (result && result.authenticated) {
cartridgeMemberAuthenticated = true;
cartridgeMemberId = typeof result.memberId === 'string' ? result.memberId : '';
owned = Array.isArray(result.owned) ? result.owned : [];
}
else owned = [];
} catch (error) {
owned = [];
}
if (isLocalDevelopment) owned = GB_CARTRIDGES.map(function (cartridge) { return cartridge.id; });
const allowed = new Set(owned);
availableCartridges = GB_CARTRIDGES.filter(function (cartridge) { return allowed.has(cartridge.id); });
const requested = new URLSearchParams(location.search).get('cartridge');
const requestedIndex = availableCartridges.findIndex(function (cartridge) { return cartridge.id === requested; });
cartridgeIndex = requestedIndex >= 0 ? requestedIndex : 0;
renderCartridges();
if (!initialCartridgeResolved) {
initialCartridgeResolved = true;
const requestedCartridge = requestedIndex >= 0 ? availableCartridges[requestedIndex] : null;
if (requestedCartridge) window.setTimeout(function () { void switchCartridge(requestedCartridge.id); }, 250);
}
}

function bytesToBase64(bytes) {
let binary = '';
for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
return btoa(binary);
}

async function loadCartridgeRom(cartridge) {
if (!cartridge.rom) return window.ROM_DATA;
const response = await fetch(cartridge.rom, { cache: 'force-cache' });
if (!response.ok) throw new Error('ROM ' + response.status);
return bytesToBase64(new Uint8Array(await response.arrayBuffer()));
}

function syncBootVideoBounds() {
if (!hitboxes.game) return;
const canvasRect = mainCanvas.getBoundingClientRect();
const scaleX = canvasRect.width / mainCanvas.width;
const scaleY = canvasRect.height / mainCanvas.height;
bootLayer.style.left = Math.round(canvasRect.left + hitboxes.game.x * scaleX) + 'px';
bootLayer.style.top = Math.round(canvasRect.top + hitboxes.game.y * scaleY) + 'px';
bootLayer.style.width = Math.round(hitboxes.game.w * scaleX) + 'px';
bootLayer.style.height = Math.round(hitboxes.game.h * scaleY) + 'px';
}

function playBootVideo(system) {
return new Promise(function (resolve) {
let finished = false;
const source = system === 'gb' ? './assets/gb-boot.mp4' : './assets/gbc-boot.mp4';
const finish = function () { if (finished) return; finished = true; clearTimeout(fallback); bootVideo.onended = null; bootVideo.onerror = null; bootLayer.classList.remove('is-playing'); resolve(); };
const start = function () {
if (finished) return;
syncBootBackdropColor(system);
syncBootVideoBounds();
bootVideo.currentTime = 0;
bootLayer.classList.add('is-playing');
bootVideo.onended = finish;
bootVideo.onerror = finish;
bootVideo.play().catch(finish);
};
const fallback = setTimeout(finish, 7000);
if (bootVideo.getAttribute('src') !== source) {
bootVideo.setAttribute('src', source);
bootVideo.load();
}
if (bootVideo.readyState >= 2) start();
else bootVideo.addEventListener('loadeddata', start, { once: true });
});
}

async function switchCartridge(cartridgeId, button) {
if (switchingCartridge) return;
const cartridge = availableCartridges.find(function (item) { return item.id === cartridgeId; });
if (!cartridge) return;
switchingCartridge = true;
if (button) button.classList.add('is-inserting');
showToast('正在插入《' + cartridge.title + '》');
try {
const romPromise = loadCartridgeRom(cartridge);
setCartridgeScreen(false);
if (core.setPaused) core.setPaused(true);
await playBootVideo(cartridge.system);
const rom = await romPromise;
core.boot(rom, { gameId: cartridge.id, toast: showToast, onReady: function () { renderUI(); startRenderLoop(); } });
applyStoredCheats(cartridge.id);
try { localStorage.setItem(lastCartridgeKey + (cartridgeMemberId ? ':' + cartridgeMemberId : ''), cartridge.id); } catch (storageError) {}
showToast('《' + cartridge.title + '》已启动');
} catch (error) {
showToast('卡带读取失败');
console.error(error);
} finally {
if (button) button.classList.remove('is-inserting');
switchingCartridge = false;
}
}
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
window.addEventListener('resize', syncBootVideoBounds);
async function canOpenCartridgeScreen() {
if (isLocalDevelopment) { await loadOwnedCartridges(); return true; }
if (cartridgeMemberAuthenticated) return true;
try {
const response = await fetch('/api/member', { credentials: 'same-origin', cache: 'no-store' });
if (response.ok) {
const data = await response.json();
if (data && data.member) { cartridgeMemberAuthenticated = true; await loadOwnedCartridges(); return true; }
}
} catch (error) {
console.warn('Unable to verify player account', error);
}
showToast('请先登录玩家账号后换卡带');
if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'gb-member-login-request' }, window.location.origin);
return false;
}
document.getElementById('btn-shot').addEventListener('click', async event => {
event.stopImmediatePropagation();
if (await canOpenCartridgeScreen()) setCartridgeScreen(true);
}, true);
closeCartridgeButton.addEventListener('click', () => setCartridgeScreen(false));
cartridgeArrows[0].addEventListener('click', function () {
if (availableCartridges.length < 2) return;
cartridgeIndex = (cartridgeIndex - 1 + availableCartridges.length) % availableCartridges.length;
renderCartridges();
});
cartridgeArrows[1].addEventListener('click', function () {
if (availableCartridges.length < 2) return;
cartridgeIndex = (cartridgeIndex + 1) % availableCartridges.length;
renderCartridges();
});
renderCartridges();
void loadOwnedCartridges();
async function sharePage() {
const shareUrl = window.parent && window.parent !== window ? window.parent.location.origin + '/gb' : window.location.href;
const shareData = { title: CONFIG.shareTitle || CONFIG.title, text: CONFIG.shareContent || '', url: shareUrl };
if (navigator.share) {
try { await navigator.share(shareData); return; } catch (error) { if (error && error.name === 'AbortError') return; }
}
try { await navigator.clipboard.writeText(shareUrl); showToast('页面链接已复制'); }
catch (error) { showToast('请复制浏览器地址分享'); }
}
document.getElementById('btn-record').addEventListener('click', () => setUtilityMenu(true));
utilityMenu.querySelector('#menu-close').addEventListener('click', () => setUtilityMenu(false));
utilityMenu.querySelector('#menu-load').addEventListener('click', () => { try { core.loadState({ userInitiated: true }); setUtilityMenu(false); } catch (e) { showToast('读档失败'); console.error(e); } });
utilityMenu.querySelector('#menu-sound').addEventListener('click', function (event) { soundEnabled = !soundEnabled; if (core.setMuted) core.setMuted(!soundEnabled); event.currentTarget.textContent = '声音（' + (soundEnabled ? '开' : '关') + '）'; });
utilityMenu.querySelector('#menu-ab').addEventListener('click', function (event) { showAbButton = !showAbButton; event.currentTarget.textContent = 'AB按键（' + (showAbButton ? '开' : '关') + '）'; renderUI(); });
utilityMenu.querySelector('#menu-rapid').addEventListener('click', function (event) { rapidFireEnabled = !rapidFireEnabled; if (!rapidFireEnabled) ['a', 'b'].forEach(function (button) { try { core.setButton(button, uiState[button]); } catch (error) {} }); event.currentTarget.textContent = '长按连击（' + (rapidFireEnabled ? '开' : '关') + '）'; });
filterMenuButton.addEventListener('click', function () { videoFilterEnabled = !videoFilterEnabled; filterMenuButton.textContent = '滤镜（' + (videoFilterEnabled ? '开' : '关') + '）'; renderUI(); });
utilityMenu.querySelector('#menu-share').addEventListener('click', async () => { await sharePage(); setUtilityMenu(false); });
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
if (typeof window.ROM_DATA !== 'string' || window.ROM_DATA.length === 0) {
alert('ROM_DATA 缺失或为空,请用 build_rom.js 重新打包');
return;
}
resize();
bindControls();
core.boot(window.ROM_DATA, {
gameId: 'kof-96',
toast: showToast,
onReady: function () {
renderUI();
startRenderLoop();
}
});
applyStoredCheats('kof-96');
})();

document.addEventListener('contextmenu', event => {
if (event.target instanceof Element && event.target.closest('img,video,audio,canvas,svg')) event.preventDefault();
}, true);
document.addEventListener('dragstart', event => {
if (event.target instanceof Element && event.target.closest('img,video,audio,canvas,svg')) event.preventDefault();
}, true);
window.addEventListener('keydown', event => {
if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') event.preventDefault();
}, true);
