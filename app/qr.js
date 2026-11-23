/*! MoneyCode (موني كود) — Sovereign Financial Intelligence | Copyright (c) 2026 طه الدقيل (Taha Al-Dogail). All Rights Reserved. | com.moneycode.sovereign | Ed25519: CF48395FC0FE136D */
(function (root) {
'use strict';
var BLOCKS_M = [null,
[1, 26, 16], [1, 44, 28], [1, 70, 44], [2, 50, 32], [2, 67, 43],
[4, 43, 27], [4, 49, 31], [2, 60, 38, 2, 61, 39], [3, 58, 36, 2, 59, 37], [4, 69, 43, 1, 70, 44],
[1, 80, 50, 4, 81, 51], [6, 58, 36, 2, 59, 37], [8, 59, 37, 1, 60, 38], [4, 64, 40, 5, 65, 41], [5, 65, 41, 5, 66, 42],
[7, 73, 45, 3, 74, 46], [10, 74, 46, 1, 75, 47], [9, 69, 43, 4, 70, 44], [3, 70, 44, 11, 71, 45], [3, 67, 41, 13, 68, 42],
[17, 68, 42], [17, 74, 46], [4, 75, 47, 14, 76, 48], [6, 73, 45, 14, 74, 46], [8, 75, 47, 13, 76, 48]
];
var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
[6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62],
[6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
[6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110]];
var MAX_VERSION = 25;
var LEVEL_M = 0; // the two error-correction bits of the format information for level M
function blocksOf(version) {
var t = BLOCKS_M[version], out = [];
for (var i = 0; i < t.length; i += 3) for (var k = 0; k < t[i]; k++) out.push({ total: t[i + 1], data: t[i + 2] });
return out;
}
function dataCodewords(version) { return blocksOf(version).reduce(function (s, b) { return s + b.data; }, 0); }
function countBits(version) { return version < 10 ? 8 : 16; }
function byteCapacity(version) { return Math.floor((dataCodewords(version) * 8 - 4 - countBits(version)) / 8); }
function utf8Bytes(text) { return Array.prototype.slice.call(new TextEncoder().encode(String(text))); }
function gfMul(x, y) {
var z = 0;
for (var i = 7; i >= 0; i--) {
z = (z << 1) ^ ((z >>> 7) * 0x11D);
z ^= ((y >>> i) & 1) * x;
}
return z;
}
function rsDivisor(degree) {
var result = [];
for (var i = 0; i < degree - 1; i++) result.push(0);
result.push(1);
var rootVal = 1;
for (var k = 0; k < degree; k++) {
for (var j = 0; j < result.length; j++) {
result[j] = gfMul(result[j], rootVal);
if (j + 1 < result.length) result[j] ^= result[j + 1];
}
rootVal = gfMul(rootVal, 0x02);
}
return result;
}
function rsRemainder(data, divisor) {
var result = divisor.map(function () { return 0; });
data.forEach(function (b) {
var factor = b ^ result.shift();
result.push(0);
divisor.forEach(function (coef, i) { result[i] ^= gfMul(coef, factor); });
});
return result;
}
function encodeData(bytes, version) {
var cap = dataCodewords(version);
var bits = [];
function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
put(4, 4); // byte mode
put(bytes.length, countBits(version));
bytes.forEach(function (b) { put(b, 8); });
put(0, Math.min(4, cap * 8 - bits.length)); // terminator
while (bits.length % 8) bits.push(0);
var out = [];
for (var j = 0; j < bits.length; j += 8) {
var v = 0;
for (var k = 0; k < 8; k++) v = (v << 1) | bits[j + k];
out.push(v);
}
for (var p = 0; out.length < cap; p++) out.push(p % 2 ? 0x11 : 0xEC); // pad bytes
return out;
}
function codewords(data, version) {
var blocks = blocksOf(version), pos = 0, dataBlocks = [], eccBlocks = [];
blocks.forEach(function (b) {
var d = data.slice(pos, pos + b.data);
pos += b.data;
dataBlocks.push(d);
eccBlocks.push(rsRemainder(d, rsDivisor(b.total - b.data)));
});
var out = [];
var maxData = Math.max.apply(null, dataBlocks.map(function (d) { return d.length; }));
var maxEcc = Math.max.apply(null, eccBlocks.map(function (e) { return e.length; }));
for (var i = 0; i < maxData; i++) dataBlocks.forEach(function (d) { if (i < d.length) out.push(d[i]); });
for (var j = 0; j < maxEcc; j++) eccBlocks.forEach(function (e) { if (j < e.length) out.push(e[j]); });
return out;
}
function grid(version) {
var n = version * 4 + 17, m = [], fn = [];
for (var r = 0; r < n; r++) {
m.push(new Array(n).fill(0));
fn.push(new Array(n).fill(false));
}
return { n: n, m: m, fn: fn };
}
function setFn(q, r, c, dark) { q.m[r][c] = dark ? 1 : 0; q.fn[r][c] = true; }
function drawFinder(q, cr, cc) {
for (var dr = -4; dr <= 4; dr++) {
for (var dc = -4; dc <= 4; dc++) {
var r = cr + dr, c = cc + dc;
if (r < 0 || c < 0 || r >= q.n || c >= q.n) continue;
var d = Math.max(Math.abs(dr), Math.abs(dc));
setFn(q, r, c, d !== 2 && d !== 4);
}
}
}
function drawAlignment(q, cr, cc) {
for (var dr = -2; dr <= 2; dr++) {
for (var dc = -2; dc <= 2; dc++) setFn(q, cr + dr, cc + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
}
}
function drawFormat(q, mask) {
var data = (LEVEL_M << 3) | mask;
var rem = data;
for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
var bits = ((data << 10) | rem) ^ 0x5412;
var n = q.n;
function bit(k) { return ((bits >>> k) & 1) === 1; }
for (var a = 0; a <= 5; a++) setFn(q, a, 8, bit(a));
setFn(q, 7, 8, bit(6));
setFn(q, 8, 8, bit(7));
setFn(q, 8, 7, bit(8));
for (var b = 9; b < 15; b++) setFn(q, 8, 14 - b, bit(b));
for (var c = 0; c < 8; c++) setFn(q, 8, n - 1 - c, bit(c));
for (var d = 8; d < 15; d++) setFn(q, n - 15 + d, 8, bit(d));
setFn(q, n - 8, 8, true);
}
function drawVersion(q, version) {
if (version < 7) return;
var rem = version;
for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
var bits = (version << 12) | rem;
for (var k = 0; k < 18; k++) {
var dark = ((bits >>> k) & 1) === 1;
var a = q.n - 11 + (k % 3), b = Math.floor(k / 3);
setFn(q, b, a, dark);
setFn(q, a, b, dark);
}
}
function drawFunctionPatterns(q, version) {
var n = q.n;
for (var i = 0; i < n; i++) {
setFn(q, 6, i, i % 2 === 0);
setFn(q, i, 6, i % 2 === 0);
}
drawFinder(q, 3, 3);
drawFinder(q, 3, n - 4);
drawFinder(q, n - 4, 3);
var a = ALIGN[version], last = a.length - 1;
for (var x = 0; x < a.length; x++) {
for (var y = 0; y < a.length; y++) {
if ((x === 0 && y === 0) || (x === 0 && y === last) || (x === last && y === 0)) continue;
drawAlignment(q, a[x], a[y]);
}
}
drawFormat(q, 0); // reserves the format areas; the real bits are drawn after masking
drawVersion(q, version);
}
function drawCodewords(q, data) {
var n = q.n, i = 0, total = data.length * 8;
for (var right = n - 1; right >= 1; right -= 2) {
if (right === 6) right = 5;
var upward = ((right + 1) & 2) === 0;
for (var vert = 0; vert < n; vert++) {
var r = upward ? n - 1 - vert : vert;
for (var j = 0; j < 2; j++) {
var c = right - j;
if (q.fn[r][c]) continue;
if (i < total) { q.m[r][c] = (data[i >>> 3] >>> (7 - (i & 7))) & 1; i++; }
}
}
}
}
function maskHit(mask, r, c) {
switch (mask) {
case 0: return (r + c) % 2 === 0;
case 1: return r % 2 === 0;
case 2: return c % 3 === 0;
case 3: return (r + c) % 3 === 0;
case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
case 5: return (r * c) % 2 + (r * c) % 3 === 0;
case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
default: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
}
}
function applyMask(q, mask) {
for (var r = 0; r < q.n; r++) {
for (var c = 0; c < q.n; c++) if (!q.fn[r][c] && maskHit(mask, r, c)) q.m[r][c] ^= 1;
}
}
function penalty(q) {
var n = q.n, m = q.m, score = 0, dark = 0;
var finderA = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], finderB = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
function lineScore(get) {
var s = 0, run = 1;
for (var i = 1; i <= n; i++) {
if (i < n && get(i) === get(i - 1)) { run++; continue; }
if (run >= 5) s += 3 + run - 5;
run = 1;
}
for (var k = 0; k + 11 <= n; k++) {
var hitA = true, hitB = true;
for (var t = 0; t < 11; t++) {
if (get(k + t) !== finderA[t]) hitA = false;
if (get(k + t) !== finderB[t]) hitB = false;
}
if (hitA) s += 40;
if (hitB) s += 40;
}
return s;
}
for (var r = 0; r < n; r++) {
score += lineScore(function (i) { return m[r][i]; });
score += lineScore(function (i) { return m[i][r]; });
}
for (var y = 0; y < n - 1; y++) {
for (var x = 0; x < n - 1; x++) {
var v = m[y][x];
if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) score += 3;
}
}
for (var a = 0; a < n; a++) for (var b = 0; b < n; b++) dark += m[a][b];
var total = n * n;
score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
return score;
}
function make(text, opts) {
opts = opts || {};
var bytes = utf8Bytes(text);
var version = 0;
for (var v = opts.minVersion || 1; v <= MAX_VERSION; v++) {
if (bytes.length <= byteCapacity(v)) { version = v; break; }
}
if (!version) throw new Error('النص أطول من أن يتسع له رمز QR');
var cw = codewords(encodeData(bytes, version), version);
var masks = (opts.mask >= 0 && opts.mask <= 7) ? [opts.mask] : [0, 1, 2, 3, 4, 5, 6, 7];
var best = null;
masks.forEach(function (mask) {
var q = grid(version);
drawFunctionPatterns(q, version);
drawCodewords(q, cw);
applyMask(q, mask);
drawFormat(q, mask);
var score = masks.length > 1 ? penalty(q) : 0;
if (!best || score < best.score) best = { q: q, mask: mask, score: score };
});
return { version: version, size: best.q.n, mask: best.mask, modules: best.q.m };
}
function escAttr(s) {
return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function toSvg(text, opts) {
opts = opts || {};
var qr = make(text, opts);
var quiet = 4, n = qr.size, total = n + quiet * 2, d = '';
for (var r = 0; r < n; r++) {
var c = 0;
while (c < n) {
if (!qr.modules[r][c]) { c++; continue; }
var start = c;
while (c < n && qr.modules[r][c]) c++;
d += 'M' + (start + quiet) + ' ' + (r + quiet) + 'h' + (c - start) + 'v1h-' + (c - start) + 'z';
}
}
return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" role="img" aria-label="' +
escAttr(opts.label || 'رمز QR') + '" shape-rendering="crispEdges"' + (opts.style ? ' style="' + escAttr(opts.style) + '"' : '') + '>' +
'<rect width="' + total + '" height="' + total + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}
var api = { MAX_VERSION: MAX_VERSION, byteCapacity: byteCapacity, make: make, toSvg: toSvg };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.RohQR = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
