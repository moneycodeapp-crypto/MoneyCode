/*! MoneyCode (موني كود) — Sovereign Financial Intelligence | Copyright (c) 2026 طه الدقيل (Taha Al-Dogail). All Rights Reserved. | com.moneycode.sovereign | Ed25519: CF48395FC0FE136D */
/*! MoneyCode (موني كود) pairing engine (phase 1)
* Copyright (c) 2026 طه الدقيل (Taha Al-Dogail). All Rights Reserved. | com.moneycode.sovereign
* Two people pair their phones and compare what is between
* them. Each book has an account for the other person, tagged with that person's device code
* (`deviceCode` on the account). Only that account's entries leave the phone, they are matched as
* mirror images (my loan to you is your debt to me), and only what the owner accepted is applied,
* through the engine, as the mirrored entry. Pure logic: the UI lives in app.js.
* Keys exist only in memory and are wiped when the session closes (5 idle minutes or on demand).
* Node tests: require('./pairing-engine.js') and call setEngine(E) first. */
(function (root) {
'use strict';
var IDLE_MS = 5 * 60 * 1000;
var RESULT_MS = 7 * 24 * 60 * 60 * 1000;
var RESULTS_KEY = 'rohapp.pairing.results';
var RECEIVED_KEY = 'rohapp.pairing.received';
var FORMAT = 'moneycode-pairing';
var HELLO_PREFIX = 'MC1:';
var KIND_NAMES = { expense: 'مصروف', income: 'دخل', transfer: 'تحويل', capital: 'رأس مال', lend: 'إقراض', borrow: 'اقتراض', collect: 'تحصيل', repay: 'سداد', exchange: 'صرف عملة', compound: 'قيد مركب' };
var MIRROR = { lend: 'borrow', borrow: 'lend', collect: 'repay', repay: 'collect' };
var SIDE = { lend: 'D', repay: 'D', borrow: 'C', collect: 'C' };
var engine = null;
var clockFn = function () { return Date.now(); };
function eng() { return engine || (root && root.RohEngine) || null; }
function now() { return clockFn(); }
function subtle() { return (typeof crypto !== 'undefined' && crypto.subtle) ? crypto.subtle : null; }
function fail(message) { return { ok: false, error: message }; }
function flip(dir) { return dir === 'D' ? 'C' : 'D'; }
function plainCode(code) { return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function utf8(s) { return new TextEncoder().encode(String(s)); }
function unutf8(b) { return new TextDecoder().decode(b); }
function toB64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); }
function fromB64(text) { var s = atob(String(text)); var out = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
function toHex(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += ('0' + bytes[i].toString(16)).slice(-2); return s; }
function wipe(bytes) { if (bytes && bytes.fill) bytes.fill(0); }
function closeSession(s) {
if (!s) return;
s.state = 'closed';
s.keys = null;
s.sessionKey = null;
s.confirmed = false;
s.code = null;
}
function liveSession(s) {
if (!s || s.state !== 'open') return fail('الجلسة مغلقة. ابدأ اقتراناً جديداً.');
if (now() - s.lastActive > IDLE_MS) {
closeSession(s);
return fail('انتهت الجلسة بعد 5 دقائق بلا نشاط. ابدأ اقتراناً جديداً.');
}
s.lastActive = now();
return { ok: true };
}
function isOpen(s) {
return !!s && s.state === 'open' && now() - s.lastActive <= IDLE_MS;
}
function peerAccounts(E, deviceCode) {
var want = plainCode(deviceCode);
if (!want) return [];
return (E.getState().accounts || []).filter(function (a) { return a && plainCode(a.deviceCode) === want; });
}
async function begin() {
var E = eng();
if (!E) return fail('المحرك غير جاهز');
if (!E.isActivated()) return fail('الاقتران يحتاج تفعيل التطبيق على الجهازين أولاً.');
var c = subtle();
if (!c) return fail('التشفير غير متاح على هذا الجهاز');
var pair = await c.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
var pubRaw = new Uint8Array(await c.exportKey('raw', pair.publicKey));
var s = {
id: null, state: 'open', createdAt: now(), lastActive: now(),
keys: { privateKey: pair.privateKey, pub: pubRaw },
sessionKey: null, peer: null, account: null, code: null, confirmed: false,
deviceCode: String(E.deviceCode()), baseCurrency: E.BASE
};
var hello = { app: FORMAT, v: 1, type: 'hello', pub: toB64(pubRaw), deviceCode: s.deviceCode, baseCurrency: s.baseCurrency, activation: String(E.activationCodeHere ? E.activationCodeHere() : '') };
return { ok: true, session: s, hello: HELLO_PREFIX + toB64(utf8(JSON.stringify(hello))) };
}
function parseHello(text) {
var t = String(text || '').trim();
if (t.indexOf(HELLO_PREFIX) !== 0) return null;
var o;
try { o = JSON.parse(unutf8(fromB64(t.slice(HELLO_PREFIX.length)))); } catch (e) { return null; }
if (!o || o.app !== FORMAT || o.type !== 'hello' || o.v !== 1) return null;
if (typeof o.pub !== 'string' || typeof o.deviceCode !== 'string' || typeof o.baseCurrency !== 'string') return null;
if (o.activation !== undefined && typeof o.activation !== 'string') return null;
return o;
}
async function join(session, helloText) {
var live = liveSession(session);
if (!live.ok) return live;
if (session.peer) return fail('هذه الجلسة مرتبطة بجهاز آخر بالفعل.');
var peer = parseHello(helloText);
if (!peer) return fail('رسالة الاقتران غير صالحة. انسخ رسالة الطرف الآخر كاملة.');
var E = eng();
var proven = !!(peer.activation && E && typeof E.activationValidFor === 'function' && E.activationValidFor(peer.deviceCode, peer.activation));
if (!proven) return fail('الجهاز الآخر غير مفعّل، أو رمز تفعيله لا يطابق رمز جهازه.');
if (peer.baseCurrency !== session.baseCurrency) return fail('العملة الأساسية مختلفة (' + peer.baseCurrency + ' عند الطرف الآخر و' + session.baseCurrency + ' عندك).');
if (plainCode(peer.deviceCode) === plainCode(session.deviceCode)) return fail('الجهازان يحملان رمز الجهاز نفسه، فالدفتران ليسا لطرفين مختلفين.');
var mine = peerAccounts(E, peer.deviceCode);
if (!mine.length) return fail('لا يوجد في دفترك حساب يحمل رمز جهاز الطرف الآخر (' + peer.deviceCode + '). أضف رمز جهازه إلى حسابه في شاشة الحسابات، ثم أعد الاقتران.');
if (mine.length > 1) return fail('رمز جهاز الطرف الآخر موجود في أكثر من حساب: ' + mine.map(function (a) { return a.name; }).join('، ') + '. اتركه في حساب واحد ثم أعد الاقتران.');
var peerRaw = fromB64(peer.pub);
if (peerRaw.length !== 65 || peerRaw[0] !== 4) return fail('المفتاح العام للطرف الآخر غير صالح.');
var c = subtle();
var peerKey = await c.importKey('raw', peerRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
var shared = new Uint8Array(await c.deriveBits({ name: 'ECDH', public: peerKey }, session.keys.privateKey, 256));
var pubs = [toHex(session.keys.pub), toHex(peerRaw)].sort();
var salt = utf8(pubs.join('|'));
var hk = await c.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
var codeBits = new Uint8Array(await c.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: utf8('moneycode-pair-code') }, hk, 256));
var n = ((codeBits[0] << 24) >>> 0) + (codeBits[1] << 16) + (codeBits[2] << 8) + codeBits[3];
var keyBits = new Uint8Array(await c.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: utf8('moneycode-pair-key') }, hk, 256));
session.sessionKey = await c.importKey('raw', keyBits, 'AES-GCM', false, ['encrypt', 'decrypt']);
var idBits = new Uint8Array(await c.digest('SHA-256', salt));
session.id = toHex(idBits).slice(0, 16);
session.code = ('00000' + (n % 1000000)).slice(-6);
session.peer = { pub: peer.pub, deviceCode: peer.deviceCode, baseCurrency: peer.baseCurrency };
session.account = { id: mine[0].id, name: mine[0].name };
wipe(shared); wipe(keyBits); wipe(codeBits);
session.keys = null; // the private key is no longer needed
return { ok: true, code: session.code, peer: { deviceCode: session.peer.deviceCode, baseCurrency: session.peer.baseCurrency }, account: { id: session.account.id, name: session.account.name } };
}
function confirm(session) {
var live = liveSession(session);
if (!live.ok) return live;
if (!session.peer) return fail('اقرأ رسالة الطرف الآخر أولاً.');
session.confirmed = true;
return { ok: true, code: session.code };
}
function close(session) { closeSession(session); return { ok: true }; }
function sharedEntries(E, accountId) {
var out = [];
(E.getState().entries || []).forEach(function (e) {
var d = 0, c = 0, nd = 0, nc = 0, cur = null;
(e.lines || []).forEach(function (l) {
if (l.accountId !== accountId) return;
d += Math.round(Number(l.debitBase) || 0);
c += Math.round(Number(l.creditBase) || 0);
nd += Number(l.debit) || 0;
nc += Number(l.credit) || 0;
if (!cur) cur = l.currency || E.BASE;
});
if (d === c) return;
cur = cur || E.BASE;
var amount = Math.round(Math.abs(nd - nc));
if (!amount && cur === E.BASE) amount = Math.abs(d - c);
out.push({ date: e.date, kind: e.kind, memo: e.memo || '', currency: cur, dir: d > c ? 'D' : 'C', amount: amount, amountBase: Math.abs(d - c) });
});
return out;
}
function validShared(e) {
return !!e && typeof e.date === 'string' && typeof e.kind === 'string' && (e.dir === 'D' || e.dir === 'C') &&
typeof e.currency === 'string' && Number.isInteger(e.amount) && e.amount > 0 &&
Number.isInteger(e.amountBase) && e.amountBase > 0 && (e.memo === undefined || typeof e.memo === 'string');
}
function sharedKey(e, mirrored) {
return [e.date, mirrored ? flip(e.dir) : e.dir, e.currency, Math.round(Number(e.amount) || 0)].join('\u001f');
}
function digestOf(entries) {
var s = entries.map(function (e) { return sharedKey(e, false) + '\u001f' + e.kind; }).sort().join('\n');
var h = 0x811c9dc5;
for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
return ('00000000' + (h >>> 0).toString(16)).slice(-8) + ':' + entries.length;
}
function normText(s) {
return String(s == null ? '' : s)
.normalize('NFC')
.replace(/[ً-ٰٟـ]/g, '')
.replace(/[إأآ]/g, 'ا')
.toLowerCase()
.replace(/\s+/g, ' ')
.trim();
}
function mirrorKind(kind) { return MIRROR[kind] || null; }
function canMirror(e, base) {
var k = MIRROR[e && e.kind];
return !!k && e.currency === base && SIDE[k] === flip(e.dir);
}
async function seal(session, body) {
var live = liveSession(session);
if (!live.ok) return live;
if (!session.confirmed) return fail('أكّد رمز الاقتران على الجهازين أولاً.');
var iv = crypto.getRandomValues(new Uint8Array(12));
var ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: iv }, session.sessionKey, utf8(JSON.stringify(body))));
return { ok: true, text: JSON.stringify({ format: FORMAT, v: 1, pairId: session.id, iv: toB64(iv), ct: toB64(ct) }) };
}
async function exportBook(session) {
var live = liveSession(session);
if (!live.ok) return live;
var E = eng();
if (!session.account || !E || !E.getAccount(session.account.id)) return fail('حساب الطرف الآخر غير موجود في دفترك.');
var entries = sharedEntries(E, session.account.id);
var peerSummary = null;
if (session.shareSummary !== false && typeof E.computeAnalysis === 'function') {
try {
var an = E.computeAnalysis();
peerSummary = {
entryCount: Number(an.entryCount) || 0,
balanced: !!(an.totals && an.totals.imbalance === 0),
runwayDays: an.runwayDays === null ? null : (Number(an.runwayDays) || 0)
};
} catch (e) {}
}
return seal(session, {
deviceCode: session.deviceCode,
peerDeviceCode: session.peer.deviceCode,
baseCurrency: session.baseCurrency,
exportedAt: new Date(now()).toISOString(),
digest: digestOf(entries),
peerSummary: peerSummary,
entries: entries
});
}
async function exportResults(session, saved) {
var live = liveSession(session);
if (!live.ok) return live;
if (!session.confirmed) return fail('أكّد رمز الاقتران أولاً.');
if (!saved || !Array.isArray(saved.items)) return fail('لا نتائج محفوظة لإرسالها.');
if (saved.peerDeviceCode !== session.peer.deviceCode) return fail('هذه النتائج تخص جهازاً آخر (' + saved.peerDeviceCode + ').');
if (now() - saved.savedAt > RESULT_MS) return fail('انتهت مدة النتائج المحفوظة (7 أيام).');
return seal(session, {
type: 'results',
pairId: session.id,
deviceCode: session.deviceCode,
baseCurrency: session.baseCurrency,
exportedAt: new Date(now()).toISOString(),
savedAt: saved.savedAt,
peerDeviceCode: saved.peerDeviceCode,
items: saved.items.filter(function (x) { return x.side === 'remote'; }).map(function (x) {
return { key: x.key, group: x.group, decision: x.decision === undefined ? null : x.decision, applied: !!x.applied };
})
});
}
async function openFile(session, text) {
var live = liveSession(session);
if (!live.ok) return live;
if (!session.confirmed) return fail('أكّد رمز الاقتران أولاً.');
var file;
try { file = JSON.parse(String(text)); } catch (e) { return fail('الملف ليس ملف اقتران صالحاً.'); }
if (!file || file.format !== FORMAT || file.v !== 1) return fail('الملف ليس ملف اقتران صالحاً.');
if (file.pairId !== session.id) return fail('الملف يخص جلسة اقتران أخرى.');
var plain;
try {
plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(file.iv) }, session.sessionKey, fromB64(file.ct));
} catch (e) {
return fail('لا يفكّ هذا الملف تشفيره بمفتاح هذه الجلسة.');
}
var body;
try { body = JSON.parse(unutf8(plain)); } catch (e) { return fail('محتوى الملف تالف.'); }
if (!body || body.deviceCode !== session.peer.deviceCode) return fail('الملف ليس من الدفتر المقترن بهذه الجلسة.');
if (body.baseCurrency !== session.baseCurrency) return fail('العملة الأساسية في الملف مختلفة.');
return { ok: true, body: body };
}
async function importBook(session, text) {
var r = await openFile(session, text);
if (!r.ok) return r;
if (r.body.type === 'results') return { ok: false, isResults: true, error: 'هذا ملف نتائج مطابقة، لا ملف قيود.' };
if (r.body.peerDeviceCode !== session.deviceCode) return fail('الملف أُعدّ لجهاز آخر، لا لهذا الجهاز.');
if (!Array.isArray(r.body.entries) || !r.body.entries.every(validShared)) return fail('قيود الملف غير مكتملة.');
return { ok: true, body: r.body };
}
function validResultItem(x) {
return !!x && typeof x.key === 'string' && typeof x.group === 'string' &&
(x.decision === null || x.decision === 'accept' || x.decision === 'reject') && typeof x.applied === 'boolean';
}
function resultsSummary(body) {
var s = { total: body.items.length, accepted: 0, rejected: 0, notReviewed: 0, applied: 0 };
body.items.forEach(function (x) {
if (x.decision === 'accept') s.accepted++;
else if (x.decision === 'reject') s.rejected++;
else s.notReviewed++;
if (x.applied) s.applied++;
});
return s;
}
async function importResults(session, text) {
var r = await openFile(session, text);
if (!r.ok) return r;
if (r.body.type !== 'results' || r.body.pairId !== session.id) return fail('الملف ليس ملف نتائج لهذه الجلسة.');
if (r.body.peerDeviceCode !== session.deviceCode) return fail('هذه النتائج تخص جهازاً آخر.');
if (!Array.isArray(r.body.items) || !r.body.items.every(validResultItem)) return fail('نتائج الملف غير مكتملة.');
return { ok: true, body: r.body, summary: resultsSummary(r.body) };
}
function matchBooks(local, remote) {
var groups = {};
local.forEach(function (e, i) { var k = sharedKey(e, false); (groups[k] = groups[k] || { l: [], r: [] }).l.push(i); });
remote.forEach(function (e, i) { var k = sharedKey(e, true); (groups[k] = groups[k] || { l: [], r: [] }).r.push(i); });
var items = [];
Object.keys(groups).sort().forEach(function (k) {
var g = groups[k];
var lc = g.l.length, rc = g.r.length;
var paired = Math.min(lc, rc);
var choice = lc === rc && lc > 1;
var diff = Math.abs(lc - rc);
for (var i = 0; i < rc; i++) {
var re = remote[g.r[i]];
var it;
if (i < paired) {
it = makeItem('r' + g.r[i], 'remote', re, k, choice ? 'choice' : 'shared', 'matched', diff);
var le = local[g.l[i]];
it.localKind = le.kind;
it.kindDiffers = MIRROR[re.kind] ? MIRROR[re.kind] !== le.kind : false;
} else if (lc === 0) {
it = makeItem('r' + g.r[i], 'remote', re, k, 'onlyRemote', 'notReviewed', 0);
} else {
it = makeItem('r' + g.r[i], 'remote', re, k, 'countExtra', 'notReviewed', diff);
}
items.push(it);
}
for (var j = paired; j < lc; j++) {
items.push(makeItem('l' + g.l[j], 'local', local[g.l[j]], k, rc === 0 ? 'onlyLocal' : 'countExtra', 'notMatched', diff));
}
});
return {
items: items,
counts: {
matched: items.filter(function (x) { return x.state === 'matched' && x.side === 'remote'; }).length,
choices: items.filter(function (x) { return x.group === 'choice'; }).length,
onlyRemote: items.filter(function (x) { return x.group === 'onlyRemote'; }).length,
onlyLocal: items.filter(function (x) { return x.group === 'onlyLocal'; }).length,
countDiffs: items.filter(function (x) { return x.group === 'countExtra'; }).length,
kindDiffs: items.filter(function (x) { return x.kindDiffers; }).length
}
};
}
function makeItem(id, side, entry, key, group, state, diff) {
return { id: id, side: side, entry: entry, key: key, group: group, state: state, decision: null, diff: diff || 0, applied: false };
}
function setDecision(review, id, decision) {
var it = review.items.filter(function (x) { return x.id === id; })[0];
if (!it || it.side !== 'remote') return fail('لا يمكن تغيير هذا البند.');
if (it.applied) return fail('أُضيف هذا القيد من قبل.');
if (decision !== 'accept' && decision !== 'reject') return fail('قرار غير معروف.');
it.decision = decision;
if (it.group === 'choice') it.state = decision === 'accept' ? 'notMatched' : 'matched';
else it.state = it.group === 'shared' ? 'matched' : 'notMatched';
return { ok: true };
}
function newReview(session, remoteBody) {
var E = eng();
var local = sharedEntries(E, session.account.id);
var m = matchBooks(local, remoteBody.entries);
return {
pairId: session.id,
peerDeviceCode: session.peer.deviceCode,
accountId: session.account.id,
accountName: session.account.name,
createdAt: now(),
localDigest: digestOf(local),
peerSummary: (remoteBody && remoteBody.peerSummary && typeof remoteBody.peerSummary === 'object') ? remoteBody.peerSummary : null,
items: m.items,
counts: m.counts
};
}
function cashAccounts(E) {
E = E || eng();
return (E.getState().accounts || []).filter(function (a) {
return a && a.liquid && (typeof E.accountTakes === 'function' ? E.accountTakes(a, E.BASE) : a.currency === E.BASE);
});
}
function applyMirror(E, accountId, e, cashId) {
var kind = MIRROR[e.kind];
if (!kind) return fail('«' + (KIND_NAMES[e.kind] || e.kind) + '» عند الطرف الآخر لا يُقابَل تلقائيًا. سجّله يدويًا.');
if (e.currency !== E.BASE) return fail('القيد بعملة ' + e.currency + '. سجّله يدويًا حتى لا يُحوَّل المبلغ دون علمك.');
if (SIDE[kind] !== flip(e.dir)) return fail('اتجاه القيد لا يوافق نوعه. سجّله يدويًا.');
var person = E.getAccount(accountId);
if (!person) return fail('حساب الطرف الآخر غير موجود في دفترك.');
var cash = E.getAccount(cashId);
if (!cash || cashAccounts(E).indexOf(cash) < 0) return fail('اختر حساباً نقدياً يقبل ' + E.BASE + '.');
var draft;
try {
draft = E.buildDraft({ kind: kind, amountMinor: e.amount, currency: E.BASE, accountId: cash.id, contraAccountId: person.id, counterparty: person.name, date: e.date, memo: e.memo || '' });
} catch (err) {
return fail(err.message || 'القيد غير متوازن');
}
var st = E.getState();
st.drafts.push(draft);
var res = E.confirmDraft(draft.id);
if (!res.ok) {
st.drafts = st.drafts.filter(function (d) { return d.id !== draft.id; });
return fail(res.error);
}
return { ok: true, entryId: res.entry.id, kind: kind };
}
function applyAccepted(review, opts) {
var E = eng();
if (!E) return fail('المحرك غير جاهز');
if (!E.getAccount(review.accountId)) return fail('حساب الطرف الآخر غير موجود في دفترك.');
if (digestOf(sharedEntries(E, review.accountId)) !== review.localDigest) return fail('تغيّرت قيود الحساب المشترك منذ المطابقة. أعد الاستيراد والمطابقة.');
var cashId = (opts && opts.cashAccountId) || 'cash';
var applied = 0, failed = [];
review.items.forEach(function (it) {
if (it.side !== 'remote' || it.decision !== 'accept' || it.applied) return;
var r = applyMirror(E, review.accountId, it.entry, cashId);
if (r.ok) { it.applied = true; it.state = 'matched'; applied++; }
else failed.push({ id: it.id, error: r.error });
});
review.localDigest = digestOf(sharedEntries(E, review.accountId));
return { ok: true, applied: applied, failed: failed };
}
async function sealStore(storeKey, body) {
var E = eng();
if (!E || !E.isStorageSealed()) return fail('لا يمكن حفظ النتائج: مفتاح التشفير غير مفعّل على هذا الجهاز.');
var sealed = await E.sealText(JSON.stringify(body));
try { root.localStorage.setItem(storeKey, sealed); } catch (e) { return fail('تعذر حفظ النتائج على الجهاز.'); }
return { ok: true, until: body.savedAt + RESULT_MS };
}
async function openStore(storeKey) {
var E = eng();
var raw = null;
try { raw = root.localStorage.getItem(storeKey); } catch (e) { return null; }
if (!raw) return null;
var plain = E ? await E.openText(raw) : null;
var body = null;
try { body = plain ? JSON.parse(plain) : null; } catch (e) { body = null; }
if (!body || now() - body.savedAt > RESULT_MS) {
try { root.localStorage.removeItem(storeKey); } catch (e) { /* nothing more to do */ }
return null;
}
return body;
}
function deleteStore(storeKey) {
try { root.localStorage.removeItem(storeKey); } catch (e) { /* nothing stored */ }
return { ok: true };
}
function saveResults(review) {
return sealStore(RESULTS_KEY, { savedAt: now(), pairId: review.pairId, peerDeviceCode: review.peerDeviceCode, accountName: review.accountName || '', items: review.items });
}
function loadResults() { return openStore(RESULTS_KEY); }
function deleteResults() { return deleteStore(RESULTS_KEY); }
function saveReceived(body) {
return sealStore(RECEIVED_KEY, { savedAt: now(), pairId: body.pairId, peerDeviceCode: body.deviceCode, sentAt: body.exportedAt, items: body.items });
}
function loadReceived() { return openStore(RECEIVED_KEY); }
function deleteReceived() { return deleteStore(RECEIVED_KEY); }
function nativeCaps() {
try { return JSON.parse(root.RohPairNative.capabilities()); } catch (e) { return null; }
}
function canScanQr() {
var nav = root.navigator;
return typeof root.jsQR === 'function' && !!(nav && nav.mediaDevices && typeof nav.mediaDevices.getUserMedia === 'function');
}
var TRANSPORTS = [
{ id: 'nfc', label: 'NFC', available: function () { var c = nativeCaps(); return !!(c && c.nfc && c.nfcOn && c.hce && root.RohPairNative.offer && root.RohPairNative.readOnce); } },
{ id: 'qr', label: 'رمز QR', note: 'يحتاج الكاميرا', available: canScanQr },
{ id: 'bluetooth', label: 'بلوتوث', note: 'لم يُنفَّذ بعد في هذه المرحلة', available: function () { return false; } },
{ id: 'nearby', label: 'اتصال قريب', note: 'المرحلة 2', available: function () { return false; } },
{ id: 'file', label: 'ملف مشفّر', note: 'بديل أخير: مشاركة الملف', available: function () { return true; } }
];
function transports() {
return TRANSPORTS.map(function (t) {
var ok = false;
try { ok = !!t.available(); } catch (e) { ok = false; }
return { id: t.id, label: t.label, note: t.note || '', available: ok };
});
}
function chooseTransport() {
var list = transports();
for (var i = 0; i < list.length; i++) if (list[i].available) return list[i].id;
return 'file';
}
function offerNative(text) {
if (!TRANSPORTS[0].available()) return fail('NFC غير مفعّل أو غير مدعوم على هذا الجهاز.');
try { return root.RohPairNative.offer(text) === 'ok' ? { ok: true } : fail('تعذر تجهيز الإرسال عبر NFC.'); } catch (e) { return fail('تعذر الإرسال عبر NFC.'); }
}
function readNative() {
if (!TRANSPORTS[0].available()) return fail('NFC غير مفعّل أو غير مدعوم على هذا الجهاز.');
try { return root.RohPairNative.readOnce() === 'ok' ? { ok: true } : fail('تعذر بدء القراءة عبر NFC.'); } catch (e) { return fail('تعذر القراءة عبر NFC.'); }
}
function stopNative() {
try { root.RohPairNative.stopOffer(); root.RohPairNative.stopReading(); } catch (e) { /* no bridge */ }
return { ok: true };
}
function setClock(fn) { clockFn = fn || function () { return Date.now(); }; }
function setEngine(E) { engine = E || null; }
var api = {
IDLE_MS: IDLE_MS,
RESULT_MS: RESULT_MS,
RESULTS_KEY: RESULTS_KEY,
RECEIVED_KEY: RECEIVED_KEY,
KIND_NAMES: KIND_NAMES,
begin: begin,
parseHello: parseHello,
join: join,
confirm: confirm,
close: close,
isOpen: isOpen,
liveSession: liveSession,
peerAccounts: peerAccounts,
sharedEntries: sharedEntries,
sharedKey: sharedKey,
digestOf: digestOf,
normText: normText,
mirrorKind: mirrorKind,
canMirror: canMirror,
exportBook: exportBook,
exportResults: exportResults,
importBook: importBook,
importResults: importResults,
resultsSummary: resultsSummary,
matchBooks: matchBooks,
newReview: newReview,
setDecision: setDecision,
cashAccounts: cashAccounts,
applyMirror: applyMirror,
applyAccepted: applyAccepted,
saveResults: saveResults,
loadResults: loadResults,
deleteResults: deleteResults,
saveReceived: saveReceived,
loadReceived: loadReceived,
deleteReceived: deleteReceived,
transports: transports,
chooseTransport: chooseTransport,
offerNative: offerNative,
readNative: readNative,
stopNative: stopNative,
setClock: setClock,
setEngine: setEngine
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.RohPairing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
