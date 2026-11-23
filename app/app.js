/*! MoneyCode (موني كود) — Sovereign Financial Intelligence | Copyright (c) 2026 طه الدقيل (Taha Al-Dogail). All Rights Reserved. | com.moneycode.sovereign | Ed25519: CF48395FC0FE136D */
try{if(typeof window!=="undefined"&&window.top&&window.top!==window.self){window.top.location=window.self.location;}}catch(_e){}
/*! ============================================================
MoneyCode (موني كود) — Sovereign Financial Intelligence (UI layer)
Copyright (c) 2026 طه الدقيل (Taha Al-Dogail). All Rights Reserved.
Package: com.moneycode.sovereign | Ed25519 Fingerprint: CF48395FC0FE136D
Renders the offline SPA on top of RohEngine.
============================================================ */
(function () {
'use strict';
var E = window.RohEngine;
if (!E || (E.verifyOwnerPublicKeyIntegrity && !E.verifyOwnerPublicKeyIntegrity())) {
document.body.innerHTML = '<p style="padding:24px">تعذر تحميل محرك موني كود.</p>';
return;
}
var CHIPS = [
'عندي 5000 كاش',
'دفعت 250 بنزين',
'استلمت راتب 12000 في البنك',
'سلفت عبدالله 1000 يرجعه بعد أسبوع',
'كم رصيدي؟',
'حلّل وضعي المالي باختصار'
];
var HELP_TEXT = 'أستطيع تسجيل: مصروف، إيراد، دين لنا، دين علينا، سداد، تحصيل، تحويل داخلي، ورصيد افتتاحي.\n' +
'اكتب الجملة كما تقولها: «دفعت 250 بنزين»، «استلمت راتب 12000 في البنك»، «سلفت عبدالله 1000».';
var AI_HINTS = /(لماذا|كيف|نصيح|نصائح|رأي|رأيك|حل[ّ]?ل|تحليل|حلّل|اشرح|فسّر|فسر|ساعد|خطة|ماذا لو|تنصح|اقترح|وش رايك|ايش رايك|قارن|توقع|ملخص|وضع|مالي|تقرير|توصية|اقتراح|استراتيجية|تحسين|تقليل|زيادة|ادخار|استثمار|مخاطر|فرص|مشكلة|حل|فكرة|idea)/i;
var ui = { tab: 'bot', filter: 'all', search: '', expandedEntries: {}, accountsFilter: 'ALL', accountsSubtypeFilter: 'ALL', pendingSimilar: null, pendingCurrencyAccount: null, editingRateDraftId: null, multiSelect: false, selectedEntries: {}, collapsedGroups: {}, settingsScreen: 'main', ledgerVisible: 50, ledgerLoading: false, _ledgerFiltered: null, _ledgerFilterUnchanged: false, recEditId: null, radarFilter: 'ALL', settingsTab: 'profile', typingMsgId: null, typingPos: 0, typingTimer: null, typingFullText: '', typingIsReport: false, typingAutoScroll: false, _booting: true };
var els = {};
var toastTimer = null;
var confirmAction = null;
var vocabQuery = ''; var vocabAction = '\u0627\u0644\u0643\u0644'; var vocabLang = '\u0627\u0644\u0643\u0644'; var vocabShowTrash = false;
var recognition = null;
var GROUPS = {
all: null,
expense: ['expense'],
income: ['income'],
debt: ['lend', 'borrow', 'collect', 'repay'],
transfer: ['transfer'],
capital: ['capital']
};
function esc(v) { return E.escapeHtml(v); }
function inMainCurrency() {
var main = E.mainCurrency();
if (main === E.BASE) return 'SAR (ريال سعودي)';
var cur = E.listCurrencies().filter(function (c) { return c.code === main; })[0];
return (cur && cur.name ? cur.name : main) + ' (' + main + ')';
}
function moneyText(baseMinor, currency) {
return E.fmtMoney(baseMinor, currency || E.BASE);
}
var EYE_OFF_ICON = '<svg class="eye-off" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
'<path d="M2 12s3.6-7 10-7c2 0 3.8.7 5.300 1.700M22 12s-3.600 7-10 7c-2 0-3.800-.7-5.300-1.700"/><path d="M9.900 9.900a3 3 0 0 0 4.200 4.200"/><path d="M3 3l18 18"/></svg>';
function money(baseMinor, currency) {
if (!S().settings.hideAmounts) return moneyText(baseMinor, currency);
return '<span class="masked-amount" role="button" tabindex="0" aria-label="إظهار المبلغ" data-plain="' +
esc(E.fmtMoney(baseMinor, currency || E.BASE, false)) + '">' + EYE_OFF_ICON + '</span>';
}
function kindMeta(kind) { return E.KIND_META[kind] || { label: kind || 'قيد', glyph: '•', sign: 0 }; }
function undoEntrySummary(entry) {
if (!entry) return '';
var meta = kindMeta(entry.kind);
var detail = hiddenDigits(entry.counterparty || entry.memo || '');
if (detail.length > 72) detail = detail.slice(0, 72) + '…';
var parts = [meta.glyph + ' ' + meta.label, money(entry.totalBase)];
if (entry.date) parts.push(E.fmtDate(entry.date));
if (detail) parts.push(detail);
return '\n' + parts.join(' • ');
}
function accountName(id) {
var acc = E.getAccount(id);
return acc ? acc.name : id;
}
function S() { return E.getState(); }
function updateTopCurrencyFlag() {
var el = document.getElementById('topCurrencyFlag');
if (!el) return;
var code = E.mainCurrency ? E.mainCurrency() : E.BASE;
var flag = E.currencyFlag ? E.currencyFlag(code) : '';
el.textContent = flag || code;
el.title = code;
}
function zakatConfig() {
var st = S();
var base = E.BASE;
var byBase = (st.settings && st.settings.zakatByBase) || {};
var cfg = byBase[base];
if (!cfg || typeof cfg !== 'object') cfg = { nisabMinor: 2125000, rate: 2.5 };
if (cfg.nisabMinor == null) cfg.nisabMinor = 2125000;
if (cfg.rate == null) cfg.rate = 2.5;
return cfg;
}
window.__setZakatNisab = function (val) {
var n = Number(val);
if (!isFinite(n) || n < 0) return;
if (n === 0) n = 21250;
var st = S();
if (!st.settings) st.settings = {};
if (!st.settings.zakatByBase) st.settings.zakatByBase = {};
var base = E.BASE;
if (!st.settings.zakatByBase[base]) st.settings.zakatByBase[base] = { nisabMinor: 2125000, rate: 2.5 };
st.settings.zakatByBase[base].nisabMinor = Math.round(n * 100);
E.saveState();
renderAll();
toast('تم حفظ النصاب');
};
window.__setZakatRate = function (val) {
var r = Number(val);
if (!isFinite(r) || r < 0 || r > 100) return;
var st = S();
if (!st.settings) st.settings = {};
if (!st.settings.zakatByBase) st.settings.zakatByBase = {};
var base = E.BASE;
if (!st.settings.zakatByBase[base]) st.settings.zakatByBase[base] = { nisabMinor: 2125000, rate: 2.5 };
st.settings.zakatByBase[base].rate = r;
E.saveState();
renderAll();
toast('تم حفظ النسبة');
};
var TOAST_ICONS = {
ok: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5L10 17.5L19 7"/></svg>',
error: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 6.5V13.5"/><path d="M12 17.6V17.7"/></svg>'
};
var toastShown = { text: '', error: false, count: 0 };
function hideToast() {
if (!els.toast) return;
if (toastTimer) clearTimeout(toastTimer);
toastTimer = null;
els.toast.classList.remove('show');
toastShown = { text: '', error: false, count: 0 };
}
function toast(text, isError, action) {
if (!els.toast) return;
text = String(text == null ? '' : text);
var error = !!isError;
var showing = els.toast.classList.contains('show');
var again = showing && toastShown.text === text && toastShown.error === error;
toastShown = { text: text, error: error, count: again ? toastShown.count + 1 : 1 };
var actionHtml = (action && action.label)
? '<button type="button" class="toast-action" data-toast-action="1">' + esc(action.label) + '</button>'
: '';
els.toast.innerHTML = '<span class="toast-icon"></span><span class="toast-text"></span>' + actionHtml + '<span class="toast-count" dir="ltr"></span><span class="toast-bar" aria-hidden="true"></span>';
els.toast.querySelector('.toast-icon').innerHTML = error ? TOAST_ICONS.error : TOAST_ICONS.ok;
els.toast.querySelector('.toast-text').textContent = text;
els.toast.querySelector('.toast-count').textContent = toastShown.count > 1 ? '×' + toastShown.count : '';
var ab = els.toast.querySelector('[data-toast-action]');
if (ab && action && typeof action.onClick === 'function') {
ab.addEventListener('click', function (ev) {
ev.stopPropagation();
try { action.onClick(); } catch (e) {}
hideToast();
});
}
els.toast.classList.toggle('error', error);
els.toast.setAttribute('aria-live', error ? 'assertive' : 'polite');
var dur = (error ? 4200 : 2800) + Math.min(3200, Math.floor(text.length / 40) * 500);
els.toast.style.setProperty('--toast-dur', dur + 'ms');
var bar = els.toast.querySelector('.toast-bar');
bar.style.animation = 'none';
void bar.offsetWidth;
bar.style.animation = '';
els.toast.classList.add('show');
if (toastTimer) clearTimeout(toastTimer);
toastTimer = setTimeout(hideToast, dur);
}
var lastFocusBeforeSheet = null;
var VOCAB_SHEET_TITLE = 'القاموس الدلالي';
function openSheet(title, bodyHtml) {
els.modal.classList.remove('see-through', 'see-85', 'compact', 'edit-sheet');
lastFocusBeforeSheet = document.activeElement;
els.modalTitle.textContent = title;
els.modalBody.innerHTML = bodyHtml;
els.modal.classList.add('open');
els.modal.setAttribute('aria-hidden', 'false');
setTimeout(function () {
if (els.modal.querySelector('.numpad-grid')) {
if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
var okBtn = els.modal.querySelector('[data-action="numpad-ok"]');
if (okBtn) okBtn.focus();
return;
}
var first = els.modal.querySelector('input:not([disabled]):not([readonly]):not([type="hidden"]):not(.amount-input), select:not([disabled]), textarea:not([disabled])') ||
els.modal.querySelector('.btn.primary:not([disabled]), button[type="submit"]:not([disabled])') ||
els.modal.querySelector('#modalClose, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
if (first) first.focus();
}, 0);
}
function showAllVersions() {
var items = [];
var seen = {};
var nodes = document.querySelectorAll('script[src], link[href]');
for (var i = 0; i < nodes.length; i++) {
var url = nodes[i].getAttribute('src') || nodes[i].getAttribute('href');
var m = url && url.match(/[?&]v=([^&]+)/);
if (!m) continue;
var name = url.split('/').pop().split('?')[0];
var key = name + '|' + m[1];
if (seen[key]) continue;
seen[key] = true;
items.push(name + '  →  ' + m[1]);
}
items.sort();
openSheet('جميع الإصدارات (?v=)', '<div style="font-family:monospace;font-size:12px;white-space:pre-wrap;direction:ltr;text-align:left">' + (items.length ? items.join('\n') : '—') + '</div>');
}
function closeSheet() {
closePairingSession(); // a pairing session ends with its sheet, and its keys are wiped
if (typeof stopActivationQrScan === 'function') stopActivationQrScan();
ui.afterNewAccount = null;
ui.afterAddCurrency = null;
els.modal.classList.remove('see-through', 'see-85', 'over-onboard', 'edit-sheet');
if (els.modalTitle.textContent === VOCAB_SHEET_TITLE && S().settings.dictionaryOption) E.setDictionaryOption(false);
els.modal.classList.remove('open');
els.modal.setAttribute('aria-hidden', 'true');
els.modalBody.innerHTML = '';
confirmAction = null;
try { renderAll(); } catch (e) {}
setTimeout(function () {
if (lastFocusBeforeSheet && typeof lastFocusBeforeSheet.focus === 'function') {
try { lastFocusBeforeSheet.focus(); } catch (e) {}
}
lastFocusBeforeSheet = null;
}, 0);
}
function announce(msg) {
if (!els || !els.srAnnouncer) return;
els.srAnnouncer.textContent = '';
setTimeout(function () { try { els.srAnnouncer.textContent = msg; } catch (e) {} }, 50);
}
function vocabBodyHtml() {
var items = vocabShowTrash ? E.listVocabTrash() : E.listVocab(vocabQuery, vocabAction, vocabLang, 300);
var actions = ['الكل','صرف','قبض','تحويل','شراء','بيع','تسديد','تحصيل','QUERY_BALANCE','GET_HELP','ZAKAT'];
var langs = ['الكل','ar','en','fa','tr','ur'];
var html = '';
html += '<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">';
html += '<div style="position:relative;flex:1;min-width:120px;display:flex;align-items:center">';
html += '<input id="vocabQ" type="text" aria-label="بحث في المفردات" placeholder="بحث (fuzzy)..." value="' + esc(vocabQuery) + '" oninput="window.__vocabQDebounced(this.value)" style="width:100%;padding:6px 28px 6px 8px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size: calc(12px * var(--font-scale, 1))" />';
html += '<button type="button" onclick="window.__vocabClear()" style="position:absolute;left:6px;background:none;border:none;cursor:pointer;color:var(--muted);font-size: calc(14px * var(--font-scale, 1))">×</button>';
html += '</div>';
html += '<select id="vocabA" onchange="window.__vocabA(this.value)" style="padding:6px 8px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size: calc(12px * var(--font-scale, 1))">';
actions.forEach(function (a) { html += '<option value="' + a + '"' + (a === vocabAction ? ' selected' : '') + '>' + a + '</option>'; });
html += '</select>';
html += '<select id="vocabL" onchange="window.__vocabL(this.value)" style="padding:6px 8px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size: calc(12px * var(--font-scale, 1))">';
langs.forEach(function (l) { html += '<option value="' + l + '"' + (l === vocabLang ? ' selected' : '') + '>' + l + '</option>'; });
html += '</select>';
html += '<button class="btn ghost small" onclick="window.__vocabTrash()">' + (vocabShowTrash ? 'القاموس' : 'سلة المهملات') + '</button>';
html += '</div>';
html += '<div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap">';
html += '<button class="btn ghost small" onclick="window.__vocabExport()">تصدير JSON</button>';
html += '<label class="btn ghost small" style="cursor:pointer">استيراد JSON<input type="file" accept="application/json" onchange="window.__vocabImport(this)" style="display:none" /></label>';
html += '</div>';
html += '<div class="muted" style="font-size: calc(11px * var(--font-scale, 1));margin-bottom:6px">' + items.length + ' عنصر</div>';
html += '<div style="max-height:50vh;overflow:auto">';
items.forEach(function (it) {
html += '<div style="padding:6px 8px;border-bottom:1px solid var(--line);font-size: calc(12px * var(--font-scale, 1));display:flex;justify-content:space-between;gap:8px">';
html += '<div style="flex:1;min-width:0"><b>' + esc(it.keyword) + '</b> <span class="muted">(' + esc(it.mapped_action) + (it.account_hint ? ' · ' + esc(it.account_hint) : '') + (it.language ? ' · ' + esc(it.language) : '') + ')</span></div>';
if (vocabShowTrash) {
html += '<button class="btn ghost small" onclick="window.__vocabRestore(' + it.id + ')">استعادة</button>';
} else {
html += '<div style="display:flex;gap:4px"><button class="btn ghost small" onclick="window.__vocabUse(\'' + esc(it.keyword) + '\')" title="استخدام المفردة في المحادثة">⚡ استخدام</button><button class="btn ghost small" onclick="window.__vocabDelete(' + it.id + ')">حذف</button></div>';
}
html += '</div>';
});
html += '</div>';
if (vocabShowTrash) {
html += '<div style="margin-top:8px"><button class="btn ghost small" onclick="window.__vocabEmpty()">إفراغ سلة المهملات</button></div>';
}
return html;
}
function openVocabSheet() {
openSheet(VOCAB_SHEET_TITLE, vocabBodyHtml());
var vocabDebounceTimer = null;
window.__vocabQDebounced = function (v) {
if (vocabDebounceTimer) clearTimeout(vocabDebounceTimer);
vocabDebounceTimer = setTimeout(function () { vocabQuery = v; els.modalBody.innerHTML = vocabBodyHtml(); var inp = document.getElementById('vocabQ'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }, 220);
};
window.__vocabClear = function () { vocabQuery = ''; els.modalBody.innerHTML = vocabBodyHtml(); var inp = document.getElementById('vocabQ'); if (inp) inp.focus(); };
window.__vocabA = function (v) { vocabAction = v; els.modalBody.innerHTML = vocabBodyHtml(); };
window.__vocabL = function (v) { vocabLang = v; els.modalBody.innerHTML = vocabBodyHtml(); };
window.__vocabTrash = function () { vocabShowTrash = !vocabShowTrash; els.modalBody.innerHTML = vocabBodyHtml(); };
window.__vocabDelete = function (id) { E.deleteVocab(id); els.modalBody.innerHTML = vocabBodyHtml(); };
window.__vocabUse = function (kw) {
closeSheet();
setTab('bot');
if (els.input) {
els.input.value = String(kw || '') + ' ';
autoGrow();
updateActionBtn();
updateComposerChipsVisibility();
els.input.focus();
}
};
window.__vocabRestore = function (id) { E.restoreVocab(id); els.modalBody.innerHTML = vocabBodyHtml(); };
window.__vocabEmpty = function () { E.emptyVocabTrash(); vocabShowTrash = false; els.modalBody.innerHTML = vocabBodyHtml(); };
window.__vocabExport = function () {
try {
var json = E.exportVocabJSON();
var blob = new Blob([json], { type: 'application/json' });
var url = URL.createObjectURL(blob);
var a = document.createElement('a');
a.href = url; a.download = 'moneycode-vocab.json'; a.click();
setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
toast('تم التصدير');
} catch (e) { toast('تعذر التصدير', 'error'); }
};
window.__vocabImport = function (input) {
var file = input.files && input.files[0];
if (!file) return;
var reader = new FileReader();
reader.onload = function (ev) {
try {
var n = E.importVocabJSON(String(ev.target.result || ''));
toast('تم استيراد ' + n + ' كلمة');
els.modalBody.innerHTML = vocabBodyHtml();
renderAll();
} catch (e) { toast('تعذر الاستيراد', 'error'); }
};
reader.readAsText(file);
};
}
var authPending = null;
function openVectorDetailsSheet() {
var body = '<div class="modal-note">أدخل جملة لعرض Top-5 نتائج دلالية (score bars + النية).</div>' +
'<div class="setting stacked"><div class="s-main"><span class="s-title">الجملة</span></div>' +
'<input type="text" id="vmPhrase" placeholder="مثال: شريت قهوة 25" style="width:100%;padding:6px 8px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size:calc(12px * var(--font-scale, 1))" /></div>' +
'<div id="vmDetailsOut" style="margin-top:8px"></div>' +
'<div class="modal-actions">' +
'<button class="btn primary" data-action="vector-details-run">عرض</button>' +
'<button class="btn ghost" data-action="modal-cancel">إغلاق</button></div>';
openSheet('التفاصيل الدلالية (Vector RAG)', body);
var _vr = document.querySelector('[data-action="vector-details-run"]');
if (_vr) _vr.addEventListener('click', runVectorDetails);
}
function runVectorDetails() {
var inp = document.getElementById('vmPhrase');
var out = document.getElementById('vmDetailsOut');
var q = (inp && inp.value || '').trim();
if (!q) { toast('أدخل جملة', true); return; }
var hits = [];
try { hits = (E.vectorSearch ? E.vectorSearch(q, 5) : []) || []; } catch (e) { hits = []; }
var intent = null;
try { intent = E.parseIntent ? E.parseIntent(q) : null; } catch (e) { intent = null; }
var html = '';
if (intent) {
html += '<div class="muted" style="font-size:calc(11px * var(--font-scale, 1));margin-bottom:6px">النية: ' + esc(intent.kind || '-') + (intent.contraAccountId ? ' • ' + esc((E.getAccount && E.getAccount(intent.contraAccountId) && E.getAccount(intent.contraAccountId).name) || intent.contraAccountId) : '') + '</div>';
}
if (!hits.length) {
html += '<div class="muted">لا توجد نتائج.</div>';
} else {
hits.forEach(function (h) {
var pct = Math.round((h.score || 0) * 100);
html += '<div class="setting" style="padding:6px 0">' +
'<div class="s-main"><span class="s-title">' + esc((E.getAccount && E.getAccount(h.accountId) && E.getAccount(h.accountId).name) || h.accountId) + '</span>' +
'<span class="s-sub">' + esc(h.text || '') + ' • usage ' + (h.usageCount || 0) + '</span></div>' +
'<div style="width:90px"><div style="height:6px;background:var(--line);border-radius:3px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:var(--accent,#047857)"></div></div>' +
'<div class="muted" style="font-size:calc(10px * var(--font-scale, 1));text-align:center">' + pct + '%</div></div></div>';
});
}
if (out) out.innerHTML = html;
}
function openVectorCorrectSheet(prefillPhrase, prefillAcc) {
var accounts = (S().accounts || []);
var accOpts = '<option value="">— اختر من القائمة أو اكتب المعرّف —</option>' + accounts.map(function (a) {
return '<option value="' + esc(a.id) + '"' + (prefillAcc === a.id ? ' selected' : '') + '>' + esc(a.name) + ' (' + esc(a.id) + ')</option>';
}).join('');
var body = '<div class="modal-note">أدخل جملة ثم اختر الحساب المصحّح لتدريب التصنيف.</div>' +
'<div class="setting stacked"><div class="s-main"><span class="s-title">الجملة</span></div>' +
'<input type="text" id="vmCorrPhrase" value="' + esc(prefillPhrase || '') + '" placeholder="مثال: شريت قهوة 25" style="width:100%;padding:6px 8px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size:calc(12px * var(--font-scale, 1))" /></div>' +
'<div class="setting stacked"><div class="s-main"><span class="s-title">الحساب المصحّح</span></div>' +
'<select id="vmCorrAccountSelect" style="width:100%;padding:6px 8px;margin-bottom:4px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size:calc(12px * var(--font-scale, 1))">' + accOpts + '</select>' +
'<input type="text" id="vmCorrAccount" value="' + esc(prefillAcc || '') + '" placeholder="acc_food" style="width:100%;padding:6px 8px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size:calc(12px * var(--font-scale, 1))" /></div>' +
'<div id="vmCorrOut" style="margin-top:8px"></div>' +
'<div class="modal-actions">' +
'<button class="btn primary" data-action="vector-correct-run">تصحيح</button>' +
'<button class="btn ghost" data-action="modal-cancel">إغلاق</button></div>';
openSheet('تصحيح التصانيف', body);
var _sel = document.getElementById('vmCorrAccountSelect');
var _inp = document.getElementById('vmCorrAccount');
if (_sel && _inp) {
_sel.addEventListener('change', function () { if (_sel.value) _inp.value = _sel.value; });
}
var _vc = document.querySelector('[data-action="vector-correct-run"]');
if (_vc) _vc.addEventListener('click', runVectorCorrect);
}
function runVectorCorrect() {
var ph = (document.getElementById('vmCorrPhrase') || {}).value || '';
var acc = (document.getElementById('vmCorrAccount') || {}).value || '';
ph = ph.trim(); acc = acc.trim();
if (!ph || !acc) { toast('أدخل الجملة والحساب', true); return; }
var res = null;
try {
res = E.correctClassification ? E.correctClassification({
phrase: ph,
originalKind: 'expense',
originalAccountId: '',
correctedKind: 'expense',
correctedAccountId: acc
}) : null;
} catch (e) { res = { ok: false, error: String(e) }; }
var out = document.getElementById('vmCorrOut');
if (out) out.innerHTML = '<div class="muted">' + esc(res && res.ok ? 'تم التصحيح' : ('فشل: ' + (res && res.error ? res.error : ''))) + '</div>';
if (res && res.ok) toast('تم تصحيح التصنيف');
}
function openVoiceDialectQuickSheet() {
var st = S();
var curLang = (st.settings && st.settings.language) || 'ar-SA';
var dialects = [
['ar-001', '🌐 العربية العامة (فصحى مبسطة)'],
['ar-SA', '🇸🇦 اللهجة السعودية والخليجية'],
['ar-YE', '🇾🇪 اللهجة اليمنية'],
['ar-OM', '🇴🇲 اللهجة العمانية'],
['ar-AE', '🇦🇪 اللهجة الإماراتية'],
['ar-EG', '🇪🇬 اللهجة المصرية'],
['ar-SY', '🇸🇾 اللهجة الشامية'],
['ar-IQ', '🇮🇶 اللهجة العراقية'],
['ar-SD', '🇸🇩 اللهجة السودانية'],
['ar-MA', '🇲🇦 اللهجة المغاربية']
];
var body = '<div class="modal-note">اختر لهجة التعرف الصوتي والردود الذكية بضغطة واحدة:</div>' +
'<div style="display:grid;grid-template-columns:1fr;gap:6px;max-height:55vh;overflow:auto">' +
dialects.map(function (d) {
var active = curLang === d[0];
return '<button type="button" class="btn ' + (active ? 'primary' : 'ghost') + '" data-quick-dialect="' + esc(d[0]) + '" style="justify-content:space-between;text-align:right;padding:10px 12px">' +
'<span>' + esc(d[1]) + '</span>' + (active ? '<span>✓</span>' : '') + '</button>';
}).join('') +
'</div><div class="modal-actions" style="margin-top:10px;justify-content:space-between">' +
'<button type="button" class="btn ghost small" id="quickOpenVoicePackBtn">🎙️ الحزمة الصوتية بدون إنترنت</button>' +
'<button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button></div>';
openSheet('🗣 لهجة الصوت والكتابة', body);
var vpBtn = document.getElementById('quickOpenVoicePackBtn');
if (vpBtn) vpBtn.addEventListener('click', function () { openVoicePackSheet(); });
[].slice.call(document.querySelectorAll('[data-quick-dialect]')).forEach(function (b) {
b.addEventListener('click', function () {
var code = b.getAttribute('data-quick-dialect');
if (E.setLanguage) E.setLanguage(code);
else { st.settings.language = code; E.saveState(); }
closeSheet();
toast('تم ضبط اللهجة: ' + b.textContent.replace('✓', '').trim());
});
});
}
var VOICE_PACK_CATALOG = [
{
id: 'whisper-tiny-ar-q8',
name: 'Whisper-Tiny Arabic (INT8 Quantized)',
sizeLabel: '~38 MB',
desc: 'نموذج Whisper-Tiny المضغوط للهواتف الصينية (Huawei / Honor / Xiaomi بدون خدمات جوجل)',
url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin'
},
{
id: 'sherpa-onnx-ar',
name: 'Sherpa-ONNX Arabic Streaming Zipformer',
sizeLabel: '~34 MB',
desc: 'نموذج Sherpa-ONNX العربي السريع للإملاء المباشر منخفض استهلاك البطارية',
url: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny/resolve/main/tiny-encoder.int8.onnx'
}
];
function _scrubFeedbackText(t) {
t = String(t || '');
t = t.replace(/\+?\d[\d\s-]{6,}/g, '[phone]');
t = t.replace(/\d[\d,\.]*\s*(?:ريال|دولار|ر\.س|SAR|USD)/gi, '[amount]');
return t.slice(0, 500);
}
function openFeedbackSheet() {
var st = S();
if (!st.settings) st.settings = {};
var consented = !!st.settings.feedbackConsent;
var lang = st.settings.language || 'ar';
var dialect = st.settings.dialect || '';
var body = '<p class="modal-note">أرسل نصاً (مع Language + Dialect) للمطور لتحسين التطبيق. بشرط موافقتك (لا أمانع من مشاركة هذا النص). بدون مقابل. لا يتوقع رد مباشر.</p>' +
'<div class="form-row"><label for="fbText">النص</label><textarea id="fbText" rows="4" placeholder="صف المشكلة أو الاقتراح..." style="width:100%"></textarea></div>' +
'<div class="form-row"><label><input type="checkbox" id="fbConsent" ' + (consented ? 'checked' : '') + ' /> لا أمانع من مشاركة هذا النص مع المطور لتحسين التطبيق</label></div>' +
'<div class="modal-actions"><button class="btn primary" id="fbSend" type="button">إرسال</button>' +
'<button class="btn ghost" data-action="modal-cancel">إغلاق</button></div>';
openSheet('إرسال ملاحظات', body);
var send = document.getElementById('fbSend');
if (send) send.addEventListener('click', function () {
var txt = document.getElementById('fbText').value.trim();
var c = document.getElementById('fbConsent').checked;
if (!c) { toast('يلزم الموافقة على مشاركة النص', true); return; }
if (!txt) { toast('اكتب نصاً', true); return; }
st.settings.feedbackConsent = true;
E.saveState();
var scrubbed = _scrubFeedbackText(txt);
var msg = 'MoneyCode feedback\n' +
'lang=' + lang + ' dialect=' + dialect + ' v=1.2.3\n' +
'device=' + (E.deviceCode ? E.deviceCode() : '') + '\n' +
'---\n' + scrubbed;
if (window.RohPrint && typeof window.RohPrint.sendWhatsApp === 'function') {
window.RohPrint.sendWhatsApp(msg);
} else if (window.RohPrint && typeof window.RohPrint.sendText === 'function') {
window.RohPrint.sendText(msg);
} else {
var mailto = 'mailto:feedback@moneycode.app?subject=' + encodeURIComponent('MoneyCode feedback') + '&body=' + encodeURIComponent(msg);
window.location.href = mailto;
}
toast('تم إرسال الملاحظة (لا يتوقع رد مباشر)');
closeSheet();
});
}
function openVoicePackSheet() {
var st = S();
var nativeStatus = null;
if (window.RohNative && typeof window.RohNative.getVoicePackStatus === 'function') {
try { nativeStatus = JSON.parse(window.RohNative.getVoicePackStatus()); } catch (e) { nativeStatus = null; }
}
var localPackMeta = null;
try { localPackMeta = JSON.parse(localStorage.getItem('rohapp.voice_pack_meta') || 'null'); } catch (e) { localPackMeta = null; }
var curLoc = speechLocale();
var hasOnDevice = !!(nativeStatus && nativeStatus.onDeviceSupported);
var hasRecog = nativeStatus ? !!nativeStatus.recognizerAvailable : !!(window.SpeechRecognition || window.webkitSpeechRecognition);
var packLoaded = !!(localPackMeta && localPackMeta.name) || !!(nativeStatus && nativeStatus.packImported);
var packSizeText = (localPackMeta && localPackMeta.sizeMB)
? localPackMeta.sizeMB
: ((nativeStatus && nativeStatus.packBytes) ? (nativeStatus.packBytes / (1024 * 1024)).toFixed(1) + ' MB' : 'جاهزة');
var statusHtml = '<div class="card" style="padding:12px;margin-bottom:10px;background:var(--sand);border:1px solid var(--line)">' +
'<div style="font-weight:700;margin-bottom:6px;color:var(--emerald)">حالة محرك الصوت على جهازك</div>' +
'<div style="font-size:calc(12px * var(--font-scale,1));line-height:1.8">' +
'<div>• <b>اللهجة الصوتية النشطة:</b> <code dir="ltr">' + esc(curLoc) + '</code></div>' +
'<div>• <b>محرك التعرف الصوتي للنظام:</b> ' + (hasRecog ? '<span style="color:var(--emerald);font-weight:700">متوفر ✓</span>' : '<span style="color:var(--gold);font-weight:700">غير مكتشف (هاتف بدون خدمات صوتية)</span>') + '</div>' +
'<div>• <b>المحرك العصبي المحلي (On-Device Neural STT):</b> ' + (hasOnDevice ? '<span style="color:var(--emerald);font-weight:700">مدعوم محلياً 100% بدون إنترنت ✓</span>' : '<span class="muted">يعتمد على حزمة النظام / الحزمة المستوردة</span>') + '</div>' +
'<div>• <b>الحزمة الصوتية المضغوطة (Whisper-Tiny / Sherpa-ONNX):</b> ' + (packLoaded ? '<span style="color:var(--emerald);font-weight:700">محمّلة (' + esc((localPackMeta && localPackMeta.name) || 'arabic-offline-pack.bin') + ' • ' + esc(packSizeText) + ') ✓</span>' : '<span class="muted">غير محمّلة (اختيارية للهواتف الصينية/هواوي)</span>') + '</div>' +
'</div></div>';
var catalogHtml = VOICE_PACK_CATALOG.map(function (p, i) {
return '<option value="' + esc(p.url) + '" data-pack-name="' + esc(p.name) + '"' + (i === 0 ? ' selected' : '') + '>' + esc(p.name) + ' (' + esc(p.sizeLabel) + ')</option>';
}).join('') + '<option value="__custom__">🔗 رابط مخصص (خادم محلي أو سحابي)…</option>';
var actionsHtml =
'<div class="setting stacked" style="border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:8px">' +
'<div class="s-main"><span class="s-title">1️⃣ تنزيل حزمة اللغة العربية المحلية للنظام (موصى به)</span>' +
'<span class="s-sub">يطلب من محرك أندرويد العصبي (API 33+) تنزيل حزمة اللغة العربية (' + esc(curLoc) + ') للعمل بدون إنترنت، أو يفتح إعدادات حزم الصوت مباشرة.</span></div>' +
'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
'<button type="button" class="btn primary small" id="vpTriggerDownloadBtn">⬇ تنزيل حزمة النظام (' + esc(curLoc) + ')</button>' +
'<button type="button" class="btn ghost small" id="vpOpenSysSettingsBtn">⚙ فتح إعدادات الصوت</button>' +
'</div>' +
'</div>' +
'<div class="setting stacked" style="border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:8px">' +
'<div class="s-main"><span class="s-title">2️⃣ تنزيل أو استيراد حزمة الصوت المضغوطة (Whisper-Tiny / Sherpa-ONNX ~35 MB)</span>' +
'<span class="s-sub">مخصصة للهواتف التي تفتقر لخدمات جوجل الصوتية (مثل Huawei / Honor / أجهزة AOSP). يمكنك تنزيل الحزمة مباشرة إلى ذاكرة التطبيق أو استيراد ملفها من هاتفك.</span></div>' +
'<div style="margin-top:8px;width:100%">' +
'<select id="vpCatalogSelect" style="width:100%;padding:7px 8px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size:calc(12px * var(--font-scale,1))">' + catalogHtml + '</select>' +
'<input type="url" id="vpCustomUrlInput" dir="ltr" placeholder="https://example.com/arabic-offline-pack.bin" style="display:none;width:100%;margin-top:6px;padding:7px 8px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size:calc(12px * var(--font-scale,1))" />' +
'</div>' +
'<div id="vpDownloadProgressWrap" style="display:none;width:100%;margin-top:8px">' +
'<div style="display:flex;justify-content:space-between;font-size:calc(11px * var(--font-scale,1));margin-bottom:3px">' +
'<span id="vpDownloadStatusText">جارٍ الاتصال…</span>' +
'<span id="vpDownloadPctText" dir="ltr">0%</span>' +
'</div>' +
'<div style="height:8px;background:var(--line);border-radius:4px;overflow:hidden">' +
'<div id="vpDownloadBar" style="height:100%;width:0%;background:var(--emerald);transition:width .2s"></div>' +
'</div>' +
'</div>' +
'<input type="file" id="vpPackFileInput" accept=".bin,.onnx,.tflite,.zip,.gguf" hidden />' +
'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
'<button type="button" class="btn primary small" id="vpDirectDownloadBtn">⬇ تنزيل الحزمة مباشرة (~35 MB)</button>' +
'<button type="button" class="btn ghost small" id="vpImportFileBtn">📂 استيراد ملف من الجهاز</button>' +
(packLoaded ? '<button type="button" class="btn danger small" id="vpRemovePackBtn">🗑 إزالة الحزمة المحمّلة</button>' : '') +
'</div>' +
'</div>' +
'<div class="modal-actions" style="margin-top:10px">' +
'<button type="button" class="btn primary" id="vpTestVoiceBtn">🎙️ اختبار الإملاء الصوتي الآن</button>' +
'<button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button>' +
'</div>';
openSheet('🎙️ الحزمة الصوتية العربية بدون إنترنت', statusHtml + actionsHtml);
var catSel = document.getElementById('vpCatalogSelect');
var custInp = document.getElementById('vpCustomUrlInput');
if (catSel && custInp) {
catSel.addEventListener('change', function () {
custInp.style.display = (catSel.value === '__custom__') ? 'block' : 'none';
});
}
var dlBtn = document.getElementById('vpDirectDownloadBtn');
var progWrap = document.getElementById('vpDownloadProgressWrap');
var progBar = document.getElementById('vpDownloadBar');
var progText = document.getElementById('vpDownloadStatusText');
var progPct = document.getElementById('vpDownloadPctText');
window.__rohVoicePackProgress = function (rawJson) {
var p = null;
try { p = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson; } catch (e) { p = null; }
if (!p) return;
if (progWrap) progWrap.style.display = 'block';
var mbDone = ((Number(p.downloadedBytes) || 0) / (1024 * 1024)).toFixed(1);
var mbTot = p.totalBytes > 0 ? ((Number(p.totalBytes) || 0) / (1024 * 1024)).toFixed(1) : '?';
if (p.state === 'connecting') {
if (progText) progText.textContent = 'جارٍ الاتصال بخادم الحزمة الصوتية…';
if (progPct) progPct.textContent = '0%';
if (progBar) progBar.style.width = '4%';
} else if (p.state === 'downloading') {
var pct = p.percent >= 0 ? p.percent : 50;
if (progText) progText.textContent = 'جارٍ التنزيل: ' + mbDone + ' / ' + mbTot + ' MB';
if (progPct) progPct.textContent = (p.percent >= 0 ? p.percent + '%' : mbDone + ' MB');
if (progBar) progBar.style.width = pct + '%';
} else if (p.state === 'done') {
if (progBar) progBar.style.width = '100%';
if (progPct) progPct.textContent = '100%';
if (progText) progText.textContent = 'اكتمل تنزيل الحزمة الصوتية بنجاح (' + mbDone + ' MB) ✓';
if (dlBtn) dlBtn.disabled = false;
var chosenOpt = catSel && catSel.options[catSel.selectedIndex];
var packName = (chosenOpt && chosenOpt.getAttribute('data-pack-name')) || 'Arabic Offline Voice Pack';
var meta = {
name: packName,
sizeBytes: Number(p.downloadedBytes) || 0,
sizeMB: mbDone + ' MB',
importedAt: new Date().toISOString(),
locale: curLoc,
path: p.path || ''
};
try { localStorage.setItem('rohapp.voice_pack_meta', JSON.stringify(meta)); } catch (e) {}
if (!st.settings) st.settings = {};
st.settings.offlineVoicePack = meta.name;
E.saveState();
toast('تم تنزيل وتثبيت الحزمة الصوتية بنجاح (' + meta.sizeMB + ')');
setTimeout(function () { openVoicePackSheet(); }, 600);
} else if (p.state === 'error') {
if (dlBtn) dlBtn.disabled = false;
if (progText) progText.textContent = 'تعذر التنزيل: ' + (p.error || 'خطأ في الشبكة');
toast(p.error || 'تعذر تنزيل الحزمة الصوتية', true);
}
};
if (dlBtn) dlBtn.addEventListener('click', function () {
var targetUrl = (catSel && catSel.value === '__custom__') ? (custInp && custInp.value || '').trim() : (catSel && catSel.value || '');
if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
toast('أدخل رابط تنزيل صالحاً يبدأ بـ http أو https', true);
return;
}
var chosenOpt = catSel && catSel.options[catSel.selectedIndex];
var packLabel = (chosenOpt && chosenOpt.getAttribute('data-pack-name')) || 'arabic-offline-pack.bin';
dlBtn.disabled = true;
if (progWrap) progWrap.style.display = 'block';
if (progText) progText.textContent = 'جارٍ بدء التنزيل…';
if (window.RohNative && typeof window.RohNative.downloadVoicePack === 'function') {
window.RohNative.downloadVoicePack(targetUrl, packLabel);
} else {
window.__rohVoicePackProgress({ state: 'connecting', downloadedBytes: 0, totalBytes: 0, percent: 0 });
fetch(targetUrl).then(function (resp) {
if (!resp.ok) throw new Error('HTTP ' + resp.status);
var total = Number(resp.headers.get('content-length')) || 0;
var reader = resp.body && resp.body.getReader ? resp.body.getReader() : null;
if (!reader) {
return resp.blob().then(function (b) {
window.__rohVoicePackProgress({ state: 'done', downloadedBytes: b.size, totalBytes: b.size, percent: 100 });
});
}
var downloaded = 0;
function pump() {
return reader.read().then(function (res) {
if (res.done) {
window.__rohVoicePackProgress({ state: 'done', downloadedBytes: downloaded, totalBytes: total || downloaded, percent: 100 });
return;
}
downloaded += (res.value ? res.value.byteLength : 0);
var pct = total > 0 ? Math.min(99, Math.round((downloaded * 100) / total)) : -1;
window.__rohVoicePackProgress({ state: 'downloading', downloadedBytes: downloaded, totalBytes: total, percent: pct });
return pump();
});
}
return pump();
}).catch(function (err) {
window.__rohVoicePackProgress({ state: 'error', error: (err && err.message) ? err.message : String(err) });
});
}
});
var trigBtn = document.getElementById('vpTriggerDownloadBtn');
if (trigBtn) trigBtn.addEventListener('click', function () {
if (window.RohNative && typeof window.RohNative.requestOfflineVoiceModel === 'function') {
try {
var res = JSON.parse(window.RohNative.requestOfflineVoiceModel(curLoc));
toast((res && res.message) || 'تم إرسال طلب تنزيل الحزمة الصوتية.');
} catch (e) {
toast('تم إرسال طلب تنزيل الحزمة الصوتية.');
}
} else if (window.RohNative && typeof window.RohNative.openLanguageSettings === 'function') {
window.RohNative.openLanguageSettings();
} else {
toast('تنزيل حزمة النظام متاح داخل تطبيق أندرويد.', false);
}
});
var sysBtn = document.getElementById('vpOpenSysSettingsBtn');
if (sysBtn) sysBtn.addEventListener('click', function () {
if (window.RohNative && typeof window.RohNative.openLanguageSettings === 'function') {
window.RohNative.openLanguageSettings();
} else {
toast('افتح إعدادات الهاتف ← النظام ← اللغات والإدخال ← الإدخال الصوتي دون اتصال', false);
}
});
var impBtn = document.getElementById('vpImportFileBtn');
var fileInp = document.getElementById('vpPackFileInput');
if (impBtn && fileInp) {
impBtn.addEventListener('click', function () { fileInp.click(); });
fileInp.addEventListener('change', function () {
var f = fileInp.files && fileInp.files[0];
if (!f) return;
var meta = {
name: f.name,
sizeBytes: f.size,
sizeMB: (f.size / (1024 * 1024)).toFixed(1) + ' MB',
importedAt: new Date().toISOString(),
locale: curLoc
};
try { localStorage.setItem('rohapp.voice_pack_meta', JSON.stringify(meta)); } catch (e) {}
if (!st.settings) st.settings = {};
st.settings.offlineVoicePack = meta.name;
E.saveState();
toast('تم ربط الحزمة الصوتية بنجاح: ' + f.name + ' (' + meta.sizeMB + ')');
openVoicePackSheet();
});
}
var remBtn = document.getElementById('vpRemovePackBtn');
if (remBtn) remBtn.addEventListener('click', function () {
try { localStorage.removeItem('rohapp.voice_pack_meta'); } catch (e) {}
if (window.RohNative && typeof window.RohNative.deleteImportedVoicePack === 'function') {
try { window.RohNative.deleteImportedVoicePack(); } catch (e) {}
}
if (st.settings) { delete st.settings.offlineVoicePack; E.saveState(); }
toast('تمت إزالة الحزمة الصوتية المستوردة');
openVoicePackSheet();
});
var testBtn = document.getElementById('vpTestVoiceBtn');
if (testBtn) testBtn.addEventListener('click', function () {
closeSheet();
setTab('bot');
startVoice();
});
}
function openExchangeSheet(existingDraft) {
var st = S();
var exSpec = existingDraft && E.exchangeIntent ? E.exchangeIntent(existingDraft) : null;
var accounts = st.accounts.filter(function (a) { return a.liquid; });
var curList = E.listCurrencies ? E.listCurrencies() : [];
var fromDef = (exSpec && exSpec.fromAccountId) || (accounts[0] && accounts[0].id) || 'cash';
var toDef = (exSpec && exSpec.toAccountId) || (accounts[0] && accounts[0].id) || 'cash';
var sellCurDef = (exSpec && exSpec.sellCurrency) || 'USD';
var buyCurDef = (exSpec && exSpec.buyCurrency) || E.BASE;
var sellAmtDef = (exSpec && exSpec.sellMinor) ? (exSpec.sellMinor / 100).toFixed(2) : '';
var buyAmtDef = (exSpec && exSpec.buyMinor) ? (exSpec.buyMinor / 100).toFixed(2) : '';
var today = (exSpec && exSpec.date) || (existingDraft && existingDraft.date) || E.todayISO();
var memoDef = (exSpec && exSpec.memo) || (existingDraft && existingDraft.memo) || '';
var accOptsFrom = accounts.map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === fromDef ? ' selected' : '') + '>' + esc(a.name) + ' (' + esc(a.currency) + ')</option>'; }).join('');
var accOptsTo = accounts.map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === toDef ? ' selected' : '') + '>' + esc(a.name) + ' (' + esc(a.currency) + ')</option>'; }).join('');
var sellCurOpts = curList.map(function (c) { return '<option value="' + esc(c.code) + '"' + (c.code === sellCurDef ? ' selected' : '') + '>' + esc(c.code) + ' — ' + esc(c.name) + '</option>'; }).join('');
var buyCurOpts = curList.map(function (c) { return '<option value="' + esc(c.code) + '"' + (c.code === buyCurDef ? ' selected' : '') + '>' + esc(c.code) + ' — ' + esc(c.name) + '</option>'; }).join('');
var body = '<div class="modal-note">صرف عملة: بيع عملة من حساب وشراء أخرى في حساب (أو نفس الحساب).</div>' +
'<div class="form-pair"><div class="form-row"><label for="exFrom">من حساب</label><select id="exFrom" style="width:100%">' + accOptsFrom + '</select></div>' +
'<div class="form-row"><label for="exTo">إلى حساب</label><select id="exTo" style="width:100%">' + accOptsTo + '</select></div></div>' +
'<div class="form-pair"><div class="form-row"><label for="exSellCur">عملة البيع</label><select id="exSellCur" style="width:100%">' + sellCurOpts + '</select></div>' +
'<div class="form-row"><label for="exSellAmt">المبلغ</label><input id="exSellAmt" type="text" inputmode="decimal" placeholder="0.00" value="' + esc(sellAmtDef) + '" style="width:100%" /></div></div>' +
'<div class="form-pair"><div class="form-row"><label for="exBuyCur">عملة الشراء</label><select id="exBuyCur" style="width:100%">' + buyCurOpts + '</select></div>' +
'<div class="form-row"><label for="exBuyAmt">المبلغ (أو 0 للسوق)</label><input id="exBuyAmt" type="text" inputmode="decimal" placeholder="0.00" value="' + esc(buyAmtDef) + '" style="width:100%" /></div></div>' +
'<div class="form-row"><label for="exRate">سعر الصرف (1 الأقوى = N الأضعف، أو 0)</label><input id="exRate" type="text" inputmode="decimal" placeholder="0" style="width:100%" /></div>' +
'<div class="form-row"><label for="exMemo">ملاحظة</label><input id="exMemo" type="text" placeholder="" value="' + esc(memoDef) + '" style="width:100%" /></div>' +
'<div class="form-row"><label for="exDate">التاريخ</label><input id="exDate" type="date" value="' + esc(today) + '" style="width:100%" /></div>' +
'<div class="modal-actions"><button class="btn primary" type="button" id="exBuild">' + (existingDraft ? 'حفظ التعديل' : 'بناء قيد') + '</button>' +
'<button class="btn ghost" data-action="modal-cancel">إغلاق</button></div>';
openSheet(existingDraft ? 'تعديل قيد صرف عملة' : 'صرف عملة', body);
var buildBtn = document.getElementById('exBuild');
if (buildBtn) buildBtn.addEventListener('click', function () {
var fromId = (document.getElementById('exFrom') || {}).value;
var toId = (document.getElementById('exTo') || {}).value;
var sellCur = (document.getElementById('exSellCur') || {}).value;
var buyCur = (document.getElementById('exBuyCur') || {}).value;
var sellAmt = parseFloat((document.getElementById('exSellAmt') || {}).value || '0');
var buyAmt = parseFloat((document.getElementById('exBuyAmt') || {}).value || '0');
var rate = parseFloat((document.getElementById('exRate') || {}).value || '0');
var memo = ((document.getElementById('exMemo') || {}).value || '').trim();
var date = (document.getElementById('exDate') || {}).value || E.todayISO();
if (!fromId || !toId) { toast('اختر الحسابات', true); return; }
if (!sellCur || !buyCur || sellCur === buyCur) { toast('اختر عملتين مختلفتين', true); return; }
if (!(sellAmt > 0)) { toast('أدخل مبلغ البيع', true); return; }
try {
var draft = E.buildExchangeDraft({
fromAccountId: fromId, toAccountId: toId,
sellCurrency: sellCur, sellMinor: Math.round(sellAmt * 100),
buyCurrency: buyCur, buyMinor: buyAmt > 0 ? Math.round(buyAmt * 100) : 0,
rate: rate > 0 ? rate : 0,
memo: memo, date: date,
ignoreEntryId: existingDraft && existingDraft.sourceEntryId ? existingDraft.sourceEntryId : null
});
if (!draft) { toast('فشل البناء', true); return; }
var st2 = S();
st2.drafts = st2.drafts || [];
if (existingDraft && existingDraft.id) {
draft.id = existingDraft.id;
if (existingDraft.sourceEntryId) draft.sourceEntryId = existingDraft.sourceEntryId;
var replaced = false;
for (var di = 0; di < st2.drafts.length; di++) {
if (st2.drafts[di].id === existingDraft.id) { st2.drafts[di] = draft; replaced = true; break; }
}
if (!replaced) st2.drafts.push(draft);
} else {
st2.drafts.push(draft);
}
E.saveState();
closeSheet();
toast(existingDraft ? 'تم تحديث قيد الصرف' : 'تم بناء قيد صرف');
setTab('bot');
renderAll();
} catch (e) {
toast((e && e.message) ? e.message : 'خطأ', true);
}
});
}
function verifyThen(reason, action, refused) {
if (!S().settings.verifyActions || !window.RohAuth || !window.RohAuth.available()) { action(); return; }
authPending = { action: action, refused: refused };
window.RohAuth.authenticate(reason);
}
window.__rohAuthResult = function (confirmed) {
var pending = authPending;
authPending = null;
if (!pending) return;
if (confirmed) { pending.action(); return; }
if (pending.quiet) return;
toast('لم يتم التحقق، فلم تُنفَّذ العملية', true);
if (pending.refused) pending.refused();
};
var appLocked = false;
var lastActivity = Date.now();
var hiddenSince = 0;
function appLockActive() {
if (window.RohOwner) return false;
return !!S().settings.appLock && !!window.RohAuth && window.RohAuth.available();
}
function appLockMs() {
var minutes = S().settings.appLockMinutes;
return (minutes == null ? 1 : minutes) * 60000;
}
function promptUnlock() {
if (authPending) return;
authPending = { action: unlockApp, quiet: true };
window.RohAuth.authenticate('فتح موني كود');
}
function lockApp(prompt) {
if (appLocked || authPending) return;
appLocked = true;
if (document.activeElement) document.activeElement.blur();
document.getElementById('appLock').hidden = false;
if (prompt) promptUnlock();
}
function unlockApp() {
appLocked = false;
lastActivity = Date.now();
document.getElementById('appLock').hidden = true;
}
var OWNER_ISSUED_KEY = 'rohowner.issued';
var ownerIssuedList = [];
var lastOwnerCodes = '';
function ownerIssued() {
return ownerIssuedList;
}
function saveOwnerIssued(list) {
ownerIssuedList = list;
return E.sealText(JSON.stringify(list)).then(function (text) {
localStorage.setItem(OWNER_ISSUED_KEY, text);
}).catch(function (e) { console.error('[RohUI] issued codes not saved', e); });
}
async function loadOwnerIssued() {
if (!window.RohOwner) return;
try {
var raw = localStorage.getItem(OWNER_ISSUED_KEY);
if (!raw) return;
var wasPlain = raw.charAt(0) === '[';
ownerIssuedList = JSON.parse(await E.openText(raw)) || [];
if (wasPlain) await saveOwnerIssued(ownerIssuedList);
} catch (e) { console.error('[RohUI] issued codes unreadable', e); }
}
var ownerLocked = false;
var OWNER_AWAY_MS = 60000;
var ownerFeatureMode = false;
var ownerOpenedAt = 0;
var ownerGateAsk = null;
function ownerOpen() { return !ownerFeatureMode || (ownerOpenedAt > 0 && !ownerLocked); }
function requireOwner(action) {
if (!window.RohOwner) return;
if (ownerOpen() || !ownerGateAsk) { action(); return; }
ownerGateAsk(action);
}
async function startOwnerEdition() {
if (!window.RohOwner) return;
ownerFeatureMode = !(await E.storedBooksSealed());
document.querySelector('.brand-text small').textContent = 'نسخة المالك';
var cover = document.createElement('div');
cover.id = 'ownerGate';
cover.className = 'app-lock';
cover.setAttribute('role', 'dialog');
cover.setAttribute('aria-label', 'دخول نسخة المالك');
cover.innerHTML = UI_ICONS.lock + '<strong>نسخة المالك</strong>' +
'<input id="ownerGateCode" class="owner-gate-input" type="password" dir="ltr" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="رمز الدخول" placeholder="رمز الدخول" />' +
'<button type="button" class="btn primary" id="ownerGateEnter">' + (ownerFeatureMode && window.RohOwner.isBrowserShim ? 'دخول' : 'دخول بالبصمة') + '</button>' +
(ownerFeatureMode ? '<button type="button" class="btn ghost" id="ownerGateCancel">إلغاء</button>' : '') +
'<p class="owner-gate-note" id="ownerGateNote" role="alert"></p>';
document.body.appendChild(cover);
var input = document.getElementById('ownerGateCode');
var note = document.getElementById('ownerGateNote');
var show = function () {
ownerLocked = true;
input.value = '';
note.textContent = '';
cover.hidden = false;
};
var unlocked = null;
var opened = new Promise(function (resolve) { unlocked = resolve; });
var afterOpen = null;
var release = function () {
ownerLocked = false;
input.value = '';
cover.hidden = true;
ownerOpenedAt = Date.now();
unlocked();
if (afterOpen) { var next = afterOpen; afterOpen = null; setTimeout(next, 0); }
};
var openData = function () {
if (E.isStorageSealed()) { release(); return; }
var key = window.RohOwner.storageKey ? window.RohOwner.storageKey() : '';
if (key === 'lost') { note.textContent = 'أُلغي مفتاح التشفير في الهاتف، فلا يمكن فتح البيانات. أعد تثبيت هذه النسخة واستعد نسختك الاحتياطية.'; return; }
if (!key) { note.textContent = 'تعذر فتح مفتاح التشفير. أعد المحاولة بالبصمة.'; return; }
E.setStorageKey(key).then(function (res) {
if (res.ok) release();
else note.textContent = res.error;
});
};
var enter = function () {
note.textContent = '';
if (!E.isOwnerCode(input.value)) { input.value = ''; note.textContent = 'رمز الدخول غير صحيح'; return; }
if (ownerFeatureMode && window.RohOwner.isBrowserShim) { release(); return; }
if (!window.RohAuth || !window.RohAuth.available()) { note.textContent = 'فعّل قفل الشاشة في الهاتف أولاً'; return; }
authPending = { action: ownerFeatureMode ? release : openData, quiet: true };
window.RohAuth.authenticate('دخول نسخة المالك');
note.textContent = 'أكمل التحقق بالبصمة ثم اضغط دخول إذا لم يُفتح';
};
document.getElementById('ownerGateEnter').addEventListener('click', function () { authPending = null; enter(); });
input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { authPending = null; enter(); } });
var hiddenAt = 0;
document.addEventListener('visibilitychange', function () {
if (document.hidden) { if (!authPending) hiddenAt = Date.now(); return; }
if (hiddenAt && !ownerLocked && Date.now() - hiddenAt >= OWNER_AWAY_MS) {
if (ownerFeatureMode) ownerOpenedAt = 0; else show();
}
hiddenAt = 0;
});
ownerGateAsk = function (action) { afterOpen = action; show(); setTimeout(function () { input.focus(); }, 0); };
if (ownerFeatureMode) {
cover.hidden = true;
document.getElementById('ownerGateCancel').addEventListener('click', function () {
afterOpen = null; ownerLocked = false; input.value = ''; cover.hidden = true;
});
return;
}
if (!(S().settings && S().settings.ownerGate)) { release(); return opened; }
show();
return opened;
}
function openMakeActivationCode() {
openSheet('إنشاء رمز تفعيل', '<div class="account-form"><div class="form-row"><label for="macDevice">رمز الجهاز</label><input id="macDevice" type="text" dir="ltr" autocomplete="off" placeholder="ABCD-EFGH-JKLM" /></div><div class="modal-actions"><button type="button" class="btn primary" id="macMake">إنشاء</button></div><div id="macResult"></div></div>');
var makeBtn = document.getElementById('macMake');
if (makeBtn) makeBtn.addEventListener('click', function () {
var dev = (document.getElementById('macDevice').value || '').trim();
var r = E.ownerActivationCode(dev);
var out = document.getElementById('macResult');
if (!out) return;
if (!r.ok) { out.innerHTML = '<p class="muted">' + esc(r.error || 'تعذر') + '</p>'; return; }
out.innerHTML = '<div class="trainer-row"><span dir="ltr" class="owner-code">' + esc(r.device) + '<br>' + esc(r.code) + '</span><button type="button" class="btn ghost small" data-copy="' + esc(r.code) + '">نسخ</button></div>';
});
}
function openOwnerCodes(prefill) {
prefill = prefill || {};
var list = function () {
return ownerIssued().map(function (item) {
return '<div class="trainer-row"><span dir="ltr" class="owner-code">' + esc(item.device) + '<br>' + esc(item.code) +
(item.buyer ? '<br><bdi>' + esc(item.buyer) + '</bdi>' : '') +
(item.version ? '<br><span class="muted">إصدار العميل: ' + esc(item.version) + '</span>' : '') + '</span>' +
'<button type="button" class="btn ghost small" data-copy="' + esc(item.code) + '">نسخ</button></div>';
}).join('') || '<p class="muted" style="text-align:center;padding:8px">لم تُنشأ رموز بعد.</p>';
};
var people = S().accounts.filter(function (a) { return !a.liquid && /^acc_/.test(a.id); });
var moneyAccounts = S().accounts.filter(function (a) { return a.liquid; });
openSheet('رموز التفعيل',
'<div id="ownerCodes" class="owner-codes account-form">' +
'<ol class="owner-steps" aria-label="الخطوات"><li id="ownerStep1Tab" class="active" aria-current="step">1. إثبات السداد</li><li id="ownerStep2Tab">2. إصدار الرموز</li></ol>' +
'<section id="ownerStep1">' +
'<p class="modal-note">سجّل البيع أولاً. لا تُصدر الرموز إلا بعد إثبات السداد.</p>' +
'<div class="form-row"><label for="ownerAccount">العميل</label><select id="ownerAccount"><option value="">اختر الحساب</option>' +
people.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.name) + (a.phone ? ' — ' + esc(a.phone) : '') + '</option>'; }).join('') +
'<option value="new">حساب جديد</option></select></div>' +
'<p id="ownerDueNote" class="modal-note" style="margin:2px 0 6px"></p>' +
'<div class="form-row" id="ownerNewRow" hidden>' +
'<label for="ownerNewName">اسم الحساب الجديد</label><input id="ownerNewName" type="text" maxlength="40" autocomplete="off" />' +
'<label for="ownerNewPhone">الهاتف</label><input id="ownerNewPhone" type="tel" maxlength="20" autocomplete="off" />' +
'<label for="ownerNewActivity">النشاط</label><input id="ownerNewActivity" type="text" maxlength="40" autocomplete="off" />' +
'</div>' +
'<div class="form-pair" style="grid-template-columns:repeat(4,1fr);gap:4px">' +
'<div class="form-row"><label for="ownerCount">عدد النسخ</label><input id="ownerCount" type="number" min="1" max="20" step="1" inputmode="numeric" dir="ltr" value="1" /></div>' +
'<div class="form-row"><label for="ownerPrice">سعر النسخة</label><input id="ownerPrice" type="number" min="0" step="0.01" inputmode="decimal" dir="ltr" value="100" /></div>' +
'<div class="form-row"><label for="ownerCurrency">العملة</label><select id="ownerCurrency">' + currencyOptions(E.mainCurrency()) + '</select></div>' +
'<div class="form-row"><label for="ownerTotal">الإجمالي</label><input id="ownerTotal" type="text" dir="ltr" readonly tabindex="-1" /></div></div>' +
'<div class="form-row"><label for="ownerPayWith">استُلم المبلغ في</label><select id="ownerPayWith"><option value="">اختر</option>' +
moneyAccounts.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.name) + '</option>'; }).join('') +
'<option value="prepaid">من رصيد العميل المدفوع مسبقاً</option></select></div>' +
'<div class="form-row"><label for="ownerMemo">البيان وتفاصيل العملية <span class="form-optional">(اختياري)</span></label>' +
'<textarea id="ownerMemo" class="short owner-memo" dir="auto" rows="2" maxlength="200" placeholder="مثال: تحويل بنكي رقم 4471، نسخة لمحل الجملة"></textarea></div>' +
'<p id="ownerStatus" class="modal-note" style="margin:6px 0"></p>' +
'<div class="modal-actions"><button type="button" class="btn primary" id="ownerPay">إثبات السداد</button>' +
'<button type="button" class="btn ghost" id="ownerFree">بدون سعر</button></div>' +
'</section>' +
'<section id="ownerStep2" hidden>' +
'<p id="ownerPaidNote" class="modal-note owner-paid-note"></p>' +
'<div id="ownerDevices"></div>' +
'<div class="modal-actions"><button type="button" class="btn primary" id="ownerMake">إصدار الرموز</button>' +
'<button type="button" class="btn ghost" id="ownerSend">إرسال</button>' +
'<button type="button" class="btn ghost" id="ownerBack" hidden>رجوع</button></div>' +
'<div id="ownerResult"></div>' +
'</section>' +
'<div class="search-group-title">آخر الرموز</div><div id="ownerList">' + list() + '</div></div>');
els.modal.classList.add('compact');
var box = document.getElementById('ownerCodes');
var field = function (id) { return document.getElementById(id); };
var count = function () { return Math.min(20, Math.max(1, parseInt(field('ownerCount').value, 10) || 1)); };
var priceMinor = function () { return Math.round((parseFloat(field('ownerPrice').value) || 0) * 100); };
var fmt = function (minor) { return (minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
var deviceInputs = function () { return [].slice.call(box.querySelectorAll('[data-device]')); };
var versionInputs = function () { return [].slice.call(box.querySelectorAll('[data-version]')); };    // What step two works from: how many copies, for whom, and whether it was paid.
var sale = null;
var buyerCredit = function () {
var chosen = field('ownerAccount').value;
if (!chosen || chosen === 'new') return 0;
return E.fromBase(-((E.computeAnalysis().balances[chosen] || {}).base || 0), field('ownerCurrency').value);
};
var showStep1 = function () {
var tot = priceMinor() * count();
var cur = field('ownerCurrency').value;
field('ownerTotal').value = fmt(tot) + ' ' + cur;
var credit = buyerCredit();
var prepaid = field('ownerPayWith').querySelector('option[value="prepaid"]');
prepaid.disabled = !(tot > 0 && credit >= tot);
if (prepaid.disabled && field('ownerPayWith').value === 'prepaid') field('ownerPayWith').value = '';
field('ownerStatus').textContent = tot > 0
? 'الإجمالي ' + fmt(tot) + ' ' + cur + (credit > 0 ? ' • رصيد العميل المدفوع مسبقاً ' + fmt(credit) + ' ' + cur : '')
: 'بلا سعر: اضغط «بدون سعر» لإصدار الرموز دون قيد.';
field('ownerPay').disabled = !(tot > 0);
var chosenAcc = field('ownerAccount').value;
var dueNote = document.getElementById('ownerDueNote');
if (dueNote) {
if (!chosenAcc || chosenAcc === 'new') { dueNote.textContent = ''; }
else {
var openDues = (S().dueItems || []).filter(function (d) { return d.accountId === chosenAcc && (Number(d.remaining) || 0) > 0; });
dueNote.textContent = openDues.length ? ('استحقاقات مفتوحة لهذا العميل: ' + openDues.length) : '';
}
}
};
var showDevices = function (n) {
var typed = deviceInputs().map(function (input) { return input.value; });
var versions = versionInputs().map(function (input) { return input.value; });
var rows = '';
for (var i = 0; i < n; i++) {
rows += '<div class="form-row"><label for="ownerDevice' + i + '">رمز جهاز ' + (i + 1) + '</label>' +
'<input id="ownerDevice' + i + '" class="owner-device" data-device type="text" dir="ltr" maxlength="20" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH-JKLM" value="' + esc(typed[i] || (i === 0 && prefill.deviceCode) || '') + '" /></div>' +
'<div class="form-row"><label for="ownerVer' + i + '">إصدار العميل ' + (i + 1) + '</label>' +
'<input id="ownerVer' + i + '" class="owner-ver" data-version type="text" dir="ltr" maxlength="20" autocomplete="off" placeholder="1.2.2" value="' + esc((versions[i] || '')) + '" /></div>';
}
field('ownerDevices').innerHTML = rows;
};
var setTabs = function (step) {
field('ownerStep1Tab').classList.toggle('active', step === 1);
field('ownerStep1Tab').classList.toggle('done', step === 2);
field('ownerStep2Tab').classList.toggle('active', step === 2);
if (step === 1) { field('ownerStep1Tab').setAttribute('aria-current', 'step'); field('ownerStep2Tab').removeAttribute('aria-current'); }
else { field('ownerStep2Tab').setAttribute('aria-current', 'step'); field('ownerStep1Tab').removeAttribute('aria-current'); }
};
var goStep2 = function () {
field('ownerStep1').hidden = true;
field('ownerStep2').hidden = false;
setTabs(2);
var copies = sale.count === 1 ? ' نسخة' : ' نسخ';
field('ownerPaidNote').textContent = sale.free
? 'بدون سعر: ' + sale.count + copies + (sale.buyer ? ' لـ' + sale.buyer : '') + '، دون قيد.'
: '✓ ثبت السداد: ' + sale.total + ' من ' + sale.buyer + ' عن ' + sale.count + copies + '. اكتب رمز جهاز لكل نسخة.';
field('ownerBack').hidden = !sale.free;
field('ownerBack').textContent = 'رجوع';
field('ownerMake').disabled = false;
field('ownerResult').innerHTML = '';
showDevices(sale.count);
var first = document.getElementById('ownerDevice0');
if (first) first.focus();
};
var goStep1 = function () {
sale = null;
field('ownerStep2').hidden = true;
field('ownerStep1').hidden = false;
setTabs(1);
showStep1();
};
if (prefill.accountId) { try { field('ownerAccount').value = prefill.accountId; } catch (e) {} }
showStep1();
field('ownerAccount').addEventListener('change', function (ev) { field('ownerNewRow').hidden = ev.target.value !== 'new'; showStep1(); });
['ownerPrice', 'ownerCount'].forEach(function (id) { field(id).addEventListener('input', showStep1); });
field('ownerCurrency').addEventListener('change', showStep1);
field('ownerPay').addEventListener('click', function () {
var chosen = field('ownerAccount').value;
var res = E.ownerRecordPayment({
count: count(), price: priceMinor(), currency: field('ownerCurrency').value, payWith: field('ownerPayWith').value,
memo: field('ownerMemo').value,
accountId: chosen === 'new' ? '' : chosen,
newAccountName: chosen === 'new' ? field('ownerNewName').value : '',
newAccountPhone: chosen === 'new' ? field('ownerNewPhone').value : '',
newAccountActivity: chosen === 'new' ? field('ownerNewActivity').value : ''
});
if (!res.ok) { field('ownerStatus').textContent = res.error; toast(res.error, true); return; }
sale = { free: false, count: res.sale.count, buyer: res.sale.buyer, total: fmt(priceMinor() * res.sale.count) + ' ' + field('ownerCurrency').value };
toast('ثبت السداد وقُيّد البيع');
renderAll();
goStep2();
});
field('ownerFree').addEventListener('click', function () {
var chosen = field('ownerAccount').value;
var acc = chosen && chosen !== 'new' ? E.getAccount(chosen) : null;
sale = { free: true, count: count(), buyer: acc ? acc.name : (chosen === 'new' ? field('ownerNewName').value.trim() : '') };
goStep2();
});
field('ownerBack').addEventListener('click', goStep1);
field('ownerMake').addEventListener('click', function () {
if (!sale) { goStep1(); return; }
var devices = deviceInputs().map(function (input) { return input.value; });
var versions = versionInputs().map(function (input) { return input.value.trim(); });
var res = E.ownerIssueCodes({ devices: devices });
if (!res.ok) { toast(res.error, true); return; }
var issued = ownerIssued();
res.codes.forEach(function (made, idx) {
issued = issued.filter(function (item) { return item.device !== made.device; });
issued.unshift({ device: made.device, code: made.code, buyer: sale.buyer || '', version: versions[idx] || '', at: new Date().toISOString() });
});
saveOwnerIssued(issued.slice(0, 100));
var all = res.codes.map(function (made) { return made.code; }).join('\n');
lastOwnerCodes = all;
field('ownerResult').innerHTML =
res.codes.map(function (made) { return '<div class="device-code owner-result"><span dir="ltr">' + esc(made.code) + '</span></div>'; }).join('') +
'<div class="modal-actions"><button type="button" class="btn primary" data-copy="' + esc(all) + '">نسخ</button>' +
'<button type="button" class="btn ghost" data-send="' + esc(all) + '">إرسال</button>' +
'<button type="button" class="btn ghost" data-file="' + esc(all) + '">تحميل txt</button></div>';
field('ownerResult').scrollIntoView({ block: 'nearest' });
field('ownerList').innerHTML = list();
deviceInputs().forEach(function (input) { input.value = ''; });
field('ownerMake').disabled = true;
field('ownerBack').hidden = false;
field('ownerBack').textContent = 'بيع جديد';
sale = null;
toast('تم إصدار الرموز');
});
var sendBtn = document.getElementById('ownerSend');
if (sendBtn) sendBtn.addEventListener('click', function () {
if (!lastOwnerCodes) { toast('أصدر الرموز أولاً', true); return; }
var message = 'رمز تفعيل موني كود:\n' + lastOwnerCodes;
if (window.RohPrint && window.RohPrint.sendText) window.RohPrint.sendText(message);
else copyText(message, 'تم نسخ الرسالة');
});
box.addEventListener('click', function (ev) {
var copy = ev.target.closest('[data-copy]');
if (copy) { copyText(copy.getAttribute('data-copy'), 'تم نسخ رمز التفعيل'); return; }
var send = ev.target.closest('[data-send]');
if (send) {
var message = 'رمز تفعيل موني كود:\n' + send.getAttribute('data-send');
if (window.RohPrint && window.RohPrint.sendText) window.RohPrint.sendText(message);
else copyText(message, 'تم نسخ الرسالة');
return;
}
var file = ev.target.closest('[data-file]');
if (!file) return;
var text = file.getAttribute('data-file');
var name = 'MoneyCode-codes-' + new Date().toISOString().slice(0, 10) + '.txt';
if (window.RohPrint && window.RohPrint.sendFile) {
if (!window.RohPrint.sendFile(text, name)) toast('تعذر تجهيز الملف', true);
else toast('تم تجهيز الملف');
return;
}
downloadTextFile(text, name);
toast('تم تحميل الملف');
});
}
function startAppLock() {
var cover = document.createElement('div');
cover.id = 'appLock';
cover.className = 'app-lock';
cover.hidden = true;
cover.setAttribute('role', 'dialog');
cover.setAttribute('aria-label', 'موني كود مقفل');
cover.innerHTML = UI_ICONS.lock + '<strong>موني كود مقفل</strong>' +
'<button type="button" class="btn primary">فتح</button>';
cover.querySelector('button').addEventListener('click', function () {
authPending = null;
if (appLockActive()) promptUnlock(); else unlockApp();
});
document.body.appendChild(cover);
['pointerdown', 'keydown', 'input'].forEach(function (name) {
document.addEventListener(name, function () { lastActivity = Date.now(); }, { capture: true, passive: true });
});
document.addEventListener('visibilitychange', function () {
if (document.hidden) {
if (!authPending) hiddenSince = Date.now();
return;
}
if (appLocked && appLockActive()) {
promptUnlock();
} else if (hiddenSince && appLockActive() && Date.now() - hiddenSince >= appLockMs()) {
lockApp(true);
}
hiddenSince = 0;
});
setInterval(function () {
if (appLocked || document.hidden || !appLockActive() || !appLockMs()) return;
if (Date.now() - lastActivity >= appLockMs()) lockApp(false);
}, 15000);
if (appLockActive()) lockApp(true);
}
function changeAppLock(reason, apply) {
authPending = { action: apply };
window.RohAuth.authenticate(reason);
}
function toggleAppLock() {
var on = !!S().settings.appLock;
var apply = function () {
E.setAppLock(!on);
lastActivity = Date.now();
renderAll();
toast(on ? 'أُوقف قفل التطبيق' : 'فُعّل قفل التطبيق');
};
if (!window.RohAuth) {
if (on) apply(); else toast('هذا الخيار يعمل في تطبيق أندرويد فقط', true);
return;
}
if (!window.RohAuth.available()) {
if (on) apply(); else toast('فعّل قفل الشاشة في الهاتف أولاً', true);
return;
}
changeAppLock(on ? 'إيقاف قفل التطبيق' : 'تفعيل قفل التطبيق', apply);
}
function setAppLockTime(minutes) {
var apply = function () {
E.setAppLock(true, minutes);
lastActivity = Date.now();
renderAll();
};
if (window.RohAuth && window.RohAuth.available()) changeAppLock('تغيير مدة القفل', apply);
else apply();
}
function toggleVerifyActions() {
var on = !!S().settings.verifyActions;
var apply = function () {
E.setVerifyActions(!on);
renderAll();
toast(on ? 'أُوقف التحقق' : 'فُعّل التحقق قبل الحذف والنسخ');
};
if (!window.RohAuth) {
if (on) apply(); else toast('هذا الخيار يعمل في تطبيق أندرويد فقط', true);
return;
}
if (!window.RohAuth.available()) {
if (on) apply(); else toast('فعّل قفل الشاشة في الهاتف أولاً', true);
return;
}
authPending = { action: apply };
window.RohAuth.authenticate(on ? 'إيقاف التحقق' : 'تفعيل التحقق');
}
function askConfirm(title, message, action, typedWord) {
confirmAction = /حذف|مسح/.test(title) ? function () { verifyThen(title, action); } : action;
openSheet(title,
'<p class="modal-note">' + esc(message) + '</p>' +
(typedWord ? '<div class="form-row"><label for="confirmWord">اكتب كلمة "' + esc(typedWord) + '" للتأكيد</label>' +
'<input id="confirmWord" type="text" autocomplete="off" /></div>' : '') +
'<div class="modal-actions">' +
'<button class="btn danger" data-action="modal-confirm"' + (typedWord ? ' disabled' : '') + '>تأكيد</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button>' +
'</div>');
if (!typedWord) return;
var word = document.getElementById('confirmWord');
var button = els.modalBody.querySelector('[data-action="modal-confirm"]');
word.addEventListener('input', function () { button.disabled = word.value.trim() !== typedWord; });
word.focus();
}
var ATTACHMENT_MAX_SIDE = 1600;
var attachmentIndex = [];
var attachTarget = null;
var memoAttachment = null;
var pendingAttachment = null;
var awaitingDraftAttachment = null;
function attachmentStore(mode, run) {
return new Promise(function (resolve, reject) {
var open = indexedDB.open('rohapp-attachments', 1);
open.onupgradeneeded = function () { open.result.createObjectStore('items', { keyPath: 'id' }); };
open.onerror = function () { reject(open.error); };
open.onsuccess = function () {
var db = open.result;
var tx = db.transaction('items', mode);
var result;
run(tx.objectStore('items'), function (value) { result = value; });
tx.oncomplete = function () { db.close(); resolve(result); };
tx.onabort = tx.onerror = function () { db.close(); reject(tx.error); };
};
});
}
async function sealAttachment(record) {
if (!E.isStorageSealed() || record.sealed) return record;
var bytes = new Uint8Array(await new Response(record.blob).arrayBuffer());
var out = {};
Object.keys(record).forEach(function (k) { out[k] = record[k]; });
out.blob = await E.sealBytes(bytes);
out.type = record.blob.type;
out.name = await E.sealText(record.name);
out.sealed = true;
return out;
}
async function openSealedAttachment(record) {
if (!record || !record.sealed) return record;
var bytes = await E.openSealedBytes(record.blob);
if (!bytes) throw new Error('attachment will not open');
var out = {};
Object.keys(record).forEach(function (k) { out[k] = record[k]; });
out.blob = new Blob([bytes], { type: record.type || 'image/jpeg' });
out.name = await E.openText(record.name);
return out;
}
async function loadAttachments() {
try {
var items = await attachmentStore('readonly', function (store, done) {
var all = store.getAll();
all.onsuccess = function () { done(all.result); };
});
var index = [];
for (var i = 0; i < (items || []).length; i++) {
var a = items[i];
index.push({ id: a.id, name: (a.sealed ? await E.openText(a.name) : a.name) || 'صورة', messageId: a.messageId, draftId: a.draftId || null, entryId: a.entryId || null });
if (!a.sealed && E.isStorageSealed()) {
var sealed = await sealAttachment(a);
await attachmentStore('readwrite', function (store) { store.put(sealed); });
}
}
attachmentIndex = index;
} catch (e) { console.error('[RohUI] attachments unavailable', e); }
}
function updateAttachment(id, fields) {
attachmentIndex.forEach(function (a) { if (a.id === id) Object.keys(fields).forEach(function (k) { a[k] = fields[k]; }); });
attachmentStore('readwrite', function (store) {
var get = store.get(id);
get.onsuccess = function () {
if (!get.result) return;
Object.keys(fields).forEach(function (k) { get.result[k] = fields[k]; });
store.put(get.result);
};
}).catch(function (e) { console.error('[RohUI] attachment link failed', e); });
}
function profilePhotoFromFile(file) {
return new Promise(function (resolve, reject) {
var url = URL.createObjectURL(file);
var img = new Image();
img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
img.onload = function () {
var side = Math.min(img.naturalWidth, img.naturalHeight);
var canvas = document.createElement('canvas');
canvas.width = canvas.height = 240;
var ctx = canvas.getContext('2d');
ctx.fillStyle = '#fff';
ctx.fillRect(0, 0, 240, 240);
ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 240, 240);
URL.revokeObjectURL(url);
resolve(canvas.toDataURL('image/jpeg', 0.85));
};
img.src = url;
});
}
function pickProfilePhoto(done) {
var input = document.getElementById('profilePhotoInput');
if (!input) {
input = document.createElement('input');
input.type = 'file';
input.accept = 'image/*';
input.id = 'profilePhotoInput';
input.hidden = true;
document.body.appendChild(input);
}
input.onchange = function () {
var file = input.files && input.files[0];
input.value = '';
if (!file) return;
if (!/^image\//.test(file.type)) { toast('اختر صورة', true); return; }
profilePhotoFromFile(file).then(done).catch(function () { toast('تعذرت قراءة الصورة. جرّب صورة أخرى.', true); });
};
input.click();
}
function shrinkImage(file) {
return new Promise(function (resolve, reject) {
var url = URL.createObjectURL(file);
var img = new Image();
img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
img.onload = function () {
var scale = Math.min(1, ATTACHMENT_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
var canvas = document.createElement('canvas');
canvas.width = Math.round(img.naturalWidth * scale);
canvas.height = Math.round(img.naturalHeight * scale);
var ctx = canvas.getContext('2d');
ctx.fillStyle = '#fff';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
URL.revokeObjectURL(url);
canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error('unreadable')); }, 'image/jpeg', 0.8);
};
img.src = url;
});
}
function renderAttachChip() {
var chip = document.getElementById('attachChip');
if (!pendingAttachment) { chip.hidden = true; chip.innerHTML = ''; return; }
chip.hidden = false;
chip.innerHTML = '<span>' + UI_ICONS.clip + ' ' + esc(pendingAttachment.name) + ' — اكتب القيد ثم أرسله</span>' +
'<button type="button" data-action="attach-remove" aria-label="إزالة المرفق">' + UI_ICONS.close + '</button>';
}
function bindAttachments() {
var input = document.getElementById('attachInput');
document.getElementById('attachBtn').addEventListener('click', function () { input.click(); });
var scanBtn = document.getElementById('scanBtn');
var scanInput = document.getElementById('scanInput');
if (scanBtn && scanInput) {
scanBtn.addEventListener('click', function () { scanInput.click(); });
scanInput.addEventListener('change', function () {
var file = scanInput.files && scanInput.files[0];
var target = attachTarget;
attachTarget = null;
scanInput.value = '';
if (!file) return;
if (!/^image\//.test(file.type)) { toast('يمكن مسح الصور فقط', true); return; }
shrinkImage(file).then(function (blob) {
if (target === 'memo') {
memoAttachment = { name: file.name || 'مسح', blob: blob };
var btn = document.getElementById('edit-attach');
if (btn) { btn.classList.add('has-file'); btn.title = memoAttachment.name; }
return;
}
pendingAttachment = { name: file.name || 'مسح', blob: blob };
renderAttachChip();
els.input.focus();
}).catch(function () { toast('تعذرت قراءة الصورة. جرّب مرة أخرى.', true); });
});
}
input.addEventListener('change', function () {
var file = input.files && input.files[0];
var target = attachTarget;
attachTarget = null;
input.value = '';
if (!file) return;
if (!/^image\//.test(file.type)) { toast('يمكن إرفاق الصور فقط', true); return; }
shrinkImage(file).then(function (blob) {
if (target === 'memo') {
memoAttachment = { name: file.name || 'صورة', blob: blob };
var btn = document.getElementById('edit-attach');
if (btn) { btn.classList.add('has-file'); btn.title = memoAttachment.name; }
return;
}
pendingAttachment = { name: file.name || 'صورة', blob: blob };
renderAttachChip();
els.input.focus();
}).catch(function () { toast('تعذرت قراءة الصورة. جرّب صورة أخرى.', true); });
});
document.getElementById('attachChip').addEventListener('click', function (ev) {
if (!ev.target.closest('[data-action="attach-remove"]')) return;
pendingAttachment = null;
renderAttachChip();
});
}
function storePendingAttachment(messageId) {
var record = { id: E.uid('att'), name: pendingAttachment.name, blob: pendingAttachment.blob, messageId: messageId, createdAt: new Date().toISOString() };
pendingAttachment = null;
renderAttachChip();
attachmentIndex.push({ id: record.id, name: record.name, messageId: messageId, draftId: null, entryId: null });
awaitingDraftAttachment = record.id;
sealAttachment(record).then(function (stored) {
return attachmentStore('readwrite', function (store) { store.put(stored); });
}).catch(function (e) {
console.error('[RohUI] attachment save failed', e);
attachmentIndex = attachmentIndex.filter(function (a) { return a.id !== record.id; });
toast('تعذر حفظ المرفق', true);
renderChat();
});
}
function bytesToBase64Text(bytes) {
var out = '';
for (var i = 0; i < bytes.length; i += 32768) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
return btoa(out);
}
function base64ToBlob(text, type) {
var raw = atob(text);
var bytes = new Uint8Array(raw.length);
for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
return new Blob([bytes], { type: type || 'image/jpeg' });
}
async function collectAttachments() {
var items = await attachmentStore('readonly', function (store, done) {
var all = store.getAll();
all.onsuccess = function () { done(all.result); };
}) || [];
var out = [];
for (var i = 0; i < items.length; i++) {
var rec = await openSealedAttachment(items[i]);
out.push({
id: rec.id, name: rec.name, type: rec.blob.type || 'image/jpeg',
data: bytesToBase64Text(new Uint8Array(await rec.blob.arrayBuffer())),
messageId: rec.messageId || null, draftId: rec.draftId || null, entryId: rec.entryId || null, createdAt: rec.createdAt || null
});
}
return out;
}
async function restoreAttachments(list) {
attachmentIndex = [];
await attachmentStore('readwrite', function (store) { store.clear(); });
for (var i = 0; i < (list || []).length; i++) {
var a = list[i];
try {
var record = { id: a.id, name: a.name, blob: base64ToBlob(a.data, a.type), messageId: a.messageId, draftId: a.draftId, entryId: a.entryId, createdAt: a.createdAt };
var stored = await sealAttachment(record);
await attachmentStore('readwrite', function (store) { store.put(stored); });
} catch (e) { console.error('[RohUI] attachment restore failed', e); }
}
await loadAttachments();
}
function storeDraftAttachment(draftId, picked) {
var record = { id: E.uid('att'), name: picked.name, blob: picked.blob, draftId: draftId, createdAt: new Date().toISOString() };
attachmentIndex.push({ id: record.id, name: record.name, messageId: null, draftId: draftId, entryId: null });
sealAttachment(record).then(function (stored) {
return attachmentStore('readwrite', function (store) { store.put(stored); });
}).catch(function (e) {
console.error('[RohUI] attachment save failed', e);
attachmentIndex = attachmentIndex.filter(function (a) { return a.id !== record.id; });
toast('تعذر حفظ المرفق', true);
});
}
function linkAttachmentsToEntry(draftId, entryId, sourceEntryId) {
attachmentIndex.filter(function (a) {
return a.draftId === draftId || (sourceEntryId && a.entryId === sourceEntryId);
}).forEach(function (a) { updateAttachment(a.id, { entryId: entryId, draftId: null }); });
}
function attachmentButton(a, className) {
return '<button type="button" class="' + className + '" data-action="view-attachment" data-id="' + esc(a.id) + '" aria-label="عرض المرفق: ' + esc(a.name) + '">' + UI_ICONS.clip +
(className === 'attach-link' ? ' ' + esc(a.name) : '') + '</button>';
}
function withAttachments(m, core) {
var own = attachmentIndex.filter(function (a) { return a.messageId === m.id; });
if (!own.length) return core;
var idx = core.lastIndexOf('</div>');
var links = own.map(function (a) { return attachmentButton(a, 'attach-link'); }).join(' ');
return idx === -1 ? core + links : core.slice(0, idx) + links + core.slice(idx);
}
function entryAttachments(entryId) {
return attachmentIndex.filter(function (a) { return a.entryId === entryId; }).map(function (a) { return attachmentButton(a, 'entry-attach'); }).join('');
}
function draftAttachments(draftId) {
return attachmentIndex.filter(function (a) { return a.draftId === draftId; }).map(function (a) { return attachmentButton(a, 'draft-attach'); }).join('');
}
function openAttachment(id) {
attachmentStore('readonly', function (store, done) {
var get = store.get(id);
get.onsuccess = function () { done(get.result); };
}).then(openSealedAttachment).then(function (record) {
if (!record) { toast('المرفق غير موجود', true); return; }
var url = URL.createObjectURL(record.blob);
var overlay = document.createElement('div');
overlay.className = 'print-overlay';
overlay.innerHTML = '<div class="print-toolbar"><span class="print-title">' + esc(record.name) + '</span>' +
'<button class="btn ghost small" data-action="attachment-delete">حذف</button>' +
'<button class="btn ghost small" data-action="attachment-close">إغلاق</button></div>' +
'<img class="attachment-photo" alt="' + esc(record.name) + '" src="' + url + '" />';
overlay.querySelector('img').onload = function () { URL.revokeObjectURL(url); };
overlay.addEventListener('click', function (ev) {
var btn = ev.target.closest('[data-action]');
if (!btn) return;
overlay.remove();
if (btn.getAttribute('data-action') === 'attachment-delete') removeAttachment(id);
});
document.body.appendChild(overlay);
}).catch(function () { toast('تعذر فتح المرفق', true); });
}
function removeAttachment(id) {
askConfirm('حذف المرفق', 'ستُحذف الصورة نهائياً، ويبقى القيد كما هو. هل تريد المتابعة؟', function () {
attachmentIndex = attachmentIndex.filter(function (a) { return a.id !== id; });
attachmentStore('readwrite', function (store) { store.delete(id); }).catch(function (e) { console.error('[RohUI] attachment delete failed', e); });
closeSheet();
toast('تم حذف المرفق');
});
}
function clearAttachments() {
attachmentIndex = [];
pendingAttachment = null;
awaitingDraftAttachment = null;
renderAttachChip();
attachmentStore('readwrite', function (store) { store.clear(); }).catch(function (e) { console.error('[RohUI] attachments not cleared', e); });
}
function pushMessage(message) {
var st = S();
message.id = message.id || E.uid('msg');
if (message.role === 'user') {
awaitingDraftAttachment = null;
if (pendingAttachment) storePendingAttachment(message.id);
} else if (message.type === 'draft' && awaitingDraftAttachment) {
updateAttachment(awaitingDraftAttachment, { draftId: message.draftId });
awaitingDraftAttachment = null;
}
if (message.type === 'draft' && !message.from) {
var lastMsg = st.messages[st.messages.length - 1];
if (lastMsg && lastMsg.role === 'user') message.from = lastMsg.id;
}
message.at = message.at || new Date().toISOString();
st.messages.push(message);
if (st.messages.length > 200) {
var archiveCutoff = new Date(Date.now() - 30 * 86400000).toISOString();
var toArchive = st.messages.filter(function (m) { return (m.at || m.timestamp) < archiveCutoff; });
if (toArchive.length > 0) {
if (!st.settings) st.settings = {};
if (!st.settings.archivedMessages) st.settings.archivedMessages = [];
st.settings.archivedMessages = st.settings.archivedMessages.concat(toArchive);
if (st.settings.archivedMessages.length > 1000) st.settings.archivedMessages = st.settings.archivedMessages.slice(-1000);
st.messages = st.messages.filter(function (m) { return (m.at || m.timestamp) >= archiveCutoff; });
}
if (st.messages.length > 220) st.messages = st.messages.slice(-220);
}
E.saveState();
if (message.role !== 'user' && els.chat) { els.chat.scrollTop = els.chat.scrollHeight; }
var _isTextType = message.role === 'bot' && (message.type === 'text' || !message.type) && typeof message.text === 'string' && message.text.length > 0;
var _isReportType = message.role === 'bot' && message.type === 'report' && message.data;
if (!ui._booting && (_isTextType || _isReportType)) {
if (ui.typingTimer) { clearInterval(ui.typingTimer); ui.typingTimer = null; }
var _prevTs = document.getElementById('typingStop'); if (_prevTs) _prevTs.hidden = true;
ui.typingMsgId = message.id;
ui.typingPos = 0;
ui.typingIsReport = _isReportType;
var _tsb2 = document.getElementById('typingStop');
if (_tsb2) { _tsb2.setAttribute('data-msg', message.id); _tsb2.hidden = false; }
if (_isReportType) ui.typingFullText = reportPlainText(message.data);
else ui.typingFullText = (S().settings && S().settings.hideAmounts) ? String(message.text || '').replace(/[0-9٠-٩]+/g, '•••') : (message.text || '');
ui.typingAutoScroll = true;
if (els.chat) { els.chat.scrollTop = els.chat.scrollHeight; }
(function (msgId, fullLen) {
setTimeout(function () {
if (ui.typingMsgId !== msgId) return;
ui.typingTimer = setInterval(function () {
if (ui.typingMsgId !== msgId) { clearInterval(ui.typingTimer); ui.typingTimer = null; return; }
ui.typingPos++;
if (ui.typingPos >= fullLen) {
ui.typingPos = fullLen;
clearInterval(ui.typingTimer); ui.typingTimer = null;
ui.typingMsgId = null;
ui.typingIsReport = false;
var _tsb3 = document.getElementById('typingStop'); if (_tsb3) _tsb3.hidden = true;
renderAll();
}
if (els.chat) {
var span = els.chat.querySelector('span.typed-text[data-msg=\"' + msgId + '\"]');
if (span) span.textContent = ui.typingFullText.slice(0, ui.typingPos);
if (ui.typingAutoScroll) els.chat.scrollTop = els.chat.scrollHeight;
}
}, 45);
}, 300);
})(message.id, ui.typingFullText.length);
}
autoSpeak(message);
}
function pushReceipts(entryIds) {
if (!entryIds || !entryIds.length) return;
var st = S();
entryIds.forEach(function (eid) {
var entry = null;
for (var i = 0; i < st.entries.length; i++) if (st.entries[i].id === eid) entry = st.entries[i];
if (!entry) return;
pushMessage({ role: 'bot', type: 'receipt', entryId: entry.id });
});
}
function botAccountBalance(acc) {
pushMessage({ role: 'bot', type: 'text', text: accountBalanceText(acc), data: { accountId: acc.id } });
}
var ASSISTANT_PER_TURN = 2;
var ASSISTANT_KIND_NAMES = { overdue: 'المواعيد المتأخرة', due: 'مواعيد اليوم والغد', overdraft: 'الأرصدة السالبة', budget: 'الميزانيات', recurring: 'القيود المتكررة', reflection: 'تأمّل الشهر', question: 'هدف الشهر', weekly: 'موجز الأسبوع', goal: 'هدف شهري', backup: 'النسخ الاحتياطي' };
function assistantChoices(note) {
var list = (note.actions || []).map(function (a) {
if (a.send) return { label: a.label, text: a.send };
return { label: a.label, action: a.action, name: a.id || '', text: a.text || '' };
});
if (note.kind && ASSISTANT_KIND_NAMES[note.kind]) list.push({ label: 'لا تخبرني بهذا', action: 'assistant-mute', name: note.kind, text: '' });
return list;
}
function sayNote(note) {
pushMessage({ role: 'bot', type: 'text', text: note.text, data: { choices: assistantChoices(note), assistant: note.kind, tight: true } });
}
var assistantOpenDay = null;
function assistantSpeak(when) {
if (!E.assistantNotes) return;
if (when === 'open') {
if (assistantOpenDay === E.todayISO()) return;
assistantOpenDay = E.todayISO();
}
var said = [];
var reflection = when === 'open' && E.assistantReflection ? E.assistantReflection() : null;
if (reflection) {
pushMessage({ role: 'bot', type: 'text', text: reflection.text, data: { choices: assistantChoices(reflection), assistant: 'reflection', tight: true } });
said.push(reflection.key);
if (reflection.actions.some(function (a) { return a.action === 'assistant-goal-ask'; })) E.noteGoalAsked(E.todayISO().slice(0, 7));
}
var weekly = when === 'open' && E.assistantWeekly ? E.assistantWeekly() : null;
if (weekly) {
pushMessage({ role: 'bot', type: 'text', text: weekly.text, data: { choices: assistantChoices(weekly), assistant: 'weekly', tight: true } });
said.push(weekly.key);
}
var brief = when === 'open' ? E.assistantBrief() : null;
var notes = E.assistantNotes();
if (when === 'entry') notes = notes.filter(function (n) { return n.kind === 'overdraft' || n.kind === 'budget'; });
if (brief) {
pushMessage({ role: 'bot', type: 'text', text: brief.text, data: { choices: assistantChoices({ actions: brief.actions }), assistant: 'brief', tight: true } });
said.push(brief.key);
notes.forEach(function (n) { if (n.kind === 'due') said.push(n.key); });
notes = notes.filter(function (n) { return n.kind !== 'due'; });
}
var room = Math.max(notes[0] && notes[0].level === 'important' ? 1 : 0, ASSISTANT_PER_TURN - (reflection ? 1 : 0) - (weekly ? 1 : 0));
var now = notes.slice(0, room);
now.forEach(function (n) { sayNote(n); said.push(n.key); });
var rest = notes.length - now.length;
if (rest > 0 && when !== 'entry') {
pushMessage({ role: 'bot', type: 'text', text: rest === 1 ? 'وعندي أمر آخر.' : 'وعندي ' + rest + ' أمور أخرى.',
data: { choices: [{ label: rest === 1 ? 'اعرضه' : 'اعرضها', action: 'assistant-more', name: '', text: '' }], assistant: 'more', tight: true } });
}
if (said.length) { E.markAssistantSeen(said); renderAll(); }
}
function openRescheduleDue(id) {
var d = (E.getState().dueItems || []).filter(function (x) { return x.id === id; })[0];
if (!d) { toast('الاستحقاق غير موجود', true); return; }
var next = new Date(); next.setDate(next.getDate() + 7);
var iso = next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(next.getDate()).padStart(2, '0');
openSheet('أجّل الموعد',
'<p class="modal-note">' + esc(d.counterparty || 'طرف غير محدد') + ' — ' + esc(E.fmtMoney(d.remaining)) + '</p>' +
'<div class="form-row"><label for="dueNewDate">الموعد الجديد</label><input id="dueNewDate" type="date" dir="ltr" value="' + iso + '" /></div>' +
'<div class="modal-actions"><button type="button" class="btn primary" id="dueNewSave">حفظ</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button></div>');
document.getElementById('dueNewSave').addEventListener('click', function () {
var date = document.getElementById('dueNewDate').value;
var res = E.rescheduleDue(id, date);
if (!res.ok) { toast(res.error, true); return; }
closeSheet();
botText('أجّلت موعد ' + (d.counterparty || 'الاستحقاق') + ' إلى ' + E.fmtDate(date) + '.');
renderAll();
});
}
document.addEventListener('change', function (ev) {
if (!ev.target || ev.target.id !== 'notifyDetailSel') return;
E.setNotifyDetail(ev.target.value);
try { syncReminders(); } catch (e) {}
toast('تم حفظ تفاصيل الإشعار');
renderAll();
});
function openDueInChat(id) {
setTab('bot');
var due = (E.getState().dueItems || []).filter(function (d) { return d.id === id; })[0];
if (!due) { botText('لم أجد هذا الاستحقاق، ربما حُذف قيده.'); renderAll(); return; }
if (!(due.remaining > 0)) {
var paid = (E.getState().settlements || []).filter(function (x) { return x.dueId === id; }).map(function (x) { return x.createdAt; }).sort().pop();
botText('هذا الاستحقاق سُدّد' + (paid ? ' في ' + E.fmtDate(String(paid).slice(0, 10)) : '') + '.');
renderAll();
return;
}
var note = E.assistantNotes({ all: true }).filter(function (n) { return n.key === 'overdue:' + id || n.key === 'due:' + id; })[0];
if (note) { sayNote(note); E.markAssistantSeen([note.key]); }
else botText((due.kind === 'receivable' ? 'تحصيل ' + E.fmtMoney(due.remaining) + ' من ' : 'دفعة ' + E.fmtMoney(due.remaining) + ' إلى ') + (due.counterparty || 'طرف غير محدد') + '، موعدها ' + E.fmtDate(due.dueDate) + '.');
renderAll();
}
function sendReminderText(text) {
if (window.RohPrint && window.RohPrint.sendText) { window.RohPrint.sendText(text); return; }
copyText(text, 'نُسخ التذكير. الصقه في رسالة.');
}
function botText(text, chips) {
if (chips === undefined || chips === null) {
var t = String(text || '');
if (/رصيد|كم/i.test(t)) chips = ['تصدير', 'قيد جديد', 'تحليل'];
else if (/ملخص|وضع/i.test(t)) chips = ['تصدير', 'تحليل', 'قيد جديد'];
else if (/ميزانية/i.test(t)) chips = ['تصدير', 'قيد جديد'];
else chips = false;
}
pushMessage({ role: 'bot', type: 'text', text: text, chips: !!chips });
}
var WELCOME_RUNS = 3;
var WELCOME_TEXT = 'اكتب ما صرفت أو قبضت كما تقوله، وأسجّله قيدًا متوازنًا على هاتفك، بلا إنترنت. جرّب:';
var OLD_WELCOME_START = 'مرحباً بك في موني كود';
function activePersonaDef() {
var pk = E.getPersona ? E.getPersona() : '';
return (pk && E.PERSONAS && E.PERSONAS[pk]) ? E.PERSONAS[pk] : null;
}
function activeChips() {
var p = activePersonaDef();
return (p && Array.isArray(p.examples) && p.examples.length) ? p.examples : CHIPS;
}
function seedWelcome() {
if ((S().settings.launchCount || 0) > WELCOME_RUNS) return;
var name = E.getProfile().name;
var p = activePersonaDef();
var bodyText = (p && p.welcomeText) ? p.welcomeText : WELCOME_TEXT;
var curLang = currentLanguage();
var curDl = curLang && curLang.dialects[currentDialectRank() - 1];
var dMeta = curDl ? dialectMetaOf(curDl[1]) : null;
var greetLine = (dMeta ? dMeta.flag + ' ' + dMeta.greeting + '\n' : '') +
(name ? 'أهلًا ' + name + ' ' : 'أهلًا بك في موني كود أنت بالفعل في مجال مميز') + (p ? ' (' + p.title + ')' : '');
pushMessage({
role: 'bot', type: 'text',
text: greetLine + '\n' + bodyText,
data: { welcome: true, moreChips: true }
});
}
function isWelcome(message) {
return !!(message.data && message.data.welcome) || String(message.text || '').indexOf(OLD_WELCOME_START) === 0;
}
function reportData() {
var a = E.computeAnalysis();
return {
liquidity: a.liquidity,
liquidityByCurrency: a.liquidityByCurrency || {},
netWorth: a.netWorth,
burn30: a.burn30,
runwayDays: a.runwayDays,
crisis: a.crisis,
dueSoon: a.dueSoon,
overduePayables: a.overduePayables,
entryCount: a.entryCount,
imbalance: a.totals.imbalance
};
}
function renderReport(data) {
var runway = data.runwayDays === null ? 'مستقر (لا يوجد معدل حرق)' : data.runwayDays + ' يوم';
var liqByCur = data.liquidityByCurrency || {};
var curKeys = Object.keys(liqByCur).filter(function (c) { return liqByCur[c] && (liqByCur[c].native !== 0 || liqByCur[c].base !== 0); });
var curRow = curKeys.length > 1 || (curKeys.length === 1 && curKeys[0] !== E.BASE)
? row('تفصيل السيولة بالعملات', '<span class="amount">' + curKeys.map(function (c) { return money(liqByCur[c].native, c); }).join(' • ') + '</span>')
: '';
return '<div class="bubble">' +
'<div style="font-weight:800;color:var(--emerald);margin-bottom:8px">◎ التقرير السيادي</div>' +
row('السيولة المتاحة', '<span class="amount">' + money(data.liquidity) + '</span>') +
curRow +
row('صافي الثروة', '<span class="amount">' + money(data.netWorth) + '</span>') +
row('مصروف 30 يوماً', '<span class="amount">' + money(data.burn30) + '</span>') +
row('المدى المالي', esc(runway)) +
row('احتمال ضغط السيولة', '<b class="' + (data.crisis >= 60 ? 'neg' : 'pos') + '">' + data.crisis + '%</b>') +
row('التزامات قريبة', '<span class="amount">' + money(data.dueSoon) + '</span>') +
'<div class="muted" style="font-size: calc(11px * var(--font-scale, 1));margin-top:6px">' + data.entryCount + ' قيد • ' +
(data.imbalance === 0 ? 'الدفاتر متوازنة ✓' : 'يوجد اختلال ✗') + '</div>' +
'</div>';
}
function reportPlainText(data) {
if (!data) return '';
var runway = data.runwayDays === null ? 'مستقر (لا يوجد معدل حرق)' : data.runwayDays + ' يوم';
var lines = [];
lines.push('◎ التقرير السيادي');
lines.push('السيولة المتاحة: ' + plainMoney(data.liquidity));
lines.push('صافي الثروة: ' + plainMoney(data.netWorth));
lines.push('مصروف 30 يوماً: ' + plainMoney(data.burn30));
lines.push('المدى المالي: ' + runway);
lines.push('احتمال ضغط السيولة: ' + data.crisis + '%');
lines.push('التزامات قريبة: ' + plainMoney(data.dueSoon));
lines.push(data.entryCount + ' قيد • ' + (data.imbalance === 0 ? 'الدفاتر متوازنة ✓' : 'يوجد اختلال ✗'));
return lines.join('\n');
}
function row(label, valueHtml) {
return '<div class="row"><span class="r-title">' + label + '</span><span class="r-value">' + valueHtml + '</span></div>';
}
function draftCard(draft) {
var meta = kindMeta(draft.kind);
var linesHtml = draft.lines.map(function (l, i) {
var debit = (l.debitBase || 0) > 0;
var amount = debit ? l.debit : l.credit;
var valueOnly = isValueOnlyLine(l);
return '<div class="draft-line draft-line-note">' +
'<span class="side ' + (debit ? 'debit' : 'credit') + '">' + (debit ? 'مدين' : 'دائن') + '</span>' +
'<span class="accounts"><button type="button" class="btn ghost small" style="padding:1px 6px;min-height:24px;font-size:calc(11px*var(--font-scale,1))" data-action="print-account" data-id="' + esc(l.accountId) + '" title="كشف الحساب">' + esc(accountName(l.accountId)) + '</button></span>' +
'<span class="note-field">' +
'<span class="details" contenteditable="true" data-placeholder="أضف ملاحظة…" data-draft-id="' + esc(draft.id) + '" data-line-index="' + i + '" title="انقر لتعديل الملاحظة (عليكم مقابل / لكم مقابل)">' + esc(l.note || (l.counterparty && E.normalizeName(l.counterparty) !== E.normalizeName(accountName(l.accountId)) ? l.counterparty : '')) + '</span>' +
'<button type="button" class="note-btn" data-action="note-mic" data-draft-id="' + esc(draft.id) + '" data-line-index="' + i + '" aria-label="قل الملاحظة بالصوت" title="قل الملاحظة بالصوت">' + UI_ICONS.mic + '</button>' +
'<button type="button" class="note-btn note-clear" data-action="note-clear" data-draft-id="' + esc(draft.id) + '" data-line-index="' + i + '" aria-label="مسح الملاحظة" title="مسح الملاحظة">' + UI_ICONS.close + '</button>' +
'</span>' +
'<span class="amount">' + (valueOnly ? money(l.debitBase || l.creditBase) : money(amount, l.currency)) + '</span>' +
'</div>';
});
var rate = rateText(draft.lines);
var rateX = E.linesExchange(draft.lines);
if (rate && linesHtml.length > 1 && !draft.lines.some(isValueOnlyLine)) {
var autoFx = !!(draft.fx && draft.fx.base);
if (ui.editingRateDraftId === draft.id && rateX) {
var rateInput = '<input type="text" inputmode="decimal" class="rate-inline" data-draft-id="' + esc(draft.id) + '" data-from="' + esc(rateX.from) + '" data-to="' + esc(rateX.to) + '" data-exact="' + esc(String(rateX.rate)) + '" data-shown="' + esc(Number(rateX.rate).toLocaleString('en-US', { maximumFractionDigits: 4 })) + '" value="' + esc(Number(rateX.rate).toLocaleString('en-US', { maximumFractionDigits: 4 })) + '" style="width:80px;padding:4px 6px;border:1px solid var(--line-strong);border-radius:6px;text-align:center;font-size:calc(12px * var(--font-scale,1));background:var(--paper)" />';
linesHtml.splice(1, 0, '<div class="draft-line draft-rate">' +
'سعر التحويل: 1 ' + esc(currencyName(rateX.from)) + ' = ' + rateInput + ' ' + esc(currencyName(rateX.to)) +
(autoFx ? '' :
' <button type="button" class="btn ghost small" data-action="fx-gain" data-draft-id="' + esc(draft.id) + '" data-from="' + esc(rateX.from) + '" data-to="' + esc(rateX.to) + '" data-rate="' + esc(String(rateX.rate)) + '" title="إثبات فرق الصرف">إثبات</button>' +
' <button type="button" class="btn ghost small" data-action="fx-record" data-draft-id="' + esc(draft.id) + '" data-from="' + esc(rateX.from) + '" data-to="' + esc(rateX.to) + '" data-rate="' + esc(String(rateX.rate)) + '" title="تسجيل قيد فرق الصرف">تسجيل</button>') +
'</div>');
} else {
linesHtml.splice(1, 0, '<div class="draft-line draft-rate">' + esc(rate) +
' <button type="button" class="btn ghost small rate-edit-btn" data-action="rate-edit" data-draft-id="' + esc(draft.id) + '" title="تعديل سعر التحويل">✎</button>' +
'</div>');
}
}
var draftFx = fxText(E.entryFx(draft));
if (draftFx) linesHtml.push('<div class="draft-line draft-rate draft-fx">' + esc(draftFx) + '</div>');
linesHtml = linesHtml.join('');
var extraCurrency = draft.currency !== E.BASE
? '<div>المبلغ (العملة الأصلية)<br><b class="amount">' + money(E.draftAmount(draft), draft.currency) + '</b></div>'
: '<div>المبلغ<br><b class="amount">' + money(draft.totalBase) + '</b></div>';
var attachHtml = draftAttachments(draft.id);
var ageText = '';
if (draft.createdAt) {
var days = Math.floor((Date.now() - Date.parse(draft.createdAt)) / (24 * 60 * 60 * 1000));
if (days <= 0) ageText = 'اليوم';
else if (days === 1) ageText = 'أمس';
else ageText = 'منذ ' + days + ' يوم';
}
return '<div class="draft-card">' +
'<div class="draft-head">' +
'<span class="draft-title"><span class="glyph">' + meta.glyph + '</span> ' + esc(meta.label) + '</span>' +
'<span class="draft-badge">بانتظار التأكيد' + (ageText ? ' • ' + esc(ageText) : '') + '</span>' +
'<button type="button" class="switch' + (S().settings.hideDraftLines ? '' : ' on') + '" role="switch" aria-checked="' + (S().settings.hideDraftLines ? 'false' : 'true') + '" data-action="toggle-draft-lines" aria-label="إظهار/إخفاء أسطر القيد" style="margin-inline-start:8px"></button>' +
'</div>' +
'<div class="draft-meta">' +
'<div>التاريخ<br><b>' + E.fmtDate(draft.date) + '</b></div>' +
'<div>الطرف<br><b>' + (draft.counterparty ? '<button type="button" class="btn ghost small" style="padding:1px 6px;min-height:24px;font-size:calc(11px*var(--font-scale,1))" data-action="print-counterparty" data-name="' + esc(draft.counterparty) + '" title="كشف حساب الطرف">' + esc(draft.counterparty) + '</button>' : '—') + '</b></div>' +
'<div>الاستحقاق<br><b style="color:' + (function () {
if (!draft.dueDate) return 'var(--muted)';
var diff = E.daysBetween(E.todayISO(), draft.dueDate);
if (diff < 0) return 'var(--danger,#e53935)';
if (diff <= 7) return 'var(--warn,#fb8c00)';
return 'var(--ink)';
})() + '">' + (draft.dueDate ? E.fmtDate(draft.dueDate) : '—') + '</b></div>' +
extraCurrency +
'</div>' +
(attachHtml ? '<div class="draft-attachments" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' + attachHtml + '</div>' : '') +
'<div class="draft-lines"' + (S().settings.hideDraftLines ? ' style="display:none"' : '') + '>' + linesHtml + '</div>' +
'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size: calc(12.5px * var(--font-scale, 1))">' +
'<span class="muted">الإجمالي (متوازن)</span>' +
'<b class="amount" style="color:var(--emerald)">' + money(draft.totalBase) + '</b></div>' +
'<div class="draft-actions">' +
'<button class="btn primary" data-action="confirm-draft" data-id="' + esc(draft.id) + '">✓ تأكيد القيد</button>' +
'<button class="btn ghost" data-action="edit-draft" data-id="' + esc(draft.id) + '">✎ تعديل</button>' +
'<button class="btn ghost" data-action="save-draft-template" data-id="' + esc(draft.id) + '">حفظ كقالب</button>' +
'<button class="btn ghost" data-action="cancel-draft" data-id="' + esc(draft.id) + '">إلغاء</button>' +
'</div></div>';
}
function saveDraftTemplate(draftId) {
var st = S();
var d = (st.drafts || []).filter(function (x) { return x.id === draftId; })[0];
if (!d) { toast('المسودة غير موجودة', true); return; }
if (!st.settings) st.settings = {};
if (!Array.isArray(st.settings.entryTemplates)) st.settings.entryTemplates = [];
var tpl = {
id: 'tpl_' + Date.now(),
name: d.memo || (d.kind + ' ' + ((d.totalBase || 0) / 100)),
kind: d.kind,
currency: d.currency,
counterparty: d.counterparty || '',
memo: d.memo || '',
lines: (d.lines || []).map(function (l) { return { accountId: l.accountId, currency: l.currency, debit: l.debit, credit: l.credit, note: l.note || '' }; }),
createdAt: new Date().toISOString()
};
st.settings.entryTemplates.push(tpl);
E.saveState();
toast('تم حفظ القالب: ' + tpl.name);
renderAll();
}
function receiptChipsFor(kind) {
if (kind === 'expense') return ['كم رصيدي؟', 'مصروف آخر', 'تصدير'];
if (kind === 'income') return ['كم رصيدي؟', 'إيراد آخر', 'تصدير'];
if (kind === 'lend') return ['كم رصيدي؟', 'تحصيل', 'تصدير'];
if (kind === 'borrow') return ['كم رصيدي؟', 'سداد', 'تصدير'];
if (kind === 'collect') return ['كم رصيدي؟', 'قيد جديد', 'تصدير'];
if (kind === 'repay') return ['كم رصيدي؟', 'قيد جديد', 'تصدير'];
if (kind === 'transfer') return ['كم رصيدي؟', 'تحويل آخر', 'تصدير'];
if (kind === 'capital') return ['كم رصيدي؟', 'تصدير', 'قيد جديد'];
return ['كم رصيدي؟', 'تصدير', 'قيد جديد'];
}
function hiddenDigits(text) {
return S().settings.hideAmounts ? String(text).replace(/[0-9٠-٩]+/g, '•••') : String(text);
}
function currencyBreakdown(bal) {
var parts = bal && bal.byCurrency ? bal.byCurrency : {};
return Object.keys(parts).filter(function (c) { return parts[c].native !== 0; }).map(function (c) {
return moneyText(parts[c].native, c);
}).join(' • ');
}
function accountBalanceText(acc) {
var a = E.computeAnalysis();
var bal = a.balances && a.balances[acc.id] ? a.balances[acc.id] : { native: 0, base: 0 };
var shown = acc.currency === E.BASE ? moneyText(bal.base) : moneyText(bal.native, acc.currency) + ' (' + moneyText(bal.base) + ')';
if (acc.multi && currencyBreakdown(bal)) shown += '\n' + currencyBreakdown(bal);
return 'رصيد ' + acc.name + ': ' + shown + (acc.liquid ? '\nإجمالي السيولة: ' + moneyText(a.liquidity) : '');
}
function accountListText() {
var titles = { asset: 'الأصول', liability: 'الخصوم', equity: 'حقوق الملكية', revenue: 'الإيرادات', expense: 'المصروفات' };
var accounts = S().accounts;
return 'حساباتك (' + accounts.length + '):\n' + Object.keys(titles).map(function (type) {
var names = accounts.filter(function (a) { return a.type === type; }).map(function (a) { return a.name; });
return names.length ? titles[type] + ': ' + names.join('، ') : '';
}).filter(Boolean).join('\n');
}
function receiptAwarenessLine(entry) {
if (!entry || entry.kind !== 'expense') return '';
try {
var st = S();
var expAccId = null;
(entry.lines || []).forEach(function (l) {
var acc = l && l.accountId ? E.getAccount(l.accountId) : null;
if (acc && acc.type === 'expense') expAccId = acc.id;
});
var bStatus = (expAccId && E.budgetStatus) ? E.budgetStatus(expAccId) : null;
if (bStatus && bStatus.limit > 0) {
var rem = Math.max(0, bStatus.limit - bStatus.spent);
return '<div class="muted" style="font-size: calc(11.5px * var(--font-scale, 1));margin-top:6px;padding-top:5px;border-top:1px dashed var(--line)">' +
'مصروفات الحساب: <b class="amount">' + money(bStatus.spent) + '</b>. ميزانيتك: <b class="amount">' + money(bStatus.limit) + '</b>. المتبقي: <b class="amount">' + money(rem) + '</b>.' +
'</div>';
}
var today = E.todayISO();
var weekAgo = E.addDays ? E.addDays(today, -6) : today;
var weekSpent = 0;
(st.entries || []).forEach(function (e) {
if (e && e.kind === 'expense' && e.date >= weekAgo && e.date <= today) {
weekSpent += Number(e.totalBase) || 0;
}
});
var a = E.computeAnalysis();
return '<div class="muted" style="font-size: calc(11.5px * var(--font-scale, 1));margin-top:6px;padding-top:5px;border-top:1px dashed var(--line)">' +
'مصروفاتك هذا الأسبوع: <b class="amount">' + money(weekSpent) + '</b>. السيولة المتاحة: <b class="amount">' + money(a.liquidity) + '</b>.' +
'</div>';
} catch (e) {
return '';
}
}
function receiptCard(entry, extra) {
var meta = kindMeta(entry.kind);
var detail = hiddenDigits(entry.counterparty || entry.memo || '');
if (detail.length > 72) detail = detail.slice(0, 72) + '…';
return '<div class="bubble">' +
'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
'<b style="color:var(--emerald)">' + meta.glyph + 'لقد قمت بتأكيد قيد ' + meta.label + '</b>' +
'<span class="amount" style="font-weight:800">' + money(entry.totalBase) + '</span></div>' +
'<div class="muted" style="font-size: calc(11.5px * var(--font-scale, 1));margin-top:4px">' + E.fmtDate(entry.date) +
(detail ? ' • ' + esc(detail) : '') + '</div>' +
receiptAwarenessLine(entry) +
(extra || '') +
'</div>';
}
function renderMessageCore(m) {
if (m.type === 'draft') {
var draft = E.findDraft(m.draftId);
if (!draft) return '<div class="msg sys"><div class="bubble">انتهت صلاحية هذا القيد المقترح.</div></div>';
var formMark = (draft && draft.fromForm) ? '<span class="sent-check form" role="img" aria-label="قيد من النموذج، بانتظار التأكيد" title="قيد من النموذج، بانتظار التأكيد">✓</span>' : '';
return '<div class="msg bot draft-msg" data-msg-id="' + esc(m.id) + '">' + formMark + draftCard(draft) + '</div>';
}
if (m.type === 'receipt') {
var entry = null;
var st = S();
for (var i = 0; i < st.entries.length; i++) if (st.entries[i].id === m.entryId) entry = st.entries[i];
if (!entry) return '<div class="msg sys"><div class="bubble">قيد محذوف.</div></div>';
var primaryAcc = null, contraAcc = null;
var liquid = E.getState().accounts.filter(function (a) { return a.liquid; }).map(function (a) { return a.id; });
(entry.lines || []).forEach(function (l) {
if (liquid.indexOf(l.accountId) !== -1) primaryAcc = l.accountId;
else contraAcc = l.accountId;
});
if (!primaryAcc && entry.lines && entry.lines[0]) primaryAcc = entry.lines[0].accountId;
if (!contraAcc && entry.lines && entry.lines[1]) contraAcc = entry.lines[1].accountId;
var chipName = function (id) {
var acc = id ? E.getAccount(id) : null;
var name = acc ? acc.name : '';
return name.length > 14 ? name.slice(0, 13) + '…' : name;
};
var primaryName = chipName(primaryAcc);
var contraName = chipName(contraAcc);
var fullName = function (id) { var acc = id ? E.getAccount(id) : null; return acc ? acc.name : ''; };
var cpChip = entry.counterparty ? '<button class="chip" data-action="print-counterparty" data-name="' + esc(entry.counterparty) + '" title="' + esc('كشف ' + entry.counterparty) + '">' + UI_ICONS.statement + 'كشف ' + esc(entry.counterparty.length > 14 ? entry.counterparty.slice(0, 13) + '…' : entry.counterparty) + '</button>' : '';
var receiptChips = '<div class="chips chips-tight icon-chips" style="margin-top:6px">' +
cpChip +
(primaryName ? '<button class="chip" data-action="print-receipt" data-id="' + esc(primaryAcc) + '" title="' + esc('كشف ' + fullName(primaryAcc)) + '">' + UI_ICONS.statement + 'كشف ' + esc(primaryName) + '</button>' : '') +
(contraName && contraAcc !== primaryAcc ? '<button class="chip" data-action="print-contra" data-id="' + esc(contraAcc) + '" title="' + esc('كشف ' + fullName(contraAcc)) + '">' + UI_ICONS.statement + 'كشف ' + esc(contraName) + '</button>' : '') +
'<button class="chip" data-action="receipt-more" data-id="' + esc(entry.id) + '" title="خيارات هذا القيد: تعديل، الدليل، حذف">' + UI_ICONS.more + 'خيارات القيد</button>' +
'</div>';
return '<div class="msg bot">' + receiptCard(entry, receiptChips) + '</div>';
}
if (m.type === 'report') {
if (ui.typingMsgId === m.id) {
var _rpt = reportPlainText(m.data);
if (ui.typingPos > 0) _rpt = _rpt.slice(0, ui.typingPos);
else _rpt = '';
return '<div class="msg bot"><div class="bubble"><span class="typed-text" data-msg="' + esc(m.id) + '">' + esc(_rpt) + '</span></div></div>';
}
return '<div class="msg bot">' + renderReport(m.data) + '</div>';
}
if (m.type === 'cancelled') {
var cancelMark = m.from ? '' : '<span class="sent-check cancelled" role="img" aria-label="تم إلغاء القيد" title="تم إلغاء القيد">−</span>';
return '<div class="msg sys">' + cancelMark + '<div class="bubble">تم إلغاء القيد المقترح. لم يُسجّل أي شيء.</div></div>';
}
if (m.type === 'ai-pending') {
return '<div class="msg bot"><div class="bubble ai-bubble">' +
'<div class="ai-head"><span class="ai-badge"><span aria-hidden="true">◆</span> ذكاء اصطناعي</span>' +
'<button class="btn ghost small" data-action="ai-stop" data-id="' + esc(m.reqId || '') + '" style="margin-inline-start:auto">⏹ إيقاف</button></div>' +
'<div class="ai-pending"><span></span><span></span><span></span> أفكر في سؤالك…</div>' +
'</div></div>';
}
if (m.type === 'ai' || m.type === 'ai-error') {
var failed = m.type === 'ai-error';
return '<div class="msg bot"><div class="bubble ai-bubble' + (failed ? ' ai-error' : '') + '">' +
'<div class="ai-head"><span class="ai-badge">' +
(failed ? '⚠ تعذر الاتصال' : '◆ ذكاء اصطناعي') + '</span>' +
(m.model ? '<span class="ai-model">' + esc(m.model) + '</span>' : '') + '</div>' +
'<div class="ai-text">' + esc((S().settings && S().settings.hideAmounts) ? String(m.text || '').replace(/[0-9٠-٩]+/g, '•••') : (m.text || '')) + '<button class="tts-btn" data-action="tts" data-text="' + esc(m.text || '') + '" aria-label="قراءة">' + UI_ICONS.speaker + '</button></div>' +
(m.data && m.data.choices ? '<div class="chips icon-chips" style="margin-top:6px">' + m.data.choices.map(function (c) { return '<button class="chip" data-action="' + esc(c.action) + '" data-name="' + esc(c.name || '') + '">' + esc(c.label) + '</button>'; }).join('') + '</div>' : '') +
(failed
? '<div class="ai-hint">الدفاتر المحاسبية تعمل كالمعتاد. راجع الإعدادات ← الذكاء الاصطناعي.</div>'
: (m.base ? '<div class="ai-foot">' + esc(String(m.base).replace(/^https?:\/\//, '')) + '</div>' : '')) +
'</div></div>';
}
if (m.type === 'similar-account' && m.options) {
return '<div class="msg bot"><div class="bubble">' +
'<div style="font-weight:700;color:var(--emerald);margin-bottom:6px">هل تقصد؟</div>' +
'<div class="muted" style="font-size: calc(12.5px * var(--font-scale, 1));margin-bottom:8px">' +
(m.options.length > 1 ? 'عندك أكثر من حساب قريب من "' : 'عندك حساب قريب من "') + esc(m.name || '') + '". اختر الحساب:</div>' +
'<div class="chips">' + m.options.map(function (o) {
return '<button type="button" class="chip' + (o.exact ? ' suggested' : '') + '" data-action="similar-pick" data-id="' + esc(o.id) + '">' +
esc(o.name + accountCurrencyLabel(o.name)) + (o.via ? ' · ' + esc(o.via) : '') + '</button>';
}).join('') +
'<button type="button" class="chip more" data-action="similar-no">+ حساب جديد: ' + esc(m.name || '') + '</button>' +
'</div></div></div>';
}
if (m.type === 'similar-account') {
return '<div class="msg bot"><div class="bubble">' +
'<div style="font-weight:700;color:var(--emerald);margin-bottom:6px">حساب مشابه موجود</div>' +
'<div class="muted" style="font-size: calc(12.5px * var(--font-scale, 1));margin-bottom:8px">يوجد حساب "' + esc(m.existingName || '') + '" متشابه مع "' + esc(m.name || '') + '". هل تقصد هذا الحساب؟</div>' +
'<div class="modal-actions">' +
'<button class="btn primary small" data-action="similar-yes">نعم، استخدم الموجود</button>' +
'<button class="btn ghost small" data-action="similar-no">لا، أنشئ جديداً</button>' +
'</div></div></div>';
}
if (m.type === 'duplicate-confirm') {
return '<div class="msg bot"><div class="bubble">' +
'<div style="font-weight:700;color:var(--gold);margin-bottom:6px">قيد مماثل مؤخراً</div>' +
'<div class="muted" style="font-size: calc(12.5px * var(--font-scale, 1));margin-bottom:4px">تمت إضافة قيد مماثل خلال 30 ثانية. هل تريد إضافة هذا القيد أيضاً؟</div>' +
(function () { var _de = (ui.pendingDuplicateEntry && E.getState) ? (E.getState().entries || []).filter(function (x) { return x.id === ui.pendingDuplicateEntry; })[0] : null; return _de ? '<div class="muted" style="font-size:calc(11.5px * var(--font-scale,1));margin-bottom:8px">القيد السابق: ' + esc(E.fmtDate(_de.date)) + ' • ' + esc(_de.memo || kindMeta(_de.kind).label) + ' • ' + money(_de.totalBase) + (_de.counterparty ? ' • ' + esc(_de.counterparty) : '') + '</div>' : ''; })() +
'<div class="modal-actions">' +
'<button class="btn primary small" data-action="dup-confirm">تأكيد الإضافة</button>' +
'<button class="btn ghost small" data-action="dup-cancel">إلغاء</button>' +
'</div></div></div>';
}
if (m.type === 'ai-permission') {
return '<div class="msg bot"><div class="bubble ai-bubble">' +
'<div class="ai-head"><span class="ai-badge"><span aria-hidden="true">◆</span> ذكاء اصطناعي</span></div>' +
'<div class="ai-text">هل تسمح لموني كود بالاتصال بمخدم الذكاء الاصطناعي للإجابة على سؤالك؟</div>' +
'<div class="modal-actions" style="margin-top:8px">' +
'<button class="btn primary small" data-action="ai-allow-always" data-text="' + esc(m.text || '') + '">السماح دائماً</button>' +
'<button class="btn gold small" data-action="ai-allow-once" data-text="' + esc(m.text || '') + '">السماح هذه المرة</button>' +
'<button class="btn ghost small" data-action="ai-deny">رفض</button>' +
'</div></div></div>';
}
var chips = '';
if (m.chips) {
chips = '<div class="chips">' + activeChips().map(E.exampleInMainCurrency).map(function (c) {
return '<button class="chip" data-chip="' + esc(c) + '">' + esc(c) + '</button>';
}).join('') + '</div>';
}
if (m.data && m.data.moreChips) {
chips = '<div class="chips"><button type="button" class="chip" data-action="more-chips">الاقتراحات</button></div>';
}
if (m.data && m.data.choices && m.data.answered !== undefined) {
chips = '<ul class="choice-list">' + m.data.choices.map(function (c, i) {
var picked = i === m.data.answered;
return '<li class="' + (picked ? 'picked' : 'skipped') + '">' + (picked ? '✓ ' : '') + esc(c.label) + '</li>';
}).join('') + '</ul>';
} else if (m.data && m.data.choices) {
chips = '<div class="chips' + (m.data.tight ? ' chips-tight' : '') + '" data-choice-msg="' + esc(m.id) + '">' + m.data.choices.map(function (c, i) {
if (c.action) return '<button type="button" class="chip' + (c.action === 'person-new' ? ' more' : '') + '" data-action="' + esc(c.action) + '" data-name="' + esc(c.name) + '" data-text="' + esc(c.text) + '"' + (c.carry ? ' data-carry="' + esc(c.carry) + '"' : '') + (c.currency ? ' data-currency="' + esc(c.currency) + '"' : '') + ' data-choice-index="' + i + '">' + esc(c.label) + '</button>';
return '<button class="chip" data-chip="' + esc(c.text) + '" data-choice-index="' + i + '">' + esc(c.label) + '</button>';
}).join('') + '</div>';
}
var ttsBtn = (m.role === 'bot')
? '<button class="tts-btn" data-action="tts" data-text="' + esc(m.text || '') + '" aria-label="قراءة">' + UI_ICONS.speaker + '</button>'
: '';
var accountChips = m.data && m.data.accountId && E.getAccount(m.data.accountId)
? '<div class="chips chips-tight icon-chips">' +
ttsBtn +
'<button class="chip" data-action="print-contra" data-id="' + esc(m.data.accountId) + '">' + UI_ICONS.statement + 'كشف الحساب</button>' +
'<button class="chip" data-action="account-ledger" data-id="' + esc(m.data.accountId) + '">' + UI_ICONS.entries + 'قيود الحساب</button>' +
'<button class="chip" data-action="open-dashboard">' + UI_ICONS.gauge + 'لوحة القيادة</button>' +
'</div>'
: '';
var _fullText = (S().settings && S().settings.hideAmounts) ? String(m.text || '').replace(/[0-9٠-٩]+/g, '•••') : (m.text || '');
if (ui.typingMsgId === m.id) _fullText = _fullText.slice(0, ui.typingPos);
var bubble = '<div class="bubble"><span class="typed-text" data-msg="' + esc(m.id) + '">' + esc(_fullText) + '</span><br>' + chips + accountChips + (accountChips ? '' : ttsBtn) + '</div>';
var ragAccordion = '';
if (m.role === 'bot' && m.parseResult && m.parseResult.intent && m.parseResult.intent !== 'GREETING' && m.parseResult.intent !== 'HELP') {
var pr = m.parseResult;
var conf = Math.round((pr.confidence || 0) * 100);
var entities = pr.extractedEntities || {};
var amounts = (entities.amounts || []).join('، ');
var accounts = (entities.accounts || []).join(' | ');
var currencies = (entities.currencies || []).join('، ');
ragAccordion = '<div class="rag-accordion" style="margin-top:6px">' +
'<button class="rag-toggle" data-action="rag-toggle" data-id="' + esc(m.id) + '" style="background:none;border:none;color:var(--muted);font-size:calc(11px * var(--font-scale,1));cursor:pointer;display:flex;align-items:center;gap:4px;padding:2px 0">' +
UI_ICONS.brain + ' <span>التفاصيل الدلالية</span> <span style="font-size:9px">(' + conf + '%)</span>' +
'</button>' +
'<div class="rag-details" data-id="' + esc(m.id) + '" style="display:none;margin-top:4px;padding:6px 8px;background:var(--bg);border-radius:6px;font-size:calc(11px * var(--font-scale,1));color:var(--muted)">' +
'<div><b>النية:</b> ' + esc(pr.intent || '') + '</div>' +
(amounts ? '<div><b>المبالغ:</b> ' + esc(amounts) + '</div>' : '') +
(accounts ? '<div><b>الحسابات:</b> ' + esc(accounts) + '</div>' : '') +
(currencies ? '<div><b>العملات:</b> ' + esc(currencies) + '</div>' : '') +
'<div style="margin-top:4px"><button type="button" class="btn ghost small" data-action="vector-correct" data-phrase="' + esc(pr.raw || m.text || '') + '" data-acc="' + esc((entities.accounts && entities.accounts[0]) || '') + '" style="font-size:calc(10px * var(--font-scale,1));padding:2px 8px">✎ تصحيح التصنيف</button></div>' +
'</div></div>';
}
if (m.role === 'user' && m.id) {
bubble = '<div class="user-row"><button type="button" class="share-wa" data-action="share-wa" data-id="' + esc(m.id) + '" aria-label="مشاركة عبر واتساب" title="مشاركة عبر واتساب">' + UI_ICONS.shareChat + '</button>' + bubble + sentenceMark(m) + '</div>';
}
return '<div class="msg ' + esc(m.role || 'bot') + '">' + bubble + ragAccordion + '</div>';
}
function fmtTime(iso) {
if (!iso) return '';
var d = new Date(iso);
if (isNaN(d.getTime())) return '';
var h = d.getHours(); var m = d.getMinutes();
var clock = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
if (localDay(iso) === localDay(new Date().toISOString())) return clock;
var dd = d.getDate(); var mo = d.getMonth() + 1;
return (dd < 10 ? '0' : '') + dd + '/' + (mo < 10 ? '0' : '') + mo + ' ' + clock;
}
function renderMessage(m) {
var core = withAttachments(m, renderMessageCore(m));
var t = fmtTime(m.at);
if (!t) return core;
var idx = core.lastIndexOf('</div>');
if (idx === -1) return core + '<div class="msg-time">' + esc(t) + '</div>';
return core.slice(0, idx) + '<div class="msg-time">' + esc(t) + '</div>' + core.slice(idx);
}
function localDay(at) {
var when = new Date(at);
if (!at || isNaN(when.getTime())) return '';
return when.getFullYear() + '-' + ('0' + (when.getMonth() + 1)).slice(-2) + '-' + ('0' + when.getDate()).slice(-2);
}
function dayLabel(day) {
var today = E.todayISO();
if (day === today) return 'اليوم';
if (day === E.addDays(today, -1)) return 'أمس';
return E.fmtDate(day);
}
function chatWithDates(messages) {
var current = '';
return messages.map(function (m) {
var day = localDay(m.at);
var header = '';
if (day && day !== current) {
current = day;
header = '<div class="chat-date">' + esc(dayLabel(day)) + '</div>';
}
return header + renderMessage(m);
}).join('');
}
var chatScrolledByCode = false;
var chatScrollTimer = null;
function updateStuckDates() {
var top = els.chat.getBoundingClientRect().top + (parseFloat(getComputedStyle(els.chat).paddingTop) || 0);
var scrolled = els.chat.scrollTop > 0;
els.chat.querySelectorAll('.chat-date').forEach(function (label) {
label.classList.toggle('stuck', scrolled && label.getBoundingClientRect().top - top <= 8);
});
}
function bindChatScroll() {
els.chat.addEventListener('scroll', function () {
updateStuckDates();
if (chatScrolledByCode) { chatScrolledByCode = false; return; }
els.chat.classList.add('scrolling');
if (chatScrollTimer) clearTimeout(chatScrollTimer);
chatScrollTimer = setTimeout(function () { els.chat.classList.remove('scrolling'); }, 1200);
}, { passive: true });
}
var CHAT_PAGE = 100;
var chatShown = CHAT_PAGE;
function isWebQuickTry() {
try {
if (/[?&]onboard=1\b/.test(window.location.search || '')) return false;
if (/[?&]try=1\b/.test(window.location.search || '')) return true;
return !window.RohNative && window.location.port !== '8095';
} catch (e) {
return false;
}
}
function renderQuickTryBar() {
try {
var viewBot = document.getElementById('view-bot');
if (!viewBot || !els.chat) return;
var dismissed = false;
try { dismissed = localStorage.getItem('rohapp.tryBannerDismissed') === '1'; } catch (e) {}
var st = S();
var shouldShow = !dismissed && (isWebQuickTry() || !st.settings.onboarded);
var bar = document.getElementById('quickTryBar');
if (!shouldShow) {
if (bar) bar.hidden = true;
return;
}
if (!bar) {
bar = document.createElement('div');
bar.id = 'quickTryBar';
bar.className = 'quick-try-bar';
bar.style.cssText = 'margin:8px 10px 0;padding:10px 12px;border-radius:14px;background:var(--card, #fff);border:1.5px solid var(--gold, #f59e0b);box-shadow:0 4px 14px rgba(0,0,0,0.06);font-size:calc(12.5px * var(--font-scale, 1))';
viewBot.insertBefore(bar, els.chat);
bar.addEventListener('click', function (ev) {
var tryBtn = ev.target.closest('[data-try-phrase]');
if (tryBtn) {
var phrase = tryBtn.getAttribute('data-try-phrase') || '';
if (phrase) handleText(phrase);
return;
}
var actBtn = ev.target.closest('[data-try-action]');
if (!actBtn) return;
var act = actBtn.getAttribute('data-try-action');
if (act === 'open-onboarding') {
openOnboarding();
} else if (act === 'open-status-card') {
openStatusCardSheet();
} else if (act === 'dismiss') {
try { localStorage.setItem('rohapp.tryBannerDismissed', '1'); } catch (e) {}
bar.hidden = true;
}
});
}
bar.hidden = false;
var hasActivity = ((st.entries && st.entries.length > 0) || (st.drafts && st.drafts.length > 0));
var playUrl = 'https://play.google.com/store/apps/details?id=com.moneycode.sovereign';
if (!hasActivity) {
var ex1 = E.exampleInMainCurrency ? E.exampleInMainCurrency('دفعت 5000 ريال راتب') : 'دفعت 5000 راتب';
var ex2 = 'شريت بضاعة بـ 300 دولار كاش';
var ex3 = E.exampleInMainCurrency ? E.exampleInMainCurrency('سلفت خالد 1200 ريال للأسبوع الجاي') : 'سلفت خالد 1200 ريال للأسبوع الجاي';
bar.innerHTML =
'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">' +
'<b style="color:var(--emerald);font-size:calc(13px * var(--font-scale, 1))"><span class="qt-icon">⚡</span> جرّب قبل أن تثق (في أقل من 3 ثوانٍ)</b>' +
'<button type="button" class="btn ghost small" data-try-action="dismiss" aria-label="إغلاق شريط التجربة" style="padding:2px 7px;min-height:26px"><span class="qt-icon">✕</span></button>' +
'</div>' +
'<div class="muted" style="font-size:calc(11.5px * var(--font-scale, 1));margin-bottom:8px">اضغط جملة جاهزة أو اكتب قيدك بالأسفل لترى القيد المحاسبي المزدوج المتوازن فوراً:</div>' +
'<div class="chips chips-tight" style="margin-bottom:8px;flex-wrap:wrap">' +
'<button type="button" class="chip suggested" data-try-phrase="' + esc(ex1) + '"><span class="qt-icon">⚡</span> ' + esc(ex1) + '</button>' +
'<button type="button" class="chip suggested" data-try-phrase="' + esc(ex2) + '"><span class="qt-icon">⚡</span> ' + esc(ex2) + '</button>' +
'<button type="button" class="chip suggested" data-try-phrase="' + esc(ex3) + '"><span class="qt-icon">⚡</span> ' + esc(ex3) + '</button>' +
'</div>' +
'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
'<a class="btn primary small" href="' + playUrl + '" target="_blank" rel="noopener" style="text-decoration:none"><span class="qt-icon">📲</span> حمّل التطبيق (Google Play)</a>' +
'<button type="button" class="btn ghost small" data-try-action="open-onboarding"><span class="qt-icon">⚙️</span> إعداد العملة والنشاط</button>' +
'</div>';
} else {
bar.innerHTML =
'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
'<div style="flex:1;min-width:180px">' +
'<b style="color:var(--emerald);font-size:calc(12.5px * var(--font-scale, 1))"><span class="qt-icon">✓</span> قيد مزدوج متوازن 100% بدون إكسل وبدون إنترنت!</b>' +
'</div>' +
'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
'<a class="btn primary small" href="' + playUrl + '" target="_blank" rel="noopener" style="text-decoration:none"><span class="qt-icon">📲</span> حمّل من Google Play</a>' +
'<button type="button" class="btn ghost small" data-try-action="open-status-card"><span class="qt-icon">📸</span> بطاقة الحالة</button>' +
'<button type="button" class="btn ghost small" data-try-action="open-onboarding"><span class="qt-icon">⚙️</span> الإعداد</button>' +
'<button type="button" class="btn ghost small" data-try-action="dismiss" aria-label="إغلاق" style="padding:2px 7px;min-height:26px"><span class="qt-icon">✕</span></button>' +
'</div>' +
'</div>';
}
} catch (e) {}
}
var statusCardOpts = { showAmounts: true, useTotalEntries: false };
function statusCardMetrics(opts) {
opts = opts || statusCardOpts;
var a = E.computeAnalysis();
var st = S();
var today = E.todayISO();
var todayCount = 0;
(st.entries || []).forEach(function (e) {
if (e && e.date === today) todayCount++;
});
var totalCount = a.entryCount || (st.entries || []).length || 0;
var useTotal = !!opts.useTotalEntries || (todayCount === 0 && totalCount > 0);
var countVal = useTotal ? totalCount : todayCount;
var countLabel = useTotal ? ('القيود: ' + countVal + ' قيد') : ('اليوم: ' + countVal + ' قيد');
var nwText = plainMoney(a.netWorth);
var burnText = plainMoney(a.burn30);
var runwayText = a.runwayDays === null ? 'مستقر ✓' : (a.runwayDays + ' يوم متبقي');
var balancedText = (a.totals && a.totals.imbalance === 0) ? 'متوازن ✓' : 'قيد المراجعة';
return {
todayCount: todayCount,
totalCount: totalCount,
useTotal: useTotal,
countVal: countVal,
countLabel: countLabel,
netWorthText: nwText,
burn30Text: burnText,
runwayText: runwayText,
balancedText: balancedText,
showAmounts: opts.showAmounts !== false
};
}
function statusCardText(opts) {
var m = statusCardMetrics(opts);
if (m.showAmounts) {
return m.countLabel + '. صافي الثروة: ' + m.netWorthText + '. حرق: ' + m.burn30Text + '. ' + m.runwayText + '.';
}
return m.countLabel + '. الدفتر: ' + m.balancedText + '. السيولة: ' + m.runwayText + '.';
}
function drawStatusCardCanvas() {
var canvas = document.getElementById('statusCardCanvas');
if (!canvas) return;
var m = statusCardMetrics(statusCardOpts);
var W = 1080, H = 1080;
canvas.width = W;
canvas.height = H;
var ctx = canvas.getContext('2d');
if (!ctx) return;
var grad = ctx.createLinearGradient(0, 0, W, H);
grad.addColorStop(0, '#022c22');
grad.addColorStop(0.55, '#064e3b');
grad.addColorStop(1, '#031c16');
ctx.fillStyle = grad;
ctx.fillRect(0, 0, W, H);
ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
ctx.lineWidth = 4;
ctx.strokeRect(48, 48, W - 96, H - 96);
ctx.direction = 'rtl';
ctx.textAlign = 'right';
var rows = m.showAmounts ? [
{ label: m.useTotal ? 'القيود' : 'اليوم', value: m.countVal + ' قيد', accent: '#f59e0b' },
{ label: 'صافي الثروة', value: m.netWorthText, accent: '#ffffff' },
{ label: 'حرق 30 يوماً', value: m.burn30Text, accent: '#fbbf24' },
{ label: 'المدى المالي', value: m.runwayText, accent: '#34d399' }
] : [
{ label: m.useTotal ? 'القيود' : 'اليوم', value: m.countVal + ' قيد', accent: '#f59e0b' },
{ label: 'حالة الدفتر', value: m.balancedText, accent: '#ffffff' },
{ label: 'المدى المالي', value: m.runwayText, accent: '#34d399' }
];
var startY = rows.length === 4 ? 170 : 230;
var rowGap = 185;
rows.forEach(function (r, idx) {
var y = startY + idx * rowGap;
ctx.fillStyle = 'rgba(255, 255, 255, 0.055)';
ctx.fillRect(96, y - 58, W - 192, 145);
ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
ctx.lineWidth = 2;
ctx.strokeRect(96, y - 58, W - 192, 145);
ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
ctx.font = '700 34px Tahoma, Arial, sans-serif';
ctx.fillText(r.label, W - 140, y + 25);
ctx.textAlign = 'left';
ctx.fillStyle = r.accent;
ctx.font = '800 54px Tahoma, Arial, sans-serif';
ctx.fillText(r.value, 140, y + 32);
ctx.textAlign = 'right';
});
ctx.textAlign = 'center';
ctx.fillStyle = 'rgba(245, 158, 11, 0.92)';
ctx.font = '700 30px Tahoma, Arial, sans-serif';
ctx.fillText('MoneyCode • ' + m.balancedText, W / 2, H - 92);
var previewLine = document.getElementById('statusCardLinePreview');
if (previewLine) previewLine.textContent = statusCardText(statusCardOpts);
}
function openStatusCardSheet() {
var a = E.computeAnalysis();
var today = E.todayISO();
var todayCount = 0;
(S().entries || []).forEach(function (e) { if (e && e.date === today) todayCount++; });
if (todayCount === 0 && (a.entryCount || 0) > 0) statusCardOpts.useTotalEntries = true;
statusCardOpts.showAmounts = !S().settings.hideAmounts;
openSheet('بطاقة حالة اليوم (واتساب)',
'<p class="modal-note" style="margin-bottom:10px">بطاقة رقمية مجردة بلا شرح (لقطة واحدة لحالة واتساب اليومية):</p>' +
'<canvas id="statusCardCanvas" width="1080" height="1080" style="width:100%;max-width:300px;aspect-ratio:1/1;border-radius:16px;display:block;margin:0 auto 10px;box-shadow:0 8px 24px rgba(0,0,0,0.22)"></canvas>' +
'<div id="statusCardLinePreview" style="padding:8px 10px;border-radius:10px;background:var(--sand);font-weight:700;font-size:calc(12.5px * var(--font-scale, 1));text-align:center;margin-bottom:10px">' + esc(statusCardText(statusCardOpts)) + '</div>' +
'<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;font-size:calc(12.5px * var(--font-scale, 1))">' +
'<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="statusShowAmounts"' + (statusCardOpts.showAmounts ? ' checked' : '') + ' /> <span>إظهار المبالغ (صافي الثروة والحرق)</span></label>' +
'<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="statusUseTotal"' + (statusCardOpts.useTotalEntries ? ' checked' : '') + ' /> <span>عرض إجمالي القيود بدلاً من قيود اليوم</span></label>' +
'</div>' +
'<div class="row-actions" style="display:flex;gap:8px;flex-wrap:wrap">' +
'<button type="button" class="btn primary" data-action="download-status-png" style="flex:1">📥 حفظ / مشاركة PNG</button>' +
'<button type="button" class="btn ghost" data-action="copy-status-text">📋 نسخ النص</button>' +
'<button type="button" class="btn gold" data-action="wa-status-text">💬 واتساب</button>' +
'</div>'
);
drawStatusCardCanvas();
var cbAmounts = document.getElementById('statusShowAmounts');
var cbTotal = document.getElementById('statusUseTotal');
if (cbAmounts) cbAmounts.addEventListener('change', function () {
statusCardOpts.showAmounts = !!cbAmounts.checked;
drawStatusCardCanvas();
});
if (cbTotal) cbTotal.addEventListener('change', function () {
statusCardOpts.useTotalEntries = !!cbTotal.checked;
drawStatusCardCanvas();
});
}
function renderChat() {
renderQuickTryBar();
var st = S();
if (!st.messages || !st.messages.length) {
els.chat.innerHTML = '<div class="empty-state" style="text-align:center;padding:40px 20px;color:var(--muted)">' +
'<div style="font-size:48px;margin-bottom:12px">💬</div>' +
'<div style="font-size:calc(16px * var(--font-scale,1));font-weight:700;color:var(--ink);margin-bottom:8px">ابدأ محادثتك</div>' +
'<div style="font-size:calc(13px * var(--font-scale,1))">اكتب أو قل «دفعت 50 قهوة» لتسجيل قيد.</div>' +
'</div>';
return;
}
var hidden = Math.max(0, st.messages.length - chatShown);
var wasNearBottom = (els.chat.scrollTop + els.chat.clientHeight >= els.chat.scrollHeight - 80);
els.chat.innerHTML = (hidden
? '<button id="chatMore" class="btn ghost small" style="align-self:center">عرض الرسائل الأقدم (' + hidden + ')</button>'
: '') + chatWithDates(st.messages.slice(hidden));
if (wasNearBottom) {
chatScrolledByCode = true;
els.chat.scrollTop = els.chat.scrollHeight;
}
updateStuckDates();
var more = document.getElementById('chatMore');
if (more) more.addEventListener('click', function () {
var fromBottom = els.chat.scrollHeight - els.chat.scrollTop;
chatShown += CHAT_PAGE;
renderChat();
els.chat.scrollTop = els.chat.scrollHeight - fromBottom;
});
}
function composerChipsCollapsed() {
try { return localStorage.getItem('rohapp.composerChipsCollapsed') === '1'; } catch (e) { return false; }
}
function toggleComposerChips() {
var collapsed = !composerChipsCollapsed();
try { localStorage.setItem('rohapp.composerChipsCollapsed', collapsed ? '1' : '0'); } catch (e) { /* kept for this session only */ }
renderComposerChips();
toast(collapsed ? 'أخفيت الاقتراحات. اضغط مطولاً على الزر لإظهارها' : 'أظهرت الاقتراحات');
}
function renderComposerChips() {
var holder = document.getElementById('composerChips');
if (!holder) return;
holder.classList.toggle('collapsed', composerChipsCollapsed());
var st = S();
var openDue = (st.dueItems || []).reduce(function (sum, d) { return sum + (d.remaining || 0); }, 0);
var now = new Date();
var key = (st.entries || []).length + '|' + openDue + '|' + E.todayISO() + '|' + now.getHours() + '|' + E.mainCurrency();
if (holder.childElementCount && !exampleChipsStale && key === suggestionsKey) return;
suggestionsKey = key;
exampleChipsStale = false;
var _h = new Date().getHours();
var _ex = function (s) { return E.exampleInMainCurrency ? E.exampleInMainCurrency(s) : s; };
var _quick = [];
if (_h >= 5 && _h < 12) _quick = [_ex('دفعت 25 ريال فطور'), _ex('دفعت 50 ريال بنزين'), _ex('عهدة مندوب 500 ريال')];
else if (_h >= 12 && _h < 18) _quick = [_ex('قبضت 1000 ريال مبيعات كاش'), _ex('حصلت 500 ريال من خالد'), 'كم السيولة وملخص اليوم؟'];
else _quick = ['كم السيولة وملخص اليوم؟', 'كم رصيد الصندوق والبنك؟', _ex('سددت 500 ريال لمورد')];
var _seenChip = {};
_quick.forEach(function (q) { _seenChip[E.normalizeAr(q)] = true; });
var _quickHtml = _quick.map(function (q) { return '<button class="chip suggested" data-chip="' + esc(q) + '">' + esc(q) + '</button>'; }).join('');
var _engineChips = E.composerSuggestions(now.getTime(), 8).filter(function (s) {
var k = E.normalizeAr(s && s.text || '');
if (!k || _seenChip[k]) return false;
if (!s || s.smart !== true) return false;
_seenChip[k] = true;
return true;
}).slice(0, 6).map(suggestionChip).join('');
if (!_engineChips) {
_engineChips = '<button type="button" class="chip plain" disabled style="opacity:0.6;cursor:default">لا توجد مواعيد مستحقة</button>';
}
holder.innerHTML = '<button type="button" class="chip more suggest-btn" data-action="more-chips" aria-label="الاقتراحات" title="الاقتراحات">' +
'<svg class="ui-icon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M17 31C13 28 11 24 11 20A13 13 0 0 1 37 20C37 24 35 28 31 31V35H17Z"/><path d="M19 41H29M24 13V9M33 16L36 13M15 16L12 13"/></svg></button>' +
_quickHtml + _engineChips;
holder.scrollLeft = 0;
E.noteExamples(Array.prototype.map.call(holder.querySelectorAll('[data-chip].plain'), function (c) { return c.getAttribute('data-chip'); }), 'shown');
}
function suggestionChip(s) {
return '<button class="chip' + (s.smart || s.learned ? ' suggested' : ' plain') + '" data-chip="' + esc(s.text) + '"' +
(s.reason ? ' title="' + esc(s.reason) + '"' : '') + '>' + esc(s.text) + '</button>';
}
function openMoreChips() {
var all = E.composerSuggestions(Date.now(), 60);
var smart = all.filter(function (s) { return s.smart; });
var learned = all.filter(function (s) { return s.learned; });
var group = function (title, items) {
return items.length ? '<div class="search-group-title">' + title + '</div><div class="chips more-chips">' + items.map(suggestionChip).join('') + '</div>' : '';
};
openSheet('الاقتراحات',
'<p class="modal-note">اضغط للإرسال، أو مطولاً لتعديله. تتعلم القائمة منك: جملك المتكررة تُضاف، والأمثلة التي لا تستخدمها تختفي.</p>' +
group('من سجلاتك', smart) +
group('من استخدامك', learned) +
group('أمثلة', all.filter(function (s) { return !s.smart && !s.learned; })));
bindExampleChips(els.modalBody);
els.modal.classList.add('see-through', 'see-85');
}
var suggestionsKey = null;
var exampleChipsStale = false;
var chipPressTimer = null;
var chipPressStart = null;
var chipLongPressed = false;
function cancelChipPress() {
if (chipPressTimer) clearTimeout(chipPressTimer);
chipPressTimer = null;
}
function bindExampleChips(holder) {
holder.addEventListener('pointerdown', function (ev) {
var chip = ev.target.closest('[data-chip]');
chipLongPressed = false;
cancelChipPress();
if (!chip) return;
chipPressStart = { x: ev.clientX, y: ev.clientY };
chipPressTimer = setTimeout(function () {
chipPressTimer = null;
chipLongPressed = true;
try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) {}
var phrase = chip.getAttribute('data-chip');
if (holder === els.modalBody) closeSheet();
els.input.value = phrase;
els.input.dispatchEvent(new Event('input', { bubbles: true }));
els.input.focus();
els.input.setSelectionRange(els.input.value.length, els.input.value.length);
}, 500);
});
holder.addEventListener('pointermove', function (ev) {
if (!chipPressTimer || !chipPressStart) return;
if (Math.abs(ev.clientX - chipPressStart.x) > 10 || Math.abs(ev.clientY - chipPressStart.y) > 10) cancelChipPress();
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(function (name) {
holder.addEventListener(name, cancelChipPress);
});
holder.addEventListener('contextmenu', function (ev) {
if (ev.target.closest('[data-chip]')) ev.preventDefault();
});
holder.addEventListener('click', function (ev) {
if (ev.target.closest('[data-action="more-chips"]')) { openMoreChips(); return; }
var chip = ev.target.closest('[data-chip]');
if (!chip) return;
if (chipLongPressed) { chipLongPressed = false; return; }
exampleChipsStale = true;
var phrase = chip.getAttribute('data-chip');
E.noteExamples(phrase, 'tap');
if (holder === els.modalBody) closeSheet();
handleText(phrase);
});
}
function crisisWord(p) {
if (p >= 70) return 'مرتفع';
if (p >= 40) return 'متوسط';
return 'منخفض';
}
function sparkline(values) {
var max = 1;
values.forEach(function (v) { max = Math.max(max, Math.abs(v)); });
var w = 300, h = 74, pad = 6;
var step = (w - pad * 2) / Math.max(1, values.length - 1);
var zero = h / 2;
var y = function (v) { return zero - (v / max) * (h / 2 - pad); };
var pts = values.map(function (v, i) { return (pad + i * step).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ');
var area = pad + ',' + zero + ' ' + pts + ' ' + (pad + (values.length - 1) * step).toFixed(1) + ',' + zero;
return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="التدفق النقدي لآخر 14 يوماً">' +
'<polygon points="' + area + '" fill="var(--gold-soft)"></polygon>' +
'<line x1="0" y1="' + zero + '" x2="' + w + '" y2="' + zero + '" stroke="var(--line-strong)" stroke-width="1"></line>' +
'<polyline points="' + pts + '" fill="none" stroke="var(--emerald)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>' +
'</svg>';
}
var RADAR_SECTIONS = [
{ title: 'الآن', ids: [1, 2, 20] },
{ title: 'الشهر', ids: [3, 4, 5] },
{ title: 'المستحقات', ids: [12, 22] },
{ title: 'التحليل', ids: [6, 7, 8, 9] }
];
function radarCardPrefs() {
var st = S();
if (!st.settings) st.settings = {};
if (!Array.isArray(st.settings.radarCardOrder)) {
st.settings.radarCardOrder = [];
var rc = document.querySelectorAll('[data-radar-idx]');
rc.forEach(function (c) { st.settings.radarCardOrder.push(Number(c.getAttribute('data-radar-idx'))); });
}
if (!Array.isArray(st.settings.radarHiddenCards)) st.settings.radarHiddenCards = [];
return { order: st.settings.radarCardOrder, hidden: st.settings.radarHiddenCards };
}
function applyRadarCardPrefs() {
var root = els.radar;
if (!root) return;
var prefs = radarCardPrefs();
var hidden = prefs.hidden || [];
var order = prefs.order || [];
var cards = Array.prototype.slice.call(root.querySelectorAll('[data-radar-idx]'));
cards.forEach(function (c) {
var idx = Number(c.getAttribute('data-radar-idx'));
c.style.display = hidden.indexOf(idx) >= 0 ? 'none' : '';
});
var parent = cards.length ? cards[0].parentNode : null;
if (!parent) return;
var byIdx = {};
cards.forEach(function (c) { byIdx[Number(c.getAttribute('data-radar-idx'))] = c; });
var ordered = order.filter(function (idx) { return byIdx[idx]; }).concat(Object.keys(byIdx).map(Number).filter(function (idx) { return order.indexOf(idx) < 0; }));
ordered.forEach(function (idx) {
var c = byIdx[idx];
if (c && c.parentNode === parent && idx !== 0) parent.appendChild(c);
});
parent.querySelectorAll('.radar-section-title').forEach(function (h) { h.remove(); });
RADAR_SECTIONS.forEach(function (sec) {
var first = ordered.filter(function (idx) {
return sec.ids.indexOf(idx) >= 0 && hidden.indexOf(idx) < 0 && byIdx[idx] && byIdx[idx].parentNode === parent;
})[0];
if (first === undefined) return;
var heading = document.createElement('div');
heading.className = 'radar-section-title';
heading.textContent = sec.title;
parent.insertBefore(heading, byIdx[first]);
});
}
function openRadarPrefsSheet() {
var prefs = radarCardPrefs();
var hidden = prefs.hidden.slice();
var order = prefs.order.slice();
var root = els.radar;
var cards = root ? Array.prototype.slice.call(root.querySelectorAll('[data-radar-idx]')) : [];
var allIdx = cards.map(function (c) { return Number(c.getAttribute('data-radar-idx')); });
allIdx.forEach(function (idx) { if (order.indexOf(idx) < 0) order.push(idx); });
var titleByIdx = {};
cards.forEach(function (c) {
var t = c.querySelector('.section-title');
var _tidx = Number(c.getAttribute('data-radar-idx'));
var _tname = _tidx === 18 ? 'ديون لنا (العملاء)' : (_tidx === 19 ? 'ديون علينا (الموردون)' : null);
titleByIdx[_tidx] = _tname || (t ? t.textContent.trim().slice(0, 40) : ('بطاقة ' + c.getAttribute('data-radar-idx')));
});
var body = '<div id="radarPrefsRoot">' +
'<div class="muted" style="margin-bottom:8px;font-size:calc(12px*var(--font-scale,1))">أظهر/أخفِ البطاقات وأعد ترتيبها (▲▼).</div>' +
'<div id="radarPrefsList"></div>' +
'<div class="modal-actions" style="margin-top:10px;flex-wrap:wrap;gap:6px">' +
'<button type="button" class="btn primary" id="radarPrefsSave">حفظ</button>' +
'<button type="button" class="btn ghost" id="radarPrefsReset">إعادة تعيين</button>' +
'<button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button>' +
'</div>' +
'</div>';
openSheet('تخصيص لوحة القيادة', body);
function renderList() {
var list = document.getElementById('radarPrefsList');
if (!list) return;
list.innerHTML = order.map(function (idx, pos) {
var title = titleByIdx[idx] || ('بطاقة ' + idx);
var isHidden = hidden.indexOf(idx) >= 0;
return '<div class="row" style="align-items:center;gap:8px;padding:6px 0">' +
'<button type="button" class="btn ghost small" data-rp-up="' + pos + '" ' + (pos === 0 ? 'disabled' : '') + '>▲</button>' +
'<button type="button" class="btn ghost small" data-rp-down="' + pos + '" ' + (pos === order.length - 1 ? 'disabled' : '') + '>▼</button>' +
'<label style="flex:1 1 auto;display:flex;align-items:center;gap:6px;cursor:pointer">' +
'<input type="checkbox" data-rp-idx="' + idx + '" ' + (isHidden ? '' : 'checked') + '> ' + esc(title) +
'</label>' +
'</div>';
}).join('');
list.querySelectorAll('[data-rp-up]').forEach(function (b) {
b.addEventListener('click', function () {
var pos = Number(b.getAttribute('data-rp-up'));
if (pos <= 0) return;
var tmp = order[pos-1]; order[pos-1] = order[pos]; order[pos] = tmp;
renderList();
});
});
list.querySelectorAll('[data-rp-down]').forEach(function (b) {
b.addEventListener('click', function () {
var pos = Number(b.getAttribute('data-rp-down'));
if (pos >= order.length - 1) return;
var tmp = order[pos+1]; order[pos+1] = order[pos]; order[pos] = tmp;
renderList();
});
});
}
setTimeout(function () {
renderList();
var resetBtn = document.getElementById('radarPrefsReset');
if (resetBtn) resetBtn.addEventListener('click', function () {
var root = els.radar;
var cards = root ? Array.prototype.slice.call(root.querySelectorAll('[data-radar-idx]')) : [];
order = cards.map(function (c) { return Number(c.getAttribute('data-radar-idx')); });
hidden = [];
renderList();
toast('تم إعادة تعيين الترتيب');
});
var saveBtn = document.getElementById('radarPrefsSave');
if (saveBtn) saveBtn.addEventListener('click', function () {
var root2 = document.getElementById('radarPrefsRoot');
if (!root2) return;
var newHidden = [];
root2.querySelectorAll('input[data-rp-idx]').forEach(function (cb) {
if (!cb.checked) newHidden.push(Number(cb.getAttribute('data-rp-idx')));
});
var st = S();
st.settings.radarCardOrder = order.slice();
st.settings.radarHiddenCards = newHidden;
E.saveState();
toast('تم حفظ تخصيص لوحة القيادة');
renderAll();
var modal = document.getElementById('modal');
if (modal) modal.classList.remove('open');
});
}, 50);
}
function renderRadar() {
var a = E.computeAnalysis();
var st = S();
var emptyBook = a.entryCount === 0;
var html = '<div class="radar-toolbar">' +
'<button class="btn ghost small" data-action="open-status-card">📸 بطاقة الحالة (PNG)</button>' +
'<button class="btn ghost small" data-action="radar-prefs">تخصيص</button>' +
'<button class="btn ghost small" data-action="export-dashboard">تصدير CSV</button>' +
'</div>';
var _liqCurParts = Object.keys(a.liquidityByCurrency || {}).filter(function (c) {
var info = a.liquidityByCurrency[c];
var nat = info && typeof info === 'object' ? (Number(info.native) || 0) : (Number(info) || 0);
return c !== E.BASE && nat !== 0;
}).map(function (c) {
var info = a.liquidityByCurrency[c];
var nat = info && typeof info === 'object' ? (Number(info.native) || 0) : (Number(info) || 0);
return money(nat, c);
});
html += '<div data-radar-idx="0" class="card hero">' +
'<div class="hero-label"><span class="dot"></span> السيولة المتاحة</div>' +
'<div class="hero-value amount">' + money(a.liquidity) + '</div>' +
(_liqCurParts.length ? '<div style="font-size:calc(11.5px * var(--font-scale,1));opacity:.88;margin-top:2px">' + _liqCurParts.join(' • ') + '</div>' : '') +
'<div class="hero-sub">' +
'<span class="pill ' + (a.crisis >= 60 ? 'gold' : '') + '">' + a.crisis + '% احتمال ضغط</span>' +
'<span class="pill">' + (emptyBook ? 'بانتظار البيانات' : (a.runwayDays === null ? 'مستقر' : a.runwayDays + ' يوم مدى مالي')) + '</span>' +
'<span class="pill">' + (a.totals.imbalance === 0 ? 'دفاتر متوازنة ✓' : 'اختلال ✗') + '</span>' +
'</div>' + (emptyBook ? '<button class="btn primary small" data-action="go-tab" data-tab-name="bot" style="margin-top:10px">ابدأ من البوت</button>' : '') + '</div>';
html += '<div class="kpi-grid">' +
kpi('صافي الثروة', money(a.netWorth), a.netWorth >= 0 ? 'good' : 'warn') +
kpi('حرق 30 يوماً', money(a.burn30), a.burn30 > 0 ? '' : 'good') +
kpi('استحقاقات قريبة', money(a.dueSoon), a.dueSoon > 0 ? 'warn' : 'good') +
kpi('عدد القيود', String(a.entryCount), '') +
'</div>';
var _recTotal = 0, _payTotal = 0;
var _clientsWithDebt = [];
var _suppliersWithDebt = [];
(E.getState().accounts || []).forEach(function (acc) {
if (acc.type === 'asset' && !acc.liquid) {
var bal = 0;
Object.keys(acc.currencyBalances || {}).forEach(function (cur) {
var v = acc.currencyBalances[cur] || 0;
if (v > 0) bal += v * (E.getRate ? E.getRate(cur) : 1);
});
if (bal > 0) { _recTotal += bal; _clientsWithDebt.push({ name: acc.name, bal: bal }); }
}
if (acc.type === 'liability' && !acc.liquid) {
var bal2 = 0;
Object.keys(acc.currencyBalances || {}).forEach(function (cur) {
var v = acc.currencyBalances[cur] || 0;
if (v < 0) bal2 += Math.abs(v) * (E.getRate ? E.getRate(cur) : 1);
});
if (bal2 > 0) { _payTotal += bal2; _suppliersWithDebt.push({ name: acc.name, bal: bal2 }); }
}
});
var _recByCur = {}, _payByCur = {};
(a.dueItems || []).forEach(function (d) {
if (!d || d.settled || !(d.remaining > 0)) return;
var dc = d.currency || E.BASE;
var dn = Number(d.remainingNative != null ? d.remainingNative : d.remaining) || 0;
if (d.kind === 'receivable') _recByCur[dc] = (_recByCur[dc] || 0) + dn;
else if (d.kind === 'payable') _payByCur[dc] = (_payByCur[dc] || 0) + dn;
});
var _recCurStr = Object.keys(_recByCur).filter(function (c) { return c !== E.BASE && _recByCur[c] > 0; }).map(function (c) { return money(_recByCur[c], c); }).join(' • ');
var _payCurStr = Object.keys(_payByCur).filter(function (c) { return c !== E.BASE && _payByCur[c] > 0; }).map(function (c) { return money(_payByCur[c], c); }).join(' • ');
html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">' +
'<div data-radar-idx="18" class="card" style="padding:12px;border:1px solid var(--emerald, #10b981)">' +
'<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
'<span class="debt-icon" aria-hidden="true">' + UI_ICONS.receivable + '</span>' +
'<span style="font-weight:700;font-size:calc(12px * var(--font-scale,1))">ديون لنا (العملاء)</span></div>' +
'<div style="font-size:calc(20px * var(--font-scale,1));font-weight:800;color:var(--emerald, #10b981)">' + money(_recTotal) + '</div>' +
(_recCurStr ? '<div style="font-size:calc(10.5px * var(--font-scale,1));color:var(--muted)">' + _recCurStr + '</div>' : '') +
'<div style="font-size:calc(11px * var(--font-scale,1));color:var(--muted);margin-top:2px">' + _clientsWithDebt.length + ' عملاء</div>' +
'</div>' +
'<div data-radar-idx="19" class="card" style="padding:12px;border:1px solid var(--gold, #d4a017)">' +
'<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
'<span class="debt-icon" aria-hidden="true">' + UI_ICONS.payable + '</span>' +
'<span style="font-weight:700;font-size:calc(12px * var(--font-scale,1))">ديون علينا (الموردون)</span></div>' +
'<div style="font-size:calc(20px * var(--font-scale,1));font-weight:800;color:var(--gold, #d4a017)">' + (_payTotal > 0 ? '-' : '') + money(_payTotal) + '</div>' +
(_payCurStr ? '<div style="font-size:calc(10.5px * var(--font-scale,1));color:var(--muted)">' + _payCurStr + '</div>' : '') +
'<div style="font-size:calc(11px * var(--font-scale,1));color:var(--muted);margin-top:2px">' + _suppliersWithDebt.length + ' موردين</div>' +
'</div></div>';
if (a.alerts.length) {
html += '<div data-radar-idx="1" class="card" style="padding:12px">' + a.alerts.map(function (al) {
return '<div class="alert ' + al.type + '" style="margin-bottom:6px"><span class="a-glyph">' +
(al.type === 'danger' ? '⚠' : '◆') + '</span><span>' + esc(al.text) + '</span>' + (al.fixable ? '<button class="btn ghost small" data-action="fix-overdraft" data-id="' + esc(al.accountId || '') + '" style="margin-right:8px">إصلاح</button>' : '') + '</div>';
}).join('') + '</div>';
}
var _radarFilter = ui.radarFilter || 'ALL';
var _todayStr = new Date().toISOString().slice(0, 10);
var _dueEntries = (E.getState().entries || []).filter(function (e) { return e.dueDate || (e.lines || []).some(function (l) { return l.dueDate; }); }).map(function (e) {
var _td = e.dueDate || ((e.lines || []).filter(function (l) { return l.dueDate; })[0] || {}).dueDate || _todayStr;
var _dd = Math.ceil((new Date(_td).getTime() - new Date(_todayStr).getTime()) / (1000 * 3600 * 24));
var _st = 'UPCOMING';
if (_dd < 0) _st = 'OVERDUE';
else if (_dd === 0) _st = 'TODAY';
else if (_dd <= 7) _st = 'WEEK';
return { entry: e, dueDate: _td, diffDays: _dd, status: _st };
}).sort(function (a, b) { return a.diffDays - b.diffDays; });
var _filteredDue = _dueEntries.filter(function (item) {
if (_radarFilter === 'ALL') return true;
return item.status === _radarFilter;
});
if (_dueEntries.length > 0) {
html += '<div data-radar-idx="20" class="card" style="padding:12px">' +
'<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px">' +
'<div class="section-title" style="margin:0"><span>رادار مواعيد الاستحقاق</span></div>' +
'<div style="display:flex;gap:4px;flex-wrap:wrap">' +
['ALL','OVERDUE','TODAY','WEEK'].map(function (f) {
var _label = f === 'ALL' ? 'الكل (' + _dueEntries.length + ')' : f === 'OVERDUE' ? 'متأخرة' : f === 'TODAY' ? 'اليوم' : 'هذا الأسبوع';
var _active = _radarFilter === f;
return '<button class="btn ' + (_active ? 'primary' : 'ghost') + ' small" data-action="radar-filter" data-filter="' + f + '" style="font-size:calc(11px * var(--font-scale,1))">' + _label + '</button>';
}).join('') +
'</div></div>';
if (_filteredDue.length === 0) {
html += '<div class="muted" style="text-align:center;padding:8px">لا توجد استحقاقات في هذا التصنيف</div>';
} else {
_filteredDue.slice(0, 10).forEach(function (item) {
var e = item.entry;
var _isOverdue = item.status === 'OVERDUE';
var _isToday = item.status === 'TODAY';
html += '<div style="padding:8px;margin-bottom:6px;border-radius:8px;background:var(--card-bg,rgba(0,0,0,.04));border:1px solid var(--border)">' +
'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' +
'<div style="flex:1;min-width:0">' +
'<div style="font-weight:600;font-size:calc(12.5px * var(--font-scale,1));white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(e.memo || e.description || 'قيد #' + e.id) + '</div>' +
'<div style="font-size:calc(11px * var(--font-scale,1));color:var(--muted);margin-top:2px">استحقاق: ' + esc(item.dueDate) + ' · ' +
(item.diffDays < 0 ? 'متأخر ' + Math.abs(item.diffDays) + ' يوم' : item.diffDays === 0 ? 'اليوم!' : 'متبقي ' + item.diffDays + ' يوم') + '</div>' +
'</div>' +
'<div style="text-align:left">' +
'<div style="font-weight:700;font-size:calc(13px * var(--font-scale,1))">' + money(e.totalBase) + '</div>' +
'<button class="btn primary small" data-action="settle-due" data-id="' + esc(e.id) + '" style="margin-top:4px;font-size:calc(11px * var(--font-scale,1))">تسوية سريعة</button>' +
'</div></div></div>';
});
}
html += '</div>';
}
var pendingDrafts = (E.getState().drafts || []).length;
if (pendingDrafts > 0) {
html += '<div data-radar-idx="2" class="card" style="padding:12px;border:1px solid var(--gold,#d4a017);background:var(--gold-soft,rgba(212,160,23,.08))">' +
'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
'<span style="font-weight:700"><span class="a-glyph" style="color:var(--gold,#d4a017)">◆</span> ' + pendingDrafts + ' قيد بانتظار التأكيد</span>' +
'<button class="btn primary small" data-action="go-tab" data-tab-name="bot" style="min-width:80px">عرض وتأكيد</button>' +
'</div>' +
'<div class="muted" style="font-size:calc(11.5px * var(--font-scale,1));margin-top:6px">افتح المحادثة لتأكيد أو إلغاء كل قيد.</div>' +
'</div>';
}
var pDef = activePersonaDef();
if (pDef) {
html += '<div data-radar-idx="3" class="card" style="padding:12px">' +
'<div class="section-title" style="margin:0 0 6px"><span>طابع الدفاتر: ' + esc(pDef.title) + '</span>' +
(E.getState().entries.length || E.getState().drafts.length ? '' : '<button class="btn ghost small" data-action="open-onboarding">تغيير</button>') + '</div>';
if (pDef.key === 'student') {
var net30 = (a.income30 || 0) - (a.burn30 || 0);
html += row('الدخل / المكافأة (30 يوم)', '<span class="amount pos">' + money(a.income30 || 0) + '</span>') +
row('المصروفات (30 يوم)', '<span class="amount neg">' + money(a.burn30 || 0) + '</span>') +
row('المتبقي الصافي', '<span class="amount ' + (net30 >= 0 ? 'pos' : 'neg') + '">' + money(net30) + '</span>');
} else if (pDef.key === 'merchant') {
var recTotal = 0, payTotal = 0;
(a.dueItems || []).forEach(function (d) {
if (d.kind === 'payable') payTotal += (Number(d.remaining) || 0);
else recTotal += (Number(d.remaining) || 0);
});
html += row('صافي الذمم التجارية', '<span class="amount ' + (recTotal - payTotal >= 0 ? 'pos' : 'neg') + '">' + money(recTotal - payTotal) + '</span>');
} else if (pDef.key === 'investor') {
var invAssets = Math.max(0, (a.assets || 0) - (a.liquidity || 0));
var invPct = (a.assets > 0) ? Math.round((invAssets / a.assets) * 100) : 0;
html += row('الأصول الاستثمارية وغير السائلة', '<span class="amount">' + money(invAssets) + ' (' + invPct + '%)</span>') +
row('السيولة النقدية الجاهزة', '<span class="amount">' + money(a.liquidity || 0) + '</span>');
}
html += '</div>';
}
var budgets = (E.budgetList ? E.budgetList() : []);
html += '<div data-radar-idx="4" class="card" style="padding:12px">' +
'<div class="section-title" style="margin:0 0 6px"><span>الميزانيات (هذا الشهر)</span>' +
'<button class="btn ghost small" data-action="open-budgets">' + (budgets.length ? 'إدارة (' + budgets.length + ')' : '＋ ميزانية') + '</button></div>';
if (budgets.length) {
budgets.forEach(function (b) {
var stt = E.budgetStatus(b.accountId);
if (!stt) return;
var acc = E.getAccount(b.accountId);
var name = acc ? acc.name : b.accountId;
var pct = Math.min(100, stt.pct);
var color = stt.over ? 'var(--danger)' : (pct >= 80 ? 'var(--gold)' : 'var(--emerald)');
var limitBase = stt.limitBase || stt.budget.monthlyLimitMinor;
html += '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size: calc(12px * var(--font-scale, 1))"><span>' + esc(name) + '</span><span class="amount">' + money(stt.spentMinor) + ' / ' + money(limitBase) + ' (' + stt.pct + '%)</span></div>' +
'<div style="height:8px;background:var(--sand);border-radius:4px;margin-top:4px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:4px"></div></div>' +
(stt.over ? '<div class="muted" style="color:var(--danger);font-size: calc(11px * var(--font-scale, 1))">تجاوزت الميزانية بـ ' + money(stt.spentMinor - limitBase) + '</div>' : '') +
'</div>';
});
} else {
html += '<div class="muted" style="font-size: calc(12px * var(--font-scale, 1))">حدد سقفاً شهرياً للمصروفات لتنبيهك قبل تجاوزه.</div>';
}
html += '</div>';
var recItems = (a.dueItems || []).filter(function (d) { return d.kind !== 'payable'; });
var payItems = (a.dueItems || []).filter(function (d) { return d.kind === 'payable'; });
if (recItems.length > 0) renderDueCard(12, 'استحقاقات لنا (Receivables)', recItems, 'لا توجد ديون مستحقة لنا.<br>سجّل «سلفت فلان 1000» لتظهر هنا.');
if (payItems.length > 0) renderDueCard(22, 'استحقاقات علينا (Payables)', payItems, 'لا توجد ديون مستحقة علينا.<br>سجّل «اشتريت ... بالآجل» لتظهر هنا.');
var recList = (E.recurringList ? E.recurringList() : []);
var recDueList = (E.recurringDue ? E.recurringDue() : []);
html += '<div data-radar-idx="5" class="card" style="padding:12px">' +
'<div class="section-title" style="margin:0 0 6px"><span>القيود المتكررة</span>' +
'<button class="btn ghost small" data-action="open-recurring">' + (recList.length ? 'إدارة (' + recList.length + ')' : '＋ قيد متكرر') + '</button></div>';
if (recDueList.length) {
recDueList.slice(0, 5).forEach(function (r) {
html += '<div class="row">' +
'<span class="r-main"><span class="r-title">' + esc(r.memo) + ' <span class="badge soon">مستحق</span></span>' +
'<span class="r-sub">' + esc(E.fmtDate(r.nextDate)) + '</span></span>' +
'<span class="r-value" style="display:flex;align-items:center;gap:4px">' +
'<button class="btn primary small" data-action="run-recurring" data-id="' + esc(r.id) + '">تسجيل</button>' +
'<span class="amount">' + money(r.amountMinor, r.currency) + '</span></span></div>';
});
} else if (recList.length) {
html += '<div class="muted" style="font-size: calc(12px * var(--font-scale, 1))">لديك ' + recList.length + ' قيد متكرر مجدول — لا يوجد مستحق اليوم.</div>';
} else {
html += '<div class="muted" style="font-size: calc(12px * var(--font-scale, 1))">أضف الإيجار أو الرواتب أو الاشتراكات لتسجيلها بضغطة واحدة.</div>';
}
html += '</div>';
(function () {
var a2 = E.computeAnalysis();
var base = Math.max(0, (a2.assets || 0) - (a2.liabilities || 0));
var due = Math.round(base * 0.025);
html += '<div data-radar-idx="6" class="card" style="padding:12px">' +
'<div class="section-title" style="margin:0 0 6px"><span>زكاة النقود والمدخرات (2.5%)</span>' +
'<button class="btn ghost small" data-action="open-zakat">تفاصيل</button></div>' +
row('الزكاة المستحقة', '<span class="amount pos">' + money(due) + '</span>') +
'<div class="muted" style="font-size: calc(11px * var(--font-scale, 1));margin-top:4px">2.5% من صافي الثروة إذا بلغ النصاب (≈ 85 غرام ذهب) وحال عليه الحول.</div>' +
'</div>';
})();
(function () {
var st = S();
var byAcc = {};
var byMonth = {};
(st.entries || []).forEach(function (e) {
if (!e || !e.date) return;
var ym = String(e.date).slice(0, 7);
if (!byMonth[ym]) byMonth[ym] = { inc: 0, exp: 0 };
(e.lines || []).forEach(function (l) {
var acc = E.getAccount(l.accountId);
if (!acc) return;
var amt = (Number(l.debitBase) || 0) - (Number(l.creditBase) || 0);
if (acc.type === 'expense') {
byAcc[acc.name] = (byAcc[acc.name] || 0) + Math.max(0, amt);
byMonth[ym].exp += Math.max(0, amt);
}
if (acc.type === 'revenue') {
byMonth[ym].inc += Math.max(0, -amt);
}
});
});
var pieItems = Object.keys(byAcc).map(function (k) { return { name: k, value: byAcc[k] }; })
.filter(function (x) { return x.value > 0; })
.sort(function (x, y) { return y.value - x.value; })
.slice(0, 6);
var pieTotal = pieItems.reduce(function (s, x) { return s + x.value; }, 0);
var months = Object.keys(byMonth).sort().slice(-6);
var maxBar = 1;
months.forEach(function (m) { maxBar = Math.max(maxBar, byMonth[m].inc, byMonth[m].exp); });
if (pieItems.length || months.length) {
html += '<div data-radar-idx="7" class="card" style="padding:12px">' +
'<div class="section-title" style="margin:0 0 6px"><span>تحليلات متقدمة</span><span class="badge">آخر 6 أشهر</span></div>';
if (pieItems.length) {
var colors = ['var(--emerald)', 'var(--gold)', 'var(--danger)', 'var(--ok)', 'var(--muted)', 'var(--line-strong)'];
var cx = 60, cy = 60, r = 50, startAngle = 0;
var paths = '';
pieItems.forEach(function (it, idx) {
var angle = pieTotal > 0 ? (it.value / pieTotal) * 360 : 0;
var endAngle = startAngle + angle;
var x1 = cx + r * Math.cos((startAngle - 90) * Math.PI / 180);
var y1 = cy + r * Math.sin((startAngle - 90) * Math.PI / 180);
var x2 = cx + r * Math.cos((endAngle - 90) * Math.PI / 180);
var y2 = cy + r * Math.sin((endAngle - 90) * Math.PI / 180);
var large = angle > 180 ? 1 : 0;
paths += '<path d="M' + cx + ',' + cy + ' L' + x1 + ',' + y1 + ' A' + r + ',' + r + ' 0 ' + large + ',1 ' + x2 + ',' + y2 + ' Z" fill="' + colors[idx % colors.length] + '" opacity="0.85"/>';
startAngle = endAngle;
});
html += '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">' +
'<svg viewBox="0 0 120 120" width="110" height="110" style="flex:0 0 auto">' + paths + '</svg>' +
'<div style="flex:1 1 120px;min-width:0">' +
pieItems.map(function (it, idx) {
return '<div style="display:flex;align-items:center;gap:6px;font-size:calc(11.5px * var(--font-scale,1));margin-bottom:3px">' +
'<span style="width:10px;height:10px;border-radius:3px;background:' + colors[idx % colors.length] + ';flex:0 0 auto"></span>' +
'<span style="flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(it.name) + '</span>' +
'<span class="amount" style="flex:0 0 auto">' + money(it.value) + '</span>' +
'</div>';
}).join('') +
'</div>' +
'</div>';
}
if (months.length) {
var barW = 28, gap = 8, chartW = months.length * (barW * 2 + gap) + gap, chartH = 90;
var bars = '';
months.forEach(function (m, idx) {
var x = gap + idx * (barW * 2 + gap);
var incH = maxBar > 0 ? (byMonth[m].inc / maxBar) * (chartH - 12) : 0;
var expH = maxBar > 0 ? (byMonth[m].exp / maxBar) * (chartH - 12) : 0;
bars += '<rect x="' + x + '" y="' + (chartH - incH) + '" width="' + barW + '" height="' + incH + '" fill="var(--emerald)" opacity="0.85" rx="3"/>';
bars += '<rect x="' + (x + barW) + '" y="' + (chartH - expH) + '" width="' + barW + '" height="' + expH + '" fill="var(--danger)" opacity="0.8" rx="3"/>';
bars += '<text x="' + (x + barW) + '" y="' + (chartH + 11) + '" text-anchor="middle" font-size="9" fill="var(--muted)">' + esc(m.slice(5)) + '</text>';
});
html += '<svg viewBox="0 0 ' + chartW + ' ' + (chartH + 14) + '" style="width:100%;height:auto;margin-top:6px" preserveAspectRatio="xMidYMid meet">' + bars + '</svg>' +
'<div style="display:flex;gap:12px;justify-content:center;margin-top:4px;font-size:calc(10px * var(--font-scale,1))">' +
'<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:var(--emerald)"></span>إيرادات</span>' +
'<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:var(--danger)"></span>مصروفات</span>' +
'</div>';
}
html += '</div>';
}
})();
var nwSeries = (E.netWorthSeries ? E.netWorthSeries(30) : { points: (st.settings && Array.isArray(st.settings.netWorthHistory)) ? st.settings.netWorthHistory : [], deltaBase: 0, deltaPct: null });
var nwHist = nwSeries.points || [];
if (nwHist.length >= 2) {
var vals = nwHist.map(function (x) { return Number(x.value) || 0; });
var minV = Math.min.apply(null, vals), maxV = Math.max.apply(null, vals);
var range = (maxV - minV) || 1;
var w = 260, h = 60;
var pts = vals.map(function (v, i) {
var x = (i / (vals.length - 1)) * w;
var y = h - ((v - minV) / range) * h;
return x.toFixed(1) + ',' + y.toFixed(1);
}).join(' ');
var deltaSign = nwSeries.deltaBase > 0 ? '+' : '';
var deltaBadge = (nwSeries.deltaPct !== null && nwSeries.deltaPct !== undefined)
? ' (' + deltaSign + nwSeries.deltaPct + '%)'
: '';
html += '<div data-radar-idx="8" class="card" style="padding:12px"><div class="section-title" style="margin:0 0 4px"><span>تاريخ صافي الثروة</span><span class="badge ' + (nwSeries.deltaBase >= 0 ? 'ok' : 'overdue') + '">' + esc(deltaBadge.trim()) + '</span></div>' +
'<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:' + h + 'px" preserveAspectRatio="none">' +
'<polyline points="' + pts + '" fill="none" stroke="var(--emerald)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
'</svg>' +
'<div class="muted" style="font-size: calc(11px * var(--font-scale, 1));display:flex;justify-content:space-between"><span>' + esc(E.fmtDate(nwHist[0].date)) + '</span><span>التغير: ' + deltaSign + money(nwSeries.deltaBase || 0) + '</span><span>' + esc(E.fmtDate(nwHist[nwHist.length-1].date)) + '</span></div>' +
'</div>';
}
var meterPct = (emptyBook || a.runwayDays === null) ? (emptyBook ? 0 : 100) : Math.max(2, Math.min(100, Math.round(a.runwayDays / 90 * 100)));
var meterClass = emptyBook ? '' : (a.runwayDays === null ? 'good' : (a.runwayDays < 7 ? 'bad' : (a.runwayDays < 30 ? '' : 'good')));
html += '<div data-radar-idx="9" class="card">' +
'<div class="section-title" style="margin:0 0 4px"><span>المدى المالي</span><span class="badge">' +
(emptyBook ? 'لا بيانات' : (a.runwayDays === null ? 'لا يوجد حرق' : a.runwayDays + ' يوم')) + '</span></div>' +
'<div class="muted" style="font-size: calc(12px * var(--font-scale, 1))">' +
(emptyBook ? 'سجّل رصيدك الافتتاحي أو أول مصروف لتبدأ لوحة القيادة بتحليل وضعك.' :
a.liquidity <= 0 ? 'السيولة غير كافية — راجع المصروفات والاستحقاقات.' :
a.runwayDays === null ? 'لا توجد مصروفات مسجلة في آخر 30 يوماً.' :
'بهذا المعدل تستمر السيولة الحالية نحو ' + a.runwayDays + ' يوماً.') +
'</div>' +
'<div class="meter ' + meterClass + '"><i style="width:' + meterPct + '%"></i></div>' +
'</div>';
var mb = a.maturityBuckets || { overdue: {count:0,total:0}, soon:{count:0,total:0}, month:{count:0,total:0}, later:{count:0,total:0} };
var mbTotal = (mb.overdue.total||0)+(mb.soon.total||0)+(mb.month.total||0)+(mb.later.total||0);
var mbCount = (mb.overdue.count||0)+(mb.soon.count||0)+(mb.month.count||0)+(mb.later.count||0);
if (mbCount > 0) {
html += '<div data-radar-idx="10" class="card">' +
'<div class="section-title" style="margin:0 0 6px"><span>نضج الاستحقاقات</span><span class="badge">' + mbCount + ' بند</span></div>' +
mbRow('متأخر', mb.overdue, 'overdue') +
mbRow('هذا الأسبوع', mb.soon, 'soon') +
mbRow('خلال 30 يوم', mb.month, 'ok') +
mbRow('لاحق', mb.later, '') +
'<div class="divider"></div>' +
row('إجمالي مستحق', '<span class="amount">' + money(mbTotal) + '</span>') +
'</div>';
}
var net = a.spark.map(function (p) { return p.net; });
var hasFlow = net.some(function (v) { return v !== 0; });
html += '<div data-radar-idx="11" class="card">' +
'<div class="section-title" style="margin:0 0 2px"><span>التدفق النقدي — 14 يوماً</span><span class="badge">' +
(a.income30 > 0 ? 'دخل 30 يوم ' + money(a.income30) : esc(inMainCurrency())) + '</span></div>' +
(hasFlow ? sparkline(net) : '<div class="spark-empty">لا توجد حركة نقدية مسجلة بعد.<br><button class="btn primary small" data-action="go-tab" data-tab-name="bot" style="margin-top:6px">ابدأ من البوت</button></div>') +
'</div>';
function renderDueCard(cardIdx, title, items, emptyText) {
var total = items.reduce(function (s, d) { return s + (Number(d.remaining) || 0); }, 0);
html += '<div data-radar-idx="' + cardIdx + '" class="card">' +
'<div class="section-title" style="margin:0 0 2px"><span>' + title + '</span><span class="badge">' +
items.length + ' بند</span></div>' +
(items.length ? '<div class="row" style="border-top:0;padding-top:0"><span class="r-main"><span class="r-title" style="font-weight:800">الإجمالي</span></span><span class="r-value"><span class="amount">' + money(total) + '</span></span></div>' : '');
if (!items.length) {
html += '<div class="empty"><span class="glyph">◎</span>' + emptyText + '</div>';
} else {
items.slice(0, 10).forEach(function (d) {
var payable = d.kind === 'payable';
var badgeClass = d.status.key === 'overdue' ? 'overdue' : (d.status.key === 'soon' ? 'soon' : 'ok');
html += '<div class="row" style="align-items:flex-start">' +
'<span class="r-main" style="flex:1 1 auto;min-width:0"><span class="r-title">' + esc(d.counterparty || 'غير محدد') +
' <span class="badge ' + badgeClass + '">' + esc(d.status.label) + '</span></span>' +
'<span class="r-sub">' + (payable ? 'علينا' : 'لنا') + ' • ' + (d.dueDate ? E.fmtDate(d.dueDate) : 'بدون تاريخ') +
(d.defaulted ? ' • تاريخ افتراضي' : '') + '</span></span>' +
'<span class="r-value" style="flex:0 0 auto"><span class="amount ' + (payable ? 'neg' : 'pos') + '">' + money(d.remaining) +
(d.currency && d.currency !== E.BASE ? '<br><small>' + money(d.remainingNative, d.currency) + '</small>' : '') + '</span></span>' +
'</div>' +
'<div class="due-actions" style="margin:2px 0 10px;padding-inline-start:2px">' +
(d.counterparty ? '<button class="btn ghost small due-btn" data-action="print-counterparty" data-name="' + esc(d.counterparty) + '" title="كشف حساب الطرف">كشف</button>' : '') +
'<button class="btn ghost small due-btn" data-action="settle-partial" data-id="' + esc(d.id) + '" title="تسديد كامل أو جزئي">تسديد</button>' +
'<button class="btn ghost small due-btn" data-action="reminder-due" data-id="' + esc(d.id) + '" title="نسخ تذكير">تذكير</button>' +
'</div>';
});
if (items.length > 10) {
html += '<div class="muted" style="font-size: calc(11.5px * var(--font-scale, 1));margin-top:6px">+' + (items.length - 10) + ' استحقاق آخر في الدليل.</div>';
}
}
html += '</div>';
}
(function () {
var byCur = E.computeAnalysis().liquidityByCurrency || {};
var codes = Object.keys(byCur).filter(function (c) { return byCur[c].native !== 0; });
if (codes.length >= 2) {
html += '<div class="account-currency-strip" role="group" aria-label="السيولة حسب العملة" style="margin-bottom:10px"><span class="account-currency-label">حسب العملة</span>' +
codes.map(function (c) {
var part = byCur[c] || { native: 0, base: 0 };
return '<span class="account-cur-chip active" style="cursor:default">' +
'<span class="account-cur-code">' + esc(c) + '</span>' +
'<span class="account-cur-amount amount' + (part.native < 0 ? ' neg' : '') + '">' + money(part.native, c) + '</span>' +
(c !== E.BASE ? equivHtml(part.base, 'account-cur-equiv') : '') +
'</span>';
}).join('') + '</div>';
}
})();
html += '<div data-radar-idx="13" class="card">' +
'<div class="section-title" style="margin:0 0 2px"><span>أرصدة الحسابات</span><span class="badge">' +
(st.settings.hideAmounts ? 'مخفية' : esc(inMainCurrency())) + '</span></div>' +
a.liquidAccounts.map(function (l) {
return '<div class="row"><span class="r-main"><span class="r-title">' + esc(l.account.name) + '</span>' +
'<span class="r-sub">' + esc(l.account.hint) + '</span></span>' +
'<span class="r-value amount ' + (l.base >= 0 ? '' : 'neg') + '">' +
money(l.native, l.account.currency) + '</span></div>';
}).join('') +
'<div class="divider"></div>' +
row('إجمالي الأصول', '<span class="amount">' + money(a.assets) + '</span>') +
row('إجمالي الالتزامات', '<span class="amount">' + money(a.liabilities) + '</span>') +
row('صافي الربح', '<span class="amount ' + (a.profit >= 0 ? 'pos' : 'neg') + '">' + money(a.profit) + '</span>') +
'</div>';
var lbc = a.liquidityByCurrency || {};
var lbcKeys = Object.keys(lbc);
if (lbcKeys.length > 1 || (lbcKeys.length === 1 && lbcKeys[0] !== E.BASE)) {
html += '<div data-radar-idx="14" class="card">' +
'<div class="section-title" style="margin:0 0 6px"><span>السيولة حسب العملة</span><span class="badge">' + lbcKeys.length + '</span></div>';
lbcKeys.forEach(function (cur) {
var info = lbc[cur];
html += '<div class="row"><span class="r-main"><span class="r-title">' + esc(cur) + '</span>' +
'<span class="r-sub">أصلي</span></span>' +
'<span class="r-value amount">' + money(info.native, cur) + ' <span class="muted" style="font-size: calc(10.5px * var(--font-scale, 1))">(' + money(info.base) + ')</span></span></div>';
});
html += '<div class="divider"></div>' +
row('الإجمالي (SAR)', '<span class="amount">' + money(a.liquidity) + '</span>') +
'</div>';
}
if (!st.settings.simpleMode || a.totals.imbalance !== 0) {
html += '<div data-radar-idx="15" class="card">' +
'<div class="section-title" style="margin:0 0 2px"><span>سلامة الدفاتر</span>' +
'<span class="badge ' + (a.totals.imbalance === 0 ? 'ok' : 'overdue') + '">' +
(a.totals.imbalance === 0 ? 'متوازن' : 'اختلال') + '</span></div>' +
row('مجموع المدين', '<span class="amount">' + money(a.totals.debit) + '</span>') +
row('مجموع الدائن', '<span class="amount">' + money(a.totals.credit) + '</span>') +
row('الفرق', '<span class="amount ' + (a.totals.imbalance === 0 ? 'pos' : 'neg') + '">' + money(a.totals.imbalance) + '</span>') +
'</div>';
}
if (E.computeTradingRadar) {
var tr = E.computeTradingRadar();
var fc30 = E.computeCashFlowForecast ? E.computeCashFlowForecast(30) : [];
var fcEndBal = fc30.length ? fc30[fc30.length - 1].balance : a.liquidity;
var payoffSnow = E.computeDebtPayoffPlan ? E.computeDebtPayoffPlan('snowball') : null;
var expKeys = Object.keys((tr && tr.currencyExposure) || {});
html += '<div data-radar-idx="21" class="card" style="padding:12px">' +
'<div class="section-title" style="margin:0 0 6px"><span>رادار المخاطر والفرص والتنبؤ</span><span class="badge ' + ((tr.warnings && tr.warnings.length) ? 'soon' : 'ok') + '">' + ((tr.warnings && tr.warnings.length) ? (tr.warnings.length + ' تنبيه') : 'مستقر') + '</span></div>' +
row('أموال سائبة (Cash Drag)', '<span class="amount ' + (tr.cashDrag > 0 ? 'pos' : '') + '">' + (tr.cashDrag > 0 ? money(tr.cashDrag) : 'لا يوجد فائض عاطل') + '</span>') +
row('تركز المخاطر (≥30%)', '<span class="amount ' + (tr.concentrationRisk.length ? 'neg' : '') + '">' + (tr.concentrationRisk.length ? tr.concentrationRisk.map(function (c) { return esc(c.party) + ' (' + c.pct + '%)'; }).join('، ') : 'موزّع بأمان') + '</span>') +
row('انكشاف العملات (≥70%)', '<span class="amount">' + (expKeys.length ? expKeys.map(function (c) { return esc(c) + ' (' + tr.currencyExposure[c] + '%)'; }).join('، ') : 'متوازن') + '</span>') +
row('توقع السيولة (بعد 30 يوماً)', '<span class="amount ' + (fcEndBal >= 0 ? 'pos' : 'neg') + '">' + money(fcEndBal) + '</span>') +
(payoffSnow && payoffSnow.debts && payoffSnow.debts.length ? '<div class="muted" style="font-size:calc(11.5px * var(--font-scale, 1));margin-top:6px">' + esc(payoffSnow.suggestion) + '</div>' : '') +
'<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
'<button type="button" class="btn ghost small" data-action="open-ai-insight">🧭 التقرير الاستشاري الذكي</button>' +
'</div>' +
'</div>';
}
els.radar.innerHTML = html;
setTimeout(applyRadarCardPrefs, 0);
}
function kpi(label, value, tone) {
return '<div class="kpi ' + tone + '"><div class="k-label">' + esc(label) + '</div><div class="k-value amount">' + value + '</div></div>';
}
function mbRow(label, bucket, badgeClass) {
var b = bucket || { count: 0, total: 0 };
var badge = badgeClass ? '<span class="badge ' + badgeClass + '">' + b.count + '</span>' : '<span class="badge">' + b.count + '</span>';
return '<div class="row"><span class="r-main"><span class="r-title">' + esc(label) + ' ' + badge + '</span>' +
'<span class="r-sub">' + b.count + ' بند</span></span>' +
'<span class="r-value amount">' + money(b.total) + '</span></div>';
}
function filteredEntries() {
var st = S();
var key = ui.filter + '\x00' + ui.search + '\x00' + st.entries.length +
'\x00' + ((st.entries[st.entries.length - 1] || {}).createdAt || '');
if (ui._ledgerFiltered && ui._ledgerFiltered.key === key) return ui._ledgerFiltered.list;
var group = GROUPS[ui.filter];
var term = E.normalizeAr(ui.search);
var list = st.entries.filter(function (e) {
if (group && group.indexOf(e.kind) < 0) return false;
if (!ui.ledgerAdvFilter) ui.ledgerAdvFilter = { from: '', to: '', min: '', max: '', account: '', counterparty: '' };
var af = ui.ledgerAdvFilter;
if (af.from && e.date < af.from) return false;
if (af.to && e.date > af.to) return false;
if (af.counterparty && E.normalizeAr(e.counterparty || '').indexOf(E.normalizeAr(af.counterparty)) < 0) return false;
if (af.account) { var hasAcc = (e.lines || []).some(function (l) { return l.accountId === af.account; }); if (!hasAcc) return false; }
if (af.min !== '' && (Number(e.totalBase) || 0) / 100 < Number(af.min)) return false;
if (af.max !== '' && (Number(e.totalBase) || 0) / 100 > Number(af.max)) return false;
if (!term) return true;
var hay = E.normalizeAr((e.memo || '') + ' ' + (e.counterparty || '') + ' ' + (kindMeta(e.kind).label || '') + ' ' + (e.date || '') + ' ' + ((e.totalBase || 0) / 100));
(e.lines || []).forEach(function (l) { hay += ' ' + E.normalizeAr(accountName(l.accountId)); });
return hay.indexOf(term) >= 0;
});
list = list.sort(function (a, b) {
if (a.date !== b.date) return a.date < b.date ? 1 : -1;
return a.createdAt < b.createdAt ? 1 : -1;
});
ui._ledgerFiltered = { key: key, list: list };
return list;
}
var LEDGER_FILTER_ICONS = {
all: '<path d="M8 12H40M8 24H40M8 36H40"/>',
expense: '<path d="M12 36L36 12"/><path d="M18 12H36V30"/>',
income: '<path d="M36 12L12 36"/><path d="M30 36H12V18"/>',
debt: '<path d="M10 5H38V43L31 38L24 43L17 38L10 43Z"/><path d="M17 15H31M17 24H31"/>',
transfer: '<path d="M8 16H36M28 8L36 16L28 24"/><path d="M40 32H12M20 24L12 32L20 40"/>',
capital: '<circle cx="24" cy="24" r="18"/><path d="M24 24V6M24 24L37 37"/>'
};
function openReportsHub() {
var today = E.todayISO();
var body = '<div id="reportsHubRoot">' +
'<div class="field"><label>نوع التقرير</label><select id="hubType">' +
'<option value="cashflow">التدفق النقدي (Cash Flow)</option>' +
'<option value="balance">الميزانية (Balance Sheet)</option>' +
'<option value="pl">الأرباح والخسائر (P&L)</option>' +
'<option value="sankey">مخطط تدفق (Sankey)</option>' +
'<option value="debt-aging">أعمار الديون (Debt Aging)</option>' +
'<option value="zakat">زكاة (2.5%)</option>' +
'</select></div>' +
'<div class="form-pair"><div class="form-row"><label for="hubFrom">من</label><input id="hubFrom" type="date" value="' + today.slice(0, 8) + '01" /></div>' +
'<div class="form-row"><label for="hubTo">إلى</label><input id="hubTo" type="date" value="' + today + '" /></div></div>' +
'<div class="muted" style="font-size:calc(11px*var(--font-scale,1));margin-bottom:8px">* التدفق النقدي يدعم النطاق الزمني. остальные التقارير تُعرض حسب البيانات الحالية.</div>' +
'<div class="modal-actions"><button class="btn primary" type="button" id="hubShow">عرض التقرير</button>' +
'<button class="btn ghost" data-action="modal-cancel">إغلاق</button></div>' +
'</div>';
openSheet('تقرير مخصص (Custom Report)', body);
setTimeout(function () {
var btn = document.getElementById('hubShow');
if (!btn) return;
btn.addEventListener('click', function () {
var type = document.getElementById('hubType').value;
var from = document.getElementById('hubFrom').value;
var to = document.getElementById('hubTo').value;
if (type === 'cashflow') {
if (!from || !to || from > to) { toast('اختر فترة صحيحة', true); return; }
closeSheet();
printCashFlow(from, to);
} else if (type === 'balance') {
closeSheet(); printBalanceSheet();
} else if (type === 'pl') {
closeSheet(); printProfitLoss();
} else if (type === 'sankey') {
closeSheet(); printSankey();
} else if (type === 'debt-aging') {
closeSheet(); printDebtAging();
} else if (type === 'zakat') {
closeSheet(); openZakat();
}
});
}, 50);
}
function computeFactSummary(mode) {
var st = S();
var entries = st.entries || [];
var today = E.todayISO();
if (mode === 'monthly') {
var curMonth = today.slice(0, 7);
var y = Number(today.slice(0, 4));
var m = Number(today.slice(5, 7));
var pm = m === 1 ? 12 : (m - 1);
var py = m === 1 ? (y - 1) : y;
var prevMonth = py + '-' + (pm < 10 ? '0' + pm : pm);
var curSpent = 0, prevSpent = 0;
entries.forEach(function (e) {
if (!e || e.kind !== 'expense' || !e.date) return;
var ym = e.date.slice(0, 7);
if (ym === curMonth) curSpent += Number(e.totalBase) || 0;
else if (ym === prevMonth) prevSpent += Number(e.totalBase) || 0;
});
var diff = prevSpent - curSpent;
var diffText = diff >= 0
? ('وفّرت ' + plainMoney(diff) + '.')
: ('الزيادة: ' + plainMoney(Math.abs(diff)) + '.');
var text = 'الشهر الماضي: ' + plainMoney(prevSpent) + '. هذا الشهر: ' + plainMoney(curSpent) + '. ' + diffText;
return {
title: 'المقارنة الشهرية',
text: text,
rows: [
['الشهر الماضي (' + prevMonth + ')', money(prevSpent)],
['هذا الشهر (' + curMonth + ')', money(curSpent)],
[diff >= 0 ? 'التوفير' : 'الفارق', money(Math.abs(diff))]
]
};
}
if (mode === 'annual') {
var curYear = today.slice(0, 4);
var yearSpent = 0, yearIncome = 0;
var byCat = {};
var byMonth = {};
var monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
entries.forEach(function (e) {
if (!e || !e.date || e.date.slice(0, 4) !== curYear) return;
var amt = Number(e.totalBase) || 0;
if (e.kind === 'income') { yearIncome += amt; return; }
if (e.kind !== 'expense') return;
yearSpent += amt;
var mIdx = Number(e.date.slice(5, 7)) - 1;
var mName = monthNames[mIdx] || e.date.slice(0, 7);
byMonth[mName] = (byMonth[mName] || 0) + amt;
var catName = 'غير مصنف';
(e.lines || []).forEach(function (l) {
var acc = l && l.accountId ? E.getAccount(l.accountId) : null;
if (acc && acc.type === 'expense') {
catName = (acc.id === 'expense' || acc.name === 'المصروفات') ? 'غير مصنف' : acc.name;
}
});
byCat[catName] = (byCat[catName] || 0) + amt;
});
var topCat = '—', topCatAmt = 0;
Object.keys(byCat).forEach(function (k) {
if (byCat[k] > topCatAmt) { topCatAmt = byCat[k]; topCat = k; }
});
var topCatPct = yearSpent > 0 ? Math.round((topCatAmt / yearSpent) * 100) : 0;
var maxM = '—', maxMAmt = -1, minM = '—', minMAmt = Infinity;
Object.keys(byMonth).forEach(function (mKey) {
var v = byMonth[mKey];
if (v > maxMAmt) { maxMAmt = v; maxM = mKey; }
if (v < minMAmt) { minMAmt = v; minM = mKey; }
});
if (maxMAmt < 0) maxMAmt = 0;
if (!isFinite(minMAmt)) minMAmt = 0;
var savedYear = Math.max(0, yearIncome - yearSpent);
var savedPct = yearIncome > 0 ? Math.round((savedYear / yearIncome) * 100) : 0;
var textA = 'هذه السنة: ' + plainMoney(yearSpent) + '. الأعلى: ' + topCat + ' (' + plainMoney(topCatAmt) + '، ' + topCatPct + '%). أكبر شهر: ' + maxM + ' (' + plainMoney(maxMAmt) + '). أقل شهر: ' + minM + ' (' + plainMoney(minMAmt) + '). التوفير: ' + plainMoney(savedYear) + ' (' + savedPct + '%).';
return {
title: 'الملخص السنوي (' + curYear + ')',
text: textA,
rows: [
['إجمالي مصروفات السنة', money(yearSpent)],
['الفئة الأعلى (' + topCat + ')', money(topCatAmt) + ' (' + topCatPct + '%)'],
['أكبر شهر (' + maxM + ')', money(maxMAmt)],
['أقل شهر (' + minM + ')', money(minMAmt)],
['التوفير السنوي', money(savedYear) + ' (' + savedPct + '%)']
]
};
}
var since30 = E.addDays ? E.addDays(today, -29) : today;
var total30 = 0;
var cat30 = {};
var maxE = null, minE = null;
entries.forEach(function (e) {
if (!e || e.kind !== 'expense' || !e.date || e.date < since30 || e.date > today) return;
var amt = Number(e.totalBase) || 0;
if (amt <= 0) return;
total30 += amt;
var cName = 'غير مصنف';
(e.lines || []).forEach(function (l) {
var acc = l && l.accountId ? E.getAccount(l.accountId) : null;
if (acc && acc.type === 'expense') {
cName = (acc.id === 'expense' || acc.name === 'المصروفات') ? 'غير مصنف' : acc.name;
}
});
cat30[cName] = (cat30[cName] || 0) + amt;
var label = (e.memo || e.counterparty || cName).trim();
if (!maxE || amt > maxE.amt) maxE = { label: label, amt: amt };
if (!minE || amt < minE.amt) minE = { label: label, amt: amt };
});
var sortedCats = Object.keys(cat30).sort(function (a, b) { return cat30[b] - cat30[a]; });
var catParts = sortedCats.slice(0, 4).map(function (c) {
var pct = total30 > 0 ? Math.round((cat30[c] / total30) * 100) : 0;
return plainMoney(cat30[c]) + ' ' + c + ' (' + pct + '%)';
});
var maxStr = maxE ? (maxE.label + ' بـ ' + plainMoney(maxE.amt)) : '—';
var minStr = minE ? (minE.label + ' بـ ' + plainMoney(minE.amt)) : '—';
var text30 = 'صرفت ' + plainMoney(total30) + ' خلال 30 يوماً.' +
(catParts.length ? ' منها: ' + catParts.join('، ') + '.' : '') +
(maxE ? ' أكبر صرفية: ' + maxStr + '.' : '') +
(minE ? ' أصغر صرفية: ' + minStr + '.' : '');
var rows30 = [['إجمالي صرف 30 يوماً', money(total30)]];
sortedCats.forEach(function (c) {
var pct = total30 > 0 ? Math.round((cat30[c] / total30) * 100) : 0;
rows30.push([c + ' (' + pct + '%)', money(cat30[c])]);
});
if (maxE) rows30.push(['أكبر صرفية (' + maxE.label + ')', money(maxE.amt)]);
if (minE) rows30.push(['أصغر صرفية (' + minE.label + ')', money(minE.amt)]);
return {
title: 'الفاتورة الكاشفة (30 يوماً)',
text: text30,
rows: rows30
};
}
function openFactSummariesSheet(mode) {
mode = mode || 'invoice30';
window.__currentFactMode = mode;
var data = computeFactSummary(mode);
var tabs = [
['invoice30', 'الفاتورة الكاشفة (30 يوماً)'],
['monthly', 'المقارنة الشهرية'],
['annual', 'الملخص السنوي']
];
var html = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' +
tabs.map(function (t) {
var active = t[0] === mode;
return '<button type="button" class="btn ' + (active ? 'primary' : 'ghost') + ' small" data-action="switch-fact-tab" data-mode="' + t[0] + '" style="flex:1">' + esc(t[1]) + '</button>';
}).join('') +
'</div>' +
'<div style="padding:12px;border-radius:14px;background:var(--sand);border:1px solid var(--line-strong);font-weight:700;font-size:calc(13px * var(--font-scale, 1));line-height:1.7;margin-bottom:12px">' +
esc(data.text) +
'</div>' +
'<div class="card" style="padding:0;margin-bottom:12px">' +
data.rows.map(function (r) {
return '<div class="setting" style="padding:8px 12px"><div class="s-main"><span class="s-title">' + esc(r[0]) + '</span></div><b class="amount">' + r[1] + '</b></div>';
}).join('') +
'</div>' +
'<div class="row-actions" style="display:flex;gap:8px;flex-wrap:wrap">' +
'<button type="button" class="btn primary small" data-action="copy-fact-summary" style="flex:1">' + UI_ICONS.copy + ' نسخ الحقائق الرقمية</button>' +
'<button type="button" class="btn ghost small" data-action="post-fact-chat" style="flex:1">' + UI_ICONS.chat + ' إرسال للمحادثة</button>' +
'</div>';
openSheet(data.title, html);
}
function renderReports() {
if (!els.reports) return;
var html = '<div class="group-title">الحقائق المالية الكاشفة (أرقام مجردة بلا أحكام)</div>';
html += '<div class="card" style="padding:0;margin-bottom:12px">';
var factReports = [
['fact-invoice30', 'الفاتورة الكاشفة (30 يوماً)', 'إجمالي الصرف وتوزيعه وأكبر وأصغر عملية خلال 30 يوماً'],
['fact-monthly', 'المقارنة الشهرية', 'مقارنة الشهر الحالي بالشهر الماضي بالأرقام المجردة'],
['fact-annual', 'الملخص السنوي', 'إجمالي السنة، الفئة الأعلى، الشهر الأعلى والأقل، ونسبة التوفير']
];
factReports.forEach(function (fr) {
html += '<div class="setting"><div class="s-main"><span class="s-title">' + esc(fr[1]) + '</span>' +
'<span class="s-sub">' + esc(fr[2]) + '</span></div>' +
'<button class="btn primary small" data-action="' + fr[0] + '">عرض</button></div>';
});
html += '</div>';
html += '<div class="group-title">التقارير المحاسبية الرسمية (PDF)</div>';
html += '<div data-radar-idx="16" class="card" style="padding:0">';
var reports = [
['report-cashflow', 'التدفق النقدي', 'تقرير التدفق النقدي (Cash Flow)'],
['report-balance', 'الميزانية', 'الميزانية (Balance Sheet)'],
['profit-loss', 'الأرباح والخسائر', 'تقرير الأرباح والخسائر (P&L)'],
['zakat', 'زكاة (2.5%)', 'زكاة النقود والمدخرات'],
['sankey', 'مخطط تدفق (Sankey)', 'مخطط تدفق (Sankey)'],
['debt-aging', 'أعمار الديون', 'تقرير أعمار الديون (Debt Aging)'],
];
reports.forEach(function (r) {
html += '<div class="setting"><div class="s-main"><span class="s-title">' + esc(r[1]) + '</span>' +
'<span class="s-sub">' + esc(r[2]) + '</span></div>' +
'<button class="btn ghost small" data-action="' + r[0] + '">' + (r[0] === 'report-cashflow' ? 'عرض' : 'فتح') + '</button></div>';
});
html += '</div>';
html += '<div style="margin:8px 0"><button class="btn primary small" data-action="open-reports-hub">تقرير مخصص (Custom Report)</button></div>';
html += '<div style="margin:8px 0"><button class="btn ghost small" data-action="balance-compare">مقارنة الميزانية (Comparison)</button></div>';
html += '<div class="group-title" style="margin-top:16px">كشف حساب</div>';
html += '<div data-radar-idx="17" class="card" style="padding:0">';
html += '<div class="setting"><div class="s-main"><span class="s-title">كشف حساب (E-Statement)</span>' +
'<span class="s-sub">اختر حساباً لعرض كشفه</span></div>' +
'<button class="btn ghost small" data-action="open-statement-picker">اختيار</button></div>';
html += '<div class="setting"><div class="s-main"><span class="s-title">كشف حساب طرف</span>' +
'<span class="s-sub">اختر طرفاً لعرض كشفه</span></div>' +
'<button class="btn ghost small" data-action="open-counterparty-picker">اختيار</button></div>';
html += '</div>';
els.reports.innerHTML = html;
if (!els.reports._wired) {
els.reports._wired = true;
els.reports.addEventListener('click', function (ev) {
var btn = ev.target.closest('[data-action]');
if (!btn) return;
var action = btn.getAttribute('data-action');
if (action === 'report-cashflow') openCashFlowForm();
else if (action === 'fact-invoice30') openFactSummariesSheet('invoice30');
else if (action === 'fact-monthly') openFactSummariesSheet('monthly');
else if (action === 'fact-annual') openFactSummariesSheet('annual');
else if (action === 'report-balance') printBalanceSheet();
else if (action === 'profit-loss') printProfitLoss();
else if (action === 'zakat' || action === 'open-zakat') openZakat();
else if (action === 'sankey') printSankey();
else if (action === 'debt-aging') printDebtAging();
else if (action === 'open-statement-picker') openStatementPicker();
else if (action === 'open-counterparty-picker') openCounterpartyPicker();
else if (action === 'open-reports-hub') openReportsHub();
else if (action === 'balance-compare') openBalanceSheetCompare();
});
}
}
function saveEntryTemplate(entryId) {
var st = S();
var e = (st.entries || []).filter(function (x) { return x.id === entryId; })[0];
if (!e) { toast('القيد غير موجود', true); return; }
if (!st.settings) st.settings = {};
if (!Array.isArray(st.settings.entryTemplates)) st.settings.entryTemplates = [];
var tpl = {
id: 'tpl_' + Date.now(),
name: e.memo || (e.kind + ' ' + (e.totalBase / 100)),
kind: e.kind,
currency: e.currency,
counterparty: e.counterparty || '',
memo: e.memo || '',
lines: (e.lines || []).map(function (l) { return { accountId: l.accountId, currency: l.currency, debit: l.debit, credit: l.credit, note: l.note || '' }; }),
createdAt: new Date().toISOString()
};
st.settings.entryTemplates.push(tpl);
E.saveState();
toast('تم حفظ القالب: ' + tpl.name);
renderAll();
}
function openEntryTemplatesSheet() {
var st = S();
var templates = (st.settings && Array.isArray(st.settings.entryTemplates)) ? st.settings.entryTemplates : [];
var rows = templates.length ? templates.map(function (t) {
return '<div class="row" style="align-items:center;gap:8px">' +
'<span class="r-main" style="flex:1 1 auto;min-width:0"><span class="r-title">' + esc(t.name) + '</span>' +
'<span class="r-sub">' + esc(t.kind) + ' • ' + esc(t.currency) + ' • ' + (t.lines ? t.lines.length : 0) + ' سطر</span></span>' +
'<span class="r-value" style="display:flex;gap:4px">' +
'<button class="btn primary small" data-action="use-template" data-id="' + esc(t.id) + '">استخدام</button>' +
'<button class="btn danger small" data-action="del-template" data-id="' + esc(t.id) + '">حذف</button>' +
'</span>' +
'</div>';
}).join('') : '<div class="empty"><span class="glyph">◎</span>لا توجد قوالب. افتح قائمة قيد (⋮) واختر "حفظ كقالب".</div>';
var body = '<div id="entryTemplatesRoot">' + rows + '</div>';
openSheet('قوالب القيود (Entry Templates)', body);
setTimeout(function () {
var root = document.getElementById('entryTemplatesRoot');
if (!root) return;
root.querySelectorAll('[data-action="use-template"]').forEach(function (btn) {
btn.addEventListener('click', function () {
var tid = btn.getAttribute('data-id');
var tpl = (st.settings.entryTemplates || []).filter(function (t) { return t.id === tid; })[0];
if (!tpl) { toast('القالب غير موجود', true); return; }
var lines = (tpl.lines || []).map(function (l) {
return { accountId: l.accountId, currency: l.currency || tpl.currency, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, note: l.note || '' };
});
var res = E.addDraft({ kind: tpl.kind || 'compound', isCompound: true, lines: lines, currency: tpl.currency || E.BASE, amountMinor: 0, counterparty: tpl.counterparty || '', memo: tpl.memo || '', date: todayISO() });
if (res && res.ok && res.draft) {
var st2 = S();
pushMessage({ role: 'bot', type: 'draft', draftId: res.draft.id });
E.saveState();
renderAll();
toast('تم إنشاء قيد من القالب');
} else {
toast((res && res.error) || 'تعذر إنشاء القيد', true);
}
var modal = document.getElementById('modal');
if (modal) modal.classList.remove('open');
});
});
root.querySelectorAll('[data-action="del-template"]').forEach(function (btn) {
btn.addEventListener('click', function () {
var tid = btn.getAttribute('data-id');
var st2 = S();
if (st2.settings && Array.isArray(st2.settings.entryTemplates)) {
st2.settings.entryTemplates = st2.settings.entryTemplates.filter(function (t) { return t.id !== tid; });
E.saveState();
}
toast('تم حذف القالب');
openEntryTemplatesSheet();
});
});
}, 50);
}
function openLedgerAdvFilter() {
if (!ui.ledgerAdvFilter) ui.ledgerAdvFilter = { from: '', to: '', min: '', max: '', account: '', counterparty: '' };
var af = ui.ledgerAdvFilter;
var st = S();
var accOpts = '<option value="">الكل</option>' + st.accounts.map(function (a) { return '<option value="' + esc(a.id) + '"' + (af.account === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('');
var body = '<div id="ledgerAdvFilterRoot">' +
'<div class="form-pair"><div class="form-row"><label for="lafFrom">من تاريخ</label><input id="lafFrom" type="date" value="' + esc(af.from) + '" /></div>' +
'<div class="form-row"><label for="lafTo">إلى تاريخ</label><input id="lafTo" type="date" value="' + esc(af.to) + '" /></div></div>' +
'<div class="form-pair"><div class="form-row"><label for="lafMin">الحد الأدنى (مبلغ)</label><input id="lafMin" type="number" inputmode="decimal" value="' + esc(af.min) + '" /></div>' +
'<div class="form-row"><label for="lafMax">الحد الأقصى (مبلغ)</label><input id="lafMax" type="number" inputmode="decimal" value="' + esc(af.max) + '" /></div></div>' +
'<div class="field"><label for="lafAccount">الحساب</label><select id="lafAccount">' + accOpts + '</select></div>' +
'<div class="field"><label for="lafCounterparty">الطرف (counterparty)</label><input id="lafCounterparty" type="text" value="' + esc(af.counterparty) + '" /></div>' +
'<div class="modal-actions"><button type="button" class="btn primary" id="lafApply">تطبيق</button>' +
'<button type="button" class="btn ghost" id="lafClear">مسح</button>' +
'<button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button></div>' +
'</div>';
openSheet('فلتر متقدم (Ledger)', body);
setTimeout(function () {
var applyBtn = document.getElementById('lafApply');
var clearBtn = document.getElementById('lafClear');
if (applyBtn) applyBtn.addEventListener('click', function () {
ui.ledgerAdvFilter = {
from: document.getElementById('lafFrom').value || '',
to: document.getElementById('lafTo').value || '',
min: document.getElementById('lafMin').value || '',
max: document.getElementById('lafMax').value || '',
account: document.getElementById('lafAccount').value || '',
counterparty: document.getElementById('lafCounterparty').value || ''
};
ui._ledgerFiltered = null;
renderLedgerList();
toast('تم تطبيق الفلتر');
var modal = document.getElementById('modal');
if (modal) modal.classList.remove('open');
});
if (clearBtn) clearBtn.addEventListener('click', function () {
ui.ledgerAdvFilter = { from: '', to: '', min: '', max: '', account: '', counterparty: '' };
ui._ledgerFiltered = null;
renderLedgerList();
toast('تم مسح الفلتر');
var modal = document.getElementById('modal');
if (modal) modal.classList.remove('open');
});
}, 50);
}
function renderLedger() { ui.ledgerVisible = 50; ui._ledgerFiltered = null; ui._ledgerFilterUnchanged = false;
var filters = [
['all', 'الكل'], ['expense', 'مصروفات'], ['income', 'إيرادات'],
['debt', 'ديون'], ['transfer', 'تحويلات'], ['capital', 'رأس المال']
];
var html = '';
var allEntries = S().entries;
var counts = { all: allEntries.length };
var kindToGroup = {};
filters.forEach(function (f) {
if (f[0] === 'all') return;
counts[f[0]] = 0;
var g = GROUPS[f[0]];
(g || []).forEach(function (k) { kindToGroup[k] = f[0]; });
});
allEntries.forEach(function (e) {
var gk = kindToGroup[e.kind];
if (gk) counts[gk]++;
});
html += '<div class="filters icon-filters">' + filters.map(function (f) {
var active = ui.filter === f[0];
return '<button class="filter ' + (active ? 'active' : '') + '" aria-pressed="' + active + '" data-filter="' + f[0] + '">' +
drawnIcon(LEDGER_FILTER_ICONS[f[0]]) + f[1] + '<span class="filter-count">' + counts[f[0]] + '</span></button>';
}).join('') + '</div>';
html += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">' +
'<div class="search" style="flex:1;margin-bottom:0"><input id="ledgerSearch" type="search" aria-label="بحث في القيود" placeholder="ابحث في القيود والأطراف…" value="' + esc(ui.search) + '" /></div>' +
'<button type="button" class="row-menu-btn" data-action="ledger-options" aria-label="خيارات" aria-haspopup="menu" style="flex:0 0 auto;width:40px;height:40px;border-radius:10px;border:1px solid var(--line-strong);background:var(--sand);color:var(--ink);font-size:18px;line-height:1">⋮</button>' +
(ui.multiSelect ? '<button type="button" class="btn danger small" data-action="bulk-delete" style="flex:0 0 auto;white-space:nowrap">حذف (' + Object.keys(ui.selectedEntries).filter(function(k){return ui.selectedEntries[k];}).length + ')</button>' : '') +
'</div>';
html += '<div id="ledgerList"></div>';
els.ledger.innerHTML = html;
renderLedgerList();
}
var SUBTYPE_SAME = { 'عميل': 'العملاء', 'مورد': 'الموردون', 'النقد وما في حكمه': 'سيولة نقدية' };
function subtypeKey(subtype) {
return SUBTYPE_SAME[subtype] || subtype;
}
function subtypeLabel(subtype) {
return subtype === 'wallet' ? 'محفظة' : subtypeKey(subtype);
}
function accountMatchesFilter(acc, key) {
if (key === 'FAVORITE') return E.isFavoriteAccount(acc.id);
if (key === 'LIQUID') return !!acc.liquid;
if (key === 'NONLIQUID') return !acc.liquid;
return true;
}
function equivHtml(baseMinor, cls) {
return '<span class="' + cls + (baseMinor < 0 ? ' neg' : '') + '">≈ ' + money(Math.abs(baseMinor)) + '</span>';
}
function accountHoldsCurrency(acc, cur, bal) {
if (!acc.multi) return acc.currency === cur;
if ((acc.currencies || []).indexOf(cur) >= 0) return true;
return E.accountCurrencies(acc, bal).some(function (p) { return p.currency === cur; });
}
function accountsCurrencyStrip() {
var byCur = E.computeAnalysis().liquidityByCurrency || {};
var codes = Object.keys(byCur).filter(function (c) { return byCur[c].native !== 0 || c === ui.accountsCurrency; });
if (ui.accountsCurrency && codes.indexOf(ui.accountsCurrency) < 0) codes.push(ui.accountsCurrency);
if (codes.length < 2 && !ui.accountsCurrency) return '';
var main = E.mainCurrency();
return '<div class="account-currency-strip" role="group" aria-label="السيولة حسب العملة">' +
codes.map(function (c) {
var part = byCur[c] || { native: 0, base: 0 };
var active = ui.accountsCurrency === c;
return '<button type="button" class="account-cur-chip' + (active ? ' active' : '') + '" aria-pressed="' + active + '" data-acccurrency="' + esc(c) + '">' +
'<span class="account-cur-code">' + esc(c) + '</span>' +
'<span class="account-cur-amount amount' + (part.native < 0 ? ' neg' : '') + '">' + money(part.native, c) + '</span>' +
(c !== main ? equivHtml(part.base, 'account-cur-equiv') : '') +
'</button>';
}).join('') + '</div>';
}
function openCashReconSheet() {
var a = E.computeAnalysis();
var rows = (a.liquidAccounts || []).map(function (la) {
var acc = la.account;
return '<div class="row" style="align-items:center;gap:8px;flex-wrap:wrap">' +
'<span class="r-main" style="flex:1 1 120px;min-width:0"><span class="r-title">' + esc(acc.name) + '</span>' +
'<span class="r-sub">' + esc(acc.currency) + ' • دفتري: ' + money(la.base) + '</span></span>' +
'<input type="number" inputmode="decimal" step="any" class="cash-recon-input amount-input" data-acc="' + esc(acc.id) + '" data-cur="' + esc(acc.currency) + '" data-book="' + (la.base || 0) + '" placeholder="المعدود" style="width:110px;min-height:36px;padding:6px 8px;border-radius:10px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size:calc(12px*var(--font-scale,1))">' +
'<span class="cash-recon-diff" data-acc="' + esc(acc.id) + '" style="min-width:80px;text-align:end;font-weight:700">—</span>' +
'</div>';
}).join('');
var body = '<div id="cashReconRoot">' +
'<div class="muted" style="margin-bottom:8px;font-size:calc(12px*var(--font-scale,1))">أدخل المبالغ المعدودة (في عملة كل حساب). سيتم حساب الفرق (المعدود − الدفتري) بالعملة الأساسية.</div>' +
rows +
'<div class="divider"></div>' +
'<div class="row" style="font-weight:800"><span class="r-main"><span class="r-title">إجمالي الفرق</span></span><span class="r-value" id="cashReconTotal">—</span></div>' +
'<div class="modal-actions" style="margin-top:10px">' +
'<button type="button" class="btn primary" id="cashReconPost">تسجيل فرق (Auto-post)</button>' +
'<button type="button" class="btn ghost" id="cashReconCopy">نسخ التقرير</button>' +
'<button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button>' +
'</div>' +
'</div>';
openSheet('تسوية نقدية (Cash Reconciliation)', body);
setTimeout(function () {
var root = document.getElementById('cashReconRoot');
if (!root) return;
function recalc() {
var total = 0;
root.querySelectorAll('.cash-recon-input').forEach(function (inp) {
var book = Number(inp.getAttribute('data-book')) || 0;
var cur = inp.getAttribute('data-cur');
var rate = (cur === E.BASE) ? 1 : (E.getRate(cur) || 1);
var counted = inp.value === '' ? null : Number(inp.value);
var diff = (counted === null || isNaN(counted)) ? 0 : Math.round(counted * rate * 100 - book);
total += diff;
var diffEl = root.querySelector('.cash-recon-diff[data-acc="' + inp.getAttribute('data-acc') + '"]');
if (diffEl) {
diffEl.textContent = (counted === null || isNaN(counted)) ? '—' : ((diff > 0 ? '+' : '') + money(diff));
diffEl.style.color = (counted === null || isNaN(counted)) ? 'var(--muted)' : (diff === 0 ? 'var(--ok)' : (diff > 0 ? 'var(--emerald)' : 'var(--danger)'));
}
});
var totalEl = document.getElementById('cashReconTotal');
if (totalEl) {
totalEl.textContent = (total === 0 ? '—' : ((total > 0 ? '+' : '') + money(total)));
totalEl.style.color = total === 0 ? 'var(--muted)' : (total > 0 ? 'var(--ok)' : 'var(--danger)');
}
}
root.querySelectorAll('.cash-recon-input').forEach(function (inp) { inp.addEventListener('input', recalc); });
var copyBtn = document.getElementById('cashReconCopy');
if (copyBtn) copyBtn.addEventListener('click', function () {
var lines = ['تسوية نقدية — ' + new Date().toLocaleDateString('ar-SA')];
root.querySelectorAll('.cash-recon-input').forEach(function (inp) {
var acc = E.getAccount(inp.getAttribute('data-acc'));
lines.push((acc ? acc.name : inp.getAttribute('data-acc')) + ': دفتري ' + money(Number(inp.getAttribute('data-book')) || 0) + ' | معدود ' + (inp.value || '—') + ' ' + inp.getAttribute('data-cur'));
});
var totalEl = document.getElementById('cashReconTotal');
lines.push('إجمالي الفرق: ' + (totalEl ? totalEl.textContent : '—'));
var text = lines.join('\n');
if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast('تم نسخ التقرير'); }).catch(function () { toast('تعذر النسخ', true); });
else { try { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); toast('تم نسخ التقرير'); } catch (e) { toast('تعذر النسخ', true); } }
});
var postBtn = document.getElementById('cashReconPost');
if (postBtn) postBtn.addEventListener('click', function () {
var root = document.getElementById('cashReconRoot');
if (!root) return;
if (!E.getAccount('acc_cash_recon_gain')) E.addAccount({ name: 'فروق تسوية نقدية (إيراد)', type: 'revenue', subtype: 'إيرادات النشاط', currency: E.BASE, liquid: false, multi: false });
if (!E.getAccount('acc_cash_recon_loss')) E.addAccount({ name: 'فروق تسوية نقدية (مصروف)', type: 'expense', subtype: 'مصروفات عامة', currency: E.BASE, liquid: false, multi: false });
var posted = 0;
root.querySelectorAll('.cash-recon-input').forEach(function (inp) {
var accId = inp.getAttribute('data-acc');
var cur = inp.getAttribute('data-cur');
var book = Number(inp.getAttribute('data-book')) || 0;
var counted = inp.value === '' ? null : Number(inp.value);
if (counted === null || isNaN(counted)) return;
var rate = (cur === E.BASE) ? 1 : (E.getRate(cur) || 1);
var countedBaseMinor = Math.round(counted * rate * 100);
var diffBase = countedBaseMinor - book;
if (diffBase === 0) return;
var acc = E.getAccount(accId);
var adjId = diffBase > 0 ? 'acc_cash_recon_gain' : 'acc_cash_recon_loss';
var absDiffBase = Math.abs(diffBase);
var absDiffNative = Math.abs(Math.round(diffBase / rate));
var lines = [
{ accountId: accId, currency: cur, debitMinor: diffBase > 0 ? absDiffNative : 0, creditMinor: diffBase < 0 ? absDiffNative : 0, note: 'تسوية نقدية' },
{ accountId: adjId, currency: E.BASE, debitMinor: diffBase < 0 ? absDiffBase : 0, creditMinor: diffBase > 0 ? absDiffBase : 0, note: 'تسوية نقدية' }
];
var res = E.addDraft({ kind: 'compound', isCompound: true, lines: lines, currency: E.BASE, amountMinor: absDiffBase, memo: 'تسوية نقدية — ' + (acc ? acc.name : accId), date: todayISO() });
if (res && res.ok && res.draft) {
var cRes = E.confirmDraft(res.draft.id);
if (cRes && cRes.ok) posted++;
}
});
E.saveState();
toast(posted > 0 ? 'تم تسجيل ' + posted + ' قيد تسوية' : 'لا توجد فروق للتسجيل');
renderAll();
});
recalc();
}, 50);
}
var _mergeSrc = null, _mergeTgt = null;
function openMergeAccountsSheet() {
var st = S();
var opts = st.accounts.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.name) + ' (' + esc(a.id) + ')</option>'; }).join('');
var body = '<div id="mergeAccountsRoot">' +
'<div class="muted" style="margin-bottom:8px;font-size:calc(12px*var(--font-scale,1))">سيتم نقل جميع القيود (lines) والذمم (due items) والمسودات من الحساب المصدر إلى الحساب الهدف، ثم حذف الحساب المصدر. لا يمكن التراجع.</div>' +
'<div class="field"><label>الحساب المصدر (سيُحذف)</label><select id="mergeSrc">' + opts + '</select></div>' +
'<div class="field"><label>الحساب الهدف (سيستقبل)</label><select id="mergeTgt">' + opts + '</select></div>' +
'<div class="modal-actions" style="margin-top:10px">' +
'<button type="button" class="btn danger" id="mergeRunBtn">دمج وحذف المصدر</button>' +
'<button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button>' +
'</div>' +
'</div>';
openSheet('دمج حسابين (Merge Accounts)', body);
setTimeout(function () {
var srcSel = document.getElementById('mergeSrc');
var tgtSel = document.getElementById('mergeTgt');
var runBtn = document.getElementById('mergeRunBtn');
if (srcSel && tgtSel) {
if (tgtSel.options.length > 1) tgtSel.selectedIndex = 1;
}
if (runBtn) runBtn.addEventListener('click', function () {
var src = srcSel ? srcSel.value : '';
var tgt = tgtSel ? tgtSel.value : '';
if (!src || !tgt) { toast('اختر الحسابين', true); return; }
if (src === tgt) { toast('لا يمكن دمج حساب مع نفسه', true); return; }
if (!confirm('دمج «' + src + '» في «' + tgt + '» وحذف المصدر؟ لا يمكن التراجع.')) return;
var st = S();
(st.entries || []).forEach(function (e) { (e.lines || []).forEach(function (l) { if (l.accountId === src) l.accountId = tgt; }); });
(st.drafts || []).forEach(function (d) { (d.lines || []).forEach(function (l) { if (l.accountId === src) l.accountId = tgt; }); });
(st.dueItems || []).forEach(function (d) { if (d.accountId === src) d.accountId = tgt; });
st.accounts = (st.accounts || []).filter(function (a) { return a.id !== src; });
E.saveState();
toast('تم دمج الحساب «' + src + '» في «' + tgt + '»');
renderAll();
var modal = document.getElementById('modal');
if (modal) modal.classList.remove('open');
});
}, 50);
}
function openAccountNotes(id) {
var st = S();
if (!st.settings) st.settings = {};
if (!st.settings.accountNotes) st.settings.accountNotes = {};
var acc = E.getAccount(id);
var current = st.settings.accountNotes[id] || '';
openSheet('ملاحظات الحساب', '<div class="form-row"><label>ملاحظات</label><textarea id="accountNotesInput" style="width:100%;min-height:120px;padding:8px 10px;border-radius:10px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-family:inherit;font-size:calc(13px*var(--font-scale,1))">' + esc(current) + '</textarea></div>' +
'<div class="modal-actions"><button type="button" class="btn primary" id="saveAccountNotes">حفظ</button><button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button></div>');
setTimeout(function () {
var btn = document.getElementById('saveAccountNotes');
if (btn) btn.addEventListener('click', function () {
var ta = document.getElementById('accountNotesInput');
var val = ta ? ta.value : '';
st.settings.accountNotes[id] = val;
E.saveState();
toast('تم حفظ الملاحظات');
renderAll();
var modal = document.getElementById('modal');
if (modal) modal.classList.remove('open');
});
}, 50);
}
function openAccountBudget(id) {
var acc = E.getAccount(id);
if (!acc) { toast('الحساب غير موجود', true); return; }
var stt = E.budgetStatus ? E.budgetStatus(id) : null;
var current = stt ? (stt.limitBase || 0) : 0;
openSheet('ميزانية شهرية — ' + esc(acc.name),
'<div class="form-row"><label for="accBudgetLimit">السقف الشهري (' + esc(E.BASE) + ')</label>' +
'<input id="accBudgetLimit" type="number" inputmode="decimal" min="1" step="any" value="' + (current ? (current / 100) : '') + '" placeholder="مثال: 500" style="width:100%;min-height:38px;padding:8px 10px;border-radius:10px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size:calc(13px*var(--font-scale,1))" /></div>' +
'<div class="modal-actions"><button type="button" class="btn primary" id="saveAccBudget">حفظ</button>' +
(current ? '<button type="button" class="btn danger" id="delAccBudget">حذف</button>' : '') +
'<button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button></div>');
setTimeout(function () {
var saveBtn = document.getElementById('saveAccBudget');
var delBtn = document.getElementById('delAccBudget');
if (saveBtn) saveBtn.addEventListener('click', function () {
var val = Number(document.getElementById('accBudgetLimit').value);
if (!(val > 0)) { toast('أدخل مبلغاً صحيحاً', true); return; }
var res = E.addBudget({ accountId: id, monthlyLimitMinor: Math.round(val * 100), currency: E.BASE });
if (res && res.ok) { toast('تم حفظ الميزانية'); }
else toast((res && res.error) || 'تعذر الحفظ', true);
E.saveState();
renderAll();
var modal = document.getElementById('modal');
if (modal) modal.classList.remove('open');
});
if (delBtn) delBtn.addEventListener('click', function () {
var bb = (E.budgetList ? E.budgetList() : []).filter(function (x) { return x.accountId === id; })[0];
if (bb) E.removeBudget(bb.id);
E.saveState();
toast('تم حذف الميزانية');
renderAll();
var modal = document.getElementById('modal');
if (modal) modal.classList.remove('open');
});
}, 50);
}
function validateAccounts() {
var st = S();
var fixed = 0;
(st.accounts || []).forEach(function (a) {
var type = String(a.type || '').toLowerCase();
var expected = (type === 'asset' || type === 'expense') ? 'debit' : 'credit';
if (a.nature !== expected) { a.nature = expected; fixed++; }
});
if (fixed > 0) {
E.saveState();
toast('تم إصلاح ' + fixed + ' حساب (nature).');
} else {
toast('جميع الحسابات سليمة (type/nature متطابق).');
}
renderAll();
}
function openAccountsOptionsSheet() {
var sort = ui.accountsSort || 'rank';
var view = ui.accountsView || 'grouped';
var opt = function (action, mode, label, current, icon) {
return '<button type="button" class="btn ' + (current === mode ? 'primary' : 'ghost') + '" data-action="' + action + '" data-mode="' + mode + '" aria-pressed="' + (current === mode) + '">' + icon + label + '</button>';
};
openSheet('خيارات الحسابات', '<div class="modal-actions" style="flex-direction:column;gap:8px">' +
'<button type="button" class="btn primary" data-action="add-account" data-type="" data-subtype="">＋ حساب جديد</button>' +
'<div class="muted" style="font-size:calc(12px * var(--font-scale,1))">الترتيب</div>' +
'<div class="opt-grid">' +
opt('accounts-sort', 'rank', 'الترتيب المعتاد', sort, '') +
opt('accounts-sort', 'name', 'بالاسم (أ-ي)', sort, '') +
opt('accounts-sort', 'balance-desc', 'الرصيد: الأعلى أولاً', sort, '') +
opt('accounts-sort', 'balance-asc', 'الرصيد: الأقل أولاً', sort, '') +
opt('accounts-sort', 'activity', 'بآخر حركة', sort, '') +
'</div>' +
'<div class="muted" style="font-size:calc(12px * var(--font-scale,1))">العرض</div>' +
'<div class="opt-grid">' +
opt('accounts-view', 'grouped', 'مجمّعة حسب النوع', view, '') +
opt('accounts-view', 'flat', 'قائمة واحدة', view, '') +
'</div>' +
'<div class="muted" style="font-size:calc(12px * var(--font-scale,1))">أدوات</div>' +
'<button type="button" class="btn ghost" data-action="open-cash-recon">تسوية نقدية</button>' +
'<button type="button" class="btn ghost" data-action="open-merge-accounts">دمج حسابين</button>' +
'<button type="button" class="btn ghost" data-action="validate-accounts">فحص صحة الحسابات</button>' +
'<button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button>' +
'</div>');
}
window.openAccountsOptionsSheet = openAccountsOptionsSheet;
function renderAccounts() {
if (!els.accounts) return;
var st = S();
var accounts = st.accounts || [];
var html = '';
var filterChip = function (key, label) {
var count = accounts.filter(function (acc) { return accountMatchesFilter(acc, key); }).length;
var active = ui.accountsSubtypeFilter === key;
return '<button class="filter ' + (active ? 'active' : '') + '" aria-pressed="' + active + '" data-accsubtype="' + esc(key) + '">' +
drawnIcon(FILTER_ICONS[key]) + esc(label) + '<span class="filter-count">' + count + '</span></button>';
};
html += '<div class="filters icon-filters" style="align-items:center">' + filterChip('ALL', 'الكل') + filterChip('FAVORITE', 'المفضلة') + filterChip('NONLIQUID', 'غير سائل') + filterChip('LIQUID', 'سائل') + '<button type="button" class="row-menu-btn" data-action="accounts-options" aria-label="خيارات" aria-haspopup="menu" style="flex:0 0 auto;width:36px;height:36px;margin-inline-start:auto;border-radius:10px;border:1px solid var(--line-strong);background:var(--sand);color:var(--ink);font-size:16px;line-height:1">⋮</button></div>';
html += accountsCurrencyStrip();
html += '<div id="accountsList"></div>';
els.accounts.innerHTML = html;
renderAccountsList();
}
var rowMenuAnchorTop = 0;
var rowMenuOwner = null;
function closeRowMenu(returnFocus) {
var menu = document.getElementById('rowMenu');
if (!menu) return;
var owner = rowMenuOwner || document.querySelector('.row-menu-btn[aria-expanded="true"]');
if (menu.parentNode) menu.parentNode.removeChild(menu);
if (!owner) return;
owner.setAttribute('aria-expanded', 'false');
rowMenuOwner = null;
if (returnFocus) owner.focus();
}
var UI_ICONS = {
shareChat: '<svg class="ui-icon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M28 9L41 21L28 33"/><path d="M41 21H23C14 21 8 27 8 36V40"/></svg>',
"lock": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"9\" y=\"21\" width=\"30\" height=\"22\" rx=\"4\"/><path d=\"M15 21V14A9 9 0 0 1 33 14V21\"/><path d=\"M24 30V34\"/></svg>",
"balance": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M24 6V42M14 42H34M10 12H38\"/><path d=\"M10 12L4 27A7 7 0 0 0 16 27Z\"/><path d=\"M38 12L32 27A7 7 0 0 0 44 27Z\"/></svg>",
"more": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10 24H10.1M24 24H24.1M38 24H38.1\" stroke-width=\"7\"/></svg>",
"statement": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10 5H38V43L33 39L28 43L24 39L20 43L15 39L10 43Z\"/><path d=\"M17 15H31M17 24H31\"/></svg>",
"entries": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M19 11H41M19 24H41M19 37H41\"/><path d=\"M7 11H10M7 24H10M7 37H10\"/></svg>",
"gauge": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M38.1 9.9A20 20 0 1 0 44 24\"/><path d=\"M31.1 16.9A10 10 0 1 0 34 24\"/><path d=\"M24 24L39 9\"/></svg>",
"search": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"21\" cy=\"21\" r=\"14\"/><path d=\"M31.5 31.5L42 42\"/></svg>",
"printer": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M13 17V6H35V17\"/><path d=\"M13 35H7V17H41V35H35\"/><path d=\"M13 28H35V42H13Z\"/></svg>",
"sendFile": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M27 5H12A3 3 0 0 0 9 8V40A3 3 0 0 0 12 43H36A3 3 0 0 0 39 40V17Z\"/><path d=\"M27 5V17H39\"/><path d=\"M24 36V24M18 29L24 23L30 29\"/></svg>",
"sun": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"24\" cy=\"24\" r=\"9\"/><path d=\"M24 5V9M24 39V43M5 24H9M39 24H43M10.5 10.5L13.5 13.5M34.5 34.5L37.5 37.5M10.5 37.5L13.5 34.5M34.5 13.5L37.5 10.5\"/></svg>",
"moon": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M40 29A17 17 0 1 1 19 8A14 14 0 0 0 40 29Z\"/></svg>",
"device": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"13\" y=\"5\" width=\"22\" height=\"38\" rx=\"4\"/><path d=\"M21 37H27\"/></svg>",
"plus": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M24 9V39M9 24H39\"/></svg>",
"contacts": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"10\" y=\"5\" width=\"32\" height=\"38\" rx=\"5\"/><circle cx=\"26\" cy=\"19\" r=\"6\"/><path d=\"M16 35C17 29 21 27 26 27C31 27 35 29 36 35M5 14H10M5 24H10M5 34H10\"/></svg>",
"speaker": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 19V29H15L26 38V10L15 19Z\"/><path d=\"M33 18A8 8 0 0 1 33 30M38 12A16 16 0 0 1 38 36\"/></svg>",
"calendar": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"7\" y=\"10\" width=\"34\" height=\"32\" rx=\"5\"/><path d=\"M7 20H41M16 5V14M32 5V14\"/></svg>",
"mic": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"17\" y=\"5\" width=\"14\" height=\"24\" rx=\"7\"/><path d=\"M9 23A15 15 0 0 0 39 23M24 38V44\"/></svg>",
"close": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11 11L37 37M37 11L11 37\"/></svg>",
"clip": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M41 22L24 39A10.5 10.5 0 0 1 9 24L26 7A7 7 0 0 1 36 17L19 34A3.5 3.5 0 0 1 14 29L30 13\"/></svg>",
"send": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 8L42 24L8 40L14 24Z\"/></svg>",
"receivable": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 28V40H42V28H32L29 34H19L16 28Z\"/><path d=\"M24 6V26M18 20L24 26L30 20\"/></svg>",
"payable": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 28V40H42V28H32L29 34H19L16 28Z\"/><path d=\"M24 26V6M18 12L24 6L30 12\"/></svg>",
"copy": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"14\" y=\"10\" width=\"24\" height=\"30\" rx=\"4\"/><path d=\"M18 10V8A4 4 0 0 1 22 4H34A4 4 0 0 1 38 8V10\"/><path d=\"M20 20H32M20 28H30\"/></svg>",
"chat": "<svg class=\"ui-icon\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 10H40V30H26L16 40V30H8Z\"/><path d=\"M16 18H32M16 24H26\"/></svg>"
};
var TRAINER_REMOVED_KEY = 'rohtrainer.removed';
function trainerRemoved() {
try { return JSON.parse(localStorage.getItem(TRAINER_REMOVED_KEY)) || []; } catch (e) { return []; }
}
function saveTrainingFile() {
if (!window.RohTrainer) return;
var saved = window.RohTrainer.save(JSON.stringify({ version: 1, trained: E.listTrained(), removed: trainerRemoved() }));
if (!saved) toast('تعذر حفظ ملف التدريب', true);
}
function startTrainerEdition() {
if (!window.RohTrainer) return;
document.querySelector('.brand-text small').textContent = 'نسخة التدريب';
trainerRemoved().forEach(function (keyword) { E.removeTrained(keyword); });
saveTrainingFile();
}
function groupSheet(title, body, onClick) {
openSheet(title, '<div id="groupSheet">' + body + '</div>');
document.getElementById('groupSheet').addEventListener('click', function (ev) {
var btn = ev.target.closest('[data-group-action]');
if (btn) onClick(btn.getAttribute('data-group-action'), btn);
});
}
function groupAmountField(id, label, value) {
return '<div class="form-row"><label for="' + id + '">' + label + ' (' + esc(E.mainCurrency()) + ')</label>' +
'<input id="' + id + '" type="number" min="0" step="0.01" inputmode="decimal" dir="ltr"' + (value ? ' value="' + value + '"' : '') + ' /></div>';
}
function groupAmountBase(id) {
var typed = parseFloat((document.getElementById(id) || {}).value);
return typed > 0 ? E.toBase(Math.round(typed * 100), E.mainCurrency()) : 0;
}
function groupPayAccountField(label) {
return '<div class="form-row"><label for="groupPayAccount">' + label + '</label><select id="groupPayAccount">' +
S().accounts.filter(function (a) { return a.liquid; }).map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.name) + '</option>'; }).join('') +
'</select></div>';
}
function groupMyNetText(group) {
var net = E.groupBalances(group.id).net[E.GROUP_ME];
if (net > 0) return 'لك ' + moneyText(net);
if (net < 0) return 'عليك ' + moneyText(-net);
return 'متوازنة';
}
function groupPaymentText(fromName, toName, from, to) {
if (from === E.GROUP_ME) return 'مني إلى ' + esc(toName);
if (to === E.GROUP_ME) return 'من ' + esc(fromName) + ' إليّ';
return 'من ' + esc(fromName) + ' إلى ' + esc(toName);
}
function openMoneyGroups() {
var groups = E.moneyGroups();
groupSheet('مجموعات مالية',
'<p class="modal-note">شارك المصروفات مع مجموعة وسوِّ الحساب بينكم. تدخل دفاترك حصتك وما لك وما عليك فقط.</p>' +
(groups.map(function (g) {
return '<button type="button" class="search-result" data-group-action="open" data-id="' + esc(g.id) + '"><span class="search-result-title">' + esc(g.name) + '</span>' +
'<span class="search-result-sub">' + g.members.length + ' أعضاء • ' + esc(groupMyNetText(g)) + '</span></button>';
}).join('') || '<p class="muted" style="text-align:center;padding:10px">لا توجد مجموعات بعد.</p>') +
'<div class="modal-actions"><button class="btn primary" data-group-action="new">مجموعة جديدة</button></div>',
function (action, btn) {
if (action === 'new') openNewMoneyGroup();
else openMoneyGroup(btn.getAttribute('data-id'));
});
}
function openNewMoneyGroup() {
if (E.moneyGroups().length >= 1 && !E.planAllows('unlimitedGroups')) {
var gLeft = E.featureTrialLeft ? E.featureTrialLeft('unlimitedGroups') : 0;
if (gLeft && gLeft > 0) {
var gTr = E.useFeatureTrial('unlimitedGroups');
if (gTr && gTr.ok) toast('تجربة مجانية للمجموعات المالية الإضافية (متبقي لك ' + gTr.remaining + ' تجارب مجانية)');
} else {
openActivation('إضافة أكثر من مجموعة مالية متاحة في باقة الأعمال.');
return;
}
}
var people = S().accounts.filter(function (a) { return !a.liquid && /^acc_/.test(a.id); });
groupSheet('مجموعة جديدة',
'<div class="form-row"><label for="groupName">اسم المجموعة</label><input id="groupName" type="text" maxlength="40" autocomplete="off" placeholder="مثال: رحلة العائلة" /></div>' +
(people.length ? '<div class="form-row"><label>من الحسابات</label>' + people.map(function (a) {
return '<label class="trainer-review"><input type="checkbox" data-account="' + esc(a.id) + '" /><span>' + esc(a.name) + '</span></label>';
}).join('') + '</div>' : '') +
'<div class="form-row"><label for="groupNames">أسماء أخرى، تفصل بينها فاصلة</label><input id="groupNames" type="text" autocomplete="off" placeholder="خالد، سامي" /></div>' +
'<div class="modal-actions"><button class="btn primary" data-group-action="save">إنشاء</button><button class="btn ghost" data-group-action="back">رجوع</button></div>',
function (action) {
if (action === 'back') { openMoneyGroups(); return; }
var members = [].map.call(document.querySelectorAll('#groupSheet [data-account]:checked'), function (box) {
var acc = E.getAccount(box.getAttribute('data-account'));
return { name: acc.name, accountId: acc.id };
}).concat(document.getElementById('groupNames').value.split(/[,،]/).map(function (name) { return { name: name }; }));
var res = E.createMoneyGroup({ name: document.getElementById('groupName').value, members: members });
if (!res.ok) { toast(res.error, true); return; }
openMoneyGroup(res.group.id);
});
}
function openMoneyGroup(id) {
var group = E.findMoneyGroup(id);
if (!group) { openMoneyGroups(); return; }
var name = function (memberId) { var m = group.members.filter(function (x) { return x.id === memberId; })[0]; return m ? m.name : ''; };
var balances = E.groupBalances(id);
var row = function (start, end) { return '<div class="trainer-row"><span>' + start + '</span>' + end + '</div>'; };
groupSheet(group.name,
'<div class="search-group-title">الأرصدة</div>' +
group.members.map(function (m) {
var net = balances.net[m.id];
var mine = m.id === E.GROUP_ME;
var side = net > 0 ? (mine ? 'لي' : 'دائن') : (mine ? 'عليّ' : 'مدين');
return row(esc(m.name), net ? '<span class="group-net">' + side + ' <b class="amount">' + money(Math.abs(net)) + '</b></span>' : '<span class="muted">متوازن</span>');
}).join('') +
(balances.transfers.length ? '<div class="search-group-title">التسوية المقترحة</div>' + balances.transfers.map(function (t) {
return row(groupPaymentText(name(t.from), name(t.to), t.from, t.to) + ' <b class="amount">' + money(t.amount) + '</b>',
'<button type="button" class="btn ghost small" data-group-action="settle" data-from="' + esc(t.from) + '" data-to="' + esc(t.to) + '" data-amount="' + t.amount + '">تسوية</button>');
}).join('') : '') +
'<div class="modal-actions"><button class="btn primary" data-group-action="add">إضافة مصروف</button><button class="btn ghost" data-group-action="back">رجوع</button></div>' +
(group.expenses.length ? '<div class="search-group-title">المصروفات</div>' + group.expenses.slice().reverse().map(function (x) {
return row(esc(x.memo) + ' <b class="amount">' + money(x.amount) + '</b><small class="muted" style="display:block">دفع: ' + esc(name(x.paidBy)) + ' • ' + esc(E.fmtDate(x.date)) + '</small>',
'<button type="button" data-group-action="remove" data-id="' + esc(x.id) + '" aria-label="حذف المصروف">' + UI_ICONS.close + '</button>');
}).join('') : '') +
'<div class="modal-actions"><button class="btn ghost danger-text" data-group-action="delete">حذف المجموعة</button></div>',
function (action, btn) {
if (action === 'back') openMoneyGroups();
else if (action === 'add') openGroupExpense(id);
else if (action === 'settle') openGroupSettle(id, btn.getAttribute('data-from'), btn.getAttribute('data-to'), Number(btn.getAttribute('data-amount')));
else if (action === 'remove') {
var expenseId = btn.getAttribute('data-id');
askConfirm('حذف المصروف', 'سيُحذف المصروف وقيوده من الدفاتر نهائياً. هل تريد المتابعة؟', function () {
var res = E.removeGroupExpense(id, expenseId);
if (res.ok) { toast('تم حذف المصروف وقيوده'); renderAll(); } else toast(res.error, true);
openMoneyGroup(id);
}, 'حذف');
} else if (action === 'delete') {
askConfirm('حذف المجموعة', 'ستُحذف المجموعة وسجلها، وتبقى القيود التي دخلت دفاترك كما هي. هل تريد المتابعة؟', function () {
E.deleteMoneyGroup(id);
toast('تم حذف المجموعة');
});
}
});
}
function openGroupExpense(id) {
var group = E.findMoneyGroup(id);
var options = group.members.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name) + '</option>'; }).join('');
groupSheet('إضافة مصروف',
'<div class="form-row"><label for="groupMemo">الوصف</label><input id="groupMemo" type="text" maxlength="80" autocomplete="off" placeholder="مثال: عشاء" /></div>' +
groupAmountField('groupAmount', 'المبلغ') +
'<div class="form-pair"><div class="form-row"><label for="groupPaidBy">من دفع</label><select id="groupPaidBy">' + options + '</select></div>' +
'<div class="form-row"><label for="groupSplit">التقسيم</label><select id="groupSplit"><option value="equal">بالتساوي</option><option value="custom">مبالغ مخصصة</option></select></div></div>' +
'<div id="groupPayRow">' + groupPayAccountField('دفعت من حساب') + '</div>' +
'<div class="form-row"><label>من يتشارك</label>' + group.members.map(function (m) {
return '<label class="trainer-review"><input type="checkbox" data-member="' + esc(m.id) + '" checked /><span>' + esc(m.name) + '</span>' +
'<input class="group-share" type="number" min="0" step="0.01" inputmode="decimal" dir="ltr" data-share="' + esc(m.id) + '" aria-label="حصة ' + esc(m.name) + '" hidden /></label>';
}).join('') + '</div>' +
'<div class="modal-actions"><button class="btn primary" data-group-action="save">حفظ</button><button class="btn ghost" data-group-action="back">رجوع</button></div>',
function (action) {
if (action === 'back') { openMoneyGroup(id); return; }
var custom = document.getElementById('groupSplit').value === 'custom';
var input = {
memo: document.getElementById('groupMemo').value,
amount: groupAmountBase('groupAmount'),
paidBy: document.getElementById('groupPaidBy').value,
payAccountId: (document.getElementById('groupPayAccount') || {}).value
};
var inMain = function (minor) { return E.toBase(minor, E.mainCurrency()); };
if (custom) {
input.shares = {};
document.querySelectorAll('#groupSheet [data-share]').forEach(function (box) {
input.shares[box.getAttribute('data-share')] = inMain(Math.round((parseFloat(box.value) || 0) * 100));
});
if (E.mainCurrency() !== E.BASE) {
input.amount = Object.keys(input.shares).reduce(function (sum, k) { return sum + input.shares[k]; }, 0);
}
} else {
input.participants = [].map.call(document.querySelectorAll('#groupSheet [data-member]:checked'), function (box) { return box.getAttribute('data-member'); });
}
var res = E.addGroupExpense(id, input);
if (!res.ok) {
if (res.reason === 'entryLimit') openActivation(res.error); else toast(res.error, true);
return;
}
pushReceipts(res.expense && res.expense.entryIds);
toast('تم حفظ المصروف');
renderAll();
openMoneyGroup(id);
});
document.getElementById('groupPaidBy').addEventListener('change', function (ev) {
document.getElementById('groupPayRow').hidden = ev.target.value !== E.GROUP_ME;
});
document.getElementById('groupSplit').addEventListener('change', function (ev) {
var custom = ev.target.value === 'custom';
document.querySelectorAll('#groupSheet [data-share]').forEach(function (box) { box.hidden = !custom; });
document.querySelectorAll('#groupSheet [data-member]').forEach(function (box) { box.hidden = custom; });
});
}
function openGroupSettle(id, from, to, amount) {
var group = E.findMoneyGroup(id);
var name = function (memberId) { return group.members.filter(function (x) { return x.id === memberId; })[0].name; };
var involvesMe = from === E.GROUP_ME || to === E.GROUP_ME;
var shown = (E.fromBase(amount, E.mainCurrency()) / 100).toFixed(2);
groupSheet('تسوية',
'<p class="modal-note">' + groupPaymentText(name(from), name(to), from, to) + (involvesMe ? '. يُسجَّل في دفاترك.' : '. لا يمس دفاترك، ويُسجَّل في المجموعة فقط.') + '</p>' +
groupAmountField('groupSettleAmount', 'المبلغ', shown) +
(involvesMe ? groupPayAccountField(from === E.GROUP_ME ? 'دفعت من حساب' : 'استلمت في حساب') : '') +
'<div class="modal-actions"><button class="btn primary" data-group-action="save">تأكيد التسوية</button><button class="btn ghost" data-group-action="back">رجوع</button></div>',
function (action) {
if (action === 'back') { openMoneyGroup(id); return; }
var typed = document.getElementById('groupSettleAmount').value;
var res = E.settleGroup(id, {
from: from, to: to, amount: typed === shown ? amount : groupAmountBase('groupSettleAmount'),
payAccountId: (document.getElementById('groupPayAccount') || {}).value
});
if (!res.ok) { toast(res.error, true); return; }
pushReceipts(res.entryId ? [res.entryId] : null);
toast('تمت التسوية');
renderAll();
openMoneyGroup(id);
});
}
function downloadTextFile(text, name) {
var url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
var link = document.createElement('a');
link.href = url;
link.download = name;
document.body.appendChild(link);
link.click();
link.remove();
URL.revokeObjectURL(url);
}
function exportTrainingFile() {
if (!E.listTrained().length) { toast('لا توجد جمل مدرَّبة للتصدير', true); return; }
var name = 'MoneyCode-training-' + E.todayISO() + '.json';
var text = E.exportTraining();
if (window.RohPrint && window.RohPrint.sendFile) {
if (!window.RohPrint.sendFile(text, name)) toast('تعذر تجهيز الملف', true);
return;
}
downloadTextFile(text, name);
toast('تم تصدير الملف');
}
function readTrainingUpload(file) {
if (file.size > 1048576) { toast('الملف أكبر من 1 ميجابايت', true); return; }
var reader = new FileReader();
reader.onerror = function () { toast('تعذرت قراءة الملف', true); };
reader.onload = function () {
var res = E.readTrainingFile(reader.result);
if (!res.ok) { toast(res.error, true); return; }
if (!res.items.length) { toast('لا توجد جمل صالحة في الملف', true); return; }
reviewTrainingFile(res);
};
reader.readAsText(file);
}
function reviewTrainingFile(res) {
var label = function (kind) { return E.KIND_META[kind] ? E.KIND_META[kind].label : kind; };
openSheet('مراجعة ملف التدريب',
'<div id="trainerBox">' +
'<p class="modal-note">راجع الجمل، وألغِ تحديد ما لا تعتمده. لن يُحفظ شيء قبل الاعتماد.' +
(res.skipped ? ' تم تجاهل ' + res.skipped + ' سطر غير صالح أو مكرر.' : '') + '</p>' +
res.items.map(function (t, i) {
var note = t.status === 'same' ? 'موجودة' : t.status === 'changed' ? 'كانت: ' + label(t.was) : 'جديدة';
return '<label class="trainer-review"><input type="checkbox" data-index="' + i + '"' +
(t.status === 'same' ? ' disabled' : ' checked') + ' />' +
'<span><b>' + esc(label(t.kind)) + '</b> ' + esc(t.example) +
'<small class="' + (t.status === 'changed' ? 'changed' : '') + '">' + esc(note) + '</small></span></label>';
}).join('') +
'<div class="modal-actions"><button class="btn primary" data-action="train-approve">اعتماد المحدد</button>' +
'<button class="btn ghost" data-action="train-back">إلغاء</button></div></div>');
document.getElementById('trainerBox').addEventListener('click', function (ev) {
var btn = ev.target.closest('[data-action]');
if (!btn) return;
if (btn.getAttribute('data-action') === 'train-back') { openTrainer(); return; }
var chosen = [].filter.call(document.querySelectorAll('.trainer-review input'), function (box) { return box.checked; });
if (!chosen.length) { toast('حدد جملة واحدة على الأقل', true); return; }
var removed = trainerRemoved();
chosen.forEach(function (box) {
var t = res.items[Number(box.getAttribute('data-index'))];
E.trainSentence(t.example, t.kind);
removed = removed.filter(function (k) { return k !== t.keyword; });
});
try { localStorage.setItem(TRAINER_REMOVED_KEY, JSON.stringify(removed)); } catch (e) {}
saveTrainingFile();
openTrainer();
toast('تم اعتماد ' + chosen.length + ' جملة');
});
}
function understoodText(text) {
if (!text.trim()) return '';
var intent;
try { intent = E.parseIntent(text); } catch (e) { return 'لم أفهم'; }
var label = function (k) { return E.KIND_META[k] ? E.KIND_META[k].label : ''; };
if (intent.kind === 'needAmount') return label(intent.intended) + ' (بلا مبلغ)';
if (intent.kind === 'needSplit') return label(intent.intended) + ' (موزّع على حسابات)';
return label(intent.kind) || 'لم أفهم نوع القيد';
}
function openTrainer() {
var kinds = ['expense', 'income', 'lend', 'borrow', 'collect', 'repay', 'transfer', 'capital'];
openSheet('تدريب البوت',
'<div id="trainerBox">' +
'<p class="modal-note">اكتب الجملة كما تقولها، ثم اختر نوع القيد الصحيح. لا يُسجَّل أي قيد.' + (window.RohTrainer ? ' وتصل الجمل إلى التطبيق عند ربط الهاتف.' : ' وتبقى الجمل على هذا الهاتف.') + '</p>' +
'<div class="form-row"><label for="trainPhrase">الجملة</label><input id="trainPhrase" type="text" maxlength="200" autocomplete="off" placeholder="مثال: عبيت بنزين 90" /></div>' +
'<div class="form-pair"><div class="form-row"><label>فهمها البوت</label><div id="trainUnderstood" class="trainer-understood">—</div></div>' +
'<div class="form-row"><label for="trainKind">الصحيح</label><select id="trainKind">' +
kinds.map(function (k) { return '<option value="' + k + '">' + esc(E.KIND_META[k].label) + '</option>'; }).join('') +
'</select></div></div>' +
'<div class="modal-actions"><button class="btn primary" data-action="train-save">حفظ الجملة</button></div>' +
'<div class="modal-actions"><button class="btn ghost" data-action="train-export">تصدير ملف</button>' +
'<button class="btn ghost" data-action="train-import">استيراد ملف</button></div>' +
'<button class="btn ghost" data-action="open-learned-words">مراجعة كلمات جديدة</button>' +
'<input id="trainFile" type="file" hidden />' +
'<div class="search-group-title" id="trainCount"></div><div id="trainList"></div></div>');
var box = document.getElementById('trainerBox');
var phrase = document.getElementById('trainPhrase');
var kindSel = document.getElementById('trainKind');
var showList = function () {
var items = E.listTrained();
document.getElementById('trainCount').textContent = 'جمل مدرَّبة: ' + items.length;
document.getElementById('trainList').innerHTML = items.map(function (t) {
var exText = t.example || t.keyword;
return '<div class="trainer-row"><span style="flex:1"><b>' + esc(E.KIND_META[t.kind] ? E.KIND_META[t.kind].label : t.kind) + '</b> ' + esc(exText) + '</span>' +
'<button type="button" class="btn ghost small" data-action="train-use" data-text="' + esc(exText) + '" style="padding:2px 8px;font-size:calc(11px * var(--font-scale,1))">⚡ استخدام</button>' +
'<button type="button" data-action="train-remove" data-id="' + esc(t.keyword) + '" aria-label="حذف الجملة">' + UI_ICONS.close + '</button></div>';
}).join('');
};
phrase.addEventListener('input', function () {
document.getElementById('trainUnderstood').textContent = understoodText(phrase.value) || '—';
var intent = null;
try { intent = E.parseIntent(phrase.value); } catch (e) {}
var guess = intent && (intent.kind === 'needAmount' || intent.kind === 'needSplit' ? intent.intended : intent.kind);
if (kinds.indexOf(guess) >= 0) kindSel.value = guess;
});
document.getElementById('trainFile').addEventListener('change', function (ev) {
if (ev.target.files[0]) readTrainingUpload(ev.target.files[0]);
});
box.addEventListener('click', function (ev) {
var btn = ev.target.closest('[data-action]');
if (!btn) return;
if (btn.getAttribute('data-action') === 'train-export') {
exportTrainingFile();
} else if (btn.getAttribute('data-action') === 'train-import') {
document.getElementById('trainFile').click();
} else if (btn.getAttribute('data-action') === 'train-save') {
var res = E.trainSentence(phrase.value, kindSel.value);
if (!res.ok) { toast(res.error, true); return; }
var removed = trainerRemoved().filter(function (k) { return k !== res.keyword; });
try { localStorage.setItem(TRAINER_REMOVED_KEY, JSON.stringify(removed)); } catch (e) {}
saveTrainingFile();
phrase.value = '';
document.getElementById('trainUnderstood').textContent = '—';
toast('تم حفظ الجملة');
showList();
phrase.focus();
} else if (btn.getAttribute('data-action') === 'train-use') {
var useText = btn.getAttribute('data-text') || '';
closeSheet();
setTab('bot');
if (els.input) {
els.input.value = useText;
autoGrow();
updateActionBtn();
els.input.focus();
}
} else if (btn.getAttribute('data-action') === 'train-remove') {
var keyword = btn.getAttribute('data-id');
E.removeTrained(keyword);
var gone = trainerRemoved();
if (gone.indexOf(keyword) < 0) gone.push(keyword);
try { localStorage.setItem(TRAINER_REMOVED_KEY, JSON.stringify(gone)); } catch (e) {}
saveTrainingFile();
showList();
}
});
showList();
phrase.focus();
}
function menuIcon(body) {
return '<svg class="menu-icon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
}
var EYE_SHAPE = '<path d="M4 24S11 10 24 10S44 24 44 24S37 38 24 38S4 24 4 24Z"/><circle cx="24" cy="24" r="6"/>';
var MENU_ICONS = {
search: menuIcon('<circle cx="21" cy="21" r="14"/><path d="M31.5 31.5L42 42"/>'),
backup: menuIcon('<path d="M8 14L14 7H34L40 14V39A3 3 0 0 1 37 42H11A3 3 0 0 1 8 39Z"/><path d="M8 14H40M24 21V35M18 29L24 35L30 29"/>'),
currency: menuIcon('<circle cx="24" cy="24" r="18"/><path d="M24 12V36M18 18H30M18 30H30"/>'),
voiceDialect: menuIcon('<rect x="17" y="5" width="14" height="24" rx="7"/><path d="M9 23A15 15 0 0 0 39 23M24 38V44"/>'),
settings: menuIcon('<circle cx="24" cy="24" r="6"/><path d="M24 4V8M24 40V44M4 24H8M40 24H44"/>'),
exchange: menuIcon('<path d="M8 16H36M28 8L36 16L28 24"/><path d="M40 32H12M20 24L12 32L20 40"/>'),
undo: menuIcon('<path d="M18 10L8 20L18 30"/><path d="M8 20H30A10 10 0 0 1 30 40H20"/>'),
group: menuIcon('<circle cx="17" cy="16" r="7"/><path d="M4 40C4 31 10 27 17 27C24 27 30 31 30 40"/><path d="M31 9.5A7 7 0 0 1 31 22.5"/><path d="M35 28C40 30 44 33 44 40"/>'),
cashflow: menuIcon('<path d="M8 16H36M28 8L36 16L28 24"/><path d="M40 32H12M20 24L12 32L20 40"/>'),
balance: menuIcon('<path d="M24 6V42M14 42H34M10 12H38"/><path d="M10 12L4 27A7 7 0 0 0 16 27Z"/><path d="M38 12L32 27A7 7 0 0 0 44 27Z"/>'),
train: menuIcon('<path d="M5 18L24 8L43 18L24 28Z"/><path d="M13 23V33C17 37 31 37 35 33V23"/><path d="M43 18V30"/>'),
zakat: menuIcon('<path d="M24 6V42M12 18H36M12 30H36"/>'),
aging: menuIcon('<circle cx="24" cy="24" r="18"/><path d="M24 12V24L32 28"/>'),
statusCard: menuIcon('<rect x="8" y="8" width="32" height="32" rx="6"/><path d="M16 30L22 23L28 28L34 19"/><circle cx="18" cy="17" r="2.5"/>'),
show: menuIcon(EYE_SHAPE),
hide: menuIcon(EYE_SHAPE + '<path d="M8 8L40 40"/>')
};
function openRowMenu(btn, host, items) {
var id = btn.getAttribute('data-id');
var wasOpen = btn.getAttribute('aria-expanded') === 'true';
closeRowMenu();
if (wasOpen) return;
var menu = document.createElement('div');
menu.id = 'rowMenu';
menu.className = 'row-menu';
menu.setAttribute('role', 'menu');
menu.innerHTML = items.map(function (it, idx) {
if (!it[0]) return '<div class="row-menu-group" role="presentation">' + esc(it[1]) + '</div>'; // group header (separator + label)
return '<button role="menuitem" id="rowMenuItem-' + idx + '" class="row-menu-item' + (it[2] ? ' danger' : '') + '" data-action="' + it[0] + '" data-id="' + esc(id) + '" tabindex="-1">' + it[1] + '</button>';
}).join('');
host.appendChild(menu);
btn.setAttribute('aria-expanded', 'true');
rowMenuOwner = btn;
var at = btn.getBoundingClientRect();
rowMenuAnchorTop = at.top;
var bar = document.querySelector('.tabbar');
var floor = bar ? bar.getBoundingClientRect().top : window.innerHeight;
var top = at.bottom + 4;
if (top + menu.offsetHeight > floor - 8) top = Math.max(8, at.top - menu.offsetHeight - 4);
menu.style.top = top + 'px';
var rtl = (document.documentElement.dir === 'rtl');
var left = rtl ? (at.right - menu.offsetWidth) : at.left;
left = Math.max(8, Math.min(left, window.innerWidth - menu.offsetWidth - 8));
menu.style.left = left + 'px';
var rItems = [].slice.call(menu.querySelectorAll('.row-menu-item'));
var rIdx = 0;
if (rItems.length) { rItems[0].focus(); menu.setAttribute("aria-activedescendant", rItems[0].id); }
menu.addEventListener('keydown', function (ev) {
if (ev.key === 'ArrowDown') { ev.preventDefault(); rIdx = Math.min(rItems.length - 1, rIdx + 1); if (rItems[rIdx]) { rItems[rIdx].focus(); menu.setAttribute('aria-activedescendant', rItems[rIdx].id); } }
else if (ev.key === 'ArrowUp') { ev.preventDefault(); rIdx = Math.max(0, rIdx - 1); if (rItems[rIdx]) { rItems[rIdx].focus(); menu.setAttribute('aria-activedescendant', rItems[rIdx].id); } }
else if (ev.key === 'Home') { ev.preventDefault(); rIdx = 0; if (rItems[rIdx]) { rItems[rIdx].focus(); menu.setAttribute('aria-activedescendant', rItems[rIdx].id); } }
else if (ev.key === 'End') { ev.preventDefault(); rIdx = rItems.length - 1; if (rItems[rIdx]) { rItems[rIdx].focus(); menu.setAttribute('aria-activedescendant', rItems[rIdx].id); } }
else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (rItems[rIdx]) rItems[rIdx].click(); }
else if (ev.key === 'Escape') { ev.preventDefault(); closeRowMenu(true); }
});
}
function settingsSearchGroup(query) {
var term = E.normalizeAr(query).toLowerCase().trim();
if (!term) return null;
renderStaleTab('settings');
var seen = {};
var items = [];
els.settings.querySelectorAll('.group-title > span, .group-title, .s-title').forEach(function (node) {
var text = (node.childElementCount ? (node.firstChild.textContent || '') : node.textContent).trim();
if (!text || seen[text] || E.normalizeAr(text).toLowerCase().indexOf(term) < 0) return;
seen[text] = true;
items.push({ type: 'setting', id: text, title: text, sub: 'الإعدادات' });
});
return items.length ? { key: 'settings', title: 'الإعدادات', total: items.length, items: items.slice(0, 5) } : null;
}
var globalSearchDay = '';
function setGlobalSearchDay(day) {
globalSearchDay = day || '';
var chip = document.getElementById('globalSearchDay');
chip.hidden = !globalSearchDay;
chip.innerHTML = globalSearchDay
? '<span>' + UI_ICONS.calendar + ' ' + esc(E.fmtDate(globalSearchDay)) + '</span><button type="button" data-action="search-day-clear" aria-label="إزالة التاريخ">' + UI_ICONS.close + '</button>'
: '';
document.getElementById('globalSearchDate').value = globalSearchDay;
}
function _searchHistory() {
try {
var list = JSON.parse(localStorage.getItem('rohapp.searchHistory') || '[]');
list = (list || []).map(function (x) { return String(x || '').trim(); }).filter(function (x) { return x.length >= 2; });
var cleaned = [];
list.forEach(function (q) {
if (cleaned.indexOf(q) >= 0) return;
var isPrefix = list.some(function (other) { return other !== q && other.indexOf(q) === 0; });
if (!isPrefix) cleaned.push(q);
});
return cleaned;
} catch (e) { return []; }
}
function _saveSearchHistory(q) {
q = String(q || '').trim();
if (q.length < 2) return;
var list = _searchHistory().filter(function (x) { return x !== q && q.indexOf(x) !== 0; });
list.unshift(q);
if (list.length > 10) list = list.slice(0, 10);
try { localStorage.setItem('rohapp.searchHistory', JSON.stringify(list)); } catch (e) {}
}
function _removeSearchHistory(q) {
q = String(q || '').trim();
var list = _searchHistory().filter(function (x) { return x !== q; });
try {
if (list.length) localStorage.setItem('rohapp.searchHistory', JSON.stringify(list));
else localStorage.removeItem('rohapp.searchHistory');
} catch (e) {}
}
function renderGlobalResults(query) {
var holder = document.getElementById('globalResults');
if (!holder) return;
if (!query.trim() && !globalSearchDay) {
var hist = _searchHistory();
if (hist.length) {
holder.innerHTML = '<div class="search-group"><div class="search-group-title">عمليات بحث سابقة</div>' +
hist.map(function (q) {
return '<div class="search-history-row">' +
'<button type="button" class="search-result" data-action="search-history" data-q="' + esc(q) + '">' + esc(q) + '</button>' +
'<button type="button" class="search-history-del" data-action="search-history-remove" data-q="' + esc(q) + '" aria-label="حذف ' + esc(q) + ' من السجل" title="حذف من السجل">' + UI_ICONS.close + '</button>' +
'</div>';
}).join('') +
'<button type="button" class="search-result more" data-action="search-history-clear">مسح السجل</button></div>';
} else {
holder.innerHTML = '';
}
return;
}
var groups = E.searchAll(query, globalSearchDay);
var settings = globalSearchDay ? null : settingsSearchGroup(query);
if (settings) groups.push(settings);
holder.innerHTML = groups.length ? groups.map(function (g) {
return '<div class="search-group"><div class="search-group-title">' + esc(g.title) + ' <span class="badge">' + g.total + '</span></div>' +
g.items.map(function (item) {
return '<button class="search-result" data-action="search-open" data-type="' + esc(item.type) + '" data-id="' + esc(item.id) + '">' +
'<span class="search-result-title">' + esc(hiddenDigits(item.title)) + '</span>' +
(item.sub ? '<span class="search-result-sub">' + esc(item.sub) + '</span>' : '') + '</button>';
}).join('') +
((g.key === 'entries' || g.key === 'accounts') && g.total > g.items.length
? '<button class="search-result more" data-action="search-open" data-type="' + (g.key === 'entries' ? 'all-entries' : 'all-accounts') + '" data-id="">عرض الكل (' + g.total + ')</button>'
: '') + '</div>';
}).join('') : '<p class="modal-note">لا توجد نتائج.</p>';
}
function isGlobalSearchOpen() {
var panel = document.getElementById('globalSearchPanel');
return !!panel && !panel.hidden;
}
var globalSearchSaveTimer = null;
var globalSearchLastVal = '';
function openGlobalSearch() {
ux('search');
if (globalSearchSaveTimer) { clearTimeout(globalSearchSaveTimer); globalSearchSaveTimer = null; }
globalSearchLastVal = '';
var input = document.getElementById('globalSearch');
document.getElementById('globalSearchPanel').hidden = false;
input.value = '';
setGlobalSearchDay('');
renderGlobalResults('');
input.focus();
}
function closeGlobalSearch() {
if (!isGlobalSearchOpen()) return;
if (globalSearchSaveTimer) { clearTimeout(globalSearchSaveTimer); globalSearchSaveTimer = null; }
var input = document.getElementById('globalSearch');
if (input && input.value.trim().length >= 2) {
_saveSearchHistory(input.value.trim());
}
globalSearchLastVal = '';
document.getElementById('globalSearchPanel').hidden = true;
document.getElementById('globalResults').innerHTML = '';
}
function bindGlobalSearch() {
var input = document.getElementById('globalSearch');
input.addEventListener('input', function () {
var val = input.value;
var trimmed = val.trim();
var isBackspacing = globalSearchLastVal && globalSearchLastVal.indexOf(trimmed) === 0 && trimmed.length < globalSearchLastVal.length;
globalSearchLastVal = trimmed;
if (globalSearchSaveTimer) { clearTimeout(globalSearchSaveTimer); globalSearchSaveTimer = null; }
if (!isBackspacing && trimmed.length >= 2) {
globalSearchSaveTimer = setTimeout(function () {
globalSearchSaveTimer = null;
if (isGlobalSearchOpen() && input.value.trim() === trimmed) {
_saveSearchHistory(trimmed);
}
}, 900);
}
renderGlobalResults(val);
});
input.addEventListener('keydown', function (ev) {
if (ev.key === 'Enter' && input.value.trim()) {
if (globalSearchSaveTimer) { clearTimeout(globalSearchSaveTimer); globalSearchSaveTimer = null; }
_saveSearchHistory(input.value.trim());
}
});
var dayInput = document.getElementById('globalSearchDate');
dayInput.addEventListener('change', function () {
setGlobalSearchDay(dayInput.value);
renderGlobalResults(input.value);
});
document.getElementById('globalSearchPanel').addEventListener('click', function (ev) {
if (ev.target === ev.currentTarget || ev.target.id === 'globalResults') { closeGlobalSearch(); return; }
var btn = ev.target.closest('[data-action]');
if (!btn) return;
var action = btn.getAttribute('data-action');
if (action === 'search-open') {
if (input.value.trim()) _saveSearchHistory(input.value.trim());
openSearchResult(btn.getAttribute('data-type'), btn.getAttribute('data-id'), input.value);
} else if (action === 'search-history') {
var q = btn.getAttribute('data-q') || '';
_saveSearchHistory(q);
globalSearchLastVal = q;
input.value = q;
renderGlobalResults(q);
input.focus();
} else if (action === 'search-history-remove') {
_removeSearchHistory(btn.getAttribute('data-q') || '');
renderGlobalResults(input.value);
} else if (action === 'search-history-clear') {
try { localStorage.removeItem('rohapp.searchHistory'); } catch (e) {}
renderGlobalResults(input.value);
} else if (action === 'search-voice') {
startVoice(function (text) {
if (!isGlobalSearchOpen()) return;
globalSearchLastVal = String(text || '').trim();
input.value = text;
_saveSearchHistory(text);
renderGlobalResults(text);
});
} else if (action === 'search-date') {
try { dayInput.showPicker(); } catch (e) { dayInput.focus(); dayInput.click(); }
} else if (action === 'search-day-clear') {
setGlobalSearchDay('');
renderGlobalResults(input.value);
} else if (action === 'search-clear') {
if (globalSearchSaveTimer) { clearTimeout(globalSearchSaveTimer); globalSearchSaveTimer = null; }
if (!input.value && !globalSearchDay) { closeGlobalSearch(); return; }
globalSearchLastVal = '';
input.value = '';
setGlobalSearchDay('');
renderGlobalResults('');
input.focus();
}
});
}
function flashSearchHit(node) {
if (!node) return;
setTimeout(function () {
node.scrollIntoView({ block: 'center' });
node.classList.add('search-hit');
setTimeout(function () { node.classList.remove('search-hit'); }, 1600);
}, 80);
}
function openSearchResult(type, id, term) {
closeGlobalSearch();
var st = S();
if (type === 'entry' || type === 'all-entries') {
var entry = st.entries.filter(function (e) { return e.id === id; })[0];
ui.filter = 'all';
ui.search = entry ? (entry.memo || entry.counterparty || term) : term;
setTab('ledger');
renderLedger();
} else if (type === 'account' || type === 'all-accounts') {
var account = E.getAccount(id);
ui.accountsSubtypeFilter = 'ALL';
ui.accountsSearch = account ? account.name : term;
setTab('accounts');
renderAccounts();
} else if (type === 'due') {
setTab('radar');
flashSearchHit(els.radar.querySelector('[data-action="settle-partial"][data-id="' + CSS.escape(id) + '"]'));
} else if (type === 'message') {
var index = st.messages.map(function (m) { return m.id; }).indexOf(id);
if (index >= 0) chatShown = Math.max(chatShown, st.messages.length - index);
setTab('bot');
renderChat();
var bubbles = [].filter.call(els.chat.children, function (n) { return n.classList.contains('msg') || n.getAttribute('data-msg') !== null; });
var shownFrom = Math.max(0, st.messages.length - chatShown);
flashSearchHit(bubbles[index - shownFrom]);
} else if (type === 'currency') {
setTab('settings');
var rate = els.settings.querySelector('[data-action="currency-menu"][data-id="' + CSS.escape(id) + '"]');
flashSearchHit(rate ? rate.closest('.setting') : els.settings.querySelector('.group-title'));
} else if (type === 'setting') {
setTab('settings');
var match = [].filter.call(els.settings.querySelectorAll('.group-title, .s-title'), function (n) {
return n.textContent.trim().indexOf(id) === 0;
})[0];
var hit = match ? (match.closest('.setting') || match) : null;
flashSearchHit(hit);
if (hit) {
setTimeout(function () {
var btn = hit.querySelector('[data-action]');
if (btn) btn.click();
}, 120);
}
}
}
function toggleAccountsSearch() {
var open = !(ui.accountsSearchOpen || ui.accountsSearch);
ui.accountsSearchOpen = open;
ui.accountsSearch = '';
renderAccounts();
var box = document.getElementById('accountsSearch');
if (box) box.focus();
}
var GENERAL_ICONS = {
'سيولة نقدية': '<rect x="5" y="13" width="38" height="22" rx="3"/><circle cx="24" cy="24" r="5"/><path d="M11 24H11.1M37 24H37.1"/>',
'العملاء': '<circle cx="18" cy="16" r="7"/><path d="M5 40C5 31 11 27 18 27S31 31 31 40"/><path d="M32 10A7 7 0 0 1 32 22M36 28C40 30 43 34 43 40"/>',
'المخزون': '<path d="M24 5L42 14V34L24 43L6 34V14Z"/><path d="M6 14L24 23L42 14M24 23V43"/>',
'مصروفات مقدمة': '<circle cx="24" cy="24" r="18"/><path d="M24 13V24L31 29"/>',
'استثمارات': '<path d="M6 42H42"/><path d="M12 42V30M24 42V22M36 42V12"/><path d="M8 20L20 10L28 15L40 5"/>',
'الأراضي والمباني': '<path d="M10 42V8H28V42"/><path d="M28 20H38V42"/><path d="M6 42H42"/><path d="M16 16H22M16 24H22M16 32H22"/>',
'السيارات والمعدات': '<path d="M6 32V24L11 13H37L42 24V32Z"/><path d="M6 24H42"/><circle cx="14" cy="36" r="4"/><circle cx="34" cy="36" r="4"/>',
'الموردون': '<path d="M4 12H28V34H4Z"/><path d="M28 20H37L44 27V34H28"/><circle cx="13" cy="37" r="4"/><circle cx="35" cy="37" r="4"/>',
'مصروفات مستحقة': '<path d="M10 5H38V43L31 38L24 43L17 38L10 43Z"/><path d="M17 15H31M17 24H31"/>',
'قروض': '<path d="M5 18L24 6L43 18Z"/><path d="M10 18V36M19 18V36M29 18V36M38 18V36"/><path d="M5 42H43"/>',
'رأس المال': '<circle cx="24" cy="24" r="18"/><path d="M24 24V6M24 24L37 37"/>',
'الأرباح المحتجزة': '<ellipse cx="24" cy="11" rx="15" ry="6"/><path d="M9 11V37C9 40 16 43 24 43S39 40 39 37V11"/><path d="M9 24C9 27 16 30 24 30S39 27 39 24"/>',
'المسحوبات': '<path d="M24 6V30M14 20L24 30L34 20"/><path d="M8 36V42H40V36"/>',
'إيرادات النشاط': '<path d="M6 36L18 24L26 32L42 16"/><path d="M42 28V16H30"/>',
'إيرادات أخرى': '<circle cx="24" cy="24" r="18"/><path d="M24 15V33M15 24H33"/>',
'الرواتب': '<rect x="5" y="11" width="38" height="28" rx="4"/><circle cx="17" cy="22" r="4"/><path d="M10 33C10 29 13 28 17 28S24 29 24 33"/><path d="M30 21H38M30 29H38"/>',
'الإيجار': '<circle cx="15" cy="33" r="9"/><path d="M21 27L40 8M32 16L38 22M26 22L30 26"/>',
'الكهرباء والماء': '<path d="M27 4L9 27H23L20 44L39 20H25Z"/>',
'مصروفات عامة': '<path d="M10 5H38V43L31 38L24 43L17 38L10 43Z"/><path d="M17 15H31M17 24H31"/>'
};
var GENERAL_ICON_OTHER = '<path d="M5 12H19L24 18H43V40H5Z"/>';
function accountCountText(n) {
if (n === 1) return 'حساب واحد';
if (n === 2) return 'حسابان';
return n + (n <= 10 ? ' حسابات' : ' حساباً');
}
var ICON_WALLET = '<path d="M6 14H38V40H6Z"/><path d="M6 14L32 6V14"/><path d="M38 23H30A4 4 0 0 0 30 31H38"/>';
var ICON_PERSON = '<circle cx="24" cy="15" r="8"/><path d="M8 42C8 32 15 28 24 28S40 32 40 42"/>';
var ICON_LIQUID = '<rect x="4" y="16" width="40" height="24" rx="3"/><path d="M10 10H38"/><path d="M18 16V40M30 16V40"/>';
var ACCOUNT_ICONS = {
cash: GENERAL_ICONS['سيولة نقدية'],
wallet: ICON_WALLET,
bank: GENERAL_ICONS['قروض'],
usd_box: '<circle cx="24" cy="24" r="18"/><path d="M30 17C28 15 20 14 19 19C18 25 30 23 29 29C28 34 20 33 18 31M24 11V37"/>',
sar_box: '<rect x="6" y="6" width="36" height="34" rx="3"/><circle cx="24" cy="23" r="7"/><path d="M24 16V20M12 40V44M36 40V44"/>'
};
var ICON_STAR = '<path d="M24 5L30 17L43 19L33 29L36 43L24 36L12 43L15 29L5 19L18 17Z"/>';
var FILTER_ICONS = {
ALL: '<path d="M8 12H40M8 24H40M8 36H40"/>',
FAVORITE: ICON_STAR,
NONLIQUID: '<rect x="9" y="21" width="30" height="22" rx="4"/><path d="M15 21V14A9 9 0 0 1 33 14V21"/>',
LIQUID: ICON_LIQUID
};
function drawnIcon(body) {
return '<svg class="ui-icon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
}
function generalIcon(name) {
return '<span class="account-general-icon">' + drawnIcon(GENERAL_ICONS[name] || GENERAL_ICON_OTHER) + '</span>';
}
function accountIcon(acc) {
if (ACCOUNT_ICONS[acc.id]) return ACCOUNT_ICONS[acc.id];
var general = E.generalAccountOf(acc);
if (/^acc_/.test(acc.id) && (general === 'العملاء' || general === 'الموردون' || general === 'أخرى')) return ICON_PERSON;
return GENERAL_ICONS[general] || GENERAL_ICON_OTHER;
}
var generalOpen = {};
var GENERAL_DOUBLE_TAP_MS = 350;
var generalLastTap = null;
function tapGeneralHead(key) {
var now = Date.now();
if (generalLastTap && now - generalLastTap.at < GENERAL_DOUBLE_TAP_MS) {
var openAll = !generalLastTap.allOpen;
generalLastTap = null;
generalOpen = {};
if (openAll) {
document.querySelectorAll('#accountsList [data-general]').forEach(function (head) {
generalOpen[head.getAttribute('data-general')] = true;
});
}
} else {
var heads = [].slice.call(document.querySelectorAll('#accountsList [data-general]'));
generalLastTap = { at: now, allOpen: heads.every(function (head) { return generalOpen[head.getAttribute('data-general')]; }) };
generalOpen[key] = !generalOpen[key];
}
renderAccountsList();
}
function openAccountMenu(btn, id) {
openRowMenu(btn, els.accounts, [['toggle-favorite', E.isFavoriteAccount(id) ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'], ['account-notes', 'ملاحظات'], ['account-budget', 'ميزانية شهرية'], ['account-bot', 'المحادثة'], ['show-account-ledger', 'الدليل'], ['edit-account', 'تعديل'], ['print-account', 'طباعة'], ['opening-balance', '⊕ رصيد افتتاحي'], ['close-balance', 'إقفال الرصيد'], ['delete-account', 'حذف', true]]);
}
function openAccountOpeningSheet(id) {
var acc = E.getAccount(id);
if (!acc) { toast('الحساب غير موجود', true); return; }
var curs = acc.liquid
? E.listCurrencies().map(function (c) { return c.code; })
: (acc.multi && acc.currencies && acc.currencies.length ? acc.currencies : [acc.currency || E.BASE]);
var rowsHtml = curs.map(function (code) {
return '<div class="form-row"><label for="ob-amt-' + esc(code) + '">المبلغ الافتتاحي (' + esc(code) + ')</label>' +
'<input id="ob-amt-' + esc(code) + '" class="ob-cur-input" data-currency="' + esc(code) + '" type="text" inputmode="decimal" dir="ltr" autocomplete="off" placeholder="0.00" /></div>';
}).join('');
openSheet('إثبات رصيد افتتاحي — ' + acc.name,
'<div class="account-form">' +
'<p class="modal-note">أدخل الرصيد الافتتاحي بعملة واحدة أو أكثر. يُرحَّل القيد تلقائياً مقابل حساب «رأس المال».</p>' +
'<div class="form-row"><label for="ob-date">تاريخ الرصيد الافتتاحي</label><input id="ob-date" type="date" dir="ltr" value="' + esc(E.todayISO()) + '" /></div>' +
'<div class="form-pair">' + rowsHtml + '</div>' +
'<div class="modal-actions"><button type="button" class="btn primary" id="obSaveBtn">ترحيل الرصيد الافتتاحي</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button></div></div>');
var saveBtn = document.getElementById('obSaveBtn');
if (saveBtn) {
saveBtn.addEventListener('click', function () {
var items = [];
Array.prototype.forEach.call(document.querySelectorAll('.ob-cur-input'), function (inp) {
var rawVal = String(inp.value || '').replace(/[,،]/g, '').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).trim();
var num = parseFloat(rawVal);
if (num > 0 && isFinite(num)) {
items.push({ currency: inp.getAttribute('data-currency') || E.BASE, amountMinor: Math.round(num * 100) });
}
});
if (!items.length) { toast('أدخل مبلغاً لعملة واحدة على الأقل', true); return; }
var dateVal = (document.getElementById('ob-date') || {}).value || E.todayISO();
var res = E.postOpeningBalance({ accountId: id, amounts: items, date: dateVal });
if (!res.ok) { toast(res.error || 'تعذر إثبات الرصيد الافتتاحي', true); return; }
if (res.entry) pushReceipts([res.entry.id]);
closeSheet();
toast('تم إثبات الرصيد الافتتاحي');
renderAll();
});
}
}
function openCloseBalance(id) {
var acc = E.getAccount(id);
if (!acc) { toast('الحساب غير موجود', true); return; }
var balance = E.accountLedgerBalance(id);
if (!balance.base) { toast('رصيد هذا الحساب صفر', true); return; }
var preferred = acc.type === 'revenue' || acc.type === 'expense' ? 'capital' : (id === 'cash' ? 'bank' : 'cash');
openSheet('إقفال الرصيد',
'<div class="account-form"><p class="modal-note">رصيد «' + esc(acc.name) + '» ' + esc(E.fmtMoney(Math.abs(balance.native), acc.currency, false)) + '. يُنقل كله بقيد واحد إلى الحساب الذي تختاره، فيصبح صفراً.</p>' +
'<div class="form-row"><label for="closeBalanceTo">ينقل الرصيد إلى</label><select id="closeBalanceTo">' +
S().accounts.filter(function (a) { return a.id !== id; }).map(function (a) {
return '<option value="' + esc(a.id) + '"' + (a.id === preferred ? ' selected' : '') + '>' + esc(a.name) + '</option>';
}).join('') + '</select></div>' +
'<div class="modal-actions"><button type="button" class="btn primary" id="closeBalanceSave">إقفال الرصيد</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button></div></div>');
document.getElementById('closeBalanceSave').addEventListener('click', function () {
var res = E.closeAccountBalance(id, document.getElementById('closeBalanceTo').value);
if (!res.ok) { toast(res.error, true); return; }
pushReceipts(res.entry ? [res.entry.id] : null);
closeSheet();
toast('تم إقفال الرصيد. يمكنك التراجع من القائمة ⋮');
});
}
var ACCOUNT_DOUBLE_TAP_MS = 300;
var ACCOUNT_LONG_PRESS_MS = 500;
var accountTapTimer = null;
var accountTapId = null;
var accountPressTimer = null;
var accountPressStart = null;
var accountLongPressed = false;
function tapAccountRow(id) {
if (accountTapTimer && accountTapId === id) {
clearTimeout(accountTapTimer);
accountTapTimer = null;
printAccount(id);
return;
}
if (accountTapTimer) clearTimeout(accountTapTimer);
accountTapId = id;
accountTapTimer = setTimeout(function () {
accountTapTimer = null;
showAccountLedger(id);
}, ACCOUNT_DOUBLE_TAP_MS);
}
function cancelAccountPress() {
if (accountPressTimer) clearTimeout(accountPressTimer);
accountPressTimer = null;
accountPressStart = null;
}
function bindAccountRows() {
els.accounts.addEventListener('pointerdown', function (ev) {
var row = ev.target.closest('[data-account-row]');
if (!row || ev.target.closest('button') || ev.button) return;
cancelAccountPress();
accountPressStart = { x: ev.clientX, y: ev.clientY };
accountPressTimer = setTimeout(function () {
accountPressTimer = null;
accountLongPressed = true;
openAccountMenu(row.querySelector('.row-menu-btn'), row.getAttribute('data-account-row'));
}, ACCOUNT_LONG_PRESS_MS);
});
els.accounts.addEventListener('pointermove', function (ev) {
if (!accountPressTimer || !accountPressStart) return;
if (Math.abs(ev.clientX - accountPressStart.x) > 10 || Math.abs(ev.clientY - accountPressStart.y) > 10) cancelAccountPress();
});
['pointerup', 'pointercancel'].forEach(function (name) {
els.accounts.addEventListener(name, function () {
cancelAccountPress();
if (accountLongPressed) setTimeout(function () { accountLongPressed = false; }, 350);
});
});
els.accounts.addEventListener('contextmenu', function (ev) {
if (ev.target.closest('[data-account-row]')) ev.preventDefault();
});
document.addEventListener('click', function (ev) {
if (!accountLongPressed || ev.target.closest('#rowMenu')) return;
accountLongPressed = false;
ev.stopPropagation();
ev.preventDefault();
}, true);
els.accounts.addEventListener('click', function (ev) {
if (ev.target.closest('button')) return;
var row = ev.target.closest('[data-account-row]');
if (row) tapAccountRow(row.getAttribute('data-account-row'));
});
els.accounts.addEventListener('keydown', function (ev) {
if (ev.key !== 'Enter' || !ev.target.matches('[data-account-row]')) return;
ev.preventDefault();
showAccountLedger(ev.target.getAttribute('data-account-row'));
});
}
function renderAccountsList() {
var holder = document.getElementById('accountsList');
if (!holder) return;
var a = E.computeAnalysis();
var accounts = S().accounts || [];
var term = E.normalizeAr(ui.accountsSearch || '').toLowerCase();
var html = '';
var groups = {};
accounts.forEach(function (acc) {
if (ui.accountsFilter !== 'ALL' && acc.type !== ui.accountsFilter) return;
if (term) {
var hay = E.normalizeAr([acc.name, acc.nickname, acc.hint, acc.subtype, E.generalAccountOf(acc), acc.phone, acc.currency].join(' ')).toLowerCase();
if (hay.indexOf(term) < 0) return;
}
if (!accountMatchesFilter(acc, ui.accountsSubtypeFilter)) return;
if (ui.accountsCurrency && !accountHoldsCurrency(acc, ui.accountsCurrency, a.balances && a.balances[acc.id])) return;
if (!groups[acc.type]) groups[acc.type] = [];
groups[acc.type].push(acc);
});
var anomalousAccs = accounts.filter(function (acc) {
if (ui.accountsFilter !== 'ALL' && acc.type !== ui.accountsFilter) return false;
if (term) {
var hay = E.normalizeAr([acc.name, acc.nickname, acc.hint, acc.subtype, E.generalAccountOf(acc), acc.phone, acc.currency].join(' ')).toLowerCase();
if (hay.indexOf(term) < 0) return false;
}
if (!accountMatchesFilter(acc, ui.accountsSubtypeFilter)) return false;
var b = a.balances && a.balances[acc.id] ? a.balances[acc.id].base : 0;
return acc.type !== 'liability' && E.isAnomalous && E.isAnomalous(acc, b);
});
var owedAccs = accounts.filter(function (acc) {
if (acc.type !== 'liability') return false;
if (ui.accountsFilter !== 'ALL' && acc.type !== ui.accountsFilter) return false;
if (!accountMatchesFilter(acc, ui.accountsSubtypeFilter)) return false;
var b = a.balances && a.balances[acc.id] ? a.balances[acc.id].base : 0;
return E.isAnomalous && E.isAnomalous(acc, b);
});
var owedIds = owedAccs.map(function (a) { return a.id; });
if (anomalousAccs.length) {
html += '<div class="account-general-row anomalous-group"><button type="button" class="account-general" data-general="anomalous" aria-expanded="true" aria-label="حسابات شاذة، ' + anomalousAccs.length + '">';
html += generalIcon('أخرى') + '<span class="account-general-name"><bdi>حسابات شاذة</bdi><span class="account-general-count">' + anomalousAccs.length + '</span></span>';
html += '<span class="account-general-total amount" style="color:var(--danger,#e53935)">⚠</span></button></div>';
html += '<div class="muted" style="padding:4px 12px;font-size:calc(11px * var(--font-scale,1))">حساب مخالف لطبيعته — يمكن نقله مؤقتاً إلى الموردين.</div>';
anomalousAccs.forEach(function (acc) {
var bal = E.accountBalanceShown(acc, a.balances && a.balances[acc.id]);
html += '<div class="row account-row anomalous" data-account-row="' + esc(acc.id) + '" tabindex="0">' +
'<span class="account-row-icon">' + drawnIcon(accountIcon(acc)) + '</span>' +
'<span class="r-main"><span class="r-title">' + esc(acc.name) + '</span>' +
'<span class="r-sub">' + esc(acc.hint || '') + ' • ' + esc(accountCurrencyCodes(acc)) + ' • حساب مخالف لطبيعته</span></span>' +
'<span class="r-value amount ' + (bal.minor < 0 ? 'neg' : '') + '">' + money(bal.minor, bal.currency) + '</span>' +
'<button class="row-menu-btn" data-action="account-menu" data-id="' + esc(acc.id) + '" aria-label="خيارات ' + esc(acc.name) + '" aria-haspopup="menu" aria-expanded="false">⋮</button>' +
'</div>';
});
}
if (owedAccs.length) {
html += '<div class="account-general-row"><div class="account-general" aria-label="' + esc('مستحق لنا عند الموردين، ' + owedAccs.length) + '">';
html += generalIcon('أخرى') + '<span class="account-general-name"><bdi>مستحق لنا عند الموردين</bdi><span class="account-general-count">' + owedAccs.length + '</span></span></div></div>';
owedAccs.forEach(function (acc) {
var bal = E.accountBalanceShown(acc, a.balances && a.balances[acc.id]);
html += '<div class="row account-row" data-account-row="' + esc(acc.id) + '" tabindex="0">' +
'<span class="account-row-icon">' + drawnIcon(accountIcon(acc)) + '</span>' +
'<span class="r-main"><span class="r-title">' + esc(acc.name) + '</span>' +
'<span class="r-sub">' + esc(accountCurrencyCodes(acc)) + ' • مستحق لك</span></span>' +
'<span class="r-value amount">' + money(Math.abs(bal.minor), bal.currency) + '</span>' +
'<button class="row-menu-btn" data-action="account-menu" data-id="' + esc(acc.id) + '" aria-label="خيارات ' + esc(acc.name) + '" aria-haspopup="menu" aria-expanded="false">⋮</button>' +
'</div>';
});
}
var typeOrder = ['asset', 'liability', 'equity', 'revenue', 'expense'];
var _rankIdx = {};
if (E.rankedAccounts) { E.rankedAccounts().forEach(function (a, i) { _rankIdx[a.id] = i; }); }
var sortMode = ui.accountsSort || 'rank';
var flatView = ui.accountsView === 'flat';
var lastActByAcc = {};
if (sortMode === 'activity') {
(S().entries || []).forEach(function (e) {
(e.lines || []).forEach(function (l) {
if (!lastActByAcc[l.accountId] || e.date > lastActByAcc[l.accountId]) lastActByAcc[l.accountId] = e.date;
});
});
}
var baseOfAcc = function (acc) { return a.balances && a.balances[acc.id] ? a.balances[acc.id].base : 0; };
var orderAccounts = function (list) {
if (sortMode === 'name') return list.sort(function (x, y) { return E.normalizeAr(x.name || '').localeCompare(E.normalizeAr(y.name || ''), 'ar'); });
if (sortMode === 'balance-desc') return list.sort(function (x, y) { return baseOfAcc(y) - baseOfAcc(x); });
if (sortMode === 'balance-asc') return list.sort(function (x, y) { return baseOfAcc(x) - baseOfAcc(y); });
if (sortMode === 'activity') return list.sort(function (x, y) { return String(lastActByAcc[y.id] || '').localeCompare(String(lastActByAcc[x.id] || '')); });
return list.sort(function (x, y) { var rx = _rankIdx[x.id]; var ry = _rankIdx[y.id]; if (rx == null && ry == null) return 0; if (rx == null) return 1; if (ry == null) return -1; return rx - ry; });
};
typeOrder.forEach(function (typ) {
var list = groups[typ];
if (!list || !list.length) return;
list = list.filter(function (acc) { return owedIds.indexOf(acc.id) < 0; });
if (!list.length) return;
orderAccounts(list);
E.generalAccountGroups(list, typ).forEach(function (general) {
var generalTotal = general.accounts.reduce(function (sum, acc) { return sum + (a.balances && a.balances[acc.id] ? a.balances[acc.id].base : 0); }, 0);
var generalKey = typ + ':' + general.name;
if (general.name === 'سيولة نقدية' && !generalOpen[generalKey]) generalOpen[generalKey] = true;
var generalShown = flatView || !!term || ui.accountsSubtypeFilter !== 'ALL' || !!ui.accountsCurrency || !!generalOpen[generalKey];
if (!flatView) html += '<div class="account-general-row"><button type="button" class="account-general" data-general="' + esc(generalKey) + '" aria-expanded="' + generalShown + '" aria-label="' + esc(general.name + '، ' + accountCountText(general.accounts.length)) + '">' + generalIcon(general.name) +
'<span class="account-general-name"><bdi>' + esc(general.name) + '</bdi><span class="account-general-count">' + general.accounts.length + '</span></span>' +
(general.accounts.some(function (acc) { return acc.liquid && (a.balances && a.balances[acc.id] ? a.balances[acc.id].base : 0) < 0; }) ? (function () {
var negAccs = general.accounts.filter(function (acc) { return acc.liquid && (a.balances && a.balances[acc.id] ? a.balances[acc.id].base : 0) < 0; });
var names = negAccs.map(function (acc) { return acc.name; }).join('، ');
return '<span class="account-general-alert" data-action="account-ledger" data-id="' + esc(negAccs[0].id) + '" title="صندوق سالب: ' + esc(names) + '" style="color:var(--danger,#e53935);margin-inline-start:6px;cursor:pointer">⚠</span>';
})() : '') +
(function () {
var rec = 0, pay = 0;
if (general.name === 'العملاء' || general.name === 'الموردون') {
general.accounts.forEach(function (acc) {
(a.dueItems || []).forEach(function (due) {
if (E.normalizeName(due.counterparty || '') !== E.normalizeName(acc.name || '')) return;
if (due.kind === 'payable') pay += (Number(due.remaining) || 0);
else rec += (Number(due.remaining) || 0);
});
});
}
if (rec || pay) return '<span class="account-general-total amount">' + (rec ? 'لك ' + money(rec) : '') + (rec && pay ? ' • ' : '') + (pay ? 'عليك ' + money(pay) : '') + '</span>';
return '<span class="account-general-total amount">' + money(generalTotal) + '</span>';
})() +
'<svg class="ui-icon account-general-chevron" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M30 12L18 24L30 36"/></svg></button>' +
'<button type="button" class="account-general-add" data-action="add-account" data-type="' + typ + '" data-subtype="' + esc(general.name === 'أخرى' ? '' : general.name) + '" aria-label="' + esc('حساب جديد في ' + general.name) + '" title="حساب جديد">' + UI_ICONS.plus + '</button></div>';
if (!generalShown) return;
general.accounts.forEach(function (acc) {
var raw = a.balances && a.balances[acc.id] ? a.balances[acc.id] : { native: 0, base: 0, byCurrency: {} };
var bal = E.accountBalanceShown(acc, raw);
var foreign = !acc.multi && acc.currency !== E.BASE;
var avgText = foreign && raw.native ? ' • متوسط السعر: ' + Number(Math.abs(raw.base / raw.native)).toLocaleString('en-US', { maximumFractionDigits: 4 }) : '';
var curLines = acc.multi ? E.accountCurrencies(acc, raw).map(function (p) {
return '<span class="account-row-currency"><span class="amount' + (p.native < 0 ? ' neg' : '') + '">' + money(p.native, p.currency) + '</span>' +
(p.currency !== E.mainCurrency() ? ' ' + equivHtml(p.base, 'account-row-equiv') : '') + '</span>';
}).join('') : '';
var lastAct = '';
var lastDate = null;
(S().entries || []).forEach(function (e) {
if ((e.lines || []).some(function (l) { return l.accountId === acc.id; })) {
if (!lastDate || e.date > lastDate) lastDate = e.date;
}
});
if (lastDate) {
var days = E.daysBetween(lastDate, E.todayISO());
if (days >= 30) lastAct = ' • آخر حركة: قبل ' + days + ' يوم';
}
html += '<div class="row account-row" data-account-row="' + esc(acc.id) + '" tabindex="0">' +
'<span class="account-row-icon">' + drawnIcon(accountIcon(acc)) + '</span>' +
'<span class="r-main"><span class="r-title">' + esc(acc.name) +
(acc.nickname ? ' <span class="muted account-row-nick">(' + esc(acc.nickname) + ')</span>' : '') +
(acc.liquid ? '<span class="account-row-liquid" role="img" aria-label="سائل" title="سائل">' + drawnIcon(ICON_LIQUID) + '</span>' : '') +
(E.isFavoriteAccount(acc.id) ? '<span class="account-row-favorite" role="img" aria-label="مفضل" title="مفضل">' + drawnIcon(ICON_STAR) + '</span>' : '') + '</span>' +
(E.isAnomalous && E.isAnomalous(acc, bal.minor) ? '<span class="account-row-badge anomalous" title="رصيد معاكس للطبيعة">⚠</span>' : '') +
(function () {
var due = (a.dueItems || []).filter(function (d) { return d.accountId === acc.id && (Number(d.remaining) || 0) > 0; })[0];
if (!due) return '';
var status = due.status || E.dueStatus(due);
if (status.key === 'overdue') return '<span class="account-row-badge overdue" title="متأخر">⚠</span>';
if (status.key === 'soon') return '<span class="account-row-badge soon" title="يستحق قريباً">⏰</span>';
return '';
})() +
'<span class="r-sub">' + (acc.hint ? esc(acc.hint) + ' • ' : '') +
esc(accountCurrencyCodes(acc)) + (acc.phone ? ' • ' + esc(acc.phone) : '') + (acc.email ? ' • ' + esc(acc.email) : '') + avgText + esc(lastAct) + '</span></span>' +
(curLines ? '<span class="account-row-currencies">' + curLines + '</span>' : '') + '</span>' +
'<span class="r-value amount ' + (bal.minor < 0 ? 'neg' : bal.minor === 0 ? 'zero' : '') + '">' + money(bal.minor, bal.currency) +
(foreign && raw.native ? equivHtml(raw.base, 'account-row-equiv') : '') + '</span>' +
'<button class="row-menu-btn" data-action="account-menu" data-id="' + esc(acc.id) + '" aria-label="خيارات ' + esc(acc.name) + '" aria-haspopup="menu" aria-expanded="false">⋮</button>' +
'</div>';
});
});
});
if (html) html = '<div class="card" style="padding:0">' + html + '</div>';
if (accounts.length) {
html += '<div class="muted" style="text-align:center;font-size:calc(11.5px * var(--font-scale,1));padding:10px">' +
'تم عرض ' + accounts.filter(function (a) { return ui.accountsFilter === 'ALL' || a.type === ui.accountsFilter; }).length + ' من ' + accounts.length + ' حساب</div>';
}
holder.innerHTML = html || '<div style="text-align:center;padding:24px 12px"><p class="muted">' + (ui.accountsSubtypeFilter === 'FAVORITE' ? 'لا توجد حسابات مفضلة بعد. اضغط ⋮ بجانب الحساب ثم «إضافة إلى المفضلة».' : 'لا توجد حسابات مطابقة.') + '</p><div class="modal-actions" style="justify-content:center;margin-top:10px"><button class="btn ghost small" data-action="clear-accounts-filter">مسح الفلتر</button><button class="btn primary small" data-action="add-account">＋ إضافة حساب</button></div></div>';
}
function renderLedgerList() {
var holder = document.getElementById('ledgerList');
if (!holder) return;
closeRowMenu();
var list = filteredEntries();
if (!list.length) {
holder.innerHTML = '<div class="card"><div class="empty"><span class="glyph">☰</span>لا توجد قيود مطابقة.<br><button class="btn primary small" data-action="go-tab" data-tab-name="bot" style="margin-top:10px">ابدأ من البوت</button></div></div>';
return;
}
var visible = Math.min(ui.ledgerVisible || 50, list.length);
var hint = '<div class="muted ledger-more-hint" style="text-align:center;font-size: calc(11.5px * var(--font-scale, 1));padding:10px">' +
(visible < list.length ? 'يتم عرض ' + visible + ' من ' + list.length + ' — مرّر لتحميل المزيد…' : 'تم عرض جميع الـ ' + list.length + ' قيود') +
'</div>';
holder.innerHTML = list.slice(0, visible).map(entryCard).join('') + hint;
}
var ENTRY_KIND_ICONS = {
expense: LEDGER_FILTER_ICONS.expense,
income: LEDGER_FILTER_ICONS.income,
transfer: LEDGER_FILTER_ICONS.transfer,
capital: LEDGER_FILTER_ICONS.capital,
lend: '<path d="M6 24H34M26 14L36 24L26 34"/><path d="M42 10V38"/>',
borrow: '<path d="M42 24H14M22 14L12 24L22 34"/><path d="M6 10V38"/>',
collect: '<path d="M24 6V30M14 20L24 30L34 20"/><path d="M8 36V42H40V36"/>',
repay: '<path d="M24 30V6M14 16L24 6L34 16"/><path d="M8 36V42H40V36"/>'
};
function entryCard(entry) {
var meta = kindMeta(entry.kind);
var sign = meta.sign;
var rawTitle = entry.memo || meta.label;
var title = (S().settings && S().settings.hideAmounts) ? rawTitle.replace(/[0-9٠-٩]+/g, '•••') : rawTitle;
if (title.length > 58) title = title.slice(0, 58) + '…';
var lines = (S().settings && S().settings.simpleMode) ? '' : (entry.lines.map(function (l) {
var debit = (l.debitBase || 0) > 0;
return '<div class="entry-line">' +
'<span class="side ' + (debit ? 'debit' : 'credit') + '">' + (debit ? 'مدين' : 'دائن') + '</span>' +
'<span class="details"><button type="button" class="btn ghost small" style="padding:1px 6px;min-height:24px;font-size:calc(11px*var(--font-scale,1))" data-action="print-account" data-id="' + esc(l.accountId) + '" title="كشف الحساب">' + esc(accountName(l.accountId)) + '</button></span>' +
'<b class="amount">' + (isValueOnlyLine(l) ? money(l.debitBase || l.creditBase) : money(debit ? l.debit : l.credit, l.currency)) + '</b></div>';
}).join('') + (rateText(entry.lines) ? '<div class="entry-line entry-rate">' + esc(rateText(entry.lines)) + '</div>' : ''));
var entryFxText = fxText(E.entryFx(entry));
if (entryFxText) lines += '<div class="entry-line entry-rate entry-fx">' + esc(entryFxText) + '</div>';
var expanded = !!ui.expandedEntries[entry.id];
var selected = !!ui.selectedEntries[entry.id];
var checkbox = ui.multiSelect ? '<input type="checkbox" class="entry-select-cb" data-id="' + esc(entry.id) + '" ' + (selected ? 'checked' : '') + ' style="width:18px;height:18px;margin-inline-end:8px;accent-color:var(--emerald);flex:0 0 auto" />' : '';
return '<div class="entry' + (expanded ? '' : ' compact') + (selected ? ' selected' : '') + '" data-action="toggle-entry" data-id="' + esc(entry.id) + '" data-longpress="true" style="cursor:pointer">' +
'<div class="entry-head">' +
checkbox +
'<span class="entry-icon' + (sign < 0 ? ' out' : sign > 0 ? ' in' : '') + '">' + drawnIcon(ENTRY_KIND_ICONS[entry.kind] || LEDGER_FILTER_ICONS.debt) + '</span>' +
'<div class="r-main"><span class="entry-title">' + esc(title) + '</span>' +
'<span class="entry-date">' + E.fmtDate(entry.date) + ' • ' + meta.label +
(entry.counterparty ? ' • <button type="button" class="btn ghost small" style="padding:1px 6px;min-height:24px;font-size:calc(11px*var(--font-scale,1))" data-action="print-counterparty" data-name="' + esc(entry.counterparty) + '" title="كشف حساب الطرف">' + esc(entry.counterparty) + '</button>' : '') + '</span></div>' +
'<span class="entry-amount amount' + (sign < 0 ? ' out' : '') + '">' + (sign < 0 ? '−' : sign > 0 ? '+' : '') + money(entry.totalBase) + '</span>' +
entryAttachments(entry.id) +
'<button class="row-menu-btn" data-action="entry-menu" data-id="' + esc(entry.id) + '" aria-label="خيارات القيد" aria-haspopup="menu" aria-expanded="false">⋮</button>' +
'</div>' +
(expanded ? '<div class="entry-lines">' + lines + '</div>' : '') +
'</div>';
}
var SETTINGS_ICONS = {
profile: ICON_PERSON,
license: '<path d="M14 8H34L42 18L24 41L6 18Z"/><path d="M6 18H42M14 8L20 18L24 41M34 8L28 18L24 41"/>',
key: '<circle cx="15" cy="33" r="9"/><path d="M21 27L40 8M32 16L38 22M26 22L30 26"/>',
backup: '<path d="M8 14L14 7H34L40 14V39A3 3 0 0 1 37 42H11A3 3 0 0 1 8 39Z"/><path d="M8 14H40M24 21V35M18 29L24 35L30 29"/>',
pairing: '<rect x="7" y="9" width="14" height="28" rx="3"/><rect x="27" y="11" width="14" height="28" rx="3"/><path d="M21 19H27M21 29H27"/>',
guide: '<path d="M24 11C19 8 12 8 6 10V38C12 36 19 36 24 39C29 36 36 36 42 38V10C36 8 29 8 24 11Z"/><path d="M24 11V39"/>',
persona: '<circle cx="24" cy="24" r="18"/><circle cx="24" cy="24" r="6"/><path d="M24 6V12M24 36V42M6 24H12M36 24H42"/>',
display: '<rect x="6" y="8" width="36" height="32" rx="4"/><path d="M6 18H42M18 18V40"/>',
zakat: '<path d="M35 30A14 14 0 1 1 21 10A11 11 0 0 0 35 30Z"/><path d="M34 11V19M30 15H38"/>',
access: '<circle cx="24" cy="24" r="18"/><path d="M24 6V42"/><path d="M24 12L36 24L24 36"/>',
currency: '<circle cx="19" cy="19" r="11"/><path d="M33 21A11 11 0 1 1 21 33"/><path d="M19 14V24M15 17H22"/>',
search: '<circle cx="21" cy="21" r="14"/><path d="M31.5 31.5L42 42"/>',
reminders: '<path d="M18 37A6 6 0 0 0 30 37"/><path d="M10 34H38L35 29V20A11 11 0 0 0 13 20V29Z"/>',
fraud: '<path d="M24 5L40 11V23C40 33 33 40 24 43C15 40 8 33 8 23V11Z"/><path d="M24 16V26M24 33H24.1"/>',
sovereignty: '<rect x="9" y="21" width="30" height="22" rx="4"/><path d="M15 21V14A9 9 0 0 1 33 14V21"/><path d="M24 30V34"/>',
ai: '<path d="M24 6L28 18L40 22L28 26L24 38L20 26L8 22L20 18Z"/><path d="M37 8V14M34 11H40"/>',
dictionary: '<rect x="9" y="6" width="30" height="36" rx="4"/><path d="M16 6V42M22 16H32M22 24H30"/>',
system: '<path d="M7 14H22M34 14H41"/><circle cx="28" cy="14" r="6"/><path d="M7 34H14M26 34H41"/><circle cx="20" cy="34" r="6"/>'
};
var settingsOpen = {};
var settingsLastTap = null;
function settingsGroupKey(g, idx) {
return (g && g.getAttribute('data-screen')) || ('g' + idx);
}
function syncSettingsGroupsAndChips(scrollKey) {
if (!els.settings) return;
var groups = [].slice.call(els.settings.querySelectorAll('.group-title'));
var openCount = 0;
groups.forEach(function (g, idx) {
var key = settingsGroupKey(g, idx);
var open = !!settingsOpen[key];
if (open) openCount++;
g.classList.toggle('collapsed', !open);
g.setAttribute('aria-expanded', open ? 'true' : 'false');
var chip = els.settings.querySelector('.settings-chips .chip[data-chip-key="' + key + '"]');
if (chip) {
chip.classList.toggle('active', open && openCount <= groups.length);
chip.setAttribute('aria-pressed', open ? 'true' : 'false');
if (scrollKey === key && open && chip.scrollIntoView) {
chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}
}
});
var allChip = els.settings.querySelector('.settings-chips .chip[data-chip-key="__all__"]');
if (allChip) {
var allOpen = openCount === groups.length && groups.length > 0;
allChip.classList.toggle('active', allOpen);
allChip.setAttribute('aria-pressed', allOpen ? 'true' : 'false');
}
}
function openSettingsSection(key) {
setTab('settings');
if (key) {
settingsOpen = {};
settingsOpen[key] = true;
}
syncSettingsGroupsAndChips(key);
setTimeout(function () {
var g = key && els.settings ? els.settings.querySelector('.group-title[data-settings-key="' + key + '"], .group-title[data-screen="' + key + '"]') : null;
if (g && g.scrollIntoView) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
}, 30);
}
function tapSettingsGroup(key) {
var now = Date.now();
var groups = [].slice.call(els.settings ? els.settings.querySelectorAll('.group-title') : []);
if (settingsLastTap && now - settingsLastTap.at < GENERAL_DOUBLE_TAP_MS) {
var openAll = !settingsLastTap.allOpen;
settingsLastTap = null;
settingsOpen = {};
if (openAll) {
groups.forEach(function (g, idx) {
settingsOpen[settingsGroupKey(g, idx)] = true;
});
}
syncSettingsGroupsAndChips();
return;
}
var allOpen = groups.length > 0 && groups.every(function (g, idx) {
return !!settingsOpen[settingsGroupKey(g, idx)];
});
settingsLastTap = { at: now, allOpen: allOpen };
settingsOpen[key] = !settingsOpen[key];
syncSettingsGroupsAndChips(key);
}
function filterSettings(q) {
q = String(q || '').toLowerCase().trim();
var body = document.getElementById('settingsBody');
if (!body) return;
var groups = body.querySelectorAll('.group-title');
var cards = body.querySelectorAll('.card');
var settings = body.querySelectorAll('.setting');
settings.forEach(function (el) {
var txt = (el.textContent || '').toLowerCase();
el.style.display = (!q || txt.indexOf(q) >= 0) ? '' : 'none';
});
cards.forEach(function (card) {
var vis = card.querySelectorAll('.setting:not([style*="display: none"])');
var hasVisible = q === '' || vis.length > 0 || (card.textContent || '').toLowerCase().indexOf(q) >= 0;
card.style.display = hasVisible ? '' : 'none';
});
groups.forEach(function (g) {
var next = g.nextElementSibling;
var anyVisible = false;
while (next && !next.classList.contains('group-title')) {
if (next.classList.contains('card') && next.style.display !== 'none') anyVisible = true;
next = next.nextElementSibling;
}
g.style.display = (q === '' || anyVisible) ? '' : 'none';
});
}
function openReportScheduleSheet() {
var st = S();
if (!st.settings) st.settings = {};
if (!st.settings.reportSchedule) st.settings.reportSchedule = { enabled: false, type: 'cashflow', frequency: 'weekly', nextRun: null };
var rs = st.settings.reportSchedule;
var body = '<div id="reportScheduleRoot">' +
'<div class="setting" style="padding:8px 0"><div class="s-main"><span class="s-title">تفعيل الجدولة</span></div><button class="switch' + (rs.enabled ? ' on' : '') + '" role="switch" aria-checked="' + (rs.enabled ? 'true' : 'false') + '" id="rsEnabled"></button></div>' +
'<div class="field"><label>نوع التقرير</label><select id="rsType">' +
'<option value="cashflow"' + (rs.type === 'cashflow' ? ' selected' : '') + '>التدفق النقدي</option>' +
'<option value="balance"' + (rs.type === 'balance' ? ' selected' : '') + '>الميزانية</option>' +
'<option value="pl"' + (rs.type === 'pl' ? ' selected' : '') + '>الأرباح والخسائر</option>' +
'</select></div>' +
'<div class="field"><label>التكرار</label><select id="rsFreq">' +
'<option value="daily"' + (rs.frequency === 'daily' ? ' selected' : '') + '>يومي</option>' +
'<option value="weekly"' + (rs.frequency === 'weekly' ? ' selected' : '') + '>أسبوعي</option>' +
'<option value="monthly"' + (rs.frequency === 'monthly' ? ' selected' : '') + '>شهري</option>' +
'</select></div>' +
'<div class="modal-actions"><button type="button" class="btn primary" id="rsSave">حفظ</button><button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button></div>' +
'</div>';
openSheet('جدولة التقارير (Scheduled Reports)', body);
setTimeout(function () {
var enBtn = document.getElementById('rsEnabled');
if (enBtn) enBtn.addEventListener('click', function () {
enBtn.classList.toggle('on');
enBtn.setAttribute('aria-checked', enBtn.classList.contains('on') ? 'true' : 'false');
});
var saveBtn = document.getElementById('rsSave');
if (saveBtn) saveBtn.addEventListener('click', function () {
var st = S();
if (!st.settings) st.settings = {};
if (!st.settings.reportSchedule) st.settings.reportSchedule = {};
var rs2 = st.settings.reportSchedule;
rs2.enabled = document.getElementById('rsEnabled').classList.contains('on');
rs2.type = document.getElementById('rsType').value;
rs2.frequency = document.getElementById('rsFreq').value;
var now = new Date();
var next = new Date(now);
if (rs2.frequency === 'daily') next.setDate(next.getDate() + 1);
else if (rs2.frequency === 'weekly') next.setDate(next.getDate() + 7);
else next.setMonth(next.getMonth() + 1);
rs2.nextRun = next.toISOString().slice(0, 10);
E.saveState();
toast('تم حفظ جدولة التقارير');
renderAll();
var modal = document.getElementById('modal');
if (modal) modal.classList.remove('open');
});
}, 50);
}
function openAutoConfirmTuning() {
var st = S();
if (!st.settings) st.settings = {};
var thresh = st.settings.autoConfirmThreshold || 92;
var usage = st.settings.autoConfirmUsageCount || 3;
openSheet('Auto-Confirm Tuning', '<div id="acTuningRoot">' +
'<div class="form-row"><label for="acThresh">عتبة الثقة (%)</label><input id="acThresh" type="number" min="50" max="99" value="' + thresh + '" style="width:100%;min-height:36px;padding:8px 10px;border-radius:10px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink)" /></div>' +
'<div class="form-row"><label for="acUsage">عدد الاستخدامات (usageCount)</label><input id="acUsage" type="number" min="1" max="20" value="' + usage + '" style="width:100%;min-height:36px;padding:8px 10px;border-radius:10px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink)" /></div>' +
'<div class="modal-actions"><button type="button" class="btn primary" id="acSave">حفظ</button><button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button></div>' +
'</div>');
setTimeout(function () {
var btn = document.getElementById('acSave');
if (btn) btn.addEventListener('click', function () {
var t = Number(document.getElementById('acThresh').value);
var u = Number(document.getElementById('acUsage').value);
if (!(t >= 50 && t <= 99)) { toast('عتبة الثقة بين 50 و 99', true); return; }
if (!(u >= 1 && u <= 20)) { toast('عدد الاستخدامات بين 1 و 20', true); return; }
st.settings.autoConfirmThreshold = t;
st.settings.autoConfirmUsageCount = u;
E.saveState();
toast('تم حفظ إعدادات Auto-Confirm');
renderAll();
var modal = document.getElementById('modal');
if (modal) modal.classList.remove('open');
});
}, 50);
}
function filterSettingsTab() {
var body = document.getElementById('settingsBody');
if (!body) return;
var tab = (ui.settingsTab || 'all');
var screenMap = {
all: ['profile', 'users', 'display', 'reminders', 'currency', 'zakat', 'access', 'ai', 'vectormemory', 'dictionary', 'fraud', 'sovereignty', 'system'],
profile: ['profile', 'users'],
display: ['display', 'reminders'],
currency: ['currency'],
zakat: ['zakat'],
access: ['access', 'ai', 'vectormemory', 'dictionary', 'fraud'],
backup: ['sovereignty'],
data: ['sovereignty', 'system', 'fraud']
};
var allowed = screenMap[tab] || [];
var nodes = Array.prototype.slice.call(body.children);
var currentAllowed = true;
nodes.forEach(function (n) {
if (n.classList && n.classList.contains('group-title')) {
var sc = n.getAttribute('data-screen');
currentAllowed = (!sc) || (allowed.indexOf(sc) >= 0);
n.style.display = currentAllowed ? '' : 'none';
return;
}
if (n.classList && n.classList.contains('card')) {
n.style.display = currentAllowed ? '' : 'none';
}
});
var hero = body.querySelector('.settings-hero');
if (hero) hero.style.display = '';
var qg = body.querySelector('.settings-quick-grid');
if (qg) qg.style.display = '';
var sb = body.querySelector('.settings-search-box');
if (sb) sb.style.display = '';
var stabs = body.querySelector('.settings-tabs');
if (stabs) stabs.style.display = '';
}
function renderSettings() {
var st = S();
var hidden = !!st.settings.hideAmounts;
var currencyLocked = E.mainCurrencyLocked();
var html = '';
var me = E.getProfile();
var pDefSet = activePersonaDef();
var planInfo = E.getPlanInfo();
var pctUsed = Math.min(100, Math.round((planInfo.entriesThisMonth / E.FREE_MONTHLY_ENTRIES) * 100));
var heroLicTitle = planInfo.activated
? (planInfo.licenseKind === 'annual' || planInfo.id === 'annual' ? 'باقة الأعمال السنوية (مفعّلة)' : 'رخصة مدى الحياة (مفعّلة)')
: 'الباقة الأساسية (مجاني)';
var heroLicIcon = drawnIcon(planInfo.activated ? SETTINGS_ICONS.license : SETTINGS_ICONS.key);
var heroLicSub = planInfo.activated
? (planInfo.expiresAt ? 'صالحة حتى ' + E.fmtDate(planInfo.expiresAt) + ' • جميع القيود والعملات مفتوحة' : 'مفعّلة دائماً بلا حد للقيود أو العملات')
: (planInfo.monthlyLimit ? ('استخدمت ' + planInfo.entriesThisMonth + ' من ' + planInfo.monthlyLimit + ' قيد هذا الشهر') : planUsageText(planInfo));
html += '<div class="settings-hero">' +
'<div class="settings-hero-top">' +
profileAvatar(me, 'profile-avatar') +
'<div class="settings-hero-info">' +
'<div class="settings-hero-name">' + esc(me.name || 'دفتر موني كود السيادي') + (me.business ? ' — ' + esc(me.business) : '') + '</div>' +
'<div class="settings-hero-meta">' + esc([pDefSet ? pDefSet.title : 'حسابات عامة', me.phone, 'رمز الجهاز: ' + E.deviceCode()].filter(Boolean).join(' • ')) + '</div>' +
'<div class="settings-hero-meta" style="margin-top:4px;font-size:calc(11px * var(--font-scale,1))">' +
'🏆 ' + esc((E.cfoRank ? E.cfoRank().title : 'مدون مالي')) +
' · 🧠 ذكاء البوت ' + (E.aiIQ ? E.aiIQ().pct : 0) + '%' +
' · ⚡ سرعة ' + (E.speedStreak ? E.speedStreak() : 0) +
'</div>' +
'</div>' +
'<button type="button" class="settings-hero-edit" data-action="edit-profile">تعديل</button>' +
'</div>' +
'<div class="settings-hero-license">' +
'<div class="settings-hero-plan">' +
'<span class="settings-hero-plan-title">' + heroLicIcon + esc(heroLicTitle) + '</span>' +
'<span class="settings-hero-plan-sub">' + esc(heroLicSub) + '</span>' +
(!planInfo.activated && planInfo.monthlyLimit ? '<div class="settings-hero-bar"><div class="settings-hero-bar-fill" style="width:' + pctUsed + '%"></div></div>' : '') +
'</div>' +
'<button type="button" class="settings-hero-cta" data-action="open-activation">' + (planInfo.activated ? 'إدارة الرخصة' : 'ترقية / تفعيل') + '</button>' +
'</div>' +
'</div>';
html += '<div class="settings-quick-grid" role="group" aria-label="إجراءات سريعة">' +
'<button type="button" class="settings-quick-tile" data-action="copy-export"><span class="settings-quick-icon">' + drawnIcon(SETTINGS_ICONS.backup) + '</span><span class="settings-quick-label">' + esc(uiStr('tileBackup', 'نسخة احتياطية')) + '</span></button>' +
'<button type="button" class="settings-quick-tile" data-action="open-pairing"><span class="settings-quick-icon">' + drawnIcon(SETTINGS_ICONS.pairing) + '</span><span class="settings-quick-label">' + esc(uiStr('tilePairing', 'اقتران جهاز')) + '</span></button>' +
'<button type="button" class="settings-quick-tile" data-action="open-user-guide"><span class="settings-quick-icon">' + drawnIcon(SETTINGS_ICONS.guide) + '</span><span class="settings-quick-label">' + esc(uiStr('tileGuide', 'دليل الاستخدام')) + '</span></button>' +
'<button type="button" class="settings-quick-tile" data-action="open-onboarding"><span class="settings-quick-icon">' + drawnIcon(SETTINGS_ICONS.persona) + '</span><span class="settings-quick-label">' + esc(uiStr('tilePersona', 'طابع الدفاتر')) + '</span></button>' +
'</div>';
html += '<div class="group-title" data-screen="profile"><span class="gt-icon">' + drawnIcon(SETTINGS_ICONS.profile) + '</span>' + esc(uiStr('secProfile', 'الهوية والترخيص')) + '</div>';
html += '<div class="card" style="padding:0">' +
settingRow('الملف الشخصي والنشاط', [me.name || 'بلا اسم', me.business, me.phone].filter(Boolean).join(' • ') || 'أضف اسمك ورقم هاتفك ونشاطك', 'edit-profile', 'تعديل') +
settingRow('شاشة الترحيب وطابع الدفاتر', pDefSet ? 'الحالي: ' + pDefSet.title + ' — اضغط لتغيير الشخصية أو الإعدادات' : 'جولة في التطبيق، وفيها شخصيتك وعملتك وحساباتك وإعداداتك', 'open-onboarding', 'عرض') +
settingRow('خطة الحساب والتفعيل', heroLicSub, 'open-activation', planInfo.activated ? 'إدارة' : 'تفعيل') +
settingRow('دليل الاستخدام وقاموس الأمثلة', 'كيف تسجل القيود بالصوت والعامية، الديون، العملات، وإقران الأجهزة', 'open-user-guide', 'فتح الدليل') +
'</div>';
if (window.RohOwner) {
html += '<div class="group-title" data-screen="users"><span class="gt-icon">' + drawnIcon(SETTINGS_ICONS.profile) + '</span>المستخدمون (owner)</div>';
html += '<div class="card" style="padding:0">' +
settingRow('إدارة المستخدمين', 'إضافة/تعطيل مستخدمين وتعيين أدوار', 'open-users', 'إدارة') +
settingRow('سجل الرقابة (Audit)', 'من فعل ماذا ومتى', 'open-audit-log', 'عرض') +
settingRow('سجل الأحداث (Events)', 'دخول/خروج/تصدير/أخطاء', 'open-event-log', 'عرض') +
'</div>';
}
html += '<div class="group-title" data-screen="currency" style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
'<span style="display:inline-flex;align-items:center;gap:8px"><span class="gt-icon">' + drawnIcon(SETTINGS_ICONS.currency) + '</span>' + esc(uiStr('secCurrency', 'العملة والأسعار (E-Rates)')) + '</span>' +
'<button class="btn ghost small" data-action="add-currency">＋ إضافة عملة</button></div>';
var stamp = (S().settings && S().settings.ratesUpdatedAt) || null;
html += '<div class="card" style="padding:0">';
E.listCurrencies().slice().sort(function (a, b) {
var fa = E.isFavoriteCurrency(a.code) ? 0 : 1;
var fb = E.isFavoriteCurrency(b.code) ? 0 : 1;
if (fa !== fb) return fa - fb;
var ua = a.used ? 0 : 1;
var ub = b.used ? 0 : 1;
if (ua !== ub) return ua - ub;
return String(a.name || a.code).localeCompare(String(b.name || b.code), 'ar');
}).forEach(function (cur) {
var c = cur.code;
var isMain = c === E.mainCurrency();
if (c === E.BASE && isMain) return;
var flag = (E.currencyFlag ? E.currencyFlag(c) : '');
var country = (E.currencyCountry ? E.currencyCountry(c) : '');
var rawRateMain = isMain ? 1 : E.rateAgainstMain(c);
var weakerCur = !isMain && rawRateMain > 0 && rawRateMain < 0.5;
var invRateVal = weakerCur ? +(1 / rawRateMain).toFixed(2) : null;
var rateText = isMain ? '1' : (weakerCur ? String(invRateVal) : (E.fmtRate ? E.fmtRate(c) : String(rawRateMain)));
var unitPair = isMain ? (esc(cur.symbol) + '/' + esc(E.mainCurrency())) : (weakerCur ? (esc(cur.symbol) + '/' + esc(E.mainCurrency())) : (esc(E.mainCurrency()) + '/' + esc(cur.symbol)));
var subRateNote = isMain ? 'العملة الأساسية' : (weakerCur ? ('1 ' + esc(E.mainCurrency()) + ' = ' + esc(String(invRateVal)) + ' ' + esc(c) + ' (' + esc(E.fmtRate ? E.fmtRate(c) : String(rawRateMain)) + ')') : ('1 ' + esc(c) + ' = ' + esc(rateText) + ' ' + esc(E.mainCurrency())));
html += '<div class="setting"><div class="s-main"><span class="s-title">' + (flag ? flag + ' ' : '') + c + (cur.name ? ' <span class="muted" style="font-size: calc(11px * var(--font-scale, 1));font-weight:500">' + esc(cur.name) + '</span>' : '') + (country ? ' <span class="muted" style="font-size: calc(10px * var(--font-scale, 1))">' + esc(country) + '</span>' : '') + '</span>' +
'<span class="s-sub">' + (E.isFavoriteCurrency(cur.code) ? '★ ' : '') + subRateNote + (cur.used && !isMain ? ' • مستخدمة' : '') + (cur.type && E.currencyTypeNames ? ' • ' + esc(E.currencyTypeNames[cur.type]) : '') + '</span></div>' +
'<span class="amount" dir="ltr" style="margin-right:auto;font-size: calc(13px * var(--font-scale, 1));font-weight:700">' + esc(rateText) + ' <span style="font-size: calc(10.5px * var(--font-scale, 1));color:var(--muted);font-weight:500">' + unitPair + '</span></span>' +
(c === E.BASE ? '<span class="row-menu-btn" aria-hidden="true" style="visibility:hidden"></span>' : '<button class="row-menu-btn" data-action="currency-menu" data-id="' + c + '" data-used="' + (cur.used ? '1' : '') + '" aria-label="خيارات ' + c + '" aria-haspopup="menu" aria-expanded="false">⋮</button>') +
'</div>';
});
if (stamp) {
html += '<div class="muted" style="font-size: calc(10.5px * var(--font-scale, 1));padding:8px 12px">آخر تحديث: ' + esc(E.fmtDate ? E.fmtDate(stamp.slice(0,10)) : stamp) + '</div>';
}
html += '<div class="setting"><div class="s-main"><span class="s-title">الحسابات الجديدة متعددة العملات</span>' +
'<span class="s-sub">' + (E.defaultMultiCurrency() ? 'مفعّل: الحسابات الجديدة تقبل جميع العملات' : 'معطّل: الحسابات الجديدة بعملة واحدة (SAR)') + '</span></div>' +
'<button class="switch' + (E.defaultMultiCurrency() ? ' on' : '') + '" role="switch" aria-checked="' + (E.defaultMultiCurrency() ? 'true' : 'false') + '" aria-label="الحسابات الجديدة متعددة العملات" data-action="toggle-default-multi"></button></div>' +
'</div>';
html += '<div class="group-title" data-screen="sovereignty"><span class="gt-icon">' + drawnIcon(SETTINGS_ICONS.sovereignty) + '</span>' + esc(uiStr('secSovereignty', 'السيادة والبيانات')) + '</div>';
html += '<div class="card" style="padding:0">' +
(window.RohOwner ? '<div class="setting"><div class="s-main"><span class="s-title">دخول نسخة المالك</span>' +
'<span class="s-sub">طلب رمز الدخول والبصمة عند الفتح</span></div>' +
'<button class="switch' + (st.settings.ownerGate !== false ? ' on' : '') + '" role="switch" aria-checked="' + (st.settings.ownerGate !== false ? 'true' : 'false') + '" aria-label="دخول نسخة المالك" data-action="toggle-owner-gate"></button></div>' : '') +
'<div class="setting"><div class="s-main"><span class="s-title">قفل التطبيق</span>' +
'<span class="s-sub">يُفتح برمز الهاتف أو بصمة الإصبع أو بصمة الوجه</span></div>' +
'<button class="switch' + (st.settings.appLock ? ' on' : '') + '" role="switch" aria-checked="' + (st.settings.appLock ? 'true' : 'false') + '" aria-label="قفل التطبيق" data-action="toggle-app-lock"></button></div>' +
(st.settings.appLock ? '<div class="setting stacked"><div class="s-main"><span class="s-title">يُقفل بعد عدم الاستخدام</span></div>' +
'<div class="segmented" role="group" aria-label="مدة القفل">' +
[[0, 'عند الخروج'], [1, 'دقيقة'], [5, '5 دقائق'], [15, '15 دقيقة']].map(function (o) {
var current = st.settings.appLockMinutes == null ? 1 : st.settings.appLockMinutes;
return '<button type="button" data-action="set-lock-time" data-minutes="' + o[0] + '" aria-pressed="' + (current === o[0]) + '">' + o[1] + '</button>';
}).join('') + '</div></div>' : '') +
'<div class="setting"><div class="s-main"><span class="s-title">التحقق قبل الحذف والنسخ</span>' +
'<span class="s-sub">برمز الهاتف أو بصمة الإصبع أو بصمة الوجه</span></div>' +
'<button class="switch' + (st.settings.verifyActions ? ' on' : '') + '" role="switch" aria-checked="' + (st.settings.verifyActions ? 'true' : 'false') + '" aria-label="التحقق قبل الحذف والنسخ" data-action="toggle-verify"></button></div>' +
'<div class="setting"><div class="s-main"><span class="s-title">برنامج تحسين التجربة</span>' +
'<span class="s-sub">أعداد مجهولة عن استخدام المزايا، دون مبالغ أو أسماء أو نصوص. لا يُرسل شيء إلا حين تضغط إرسال.</span></div>' +
'<button class="switch' + (st.settings.uxProgram ? ' on' : '') + '" role="switch" aria-checked="' + (st.settings.uxProgram ? 'true' : 'false') + '" aria-label="برنامج تحسين التجربة" data-action="toggle-uxp"></button></div>' +
(st.settings.uxProgram ? settingRow('تقرير تحسين التجربة', 'اعرض ما جُمع بالضبط قبل إرساله', 'uxp-view', 'عرض') +
settingRow('إرسال التقرير', 'عبر واتساب أو البريد أو أي تطبيق تختاره', 'uxp-send', 'إرسال') : '') +
settingRow('تصدير نسخة احتياطية', 'JSON يحتوي كل القيود والحسابات', 'copy-export', 'تصدير') +
settingRow('أرشيف المحادثة', 'عرض الرسائل المؤرشفة (أقدم من 30 يوم)', 'open-chat-archive', 'أرشيف') +
settingRow('اقتران جهاز', 'مقارنة الدفتر مع جهاز آخر وقبول القيود المفقودة، دون إنترنت', 'open-pairing', 'اقتران') +
settingRow('استيراد نسخة', 'استبدال البيانات الحالية بنسخة محفوظة', 'open-import', 'استيراد') +
settingRow('استيراد مالي (CSV/OFX/QIF)', 'نقل قيود من Excel/Sheets/كشوف بنكية', 'open-import-csv', 'استيراد') +
settingRow('فحص سلامة الدفاتر', 'التحقق من توازن المدين والدائن', 'integrity', 'فحص') +
'<div class="setting"><div class="s-main"><span class="s-title">مطابقة آلية (Auto-match)</span><span class="s-sub">مطابقة قيود الطرف تلقائياً عند الاقتران</span></div><button class="switch' + ((S().settings.autoMatch) ? ' on' : '') + '" role="switch" aria-checked="' + ((S().settings.autoMatch) ? 'true' : 'false') + '" data-action="toggle-auto-match-setting"></button></div>' +
'<div class="setting stacked"><div class="s-main"><span class="s-title">جدولة التقارير (Scheduled Reports)</span><span class="s-sub">فتح تقرير تلقائياً عند فتح التطبيق</span></div><button class="btn ghost small" data-action="open-report-schedule">إعداد</button></div>' +
'</div>';
html += '<div class="group-title" data-screen="reminders"><span class="gt-icon">' + drawnIcon(SETTINGS_ICONS.reminders) + '</span>' + esc(uiStr('secReminders', 'التذكيرات (Notifications)')) + '</div>';
html += '<div class="card" style="padding:0">' +
'<div class="setting"><div class="s-main"><span class="s-title">تفعيل التذكيرات</span>' +
'<span class="s-sub">' + (window.RohReminders ? 'تذكير صباح يوم الاستحقاق واليوم الذي قبله' : 'التذكيرات المجدولة تعمل في تطبيق أندرويد فقط') + '</span></div>' +
'<button class="switch' + (remindersOn() ? ' on' : '') + '" role="switch" aria-checked="' + (remindersOn() ? 'true' : 'false') + '" aria-label="تفعيل التذكيرات" data-action="toggle-notifications"></button></div>' +
'<div class="setting"><div class="s-main"><span class="s-title">تفاصيل الإشعار</span>' +
'<span class="s-sub">' + ({ general: 'عام: «عندك استحقاق اليوم» بلا اسم ولا مبلغ', name: 'الاسم فقط: «تحصيل من خالد اليوم»', full: 'كامل: الاسم والمبلغ' })[E.notifyDetail()] + '. شاشة القفل تعرض العام دائماً.</span></div>' +
'<select id="notifyDetailSel" aria-label="تفاصيل الإشعار" style="font-size:calc(13px * var(--font-scale, 1))">' +
[['general', 'عام'], ['name', 'الاسم فقط'], ['full', 'كامل']].map(function (o) { return '<option value="' + o[0] + '"' + (E.notifyDetail() === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
'</select></div>' +
[['alerts', 'تنبيهات الميزانية والسحب', 'ميزانية تقارب سقفها أو تتجاوزه، وحساب بسحب على المكشوف'],
['recurring', 'القيود المتكررة', 'قيد متكرر حان موعده'],
['drafts', 'القيود المعلّقة', 'قيد لم تؤكده منذ يوم'],
['summary', 'الملخص الأسبوعي', 'ملخص أسبوعي يوم السبت'],
['system', 'النسخ الاحتياطي', 'تذكير بنسخة احتياطية مشفّرة بعد 30 يوماً']].map(function (c) {
var on = E.notificationCategoryOn(c[0]);
return '<div class="setting"><div class="s-main"><span class="s-title">' + esc(c[1]) + '</span><span class="s-sub">' + esc(c[2]) + '</span></div>' +
'<button class="switch' + (on ? ' on' : '') + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="' + esc(c[1]) + '" data-action="toggle-notify-category" data-cat="' + c[0] + '"></button></div>';
}).join('') +
'<div class="setting"><div class="s-main"><span class="s-title">اختبار تذكير</span>' +
'<span class="s-sub">إرسال إشعار تجريبي</span></div>' +
'<button class="btn ghost small" data-action="test-notification">إرسال</button></div>' +
'<div class="setting"><div class="s-main"><span class="s-title">مدة استحقاق الديون (أيام)</span>' +
'<span class="s-sub">الافتراضي 30 يوم. يُستخدم عند عدم تحديد تاريخ استحقاق.</span></div>' +
'<input type="number" min="1" max="365" value="' + esc(st.settings.defaultDueDays || 3) + '" data-action="set-due-days" style="width:70px;padding:6px 8px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size:calc(12px * var(--font-scale,1))" /></div>' +
'<div class="setting"><div class="s-main"><span class="s-title">وقت التذكير</span>' +
'<span class="s-sub">وقت إرسال تذكيرات الاستحقاق (HH:MM).</span></div>' +
'<input type="time" value="' + esc(st.settings.reminderTime || '09:00') + '" data-action="set-reminder-time" style="width:90px;padding:6px 8px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size:calc(12px * var(--font-scale,1))" /></div>' +
'<div class="setting"><div class="s-main"><span class="s-title">المحاسب يخبرني بكل شيء</span>' +
'<span class="s-sub">' + (S().settings.assistantLevel === 'quiet' ? 'الآن: المهم فقط (المتأخر والرصيد السالب)' : 'الموجز والمواعيد والميزانيات والقيود المتكررة') + '</span></div>' +
'<button class="switch' + (S().settings.assistantLevel === 'quiet' ? '' : ' on') + '" role="switch" aria-checked="' + (S().settings.assistantLevel === 'quiet' ? 'false' : 'true') + '" aria-label="المحاسب يخبرني بكل شيء" data-action="toggle-assistant-level"></button></div>' +
((S().settings.assistantMuted || []).length ? '<div class="setting"><div class="s-main"><span class="s-title">ما طلبت ألا يخبرك به</span>' +
'<span class="s-sub">' + esc((S().settings.assistantMuted || []).map(function (k) { return ASSISTANT_KIND_NAMES[k] || k; }).join('، ')) + '</span></div>' +
'<button class="btn ghost small" data-action="assistant-unmute">أعدها</button></div>' : '') +
'</div>';
html += '<div class="group-title" data-screen="display"><span class="gt-icon">' + drawnIcon(SETTINGS_ICONS.display) + '</span>' + esc(uiStr('secDisplay', 'العرض')) + '</div>';
html += '<div class="card" style="padding:0">' +
languageRowsHtml() +
'<div class="setting"><div class="s-main"><span class="s-title">إخفاء المبالغ</span>' +
'<span class="s-sub">يخفي كل الأرقام المالية على الشاشة</span></div>' +
'<button class="switch" role="switch" aria-checked="' + (hidden ? 'true' : 'false') + '" aria-label="إخفاء المبالغ" data-action="toggle-hide"></button></div>' +
'<div class="setting"><div class="s-main"><span class="s-title">وضع بسيط</span>' +
'<span class="s-sub">يخفي تفاصيل المدين/الدائن (للغير محاسبين)</span></div>' +
'<button class="switch" role="switch" aria-checked="' + (S().settings.simpleMode ? 'true' : 'false') + '" aria-label="وضع بسيط" data-action="toggle-simple"></button></div>' +
settingRow('الميزانيات الشهرية', 'تحديد سقف إنفاق شهري لكل بند مع شريط تقدم', 'open-budgets', 'إدارة') +
settingRow('القيود المتكررة', 'الإيجار والرواتب والاشتراكات الدورية', 'open-recurring', 'إدارة') +
'<div class="setting"><div class="s-main"><span class="s-title">العملة الأساسية</span>' +
'<span class="s-sub">' + (currencyLocked ? 'عملة دفاترك. لا يمكن تغييرها بعد تسجيل حركة' : 'عملة دفاترك، وتُفهم بها الجمل بلا عملة') + '</span></div>' +
'<select id="baseCurrency" aria-label="العملة الأساسية"' + (currencyLocked && E.mainCurrency() === E.BASE ? ' disabled' : '') + ' style="width:130px;padding:6px 8px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size: calc(12px * var(--font-scale, 1))' + (currencyLocked && E.mainCurrency() === E.BASE ? ';opacity:0.6' : '') + '">' +
E.listCurrencies().filter(function (cur) { return !currencyLocked || cur.code === E.mainCurrency() || cur.code === E.BASE; }).map(function (cur) { return '<option value="' + esc(cur.code) + '"' + (cur.code === E.mainCurrency() ? ' selected' : '') + '>' + esc(cur.code) + ' — ' + esc(cur.name) + '</option>'; }).join('') +
'</select></div>' +
'</div>';
html += '<div class="group-title" data-screen="access"><span class="gt-icon">' + drawnIcon(SETTINGS_ICONS.access) + '</span>' + esc(uiStr('secAccess', 'إمكانية الوصول')) + '</div>';
html += '<div class="card" style="padding:0">' +
'<div class="setting stacked"><div class="s-main"><span class="s-title">المظهر</span></div>' +
'<div class="theme-groups">' +
'<div class="theme-group"><span class="theme-group-label">فاتح</span><div class="segmented" role="group" aria-label="المظهر فاتح">' +
[['light', '<span class="theme-dot" style="background:#064e3b"></span>', '', 'فاتح (زمردي)'], ['ocean', '<span class="theme-dot" style="background:#1d6fa5"></span>', '', 'محيط (أزرق)'], ['burgundy', '<span class="theme-dot" style="background:#7f1d1d"></span>', '', 'عنابي (أحمر)'], ['purple', '<span class="theme-dot" style="background:#6d28d9"></span>', '', 'بنفسجي (بنفسجي)'], ['teal', '<span class="theme-dot" style="background:#0d9488"></span>', '', 'فيروزي (فيروزي)'], ['amber', '<span class="theme-dot" style="background:#d97706"></span>', '', 'كهرماني (كهرماني)'], ['system', UI_ICONS.device, '', 'تلقائي (النظام)']].map(function (t) {
return '<button type="button" data-action="set-theme" data-theme-choice="' + t[0] + '" aria-pressed="' + ((st.settings.theme || 'light') === t[0]) + '" aria-label="' + esc(t[3] || t[0]) + '" title="' + esc(t[3] || t[0]) + '">' + t[1] + t[2] + '</button>';
}).join('') +
'</div></div>' +
'<div class="theme-group"><span class="theme-group-label">داكن</span><div class="segmented" role="group" aria-label="المظهر داكن">' +
[['dark', '<span class="theme-dot" style="background:#0a1f18;border:1px solid #8fa89d" title="داكن (زمردي)" aria-label="داكن (زمردي)"></span>', ''], ['ocean-dark', '<span class="theme-dot" style="background:#0284c7;border:1px solid #88a8c4" title="محيط داكن (أزرق)" aria-label="محيط داكن (أزرق)"></span>', ''], ['burgundy-dark', '<span class="theme-dot" style="background:#9f1239;border:1px solid #c49ba3" title="عنابي داكن (أحمر)" aria-label="عنابي داكن (أحمر)"></span>', ''], ['purple-dark', '<span class="theme-dot" style="background:#6d28d9;border:1px solid #a898c9" title="بنفسجي داكن (بنفسجي)" aria-label="بنفسجي داكن (بنفسجي)"></span>', ''], ['royal-gold-dark', '<span class="theme-dot" style="background:linear-gradient(135deg,#0c0902,#d4af37);border:1px solid #ffd700" title="الذهب الملكي (Pro CFO 👑)" aria-label="الذهب الملكي (Pro CFO)"></span>', ((E.cfoRank ? E.cfoRank().rank : 1) >= 3 ? '👑' : '🔒')], ['cyberpunk-dark', '<span class="theme-dot" style="background:linear-gradient(135deg,#110b29,#00f5d4);border:1px solid #ff2a85" title="سايبربانك (Pro CFO ⚡)" aria-label="سايبربانك (Pro CFO)"></span>', ((E.cfoRank ? E.cfoRank().rank : 1) >= 3 ? '⚡' : '🔒')]].map(function (t) {
return '<button type="button" data-action="set-theme" data-theme-choice="' + t[0] + '" aria-pressed="' + ((st.settings.theme || 'light') === t[0]) + '">' + t[1] + t[2] + '</button>';
}).join('') +
'</div></div>' +
'</div></div>' +
'<div class="setting stacked"><div class="s-main"><span class="s-title">حجم الخط</span></div>' +
'<div class="segmented" role="group" aria-label="حجم الخط">' +
['طبيعي', 'كبير', 'أكبر'].map(function (label, step) {
return '<button type="button" data-action="set-font" data-step="' + step + '" aria-pressed="' + ((st.settings.fontStep || 0) === step) + '">' + label + '</button>';
}).join('') +
'</div></div>' +
'<div class="setting"><div class="s-main"><span class="s-title">القراءة التلقائية</span>' +
'<span class="s-sub">يقرأ ردود البوت بصوت عالٍ فور وصولها</span></div>' +
'<button class="switch' + (st.settings.autoTts ? ' on' : '') + '" role="switch" aria-checked="' + (st.settings.autoTts ? 'true' : 'false') + '" aria-label="القراءة التلقائية" data-action="toggle-auto-tts"></button></div>' +
'</div>';
html += '<div class="group-title" data-screen="zakat"><span class="gt-icon">' + drawnIcon(SETTINGS_ICONS.zakat) + '</span>' + esc(uiStr('secZakat', 'الزكاة (النقود والمدخرات)')) + '</div>';
var zcfg = zakatConfig();
html += '<div class="card" style="padding:0">' +
'<div class="setting stacked"><div class="s-main"><span class="s-title">نصاب الزكاة (بالعملة الأساسية)</span>' +
'<span class="s-sub">الحد الأدنى (≈ 85 غرام ذهب). 0 = استخدام الافتراضي (21,250)</span></div>' +
'<input type="number" step="0.01" min="0" value="' + esc((zcfg.nisabMinor || 2125000) / 100) + '" onchange="window.__setZakatNisab(this.value)" style="width:130px;padding:6px 8px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size: calc(12px * var(--font-scale, 1))" /></div>' +
'<div class="setting stacked"><div class="s-main"><span class="s-title">نسبة الزكاة (%)</span>' +
'<span class="s-sub">الافتراضي 2.5%. عدّلها حسب المذهب/البلد</span></div>' +
'<input type="number" step="0.01" min="0" max="100" value="' + esc(zcfg.rate) + '" onchange="window.__setZakatRate(this.value)" style="width:130px;padding:6px 8px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size: calc(12px * var(--font-scale, 1))" /></div>' +
'</div>';
if (st.settings.dictionaryOption) {
html += '<div class="group-title"><span class="gt-icon">' + drawnIcon(SETTINGS_ICONS.guide) + '</span>القاموس الدلالي (1500+ كلمة)</div>';
html += '<div class="card" style="padding:0">' +
'<div class="setting"><div class="s-main"><span class="s-title">تدريب المفردات</span>' +
'<span class="s-sub">زرع ' + (E.getVocabCount ? E.getVocabCount() : 0) + ' كلمة مخزنة</span></div>' +
'<button class="btn ghost small" data-action="train-vocab">تدريب</button></div>' +
'</div>';
html += '<div class="group-title"><span class="gt-icon">' + drawnIcon(SETTINGS_ICONS.search) + '</span>القاموس (عرض/بحث/فلترة)</div>';
html += '<div class="card" style="padding:0">' +
'<div class="setting"><div class="s-main"><span class="s-title">فتح القاموس</span>' +
'<span class="s-sub">' + (E.getVocabCount ? E.getVocabCount() : 0) + ' كلمة مخزنة</span></div>' +
'<button class="btn ghost small" data-action="open-vocab">فتح</button></div>' +
'</div>';
}
html += '<div class="group-title" data-screen="ai"><span class="gt-icon">' + drawnIcon(SETTINGS_ICONS.ai) + '</span>' + esc(uiStr('secAi', 'الذكاء الاصطناعي')) + '</div>';
var _aiLang = currentLanguage().code;
var _aiDir = (_aiLang === 'ar') ? 'rtl' : 'ltr';
var _aiPlaceholder = (UI_I18N[_aiLang] && UI_I18N[_aiLang].inputPlaceholder) ? UI_I18N[_aiLang].inputPlaceholder : 'Type an entry…';
var aiClient = window.RohAI;
var aiInfo = aiClient ? aiClient.status() : null;
var aiSub = aiInfo
? (aiInfo.providerName || aiInfo.provider) + (aiInfo.model ? ' • ' + aiInfo.model : '') + ' • ' + (aiInfo.endpoints[0] || '')
: 'غير محمّل';
var aiEnabled = !!(S().settings && S().settings.aiEnabled);
html += '<div class="card" style="padding:0">' +
'<div class="setting"><div class="s-main"><span class="s-title">تفعيل الذكاء الاصطناعي</span>' +
'<span class="s-sub">' + (aiEnabled ? 'مفعّل' : 'معطّل') + '</span></div>' +
'<button class="switch' + (aiEnabled ? ' on' : '') + '" role="switch" aria-checked="' + (aiEnabled ? 'true' : 'false') + '" data-action="toggle-ai"></button></div>' +
settingRow('الذكاء الاصطناعي', (aiInfo ? (aiInfo.providerName + ' • ' + (aiInfo.endpoints[0] || '')) : 'غير محمّل'), 'ai-test', 'فحص') +
'<div class="setting"><div class="s-main"><span class="s-title">المخدم</span>' +
'<span class="s-sub" dir="ltr" style="text-align:right">' + esc(aiSub) + '</span></div>' +
'<button class="btn ghost small" data-action="ai-config">تعديل</button></div>' +
'<div class="setting"><div class="s-main"><span class="s-title">التعلم التلقائي (Auto-learn)</span>' +
'<span class="s-sub">يتعلم البوت من القيود المؤكدة ويضيف الجملة المُطبّعة إلى القاموس (معطّل افتراضياً)</span></div>' +
'<button class="switch' + (S().settings.autoLearn ? ' on' : '') + '" role="switch" aria-checked="' + (S().settings.autoLearn ? 'true' : 'false') + '" aria-label="التعلم التلقائي" data-action="toggle-auto-learn"></button></div>' +
settingRow('الحزمة الصوتية العربية بدون إنترنت', 'تنزيل حزمة الإملاء الصوتي المحلي أو استيراد حزمة Whisper-Tiny / Sherpa-ONNX للهواتف التي تفتقر لخدمات جوجل', 'open-voice-pack', 'إدارة وتنزيل') +
settingRow('إرسال ملاحظات', 'إرسال نص (مع اللغة واللهجة) للمطور لتحسين التطبيق (بموافقة)', 'send-feedback', 'إرسال') +
'</div>';
var vmEnabled = (E.vectorMemoryEnabled ? E.vectorMemoryEnabled() : true);
var vmAuto = (E.vectorAutoConfirm ? E.vectorAutoConfirm() : false);
var vmGov = (E.aiGovernorStatus ? E.aiGovernorStatus() : {});
var vmCount = (E.vectorCount ? E.vectorCount() : 0);
var vmMode = (vmGov && vmGov.mode) ? vmGov.mode : 'balanced';
var vmTier = (vmGov && vmGov.tier) ? vmGov.tier : 'balanced';
var vmBattery = (vmGov && vmGov.batteryLevel != null) ? Math.round((vmGov.batteryLevel || 0) * 100) + '%' : '';
var vmCharging = (vmGov && vmGov.charging) ? ' ⚡' : '';
html += '<div class="group-title" data-screen="vectormemory"><span class="gt-icon">' + drawnIcon(SETTINGS_ICONS.search) + '</span>' + esc(uiStr('secVector', 'الذاكرة المعرفية (Vector Memory & RAG)')) + '</div>';
html += '<div class="card" style="padding:0">' +
'<div class="setting"><div class="s-main"><span class="s-title">تفعيل الذاكرة المعرفية</span>' +
'<span class="s-sub">' + (vmEnabled ? 'مفعّلة — بحث دلالي عند الغموض' : 'معطّلة') + '</span></div>' +
'<button class="switch' + (vmEnabled ? ' on' : '') + '" role="switch" aria-checked="' + (vmEnabled ? 'true' : 'false') + '" data-action="toggle-vector-memory"></button></div>' +
'<div class="setting"><div class="s-main"><span class="s-title">إحصاءات الحاكم الذكي</span>' +
'<span class="s-sub">الوضع: ' + esc(vmMode) + ' • المستوى: ' + esc(vmTier) + ' • المتجهات: ' + vmCount + ' • البطارية: ' + esc(vmBattery) + vmCharging + '</span></div></div>' +
'<div class="setting"><div class="s-main"><span class="s-title">الاعتماد التلقائي (ثقة ≥ 92%)</span>' +
'<span class="s-sub">' + (vmAuto ? 'مفعّل — قيود موثوقة تُعتمد تلقائياً' : 'معطّل') + '</span></div>' +
'<button class="switch' + (vmAuto ? ' on' : '') + '" role="switch" aria-checked="' + (vmAuto ? 'true' : 'false') + '" data-action="toggle-vector-autoconfirm"></button></div>' +
settingRow('عرض التفاصيل الدلالية', 'Top-5 نتائج مع شريط النتيجة + النية المكتشفة', 'vector-details', 'عرض') +
settingRow('تصحيح التصانيف (تدريب القاموس)', 'اختر قيداً، غيّر حسابه، يتعلم النظام', 'vector-correct', 'تصحيح') +
settingRow('بناء الذخيرة السياقية الآن', 'يبني أمثلة حية من الرسم البياني (أطراف، بنوك، حسابات)', 'vector-build-repertoire', 'بناء') +
'<div class="setting stacked"><div class="s-main"><span class="s-title">ضبط الاعتماد التلقائي (Auto-Confirm Tuning)</span><span class="s-sub">عتبة الثقة (92 افتراضي) وعدد الاستخدامات (3 افتراضي)</span></div><button class="btn ghost small" data-action="open-autoconfirm-tuning">تعديل</button></div>' +
'<div class="setting"><div class="s-main"><span class="s-title">تجاوز وضع التوفير (Bypass Governor)</span><span class="s-sub">تعطيل ultra-eco عند انخفاض البطارية (للتجربة فقط)</span></div><button class="switch' + ((S().settings.bypassGovernor) ? ' on' : '') + '" role="switch" aria-checked="' + ((S().settings.bypassGovernor) ? 'true' : 'false') + '" data-action="toggle-bypass-governor"></button></div>' +
'</div>';
if (st.settings.dictionaryOption) {
html += '<div class="group-title" data-screen="dictionary"><span class="gt-icon">' + drawnIcon(SETTINGS_ICONS.dictionary) + '</span>القاموس (Offline-first)</div>';
html += '<div class="card" style="padding:0">' +
settingRow('فحص سلامة القاموس', 'PRAGMA integrity_check + مراجع account_id', 'dict-integrity', 'فحص') +
settingRow('إعادة تعيين القاموس', 'حذف المفردات المشحونة/المتعلّمة، الإبقاء على taught/trained', 'dict-reset', 'إعادة') +
'</div>';
}
html += '<div class="group-title" data-screen="marketing"><span class="gt-icon">' + drawnIcon(SETTINGS_ICONS.export || SETTINGS_ICONS.system) + '</span>' + esc(uiStr('secMarketing', 'التسويق والانتشار (Marketing Hub)')) + '</div>';
html += '<div class="card" style="padding:0">' +
settingRow('التقرير الشهري التسويقي', 'ملخص إنجازات الشهر مقارنةً بالشهر الماضي جاهز للمشاركة', 'marketing-monthly', 'عرض ومشاركة') +
settingRow('رسالة دعوة صديق (خصم 15%)', 'رسالة واتساب جاهزة مع رمز جهازك وكود الدعوة', 'marketing-referral', 'عرض ومشاركة') +
settingRow('منشور وسائل التواصل', 'نص جاهز للنشر في حالة واتساب أو تيليجرام', 'marketing-social', 'عرض ومشاركة') +
settingRow('شهادة تجربة التطبيق', 'شهادة استخدام مجهولة الهوية مبنية على إحصاءات دفترك', 'marketing-testimonial', 'عرض ومشاركة') +
settingRow('بطاقة نقطة تفعيل معتمدة (QR)', 'بطاقة مكتبية جاهزة للطباعة لمكاتب المحاسبة والوكلاء', 'marketing-dealer-card', 'عرض وطباعة') +
'</div>';
var frAlerts = (E.computeAnalysis().fraudAlerts) || [];
if (frAlerts.length) {
html += '<div class="group-title" data-screen="fraud"><span class="gt-icon">' + drawnIcon(SETTINGS_ICONS.fraud) + '</span>تنبيهات احتيال (' + frAlerts.length + ')</div>';
html += '<div class="card" style="padding:0">';
html += '<div class="setting"><div class="s-main"><span class="s-sub">يساعدك موني كود على الحماية من الاحتيال قبل وقوعه.</span></div></div>';
frAlerts.slice(0, 10).forEach(function (f) {
html += '<div class="setting"><div class="s-main"><span class="s-title">' + esc(f.risk === 'high' ? '⚠ مرتفع' : '⚡ متوسط') + '</span>' +
'<span class="s-sub">' + esc((f.reasons || []).join('، ')) + '</span></div></div>';
});
html += '</div>';
}
html += '<div class="group-title" data-screen="system"><span class="gt-icon">' + drawnIcon(SETTINGS_ICONS.system) + '</span>' + esc(uiStr('secSystem', 'النظام')) + '</div>';
var engVer = (E && E.VERSION) ? E.VERSION : '1.2.3';
var schemaVer = (E && E.SCHEMA_VERSION) ? E.SCHEMA_VERSION : 3;
html += '<div class="card" style="padding:0">' +
'<div class="setting"><div class="s-main"><span class="s-title" data-action="app-version" style="cursor:pointer">تطبيق موني كود v1.2.3</span>' +
'<span class="s-sub">إصدار التطبيق v1.2.3 • المحرك v' + esc(engVer) + ' (مخطط v' + schemaVer + ') • يعمل دون إنترنت</span></div>' +
'<span class="badge ok">محلي</span></div>' +
settingRow('سياسة الخصوصية', 'ما يحفظه التطبيق، وأين، ومتى يخرج من هاتفك', 'open-privacy', 'عرض') +
settingRow('شروط الاستخدام', 'الترخيص وحقوق الملكية وحدود المسؤولية', 'open-terms', 'عرض') +
'<div class="setting"><div class="s-main"><span class="s-title">مسح كل البيانات</span>' +
'<span class="s-sub">حذف نهائي للقيود والحسابات والرسائل</span></div>' +
'<button class="btn danger small" data-action="reset">مسح</button></div>' +
'</div>';
html += '<div class="modal-note" style="text-align:center;margin-top:16px">' +
'القيود تُحفظ محلياً في قاعدة متصفح الجهاز (SQLite + IndexedDB). لا تُرسل بياناتك إلى الإنترنت. الأسئلة التحليلية تُرسل فقط إلى مخدم الذكاء الاصطناعي على جهازك/شبكتك المحلية حسب العنوان المضبوط.<br>' +
'المبالغ تُخزّن بوحدات صغرى (هللة) بالعملة الأساسية (' + esc(E.BASE) + ')، وتُعرض ' + esc(inMainCurrency()) + '.</div>' +
'<div class="copyright-note">© حقوق النشر والتوزيع لطه الدقيل.</div>';
els.settings.innerHTML = html;
setTimeout(function () { var bs = document.getElementById('settingsBody'); if (bs) { bs.querySelectorAll('.group-title, .card').forEach(function (n) { n.style.display = ''; }); } syncSettingsGroupsAndChips(); }, 0);
var toolbar = document.createElement('div');
toolbar.className = 'settings-toolbar';
toolbar.innerHTML = '<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px"><div class="settings-search-box" style="flex:1;margin-bottom:0"><input id="settingsSearchInput" type="search" placeholder="' + esc(uiStr('settingsSearchPlaceholder', 'ابحث في الإعدادات (عملة، قفل، تذكير، زكاة، نسخ…)')) + '" aria-label="بحث في الإعدادات" autocomplete="off" /></div><button type="button" class="row-menu-btn" data-action="settings-options" aria-label="خيارات الإعدادات" aria-haspopup="menu" aria-expanded="false" style="flex:0 0 auto;width:38px;height:38px;border-radius:10px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size:calc(17px * var(--font-scale, 1));line-height:1">⋮</button></div>';
var chipBar = document.createElement('div');
chipBar.className = 'settings-chips';
chipBar.setAttribute('role', 'navigation');
chipBar.setAttribute('aria-label', 'أقسام الإعدادات');
var groups = els.settings.querySelectorAll('.group-title');
var allChip = document.createElement('button');
allChip.type = 'button';
allChip.className = 'chip active';
allChip.setAttribute('data-chip-key', '__all__');
allChip.innerHTML = '<span>الكل (' + groups.length + ')</span>';
allChip.addEventListener('click', function () {
var openKeys = Object.keys(settingsOpen).filter(function (k) { return !!settingsOpen[k]; });
if (openKeys.length === groups.length) {
settingsOpen = {};
} else {
groups.forEach(function (g, i) { settingsOpen[settingsGroupKey(g, i)] = true; });
}
syncSettingsGroupsAndChips();
});
chipBar.appendChild(allChip);
groups.forEach(function (g, idx) {
var key = settingsGroupKey(g, idx);
g.setAttribute('data-settings-key', key);
g.title = 'نقرة لفتح/طي القسم • نقرتان لفتح/طي الكل';
var chip = document.createElement('button');
chip.type = 'button';
chip.className = 'chip';
chip.setAttribute('data-chip-key', key);
var iconSpan = g.querySelector('.gt-icon');
var rawTitle = (g.textContent || '')
.replace('＋ إضافة عملة', '')
.replace(/\s*\([^)]*\)\s*/g, ' ')
.trim()
.replace(/^[^\w\u0600-\u06FF]+/, '')
.trim();
chip.innerHTML = (iconSpan ? iconSpan.innerHTML : '') + '<span>' + esc(rawTitle) + '</span>';
chip.addEventListener('click', function () {
var openCount = Object.keys(settingsOpen).filter(function (k) { return !!settingsOpen[k]; }).length;
if (settingsOpen[key] && openCount === 1) {
groups.forEach(function (gr, i) { settingsOpen[settingsGroupKey(gr, i)] = true; });
syncSettingsGroupsAndChips();
} else {
settingsOpen = {};
settingsOpen[key] = true;
syncSettingsGroupsAndChips(key);
g.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
});
chipBar.appendChild(chip);
});
toolbar.appendChild(chipBar);
var heroEl = els.settings.querySelector('.settings-quick-grid') || els.settings.querySelector('.settings-hero');
if (heroEl && heroEl.nextSibling) {
els.settings.insertBefore(toolbar, heroEl.nextSibling);
} else {
els.settings.insertBefore(toolbar, els.settings.firstChild);
}
syncSettingsGroupsAndChips();
var searchField = document.getElementById('settingsSearchInput');
if (searchField) {
searchField.addEventListener('input', function () {
var q = String(searchField.value || '').trim().toLowerCase();
groups.forEach(function (g, idx) {
var card = g.nextElementSibling;
if (!card || !card.classList.contains('card')) return;
var rows = card.querySelectorAll('.setting');
var anyMatch = false;
rows.forEach(function (r) {
var match = !q || (r.textContent || '').toLowerCase().indexOf(q) >= 0 || (g.textContent || '').toLowerCase().indexOf(q) >= 0;
r.style.display = match ? '' : 'none';
if (match) anyMatch = true;
});
if (q) {
g.style.display = anyMatch ? '' : 'none';
card.style.display = anyMatch ? '' : 'none';
if (anyMatch) g.classList.remove('collapsed');
} else {
g.style.display = '';
card.style.display = '';
}
});
if (!q) syncSettingsGroupsAndChips();
});
}
}
function planUsageText(info) {
if (info.clockRolledBack) return 'تاريخ الجهاز غير مضبوط. يرجى ضبط تاريخ الهاتف لتفعيل الرخصة.';
if (info.expired) return 'انتهى اشتراكك. بياناتك كلها محفوظة ومتاحة.';
if (info.inGrace) return 'انتهى اشتراكك مؤخراً. جدّده للاحتفاظ بالميزات.';
if (info.monthlyLimit === null) return 'قيود بلا حد';
return info.entriesThisMonth + ' من ' + info.monthlyLimit + ' قيد هذا الشهر';
}
function allowStatementsOrPrompt(reason) {
if (E.planAllows('statements')) return true;
var left = E.featureTrialLeft ? E.featureTrialLeft('statements') : 0;
if (left && left > 0) {
var tr = E.useFeatureTrial('statements');
if (tr && tr.ok) {
toast('تجربة مجانية لميزة التقارير (متبقي لك ' + tr.remaining + ' تجارب مجانية)');
return true;
}
}
openActivation(reason || 'طباعة وإرسال التقارير متاحة في باقة الأعمال. يمكنك عرضها على الشاشة وتصدير نسخك الاحتياطية في أي وقت.');
return false;
}
function openPlans(reason) {
openActivation(reason);
}
var APP_STORES = [
{ name: 'Google Play', url: 'https://play.google.com/store/apps/details?id=com.moneycode.sovereign', icon: '<path d="M12 7L38 24L12 41Z"/><path d="M12 7L28 31M12 41L28 17"/>' },
{ name: 'App Store', url: '', icon: '<path d="M24 15C20 11 9 12 9 25C9 34 15 42 19 42C21 42 22 41 24 41C26 41 27 42 29 42C33 42 37 36 39 31C33 28 33 19 38 17C35 13 28 12 24 15Z"/><path d="M24 15C24 10 27 6 32 5"/>' },
{ name: 'AppGallery', url: '', icon: '<path d="M9 17H39L36 42H12Z"/><path d="M17 23V13A7 7 0 0 1 31 13V23"/>' },
{ name: 'Galaxy Store', url: '', icon: '<rect x="8" y="14" width="32" height="28" rx="7"/><path d="M17 20V13A7 7 0 0 1 31 13V20"/><path d="M18 31H30"/>' }
];
function storeButtonsHtml() {
return '<h2 class="store-title">يمكنك الحصول على النسخة الكاملة من المتجر</h2><div class="store-list">' +
APP_STORES.map(function (store, i) {
return '<button type="button" class="store-btn" data-action="open-store" data-id="' + i + '">' +
'<svg class="ui-icon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' + store.icon + '</svg>' +
'<span dir="ltr">' + esc(store.name) + '</span></button>';
}).join('') + '</div>';
}
function openAppStore(index) {
var store = APP_STORES[index];
if (index === 0 && window.RohBilling && typeof window.RohBilling.purchase === 'function') {
var sku = (window.__selectedTier === 'lifetime') ? 'moneycode_lifetime' : 'moneycode_annual';
window.RohBilling.purchase(sku);
return;
}
if (!store || !store.url) { toast('سيتوفر قريباً في ' + (store ? store.name : 'المتجر')); return; }
if (window.RohPrint && window.RohPrint.openLink) window.RohPrint.openLink(store.url);
}
window.__rohBillingDone = function (payload) {
try {
var data = typeof payload === 'string' ? JSON.parse(payload) : payload;
if (data && data.ok && data.planId && data.planId !== 'free') {
E.setPlan(data.planId, data.expiresAt || null);
renderAll();
toast('✓ تمت مزامنة واستعادة اشتراك المتجر بنجاح');
} else if (data && data.status === 'store_opened') {
toast('جاري فتح المتجر لإتمام الاشتراك…');
} else if (data && data.error) {
toast(data.error, true);
}
} catch (e) {}
};
window.__selectedTier = 'annual';
window.__selectedPromo = '';
window.__lastActivationReason = '';
function openOwnerLogin() {
openSheet('دخول المستخدم', '<div class="account-form">' +
'<div class="form-row"><label>اسم المستخدم</label><input id="liUser" type="text" dir="ltr" maxlength="20" /></div>' +
'<div class="form-row"><label>PIN</label><input id="liPin" type="password" dir="ltr" maxlength="20" /></div>' +
'<div class="modal-actions"><button class="btn primary" id="liGo">دخول</button></div>' +
'<p id="liMsg" class="modal-note"></p></div>');
var go = document.getElementById('liGo');
if (go) go.addEventListener('click', function () {
var r = E.login(document.getElementById('liUser').value, document.getElementById('liPin').value);
if (!r.ok) { document.getElementById('liMsg').textContent = r.error; return; }
closeSheet();
toast('مرحباً ' + r.user.name);
renderAll();
startOwnerAutoLogout();
});
}
function startOwnerAutoLogout() {
if (window.__ownerLogoutTimer) clearInterval(window.__ownerLogoutTimer);
var last = Date.now();
var tick = function () {
if (Date.now() - last >= 10 * 60 * 1000) {
E.logout();
toast('انتهت الجلسة (10 دقائق)', true);
openOwnerLogin();
clearInterval(window.__ownerLogoutTimer);
window.__ownerLogoutTimer = null;
}
};
window.__ownerLogoutTimer = setInterval(tick, 30000);
['click','keydown','touchstart'].forEach(function (ev) { document.addEventListener(ev, function () { last = Date.now(); }, { passive: true }); });
}
function openUsers() {
if (!window.RohOwner) { toast('غير متاح في هذه النسخة', true); return; }
var users = E.listUsers();
var rows = users.map(function (u) {
return '<div class="trainer-row"><span><bdi>' + esc(u.name) + '</bdi> <span class="muted">(' + esc(u.username) + ')</span><br>' +
'<span class="muted">' + esc(u.role) + (u.active ? '' : ' — معطّل') + '</span></span>' +
(u.active ? '<button class="btn ghost small" data-deactivate-user="' + esc(u.id) + '">تعطيل</button>' : '') + '</div>';
}).join('') || '<p class="muted" style="text-align:center;padding:8px">لا مستخدمون. أضف الأول.</p>';
var roleOpts = E.rolesList().map(function (r) { return '<option value="' + esc(r.name) + '">' + esc(r.label || r.name) + '</option>'; }).join('');
openSheet('المستخدمون',
'<div class="account-form">' +
'<div id="usersList">' + rows + '</div>' +
'<div class="search-group-title" style="margin-top:10px">إضافة مستخدم</div>' +
'<div class="form-row"><label>الاسم</label><input id="nuName" type="text" maxlength="40" /></div>' +
'<div class="form-row"><label>اسم المستخدم</label><input id="nuUser" type="text" dir="ltr" maxlength="20" /></div>' +
'<div class="form-row"><label>PIN</label><input id="nuPin" type="password" dir="ltr" maxlength="20" /></div>' +
'<div class="form-row"><label>الدور</label><select id="nuRole">' + roleOpts + '</select></div>' +
'<div class="modal-actions"><button class="btn primary" id="nuAdd">إضافة</button></div>' +
'</div>');
var addBtn = document.getElementById('nuAdd');
if (addBtn) addBtn.addEventListener('click', function () {
var r = E.createUser({ name: document.getElementById('nuName').value, username: document.getElementById('nuUser').value, pin: document.getElementById('nuPin').value, role: document.getElementById('nuRole').value });
if (!r.ok) { toast(r.error, true); return; }
toast('أُضيف المستخدم');
openUsers();
});
document.querySelectorAll('[data-deactivate-user]').forEach(function (b) {
b.addEventListener('click', function () {
askConfirm('تعطيل مستخدم', 'تعطيل هذا المستخدم؟', function () {
E.deactivateUser(b.getAttribute('data-deactivate-user'));
toast('عُطّل المستخدم');
openUsers();
});
});
});
}
function openAuditLog() {
if (!window.RohOwner) { toast('غير متاح في هذه النسخة', true); return; }
var rows = E.auditReport({ limit: 200 });
var html = '<div class="account-form"><div class="modal-note">آخر ' + rows.length + ' إدخال</div>' +
'<table style="width:100%;font-size:calc(11px * var(--font-scale,1))"><thead><tr><th>الوقت</th><th>المستخدم</th><th>الإجراء</th><th>النوع</th><th>المعرّف</th></tr></thead><tbody>';
rows.forEach(function (r) {
html += '<tr><td>' + esc(String(r.at).slice(0,16)) + '</td><td>' + esc(r.userId || '—') + '</td><td>' + esc(r.action) + '</td><td>' + esc(r.entityType) + '</td><td>' + esc(r.entityId || '—') + '</td></tr>';
});
html += '</tbody></table></div>';
openSheet('سجل الرقابة', html);
}
function openEventLog() {
if (!window.RohOwner) { toast('غير متاح في هذه النسخة', true); return; }
var rows = E.eventReport({ limit: 200 });
var html = '<div class="account-form"><div class="modal-note">آخر ' + rows.length + ' حدث</div>' +
'<table style="width:100%;font-size:calc(11px * var(--font-scale,1))"><thead><tr><th>الوقت</th><th>المستخدم</th><th>النوع</th><th>التفاصيل</th></tr></thead><tbody>';
rows.forEach(function (r) {
html += '<tr><td>' + esc(String(r.at).slice(0,16)) + '</td><td>' + esc(r.userId || '—') + '</td><td>' + esc(r.kind) + '</td><td>' + esc(r.detail || '—') + '</td></tr>';
});
html += '</tbody></table></div>';
openSheet('سجل الأحداث', html);
}
var actQrScan = { stream: null, timer: null, canvas: null };
function stopActivationQrScan() {
if (!actQrScan) return;
if (actQrScan.timer) { clearTimeout(actQrScan.timer); actQrScan.timer = null; }
if (actQrScan.stream) {
actQrScan.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
actQrScan.stream = null;
}
var box = document.getElementById('actQrScanBox');
if (box) { box.innerHTML = ''; box.hidden = true; }
}
function startActivationQrScan() {
stopActivationQrScan();
var box = document.getElementById('actQrScanBox');
if (!box) return;
if (typeof window.jsQR !== 'function' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
toast('الكاميرا غير متاحة — استخدم زر «لصق من الحافظة»', true);
return;
}
box.hidden = false;
box.innerHTML = '<div style="text-align:center;margin:8px 0">' +
'<video id="actQrVideo" playsinline muted style="width:100%;max-width:260px;border-radius:12px;background:#000"></video>' +
'<div style="margin-top:6px"><button type="button" class="btn ghost small" data-action="stop-act-qr">إيقاف الكاميرا</button></div>' +
'</div>';
var video = document.getElementById('actQrVideo');
navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (stream) {
if (!document.getElementById('actQrVideo')) {
stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
return;
}
actQrScan.stream = stream;
video.srcObject = stream;
video.play().catch(function () {});
var tick = function () {
if (!actQrScan.stream) return;
if (video.readyState >= 2 && video.videoWidth > 0) {
var c = actQrScan.canvas || (actQrScan.canvas = document.createElement('canvas'));
c.width = video.videoWidth;
c.height = video.videoHeight;
var ctx = c.getContext('2d', { willReadFrequently: true });
ctx.drawImage(video, 0, 0, c.width, c.height);
var img = ctx.getImageData(0, 0, c.width, c.height);
var hit = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
if (hit && hit.data) {
stopActivationQrScan();
var field = document.getElementById('activationCode');
if (field) {
field.value = hit.data.trim();
showActivationStatus(true);
}
return;
}
}
actQrScan.timer = setTimeout(tick, 200);
};
actQrScan.timer = setTimeout(tick, 250);
}).catch(function () {
stopActivationQrScan();
toast('تعذر فتح الكاميرا — تأكد من منح الإذن أو الصق الرمز', true);
});
}
function coffeeOrShawarmaLabel() {
try {
var entries = (S() && S().entries) || [];
var hasCoffee = entries.some(function (e) {
return e && /قهوة|قهوه|كافيه|كوفي|اسبريسو|لاتيه|كابتشينو|coffee/i.test((e.memo || '') + ' ' + (e.counterparty || ''));
});
return hasCoffee ? 'أقل من سعر كوب قهوة' : 'أقل من سعر شاورما';
} catch (e) {
return 'أقل من سعر كوب قهوة';
}
}
function openActivation(reason) {
stopActivationQrScan();
if (reason !== undefined) window.__lastActivationReason = reason || '';
var info = E.getPlanInfo();
var tier = window.__selectedTier || 'annual';
var offer = E.getPricingOffer ? E.getPricingOffer({
locale: speechLocale(),
promoCode: window.__selectedPromo || ''
}) : { baseAnnual: 99, finalAnnual: 99, baseLifetime: 349, finalLifetime: 349, discountPct: 0, offerLabel: null };
var foreign = E.foreignLicenseInBooks ? E.foreignLicenseInBooks() : { found: false };
var pctUsed = Math.min(100, Math.round((info.entriesThisMonth / E.FREE_MONTHLY_ENTRIES) * 100));
var fillCls = pctUsed >= 100 ? ' full' : (pctUsed >= 80 ? ' warn' : '');
var html = '<div class="activation-sheet">';
if (window.__lastActivationReason) {
html += '<p class="modal-note plan-reason">' + esc(window.__lastActivationReason) + '</p>';
}
if (info.clockRolledBack) {
html += '<p class="modal-note" style="border-color:var(--danger);color:var(--danger);font-weight:700">⚠ تاريخ الجهاز غير متطابق مع تسلسل دفاترك. يرجى ضبط تاريخ الهاتف لتفعيل رخصتك.</p>';
}
if (foreign && foreign.found) {
html += '<div class="offer-banner" style="margin-bottom:10px">' +
'<div>تم اكتشاف رخصة سابقة في دفاترك المستعادة (' + esc(foreign.codeHint) + '). هل استبدلت هاتفك؟</div>' +
'<button type="button" class="btn primary small" style="margin-top:6px;width:100%" data-action="request-recovery">اطلب نقل رخصتك لهذا الجهاز</button>' +
'</div>';
}
if (info.activated) {
html += '<div class="usage-progress-wrap">' +
'<div class="usage-progress-head"><span>' + esc(info.expiresAt ? 'باقة الأعمال السنوية (مفعّلة)' : 'رخصة مدى الحياة (مفعّلة)') + '</span>' +
'<span class="badge ok">' + esc(info.expiresAt ? ('حتى ' + E.fmtDate(info.expiresAt)) : 'دائمة') + '</span></div>' +
'<div class="tier-desc">جميع القيود والعملات وتقارير PDF وإقران الأجهزة مفتوحة بلا حدود.</div>' +
'<div class="license-self-actions">' +
'<button type="button" class="btn ghost small" data-action="record-sub-expense">🧾 سجّل الاشتراك كمصروف</button>' +
'<button type="button" class="btn ghost small" data-action="open-transfer-license">📱 نقل لهاتف جديد</button>' +
'<button type="button" class="btn ghost small" data-action="open-refund-license">↩ استرجاع (ضمان 7 أيام)</button>' +
'</div></div>';
} else {
html += '<div class="usage-progress-wrap">' +
'<div class="usage-progress-head"><span>استهلاك الباقة المجانية هذا الشهر</span>' +
'<span>' + info.entriesThisMonth + ' / ' + E.FREE_MONTHLY_ENTRIES + ' قيد</span></div>' +
'<div class="usage-progress-bar"><div class="usage-progress-fill' + fillCls + '" style="width:' + pctUsed + '%"></div></div>' +
'</div>';
}
if (offer.offerLabel) {
html += '<div class="offer-banner">🎉 ' + esc(offer.offerLabel) + '</div>';
}
html += '<div class="license-tier-grid" role="radiogroup" aria-label="اختر نوع الرخصة">' +
'<button type="button" class="tier-card' + (tier === 'annual' ? ' selected' : '') + '" data-action="select-tier" data-tier="annual" role="radio" aria-checked="' + (tier === 'annual' ? 'true' : 'false') + '">' +
'<div class="tier-card-top"><span class="tier-title">باقة الأعمال السنوية</span><span class="badge ok">موصى به</span></div>' +
'<div class="tier-price-row">' +
(offer.finalAnnual < offer.baseAnnual ? '<span class="tier-old-price">' + offer.baseAnnual + ' ر.س</span>' : '') +
'<span class="tier-price">' + offer.finalAnnual + ' ر.س / سنة</span></div>' +
'<div style="font-size:calc(11.5px * var(--font-scale, 1));font-weight:700;color:var(--emerald);margin:2px 0 4px">' + offer.finalAnnual + ' ريال/سنة = ' + Math.max(1, Math.round(offer.finalAnnual / 12)) + ' ريالات/شهر = ' + coffeeOrShawarmaLabel() + '</div>' +
'<span class="tier-desc">قيود وعملات وتقارير PDF بلا حد + جميع التحديثات الكبرى القادمة</span>' +
'</button>' +
'<button type="button" class="tier-card' + (tier === 'lifetime' ? ' selected' : '') + '" data-action="select-tier" data-tier="lifetime" role="radio" aria-checked="' + (tier === 'lifetime' ? 'true' : 'false') + '">' +
'<div class="tier-card-top"><span class="tier-title">رخصة مدى الحياة</span></div>' +
'<div class="tier-price-row">' +
(offer.finalLifetime < offer.baseLifetime ? '<span class="tier-old-price">' + offer.baseLifetime + ' ر.س</span>' : '') +
'<span class="tier-price">' + offer.finalLifetime + ' ر.س</span></div>' +
'<span class="tier-desc">دفعة واحدة بدون اشتراك متكرر (تشمل كل ميزات الإصدار الأساسي)</span>' +
'</button>' +
'</div>';
html += '<div class="promo-row">' +
'<input id="promoCodeInput" type="text" dir="ltr" maxlength="24" value="' + esc(window.__selectedPromo || '') + '" placeholder="رمز ترويجي أو كود دعوة صديق (اختياري)" aria-label="رمز ترويجي" />' +
'<button type="button" class="btn ghost small" data-action="apply-promo">تطبيق الخصم</button>' +
'</div>';
html += storeButtonsHtml() +
'<div class="device-code"><span class="device-code-label">رمز جهازك</span><span dir="ltr">' + esc(E.deviceCode()) + '</span>' +
'<button type="button" class="btn ghost small" data-action="copy-device-code">نسخ</button></div>' +
'<p class="modal-note">في حال لا توجد لديك بطاقة للشراء عبر الإنترنت يمكنك الحصول على رمز التفعيل عبر الموزع المحلي أو بالتواصل على:' +
'<span class="activation-phones"><span dir="ltr">+967770550110</span><span dir="ltr">+96899323110</span></span></p>' +
'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
'<button type="button" class="btn ghost small activation-request" data-action="request-activation" style="flex:1">💬 أرسل الرمز لواتساب (' + (tier === 'lifetime' ? 'مدى الحياة' : 'السنوية') + ')</button>' +
'<button type="button" class="btn ghost small" data-action="scan-activation-qr">📷 مسح رمز QR</button>' +
'</div>' +
'<div id="actQrScanBox" hidden></div>' +
'<div class="activation-entry"><input id="activationCode" type="text" dir="ltr" maxlength="600" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="رمز التفعيل" aria-describedby="activationStatus" placeholder="الصق رمز التفعيل (103 خانات) أو كود الهدية هنا" />' +
'<button type="button" class="btn ghost small" data-action="paste-activation">📋 لصق من الحافظة</button>' +
'<button class="btn primary small" data-action="activate-app">تفعيل</button></div>' +
'<p id="activationStatus" class="activation-status" aria-live="polite"></p>' +
'<p class="activation-promise">دفاترك ملكك للأبد: عرض بياناتك وتصديرها وتحصيل الديون القائمة وسدادها متاحة دائماً دون قيود.</p></div>';
openSheet('ترقية الحساب والتفعيل', html);
var codeField = document.getElementById('activationCode');
if (codeField) {
codeField.addEventListener('input', function () { showActivationStatus(false); });
codeField.addEventListener('paste', function () { setTimeout(function () { showActivationStatus(true); }, 0); });
}
}
function selectLicenseTier(tier) {
window.__selectedTier = (tier === 'lifetime') ? 'lifetime' : 'annual';
openActivation();
}
function applyPromoInSheet() {
var field = document.getElementById('promoCodeInput');
var val = field ? String(field.value || '').trim().toUpperCase() : '';
window.__selectedPromo = val;
if (!val) {
openActivation();
return;
}
var offer = E.getPricingOffer({ locale: speechLocale(), promoCode: val });
if (offer.promoValid) {
toast('تم تطبيق الخصم: ' + (offer.offerLabel || (offer.discountPct + '%')));
} else {
toast('تم حفظ الكود وسيُرسل مع طلب التفعيل');
}
openActivation();
}
function requestActivationCode() {
var p = E.getProfile ? E.getProfile() : {};
var tier = window.__selectedTier || 'annual';
var offer = E.getPricingOffer ? E.getPricingOffer({ locale: speechLocale(), promoCode: window.__selectedPromo || '' }) : null;
var priceText = offer ? ((tier === 'lifetime' ? offer.finalLifetime : offer.finalAnnual) + ' ر.س') : '';
var tierName = tier === 'lifetime' ? 'رخصة مدى الحياة' : 'باقة الأعمال السنوية';
var message = 'أرغب في الحصول على رمز تفعيل موني كود.' +
'\nالباقة المطلوبة: ' + tierName + (priceText ? ' (' + priceText + ')' : '') +
(offer && offer.offerLabel ? '\nالعرض / الخصم: ' + offer.offerLabel : '') +
(window.__selectedPromo ? '\nالرمز الترويجي: ' + window.__selectedPromo : '') +
(p.name ? '\nالاسم: ' + p.name : '') +
(p.phone ? '\nالهاتف: ' + p.phone : '') +
(p.business ? '\nالنشاط: ' + p.business : '') +
'\nالفئة/اللهجة: ' + speechLocale() +
'\nرمز جهازي: ' + E.deviceCode();
if (window.RohPrint && window.RohPrint.sendText) window.RohPrint.sendText(message);
else copyText(message, 'تم نسخ الطلب. أرسله عبر واتساب إلى أحد الرقمين');
}
function requestForeignRecovery() {
var foreign = E.foreignLicenseInBooks ? E.foreignLicenseInBooks() : { found: false };
if (!foreign || !foreign.found) { toast('لم يُعثر على رخصة سابقة في الدفاتر', true); return; }
var p = E.getProfile ? E.getProfile() : {};
var msg = 'أرغب في نقل رخصة موني كود من هاتفي السابق (عبر النسخة الاحتياطية المستعادة).' +
(p.name ? '\nالاسم: ' + p.name : '') +
'\nرمز الرخصة السابق: ' + foreign.codeHint +
'\nكود إثبات الملكية: ' + foreign.recoveryCode +
'\nرمز جهازي الجديد: ' + E.deviceCode();
if (window.RohPrint && window.RohPrint.sendText) window.RohPrint.sendText(msg);
else copyText(msg, 'تم نسخ طلب نقل الرخصة. أرسله عبر واتساب إلى الدعم الفني');
}
function recordSubscriptionExpense() {
var offer = E.getPricingOffer ? E.getPricingOffer({ locale: speechLocale() }) : { finalAnnual: 99, finalLifetime: 349 };
var info = E.getPlanInfo();
var amount = (info.licenseKind === 'lifetime' && !info.expiresAt) ? offer.finalLifetime : offer.finalAnnual;
closeSheet();
setTab('bot');
handleText('دفعت ' + amount + ' SAR اشتراك تطبيق موني كود');
}
function openTransferLicenseSheet() {
openSheet('نقل الرخصة إلى هاتف جديد',
'<div class="activation-sheet">' +
'<p class="modal-note">لنقل رخصتك إلى هاتفك الجديد، أدخل «رمز الجهاز» الظاهر في الهاتف الجديد. سيقوم هذا الهاتف بإيقاف الرخصة هنا وتوليد «شهادة نقل رسمية» ترسلها للدعم لإصدار رمز الهاتف الجديد.</p>' +
'<div class="form-row"><label for="newDeviceInput">رمز الجهاز الجديد (12 حرفاً)</label>' +
'<input id="newDeviceInput" type="text" dir="ltr" maxlength="20" placeholder="ABCD-EFGH-JKLM" style="text-transform:uppercase;font-family:monospace" /></div>' +
'<div id="transferResultBox"></div>' +
'<div class="modal-actions">' +
'<button type="button" class="btn primary" data-action="submit-transfer-license">إيقاف الرخصة هنا وتوليد شهادة النقل</button>' +
'<button type="button" class="btn ghost" data-action="open-activation">رجوع</button>' +
'</div></div>');
}
function submitTransferLicense() {
var input = document.getElementById('newDeviceInput');
var res = E.transferLicense(input ? input.value : '');
if (!res.ok) { toast(res.error, true); return; }
var msg = 'شهادة نقل رخصة موني كود إلى هاتف جديد:\n' +
'الجهاز القديم: ' + res.oldDevice + '\n' +
'الجهاز الجديد: ' + res.newDevice + '\n' +
'شهادة النقل: ' + res.certificate;
openSheet('شهادة نقل الرخصة جاهزة',
'<div class="activation-sheet">' +
'<p class="modal-note">تم إيقاف الرخصة على هذا الجهاز بنجاح. أرسل شهادة النقل التالية عبر واتساب لاستلام رمز تفعيل جهازك الجديد:</p>' +
'<div class="device-code"><span dir="ltr">' + esc(res.certificate) + '</span></div>' +
'<div class="modal-actions">' +
'<button type="button" class="btn primary" data-action="send-cert-text" data-msg="' + esc(msg) + '">إرسال الشهادة عبر واتساب / نسخ</button>' +
'<button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button>' +
'</div></div>');
}
function openRefundLicenseSheet() {
openSheet('إلغاء الرخصة وطلب استرجاع المبلغ',
'<div class="activation-sheet">' +
'<p class="modal-note">يحق لك استرجاع المبلغ خلال 7 أيام من التفعيل. عند التأكيد، سيقوم التطبيق بإلغاء الرخصة على هذا الجهاز وتوليد «إيصال إبطال رسمي» ترسله لاستلام مبلغك. بياناتك وقيودك لن تُمسح أبداً.</p>' +
'<div class="modal-actions">' +
'<button type="button" class="btn danger" data-action="submit-refund-license">تأكيد إلغاء الرخصة وتوليد إيصال الاسترجاع</button>' +
'<button type="button" class="btn ghost" data-action="open-activation">تراجع</button>' +
'</div></div>');
}
function submitRefundLicense() {
var res = E.revokeLicenseForRefund();
if (!res.ok) { toast(res.error, true); return; }
var msg = 'إيصال إلغاء رخصة موني كود لطلب الاسترجاع:\n' +
'رمز الجهاز: ' + res.device + '\n' +
'إيصال الإلغاء: ' + res.receipt;
openSheet('إيصال إلغاء الرخصة جاهز',
'<div class="activation-sheet">' +
'<p class="modal-note">تم إبطال الرخصة على هذا الجهاز. أرسل إيصال الإلغاء التالي لاسترداد مبلغ الاشتراك:</p>' +
'<div class="device-code"><span dir="ltr">' + esc(res.receipt) + '</span></div>' +
'<div class="modal-actions">' +
'<button type="button" class="btn primary" data-action="send-cert-text" data-msg="' + esc(msg) + '">إرسال إيصال الإلغاء / نسخ</button>' +
'<button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button>' +
'</div></div>');
}
function copyDeviceCode() {
copyText(E.deviceCode(), 'تم نسخ رمز الجهاز');
}
function copyText(code, doneMessage) {
if (window.RohPrint && typeof window.RohPrint.sendText === 'function') { window.RohPrint.sendText(code); toast(doneMessage); return; }
var done = function () { toast(doneMessage); };
var fallback = function () {
var area = document.createElement('textarea');
area.value = code;
document.body.appendChild(area);
area.select();
var copied = false;
try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
area.remove();
if (copied) done(); else toast('تعذر النسخ، انقل الرمز يدوياً', true);
};
if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done).catch(fallback);
else fallback();
}
function submitActivation() {
var res = E.activateApp((document.getElementById('activationCode') || {}).value);
if (!res.ok) { showActivationStatus(); toast(res.error, true); return; }
closeSheet();
if (res.kind === 'promo') {
toast('🎉 تم تفعيل العرض الترويجي لمدة ' + res.days + ' يوماً!');
} else {
toast('تم تفعيل الرخصة بنجاح! كل المزايا والقيود مفتوحة الآن.');
}
}
function showActivationStatus(autoActivate) {
var input = document.getElementById('activationCode');
var box = document.getElementById('activationStatus');
if (!input || !box) return;
var value = input.value || '';
if (!value.trim()) { box.textContent = ''; box.className = 'activation-status'; return; }
var res = E.checkActivationInput(value);
var len = res.code ? res.code.length : 0;
var targetLen = (res.code && res.code.charAt(0) === 'T') ? E.TIMED_CODE_LENGTH : ((res.code && res.code.charAt(0) === 'P') ? E.PROMO_CODE_LENGTH : E.ACTIVATION_CODE_LENGTH);
var typing = !res.ok && len < targetLen && !/لا يُستخدم/.test(res.error || '');
box.className = 'activation-status' + (res.ok ? ' ok' : typing ? '' : ' bad');
box.textContent = res.ok
? (res.kind === 'promo' ? '✓ رمز هدية صحيح (' + res.days + ' يوماً)' : (res.kind === 'annual' ? '✓ رمز سنوي صحيح حتى ' + res.expiresAt : '✓ الرمز صحيح لهذا الجهاز'))
: (typing ? len + ' / ' + targetLen : res.error);
if (res.ok && autoActivate) submitActivation();
}
function pasteActivation() {
var input = document.getElementById('activationCode');
if (!input) return;
var fail = function () { input.focus(); toast('اضغط مطولاً في الحقل ثم اختر لصق', true); };
if (!navigator.clipboard || !navigator.clipboard.readText) { fail(); return; }
navigator.clipboard.readText().then(function (text) {
if (!text) { fail(); return; }
input.value = text;
showActivationStatus(true);
}, fail);
}
function profileAvatar(me, cls) {
return me.photo
? '<img class="' + cls + '" src="' + esc(me.photo) + '" alt="" />'
: '<span class="' + cls + ' empty" aria-hidden="true">' + esc((me.name || '؟').charAt(0)) + '</span>';
}
var sheetPhoto = null;
function drawSheetPhoto() {
var box = document.getElementById('pf-photo');
if (!box) return;
box.innerHTML = profileAvatar({ photo: sheetPhoto, name: (document.getElementById('pf-name') || {}).value || E.getProfile().name }, 'profile-avatar big') +
'<button type="button" class="btn ghost small" data-action="pf-photo-pick">' + (sheetPhoto ? 'تغيير الصورة' : 'أضف صورة') + '</button>' +
(sheetPhoto ? '<button type="button" class="btn ghost small" data-action="pf-photo-remove">إزالة</button>' : '');
}
function openLearnedWordsSheet() {
var items = E.listLearnedWords(200);
var html = '<div class="account-form">' +
'<p class="modal-note">كلمات/أسماء اكتشفها البوت أثناء التحليل ولم تُعتمد بعد. اعتمدها لتحويلها إلى إدخالات قاموس (taught)، أو احذفها.</p>' +
'<div id="learnedWordsList">';
if (!items.length) {
html += '<p class="modal-note">لا توجد كلمات جديدة.</p>';
} else {
items.forEach(function (it) {
html += '<div class="setting"><div class="s-main"><span class="s-title">' + esc(it.token) + '</span>' +
'<span class="s-sub">شوهد ' + it.seenCount + ' مرة • ' + esc(it.suggestedAction || '—') + '</span></div>' +
'<div class="modal-actions" style="margin:0">' +
'<button class="btn primary small" data-action="promote-learned" data-id="' + it.id + '">اعتماد</button>' +
'<button class="btn ghost small" data-action="dismiss-learned" data-id="' + it.id + '">حذف</button>' +
'</div></div>';
});
}
html += '</div></div>';
openSheet('مراجعة كلمات جديدة', html);
}
function openProfileSheet() {
var me = E.getProfile();
sheetPhoto = me.photo || '';
var f = function (id, label, type, value, ph) {
return '<div class="form-row"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + type + '" value="' + esc(value) + '" placeholder="' + esc(ph) + '" autocomplete="off" /></div>';
};
openSheet('الملف الشخصي', '<div class="account-form"><div class="pf-photo" id="pf-photo"></div>' +
f('pf-name', 'الاسم', 'text', me.name, 'مثال: طه') +
f('pf-business', 'اسم النشاط <span class="form-optional">(اختياري)</span>', 'text', me.business, 'مثال: متجر الأمل') +
'<div class="form-pair">' + f('pf-phone', 'الهاتف', 'tel', me.phone, '05xxxxxxxx') + f('pf-email', 'البريد', 'email', me.email, 'name@mail.com') + '</div>' +
'<div class="modal-actions"><button class="btn primary" data-action="save-profile">حفظ</button><button class="btn ghost" data-action="modal-cancel">إلغاء</button></div></div>');
drawSheetPhoto();
}
function saveProfileSheet() {
var val = function (id) { return (document.getElementById(id) || {}).value || ''; };
E.setProfile({ name: val('pf-name'), business: val('pf-business'), phone: val('pf-phone'), email: val('pf-email'), photo: sheetPhoto || '' });
closeSheet();
toast('تم حفظ الملف الشخصي');
}
var LEGAL_DATE = '2026-11-07';
var LEGAL_OWNER = 'طه الدقيل';
var LEGAL_CONTACT = '';
var LEGAL_TEXTS = {
privacy: {
title: 'سياسة الخصوصية',
sections: [
['الخلاصة', 'موني كود يعمل على هاتفك دون إنترنت. لا نجمع بياناتك المالية ولا نراها، ولا نبيعها، ولا نشاركها، ولا نعرض إعلانات.'],
['ما يُحفظ وأين', 'القيود والحسابات والرسائل والإعدادات تُحفظ في قاعدة بيانات داخل التطبيق على هاتفك. الصور المرفقة تُحفظ على الهاتف أيضاً. لا يوجد خادم لنا تُرفع إليه هذه البيانات.'],
['رمز الجهاز والتفعيل', 'يصنع التطبيق رمز جهاز قصيراً من معرّف يمنحه نظام أندرويد لهذا التطبيق، بعد تمريره في دالة تجزئة، ولا يُحفظ المعرّف الأصلي. يُستعمل الرمز لربط رمز التفعيل بهاتفك فقط، ولا يُرسل إلى أي جهة إلا إذا أرسلته أنت لطلب التفعيل.'],
['الذكاء الاصطناعي', 'لا تُرسل الأسئلة التحليلية إلا بعد موافقتك، وتذهب إلى عنوان مخدم الذكاء الاصطناعي الذي تضبطه أنت في الإعدادات (على هاتفك أو على شبكتك). إذا ضبطت عنواناً لجهة خارجية فبياناتك المرسلة تخضع لسياسة تلك الجهة.'],
['الصوت', 'الإدخال الصوتي يستعمل خدمة التعرف على الكلام في هاتفك، وقد تعالج هذه الخدمة الصوت عبر مزوّدها (مثل Google) حسب إعدادات هاتفك. قراءة الردود بصوت تستعمل محرك النطق في الهاتف.'],
['النسخ الاحتياطي والتقارير', 'النسخة الاحتياطية والتقارير تُنشأ على هاتفك، ولا تخرج منه إلا حين تختار أنت مشاركتها. النسخة الاحتياطية مشفّرة بكلمة مرور تختارها ولا نحفظها، فإن نسيتها لم نستطع فتحها.'],
['برنامج تحسين التجربة', 'اختياري ومغلق حتى تفعّله. يعدّ استعمال الشاشات والأخطاء البرمجية فقط، دون أي مبالغ أو أسماء أو نصوص تكتبها، ويُحفظ على هاتفك 30 يوماً. لا يُرسل تلقائياً: تقرؤه ثم ترسله بنفسك إن شئت. إيقافه يحذف ما جُمع.'],
['الأذونات', 'الإنترنت: للذكاء الاصطناعي على العنوان الذي تضبطه فقط. الميكروفون: للإدخال الصوتي حين تضغط زره. الإشعارات والتشغيل بعد إعادة التشغيل: للتذكيرات. القفل الحيوي: لقفل التطبيق والتحقق قبل الحذف إن فعّلتهما.'],
['حذف بياناتك', 'بياناتك تحت يدك: يمكنك حذف أي قيد، أو مسح كل البيانات من الإعدادات، أو إلغاء تثبيت التطبيق فتُحذف من الهاتف. ليس لدينا نسخة منها.'],
['الأطفال', 'التطبيق غير موجّه للأطفال دون 13 سنة، ولا نجمع عنهم شيئاً.'],
['تغيير السياسة', 'إذا تغيّر ما يفعله التطبيق ببياناتك نحدّث هذه الصفحة وتاريخها، ونخبرك داخل التطبيق إن كان التغيير جوهرياً.']
]
},
terms: {
title: 'شروط الاستخدام',
sections: [
['القبول', 'باستعمالك موني كود فأنت توافق على هذه الشروط. إن لم توافق عليها فلا تستعمل التطبيق.'],
['الملكية', 'التطبيق وشيفرته وتصميمه واسمه «موني كود / MoneyCode» وشعاره ملك لـ' + LEGAL_OWNER + '، ومحمية بأنظمة حقوق المؤلف والعلامات التجارية. لا تنتقل إليك أي ملكية بالشراء أو بالتفعيل.'],
['الترخيص', 'نمنحك ترخيصاً شخصياً غير حصري وغير قابل للتحويل لاستعمال التطبيق على أجهزتك. رمز التفعيل مرتبط بهاتف واحد، ولا يجوز بيعه أو مشاركته.'],
['ما لا يجوز', 'لا يجوز نسخ التطبيق أو بيعه أو تأجيره أو توزيعه، ولا تفكيكه أو تعديله أو إعادة توقيعه، ولا تجاوز حد القيود أو التفعيل بأي وسيلة، ولا استعمال اسمه أو شعاره دون إذن مكتوب.'],
['بياناتك', 'دفاترك ملكك. أنت المسؤول عن صحة ما تسجّله، وعن حفظ نسخ احتياطية وكلمات مرورها. لا نستطيع استعادة بيانات حُذفت أو هاتف ضاع دون نسخة احتياطية.'],
['ليس استشارة', 'الأرقام والتحليلات وحساب الزكاة والتنبيهات أدوات مساعدة تعتمد على ما تدخله، وليست استشارة محاسبية أو مالية أو شرعية أو ضريبية. راجع مختصاً قبل أي قرار مهم.'],
['الدفع والتفعيل', 'حين يكون التفعيل مدفوعاً يكون الثمن والمزايا كما عُرضت لك عند الشراء. الاسترداد يتبع سياسة الجهة التي اشتريت منها، أو اتفاقك معنا إن اشتريت منا مباشرة.'],
['التحديثات', 'قد نضيف مزايا أو نغيّرها أو نوقف بعضها. لن يمنعك أي تغيير من عرض بياناتك أو تصديرها أو تصحيحها أو حذفها.'],
['الضمان والمسؤولية', 'يُقدَّم التطبيق «كما هو». نبذل جهدنا ليكون صحيحاً، لكننا لا نضمن خلوّه من الأخطاء، ولا نتحمل أي خسارة غير مباشرة تنتج عن استعماله أو عن خطأ فيه. وفي كل الأحوال لا تتجاوز مسؤوليتنا ما دفعته مقابل التطبيق.'],
['إنهاء الترخيص', 'ينتهي ترخيصك إذا خالفت هذه الشروط. تبقى بياناتك على هاتفك وتستطيع تصديرها.'],
['النظام المطبّق', 'تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وأي خلاف يُحل ودياً أولاً ثم أمام الجهة المختصة فيها.'],
['تغيير الشروط', 'قد نحدّث هذه الشروط، ونغيّر تاريخها أعلى الصفحة. استمرارك في الاستعمال بعد التحديث يعني قبولك له.']
]
}
};
function openLegal(kind) {
var doc = LEGAL_TEXTS[kind];
if (!doc) return;
var body = '<div class="legal-text">' +
'<p class="legal-date">آخر تحديث: ' + esc(E.fmtDate ? E.fmtDate(LEGAL_DATE) : LEGAL_DATE) + '</p>' +
doc.sections.map(function (s) {
return '<h3>' + esc(s[0]) + '</h3><p>' + esc(s[1]) + '</p>';
}).join('') +
(LEGAL_CONTACT ? '<h3>التواصل</h3><p dir="auto">' + esc(LEGAL_CONTACT) + '</p>' : '') +
'<p class="legal-date">© ' + esc(LEGAL_OWNER) + '</p>' +
'</div>';
openSheet(doc.title, body);
}
var USER_GUIDE_PHRASES = [
['دفعت 1500 ريال إيجار المحل كاش', 'مصروف إيجارات يُخصم من الصندوق النقدي'],
['سلفت خالد 2000 ريال لموعد الأسبوع الجاي', 'دين لنا على خالد مع تذكير استحقاق بعد 7 أيام'],
['حصلت من خالد 800 ريال في البنك', 'تحصيل جزء من دين خالد وإيداعه في البنك'],
['استلفت من سعد 3000 ريال كاش', 'قرض/دين علينا لسعد يدخل في الصندوق'],
['سددت إلى سعد 1000 ريال من البنك', 'سداد دفعة من دين سعد خصماً من البنك'],
['صرفت 500 دولار إلى ريال', 'صرف عملات مع حساب أرباح/خسائر الصرف تلقائياً'],
['شريت معدة بـ 100 ألف دفعت 30 ألف كاش والباقي 70 ألف تمويل', 'قيد أصول مركب (نقدي + تمويل بالآجل)'],
['سددت لمقاولي الباطن 20000 منها 12000 لخالد و 8000 لسعد', 'قيد مركب يوزع الدفعة على حساب كل مقاول'],
['كم السيولة؟', 'سؤال فوري للبُوت عن النقد المتاح']
];
function openUserGuide() {
var html = '<div class="legal-text" id="inAppGuideRoot">' +
'<div class="promo-row" style="margin-bottom:10px">' +
'<input id="inAppGuideSearch" type="search" placeholder="ابحث في الدليل أو الأمثلة (مثال: عملات، إقران، مقاول، زكاة…)" aria-label="بحث في دليل الاستخدام" />' +
'</div>' +
'<div class="guide-block"><h3>1. كيف تسجل قيودك في 3 ثوانٍ؟</h3>' +
'<p>في شاشة «المحادثة»، اضغط زر الميكروفون 🎙️ وتحدث بطبيعتك أو اكتب جملتك باللهجة العامية، ثم راجع بطاقة القيد واضغط <strong>اعتماد القيد ✓</strong>.</p></div>' +
'<div class="guide-block"><h3>2. قاموس الأمثلة التفاعلي (اضغط على أي جملة لتجربتها في البوت)</h3>' +
'<div style="display:grid;gap:6px;margin:8px 0">' +
USER_GUIDE_PHRASES.map(function (p) {
return '<button type="button" class="tier-card" style="width:100%" data-action="try-guide-phrase" data-phrase="' + esc(p[0]) + '">' +
'<span class="tier-title">«' + esc(p[0]) + '»</span>' +
'<span class="tier-desc">' + esc(p[1]) + ' — اضغط للتجربة</span></button>';
}).join('') +
'</div></div>' +
'<div class="guide-block"><h3>3. تعدد العملات وصرف العملات</h3>' +
'<p>من تبويب «الحسابات»، عدّل أي حساب نقدي وحدد العملات التي يمسكها (ريال، دولار، يمني، عماني…). وعند كتابة «صرفت 500 دولار إلى ريال» يحسب المحرك متوسط التكلفة وفروق الصرف تلقائياً.</p></div>' +
'<div class="guide-block"><h3>4. إقران الأجهزة بدون إنترنت (QR & NFC)</h3>' +
'<p>أضف «رمز جهاز» شريكك في حسابه لديك (تبويب الحسابات)، ويضيف هو رمز جهازك عنده، ثم افتح (الإعدادات ← اقتران جهاز) وقرّب الهاتفين عبر NFC أو امسح رمز QR لمطابقة الديون والحركات المشتركة.</p></div>' +
'<div class="guide-block"><h3>5. النسخ الاحتياطي المشفر ونقل الرخصة لهاتف جديد</h3>' +
'<p>واظب على تصدير نسخة احتياطية مشفرة بكلمة مرور من (الإعدادات ← تصدير نسخة احتياطية). وعند شراء هاتف جديد يمكنك نقل رخصتك من (الإعدادات ← خطة الحساب والتفعيل ← نقل لهاتف جديد).</p></div>' +
'<div class="modal-actions"><button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button></div>' +
'</div>';
openSheet('📖 دليل الاستخدام وقاموس الأمثلة', html);
var sInput = document.getElementById('inAppGuideSearch');
if (sInput) {
sInput.addEventListener('input', function () {
var q = String(sInput.value || '').trim().toLowerCase();
var rootEl = document.getElementById('inAppGuideRoot');
if (!rootEl) return;
Array.prototype.forEach.call(rootEl.querySelectorAll('.guide-block, [data-action="try-guide-phrase"]'), function (el) {
el.style.display = (!q || (el.textContent || '').toLowerCase().indexOf(q) >= 0) ? '' : 'none';
});
});
}
}
function settingRow(title, sub, action, label) {
return '<div class="setting"><div class="s-main"><span class="s-title">' + esc(title) + '</span>' +
'<span class="s-sub">' + esc(sub) + '</span></div>' +
'<button class="btn ghost small" data-action="' + action + '">' + esc(label) + '</button></div>';
}
var TAB_RENDERERS = {
bot: function () { renderChat(); },
radar: function () { renderRadar(); },
ledger: function () { renderLedger(); },
accounts: function () { renderAccounts(); },
settings: function () { renderSettings(); },
reports: function () { renderReports(); },
};
var staleTabs = {};
function updateRadarBadge() {
var badge = document.getElementById('radarBadge');
if (!badge) return;
var a = E.computeAnalysis();
var dangerAlerts = (a.alerts || []).filter(function (x) { return x.type === 'danger'; });
var overdueItems = (a.dueItems || []).filter(function (d) { return d.status && d.status.key === 'overdue'; });
var count = dangerAlerts.length + overdueItems.length;
var tab = document.getElementById('tab-radar');
badge.setAttribute('aria-hidden', 'true');
badge.classList.toggle('warn', dangerAlerts.length === 0 && overdueItems.length > 0);
if (count > 0) {
badge.textContent = count > 99 ? '99+' : String(count);
badge.hidden = false;
var reasons = dangerAlerts.map(function (x) { return x.text; }).concat(overdueItems.map(function (d) { return 'استحقاق متأخر: ' + (d.counterparty || 'طرف'); }));
var summary = 'لوحة القيادة — ' + count + ' تنبيه: ' + reasons.slice(0, 2).join(' • ');
if (tab) {
tab.setAttribute('aria-label', 'لوحة القيادة، ' + count + ' تنبيه');
tab.setAttribute('title', summary);
}
} else {
badge.textContent = '';
badge.hidden = true;
if (tab) {
tab.removeAttribute('aria-label');
tab.removeAttribute('title');
}
}
}
function updateBotBadge() {
var badge = document.getElementById('botBadge');
if (!badge) return;
var draftList = E.getState().drafts || [];
var drafts = draftList.length;
var tab = document.getElementById('tab-bot');
badge.setAttribute('aria-hidden', 'true');
if (drafts > 0) {
badge.textContent = drafts > 99 ? '99+' : String(drafts);
badge.hidden = false;
var firstMemo = draftList[draftList.length - 1] && draftList[draftList.length - 1].memo ? ' («' + draftList[draftList.length - 1].memo + '»)' : '';
if (tab) {
tab.setAttribute('aria-label', 'المحادثة، ' + drafts + ' قيد بانتظار التأكيد');
tab.setAttribute('title', drafts + ' قيد بانتظار التأكيد' + firstMemo);
}
} else {
badge.textContent = '';
badge.hidden = true;
if (tab) {
tab.removeAttribute('aria-label');
tab.removeAttribute('title');
}
}
}
function renderAll() {
Object.keys(TAB_RENDERERS).forEach(function (name) { staleTabs[name] = true; });
renderStaleTab(ui.tab);
renderComposerChips();
updateComposerChipsVisibility();
var st = S();
els.topMenuBtn.setAttribute('aria-pressed', st.settings.hideAmounts ? 'true' : 'false');
updateRadarBadge();
updateBotBadge();
syncReminders();
}
var lastReminderSync = null;
function remindersOn() {
if (window.RohReminders) return !!S().settings.remindersEnabled && window.RohReminders.isAllowed();
return 'Notification' in window && Notification.permission === 'granted';
}
function syncReminders() {
if (!window.RohReminders) return;
var plan = window.RohReminders.isAllowed() ? E.reminderSchedule() : [];
var payload = JSON.stringify(plan);
if (payload === lastReminderSync) return;
lastReminderSync = payload;
window.RohReminders.sync(payload);
}
function withNotificationPermission(onAllowed) {
if (window.RohReminders.isAllowed()) { onAllowed(); return; }
window.__rohNotifResult = function (allowed) {
window.__rohNotifResult = null;
if (allowed) { onAllowed(); return; }
askConfirm('الإشعارات متوقفة', 'لن تصلك التذكيرات حتى تسمح بالإشعارات لموني كود من إعدادات الهاتف. هل تفتحها الآن؟', function () {
window.RohReminders.openSettings();
});
};
window.RohReminders.requestPermission();
}
function toggleReminders() {
if (remindersOn()) {
E.setRemindersEnabled(false);
toast('تم إيقاف التذكيرات');
renderAll();
return;
}
withNotificationPermission(function () {
E.setRemindersEnabled(true);
toast('تم تفعيل التذكيرات');
renderAll();
});
}
function testReminder() {
withNotificationPermission(function () {
window.RohReminders.test('موني كود — تذكير', 'هذا إشعار تجريبي.');
toast('تم الإرسال');
renderAll();
});
}
var revealedAmount = null;
var revealTimer = null;
function hideRevealedAmount() {
if (revealTimer) clearTimeout(revealTimer);
revealTimer = null;
if (!revealedAmount) return;
revealedAmount.innerHTML = EYE_OFF_ICON;
revealedAmount.classList.remove('revealed');
revealedAmount.setAttribute('aria-label', 'إظهار المبلغ');
revealedAmount = null;
}
function toggleMaskedAmount(node) {
var wasOpen = node === revealedAmount;
hideRevealedAmount();
if (wasOpen) return;
node.textContent = node.getAttribute('data-plain');
node.classList.add('revealed');
node.setAttribute('aria-label', 'إخفاء المبلغ');
revealedAmount = node;
revealTimer = setTimeout(hideRevealedAmount, 5000);
}
function bindMaskedAmounts() {
document.addEventListener('click', function (ev) {
var node = ev.target.closest && ev.target.closest('.masked-amount');
if (!node) return;
ev.stopPropagation();
ev.preventDefault();
toggleMaskedAmount(node);
}, true);
document.addEventListener('keydown', function (ev) {
if ((ev.key !== 'Enter' && ev.key !== ' ') || !ev.target.closest || !ev.target.closest('.masked-amount')) return;
ev.preventDefault();
toggleMaskedAmount(ev.target.closest('.masked-amount'));
});
}
function renderStaleTab(name) {
if (!staleTabs[name] || !TAB_RENDERERS[name]) return;
staleTabs[name] = false;
TAB_RENDERERS[name]();
}
window.__rohBack = function () {
if (appLocked || ownerLocked) return false;
var overlays = document.querySelectorAll('.print-overlay');
if (overlays.length) { overlays[overlays.length - 1].remove(); return true; }
if (document.getElementById('rowMenu')) { closeRowMenu(true); return true; }
if (els.modal.classList.contains('open')) { closeSheet(); return true; }
if (els.ac && !els.ac.hidden) { acHide(); return true; }
if (isGlobalSearchOpen()) { closeGlobalSearch(); return true; }
var fault = document.getElementById('storageFault');
if (fault && !fault.hidden) return false;
if (ui.tab === 'bot') return false;
setTab('bot');
return true;
};
function setTab(name) {
closeGlobalSearch();
ui.tab = name;
renderStaleTab(name);
if (name === 'radar' && E.noteFeature) E.noteFeature('radar');
if (name === 'accounts') { generalOpen = {}; renderAccountsList(); }
if (name === 'settings') { settingsOpen = { profile: true }; renderSettings(); syncSettingsGroupsAndChips(); }
document.querySelectorAll('.tab').forEach(function (b) {
var isActive = b.getAttribute('data-tab') === name;
b.classList.toggle('active', isActive);
b.setAttribute('aria-selected', isActive ? 'true' : 'false');
b.setAttribute('tabindex', isActive ? '0' : '-1');
});
document.querySelectorAll('.view').forEach(function (v) {
var isActive = v.id === 'view-' + name;
v.classList.toggle('active', isActive);
v.setAttribute('aria-hidden', isActive ? 'false' : 'true');
});
var topSettingsBtn = document.getElementById('topSettingsBtn');
if (topSettingsBtn) {
var isSettingsTab = name === 'settings';
topSettingsBtn.classList.toggle('active', isSettingsTab);
topSettingsBtn.setAttribute('aria-pressed', isSettingsTab ? 'true' : 'false');
}
if (name === 'bot') {
chatScrolledByCode = true;
var pendingCard = els.chat.querySelector('.draft, .bubble[data-draft-id]');
if (pendingCard && (E.getState().drafts || []).length > 0) {
pendingCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
if (typeof flashSearchHit === 'function') flashSearchHit(pendingCard);
} else {
els.chat.scrollTop = els.chat.scrollHeight;
}
updateStuckDates();
}
if (name === 'radar' && els.radar) {
var dangerEl = els.radar.querySelector('.alert.danger');
if (dangerEl && typeof flashSearchHit === 'function') {
dangerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
flashSearchHit(dangerEl);
}
}
var tabNames = { bot: 'المحادثة', radar: 'لوحة القيادة', accounts: 'الحسابات', ledger: 'الدليل', settings: 'الإعدادات' };
announce('تم التبديل إلى ' + (tabNames[name] || name));
}
function withFullName(text, short, full, amount) {
var want = E.normalizeAr(short);
var done = false;
var out = String(text).split(/(\s+)/).map(function (word) {
if (done) return word;
var n = E.normalizeAr(word);
if (n === want) { done = true; return full; }
if (n === 'ل' + want) { done = true; return word.charAt(0) + full; }
return word;
}).join('');
return done ? out : 'حولت ' + amount + ' الى ' + full;
}
function accountCurrencyLabel(name) {
var acc = S().accounts.filter(function (a) { return a.name === name; })[0];
if (acc && acc.multi) return ' | ' + (acc.currencies && acc.currencies.length ? acc.currencies.map(currencyName).join('، ') : 'متعدد العملات');
var cur = acc && E.listCurrencies().filter(function (c) { return c.code === acc.currency; })[0];
return cur ? ' | ' + cur.name : '';
}
function handleText(raw) {
var text = String(raw || '').trim();
if (!text) return;
var _batchLines = text.split(/[\r\n]+|;/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 0; });
if (_batchLines.length > 1) {
_batchLines.forEach(function (ln) { handleText(ln); });
return;
}
var chosen = ui.chosenName;
var chosenMoney = ui.chosenMoney;
var keptCurrency = ui.keptCurrency;
ui.chosenName = null;
ui.chosenMoney = null;
ui.keptCurrency = null;
if (E.isDictionaryCode(text)) {
E.setDictionaryOption(!S().settings.dictionaryOption);
renderAll();
toast(S().settings.dictionaryOption ? 'ظهر القاموس في الإعدادات' : 'اختفى القاموس من الإعدادات');
return;
}
if (E.isTrainingCode(text)) {
E.setTrainingOption(!S().settings.trainingOption);
toast(S().settings.trainingOption ? 'ظهر خيار تدريب البوت في القائمة ⋮' : 'اختفى خيار تدريب البوت');
return;
}
if (window.RohOwner && !ownerOpen() && (/أرغب\s*في\s*الحصول\s*على\s*رمز/.test(text) || /^[A-Z0-9]{4}(-[A-Z0-9]{4}){1,2}$/i.test(text.replace(/\s+/g, '')) || /رمز\s*التفعيل/.test(text) || /رمز\s*جهازي/.test(text))) {
requireOwner(function () { handleText(text); });
return;
}
if (window.RohOwner && /أرغب\s*في\s*الحصول\s*على\s*رمز/.test(text)) {
var _nm = (text.match(/الاسم\s*[:：]\s*(.+)/) || [])[1];
var _ph = (text.match(/الهاتف\s*[:：]\s*(.+)/) || [])[1];
var _act = (text.match(/النشاط\s*[:：]\s*(.+)/) || [])[1];
var _dev = (text.match(/رمز\s*جهازي\s*[:：]\s*(.+)/) || [])[1];
if (_nm) _nm = String(_nm).trim().split(/[\r\n]/)[0].trim();
if (_ph) _ph = String(_ph).trim().split(/[\r\n]/)[0].trim();
if (_act) _act = String(_act).trim().split(/[\r\n]/)[0].trim();
if (_dev) _dev = String(_dev).trim().split(/[\r\n]/)[0].trim().replace(/\s+/g, '');
var _accId = '';
if (_nm) {
var _found = S().accounts.filter(function (a) { return E.normalizeName(a.name) === E.normalizeName(_nm) || (a.phone && String(a.phone).trim() === _ph); })[0];
if (!_found) {
var _added = E.addAccount({ name: _nm, type: 'asset', subtype: 'العملاء', nature: 'debit', currency: E.mainCurrency(), liquid: false, glyph: '◆', hint: _act || '', phone: _ph || null });
if (_added.ok) _found = _added.account;
}
if (_found) _accId = _found.id;
}
E.setOwnerCodesOption(true);
renderAll();
openOwnerCodes({ accountId: _accId, deviceCode: _dev || '' });
return;
}
if (window.RohOwner && (/^[A-Z0-9]{4}(-[A-Z0-9]{4}){1,2}$/i.test(text.replace(/\s+/g, '')) || /رمز\s*التفعيل/.test(text) || /رمز\s*جهازي/.test(text))) {
E.setOwnerCodesOption(!S().settings.ownerCodesOption);
renderAll();
toast(S().settings.ownerCodesOption ? 'ظهر خيار رموز التفعيل في القائمة ⋮' : 'اختفى خيار رموز التفعيل');
return;
}
if (/^(حالة\s*اليوم|بطاقة\s*الحالة|بطاقه\s*الحاله|status\s*card)$/i.test(text)) {
openStatusCardSheet();
return;
}
if (/^(الفاتورة\s*الكاشفة|الفاتوره\s*الكاشفه|فاتورة\s*30\s*يوم|ملخص\s*30\s*يوم)$/i.test(text)) {
openFactSummariesSheet('invoice30');
return;
}
if (/^(المقارنة\s*الشهرية|المقارنه\s*الشهريه|مقارنة\s*الشهر)$/i.test(text)) {
openFactSummariesSheet('monthly');
return;
}
if (/^(الملخص\s*السنوي|ملخص\s*السنة|ملخص\s*السنه)$/i.test(text)) {
openFactSummariesSheet('annual');
return;
}
if (/(^|\s)(زكاة|زكاه|zakat)(\s|$)/i.test(text)) {
var a = E.computeAnalysis();
var base = Math.max(0, (a.assets || 0) - (a.liabilities || 0));
var due = Math.round(base * 0.025);
botText('زكاة النقود والمدخرات (2.5%):\n' +
'صافي الثروة (الأصول − الالتزامات): ' + money(base) + '\n' +
'الزكاة المستحقة: ' + money(due) + '\n' +
'النصاب تقريبي: 85 غرام ذهب (≈ 20,000 ر.س). إذا بلغ صافي ثروتك النصاب وحال عليه الحول، فهذه هي الزكاة.');
return;
}
if (/(^|\s)(ميزانية|ميزانيات|budget)(\s|$)/i.test(text)) {
pushMessage({ role: 'user', type: 'text', text: text });
var bMatchDel = text.match(/حذف\s+(.+)/);
if (bMatchDel) {
var bnameDel = bMatchDel[1].trim();
var baccDel = null;
var stb = S();
for (var bi = 0; bi < stb.accounts.length; bi++) {
if (E.normalizeName(stb.accounts[bi].name) === E.normalizeName(bnameDel) || stb.accounts[bi].id === bnameDel) { baccDel = stb.accounts[bi]; break; }
}
if (!baccDel) { botText('لم أجد حساباً باسم "' + bnameDel + '".'); E.saveState(); renderAll(); return; }
var bb = (E.budgetList ? E.budgetList() : []).filter(function (x) { return x.accountId === baccDel.id; })[0];
if (!bb) { botText('لا توجد ميزانية لحساب "' + baccDel.name + '".'); E.saveState(); renderAll(); return; }
E.removeBudget(bb.id);
botText('تم حذف ميزانية "' + baccDel.name + '".');
E.saveState(); renderAll(); return;
}
var bMatchAdd = text.match(/(.+?)\s+([\d.,]+)/);
var bKeywordOnly = /^(ميزانية|ميزانيات|budget)\s*$/i.test(text);
if (!bKeywordOnly && bMatchAdd) {
var bnameAdd = bMatchAdd[1].replace(/^(ميزانية|ميزانيات|budget)\s*/i, '').trim();
var bamount = parseFloat(bMatchAdd[2].replace(/,/g, ''));
if (bnameAdd && bamount > 0) {
var stb2 = S();
var baccAdd = null;
for (var bi2 = 0; bi2 < stb2.accounts.length; bi2++) {
if (E.normalizeName(stb2.accounts[bi2].name) === E.normalizeName(bnameAdd) || stb2.accounts[bi2].id === bnameAdd) { baccAdd = stb2.accounts[bi2]; break; }
}
if (!baccAdd) {
for (var bi3 = 0; bi3 < stb2.accounts.length; bi3++) {
if (E.normalizeName(stb2.accounts[bi3].name).indexOf(E.normalizeName(bnameAdd)) >= 0) { baccAdd = stb2.accounts[bi3]; break; }
}
}
if (!baccAdd) { botText('لم أجد حساباً باسم "' + bnameAdd + '".'); E.saveState(); renderAll(); return; }
var resb = E.addBudget({ accountId: baccAdd.id, monthlyLimitMinor: Math.round(bamount * 100), currency: E.BASE });
if (!resb.ok) { botText('تعذر حفظ الميزانية: ' + (resb.error || '')); E.saveState(); renderAll(); return; }
botText('تم حفظ ميزانية "' + baccAdd.name + '": ' + money(Math.round(bamount * 100)) + ' شهرياً.');
E.saveState(); renderAll(); return;
}
}
var blist = E.budgetList ? E.budgetList() : [];
if (!blist.length) {
botText('لا توجد ميزانيات شهرية.\nللإضافة: "ميزانية <اسم الحساب> <المبلغ>" (مثال: ميزانية طعام 500)\nأو من الإعدادات → الميزانيات الشهرية.');
E.saveState(); renderAll(); return;
}
var lines = ['ميزانيات هذا الشهر:'];
var totalSpent = 0, totalLimit = 0;
blist.forEach(function (b) {
var stt = E.budgetStatus(b.accountId);
var acc = E.getAccount(b.accountId);
var name = acc ? acc.name : b.accountId;
var spent = stt ? (stt.spentMinor || 0) : 0;
var limit = stt ? (stt.limitBase || 0) : 0;
totalSpent += spent; totalLimit += limit;
lines.push('• ' + name + ': ' + money(spent) + ' / ' + money(limit) + ' (' + (stt ? stt.pct : 0) + '%)' + (stt && stt.over ? ' ⚠️ تجاوز' : ''));
});
lines.push('الإجمالي: ' + money(totalSpent) + ' من ' + money(totalLimit));
lines.push('للإدارة: "ميزانية <حساب> <مبلغ>" للإضافة/التحديث، "ميزانية حذف <حساب>" للحذف.');
botText(lines.join('\n'));
E.saveState(); renderAll(); return;
}
var st = S();
var accountAsked = E.accountQuestion(text);
if (accountAsked) {
pushMessage({ role: 'user', type: 'text', text: text });
st.pendingText = null;
if (accountAsked.type === 'list') botText(accountListText());
else botAccountBalance(accountAsked.account);
E.saveState();
renderAll();
return;
}
var addMatch = text.match(/(?:أضف حساب|حساب جديد|أضف|اضف)\s+(.+)/);
if (addMatch) {
var aname = addMatch[1].trim();
if (aname) {
var res = E.addAccount({ name: aname, type: 'expense', nature: 'debit', currency: 'SAR', liquid: false, glyph: '◆', hint: '' });
if (res.ok) {
botText('تم إنشاء الحساب "' + aname + '" (رمز: ' + res.account.id + ').\\nيمكنك تعديل نوعه/عملته من شاشة الحسابات.');
} else {
botText('تعذر إنشاء الحساب: ' + (res.error || ''));
}
E.saveState();
renderAll();
return;
}
}
var viewMatch = text.match(/(?:عرض|فتح|رصيد)(?:\s+حساب)?\s+(.+)/);
if (viewMatch && !addMatch) {
var vname = viewMatch[1].trim();
var vacc = null;
for (var i = 0; i < st.accounts.length; i++) {
if (st.accounts[i].id === vname || st.accounts[i].code === vname) { vacc = st.accounts[i]; break; }
}
if (!vacc) for (var i = 0; i < st.accounts.length; i++) {
if (E.normalizeName(st.accounts[i].name) === E.normalizeName(vname)) { vacc = st.accounts[i]; break; }
}
if (!vacc) for (var i = 0; i < st.accounts.length; i++) {
if (E.normalizeName(st.accounts[i].name).indexOf(E.normalizeName(vname)) >= 0) { vacc = st.accounts[i]; break; }
}
if (vacc) {
var va = E.computeAnalysis();
var vbal = va.balances && va.balances[vacc.id] ? va.balances[vacc.id] : { native: 0, base: 0 };
botText('حساب: ' + vacc.name + ' (' + vacc.id + ')\n' +
'النوع: ' + vacc.type + ' | العملة: ' + vacc.currency + '\n' +
'الرصيد: ' + E.fmtMoney(vbal.native, vacc.currency) + ' (' + moneyText(vbal.base) + ')\n' +
'سائل: ' + (vacc.liquid ? 'نعم' : 'لا'));
E.saveState();
renderAll();
return;
}
}
var extractNamesMatch = text.match(/(?:استخراج أسماء|أسماء في|أسماء من)\s+(.+)/);
if (extractNamesMatch) {
var src = extractNamesMatch[1].trim();
var party = E.extractPartyRaw ? E.extractPartyRaw(src) : '';
var names = [];
if (party) names.push(party);
var stn = S();
var foundAccs = [];
(stn.accounts || []).forEach(function (acc) {
if (src.indexOf(acc.name) >= 0) foundAccs.push(acc);
});
var lines = ['استخراج أسماء من: "' + src + '"'];
if (party) {
var known = (stn.accounts || []).some(function (a) { return E.normalizeName(a.name) === E.normalizeName(party); });
lines.push('اسم مستخرج: ' + party + (known ? ' (موجود كحساب)' : ' (غير موجود)'));
if (!known) lines.push('لإنشاء حساب: "أضف حساب ' + party + '"');
} else {
lines.push('لم يُستخرج اسم.');
}
if (foundAccs.length) {
lines.push('حسابات مطابقة في الدفاتر:');
foundAccs.forEach(function (acc) {
var a = E.computeAnalysis();
var bal = a.balances && a.balances[acc.id] ? a.balances[acc.id].base : 0;
lines.push('• ' + acc.name + ' (' + acc.id + ') — ' + moneyText(bal));
});
}
botText(lines.join('\n'));
E.saveState();
renderAll();
return;
}
var extractMatch = text.match(/(?:استخراج حسابات|حسابات في|حسابات من)\s+(.+)/);
if (extractMatch) {
var src = extractMatch[1].trim();
var found = [];
var st3 = S();
(st3.accounts || []).forEach(function (acc) {
if (src.indexOf(acc.name) >= 0) found.push(acc);
else if (acc.id && src.indexOf(acc.id) >= 0) found.push(acc);
else if (acc.code && src.indexOf(acc.code) >= 0) found.push(acc);
});
var det = E.detectAccount ? E.detectAccount(src) : null;
if (det && !found.some(function (a) { return a.id === det; })) {
var da = E.getAccount(det);
if (da) found.push(da);
}
var party = E.extractPartyRaw ? E.extractPartyRaw(src) : '';
var lines = ['استخراج من: "' + src + '"'];
if (found.length) {
lines.push('حسابات مكتشفة:');
found.forEach(function (acc) {
var a = E.computeAnalysis();
var bal = a.balances && a.balances[acc.id] ? a.balances[acc.id].base : 0;
lines.push('• ' + acc.name + ' (' + acc.id + ') — ' + moneyText(bal));
});
} else {
lines.push('لم يُكتشف أي حساب معروف.');
}
if (party) {
var knownParty = (st3.accounts || []).some(function (a) { return E.normalizeName(a.name) === E.normalizeName(party); });
lines.push('طرف: ' + party + (knownParty ? ' (موجود)' : ' (غير موجود — يمكن إنشاؤه: "أضف حساب ' + party + '")'));
}
botText(lines.join('\n'));
E.saveState();
renderAll();
return;
}
var renameMatch = text.match(/تعديل اسم الحساب\s+(.+?)\s+إلى\s+(.+)/);
if (renameMatch) {
var oldName = renameMatch[1].trim();
var newName = renameMatch[2].trim();
var acc = null;
for (var i = 0; i < st.accounts.length; i++) {
if (st.accounts[i].id === oldName || st.accounts[i].code === oldName) { acc = st.accounts[i]; break; }
}
if (!acc) for (var i = 0; i < st.accounts.length; i++) {
if (E.normalizeName(st.accounts[i].name) === E.normalizeName(oldName)) { acc = st.accounts[i]; break; }
}
if (!acc) for (var i = 0; i < st.accounts.length; i++) {
if (E.normalizeName(st.accounts[i].name).indexOf(E.normalizeName(oldName)) >= 0) { acc = st.accounts[i]; break; }
}
if (!acc) { botText('الحساب "' + oldName + '" غير موجود.'); renderAll(); return; }
var oldNorm = E.normalizeName(acc.name);
var newNorm = E.normalizeName(newName);
var ok = false;
if (newNorm.indexOf(oldNorm) >= 0 || oldNorm.indexOf(newNorm) >= 0) ok = true;
if (!ok) {
var noAl = function (w) { return w.replace(/^ال/, ''); };
var oldWords = oldNorm.split(/\s+/).map(noAl);
var newWords = newNorm.split(/\s+/).map(noAl);
for (var wi = 0; wi < oldWords.length; wi++) {
if (oldWords[wi].length >= 3 && newWords.indexOf(oldWords[wi]) >= 0) { ok = true; break; }
}
}
if (!ok) {
botText('لا يمكن تغيير الاسم جذرياً. يجب أن يحتوي الاسم الجديد على جزء من "' + acc.name + '".');
renderAll();
return;
}
var renameCheck = E.checkAccountName(newName);
if (!renameCheck.ok) { botText(renameCheck.error); renderAll(); return; }
acc.name = newName;
E.onAccountRenamed(acc.id, newName);
E.saveState();
botText('تم تعديل اسم الحساب إلى "' + newName + '".');
renderAll();
return;
}
pushMessage({ role: 'user', type: 'text', text: text });
var effective = text;
if (st.pendingText) {
var prev = st.pendingText;
st.pendingText = null;
var hasNew = /\d/.test(E.normalizeAr(text));
var hasPrev = /\d/.test(E.normalizeAr(prev));
if (hasNew !== hasPrev) effective = prev + ' ' + text;
}
var intent;
try {
intent = E.parseIntent(effective);
if (intent && window.__autoCreatedAccount) {
E.queueLearnedWord(window.__autoCreatedAccount, intent.kind, intent.contraAccountId);
window.__autoCreatedAccount = null;
}
if (keptCurrency && intent && intent.amountMinor) intent.currency = keptCurrency;
var mc = intent && intent.moneyChoice;
if (mc && intent.amountMinor && mc.candidates.indexOf(chosenMoney) < 0) {
pushMessage({ role: 'bot', type: 'text',
text: 'هل تقصد؟ عندك ' + (mc.candidates.length === 2 ? 'حسابان' : mc.candidates.length + ' حسابات') + ' باسم "' + mc.word + '". من أي حساب؟',
data: { choices: mc.candidates.map(function (name) {
return { label: name + accountCurrencyLabel(name), action: 'money-pick', name: name, carry: chosen || '', currency: intent.currency, text: withFullName(effective, mc.word, name, intent.amountMinor / 100) };
}) } });
E.saveState();
renderAll();
return;
}
if (intent && (intent.kind === 'lend' || intent.kind === 'borrow' || intent.kind === 'collect' || intent.kind === 'repay') && intent.counterparty) {
var cp = intent.counterparty.trim();
var existing = null;
var cands = E.accountCandidates(cp);
var settled = chosen && cands.filter(function (c) { return c.exact && c.name === chosen; })[0];
if (settled) existing = E.getAccount(settled.id);
else if (cands.length === 1 && cands[0].exact) existing = E.getAccount(cands[0].id);
else if (cands.length) {
ui.pendingSimilar = { intent: intent, name: cp };
pushMessage({ role: 'bot', type: 'similar-account', name: cp, options: cands });
E.saveState();
renderAll();
return;
}
if (!existing) {
var isReceivable = (intent.kind === 'lend' || intent.kind === 'collect');
var newAcc = E.addAccount({
name: cp,
type: isReceivable ? 'asset' : 'liability',
nature: isReceivable ? 'debit' : 'credit',
currency: intent.currency || 'SAR',
liquid: false,
glyph: isReceivable ? '⇢' : '⇠',
hint: isReceivable ? 'عميل' : 'مورد',
subtype: isReceivable ? 'العملاء' : 'الموردون'
});
if (newAcc && newAcc.ok) {
intent.contraAccountId = newAcc.account.id;
window.__autoCreatedAccount = newAcc.account.name;
}
} else {
intent.contraAccountId = existing.id;
}
}
if (intent && intent.kind === 'transfer' && intent.fromAccountId === 'cash') {
var mm = effective.match(/من\s+(.+?)(?=\s+(?:الي|الى|إلى)\s|$)/);
if (mm) {
var raw = mm[1].trim();
var src = E.normalizeName(raw);
var known = (S().accounts || []).some(function (a) {
return src === E.normalizeName(a.name) || a.id === raw || a.code === raw;
});
if (!known) {
botText('الحساب "' + raw + '" غير موجود، لذلك سيُسجَّل التحويل من النقد. لإنشائه أولاً: "أضف حساب ' + raw + '"');
}
}
}
} catch (e) {
console.error('[RohUI] parse failed', e);
ux('parse.failed');
try { var _pec = Number(localStorage.getItem('rohapp.parseErrorCount') || 0) + 1; localStorage.setItem('rohapp.parseErrorCount', String(_pec)); } catch (e2) {}
botText('تعذر فهم الجملة. جرّب صيغة أوضح مثل: «دفعت 250 بنزين».');
renderAll();
return;
}
ux({ needKind: 'parse.needKind', needAmount: 'parse.needAmount', needSplit: 'parse.needSplit', help: 'parse.help', query: 'parse.query' }[intent.kind] || '');
if (intent.kind === 'query' && !wantsAI(effective)) {
botText('هذا ملخص وضعك الآن:');
pushMessage({ role: 'bot', type: 'report', data: reportData() });
} else if (intent.kind === 'query' || intent.kind === 'help') {
if (intent.kind === 'query') {
botText('هذا ملخص وضعك الآن:');
pushMessage({ role: 'bot', type: 'report', data: reportData() });
}
askAI(effective);
} else if (intent.kind === 'undo') {
verifyThen('حذف آخر قيد', function () {
var undo = E.undoLast();
if (undo.ok) { botText('تم التراجع عن آخر قيد وحذفه من الدفاتر.' + undoEntrySummary(undo.entry)); toast('تم التراجع'); }
else botText('تعذر التراجع: ' + undo.error);
renderAll();
});
} else if (intent.kind === 'needAmount') {
st.pendingText = effective;
botText('أنت قلت: "' + esc((intent.memo || effective || '').slice(0, 60)) + '"\n' +
'فهمت أنها ' + kindMeta(intent.intended).label + '، لكن لم أجد المبلغ.\n' +
'كم المبلغ؟ اختر مبلغاً بضغطة واحدة أو اكتبه:');
pushMessage({
role: 'bot',
type: 'text',
text: 'مبالغ سريعة:',
data: {
choices: ['50', '100', '250', '500', '1000', '5000'].map(function (amt) {
return { label: amt, action: 'need-amount', name: amt, text: amt };
}),
tight: true
}
});
} else if (intent.kind === 'personTransfer') {
var many = intent.candidates || [];
pushMessage({ role: 'bot', type: 'text',
text: 'هل تقصد؟ عندك ' + (many.length === 2 ? 'حسابان' : many.length + ' حسابات') + ' باسم "' + intent.person + '". اختر الشخص:',
data: { choices: many.map(function (name) {
return { label: name + accountCurrencyLabel(name), action: 'person-pick', name: name, text: withFullName(effective, intent.person, name, intent.amountMinor / 100) };
}).concat([{ label: '+ حساب جديد: ' + intent.person, action: 'person-new', name: intent.person, text: effective }]) } });
} else if (intent.kind === 'unsupportedCurrency') {
botText('لا أدعم عملة "' + esc(intent.currencyWord) + '" بعد، ولم أسجل هذا القيد.\n' +
'اكتب المبلغ بإحدى هذه العملات: ' + E.listCurrencies().map(function (c) { return esc(c.name); }).join('، ') + '.\n' +
'أو أضف العملة من الإعدادات.');
} else if (intent.kind === 'needSplit' && askAddCurrency(intent, effective)) {
} else if (intent.kind === 'needSplit') {
var names = intent.accounts.map(function (id) { var acc = E.getAccount(id); return acc ? acc.name : id; });
pushMessage({ role: 'bot', type: 'text',
text: 'ذكرت ' + moneyText(E.toBase(intent.amountMinor, intent.currency || E.BASE)) + ' في ' + names.join('، ') + '. كم في كل حساب؟',
data: { choices: [{ label: 'وزّع المبلغ', action: 'split-open', name: '', text: effective }] } });
openSplitSheet(intent);
} else if (intent.kind === 'needKind') {
st.pendingText = effective;
pushMessage({ role: 'bot', type: 'text', text: 'سجّلت المبلغ، لكن أحتاج نوع العملية: مصروف، إيراد، دين لنا، أم دين علينا؟',
data: { choices: [
{ label: 'مصروف', action: 'need-kind', name: 'expense', text: 'مصروف' },
{ label: 'إيراد', action: 'need-kind', name: 'income', text: 'إيراد' },
{ label: 'دين لنا', action: 'need-kind', name: 'lend', text: 'دين لنا' },
{ label: 'دين علينا', action: 'need-kind', name: 'borrow', text: 'دين علينا' }
], tight: true } });
} else if (intent.kind === 'mixedKinds') {
botText('عذراً، لم أستطع فهم اختيارك. لا يمكن جمع مصروف (مثل كهرباء) مع إيراد (مثل راتب) في قيد واحد.\n' +
'سجّل كل عملية على حدة: «دفعت 30 كهرباء» و «قبضت 100 راتب»، أو استخدم قيداً مركّباً من نوع واحد (مصروفات أو إيرادات).');
} else if (intent.kind === 'help') {
askAI(effective);
} else if (intent.kind === 'repay' && intent.counterparty && ui.advanceOkText !== text && !hasOpenPayableFor(intent.counterparty)) {
pushMessage({ role: 'bot', type: 'text',
text: 'لا يوجد دين مسجّل عليك لصالح «' + esc(intent.counterparty) + '». هل هذه دفعة مقدمة له؟',
data: { choices: [
{ label: 'نعم، دفعة مقدمة', action: 'advance-yes', name: '', text: text },
{ label: 'لا، سأسجّل الشراء أولاً', action: 'advance-no', name: '', text: text }
], tight: true } });
} else if (!ui.keepCurrencyAsIs && askAddCurrency(intent, effective)) {
} else {
ui.keepCurrencyAsIs = false;
ui.advanceOkText = null;
if (intent.currency && intent.currency !== E.BASE && (intent.kind === 'expense' || intent.kind === 'income' || intent.kind === 'lend' || intent.kind === 'borrow' || intent.kind === 'collect' || intent.kind === 'repay' || intent.kind === 'transfer' || intent.kind === 'capital')) {
var cur = intent.currency;
var hasAcc = S().accounts.some(function (a) { return a.liquid && (a.currency === cur || (a.multi && (a.currencies || []).indexOf(cur) >= 0)); });
if (!hasAcc) {
ui.pendingCurrencyAccount = { intent: intent, currency: cur, text: effective };
pushMessage({ role: 'bot', type: 'text', text: 'لا يوجد حساب نقدي يقبل ' + esc(currencyName(cur)) + '. هل أضيف ' + esc(currencyName(cur)) + ' إلى «الصندوق»؟',
data: { choices: [
{ label: 'نعم، أضفها للصندوق', action: 'currency-account-yes', text: effective },
{ label: 'لا، استخدم الحساب الحالي', action: 'currency-account-no', text: effective }
] } });
E.saveState();
renderAll();
return;
}
}
var dupFound = false;
try {
var nowMs = Date.now();
var st2 = S();
for (var di = 0; di < (st2.entries || []).length; di++) {
var e = st2.entries[di];
if (!e || e.kind !== intent.kind) continue;
if (Math.abs((e.totalBase || 0) - (E.toBase(intent.amountMinor, intent.currency) || 0)) > 1) continue;
var normParty = E.normalizeName(intent.counterparty || '');
if (normParty && E.normalizeName(e.counterparty || '') !== normParty) continue;
var created = e.createdAt ? new Date(e.createdAt).getTime() : 0;
if (created && (nowMs - created) < 30000) { dupFound = true; ui.pendingDuplicateEntry = e.id; break; }
}
} catch (e2) { dupFound = false; }
if (dupFound) {
ui.pendingDuplicate = intent;
pushMessage({ role: 'bot', type: 'duplicate-confirm', text: effective });
E.saveState();
renderAll();
return;
}
try {
var newPeople = (intent.lines || []).filter(function (l) { return l.newPerson || l.newAccount; }).map(function (l) { return (l.newPerson || l.newAccount).name; });
E.ensurePeopleAccounts(intent);
var draft = E.buildDraft(intent);
if (newPeople.length) toast((newPeople.length > 1 ? 'أُنشئت حسابات جديدة: ' : 'أُنشئ حساب جديد: ') + newPeople.join('، '));
if (window.__autoCreatedAccount) {
setTimeout(function () { toast('تم إنشاء الحساب "' + window.__autoCreatedAccount + '" تلقائياً'); window.__autoCreatedAccount = null; }, 100);
}
st.drafts.push(draft);
if (st.drafts.length > 20) st.drafts = st.drafts.slice(-20);
ux('entry.bot');
E.saveState();
pushMessage({ role: 'bot', type: 'draft', draftId: draft.id });
} catch (e) {
console.error('[RohUI] draft failed', e);
botText('لم أستطع بناء القيد: ' + e.message);
}
}
E.saveState();
renderAll();
}
function holdSuspiciousDraft(draft, reasons) {
var st = S();
if (st.messages.some(function (m) { return m.data && m.data.assistant === 'fraud' && m.data.draftId === draft.id && m.data.choices; })) {
toast('هذا القيد موقوف في المحادثة، اختر ما تريد فيه', true);
return;
}
var amount = moneyText(draft.totalBase);
pushMessage({ role: 'bot', type: 'text',
text: 'أوقفت هذا القيد قبل حفظه: ' + amount + (draft.counterparty ? ' — ' + draft.counterparty : '') + '. ' + reasons.join('. ') + '. لم يُحفظ شيء بعد.',
data: { assistant: 'fraud', draftId: draft.id, tight: true, choices: [
{ label: 'ألغِ القيد', action: 'fraud-cancel', name: draft.id, text: '' },
{ label: 'راجع التفاصيل', action: 'fraud-review', name: draft.id, text: '' },
{ label: 'نعم، هو مني — احفظ', action: 'fraud-save', name: draft.id, text: '' }
] } });
E.saveState();
renderAll();
setTab('bot');
}
function settleHeldDraft(id, text) {
S().messages.forEach(function (m) {
if (m.data && m.data.assistant === 'fraud' && m.data.draftId === id) { m.text = text; delete m.data.choices; }
});
E.saveState();
}
function verifyAlways(reason, action) {
if (!window.RohAuth || !window.RohAuth.available()) { action(); return; }
authPending = { action: action };
window.RohAuth.authenticate(reason);
}
function confirmDraft(id) {
var draft = E.findDraft(id);
var sourceEntryId = draft ? draft.sourceEntryId : null;
if (sourceEntryId) {
var replaceable = E.canDeleteEntry(sourceEntryId);
if (!replaceable.ok) { toast(replaceable.error, true); return; }
}
if (draft && E.detectFraudRisk) {
var fr = E.detectFraudRisk(draft);
if (fr && fr.risk === 'high' && fr.reasons && fr.reasons.length) {
holdSuspiciousDraft(draft, fr.reasons);
return;
} else if (fr && fr.risk === 'medium' && fr.reasons && fr.reasons.length) {
toast('تنبيه: ' + fr.reasons.join('، '), true);
}
}
confirmDraftProceed(id, sourceEntryId);
}
function ux(name) {
try { E.noteUsage(name); } catch (e) { /* never in the way */ }
}
function inviteToUxProgram() {
var st = S();
if (!st.settings || st.settings.uxAskedAt || st.settings.uxProgram || (st.entries || []).length < 10) return;
st.settings.uxAskedAt = new Date().toISOString();
pushMessage({ role: 'bot', type: 'text',
text: 'هل تشارك في برنامج تحسين التجربة؟ يجمع التطبيق أعداداً مجهولة عن المزايا التي تستخدمها وأين لم يفهمك البوت، دون مبالغ أو أسماء أو نصوص. لا يُرسل شيء إلا حين تضغط أنت «إرسال التقرير»، ويمكنك الخروج من الإعدادات في أي وقت.',
data: { choices: [
{ label: 'نعم، أشارك', action: 'uxp-yes', name: '', text: '' },
{ label: 'لا، شكراً', action: 'uxp-no', name: '', text: '' }
] } });
E.saveState();
renderAll();
}
function uxConsentHtml() {
return '<p class="modal-note">يساعدنا البرنامج على معرفة ما يُستخدم من التطبيق وأين يتعثّر البوت، لنحسّنه.</p>' +
'<div class="uxp-cols"><div><b>ما يُجمع</b><ul>' +
'<li>عدد مرات استخدام كل ميزة (قيد من البوت، من النموذج، الصوت، التقارير…)</li>' +
'<li>عدد الجمل التي لم يفهم البوت نوعها أو مبلغها، دون نصها</li>' +
'<li>نوع الخطأ ومكانه في الكود إن حدث</li>' +
'<li>إصدار التطبيق والمنصة وعدد الأيام</li></ul></div>' +
'<div><b>ما لا يُجمع أبداً</b><ul>' +
'<li>المبالغ والأرصدة والقيود</li><li>الأسماء والحسابات وأرقام الهواتف</li><li>نصوص الجمل والملاحظات</li></ul></div></div>' +
'<p class="modal-note">تبقى البيانات على هاتفك ولا تدخل النسخ الاحتياطية، ولا يُرسل شيء إلا حين تضغط «إرسال التقرير» وتختار أين ترسله. الخروج يحذف ما جُمع فوراً.</p>';
}
function openUxConsent() {
openSheet('برنامج تحسين التجربة', uxConsentHtml() +
'<div class="modal-actions"><button class="btn primary" data-action="uxp-join">انضم</button>' +
'<button class="btn ghost" data-action="modal-cancel">لا شكراً</button></div>');
}
function openUxReport() {
var text = E.uxReportText();
openSheet('تقرير تحسين التجربة',
'<p class="modal-note">هذا هو النص الذي يُرسل كما هو، لا شيء غيره.</p>' +
'<pre class="uxp-report" dir="auto">' + esc(text) + '</pre>' +
'<div class="modal-actions"><button class="btn primary" data-action="uxp-send">إرسال التقرير</button>' +
'<button class="btn ghost" data-action="uxp-clear">مسح ما جُمع</button></div>');
}
function sendUxReport() {
var text = E.uxReportText();
if (window.RohPrint && window.RohPrint.sendText) { window.RohPrint.sendText(text); return; }
if (navigator.clipboard && navigator.clipboard.writeText) {
navigator.clipboard.writeText(text).then(function () { toast('نُسخ التقرير. الصقه في رسالة إلى المطوّر.'); }, function () { toast('تعذر النسخ', true); });
return;
}
toast('لا توجد طريقة إرسال على هذا الجهاز', true);
}
function confirmDraftProceed(id, sourceEntryId) {
var draft = E.findDraft(id);
var typed = !sourceEntryId && draft && draft.memo && !draft.fromForm && S().messages.some(function (m) { return m.type === 'draft' && m.draftId === id; });
var res = E.confirmDraft(id);
if (!res.ok && res.reason === 'currency' && E.featureTrialLeft && E.featureTrialLeft('multiCurrency') > 0) {
var mcTr = E.useFeatureTrial('multiCurrency');
if (mcTr && mcTr.ok) {
toast('تجربة مجانية لتعدد العملات (متبقي لك ' + mcTr.remaining + ' تجارب مجانية)');
res = E.confirmDraft(id);
}
}
if (!res.ok) {
if (res.reason === 'entryLimit') openActivation(res.error);
else if (res.limited) openPlans(res.error);
else toast(res.error, true);
return;
}
if (typed) E.trainSentence(draft.memo, res.entry.kind);
if (autoSpeechReady && S().settings.autoTts) speakText('تم الاعتماد.');
var st = S();
st.messages.forEach(function (m) {
if (m.type === 'draft' && m.draftId === id) {
markSentenceState(m.from, 'confirmed');
m.type = 'receipt';
m.entryId = res.entry.id;
delete m.draftId;
}
});
linkAttachmentsToEntry(id, res.entry.id, sourceEntryId);
if (sourceEntryId) {
E.deleteEntry(sourceEntryId);
}
E.saveState();
toast('تم اعتماد القيد وتحديث الأرصدة');
ux('draft.confirm');
renderAll();
inviteToUxProgram();
}
function markSentenceState(sentenceId, state) {
if (!sentenceId) return;
S().messages.forEach(function (m) {
if (m.id !== sentenceId) return;
m.sentState = state;
if (state === 'confirmed') m.confirmedAt = new Date().toISOString();
});
}
function fmtStamp(iso) {
var d = new Date(iso);
if (isNaN(d.getTime())) return '';
var p = function (n) { return (n < 10 ? '0' : '') + n; };
return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function sentenceMark(m) {
var state = m.sentState || '';
if (!state) {
var waiting = S().messages.some(function (x) { return x.type === 'draft' && x.from === m.id; });
if (waiting) state = 'waiting';
}
var sid = esc(m.id);
if (state === 'confirmed') return '<button type="button" class="sent-check" data-action="sent-confirmed-at" data-id="' + sid + '" aria-label="تم اعتماد القيد — اضغط لعرض الوقت" title="تم اعتماد القيد">✓</button>';
if (state === 'cancelled') return '<span class="sent-check cancelled" role="img" aria-label="تم إلغاء القيد" title="تم إلغاء القيد">−</span>';
if (state === 'waiting') return '<button type="button" class="sent-check waiting" data-action="sent-go-draft" data-id="' + sid + '" aria-label="بانتظار التأكيد — اضغط للذهاب إلى القيد" title="بانتظار التأكيد">…</button>';
return '';
}
function cancelDraft(id) {
var res = E.cancelDraft(id);
if (!res.ok) { toast(res.error, true); return; }
ux('draft.cancel');
try { var _cc = Number(localStorage.getItem('rohapp.cancelCount') || 0) + 1; localStorage.setItem('rohapp.cancelCount', String(_cc)); } catch (e) {}
var st = S();
st.messages.forEach(function (m) {
if (m.type === 'draft' && m.draftId === id) {
markSentenceState(m.from, 'cancelled');
m.type = 'cancelled';
delete m.draftId;
}
});
E.saveState();
toast('تم إلغاء القيد');
renderAll();
}
function applyRateInline(input) {
if (!input || !input.isConnected) return;
var draftId = input.getAttribute('data-draft-id');
var from = input.getAttribute('data-from');
var to = input.getAttribute('data-to');
var exact = parseFloat(input.getAttribute('data-exact'));
var x = parseFloat(String(input.value || '').replace(/,/g, ''));
if (input.value === input.getAttribute('data-shown')) x = exact;
if (!(x > 0)) { toast('سعر غير صالح', true); ui.editingRateDraftId = null; renderAll(); return; }
var draft = E.findDraft(draftId);
if (!draft) { toast('القيد غير موجود', true); return; }
var rates = {};
if (to !== E.BASE) rates[to] = E.getRate(from) / x;
else rates[from] = x;
var isCompound = !!(draft.isCompound || draft.kind === 'compound' || (draft.lines || []).length >= 2 && (draft.lines || []).length > 2);
if (isMultiLine(draft)) {
toast('استخدم نموذج التعديل لتعديل سعر التحويل', true);
ui.editingRateDraftId = null;
renderAll();
openEditDraft(draftId);
return;
}
var res;
res = E.updateDraft(draftId, {
kind: draft.kind,
amountMinor: E.draftAmount(draft),
currency: draft.currency,
accountId: primaryAccountOf(draft),
contraAccountId: contraAccountOf(draft),
rates: rates,
counterparty: draft.counterparty,
memo: draft.memo,
date: draft.date,
dueDate: draft.dueDate
});
if (!res.ok) { toast(res.error, true); ui.editingRateDraftId = null; renderAll(); return; }
toast('تم تحديث سعر التحويل');
ui.editingRateDraftId = null;
renderAll();
}
function showFxGain(btn) {
var draftId = btn.getAttribute('data-draft-id');
var from = btn.getAttribute('data-from');
var to = btn.getAttribute('data-to');
var rateUsed = parseFloat(btn.getAttribute('data-rate'));
var draft = E.findDraft(draftId);
if (!draft) { toast('القيد غير موجود', true); return; }
var line = (draft.lines || []).find(function (l) { return l.currency === from; });
var acc = line ? E.getAccount(line.accountId) : null;
var bal = (acc && E.computeAnalysis().balances && E.computeAnalysis().balances[acc.id]) ? E.computeAnalysis().balances[acc.id] : { native: 0, base: 0 };
var avgRateAccount = (bal.native && bal.native !== 0) ? Math.abs(bal.base / bal.native) : E.getRate(from);
var avgRateToUnits = avgRateAccount / E.getRate(to);
var amtMinor = line ? (line.debit || line.credit || 0) : 0;
var gainLoss = amtMinor * (rateUsed - avgRateToUnits) * E.getRate(to);
var msg = 'فرق الصرف: ' + (gainLoss >= 0 ? '+' : '') + moneyText(Math.round(gainLoss)) +
' (سعر مستخدم ' + Number(rateUsed).toFixed(4) + ' vs متوسط حساب ' + Number(avgRateToUnits).toFixed(4) + ')';
toast(msg);
}
function recordFxGain(btn) {
var draftId = btn.getAttribute('data-draft-id');
var from = btn.getAttribute('data-from');
var to = btn.getAttribute('data-to');
var rateUsed = parseFloat(btn.getAttribute('data-rate'));
var draft = E.findDraft(draftId);
if (!draft) { toast('القيد غير موجود', true); return; }
var line = (draft.lines || []).find(function (l) { return l.currency === from; });
var acc = line ? E.getAccount(line.accountId) : null;
var bal = (acc && E.computeAnalysis().balances && E.computeAnalysis().balances[acc.id]) ? E.computeAnalysis().balances[acc.id] : { native: 0, base: 0 };
var avgRateAccount = (bal.native && bal.native !== 0) ? Math.abs(bal.base / bal.native) : E.getRate(from);
var avgRateToUnits = avgRateAccount / E.getRate(to);
var amtMinor = line ? (line.debit || line.credit || 0) : 0;
var gainLoss = amtMinor * (rateUsed - avgRateToUnits) * E.getRate(to);
var gainLossMinor = Math.round(gainLoss);
if (gainLossMinor === 0) { toast('لا يوجد فرق صرف', true); return; }
var isGain = gainLossMinor > 0;
var fxAmount = Math.abs(gainLossMinor);
var fxMemo = (isGain ? 'ربح' : 'خسارة') + ' صرف: ' + from + ' → ' + to + ' (' + Number(rateUsed).toFixed(4) + ' vs متوسط ' + Number(avgRateToUnits).toFixed(4) + ')';
var newLines = (draft.lines || []).map(function (l) {
return {
accountId: l.accountId,
currency: l.currency,
debitMinor: l.debit,
creditMinor: l.credit,
counterparty: l.counterparty || '',
note: l.note || ''
};
});
if (isGain) {
newLines.push({ accountId: 'cash', currency: E.BASE, debitMinor: fxAmount, creditMinor: 0, counterparty: '', note: fxMemo });
newLines.push({ accountId: 'revenue', currency: E.BASE, debitMinor: 0, creditMinor: fxAmount, counterparty: '', note: fxMemo });
} else {
newLines.push({ accountId: 'expense', currency: E.BASE, debitMinor: fxAmount, creditMinor: 0, counterparty: '', note: fxMemo });
newLines.push({ accountId: 'cash', currency: E.BASE, debitMinor: 0, creditMinor: fxAmount, counterparty: '', note: fxMemo });
}
var res = E.updateDraft(draftId, {
isCompound: true,
kind: 'compound',
lines: newLines,
currency: draft.currency,
rates: null,
counterparty: draft.counterparty,
memo: draft.memo,
date: draft.date,
dueDate: draft.dueDate
});
if (!res.ok) { toast(res.error, true); return; }
toast('تم إضافة ' + (isGain ? 'ربح' : 'خسارة') + ' صرف (' + moneyText(fxAmount) + ') إلى المسودة');
renderAll();
}
function editLineNote(draftId, lineIndex) {
var draft = E.findDraft(draftId);
if (!draft) { toast('القيد المقترح غير موجود', true); return; }
var line = (draft.lines || [])[lineIndex];
if (!line) { toast('السطر غير موجود', true); return; }
var current = line.note || line.counterparty || '';
var val = window.prompt('ملاحظة على هذا السطر (عليكم مقابل / لكم مقابل):', current);
if (val === null) return;
line.note = String(val).trim();
E.saveState();
toast('تم حفظ الملاحظة');
renderAll();
}
function duplicateDraft(id) {
var res = E.duplicateDraft(id);
if (!res.ok) { toast(res.error, true); return; }
pushMessage({ role: 'bot', type: 'draft', draftId: res.draft.id });
E.saveState();
toast('تم نسخ القيد');
renderAll();
}
function liquidAccounts() {
return E.getState().accounts.filter(function (a) { return a.liquid; });
}
function isValueOnlyLine(l) {
return !!l && !(Number(l.debit) || Number(l.credit)) && !!(Number(l.debitBase) || Number(l.creditBase));
}
var VALUE_ONLY_EDIT = 'قيد إعادة التقييم لا يُعدَّل. ألغِه، أو احذفه من الدليل، ثم غيّر السعر من جديد.';
function isMultiLine(d) {
return !!(d && (d.isCompound || d.kind === 'compound' || ((d.lines || []).length > 2 && !E.settlementIntent(d))));
}
function primaryAccountOf(draft) {
var settle = E.settlementIntent(draft);
if (settle) return settle.accountId;
var liquid = liquidAccounts().map(function (a) { return a.id; });
for (var i = 0; i < draft.lines.length; i++) {
if (liquid.indexOf(draft.lines[i].accountId) !== -1) return draft.lines[i].accountId;
}
return draft.lines[0] ? draft.lines[0].accountId : 'cash';
}
function transferAccountsOf(draft) {
var liquid = liquidAccounts().map(function (a) { return a.id; });
var to = null, from = null;
for (var i = 0; i < draft.lines.length; i++) {
var l = draft.lines[i];
if (liquid.indexOf(l.accountId) === -1) continue;
if ((l.debitBase || 0) > 0) to = l.accountId;
else from = l.accountId;
}
return { to: to || 'bank', from: from || 'cash' };
}
function accountOptions(selected) {
return liquidAccounts().map(function (a) {
return '<option value="' + esc(a.id) + '"' + (a.id === selected ? ' selected' : '') + '>' + esc(a.name) + ' (' + esc(accountCurrencyCodes(a)) + ')</option>';
}).join('');
}
function accountOptionsNonLiquid(selected) {
return systemAccounts().map(function (a) {
return '<option value="' + esc(a.id) + '"' + (a.id === selected ? ' selected' : '') + '>' + esc(a.name) + ' (' + esc(accountCurrencyCodes(a)) + ')</option>';
}).join('');
}
function systemAccounts() {
return E.getState().accounts.filter(function (a) { return !a.liquid; });
}
function contraAccountOf(draft) {
var settle = E.settlementIntent(draft);
if (settle) return settle.contraAccountId;
var primary = primaryAccountOf(draft);
for (var i = 0; i < draft.lines.length; i++) {
if (draft.lines[i].accountId !== primary) return draft.lines[i].accountId;
}
return null;
}
function contraOptions(selected) {
return systemAccounts().map(function (a) {
return '<option value="' + esc(a.id) + '"' + (a.id === selected ? ' selected' : '') + '>' + esc(a.name) + '</option>';
}).join('');
}
function defaultContraFor(kind) {
if (kind === 'expense') return 'expense';
if (kind === 'income') return 'revenue';
if (kind === 'lend' || kind === 'collect') return 'receivable';
if (kind === 'borrow' || kind === 'repay') return 'payable';
if (kind === 'capital') return 'capital';
return 'expense';
}
function kindOptions(selected) {
return Object.keys(E.KIND_META).filter(function (k) { return k !== 'exchange'; }).map(function (k) {
return '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + esc(E.KIND_META[k].label) + '</option>';
}).join('');
}
function currencyOptions(selected) {
return E.listCurrencies().map(function (cur) {
var c = cur.code;
return '<option value="' + c + '"' + (c === selected ? ' selected' : '') + '>' + c + '</option>';
}).join('');
}
function openAddCurrency() {
var field = function (id, label, attrs) {
return '<div class="form-row"><label for="' + id + '">' + label + '</label><input id="' + id + '" ' + attrs + ' /></div>';
};
var taken = E.listCurrencies().map(function (c) { return c.code; });
var world = E.WORLD_CURRENCIES.filter(function (c) { return taken.indexOf(c.code) < 0; }).slice().sort(function (a, b) {
var fa = E.isFavoriteCurrency(a.code) ? 0 : 1;
var fb = E.isFavoriteCurrency(b.code) ? 0 : 1;
if (fa !== fb) return fa - fb;
return a.name.localeCompare(b.name, 'ar');
});
openSheet('إضافة وتعديل عملة',
'<div id="curForm"><div class="form-pair"><div class="form-row"><label for="curType">النوع</label><select id="curType">' +
E.currencyTypes.map(function (t) { return '<option value="' + esc(t) + '">' + esc(E.currencyTypeNames[t]) + '</option>'; }).join('') +
'</select></div>' +
'<div class="form-row" id="curPicker"><label for="curWorld">العملة</label>' +
'<div class="currency-search"><input id="curWorld" type="text" autocomplete="off" placeholder="ابحث بالاسم أو الرمز" />' +
'<button type="button" id="curWorldClear" class="currency-clear" aria-label="مسح" hidden>✕</button></div>' +
'<div id="curWorldList" class="currency-list" hidden></div></div></div>' +
'<div class="form-pair narrow-first">' +
field('curCode', 'الرمز', 'type="text" maxlength="3" dir="ltr" placeholder="EGP" autocapitalize="characters"') +
field('curName', 'الاسم في القيود', 'type="text" maxlength="20" placeholder="جنيه"') +
'</div><div class="form-pair">' +
field('curSymbol', 'رمز العرض (اختياري)', 'type="text" maxlength="4" placeholder="€"') +
field('curRate', 'قيمة الوحدة ' + esc(inMainCurrency()), 'type="text" inputmode="none" readonly dir="ltr" placeholder="0.08" class="amount-input" style="cursor:pointer"') +
'</div>' +
'<details class="rate-calc"><summary>حاسبة السعر: 1 وحدة = <span class="amount">' + esc(E.currencySymbol(E.mainCurrency())) + ' ?</span></summary>' +
'<div style="display:flex;gap:4px;align-items:center;margin-top:6px">' +
'<input id="calcForeign" type="number" step="0.01" min="0" dir="ltr" aria-label="مبلغ العملة الأجنبية" placeholder="1" style="flex:1" />' +
'<span style="color:var(--muted)">=</span>' +
'<input id="calcSar" type="number" step="0.01" min="0" dir="ltr" aria-label="المقابل ' + esc(inMainCurrency()) + '" placeholder="0.00" style="flex:1" />' +
'<button class="btn ghost small" type="button" onclick="var f=parseFloat((document.getElementById(' + String.fromCharCode(39) + 'calcForeign' + String.fromCharCode(39) + ')||{}).value);var sar=parseFloat((document.getElementById(' + String.fromCharCode(39) + 'calcSar' + String.fromCharCode(39) + ')||{}).value);if(f>0&&sar>0){(document.getElementById(' + String.fromCharCode(39) + 'curRate' + String.fromCharCode(39) + ')).value=(sar/f).toFixed(4);}">=</button>' +
'</div></details>' +
'<div class="modal-actions">' +
'<button class="btn primary" data-action="save-currency">إضافة</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button>' +
'</div></div>');
var search = document.getElementById('curWorld');
var list = document.getElementById('curWorldList');
var clear = document.getElementById('curWorldClear');
var pickedLabel = '';
var fill = function (c) {
document.getElementById('curCode').value = c ? c.code : '';
document.getElementById('curName').value = c ? c.name : '';
document.getElementById('curSymbol').value = c ? c.symbol : '';
};
var showList = function () {
var typeSel = document.getElementById('curType');
var selectedType = typeSel ? (typeSel.value || 'paper') : 'paper';
var query = search.value === pickedLabel ? '' : E.normalizeAr(search.value).trim().toLowerCase();
var matches = world.filter(function (c) {
if ((c.type || 'paper') !== selectedType) return false;
return !query || E.normalizeAr(c.name).indexOf(query) >= 0 || c.code.toLowerCase().indexOf(query) >= 0;
});
list.innerHTML = matches.map(function (c) {
return '<button type="button" class="currency-option" data-code="' + esc(c.code) + '"><span>' + esc(c.name) + '</span><span class="currency-code" dir="ltr">' + esc(c.code) + '</span></button>';
}).join('') + '<button type="button" class="currency-option manual" data-manual="1">' + (matches.length ? 'إدخال يدوي' : 'لا توجد نتيجة — إدخال يدوي') + '</button>';
list.hidden = false;
};
var syncClear = function () { clear.hidden = !search.value; };
search.addEventListener('focus', showList);
var typeSelEl = document.getElementById('curType');
if (typeSelEl) typeSelEl.addEventListener('change', function () { pickedLabel = ''; fill(null); search.value = ''; syncClear(); showList(); search.focus(); });
search.addEventListener('click', showList);
search.addEventListener('input', function () {
if (pickedLabel) { pickedLabel = ''; fill(null); }
syncClear();
showList();
});
clear.addEventListener('click', function () {
search.value = '';
pickedLabel = '';
fill(null);
syncClear();
search.focus();
showList();
});
list.addEventListener('click', function (ev) {
var option = ev.target.closest('.currency-option');
if (!option) return;
var picked = world.filter(function (c) { return c.code === option.getAttribute('data-code'); })[0];
list.hidden = true;
if (picked) {
pickedLabel = picked.name + ' — ' + picked.code;
search.value = pickedLabel;
fill(picked);
syncClear();
document.getElementById('curRate').focus();
return;
}
var typed = search.value.trim();
document.getElementById(/^[a-z]{3}$/i.test(typed) ? 'curCode' : 'curName').value = /^[a-z]{3}$/i.test(typed) ? typed.toUpperCase() : typed;
search.value = '';
pickedLabel = '';
syncClear();
document.getElementById('curCode').focus();
});
var closeOutside = function (ev) {
if (!ev.target.closest('#curPicker')) list.hidden = true;
};
document.getElementById('curForm').addEventListener('click', closeOutside);
document.getElementById('curForm').addEventListener('focusin', closeOutside);
}
function saveCurrency() {
var val = function (id) { return (document.getElementById(id) || {}).value || ''; };
if (val('curCode') && !(parseFloat(val('curRate')) > 0)) {
toast('اكتب قيمة الوحدة ' + inMainCurrency(), true);
document.getElementById('curRate').focus();
return;
}
var res = E.addCurrency({ code: val('curCode'), name: val('curName'), symbol: val('curSymbol'), type: val('curType'), rate: E.rateFromMain(parseFloat(val('curRate'))) });
if (!res.ok) { toast(res.error, true); return; }
var then = ui.afterAddCurrency;
closeSheet();
toast('تمت إضافة ' + res.code);
if (then) then(res.code);
renderAll();
}
function openEditCurrency(code) {
var cur = E.listCurrencies().filter(function (c) { return c.code === code; })[0];
if (!cur) { toast('العملة غير موجودة', true); return; }
var field = function (id, label, attrs) {
return '<div class="form-row"><label for="' + id + '">' + label + '</label><input id="' + id + '" ' + attrs + ' /></div>';
};
openSheet('إضافة وتعديل عملة — ' + code,
(cur.builtIn ? '' :
'<div class="form-pair">' +
field('curName', 'الاسم في القيود', 'type="text" maxlength="20" value="' + esc(cur.name) + '"') +
field('curSymbol', 'رمز العرض', 'type="text" maxlength="4" value="' + esc(cur.symbol) + '"') +
'</div>' +
'<div class="form-row"><label for="curType">النوع</label><select id="curType">' +
E.currencyTypes.map(function (t) { return '<option value="' + esc(t) + '"' + (cur.type === t ? ' selected' : '') + '>' + esc(E.currencyTypeNames[t]) + '</option>'; }).join('') +
'</select></div>') +
field('curRate', 'قيمة الوحدة ' + (code === E.mainCurrency() ? 'بالريال السعودي' : esc(inMainCurrency())), 'type="text" inputmode="none" readonly dir="ltr" class="amount-input" style="cursor:pointer" value="' + esc(String(code === E.mainCurrency() ? cur.rate : E.rateAgainstMain(code))) + '"') +
'<p class="modal-note">السعر الجديد للقيود القادمة فقط، ولا يغيّر القيود المسجلة.</p>' +
'<div class="modal-actions">' +
'<button class="btn primary" data-action="save-edit-currency" data-id="' + code + '">حفظ</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button>' +
'</div>');
}
function offerRevaluation(codes) {
codes = (codes || []).filter(Boolean);
if (!codes.length) return;
var items = E.revaluationPreview(codes);
if (!items.length) return;
ux('reval.offer');
var net = items.reduce(function (s, it) { return s + it.diff; }, 0);
var names = items.map(function (it) {
var acc = E.getAccount(it.accountId);
return '• ' + (acc ? acc.name : it.accountId) + ': ' + moneyText(it.native, it.currency) + ' — من ' + moneyText(it.base) + ' إلى ' + moneyText(it.target);
});
pushMessage({ role: 'bot', type: 'text',
text: 'تغيّر سعر ' + codes.map(currencyName).join('، ') + '. هل تريد تقييم الأرصدة الأجنبية بالمعادل الجديد؟\n' + names.join('\n') +
'\n' + (net >= 0 ? 'ربح فرق صرف ' + moneyText(net) : 'خسارة فرق صرف ' + moneyText(-net)),
data: { choices: [
{ label: 'نعم، أعد التقييم', action: 'reval-yes', name: codes.join(','), text: '' },
{ label: 'لا', action: 'reval-no', name: '', text: '' }
] } });
E.saveState();
if (ui.tab !== 'bot') setTab('bot');
renderAll();
}
function saveEditCurrency(code) {
var val = function (id) { return (document.getElementById(id) || {}).value || ''; };
var typed = parseFloat(val('curRate'));
if ((code === 'YER' || code === 'YRO') && E.mainCurrency() === 'SAR' && typed > 10) {
typed = 1 / typed;
}
var cur = E.listCurrencies().filter(function (c) { return c.code === code; })[0];
var rate = !cur || code === E.mainCurrency() ? typed : typed === E.rateAgainstMain(code) ? cur.rate : E.rateFromMain(typed);
var rateBefore = E.getRate(code);
var res = E.editCurrency(code, { name: val('curName'), symbol: val('curSymbol'), type: val('curType'), rate: rate });
if (!res.ok) { toast(res.error, true); return; }
closeSheet();
toast('تم تعديل ' + code);
renderAll();
if (E.getRate(code) !== rateBefore) offerRevaluation([code]);
}
function openCurrencyHistory(code) {
var list = E.currencyHistory(code);
openSheet('سجل أسعار ' + code,
(list.length
? list.map(function (h) {
var when = new Date(h.at);
var local = isNaN(when.getTime()) ? h.at.slice(0, 10) :
when.getFullYear() + '-' + ('0' + (when.getMonth() + 1)).slice(-2) + '-' + ('0' + when.getDate()).slice(-2);
return row(esc(E.fmtDate(local)), '<span class="amount" dir="ltr">' + esc(String(h.from)) + ' → ' + esc(String(h.to)) + '</span>');
}).join('')
: '<p class="modal-note">لم يتغير السعر منذ تفعيل السجل.</p>') +
'<div class="modal-actions" style="margin-top:12px">' +
'<button class="btn ghost" data-action="modal-cancel">إغلاق</button></div>');
}
function removeCurrencyUI(code) {
askConfirm('حذف العملة', 'ستُحذف العملة ' + code + ' من القوائم، ولن تُقبل في القيود الجديدة. يمكنك إضافتها لاحقاً.', function () {
var res = E.removeCurrency(code);
closeSheet();
if (res.ok) toast('تم حذف ' + code);
else toast(res.error, true);
});
}
function openEditDraft(id) {
var isNew = id === 'new';
var draft = isNew
? { kind: 'expense', date: E.todayISO(), dueDate: null, currency: E.mainCurrency(), memo: '', lines: [] }
: E.findDraft(id);
if (!draft) { toast('القيد المقترح غير موجود', true); return; }
if (!isNew && (draft.lines || []).some(isValueOnlyLine)) { toast(VALUE_ONLY_EDIT, true); return; }
if (!isNew) ux('draft.edit');
if (!isNew && draft.kind === 'exchange') {
openExchangeSheet(draft);
return;
}
if (!isNew && isMultiLine(draft)) {
openEditCompoundDraft(id);
return;
}
window.__editDraftId = id;
var pf = window.__pendingEditFields || null;
window.__pendingEditFields = null;
var amountMajor = (window.__pendingAmount != null)
? window.__pendingAmount
: isNew ? '' : (E.draftAmount(draft) / 100).toFixed(2);
window.__pendingAmount = null;
var effKind = (pf && pf.kind) || draft.kind;
var effDate = (pf && pf.date != null) ? pf.date : (draft.date || '');
var effDue = (pf && pf.dueDate != null) ? pf.dueDate : (draft.dueDate || '');
var effCur = (pf && pf.currency) || draft.currency;
var primary = (pf && pf.account) || primaryAccountOf(draft);
var tr = transferAccountsOf(draft);
if (pf && pf.from) tr.from = pf.from;
if (pf && pf.to) tr.to = pf.to;
var effContra = (pf && pf.contra) || contraAccountOf(draft) || defaultContraFor(effKind);
var effMemo = (pf && pf.memo != null) ? pf.memo : (draft.memo || '');
var effNote = (pf && pf.note != null) ? pf.note : ((draft.lines && draft.lines[0] && draft.lines[0].note) || '');
var isTransfer = effKind === 'transfer' || effKind === 'settlement';
var isSettlement = effKind === 'settlement';
var isDebt = effKind === 'lend' || effKind === 'borrow';
openSheet(isNew ? 'قيد جديد' : 'تعديل القيد المقترح',
'<div class="form-pair edit-top">' +
'<div class="form-row"><label for="edit-kind">نوع القيد</label>' +
'<select id="edit-kind">' + kindOptions(effKind) + '</select></div>' +
'<div class="form-row"><label for="edit-date">التاريخ</label>' +
'<input id="edit-date" type="date" dir="ltr" value="' + esc(effDate) + '" /></div>' +
'<div class="form-row" id="edit-due-row" style="display:' + (isDebt ? '' : 'none') + ';background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:10px;padding:8px 10px">' +
'<label for="edit-due">الاستحقاق</label>' +
'<input id="edit-due" type="date" dir="ltr" value="' + esc(effDue) + '" /></div>' +
'</div>' +
'<div id="edit-due-hint" class="edit-hint" style="display:' + (isDebt ? '' : 'none') + '">إن تركت الاستحقاق فارغاً فيكون بعد ' + esc(E.getState().settings.defaultDueDays || 3) + ' أيام من التاريخ.</div>' +
'<div class="form-pair wide-first" id="edit-amount-pair">' +
'<div class="form-row"><label for="edit-amount">المبلغ</label>' +
'<input id="edit-amount" type="text" inputmode="none" readonly class="amount-input" style="cursor:pointer" placeholder="' + (isNew ? 'اضغط لكتابة المبلغ' : '') + '" value="' + esc(amountMajor) + '" /></div>' +
'<div id="edit-amount-err" class="field-err" style="display:none;color:var(--danger,#e53935);font-size:calc(10.5px * var(--font-scale,1));margin-top:2px"></div>' +
'<div id="edit-rate-row" class="form-row" hidden><label for="edit-rate">سعر التحويل</label>' +
'<input id="edit-rate" type="text" inputmode="decimal" dir="ltr" autocomplete="off" style="padding:6px 8px;border:1px solid var(--line-strong);border-radius:6px;text-align:center;font-size:calc(12px * var(--font-scale,1));background:var(--paper)" /></div>' +
'<div class="form-row"><label for="edit-currency">العملة</label>' +
'<select id="edit-currency">' + currencyOptions(effCur) + '</select></div>' +
'</div>' +
'<div id="edit-equiv" class="edit-equiv" hidden></div><div class="form-pair with-swap">' +
'<div class="form-row" id="edit-account-row" style="display:' + (isTransfer ? 'none' : '') + '">' +
'<label for="edit-account">الحساب</label>' +
'<select id="edit-account">' + accountOptions(primary) + '</select></div>' +
'<button type="button" class="swap-btn" id="edit-swap" style="display:' + (isTransfer ? 'none' : '') + '" title="تبديل الاتجاه" aria-label="تبديل الاتجاه">⇄</button>' +
'<div class="form-row" id="edit-contra-row" style="display:' + (isTransfer ? 'none' : '') + '">' +
'<label for="edit-contra">الحساب المقابل</label>' +
'<div class="select-with-add">' +
'<select id="edit-contra">' + contraOptions(effContra) + '</select>' +
'<button class="btn ghost small" data-action="new-contra-account" title="حساب جديد" aria-label="حساب جديد">＋</button>' +
'</div></div>' +
'</div>' +
'<div id="edit-transfer-rows" class="form-pair with-swap" style="display:' + (isTransfer ? '' : 'none') + '">' +
'<div class="form-row">' +
'<label for="edit-from">من حساب</label>' +
'<select id="edit-from">' + (isSettlement ? accountOptionsNonLiquid(tr.from) : accountOptions(tr.from)) + '</select></div>' +
'<button type="button" class="swap-btn" id="edit-swap-transfer" title="تبديل الاتجاه" aria-label="تبديل الاتجاه">⇄</button>' +
'<div class="form-row">' +
'<label for="edit-to">إلى حساب</label>' +
'<select id="edit-to">' + (isSettlement ? accountOptionsNonLiquid(tr.to) : accountOptions(tr.to)) + '</select></div>' +
'</div>' +
'<div class="form-fill">' +
'<div class="form-row">' +
'<label for="edit-memo">السرد</label>' +
'<div class="memo-field">' +
'<input id="edit-memo" type="text" placeholder="' + (isNew ? 'مثال: دفعت إيجار المكتب' : '') + '" value="' + esc(effMemo) + '" />' +
'<button type="button" class="memo-attach" id="edit-attach" title="إرفاق صورة" aria-label="إرفاق صورة">📎</button>' +
'</div>' +
'<input id="edit-note" type="text" placeholder="ملاحظة (اختياري)" value="' + esc(effNote) + '" style="margin-top:4px;font-size: calc(12px * var(--font-scale, 1))" />' +
'<div class="edit-hint">تظهر الملاحظة مع سطر القيد في الدليل والتقارير.</div>' +
'</div>' +
'</div>' +
'<div class="modal-actions">' +
'<button class="btn primary" data-action="save-edit-draft" data-id="' + esc(id) + '">' + (isNew ? 'إنشاء المسودة' : 'حفظ التعديلات') + '</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button>' +
'</div>');
els.modal.classList.add('see-through', 'see-85', 'compact', 'edit-sheet');
memoAttachment = null;
var memoAttachBtn = document.getElementById('edit-attach');
if (memoAttachBtn) memoAttachBtn.addEventListener('click', function () {
attachTarget = 'memo';
document.getElementById('attachInput').click();
});
var amtInput = document.getElementById('edit-amount');
if (amtInput) {
amtInput.addEventListener('click', function () {
var ri = document.getElementById('edit-rate');
window.__pendingRate = ri && ri.dataset.pair ? { pair: ri.dataset.pair, value: ri.value } : null;
window.__pendingEditFields = {
kind: (document.getElementById('edit-kind') || {}).value,
date: (document.getElementById('edit-date') || {}).value,
dueDate: (document.getElementById('edit-due') || {}).value,
currency: (document.getElementById('edit-currency') || {}).value,
account: (document.getElementById('edit-account') || {}).value,
contra: (document.getElementById('edit-contra') || {}).value,
from: (document.getElementById('edit-from') || {}).value,
to: (document.getElementById('edit-to') || {}).value,
memo: (document.getElementById('edit-memo') || {}).value,
note: (document.getElementById('edit-note') || {}).value
};
openNumpad('edit-amount');
});
}
var rateInput = document.getElementById('edit-rate');
if (rateInput) rateInput.addEventListener('input', showEditEquivalent);
var OPPOSITE = { lend: 'borrow', borrow: 'lend', collect: 'repay', repay: 'collect', expense: 'income', income: 'expense' };
var swapKind = function () {
var ks = document.getElementById('edit-kind');
var to = OPPOSITE[ks.value];
if (!to) { toast('هذا النوع ليس له اتجاه معاكس', true); return; }
ks.value = to;
ks.dispatchEvent(new Event('change'));
toast('صار القيد: ' + kindMeta(to).label);
};
var swapTransfer = function () {
var f = document.getElementById('edit-from'), t = document.getElementById('edit-to');
var v = f.value; f.value = t.value; t.value = v;
showEditEquivalent();
};
document.getElementById('edit-swap').addEventListener('click', swapKind);
document.getElementById('edit-swap-transfer').addEventListener('click', swapTransfer);
['edit-currency', 'edit-account', 'edit-contra', 'edit-from', 'edit-to', 'edit-kind'].forEach(function (fid) {
var f = document.getElementById(fid);
if (f) f.addEventListener('change', function () { setTimeout(showEditEquivalent, 0); });
});
showEditEquivalent();
var kindSel = document.getElementById('edit-kind');
if (kindSel) {
kindSel.addEventListener('change', function () {
var k = kindSel.value;
var trf = k === 'transfer' || k === 'settlement';
var isSet = k === 'settlement';
var debt = k === 'lend' || k === 'borrow';
var ar = document.getElementById('edit-account-row');
var cr = document.getElementById('edit-contra-row');
var tr = document.getElementById('edit-transfer-rows');
var dr = document.getElementById('edit-due-row');
var dh = document.getElementById('edit-due-hint');
if (dh) dh.style.display = debt ? '' : 'none';
if (ar) ar.style.display = trf ? 'none' : '';
if (cr) cr.style.display = trf ? 'none' : '';
document.getElementById('edit-swap').style.display = trf ? 'none' : '';
if (tr) tr.style.display = trf ? '' : 'none';
if (dr) dr.style.display = debt ? '' : 'none';
var fromSel = document.getElementById('edit-from');
var toSel = document.getElementById('edit-to');
if (fromSel) {
var prevFrom = fromSel.value;
fromSel.innerHTML = (isSet ? accountOptionsNonLiquid(prevFrom) : accountOptions(prevFrom));
}
if (toSel) {
var prevTo = toSel.value;
toSel.innerHTML = (isSet ? accountOptionsNonLiquid(prevTo) : accountOptions(prevTo));
}
var amt = document.getElementById('edit-amount');
if (amt) amt.focus();
});
}
}
function currencyName(code) {
var c = E.listCurrencies().filter(function (x) { return x.code === code; })[0];
var name = c ? c.name : code;
if (code === 'SAR' && name === 'ريال') return 'ريال سعودي (SAR)';
if (code === 'YER' && name === 'ريال') return 'ريال يمني (YER)';
if (code === 'OMR' && name === 'ريال') return 'ريال عماني (OMR)';
if (code === 'QAR' && name === 'ريال') return 'ريال قطري (QAR)';
if (code === 'IRR' && name === 'ريال') return 'ريال إيراني (IRR)';
return name;
}
function fxText(x) {
if (!x) return '';
return (x > 0 ? 'ربح فرق صرف ' : 'خسارة فرق صرف ') + moneyText(Math.abs(x));
}
function rateText(lines) {
var x = E.linesExchange(lines);
if (!x) return '';
return 'سعر التحويل: 1 ' + currencyName(x.from) + ' = ' + Number(x.rate).toLocaleString('en-US', { maximumFractionDigits: 4 }) + ' ' + currencyName(x.to);
}
function editField(id) {
var el = document.getElementById(id);
return el && el.offsetParent !== null ? el.value : '';
}
function editPair() {
var cur = (document.getElementById('edit-currency') || {}).value || E.BASE;
var codes = [cur];
['edit-account', 'edit-contra', 'edit-from', 'edit-to'].forEach(function (id) {
var acc = E.getAccount(editField(id));
if (acc && !acc.multi && codes.indexOf(acc.currency) < 0) codes.push(acc.currency);
});
if (codes.length !== 2) return null;
var a = codes[0], b = codes[1];
if (E.getRate(a) < E.getRate(b)) { var t = a; a = b; b = t; }
return { cur: cur, a: a, b: b, key: a + '>' + b };
}
function fmtRate(n) {
var v = Number(n);
if (!isFinite(v)) return String(n);
var dec;
if (v < 1) dec = 5;
else if (v > 10) dec = 0;
else dec = 2;
return String(Number(v.toFixed(dec)));
}
function editRates() {
var pair = editPair();
var input = document.getElementById('edit-rate') || {};
var x = parseFloat(String(input.value || '').replace(/,/g, ''));
if (input.dataset && input.value === input.dataset.shown) x = Number(input.dataset.exact);
if (!pair || !(x > 0)) return null;
var rates = {};
if (pair.b !== E.BASE) rates[pair.b] = E.getRate(pair.a) / x;
else rates[pair.a] = x;
return rates;
}
function keptDraftRates(draft, currency) {
if (!draft || !currency || currency === E.BASE || currency !== draft.currency) return null;
var settle = E.settlementIntent(draft);
if (settle) return settle.rates && settle.rates[currency] ? settle.rates : null;
var line = (draft.lines || []).filter(function (l) { return l.currency === currency && Number(l.rate) > 0; })[0];
if (!line) return null;
var out = {};
out[currency] = Number(line.rate);
return out;
}
function showEditEquivalent() {
var box = document.getElementById('edit-equiv');
var row = document.getElementById('edit-rate-row');
var input = document.getElementById('edit-rate');
if (!box || !row || !input) return;
var pair = editPair();
row.hidden = !pair;
document.getElementById('edit-amount-pair').classList.toggle('with-rate', !!pair);
if (pair && input.dataset.pair !== pair.key) {
var pending = window.__pendingRate;
window.__pendingRate = null;
var draft = E.findDraft(window.__editDraftId);
var had = draft && E.linesExchange(draft.lines);
var exact = had && had.from === pair.a && had.to === pair.b ? had.rate : E.getRate(pair.a) / E.getRate(pair.b);
input.dataset.pair = pair.key;
input.dataset.exact = String(exact);
input.dataset.shown = fmtRate(exact);
input.value = pending && pending.pair === pair.key ? pending.value : fmtRate(exact);
input.title = '1 ' + currencyName(pair.a) + ' = ? ' + currencyName(pair.b);
}
var rates = editRates() || {};
var rateOf = function (code) { return rates[code] || E.getRate(code); };
var amountMinor = Math.round((parseFloat(String((document.getElementById('edit-amount') || {}).value || '').replace(/,/g, '')) || 0) * 100);
var cur = (document.getElementById('edit-currency') || {}).value || E.BASE;
var base = Math.round(amountMinor * rateOf(cur));
var seen = {};
var parts = [];
['edit-account', 'edit-contra', 'edit-from', 'edit-to'].forEach(function (id) {
var acc = E.getAccount(editField(id));
if (!acc || acc.multi || acc.currency === cur || seen[acc.currency]) return;
seen[acc.currency] = true;
parts.push('المعادل: ' + moneyText(Math.round(base / rateOf(acc.currency)), acc.currency) + ' (' + esc(acc.name) + ')');
});
if (cur !== E.BASE) parts.push('بالعملة الأساسية (' + E.BASE + '): ' + moneyText(base, E.BASE));
var typed = parseFloat(String(input.value || '').replace(/,/g, ''));
if (pair && typed > 0) parts.unshift('1 ' + esc(currencyName(pair.a)) + ' = ' + esc(input.value) + ' ' + esc(currencyName(pair.b)));
box.innerHTML = parts.join('<br>');
box.hidden = !parts.length || !(amountMinor > 0);
}
window.openNumpad = function (inputId) { try { openNumpad(inputId); } catch (e) { console.error('[Numpad]', e); } };
function openNumpad(inputId) {
var input = (typeof inputId === 'string') ? document.getElementById(inputId) : inputId;
if (!input) return;
if (input.blur) input.blur();
if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
var current = String(input.value || '').trim();
window.__numpadValue = current;
window.__numpadInput = input.id || inputId;
window.__numpadFresh = true;
window.__calcAcc = null;
window.__calcOp = null;
if (document.getElementById('compound-lines')) {
syncCompoundLinesFromDom();
window.__numpadCompoundIdx = input.hasAttribute('data-index') ? Number(input.getAttribute('data-index')) : null;
} else {
window.__numpadCompoundIdx = null;
}
if (!input.id) input.id = 'numpad_' + Date.now();
inputId = input.id;
var isRateField = inputId === 'curRate';
var numpadCurCode = E.mainCurrency ? E.mainCurrency() : E.BASE;
if (isRateField) {
var curCodeInp = document.getElementById('curCode');
var saveCurBtn = document.querySelector('[data-action="save-edit-currency"]');
numpadCurCode = (curCodeInp && curCodeInp.value) || (saveCurBtn && saveCurBtn.getAttribute('data-id')) || numpadCurCode;
} else if (window.__numpadCompoundIdx != null && window.__editCompoundLines && window.__editCompoundLines[window.__numpadCompoundIdx]) {
numpadCurCode = window.__editCompoundLines[window.__numpadCompoundIdx].currency || numpadCurCode;
} else {
var editCurSel = document.getElementById('edit-currency');
if (editCurSel && editCurSel.value) numpadCurCode = editCurSel.value;
}
var curListAll = E.listCurrencies ? E.listCurrencies() : [];
var activeCurObj = curListAll.filter(function (c) { return c && c.code === numpadCurCode; })[0];
var defaultDec = 2;
if (activeCurObj && activeCurObj.type === 'crypto') defaultDec = 6;
else if (isRateField || (activeCurObj && activeCurObj.type === 'metal')) defaultDec = 4;
if (current && current.indexOf('.') >= 0) {
var fracLen = current.split('.')[1].length;
if (fracLen > 4) defaultDec = 6;
else if (fracLen > 2) defaultDec = 4;
}
window.__numpadDecimals = defaultDec;
window.__numpadCurInputState = null;
if (isRateField) {
var saveEditBtn = document.querySelector('[data-action="save-edit-currency"]');
window.__numpadCurInputState = {
mode: saveEditBtn ? 'edit' : 'add',
code: (saveEditBtn && saveEditBtn.getAttribute('data-id')) || ((document.getElementById('curCode') || {}).value || ''),
name: (document.getElementById('curName') || {}).value || '',
symbol: (document.getElementById('curSymbol') || {}).value || '',
type: (document.getElementById('curType') || {}).value || 'paper'
};
} else if (inputId === 'settle-amount') {
var settleBtn = document.querySelector('[data-action="confirm-settle-partial"]');
window.__numpadCurInputState = {
mode: 'settle',
dueId: settleBtn ? settleBtn.getAttribute('data-id') : null,
accountId: (document.getElementById('settle-account') || {}).value || 'cash'
};
}
function fmtNumpadNumber(num) {
var n = Number(num);
if (!isFinite(n)) return '0';
var d = window.__numpadDecimals || 2;
var f = Math.pow(10, d);
var rounded = Math.round(n * f) / f;
return String(Number(rounded.toFixed(d)));
}
window.__fmtNumpadNumber = fmtNumpadNumber;
if (current && isFinite(Number(current)) && current !== '') {
current = fmtNumpadNumber(current);
window.__numpadValue = current;
}
var fxList = (E.listCurrencies ? E.listCurrencies() : []).filter(function (c) { return c && c.code !== E.BASE; });
var defaultRateVal = fxList.length ? (E.getRate(fxList[0].code) || 1) : 3.75;
var defaultDispRate = defaultRateVal < 0.5 && defaultRateVal > 0 ? +(1 / defaultRateVal).toFixed(2) : +Number(defaultRateVal).toFixed(4);
var rateChipsHtml = fxList.map(function (c) {
var r = E.getRate(c.code) || 1;
var weaker = r < 0.5 && r > 0;
var dispR = weaker ? +(1 / r).toFixed(2) : +Number(r).toFixed(4);
var flag = E.currencyFlag ? E.currencyFlag(c.code) : '';
return '<button type="button" class="chip" data-numpad-cur="' + esc(c.code) + '" data-numpad-rate="' + esc(String(r)) + '" data-numpad-disp="' + esc(String(dispR)) + '" data-numpad-weaker="' + (weaker ? '1' : '0') + '" style="font-size:calc(11px * var(--font-scale,1));padding:3px 8px">' +
esc((flag ? flag + ' ' : '') + c.code + ' @ ' + dispR) + '</button>';
}).join('');
var decPillsHtml = [2, 4, 6].map(function (d) {
var active = window.__numpadDecimals === d;
return '<button type="button" class="chip' + (active ? ' active' : '') + '" data-numpad-dec="' + d + '" style="font-size:calc(10.5px * var(--font-scale,1));padding:2px 8px;min-height:22px">' + d + ' كسور</button>';
}).join('');
openSheet('آلة حاسبة',
'<div class="numpad-display" id="numpadDisplay">' + esc(current || '0') + '</div>' +
'<div id="numpadDecRow" style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin:-4px 0 6px">' +
'<span class="muted" style="font-size:calc(10.5px * var(--font-scale,1))">الكسور العشرية (' + esc(numpadCurCode || E.BASE) + '):</span>' +
'<div style="display:flex;gap:4px">' + decPillsHtml + '</div>' +
'</div>' +
'<div id="numpadRateHint" class="muted" style="font-size:calc(11px * var(--font-scale,1));text-align:center;min-height:16px;margin-bottom:4px"></div>' +
'<div id="numpadRatesBox" style="background:var(--card-bg,rgba(0,0,0,.04));border:1px solid var(--line);border-radius:10px;padding:6px 8px;margin-bottom:8px">' +
'<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;margin-bottom:6px">' +
'<span style="font-size:calc(11px * var(--font-scale,1));font-weight:700;color:var(--muted)">أسعار الصرف (@ ' + esc(E.BASE) + '):</span>' +
'<div style="display:flex;align-items:center;gap:4px">' +
'<input id="numpadRateInput" type="text" inputmode="decimal" dir="ltr" value="' + esc(String(defaultDispRate)) + '" placeholder="سعر الصرف" style="width:74px;padding:3px 6px;border:1px solid var(--line-strong);border-radius:6px;text-align:center;font-size:calc(11.5px * var(--font-scale,1));background:var(--paper);color:var(--ink)" />' +
'<button type="button" class="btn ghost small" id="numpadRateMul" title="ضرب في سعر الصرف (عملة أقوى ← أساسية)" style="padding:2px 7px;min-height:26px;font-size:calc(11px * var(--font-scale,1))">× سعر</button>' +
'<button type="button" class="btn ghost small" id="numpadRateDiv" title="قسمة على سعر الصرف (عملة أضعف ← أساسية)" style="padding:2px 7px;min-height:26px;font-size:calc(11px * var(--font-scale,1))">÷ سعر</button>' +
'</div>' +
'</div>' +
(rateChipsHtml ? '<div class="chips" style="display:flex;gap:4px;flex-wrap:wrap">' + rateChipsHtml + '</div>' : '') +
'</div>' +
'<div class="numpad-grid">' +
['7','8','9','÷','4','5','6','×','1','2','3','-','0','.','=','+','%','±'].map(function (k) {
return '<button class="numpad-key' + (['÷','×','-','+','=','%','±'].indexOf(k) >= 0 ? ' op' : '') + '" data-key="' + esc(k) + '">' + esc(k) + '</button>';
}).join('') +
'<button class="numpad-key wide" data-key="⌫">⌫</button>' +
'</div>' +
'<div class="modal-actions">' +
'<button class="btn ghost" data-action="numpad-clear">مسح</button>' +
'<button class="btn primary" data-action="numpad-ok">تأكيد</button>' +
'</div>');
var disp = document.getElementById('numpadDisplay');
var hintEl = document.getElementById('numpadRateHint');
var rateInp = document.getElementById('numpadRateInput');
function updateDisp() { if (disp) disp.textContent = window.__numpadValue || '0'; }
var decRow = document.getElementById('numpadDecRow');
if (decRow) {
decRow.addEventListener('click', function (ev) {
var decBtn = ev.target.closest('[data-numpad-dec]');
if (!decBtn) return;
var nextDec = Number(decBtn.getAttribute('data-numpad-dec')) || 2;
window.__numpadDecimals = nextDec;
Array.prototype.forEach.call(decRow.querySelectorAll('[data-numpad-dec]'), function (b) {
b.classList.toggle('active', Number(b.getAttribute('data-numpad-dec')) === nextDec);
});
if (window.__numpadValue && isFinite(Number(window.__numpadValue))) {
window.__numpadValue = fmtNumpadNumber(window.__numpadValue);
updateDisp();
}
});
}
function applyRateConversion(mode, labelCur) {
var curVal = parseFloat(window.__numpadValue || '0');
if (window.__calcOp && window.__calcAcc !== null) {
curVal = applyOp(window.__calcAcc, curVal, window.__calcOp);
window.__calcAcc = null;
window.__calcOp = null;
}
var rTyped = parseFloat(String((rateInp && rateInp.value) || '').replace(/,/g, ''));
if (!(rTyped > 0) || !isFinite(rTyped)) { toast('أدخل سعر صرف صحيح', true); return; }
if (!(curVal > 0)) {
window.__numpadValue = fmtNumpadNumber(rTyped);
window.__numpadFresh = false;
updateDisp();
return;
}
var converted = mode === 'div' ? (curVal / rTyped) : (curVal * rTyped);
converted = Number(fmtNumpadNumber(converted));
if (hintEl) {
hintEl.textContent = curVal + (labelCur ? ' ' + labelCur : '') + (mode === 'div' ? ' ÷ ' : ' × ') + rTyped + ' = ' + converted + ' ' + E.BASE;
}
window.__numpadValue = String(converted);
window.__numpadFresh = true;
updateDisp();
}
var ratesBox = document.getElementById('numpadRatesBox');
if (ratesBox) {
ratesBox.addEventListener('click', function (ev) {
var chip = ev.target.closest('[data-numpad-cur]');
if (chip) {
var cCode = chip.getAttribute('data-numpad-cur');
var dispR = chip.getAttribute('data-numpad-disp');
var weaker = chip.getAttribute('data-numpad-weaker') === '1';
if (rateInp && dispR) rateInp.value = dispR;
applyRateConversion(weaker ? 'div' : 'mul', cCode);
return;
}
if (ev.target.closest('#numpadRateMul')) { applyRateConversion('mul', ''); return; }
if (ev.target.closest('#numpadRateDiv')) { applyRateConversion('div', ''); return; }
});
}
var grid = document.querySelector('.numpad-grid');
if (grid) {
grid.addEventListener('click', function (ev) {
var btn = ev.target.closest('[data-key]');
if (!btn) return;
var k = btn.getAttribute('data-key');
var v = window.__numpadValue || '';
if (k === '÷' || k === '×' || k === '-' || k === '+') {
var num = parseFloat(v) || 0;
if (window.__calcAcc === null) window.__calcAcc = num;
else if (window.__calcOp) {
window.__calcAcc = applyOp(window.__calcAcc, num, window.__calcOp);
} else window.__calcAcc = num;
window.__calcOp = k;
window.__numpadValue = '';
window.__numpadFresh = true;
updateDisp();
return;
}
if (k === '=') {
var num2 = parseFloat(v) || 0;
if (window.__calcOp) {
var res = applyOp(window.__calcAcc === null ? 0 : window.__calcAcc, num2, window.__calcOp);
window.__numpadValue = fmtNumpadNumber(res);
window.__calcAcc = null;
window.__calcOp = null;
window.__numpadFresh = true;
updateDisp();
}
return;
}
if (k === '%') {
var numPct = parseFloat(v) || 0;
if (window.__calcAcc !== null && window.__calcOp) {
var pctVal = window.__calcAcc * (numPct / 100);
window.__numpadValue = fmtNumpadNumber(window.__calcAcc + pctVal);
} else {
window.__numpadValue = fmtNumpadNumber(numPct / 100);
}
window.__numpadFresh = true;
updateDisp();
return;
}
if (k === '±') {
var numSign = parseFloat(v) || 0;
window.__numpadValue = String(-numSign);
window.__numpadFresh = false;
updateDisp();
return;
}
if (k === '⌫') { v = v.slice(0, -1); window.__numpadFresh = false; }
else if (k === '.') {
if (window.__numpadFresh && v) { v = '0.'; window.__numpadFresh = false; }
else if (v.indexOf('.') === -1) v = (v || '0') + '.';
} else {
if (window.__numpadFresh) { v = k; window.__numpadFresh = false; }
else if (v === '0') v = k;
else {
var dotIdx = v.indexOf('.');
var maxDec = window.__numpadDecimals || 2;
if (dotIdx === -1 || (v.length - dotIdx - 1) < maxDec) v += k;
}
}
window.__numpadValue = v;
updateDisp();
});
}
}
function applyOp(a, b, op) {
if (op === '+') return a + b;
if (op === '-') return a - b;
if (op === '×') return a * b;
if (op === '÷') return b !== 0 ? a / b : 0;
return b;
}
function accountOptionsAll(selected) {
return (E.getState().accounts || []).map(function (a) {
return '<option value="' + esc(a.id) + '"' + (a.id === selected ? ' selected' : '') + '>' + esc(a.name) + ' (' + esc(accountCurrencyCodes(a)) + ')</option>';
}).join('');
}
function syncCompoundLinesFromDom() {
var dEl = document.getElementById('cedit-date');
var dueEl = document.getElementById('cedit-due');
var cpEl = document.getElementById('cedit-counterparty');
var mEl = document.getElementById('cedit-memo');
if (dEl) window.__editCompoundDate = dEl.value;
if (dueEl) window.__editCompoundDueDate = dueEl.value;
if (cpEl) window.__editCompoundCounterparty = cpEl.value;
if (mEl) window.__editCompoundMemo = mEl.value;
var sels = document.querySelectorAll('.cline-account');
var lines = window.__editCompoundLines || [];
var next = [];
sels.forEach(function (sel) {
var idx = Number(sel.getAttribute('data-index'));
var old = lines[idx] || {};
var sideSel = document.querySelector('.cline-side[data-index="' + idx + '"]');
var amtInput = document.querySelector('.cline-amount[data-index="' + idx + '"]');
var amt = parseFloat(String((amtInput && amtInput.value) || '').replace(/,/g, '')) || 0;
var acc = E.getAccount(sel.value);
var currency = old.currency || (acc && !acc.multi ? acc.currency : E.BASE);
var rate = old.rate || E.getRate(currency);
next[idx] = {
accountId: sel.value,
currency: currency,
rate: rate,
side: sideSel ? sideSel.value : (old.side || 'debit'),
amountMinor: Math.round(amt * 100),
counterparty: old.counterparty || '',
createDue: old.createDue || null,
note: (document.querySelector('.cline-note[data-index="' + idx + '"]') || {}).value || old.note || ''
};
});
var compact = [];
for (var i = 0; i < next.length; i++) if (next[i]) compact.push(next[i]);
window.__editCompoundLines = compact;
}
function _compoundAccountOptions(filter) {
var q = (filter || '').trim().toLowerCase();
var norm = function (s) { return String(s || '').toLowerCase(); };
var accs = (E.getState().accounts || []).slice();
var out = [];
accs.forEach(function (a) {
var name = a.name || '';
if (!q || norm(name).indexOf(q) >= 0 || norm(a.id).indexOf(q) >= 0) out.push(a);
});
var groups = {};
out.forEach(function (a) { var t = a.type || 'other'; if (!groups[t]) groups[t] = []; groups[t].push(a); });
var order = ['asset', 'liability', 'equity', 'revenue', 'expense', 'other'];
var html = '';
order.forEach(function (t) {
if (!groups[t] || !groups[t].length) return;
html += '<div class="cline-ac-group" style="padding:2px 6px;font-size:calc(10.5px * var(--font-scale,1));color:var(--muted);font-weight:700">' + esc(t) + '</div>';
groups[t].forEach(function (a) {
var cur = (a.currency || E.BASE);
html += '<div class="cline-account-item" data-id="' + esc(a.id) + '" style="padding:6px 10px;cursor:pointer;border-bottom:1px solid var(--line)">' +
'<span style="font-weight:600">' + esc(a.name) + '</span> ' +
'<span style="color:var(--muted);font-size:calc(11px*var(--font-scale,1))">(' + esc(cur) + ')</span></div>';
});
});
if (!html) html = '<div style="padding:8px;color:var(--muted)">لا توجد حسابات مطابقة</div>';
return html;
}
function _wireCompoundAccountAutocomplete() {
var container = document.getElementById('compound-lines');
if (!container) return;
container.querySelectorAll('.cline-account-search').forEach(function (inp) {
if (inp._wired) return;
inp._wired = true;
var idx = inp.getAttribute('data-index');
var list = container.querySelector('.cline-account-list[data-index="' + idx + '"]');
var hidden = container.querySelector('.cline-account[data-index="' + idx + '"]');
function show(filter) {
if (!list) return;
list.innerHTML = _compoundAccountOptions(filter);
list.style.display = 'block';
}
function hide() { if (list) list.style.display = 'none'; }
inp.addEventListener('input', function () { show(inp.value); });
inp.addEventListener('focus', function () { show(inp.value); });
inp.addEventListener('blur', function () { setTimeout(hide, 200); });
if (list) {
list.addEventListener('click', function (ev) {
var item = ev.target.closest('.cline-account-item');
if (!item) return;
var id = item.getAttribute('data-id');
if (hidden) hidden.value = id;
inp.value = (E.getAccount(id) || {}).name || id;
hide();
});
}
});
}
function renderEditCompoundDraft() {
var id = window.__editDraftId;
var lines = window.__editCompoundLines || [];
var totalDebitMinor = 0;
var totalCreditMinor = 0;
var linesHtml = lines.map(function (l, i) {
if (l.side === 'debit') totalDebitMinor += (Number(l.amountMinor) || 0);
else totalCreditMinor += (Number(l.amountMinor) || 0);
var sideOpts = '<option value="debit"' + (l.side === 'debit' ? ' selected' : '') + '>مدين</option>' +
'<option value="credit"' + (l.side === 'credit' ? ' selected' : '') + '>دائن</option>';
return '<div class="form-pair" style="align-items:end;grid-template-columns:2fr 1fr 1.2fr 1.5fr auto">' +
'<div class="form-row" style="position:relative"><label>الحساب</label>' +
'<input type="hidden" class="cline-account" data-index="' + i + '" value="' + esc(l.accountId) + '" />' +
'<input class="cline-account-search" data-index="' + i + '" type="text" autocomplete="off" value="' + esc(accountName(l.accountId)) + '" placeholder="ابحث عن حساب..." style="width:100%" />' +
'<div class="cline-account-list" data-index="' + i + '" style="display:none;position:absolute;top:100%;left:0;right:0;max-height:180px;overflow:auto;border:1px solid var(--line);border-radius:8px;background:var(--paper);z-index:5;margin-top:2px;box-shadow:var(--shadow)"></div></div>' +
'<div class="form-row"><label>الجانب</label><select class="cline-side" data-index="' + i + '">' + sideOpts + '</select></div>' +
'<div class="form-row"><label>المبلغ</label><input id="cline-amount-' + i + '" class="cline-amount amount-input" type="text" inputmode="none" readonly style="cursor:pointer" data-index="' + i + '" value="' + esc((l.amountMinor / 100).toFixed(2)) + '" /></div>' +
'<div class="form-row"><label>ملاحظة</label><input class="cline-note" type="text" data-index="' + i + '" value="' + esc(l.note || '') + '" placeholder="ملاحظة" /></div>' +
'<div>' +
'<button type="button" class="icon-btn row-menu-btn" data-action="compound-line-menu" data-id="' + i + '" data-index="' + i + '" title="خيارات السطر" aria-label="خيارات السطر" aria-haspopup="menu" aria-expanded="false">⋮</button>' +
'</div>' +
'</div>';
}).join('');
var diffMinor = totalDebitMinor - totalCreditMinor;
var balanceBarHtml = '<div id="compound-balance-bar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;padding:6px 10px;margin:6px 0;border-radius:8px;background:var(--card-bg,rgba(0,0,0,.04));font-size:calc(11.5px * var(--font-scale,1))">' +
'<span>مدين: <b>' + esc((totalDebitMinor / 100).toFixed(2)) + '</b></span>' +
'<span>دائن: <b>' + esc((totalCreditMinor / 100).toFixed(2)) + '</b></span>' +
'<span style="font-weight:700;color:' + (diffMinor === 0 ? 'var(--emerald)' : 'var(--danger,#e53935)') + '">' +
(diffMinor === 0 ? 'متوازن ✓' : ('الفرق: ' + (Math.abs(diffMinor) / 100).toFixed(2) + (diffMinor > 0 ? ' (يحتاج دائن)' : ' (يحتاج مدين)'))) +
'</span></div>';
openSheet('تعديل القيد المركب',
'<div class="form-pair">' +
'<div class="form-row"><label for="cedit-date">التاريخ</label><input id="cedit-date" type="date" dir="ltr" value="' + esc(window.__editCompoundDate || '') + '" /></div>' +
'<div class="form-row"><label for="cedit-due">تاريخ الاستحقاق (اختياري)</label><input id="cedit-due" type="date" dir="ltr" value="' + esc(window.__editCompoundDueDate || '') + '" /></div>' +
'<div class="form-row"><label for="cedit-counterparty">الطرف</label><input id="cedit-counterparty" type="text" value="' + esc(window.__editCompoundCounterparty || '') + '" /></div>' +
'</div>' +
'<div class="form-row"><label for="cedit-memo">السرد</label><input id="cedit-memo" type="text" value="' + esc(window.__editCompoundMemo || '') + '" /></div>' +
'<div class="form-row"><label for="cedit-note">ملاحظة (اختياري)</label><input id="cedit-note" type="text" value="' + esc((window.__editCompoundLines && window.__editCompoundLines[0] && window.__editCompoundLines[0].note) || '') + '" /></div>' +
'<div style="margin:10px 0 4px;font-weight:700">السطور</div>' +
'<div id="compound-lines">' + linesHtml + '</div>' +
balanceBarHtml +
'<button type="button" class="btn ghost" data-action="compound-add-line" style="margin:6px 0;width:100%">＋ سطر جديد</button>' +
'<div class="modal-actions">' +
'<button class="btn primary" data-action="save-edit-draft" data-id="' + esc(id) + '">حفظ التعديلات</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button>' +
'</div>');
setTimeout(_wireCompoundAccountAutocomplete, 0);
}
function openEditCompoundDraft(id) {
var draft = E.findDraft(id);
if (!draft) { toast('القيد المقترح غير موجود', true); return; }
window.__editDraftId = id;
window.__editCompoundLines = (draft.lines || []).map(function (l) {
var isDebit = (Number(l.debitBase || 0) > 0);
var nativeAmt = isDebit ? (l.debit != null ? l.debit : fromBaseMinor(l.debitBase, l.currency)) : (l.credit != null ? l.credit : fromBaseMinor(l.creditBase, l.currency));
return {
accountId: l.accountId,
currency: l.currency || draft.currency || E.BASE,
rate: (typeof l.rate === 'number' && l.rate > 0) ? l.rate : E.getRate(l.currency || draft.currency || E.BASE),
side: isDebit ? 'debit' : 'credit',
amountMinor: nativeAmt,
counterparty: l.counterparty || '',
createDue: l.createDue || null,
note: l.note || ''
};
});
window.__editCompoundDate = draft.date;
window.__editCompoundDueDate = draft.dueDate || '';
window.__editCompoundCounterparty = draft.counterparty || '';
window.__editCompoundMemo = draft.memo || '';
renderEditCompoundDraft();
}
function fromBaseMinor(baseMinor, currency) {
var r = E.getRate(currency || E.BASE);
if (!r || r === 0) return baseMinor;
return Math.round(baseMinor / r);
}
function saveEditCompoundDraft(id) {
syncCompoundLinesFromDom();
var draft = E.findDraft(id);
if (!draft) { toast('القيد المقترح غير موجود', true); return; }
var lines = window.__editCompoundLines || [];
if (!lines.length) { toast('لا توجد سطور', true); return; }
var currency = lines[0].currency || draft.currency || E.BASE;
var rate = lines[0].rate || E.getRate(currency);
var rates = {};
rates[currency] = rate;
var rawLines = lines.map(function (l) {
var amt = l.amountMinor || 0;
var dMinor = l.side === 'debit' ? amt : 0;
var cMinor = l.side === 'credit' ? amt : 0;
return {
accountId: l.accountId,
currency: l.currency || currency,
debitMinor: dMinor,
creditMinor: cMinor,
counterparty: l.counterparty || '',
createDue: l.createDue || null,
note: noteVal || l.note || ''
};
});
var date = (document.getElementById('cedit-date') || {}).value || draft.date;
var dueDateInput = ((document.getElementById('cedit-due') || {}).value || '').trim();
var counterparty = (document.getElementById('cedit-counterparty') || {}).value || '';
var memo = (document.getElementById('cedit-memo') || {}).value || '';
var noteVal = ((document.getElementById('cedit-note') || {}).value || '').trim();
var dueDate = dueDateInput || draft.dueDate || null;
var res = E.updateDraft(id, {
isCompound: true,
kind: 'compound',
lines: rawLines,
currency: currency,
rates: rates,
counterparty: counterparty,
memo: memo,
date: date,
dueDate: dueDate,
note: noteVal
});
if (!res.ok) { toast(res.error, true); return; }
closeSheet();
toast('تم تعديل القيد');
renderAll();
}
function saveEditDraft(id) {
var isNew = id === 'new';
var draft = isNew
? { kind: 'expense', date: E.todayISO(), dueDate: null, currency: E.mainCurrency(), memo: '', lines: [] }
: E.findDraft(id);
if (!draft) { toast('القيد المقترح غير موجود', true); return; }
if (!isNew && isMultiLine(draft)) {
saveEditCompoundDraft(id);
return;
}
var val = function (x) { return (document.getElementById(x) || {}).value || ''; };
var kind = (document.getElementById('edit-kind') || {}).value || draft.kind;
var amountStr = (document.getElementById('edit-amount') || {}).value || '';
var amount = parseFloat(amountStr);
if (!(amount > 0)) {
var errEl = document.getElementById('edit-amount-err');
if (errEl) { errEl.textContent = 'المبلغ غير صالح'; errEl.style.display = ''; }
toast('المبلغ غير صالح', true);
return;
}
var errEl2 = document.getElementById('edit-amount-err');
if (errEl2) errEl2.style.display = 'none';
var currency = (document.getElementById('edit-currency') || {}).value || draft.currency;
var amountMinor = Math.round(amount * 100);
var isTransfer = kind === 'transfer' || kind === 'settlement';
var isSettlement = kind === 'settlement';
var accountId = isTransfer ? null : ((document.getElementById('edit-account') || {}).value || primaryAccountOf(draft));
var contraAccountId = isTransfer ? null : ((document.getElementById('edit-contra') || {}).value || null);
var fromAccountId = isTransfer ? ((document.getElementById('edit-from') || {}).value || (isSettlement ? ((systemAccounts()[0] || {}).id || 'cash') : 'cash')) : null;
var toAccountId = isTransfer ? ((document.getElementById('edit-to') || {}).value || (isSettlement ? ((systemAccounts()[1] || systemAccounts()[0] || {}).id || 'bank') : 'bank')) : null;
var counterparty = isNew ? (function () {
var contra = isTransfer ? null : (val('edit-contra') || null);
var contraAcc = contra && E.getAccount(contra);
return contraAcc && /^acc_/.test(contraAcc.id) ? contraAcc.name : (draft.counterparty || '');
})() : (draft.counterparty || '');
var memo = (document.getElementById('edit-memo') || {}).value;
var noteVal = ((document.getElementById('edit-note') || {}).value || '').trim();
var date = (document.getElementById('edit-date') || {}).value || draft.date;
var dueRaw = (document.getElementById('edit-due') || {}).value || '';
var dueDate = dueRaw || null;
if (isNew) {
ux('entry.form');
var res = E.addDraft({
kind: kind,
amountMinor: amountMinor,
currency: currency,
accountId: isTransfer ? null : (val('edit-account') || 'cash'),
contraAccountId: isTransfer ? null : (val('edit-contra') || null),
fromAccountId: fromAccountId,
toAccountId: toAccountId,
rates: editRates(),
counterparty: counterparty,
memo: memo || (kindMeta(kind).label + (counterparty ? ' — ' + counterparty : '')),
date: date,
dueDate: dueDate,
note: noteVal
});
if (!res.ok) { toast(res.error, true); return; }
res.draft.fromForm = true;
if (memoAttachment) { storeDraftAttachment(res.draft.id, memoAttachment); memoAttachment = null; }
closeSheet();
setTab('bot');
pushMessage({ role: 'bot', type: 'draft', draftId: res.draft.id });
E.saveState();
renderAll();
return;
}
var changes = [];
if (kind !== draft.kind) changes.push('نوع: ' + kind);
var oldAmount = (E.draftAmount(draft) / 100).toFixed(2);
if (String(amount) !== String(parseFloat(oldAmount))) changes.push('مبلغ: ' + oldAmount + '→' + amount);
if (currency !== draft.currency) changes.push('عملة: ' + currency);
if (accountId && accountId !== primaryAccountOf(draft)) changes.push('حساب: ' + accountId);
if (contraAccountId && contraAccountId !== contraAccountOf(draft)) changes.push('مقابل: ' + contraAccountId);
if (date !== draft.date) changes.push('تاريخ: ' + date);
if ((dueDate || '') !== (draft.dueDate || '')) changes.push('استحقاق: ' + (dueDate || '—'));
if (memo !== (draft.memo || '')) changes.push('سرد');
var hadRate = E.linesExchange(draft.lines);
var typedRate = editRates() && parseFloat((document.getElementById('edit-rate') || {}).value);
if (typedRate && (!hadRate || fmtRate(hadRate.rate) !== fmtRate(typedRate))) changes.push('سعر: ' + fmtRate(typedRate));
var note = changes.length ? ' [تعديل: ' + changes.join('، ') + ']' : '';
var finalMemo = (memo || draft.memo || '') + note;
var res2 = E.updateDraft(id, {
kind: kind,
amountMinor: amountMinor,
currency: currency,
accountId: accountId,
contraAccountId: contraAccountId,
fromAccountId: fromAccountId,
rates: editRates() || keptDraftRates(draft, currency),
toAccountId: toAccountId,
counterparty: counterparty,
memo: finalMemo,
date: date,
dueDate: dueDate,
note: noteVal
});
if (!res2.ok) { toast(res2.error, true); return; }
if (memoAttachment) { storeDraftAttachment(id, memoAttachment); memoAttachment = null; }
closeSheet();
toast('تم تعديل القيد');
renderAll();
}
function plainMoney(minor, currency) {
var cur = currency || E.BASE;
var main = E.mainCurrency();
var value = minor;
if (!currency && main !== E.BASE) { cur = main; value = E.fromBase(minor, main); }
var words = { SAR: 'ريال' };
return (Number(value) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + (words[cur] || currencyName(cur));
}
function shareLines(lines) {
return (lines || []).map(function (l) {
var debit = (l.debitBase || 0) > 0;
return (debit ? 'مدين: ' : 'دائن: ') + accountName(l.accountId) + ' — ' + plainMoney(debit ? l.debit : l.credit, l.currency);
}).join('\n');
}
function replyText(m) {
if (m.type === 'draft') {
var d = E.findDraft(m.draftId);
return d ? 'مسودة قيد: ' + kindMeta(d.kind).label + ' — ' + plainMoney(d.totalBase) + '\n' + shareLines(d.lines) : null;
}
if (m.type === 'receipt') {
var e = S().entries.filter(function (x) { return x.id === m.entryId; })[0];
return e ? 'تم اعتماد: ' + kindMeta(e.kind).label + ' — ' + plainMoney(e.totalBase) + (e.counterparty ? ' — ' + e.counterparty : '') + '\n' + shareLines(e.lines) : null;
}
if (m.type === 'report' && m.data) {
return 'السيولة المتاحة: ' + plainMoney(m.data.liquidity) + '\nصافي الثروة: ' + plainMoney(m.data.netWorth) + '\nمصروف 30 يومًا: ' + plainMoney(m.data.burn30);
}
if (m.type === 'similar-account' && m.options) return 'هل تقصد: ' + m.options.map(function (o) { return o.name; }).join('، ') + '؟';
var text = String(m.text || '').trim();
return text ? text.replace(/[\u200E\u2060\u2066-\u2069]/g, '').replace(/\u20C1\u00A0?\s*([\d,.]+)/g, '$1 ريال') : null;
}
function shareToWhatsApp(id) {
var msgs = S().messages;
var at = msgs.map(function (m) { return m.id; }).indexOf(id);
if (at < 0) { toast('الرسالة غير موجودة', true); return; }
var parts = ['أنا: ' + msgs[at].text];
for (var i = at + 1; i < msgs.length && msgs[i].role !== 'user'; i++) {
var r = replyText(msgs[i]);
if (r) parts.push(r);
}
if (parts.length > 1) parts[1] = 'موني كود: ' + parts[1];
var footer = '\n\n— موني كود • ' + (E.todayISO ? E.todayISO().replace(/-/g, '/') : '');
var text = parts.join('\n\n') + footer;
if (window.RohPrint && window.RohPrint.sendWhatsApp) { window.RohPrint.sendWhatsApp(text); return; }
if (window.RohPrint && window.RohPrint.sendText) { window.RohPrint.sendText(text); return; }
try { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); }
catch (e) { toast('تعذر فتح واتساب', true); }
}
function reminderText(due) {
var payable = due.kind === 'payable';
var amount = E.fmtMoney(due.remaining, E.BASE, false).replace(/[\u200E\u2060\u2066-\u2069]/g, '').replace(/\u20C1\s*(.+)/, '$1 ريال');
var date = due.dueDate ? E.fmtDate(due.dueDate) : 'قريباً';
var party = due.counterparty || 'العميل';
if (payable) {
return 'تذكير: التزام بقيمة ' + amount + ' مستحق لـ ' + party + ' (تاريخ: ' + date + '). — موني كود';
}
return 'السلام عليكم ' + party + '، نذكركم بمستحق مالي بقيمة ' + amount + ' (استحقاق: ' + date + '). نرجو التسوية. — موني كود';
}
function openReminder(id) {
var a = E.computeAnalysis();
var due = null;
for (var i = 0; i < a.dueItems.length; i++) if (a.dueItems[i].id === id) due = a.dueItems[i];
if (!due) { toast('الاستحقاق غير موجود', true); return; }
var msg = reminderText(due);
var waUrl = 'https://wa.me/?text=' + encodeURIComponent(msg);
openSheet('تذكير',
'<p class="modal-note">رسالة تذكير جاهزة. انسخها أو أرسلها عبر واتساب.</p>' +
'<textarea id="reminderText" aria-label="نص التذكير" readonly spellcheck="false"></textarea>' +
'<div class="modal-actions">' +
'<button class="btn primary" data-action="copy-reminder">نسخ النص</button>' +
'<button class="btn gold" data-action="open-whatsapp" data-url="' + esc(waUrl) + '">واتساب</button>' +
'<button class="btn ghost" data-action="modal-cancel">إغلاق</button>' +
'</div>');
var area = document.getElementById('reminderText');
if (area) area.value = msg;
}
function copyReminder() {
var area = document.getElementById('reminderText');
if (!area) return;
var text = area.value;
var done = function () { toast('تم نسخ التذكير'); };
var fallback = function () {
try { area.focus(); area.select(); area.setSelectionRange(0, text.length); if (document.execCommand('copy')) done(); else toast('تعذر النسخ', true); }
catch (e) { toast('تعذر النسخ', true); }
};
if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(fallback);
else fallback();
}
function openNewAccount(targetSelectId) {
openSheet('حساب جديد',
'<div class="form-row">' +
'<label for="newacc-name">اسم الحساب</label>' +
'<input id="newacc-name" type="text" maxlength="40" autocomplete="off" placeholder="مثال: إيجار المكتب" /></div>' +
'<div class="form-row">' +
'<label for="newacc-nick">اسم مستعار (اختياري)</label>' +
'<input id="newacc-nick" type="text" maxlength="30" autocomplete="off" placeholder="أبو محمد" /></div>' +
'<div class="form-pair"><div class="form-row">' +
'<label for="newacc-type">النوع</label>' +
'<select id="newacc-type">' +
'<option value="expense">مصروف</option>' +
'<option value="revenue">إيراد</option>' +
'<option value="asset">أصل</option>' +
'<option value="liability">التزام</option>' +
'<option value="equity">حقوق ملكية</option>' +
'</select></div>' +
'<div class="form-row">' +
'<label for="newacc-currency">العملة</label>' +
'<select id="newacc-currency">' + namedCurrencyOptions('SAR') + '</select></div></div>' +
'<div class="modal-actions">' +
'<button class="btn primary" data-action="save-new-account" data-target="' + esc(targetSelectId) + '">حفظ</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button>' +
'</div>');
}
function saveNewAccount(targetSelectId) {
var name = (document.getElementById('newacc-name') || {}).value || '';
name = String(name).trim();
if (!name) { toast('اسم الحساب مطلوب', true); return; }
var exists = (S().accounts || []).some(function (a) { return E.normalizeName(a.name) === E.normalizeName(name); });
if (exists) { toast('يوجد حساب بنفس الاسم', true); return; }
var nickname = String((document.getElementById('newacc-nick') || {}).value || '').trim();
var type = ((document.getElementById('newacc-type') || {}).value || 'expense').toLowerCase();
var currency = (document.getElementById('newacc-currency') || {}).value || 'SAR';
var nature = (type === 'asset' || type === 'expense') ? 'debit' : 'credit';
var res = E.addAccount({ name: name, nickname: nickname, type: type, nature: nature, currency: currency, liquid: false, glyph: '◆', hint: '' });
if (!res.ok) { toast(res.error || 'تعذر إنشاء الحساب', true); return; }
var sel = document.getElementById(targetSelectId || 'edit-contra');
if (sel) {
var opt = document.createElement('option');
opt.value = res.account.id;
opt.textContent = res.account.name;
opt.selected = true;
sel.appendChild(opt);
}
closeSheet();
toast('تم إنشاء الحساب');
renderAll();
}
function namedCurrencyOptions(selected) {
return E.listCurrencies().map(function (c) {
return '<option value="' + esc(c.code) + '"' + (c.code === selected ? ' selected' : '') + '>' + esc(c.code) + ' — ' + esc(c.name) + '</option>';
}).join('');
}
function validPhone(phone) {
return !phone || /^\+?[\d٠-٩\s-]{5,}$/.test(phone);
}
function subtypeOptions(type) {
var subtypes = {};
E.generalAccountsFor(type).forEach(function (p) { subtypes[p] = true; });
(E.getState().accounts || []).forEach(function (a) { if (a.type === type && a.subtype && a.subtype !== 'wallet') subtypes[subtypeKey(a.subtype)] = true; });
return Object.keys(subtypes).map(function (s) { return '<option value="' + esc(s) + '">'; }).join('');
}
function subtypeField(inputId, value, type) {
return '<div class="form-row"><label for="' + inputId + '">تصنيف <span class="form-optional">(اختياري)</span></label>' +
'<input id="' + inputId + '" type="text" list="subtypeList" maxlength="30" autocomplete="off" placeholder="العملاء، الموردون…" value="' + esc(value) + '" onfocus="this.select()" />' +
'<datalist id="subtypeList">' + subtypeOptions(type) + '</datalist></div>';
}
function bindSubtypeType(selectId, inputId) {
var select = document.getElementById(selectId);
if (!select) return;
select.addEventListener('change', function () {
document.getElementById('subtypeList').innerHTML = subtypeOptions(select.value);
var input = document.getElementById(inputId);
if (input.value === 'العملاء' && select.value !== 'asset') input.value = '';
});
}
function hasOpenPayableFor(name) {
var n = E.normalizeName(name || '');
return (E.computeAnalysis().dueItems || []).some(function (d) {
return d.kind === 'payable' && (Number(d.remaining) || 0) > 0 && E.normalizeName(d.counterparty || '') === n;
});
}
function askAddCurrency(intent, text) {
var ids = intent.lacksCurrency || [];
if (!ids.length || !intent.currency) return false;
var names = ids.map(function (id) { var a = E.getAccount(id); return a ? a.name : id; });
var cur = currencyName(intent.currency);
var choices = [{ label: 'نعم، أضف ' + cur, action: 'add-currency-yes', name: ids.join(','), currency: intent.currency, text: text }];
if (intent.kind === 'needSplit') choices.push({ label: 'إلغاء', action: 'add-currency-cancel', name: '', text: text });
else choices.push({ label: 'لا، سجّله كالمعتاد', action: 'add-currency-no', name: '', text: text });
pushMessage({ role: 'bot', type: 'text',
text: (names.length > 1 ? 'هذه الحسابات لا تقبل ' + cur + ': ' + names.join('، ') + '. هل أضيف ' + cur + ' لها؟'
: '«' + names[0] + '» لا يقبل ' + cur + '. هل أضيف ' + cur + ' له ليُسجَّل المبلغ بعملته؟'),
data: { choices: choices, tight: true } });
return true;
}
function addCurrencyAndRetry(ids, currency, text) {
ux('currency.add');
var failed = [];
ids.forEach(function (id) {
var acc = E.getAccount(id);
if (!acc || E.accountTakes(acc, currency)) return;
var now = acc.multi ? (acc.currencies || []).slice() : [acc.currency];
var res = E.setAccountCurrencies(id, now.concat([currency]));
if (!res.ok) failed.push(acc.name + ': ' + res.error);
});
if (failed.length) { botText('تعذرت إضافة العملة. ' + failed.join(' — ')); renderAll(); return; }
toast('تمت إضافة ' + currencyName(currency));
handleText(text);
}
function openSplitSheet(intent) {
ux('split.sheet');
ui.pendingSplit = intent;
var cur = intent.currency || E.BASE;
var stated = (intent.amountMinor / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
openSheet('وزّع المبلغ',
'<p class="modal-note">المبلغ المذكور: <b dir="ltr">' + esc(stated + ' ' + cur) + '</b>. اكتب ما في كل حساب، واترك ما ليس فيه شيء فارغاً.</p>' +
intent.accounts.map(function (id, i) {
var acc = E.getAccount(id);
if (!acc) return '';
return '<div class="form-row"><label for="split-' + i + '">' + esc(acc.name) + ' <span class="form-optional">(' + esc(cur) + ')</span></label>' +
'<input id="split-' + i + '" class="split-amount" data-account="' + esc(id) + '" type="text" inputmode="decimal" dir="ltr" autocomplete="off" placeholder="0" /></div>';
}).join('') +
'<p class="modal-note" id="split-total" aria-live="polite"></p>' +
'<div class="modal-actions"><button class="btn primary" data-action="split-save">إعداد القيد</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button></div>');
var totalBox = document.getElementById('split-total');
var update = function () {
var sum = splitParts().reduce(function (s, p) { return s + p.amountMinor; }, 0);
if (!totalBox) return;
var diff = sum - intent.amountMinor;
totalBox.textContent = 'المجموع: ' + (sum / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + cur +
(sum && diff ? (diff > 0 ? ' — أكثر من المذكور' : ' — أقل من المذكور') : '');
};
Array.prototype.forEach.call(document.querySelectorAll('.split-amount'), function (input) { input.addEventListener('input', update); });
}
function splitParts() {
return Array.prototype.map.call(document.querySelectorAll('.split-amount'), function (input) {
var v = parseFloat(String(input.value || '').replace(/[,،]/g, '').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }));
return { accountId: input.getAttribute('data-account'), amountMinor: v > 0 ? Math.round(v * 100) : 0 };
}).filter(function (p) { return p.amountMinor > 0; });
}
function saveSplitSheet() {
var intent = ui.pendingSplit;
if (!intent) { toast('لا يوجد توزيع معلق', true); return; }
var parts = splitParts();
if (!parts.length) { toast('أدخل مبلغاً لحساب واحد على الأقل', true); return; }
var draft;
try {
draft = E.buildSplitDraft({ kind: intent.intended, currency: intent.currency || E.BASE, memo: intent.memo || '', contraAccountId: intent.contraAccountId || null, parts: parts, dueDate: intent.dueDate || null, counterparty: intent.counterparty || '' });
} catch (e) { toast(e.message, true); return; }
var st = S();
st.drafts.push(draft);
if (st.drafts.length > 20) st.drafts = st.drafts.slice(-20);
ui.pendingSplit = null;
pushMessage({ role: 'bot', type: 'draft', draftId: draft.id });
E.saveState();
closeSheet();
if (ui.tab !== 'bot') setTab('bot');
}
function openNewAccountForm(typeHint, subtype, name, editId) {
var acc = editId ? E.getAccount(editId) : null;
if (editId && !acc) { toast('الحساب غير موجود', true); return; }
var locked = acc && E.isAccountLocked(acc.id);
var off = locked ? ' disabled' : '';
var lockMark = locked ? UI_ICONS.lock : '';
var th = acc ? acc.type : (typeHint || '').toLowerCase();
var TYPES = { asset: 'أصل', liability: 'التزام', equity: 'حقوق ملكية', revenue: 'إيراد', expense: 'مصروف' };
var subtypeValue = acc
? (subtypeLabel(acc.subtype || '') || (/^acc_/.test(acc.id) && acc.type === 'asset' && !acc.liquid ? 'العملاء' : ''))
: (subtype != null ? subtype : (th && th !== 'asset' ? '' : 'العملاء'));
var currencies = !acc ? [E.BASE] : acc.multi ? (acc.currencies && acc.currencies.length ? acc.currencies : [E.BASE]) : [acc.currency];
openSheet(acc ? 'تعديل الحساب' : 'حساب جديد',
'<div class="account-form"><div class="form-row">' +
'<label for="newacc2-name">اسم الحساب</label>' +
'<div class="name-with-contact"><input id="newacc2-name" type="text" maxlength="40" autocomplete="off" placeholder="مثال: إيجار المكتب" />' +
'<button type="button" class="name-contact-btn" id="newacc2-contact" aria-label="من جهات الاتصال" title="من جهات الاتصال">' + UI_ICONS.contacts + '</button></div></div>' +
'<div class="form-pair">' +
'<div class="form-row"><label for="newacc2-nick">اسم مستعار <span class="form-optional">(اختياري)</span></label>' +
'<input id="newacc2-nick" type="text" maxlength="30" autocomplete="off" placeholder="أبو محمد" /></div>' +
'<div class="form-row"><label for="newacc2-phone">الهاتف <span class="form-optional">(اختياري)</span></label>' +
'<input id="newacc2-phone" type="tel" inputmode="tel" maxlength="20" autocomplete="off" placeholder="05xxxxxxxx" /></div>' +
'<div class="form-row"><label for="newacc2-email">البريد <span class="form-optional">(اختياري)</span></label>' +
'<input id="newacc2-email" type="email" inputmode="email" maxlength="60" autocomplete="off" placeholder="name@mail.com" /></div>' +
'<div class="form-row"><label for="newacc2-hint">تلميح <span class="form-optional">(اختياري)</span></label>' +
'<input id="newacc2-hint" type="text" maxlength="40" autocomplete="off" placeholder="وصف الحساب" /></div>' +
'<div class="form-row"><label for="newacc2-device">رمز الجهاز <span class="form-optional">(اختياري)</span></label>' +
'<input id="newacc2-device" type="text" dir="ltr" maxlength="20" autocomplete="off" placeholder="ABCD-EFGH-JKLM" /></div>' +
'</div><div class="form-pair">' +
'<div class="form-row"><label for="newacc2-type">النوع' + lockMark + '</label><select id="newacc2-type"' + off + '>' +
Object.keys(TYPES).map(function (t) { return '<option value="' + t + '"' + (th === t ? ' selected' : '') + '>' + TYPES[t] + '</option>'; }).join('') +
'</select></div>' +
subtypeField('newacc2-subtype', subtypeValue, th || 'asset') +
'</div>' +
currencyChecks('newacc2-currencies', currencies, !!locked && !acc.liquid,
'<label class="liquid-inline" id="newacc2-liquid-row"><input id="newacc2-liquid" type="checkbox"' + off + ' /> يُحسب في السيولة</label>') +
(!acc ? '<div id="newacc2-opening-box" style="margin-top:6px"></div>' : '') +
(locked ? '<p class="modal-note">' + (acc.liquid
? 'النوع والسيولة مقفلان لأن الحساب أساسي أو عليه قيود. يمكنك إضافة عملات ليحمل الحساب أكثر من عملة.'
: 'النوع والعملة والسيولة مقفلة لأن الحساب أساسي أو عليه قيود.') + '</p>' : '') +
'<div class="modal-actions">' +
'<button class="btn primary" data-action="save-new-account2"' + (acc ? ' data-id="' + esc(acc.id) + '"' : '') + '>' + (acc ? 'حفظ التعديلات' : 'حفظ') + '</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button>' +
'</div></div>');
els.modal.classList.add('compact');
var field = function (id) { return document.getElementById(id); };
if (acc) {
field('newacc2-name').value = acc.name || '';
field('newacc2-nick').value = acc.nickname || '';
field('newacc2-phone').value = acc.phone || '';
if (field('newacc2-email')) field('newacc2-email').value = acc.email || '';
if (field('newacc2-hint')) field('newacc2-hint').value = acc.hint || '';
if (field('newacc2-device')) field('newacc2-device').value = acc.deviceCode || '';
field('newacc2-liquid').checked = !!acc.liquid;
}
var type = field('newacc2-type');
var renderOpeningBox = function () {
var box = field('newacc2-opening-box');
if (!box) return;
if (type.value !== 'asset' && type.value !== 'liability') { box.innerHTML = ''; return; }
var ticked = checkedCurrencies('newacc2-currencies');
if (!ticked.length) ticked = [E.BASE];
var prevVals = {};
Array.prototype.forEach.call(box.querySelectorAll('.newacc2-open-amt'), function (inp) {
prevVals[inp.getAttribute('data-currency')] = inp.value;
});
box.innerHTML = '<div class="form-pair">' + ticked.map(function (code) {
return '<div class="form-row"><label for="newacc2-open-' + esc(code) + '">رصيد افتتاحي (' + esc(code) + ') <span class="form-optional">(اختياري)</span></label>' +
'<input id="newacc2-open-' + esc(code) + '" class="newacc2-open-amt" data-currency="' + esc(code) + '" type="text" inputmode="decimal" dir="ltr" autocomplete="off" placeholder="0.00" value="' + esc(prevVals[code] || '') + '" /></div>';
}).join('') + '</div>';
};
var showLiquid = function () {
field('newacc2-liquid-row').hidden = type.value !== 'asset';
renderOpeningBox();
};
type.addEventListener('change', showLiquid);
var curBox = field('newacc2-currencies');
if (curBox) curBox.addEventListener('change', renderOpeningBox);
showLiquid();
if (!acc && subtype === 'سيولة نقدية') field('newacc2-liquid').checked = true;
if (!acc && name) field('newacc2-name').value = String(name).slice(0, 40);
bindSubtypeType('newacc2-type', 'newacc2-subtype');
field('newacc2-contact').addEventListener('click', function () {
pickContact(function (name, phone) {
field('newacc2-name').value = String(name || '').trim().slice(0, 40);
if (phone) field('newacc2-phone').value = String(phone).replace(/[^+\d٠-٩\s-]/g, '').trim().slice(0, 20);
});
});
}
function saveNewAccountForm(editId) {
var acc = editId ? E.getAccount(editId) : null;
if (editId && !acc) { toast('الحساب غير موجود', true); return; }
var val = function (id) { return String((document.getElementById(id) || {}).value || '').trim(); };
var name = val('newacc2-name');
if (!name) { toast('اكتب اسم الحساب', true); return; }
var nameCheck = E.checkAccountName(name);
if (!nameCheck.ok && (!acc || name !== acc.name)) { toast(nameCheck.error, true); return; }
var exists = (S().accounts || []).some(function (a) { return a.id !== editId && E.normalizeName(a.name) === E.normalizeName(name); });
if (exists) { toast('يوجد حساب بهذا الاسم. اختر اسماً آخر.', true); return; }
var phone = val('newacc2-phone');
var device = val('newacc2-device');
if (!validPhone(phone)) { toast('رقم الهاتف غير صحيح', true); return; }
var type = (val('newacc2-type') || 'expense').toLowerCase();
var liquid = type === 'asset' && !!(document.getElementById('newacc2-liquid') || {}).checked;
var nature = (type === 'asset' || type === 'expense') ? 'debit' : 'credit';
var codes = checkedCurrencies('newacc2-currencies');
if (!codes.length) { toast('اختر عملة واحدة على الأقل', true); return; }
if (acc && E.isAccountLocked(acc.id) && acc.liquid) {
var had = (acc.multi ? acc.currencies || [] : [acc.currency]).slice().sort().join();
if (had !== codes.slice().sort().join()) {
var curRes = E.setAccountCurrencies(acc.id, codes); if (curRes && curRes.ok && E.noteFeature) E.noteFeature('multiCurrency');
if (!curRes.ok) { toast(curRes.error, true); return; }
}
}
if (acc) {
acc.name = name;
E.onAccountRenamed(editId, name);
acc.nickname = val('newacc2-nick');
acc.phone = phone || null;
acc.email = val('newacc2-email') || null;
acc.hint = val('newacc2-hint') || acc.hint || '';
var subtype = val('newacc2-subtype');
if (subtype !== subtypeLabel(acc.subtype || '')) acc.subtype = subtype;
if (!E.isAccountLocked(acc.id)) {
acc.type = type;
acc.nature = nature;
acc.liquid = liquid;
acc.multi = codes.length > 1;
acc.currencies = acc.multi ? codes : [];
acc.currency = acc.multi ? E.BASE : codes[0];
}
E.saveState();
closeSheet();
toast('تم تعديل الحساب');
renderAll();
return;
}
var res = E.addAccount({ name: name, nickname: val('newacc2-nick'), phone: phone || null, email: val('newacc2-email') || null, deviceCode: device || null, type: type, subtype: val('newacc2-subtype'), nature: nature, currencies: codes, liquid: liquid, glyph: '◆', hint: val('newacc2-hint') || '' });
if (!res.ok) { toast(res.error || 'تعذر إنشاء الحساب', true); return; }
var openItems = [];
Array.prototype.forEach.call(document.querySelectorAll('.newacc2-open-amt'), function (inp) {
var rawOpen = String(inp.value || '').replace(/[,،]/g, '').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).trim();
var numOpen = parseFloat(rawOpen);
if (numOpen > 0 && isFinite(numOpen)) {
openItems.push({ currency: inp.getAttribute('data-currency') || E.BASE, amountMinor: Math.round(numOpen * 100) });
}
});
if (openItems.length && E.postOpeningBalance) {
var obRes = E.postOpeningBalance({ accountId: res.account.id, amounts: openItems });
if (obRes && obRes.ok && obRes.entry) pushReceipts([obRes.entry.id]);
}
var pending = ui.afterNewAccount;
closeSheet();
toast('تم إنشاء الحساب');
if (pending) {
ui.chosenName = res.account.name;
handleText(withFullName(pending.text, pending.short, res.account.name, ''));
return;
}
renderAll();
}
function deleteAccountUI(id) {
var acc = E.getAccount(id);
if (!acc) { toast('الحساب غير موجود', true); return; }
var a = E.computeAnalysis();
var bal = a.balances && a.balances[id] ? a.balances[id] : { native: 0, base: 0 };
var st = S();
var referenced = (st.entries || []).some(function (e) {
return (e.lines || []).some(function (l) { return l.accountId === id; });
});
if (bal.base !== 0 || bal.native !== 0 || referenced) {
openReassignAccount(id);
return;
}
askConfirm('حذف الحساب', 'سيُحذف الحساب "' + acc.name + '" نهائياً. هل تريد المتابعة؟', function () {
E.onAccountRemoved(id, null);
var st2 = S();
st2.accounts = st2.accounts.filter(function (a) { return a.id !== id; });
E.saveState();
toast('تم حذف الحساب');
renderAll();
});
}
function openReassignAccount(id) {
var acc = E.getAccount(id);
if (!acc) { toast('الحساب غير موجود', true); return; }
var srcAcc = E.getAccount(id);
var srcSubtype = srcAcc ? (srcAcc.subtype || '') : '';
var others = E.getState().accounts.filter(function (a) {
if (a.id === id) return false;
return true;
});
var sameSub = others.filter(function (a) { return srcSubtype && a.subtype === srcSubtype; });
var pool = sameSub.length ? sameSub : others;
var opts = pool.map(function (a) {
return '<option value="' + esc(a.id) + '">' + esc(a.name) + ' (' + esc(accountCurrencyCodes(a)) + ')</option>';
}).join('');
openSheet('نقل وإغلاق: ' + esc(acc.name),
'<p class="modal-note"><b style="color:var(--emerald)">' + esc(acc.name) + '</b> (' + esc(acc.id) + ') مرتبط بقيود أو لديه رصيد. اختر حساباً بديلاً لنقل جميع حركاته إليه، ثم إغلاق هذا الحساب.</p>' +
'<div class="form-row">' +
'<label for="reassign-target">الحساب البديل (نفس التصنيف)</label>' +
'<select id="reassign-target">' + opts + '</select></div>' +
'<div class="modal-actions">' +
'<button class="btn ghost small" data-action="new-reassign-account" data-id="' + esc(id) + '">＋ حساب جديد</button>' +
'<button class="btn primary" data-action="confirm-reassign-account" data-id="' + esc(id) + '">نقل وإغلاق</button>' +
'<button class="btn ghost" data-action="modal-cancel">إغلاق</button>' +
'</div>');
}
function openNewReassignAccount(id) {
var acc = E.getAccount(id);
var subtype = acc ? (acc.subtype || '') : '';
openSheet('حساب بديل جديد',
'<div class="form-row">' +
'<label for="ra-name">اسم الحساب</label>' +
'<input id="ra-name" type="text" placeholder="مثال: حساب بديل" /></div>' +
'<div class="form-row">' +
'<label for="ra-type">النوع</label>' +
'<select id="ra-type">' +
'<option value="asset">أصل</option>' +
'<option value="liability">التزام</option>' +
'<option value="equity">حقوق ملكية</option>' +
'<option value="revenue">إيراد</option>' +
'<option value="expense">مصروف</option>' +
'</select></div>' +
'<div class="form-row">' +
'<label for="ra-currency">العملة</label>' +
'<select id="ra-currency">' + currencyOptions('SAR') + '</select></div>' +
'<div class="modal-actions">' +
'<button class="btn primary" data-action="save-new-reassign-account" data-id="' + esc(id) + '" data-subtype="' + esc(subtype) + '">حفظ</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button>' +
'</div>');
}
function saveNewReassignAccount(id) {
var name = (document.getElementById('ra-name') || {}).value || '';
name = String(name).trim();
if (!name) { toast('اسم الحساب مطلوب', true); return; }
var type = ((document.getElementById('ra-type') || {}).value || 'asset').toLowerCase();
var currency = (document.getElementById('ra-currency') || {}).value || 'SAR';
var nature = (type === 'asset' || type === 'expense') ? 'debit' : 'credit';
var subtype = (document.querySelector('[data-action="save-new-reassign-account"]') || {}).getAttribute('data-subtype') || '';
var res = E.addAccount({ name: name, type: type, nature: nature, currency: currency, liquid: false, glyph: '◆', hint: '', subtype: subtype });
if (!res.ok) { toast(res.error || 'تعذر إنشاء الحساب', true); return; }
closeSheet();
setTimeout(function () {
openReassignAccount(id);
var sel = document.getElementById('reassign-target');
if (sel) sel.value = res.account.id;
}, 50);
}
function confirmReassignAccount(id) {
var targetId = (document.getElementById('reassign-target') || {}).value;
if (!targetId) { toast('اختر حساباً بديلاً', true); return; }
var acc = E.getAccount(id);
if (!acc) { toast('الحساب غير موجود', true); return; }
var st = S();
(st.entries || []).forEach(function (e) {
(e.lines || []).forEach(function (l) {
if (l.accountId === id) l.accountId = targetId;
});
});
(st.drafts || []).forEach(function (d) {
(d.lines || []).forEach(function (l) {
if (l.accountId === id) l.accountId = targetId;
});
});
E.onAccountRemoved(id, targetId);
st.accounts = st.accounts.filter(function (a) { return a.id !== id; });
E.saveState();
closeSheet();
toast('تم نقل الحركات إلى الحساب البديل وإغلاق ' + acc.name);
renderAll();
}
function openEditAccount(id) {
openNewAccountForm(null, null, null, id);
}
function currencyChecks(id, selected, disabled, end) {
return '<div class="form-row"><div class="form-label-row"><span class="form-label">العملة <span class="form-optional">(واحدة أو أكثر)</span></span>' + (end || '') + '</div>' +
'<div class="currency-checks" id="' + id + '" role="group" aria-label="العملات">' +
E.listCurrencies().map(function (c) {
return '<label><input type="checkbox" value="' + esc(c.code) + '"' + (selected.indexOf(c.code) >= 0 ? ' checked' : '') + (disabled ? ' disabled' : '') + ' /> ' + esc(c.name) + '</label>';
}).join('') + '</div></div>';
}
function checkedCurrencies(id) {
return Array.prototype.slice.call(document.querySelectorAll('#' + id + ' input:checked')).map(function (i) { return i.value; });
}
function accountCurrencyCodes(acc) {
return acc.multi ? (acc.currencies && acc.currencies.length ? acc.currencies.join(' • ') : 'متعدد العملات') : acc.currency;
}
var REPORT_MENU_ICONS = {
excel: '<path d="M10 6H38V42H10Z"/><path d="M10 18H38M10 30H38M24 6V42"/>',
month: '<path d="M8 12H40V42H8Z"/><path d="M8 21H40M16 6V15M32 6V15"/><path d="M16 29H20M28 29H32M16 35H20"/>',
fromLast: '<path d="M12 8V40"/><path d="M38 10L20 24L38 38Z"/>',
sort: '<path d="M15 8V40M8 33L15 40L22 33"/><path d="M33 40V8M26 15L33 8L40 15"/>'
};
function reportMenuItem(action, icon, label, opt) {
return '<button type="button" class="report-menu-item" role="menuitem" data-action="' + action + '"' + (opt ? ' data-opt="' + opt + '"' : '') + '>' +
icon + '<span class="report-menu-label">' + esc(label) + '</span>' + (opt ? '<span class="report-menu-state"></span>' : '') + '</button>';
}
function syncReportMenu(menu) {
var o = window.__reportOpts;
if (!menu || !o) return;
Array.prototype.forEach.call(menu.querySelectorAll('[data-opt]'), function (item) {
var key = item.getAttribute('data-opt');
var state = item.querySelector('.report-menu-state');
if (key === 'sortBy') {
state.textContent = o.sortBy === 'amount' ? 'بالمبلغ' : 'بالتاريخ';
item.removeAttribute('aria-checked');
return;
}
var on = !!o[key];
item.setAttribute('role', 'menuitemcheckbox');
item.setAttribute('aria-checked', String(on));
state.textContent = on ? '✓' : '';
});
}
function showReport(html, search) {
ux('report.print');
html = numberPages(html);
window.__printHtml = html;
var overlay = document.createElement('div');
overlay.className = 'print-overlay';
overlay.innerHTML = '<div class="print-toolbar" style="display:flex;align-items:center;gap:4px;padding:4px 8px">' +
'<button class="report-tool" data-action="close-print" style="margin-inline-start:auto" aria-label="عودة">' + UI_ICONS.close + '</button>' +
'<span class="print-title" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(window.__printTitle || 'مستند') + '</span>' +
(search ? '<button class="report-tool report-search-btn" data-action="report-search" aria-expanded="false">' + UI_ICONS.search + '</button>' : '') +
'<div class="report-menu" style="position:relative;display:inline-block">' +
'<button class="report-tool" data-action="report-menu-toggle" aria-expanded="false" aria-haspopup="menu" aria-label="خيارات التقرير">' + drawnIcon('<circle cx="10" cy="24" r="2.5"/><circle cx="24" cy="24" r="2.5"/><circle cx="38" cy="24" r="2.5"/>') + '</button>' +
'<div class="report-menu-list" role="menu" hidden>' +
reportMenuItem('print-now', UI_ICONS.printer, 'طباعة / PDF') +
reportMenuItem('send-file', UI_ICONS.sendFile, 'إرسال ملف') +
(window.__reportExcel ? reportMenuItem('excel-export', drawnIcon(REPORT_MENU_ICONS.excel), 'تصدير Excel') : '') +
(window.__reportOpts ? '<div class="report-menu-sep" role="separator"></div>' +
reportMenuItem('toggle-group-month', drawnIcon(REPORT_MENU_ICONS.month), 'تجميع شهري', 'groupByMonth') +
reportMenuItem('toggle-group-currency', drawnIcon(REPORT_MENU_ICONS.month), 'تجميع حسب العملة', 'groupByCurrency') +
reportMenuItem('toggle-auto-match', drawnIcon(REPORT_MENU_ICONS.month), 'مطابقة آلية', 'autoMatch') +
reportMenuItem('toggle-from-last', drawnIcon(REPORT_MENU_ICONS.fromLast), 'عرض من آخر ترصيد', 'fromLastBalance') +
reportMenuItem('toggle-sort', drawnIcon(REPORT_MENU_ICONS.sort), 'الترتيب', 'sortBy') : '') +
'</div></div>' +
'</div>' +
(search ? reportSearchHtml() : '') +
'<iframe class="print-frame" srcdoc="' + esc(html).replace(/"/g, '&quot;') + '"></iframe>';
document.body.appendChild(overlay);
var iframe = overlay.querySelector('.print-frame');
var wordsField = overlay.querySelector('[data-field="words"]');
if (wordsField) wordsField.addEventListener('input', function () {
overlay.querySelector('[data-action="report-words-clear"]').hidden = !wordsField.value;
});
var applySearch = function (filter) {
window.__reportFilter = filter;
window.__printHtml = numberPages(search(filter));
iframe.srcdoc = window.__printHtml;
};
overlay.addEventListener('click', function (ev) {
var btn = ev.target.closest('[data-action]');
if (!btn) {
var menu = overlay.querySelector('.report-menu-list');
if (menu && !menu.hidden) menu.hidden = true;
return;
}
var act = btn.getAttribute('data-action');
if (act === 'report-menu-toggle') {
var m = overlay.querySelector('.report-menu-list');
if (m.hidden) syncReportMenu(m);
m.hidden = !m.hidden;
btn.setAttribute('aria-expanded', String(!m.hidden));
return;
}
var ml = overlay.querySelector('.report-menu-list');
if (ml) ml.hidden = true;
var mt = overlay.querySelector('[data-action="report-menu-toggle"]');
if (mt) mt.setAttribute('aria-expanded', 'false');
if (act === 'send-file' && window.RohPrint && window.RohPrint.sendPdf) {
toast('جارٍ تجهيز الملف…');
ux('report.send');
window.RohPrint.sendPdf(window.__printHtml || '', window.__printTitle || 'MoneyCode');
} else if (act === 'print-now' || act === 'send-file') {
try {
if (window.RohPrint && typeof window.RohPrint.printHtml === 'function') {
window.RohPrint.printHtml(window.__printHtml || '', window.__printTitle || 'MoneyCode');
} else {
iframe.contentWindow.focus();
setTimeout(function () { iframe.contentWindow.print(); }, 250);
}
} catch (e) { toast('تعذر الطباعة', true); }
} else if (act === 'close-print') {
overlay.remove();
} else if (act === 'excel-export') {
if (typeof window.__reportExcel === 'function') window.__reportExcel();
else toast('تصدير Excel غير متاح', true);
} else if (act === 'toggle-group-month') {
if (window.__reportOpts) { window.__reportOpts.groupByMonth = !window.__reportOpts.groupByMonth; applySearch(window.__reportFilter); }
} else if (act === 'toggle-group-currency') {
if (window.__reportOpts) { window.__reportOpts.groupByCurrency = !window.__reportOpts.groupByCurrency; applySearch(window.__reportFilter); }
} else if (act === 'toggle-auto-match') {
if (window.__reportOpts) { window.__reportOpts.autoMatch = !window.__reportOpts.autoMatch; applySearch(window.__reportFilter); }
} else if (act === 'toggle-from-last') {
if (window.__reportOpts) { window.__reportOpts.fromLastBalance = !window.__reportOpts.fromLastBalance; applySearch(window.__reportFilter); }
} else if (act === 'toggle-sort') {
if (window.__reportOpts) {
window.__reportOpts.sortBy = window.__reportOpts.sortBy === 'date' ? 'amount' : 'date';
applySearch(window.__reportFilter);
}
} else if (act === 'report-search') {
var panel = overlay.querySelector('.report-search');
panel.hidden = !panel.hidden;
btn.setAttribute('aria-expanded', String(!panel.hidden));
} else if (act === 'report-words-clear') {
wordsField.value = '';
btn.hidden = true;
wordsField.focus();
} else if (act === 'report-search-apply') {
var filter = readReportSearch(overlay);
if (!filter) return;
applySearch(filter);
overlay.querySelector('.report-search').hidden = true;
overlay.querySelector('.report-search-btn').setAttribute('aria-expanded', 'false');
overlay.querySelector('.report-search-btn').classList.add('active');
} else if (act === 'report-search-clear') {
overlay.querySelectorAll('.report-search input').forEach(function (input) { input.value = ''; });
overlay.querySelector('[data-action="report-words-clear"]').hidden = true;
applySearch(null);
overlay.querySelector('.report-search-btn').classList.remove('active');
}
});
}
function reportSearchHtml() {
return '<div class="report-search" hidden>' +
'<div class="report-search-row"><label>من<input data-field="from" type="date" /></label><label>إلى<input data-field="to" type="date" /></label></div>' +
'<div class="report-words"><input data-field="words" type="search" autocomplete="off" aria-label="كلمات" placeholder="كلمة من السرد أو اسم الطرف" />' +
'<button type="button" data-action="report-words-clear" aria-label="مسح الكلمات" hidden>' + UI_ICONS.close + '</button></div>' +
'<div class="report-search-row amounts"><input data-field="min" type="number" min="0" step="0.01" inputmode="decimal" aria-label="المبلغ من" placeholder="المبلغ من" />' +
'<input data-field="max" type="number" min="0" step="0.01" inputmode="decimal" aria-label="المبلغ إلى" placeholder="إلى" />' +
'<button type="button" class="btn primary small" data-action="report-search-apply">بحث</button><button type="button" class="btn ghost small" data-action="report-search-clear">مسح</button></div>' +
'</div>';
}
function readReportSearch(overlay) {
var read = function (field) { return overlay.querySelector('.report-search [data-field="' + field + '"]').value.trim(); };
var minor = function (value) { return value === '' ? null : Math.round(parseFloat(value) * 100); };
var filter = { from: read('from'), to: read('to'), words: read('words'), min: minor(read('min')), max: minor(read('max')) };
if (filter.from && filter.to && filter.from > filter.to) { toast('تاريخ البداية بعد تاريخ النهاية', true); return null; }
if (filter.min != null && filter.max != null && filter.min > filter.max) { toast('المبلغ الأدنى أكبر من الأعلى', true); return null; }
return filter;
}
function reportSearchText(f) {
if (!f) return '';
var parts = [];
if (f.from) parts.push('من ' + E.fmtDate(f.from));
if (f.to) parts.push('إلى ' + E.fmtDate(f.to));
if (f.words) parts.push('«' + f.words + '»');
var inMain = function (minor) { return E.fmtMoney(minor, E.mainCurrency(), false, true); };
if (f.min != null) parts.push('المبلغ من ' + inMain(f.min));
if (f.max != null) parts.push('المبلغ إلى ' + inMain(f.max));
return parts.join(' • ');
}
function statementMemo(e, line) {
var text = (line && line.note) || e.memo || kindMeta(e.kind).label;
if (e.kind === 'capital' && /^رصيد افتتاحي — /.test(text)) return 'رصيد افتتاحي';
return text;
}
function reportStyles() {
var root = document.documentElement;
var gcs = getComputedStyle(root);
var scale = gcs.getPropertyValue('--font-scale').trim() || '1';
var emerald = gcs.getPropertyValue('--emerald').trim() || '#064e3b';
var emerald950 = gcs.getPropertyValue('--emerald-950').trim() || '#03251c';
var emerald600 = gcs.getPropertyValue('--emerald-600').trim() || '#0b6b52';
var gold = gcs.getPropertyValue('--gold').trim() || '#d97706';
var goldSoft = gcs.getPropertyValue('--gold-soft').trim() || 'rgba(217, 119, 6, 0.14)';
var goldLine = gcs.getPropertyValue('--gold-line').trim() || 'rgba(217, 119, 6, 0.35)';
var sand = gcs.getPropertyValue('--sand').trim() || '#f6f4ef';
var paper = gcs.getPropertyValue('--paper').trim() || '#ffffff';
var ink = gcs.getPropertyValue('--ink').trim() || '#12211c';
var muted = gcs.getPropertyValue('--muted').trim() || '#5a6b63';
var line = gcs.getPropertyValue('--line').trim() || 'rgba(6, 78, 59, 0.12)';
var lineStrong = gcs.getPropertyValue('--line-strong').trim() || 'rgba(6, 78, 59, 0.22)';
var danger = gcs.getPropertyValue('--danger').trim() || '#b91c1c';
var ok = gcs.getPropertyValue('--ok').trim() || '#047857';
return (window.ROH_RIYAL_FONT_FACE || '') +
':root{--font-scale:' + scale + ';--emerald:' + emerald + ';--emerald-950:' + emerald950 + ';--emerald-600:' + emerald600 + ';--gold:' + gold + ';--gold-soft:' + goldSoft + ';--gold-line:' + goldLine + ';--sand:' + sand + ';--paper:' + paper + ';--ink:' + ink + ';--muted:' + muted + ';--line:' + line + ';--line-strong:' + lineStrong + ';--danger:' + danger + ';--ok:' + ok + '}' +
'@page { size: A4 portrait; margin: 14mm; }' +
'html{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
'body{font-family:MoneyRiyal,Tahoma,Arial,sans-serif;margin:0;padding:0;direction:rtl;color:#12211c;font-size: calc(13px * var(--font-scale, 1));line-height:1.45}' +
'@media screen{body{margin:10px}}' +
'h1{color:var(--emerald);text-align:center;margin:0 0 3px;font-size: calc(20px * var(--font-scale, 1))}' +
'.sub{text-align:center;color:#5a6b63;font-size: calc(12.5px * var(--font-scale, 1));margin-bottom:10px}' +
'.info{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin:10px 0;padding:8px 10px;border:1px solid #d5dbd8;border-radius:8px;background:#f6f4ef;font-size: calc(13px * var(--font-scale, 1))}' +
'.section{margin-top:16px;font-weight:800;color:var(--emerald);border-bottom:2px solid var(--emerald);padding-bottom:4px;font-size: calc(14px * var(--font-scale, 1))}' +
'table{width:100%;border-collapse:collapse;margin-top:8px}' +
'th,td{border:1px solid #cfd6d2;padding:7px 8px;font-size: calc(12.5px * var(--font-scale, 1));vertical-align:top}' +
'th{background:var(--emerald);color:#fff;text-align:right;font-weight:700;padding:4px 6px;font-size: calc(11px * var(--font-scale, 1));white-space:nowrap}' +
'tr{break-inside:avoid}' +
'tbody tr:nth-child(even) td{background:#fafaf7}' +
'.date{white-space:nowrap;width:1%}' +
'.num{text-align:left;direction:ltr;min-width:96px;white-space:normal;word-break:keep-all;overflow-wrap:break-word}' +
'.neg{color:#b91c1c}' +
'.head td{background:#f6f4ef;font-weight:800;color:var(--emerald)}' +
'tr.total td{font-weight:800;background:#ecebe4}' +
'.foot{margin-top:14px;font-size: calc(11px * var(--font-scale, 1));color:#5a6b63;text-align:center}' +
'@media screen and (max-width:600px){h1{font-size: calc(16px * var(--font-scale, 1))}' +
'th,td{padding:5px 4px;font-size: calc(10.5px * var(--font-scale, 1))}th{padding:3px 4px;font-size: calc(10px * var(--font-scale, 1))}' +
'.date{white-space:normal}.num{min-width:80px}.info{font-size: calc(11.5px * var(--font-scale, 1))}}';
}
function openCashFlowForm() {
var today = E.todayISO();
openSheet('تقرير التدفق النقدي',
'<div class="form-pair"><div class="form-row"><label for="flowFrom">من</label><input id="flowFrom" type="date" value="' + today.slice(0, 8) + '01" /></div>' +
'<div class="form-row"><label for="flowTo">إلى</label><input id="flowTo" type="date" value="' + today + '" /></div></div>' +
'<div class="modal-actions"><button class="btn primary" type="button" id="flowShow">عرض التقرير</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button></div>');
document.getElementById('flowShow').addEventListener('click', function () {
var from = document.getElementById('flowFrom').value;
var to = document.getElementById('flowTo').value;
if (!from || !to || from > to) { toast('اختر فترة صحيحة', true); return; }
closeSheet();
printCashFlow(from, to);
});
}
function printCashFlow(from, to) {
if (!allowStatementsOrPrompt('طباعة التقارير متاحة في باقة الأعمال. يمكنك عرضها على الشاشة وتصديرها في أي وقت.')) return;
window.__printTitle = 'التدفق النقدي (Cash Flow)';
window.__reportExcel = function () { exportCashFlowExcel(from, to); };
var report = E.cashFlowReport(from, to);
var titles = { operating: 'الأنشطة التشغيلية', debts: 'الديون لنا', financing: 'التمويل', other: 'حركات أخرى' };
var row = function (label, amount, cls) {
var taf = (cls === 'total') ? '<br><small style="font-weight:400;font-size:11px">' + esc(tafqit((Number(amount) || 0) / 100)) + ' ' + esc(E.BASE) + '</small>' : '';
return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + esc(label) + taf + '</td><td class="num">' + moneyText(amount) + '</td></tr>';
};
var groups = report.groups.filter(function (g) { return g.items.length; }).map(function (g) {
return '<tr class="head"><td colspan="2">' + esc(titles[g.id]) + '</td></tr>' +
g.items.map(function (item) { return row(kindMeta(item.kind).label, item.amount); }).join('') +
row('صافي ' + titles[g.id], g.net, 'total');
}).join('');
showReport('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>التدفق النقدي</title><style>' + reportStyles() + '</style></head><body>' +
'<h1>التدفق النقدي (Cash Flow)</h1>' +
'<div class="sub">موني كود — من ' + esc(String(from).replace(/-/g, '/')) + ' إلى ' + esc(String(to).replace(/-/g, '/')) + '</div>' +
'<table><thead><tr><th>البند</th><th>المبلغ</th></tr></thead><tbody>' +
row('السيولة أول الفترة', report.opening, 'total') +
(groups || '<tr><td colspan="2">لا توجد حركات نقدية في هذه الفترة.</td></tr>') +
row('صافي التغير', report.net, 'total') +
row('السيولة آخر الفترة', report.closing, 'total') +
'</tbody></table>' +
(function () {
var a = E.computeAnalysis();
var liqByCur = a.liquidityByCurrency || {};
var keys = Object.keys(liqByCur).filter(function (c) {
return liqByCur[c] && (liqByCur[c].native !== 0 || liqByCur[c].base !== 0);
});
if (!keys.length) return '';
var html = '<div class="section">السيولة حسب العملة</div><table><thead><tr><th>العملة</th><th>الرصيد الأصلي</th><th>المعادل بالعملة الأساسية</th></tr></thead><tbody>';
keys.forEach(function (c) {
html += '<tr><td>' + esc(currencyName(c) + ' (' + c + ')') + '</td><td class="num">' + moneyText(liqByCur[c].native, c) + '</td><td class="num">' + moneyText(liqByCur[c].base) + '</td></tr>';
});
html += '</tbody></table>';
return html;
})() +
'<div class="section">التدفق النقدي — 14 يوماً</div>' +
sparkline((E.computeAnalysis().spark || []).map(function (p) { return p.net; })) +
'<div class="foot">الحسابات السائلة فقط، ولا تظهر التحويلات بينها — تم الإنشاء بواسطة موني كود</div>' +
'</body></html>');
}
function balancesAsOf(date) {
var st = S();
var bal = {};
(st.accounts || []).forEach(function (a) { bal[a.id] = 0; });
(st.entries || []).forEach(function (e) {
if (!e || !e.date || e.date > date) return;
(e.lines || []).forEach(function (l) {
var acc = E.getAccount(l.accountId);
if (!acc) return;
var sign = acc.nature === 'debit' ? 1 : -1;
bal[acc.id] = (bal[acc.id] || 0) + sign * ((Number(l.debitBase) || 0) - (Number(l.creditBase) || 0));
});
});
return bal;
}
function openBalanceSheetCompare() {
var today = E.todayISO();
openSheet('مقارنة الميزانية (Balance Sheet Comparison)',
'<div class="form-pair"><div class="form-row"><label for="bscFrom">التاريخ الأول</label><input id="bscFrom" type="date" value="' + today.slice(0, 8) + '01" /></div>' +
'<div class="form-row"><label for="bscTo">التاريخ الثاني</label><input id="bscTo" type="date" value="' + today + '" /></div></div>' +
'<div class="modal-actions"><button class="btn primary" type="button" id="bscShow">عرض المقارنة</button>' +
'<button class="btn ghost" data-action="modal-cancel">إغلاق</button></div>');
document.getElementById('bscShow').addEventListener('click', function () {
var d1 = document.getElementById('bscFrom').value;
var d2 = document.getElementById('bscTo').value;
if (!d1 || !d2) { toast('اختر تاريخين', true); return; }
closeSheet();
printBalanceSheetCompare(d1, d2);
});
}
function printBalanceSheetCompare(d1, d2) {
if (!allowStatementsOrPrompt('طباعة التقارير متاحة في باقة الأعمال.')) return;
window.__printTitle = 'مقارنة الميزانية (Balance Sheet Comparison)';
var st = S();
var b1 = balancesAsOf(d1);
var b2 = balancesAsOf(d2);
var groups = [
{ title: 'الأصول (Assets)', type: 'asset' },
{ title: 'الخصوم (Liabilities)', type: 'liability' },
{ title: 'حقوق الملكية (Equity)', type: 'equity' },
];
var html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>مقارنة الميزانية</title><style>' + reportStyles() + '</style></head><body>' +
'<h1>مقارنة الميزانية (Balance Sheet Comparison)</h1>' +
'<div class="sub">موني كود — ' + esc(d1.replace(/-/g, '/')) + ' vs ' + esc(d2.replace(/-/g, '/')) + '</div>';
groups.forEach(function (g) {
var list = st.accounts.filter(function (a) { return a.type === g.type; });
html += '<div class="section">' + esc(g.title) + '</div><table><thead><tr><th>الحساب</th><th>' + esc(d1) + '</th><th>' + esc(d2) + '</th><th>الفرق</th></tr></thead><tbody>';
var tot1 = 0, tot2 = 0;
list.forEach(function (acc) {
var v1 = b1[acc.id] || 0;
var v2 = b2[acc.id] || 0;
tot1 += v1; tot2 += v2;
html += '<tr><td>' + esc(acc.name) + '</td><td class="num">' + moneyText(v1) + '</td><td class="num">' + moneyText(v2) + '</td><td class="num">' + moneyText(v2 - v1) + '</td></tr>';
});
html += '<tr class="total"><td>الإجمالي</td><td class="num">' + moneyText(tot1) + '</td><td class="num">' + moneyText(tot2) + '</td><td class="num">' + moneyText(tot2 - tot1) + '</td></tr>';
html += '</tbody></table>';
});
html += '<div class="foot">تم الإنشاء بواسطة موني كود</div></body></html>';
showReport(html);
}
function printBalanceSheet() {
if (!allowStatementsOrPrompt('طباعة التقارير متاحة في باقة الأعمال. يمكنك عرضها على الشاشة وتصديرها في أي وقت.')) return;
window.__printTitle = 'الميزانية (Balance Sheet)';
window.__reportExcel = function () { exportBalanceSheetExcel(); };
var a = E.computeAnalysis();
var st = S();
var now = new Date().toISOString().slice(0, 10);
var assets = st.accounts.filter(function (x) { return x.type === 'asset'; });
var liabilities = st.accounts.filter(function (x) { return x.type === 'liability'; });
var equity = st.accounts.filter(function (x) { return x.type === 'equity'; });
var rowsFor = function (list, oppositeType) {
var rows = list.filter(function (acc) {
var b = a.balances && a.balances[acc.id] ? a.balances[acc.id].base : 0;
return !(E.isAnomalous && E.isAnomalous(acc, b));
}).map(function (acc) {
var balObj = a.balances && a.balances[acc.id] ? a.balances[acc.id] : { native: 0, base: 0, byCurrency: {} };
var b = balObj.base || 0;
var byCur = balObj.byCurrency || {};
var curKeys = Object.keys(byCur).filter(function (c) { return byCur[c] && (byCur[c].native !== 0 || byCur[c].base !== 0); });
var curBreak = (curKeys.length > 1 || (curKeys.length === 1 && curKeys[0] !== E.BASE))
? '<br><small style="font-weight:400;font-size:11px;color:#555">' + curKeys.map(function (c) { return esc(c) + ': ' + moneyText(byCur[c].native, c); }).join(' • ') + '</small>'
: '';
return '<tr><td>' + esc(acc.name) + curBreak + '</td><td class="num">' + moneyText(b) + '</td></tr>';
});
if (oppositeType) {
var oppAccounts = st.accounts.filter(function (x) { return x.type === oppositeType; });
oppAccounts.forEach(function (acc) {
var b = a.balances && a.balances[acc.id] ? a.balances[acc.id].base : 0;
if (!E.isAnomalous || !E.isAnomalous(acc, b)) return;
rows.push('<tr><td>' + esc(acc.name) + ' <small style="color:var(--danger,#e53935)">(طباعته ' + (acc.nature === 'debit' ? 'مدين' : 'دائن') + ')</small></td><td class="num">' + moneyText(b) + '</td></tr>');
});
}
return rows.join('');
};
var totalAssets = a.assets || 0;
var totalLiab = a.liabilities || 0;
var totalEquity = a.equity || 0;
var html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>الميزانية</title>' +
'<style>' + reportStyles() + '</style></head><body>' +
'<h1>الميزانية (Balance Sheet)</h1>' +
'<div class="sub">موني كود — ' + esc(now) + '</div>' +
'<div class="section">الأصول (Assets)</div>' +
'<table><tbody>' + rowsFor(assets, 'liability') +
'<tr class="total"><td>إجمالي الأصول<br><small style="font-weight:400;font-size:11px">' + esc(tafqit(totalAssets / 100)) + '</small></td><td class="num">' + moneyText(totalAssets) + '</td></tr></tbody></table>' +
'<div class="section">الالتزامات (Liabilities)</div>' +
'<table><tbody>' + rowsFor(liabilities, 'asset') +
'<tr class="total"><td>إجمالي الالتزامات<br><small style="font-weight:400;font-size:11px">' + esc(tafqit(totalLiab / 100)) + '</small></td><td class="num">' + moneyText(totalLiab) + '</td></tr></tbody></table>' +
'<div class="section">حقوق الملكية (Equity)</div>' +
'<table><tbody>' + rowsFor(equity, null) +
'<tr class="total"><td>إجمالي حقوق الملكية<br><small style="font-weight:400;font-size:11px">' + esc(tafqit(totalEquity / 100)) + '</small></td><td class="num">' + moneyText(totalEquity) + '</td></tr></tbody></table>' +
'<div class="section">التحقق</div>' +
'<table><tbody>' +
'<tr><td>الأصول</td><td class="num">' + moneyText(totalAssets) + '</td></tr>' +
'<tr><td>الالتزامات + حقوق الملكية</td><td class="num">' + moneyText(totalLiab + totalEquity) + '</td></tr>' +
'<tr class="total"><td>الفرق</td><td class="num">' + moneyText(totalAssets - (totalLiab + totalEquity)) + '</td></tr>' +
'</tbody></table>' +
'<div class="section">الاتجاه الشهري (آخر 6 أشهر)</div>' +
(function () {
var st = S();
var byMonth = {};
(st.entries || []).forEach(function (e) {
if (!e || !e.date) return;
var ym = String(e.date).slice(0, 7);
if (!byMonth[ym]) byMonth[ym] = { inc: 0, exp: 0 };
(e.lines || []).forEach(function (l) {
var acc = E.getAccount(l.accountId);
if (!acc) return;
var amt = (Number(l.debitBase) || 0) - (Number(l.creditBase) || 0);
if (acc.type === 'expense') byMonth[ym].exp += Math.max(0, amt);
if (acc.type === 'revenue') byMonth[ym].inc += Math.max(0, -amt);
});
});
var months = Object.keys(byMonth).sort().slice(-6);
if (!months.length) return '<div class="empty" style="padding:12px;text-align:center">لا توجد بيانات شهرية.</div>';
var maxBar = 1;
months.forEach(function (m) { maxBar = Math.max(maxBar, byMonth[m].inc, byMonth[m].exp); });
var barW = 24, gap = 8, chartW = months.length * (barW * 2 + gap) + gap, chartH = 80;
var bars = '';
months.forEach(function (m, idx) {
var x = gap + idx * (barW * 2 + gap);
var incH = maxBar > 0 ? (byMonth[m].inc / maxBar) * (chartH - 12) : 0;
var expH = maxBar > 0 ? (byMonth[m].exp / maxBar) * (chartH - 12) : 0;
bars += '<rect x="' + x + '" y="' + (chartH - incH) + '" width="' + barW + '" height="' + incH + '" fill="var(--emerald)" opacity="0.85" rx="3"/>';
bars += '<rect x="' + (x + barW) + '" y="' + (chartH - expH) + '" width="' + barW + '" height="' + expH + '" fill="var(--danger)" opacity="0.8" rx="3"/>';
bars += '<text x="' + (x + barW) + '" y="' + (chartH + 11) + '" text-anchor="middle" font-size="9" fill="var(--muted)">' + esc(m.slice(5)) + '</text>';
});
return '<svg viewBox="0 0 ' + chartW + ' ' + (chartH + 14) + '" style="width:100%;height:auto;margin-top:6px" preserveAspectRatio="xMidYMid meet">' + bars + '</svg>' +
'<div style="display:flex;gap:12px;justify-content:center;margin-top:4px;font-size:calc(10px*var(--font-scale,1))">' +
'<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:var(--emerald)"></span>إيرادات</span>' +
'<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:var(--danger)"></span>مصروفات</span>' +
'</div>';
})() +
'<div class="foot">تم الإنشاء بواسطة موني كود — ' + esc(now) + '</div>' +
'</body></html>';
showReport(html);
}
function printProfitLoss() {
if (!allowStatementsOrPrompt('طباعة التقارير متاحة في باقة الأعمال. يمكنك عرضها على الشاشة وتصديرها في أي وقت.')) return;
window.__printTitle = 'الأرباح والخسائر (P&L)';
var a = E.computeAnalysis();
var st = S();
var now = new Date().toISOString().slice(0, 10);
var revenueAccs = st.accounts.filter(function (x) { return x.type === 'revenue'; });
var expenseAccs = st.accounts.filter(function (x) { return x.type === 'expense'; });
var rowsFor = function (list) {
return list.map(function (acc) {
var b = a.balances && a.balances[acc.id] ? a.balances[acc.id].base : 0;
return '<tr><td>' + esc(acc.name) + '<br><small style="font-weight:400;font-size:11px">' + esc(tafqit(Math.abs(b) / 100)) + '</small></td><td class="num">' + moneyText(Math.abs(b)) + '</td></tr>';
}).join('');
};
var totalRevenue = a.revenue || 0;
var totalExpense = a.expense || 0;
var net = totalRevenue - totalExpense;
var html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>الأرباح والخسائر</title>' +
'<style>' + reportStyles() + '</style></head><body>' +
'<h1>تقرير الأرباح والخسائر (P&L)</h1>' +
'<div class="sub">موني كود — ' + esc(now) + '</div>' +
'<div class="section">الإيرادات (Revenue)</div>' +
'<table><tbody>' + (rowsFor(revenueAccs) || '<tr><td colspan="2">لا توجد إيرادات.</td></tr>') +
'<tr class="total"><td>إجمالي الإيرادات<br><small style="font-weight:400;font-size:11px">' + esc(tafqit(totalRevenue / 100)) + '</small></td><td class="num">' + moneyText(totalRevenue) + '</td></tr></tbody></table>' +
'<div class="section">المصروفات (Expenses)</div>' +
'<table><tbody>' + (rowsFor(expenseAccs) || '<tr><td colspan="2">لا توجد مصروفات.</td></tr>') +
'<tr class="total"><td>إجمالي المصروفات<br><small style="font-weight:400;font-size:11px">' + esc(tafqit(totalExpense / 100)) + '</small></td><td class="num">' + moneyText(totalExpense) + '</td></tr></tbody></table>' +
'<div class="section">النتيجة</div>' +
'<table><tbody>' +
'<tr><td>الإيرادات</td><td class="num">' + moneyText(totalRevenue) + '</td></tr>' +
'<tr><td>المصروفات</td><td class="num">' + moneyText(totalExpense) + '</td></tr>' +
'<tr class="total"><td>صافي الربح / (الخسارة)<br><small style="font-weight:400;font-size:11px">' + esc(tafqit(net / 100)) + '</small></td><td class="num">' + moneyText(net) + '</td></tr>' +
'</tbody></table>' +
'<div class="foot">تم الإنشاء بواسطة موني كود — ' + esc(now) + '</div>' +
'</body></html>';
window.__printTitle = 'الأرباح والخسائر';
window.__reportExcel = function () { exportProfitLossExcel(); };
showReport(html);
}
function printSankey() {
if (!allowStatementsOrPrompt('طباعة التقارير متاحة في باقة الأعمال. يمكنك عرضها على الشاشة وتصديرها في أي وقت.')) return;
window.__printTitle = 'مخطط تدفق (Sankey)';
var a = E.computeAnalysis();
var st = S();
var now = new Date().toISOString().slice(0, 10);
var revAccs = st.accounts.filter(function (x) { return x.type === 'revenue' && (a.balances[x.id] ? a.balances[x.id].base : 0) > 0; });
var expAccs = st.accounts.filter(function (x) { return x.type === 'expense' && (a.balances[x.id] ? a.balances[x.id].base : 0) > 0; });
var totalRev = a.revenue || 0;
var totalExp = a.expense || 0;
if (revAccs.length === 0 && expAccs.length === 0) {
var html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>مخطط تدفق</title>' +
'<style>' + reportStyles() + '</style></head><body>' +
'<h1>مخطط تدفق (Sankey)</h1>' +
'<div class="sub">موني كود — ' + esc(now) + '</div>' +
'<div class="empty" style="padding:40px;text-align:center">لا توجد إيرادات أو مصروفات مسجلة.</div>' +
'</body></html>';
window.__printTitle = 'مخطط تدفق (Sankey)';
showReport(html);
return;
}
var maxVal = Math.max(totalRev, totalExp, 1);
var W = 800, H = 480, pad = 24;
var colW = 150;
var leftX = pad, midX = (W - colW) / 2, rightX = W - pad - colW;
var scale = (H - pad * 2) / Math.max(maxVal, 1);
var revY = pad, expY = pad;
var revNodes = revAccs.map(function (acc) {
var v = a.balances[acc.id].base;
var h = Math.max(6, v * scale);
var node = { id: acc.id, name: acc.name, value: v, x: leftX, y: revY, h: h };
revY += h + 6;
return node;
});
var expNodes = expAccs.map(function (acc) {
var v = Math.abs(a.balances[acc.id].base);
var h = Math.max(6, v * scale);
var node = { id: acc.id, name: acc.name, value: v, x: rightX, y: expY, h: h };
expY += h + 6;
return node;
});
var midH = Math.max(6, totalRev * scale);
var midY = (H - midH) / 2;
var midNode = { id: 'total', name: 'إجمالي', value: totalRev, x: midX, y: midY, h: midH };
var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;font-family:inherit" direction="ltr">';
revNodes.forEach(function (n) {
var linkH = Math.max(2, n.value * scale);
var y1 = n.y + n.h / 2;
var y2 = midNode.y + midNode.h / 2;
var x1 = n.x + colW, x2 = midNode.x;
var cx = (x1 + x2) / 2;
svg += '<path d="M' + x1 + ',' + y1 + ' C' + cx + ',' + y1 + ' ' + cx + ',' + y2 + ' ' + x2 + ',' + y2 + '" fill="none" stroke="var(--emerald)" stroke-opacity="0.28" stroke-width="' + linkH + '" stroke-linecap="round"/>';
});
expNodes.forEach(function (n) {
var linkH = Math.max(2, n.value * scale);
var y1 = midNode.y + midNode.h / 2;
var y2 = n.y + n.h / 2;
var x1 = midNode.x + colW, x2 = n.x;
var cx = (x1 + x2) / 2;
svg += '<path d="M' + x1 + ',' + y1 + ' C' + cx + ',' + y1 + ' ' + cx + ',' + y2 + ' ' + x2 + ',' + y2 + '" fill="none" stroke="rgba(185,28,28,0.25)" stroke-width="' + linkH + '" stroke-linecap="round"/>';
});
revNodes.forEach(function (n) {
svg += '<rect x="' + n.x + '" y="' + n.y + '" width="' + colW + '" height="' + n.h + '" rx="4" fill="var(--emerald)" opacity="0.85"><title>' + esc(n.name) + ' — ' + moneyText(n.value) + '</title></rect>';
svg += '<text x="' + (n.x - 4) + '" y="' + (n.y + n.h / 2 + 4) + '" text-anchor="end" font-size="11" fill="var(--ink)">' + esc(n.name.length > 12 ? n.name.slice(0, 11) + '…' : n.name) + ' (' + moneyText(n.value) + ')</text>';
});
svg += '<rect x="' + midNode.x + '" y="' + midNode.y + '" width="' + colW + '" height="' + midNode.h + '" rx="4" fill="var(--gold)" opacity="0.9"/>';
svg += '<text x="' + (midNode.x + colW / 2) + '" y="' + (midNode.y + midNode.h / 2 + 4) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">إجمالي ' + moneyText(totalRev) + '</text>';
expNodes.forEach(function (n) {
svg += '<rect x="' + n.x + '" y="' + n.y + '" width="' + colW + '" height="' + n.h + '" rx="4" fill="#b91c1c" opacity="0.85"><title>' + esc(n.name) + ' — ' + moneyText(n.value) + '</title></rect>';
svg += '<text x="' + (n.x + colW + 4) + '" y="' + (n.y + n.h / 2 + 4) + '" text-anchor="start" font-size="11" fill="var(--ink)">' + esc(n.name.length > 12 ? n.name.slice(0, 11) + '…' : n.name) + ' (' + moneyText(n.value) + ')</text>';
});
svg += '</svg>';
var html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>مخطط تدفق</title>' +
'<style>' + reportStyles() + '</style></head><body>' +
'<h1>مخطط تدفق (Sankey)</h1>' +
'<div class="sub">موني كود — ' + esc(now) + '</div>' +
'<div class="info">' +
'<span><b>إجمالي الإيرادات:</b> ' + moneyText(totalRev) + '</span>' +
'<span><b>إجمالي المصروفات:</b> ' + moneyText(totalExp) + '</span>' +
'<span><b>صافي:</b> ' + moneyText(totalRev - totalExp) + '</span>' +
'</div>' +
svg +
'<div style="display:flex;gap:12px;justify-content:center;margin-top:8px;font-size:calc(11px * var(--font-scale,1))">' +
'<span><span style="display:inline-block;width:12px;height:12px;background:var(--emerald);border-radius:3px;margin-inline-end:4px;vertical-align:middle"></span>إيرادات</span>' +
'<span><span style="display:inline-block;width:12px;height:12px;background:var(--gold);border-radius:3px;margin-inline-end:4px;vertical-align:middle"></span>إجمالي</span>' +
'<span><span style="display:inline-block;width:12px;height:12px;background:#b91c1c;border-radius:3px;margin-inline-end:4px;vertical-align:middle"></span>مصروفات</span>' +
'</div>' +
'<div class="foot">تم الإنشاء بواسطة موني كود — ' + esc(now) + '</div>' +
'</body></html>';
window.__printTitle = 'مخطط تدفق (Sankey)';
window.__reportExcel = function () { exportSankeyExcel(revNodes, expNodes, totalRev, totalExp); };
showReport(html);
}
function exportSankeyExcel(revNodes, expNodes, totalRev, totalExp) {
var rows = [['النوع', 'الحساب', 'المبلغ']];
revNodes.forEach(function (n) { rows.push(['إيراد', n.name, n.value / 100]); });
rows.push(['إجمالي الإيرادات', 'total', totalRev / 100]);
expNodes.forEach(function (n) { rows.push(['مصروف', n.name, n.value / 100]); });
rows.push(['إجمالي المصروفات', 'total', totalExp / 100]);
rows.push(['صافي', 'total', (totalRev - totalExp) / 100]);
var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
var url = URL.createObjectURL(blob);
var a = document.createElement('a'); a.href = url; a.download = 'sankey.csv';
document.body.appendChild(a); a.click(); document.body.removeChild(a);
setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
toast('تم تصدير الملف');
}
function openZakat() {
var a = E.computeAnalysis();
var st = S();
var assets = a.assets || 0;
var liab = a.liabilities || 0;
var base = Math.max(0, assets - liab);
var zcfg = zakatConfig();
var nisab = zcfg.nisabMinor;
var zrate = zcfg.rate;
var due = Math.round(base * (zrate / 100));
var eligible = base >= nisab;
var assetRows = st.accounts.filter(function (x) { return x.type === 'asset'; }).map(function (acc) {
var balObj = a.balances && a.balances[acc.id] ? a.balances[acc.id] : { native: 0, base: 0, byCurrency: {} };
var b = balObj.base || 0;
var byCur = balObj.byCurrency || {};
var curKeys = Object.keys(byCur).filter(function (c) { return byCur[c] && (byCur[c].native !== 0 || byCur[c].base !== 0); });
var curBreak = (curKeys.length > 1 || (curKeys.length === 1 && curKeys[0] !== E.BASE))
? '<br><small style="font-weight:400;font-size:11px;color:#555">' + curKeys.map(function (c) { return esc(c) + ': ' + moneyText(byCur[c].native, c); }).join(' • ') + '</small>'
: '';
return '<tr><td>' + esc(acc.name) + curBreak + '</td><td class="num">' + moneyText(b) + '</td></tr>';
}).join('');
var liabRows = st.accounts.filter(function (x) { return x.type === 'liability'; }).map(function (acc) {
var balObj = a.balances && a.balances[acc.id] ? a.balances[acc.id] : { native: 0, base: 0, byCurrency: {} };
var b = balObj.base || 0;
var byCur = balObj.byCurrency || {};
var curKeys = Object.keys(byCur).filter(function (c) { return byCur[c] && (byCur[c].native !== 0 || byCur[c].base !== 0); });
var curBreak = (curKeys.length > 1 || (curKeys.length === 1 && curKeys[0] !== E.BASE))
? '<br><small style="font-weight:400;font-size:11px;color:#555">' + curKeys.map(function (c) { return esc(c) + ': ' + moneyText(byCur[c].native, c); }).join(' • ') + '</small>'
: '';
return '<tr><td>' + esc(acc.name) + curBreak + '</td><td class="num">' + moneyText(b) + '</td></tr>';
}).join('');
var html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>زكاة النقود والمدخرات</title>' +
'<style>' + reportStyles() + '</style></head><body>' +
'<h1>زكاة النقود والمدخرات (' + zrate + '%)</h1>' +
'<div class="sub">موني كود — ' + esc(new Date().toISOString().slice(0, 10)) + '</div>' +
'<div class="section">الأصول (Zakatable assets)</div>' +
'<table><tbody>' + (assetRows || '<tr><td colspan="2">لا توجد أصول.</td></tr>') +
'<tr class="total"><td>إجمالي الأصول<br><small style="font-weight:400;font-size:11px">' + esc(tafqit(assets / 100)) + '</small></td><td class="num">' + moneyText(assets) + '</td></tr></tbody></table>' +
'<div class="section">الالتزامات (Deductions)</div>' +
'<table><tbody>' + (liabRows || '<tr><td colspan="2">لا توجد التزامات.</td></tr>') +
'<tr class="total"><td>إجمالي الالتزامات<br><small style="font-weight:400;font-size:11px">' + esc(tafqit(liab / 100)) + '</small></td><td class="num">' + moneyText(liab) + '</td></tr></tbody></table>' +
'<div class="section">الحساب</div>' +
'<table><tbody>' +
'<tr><td>صافي الثروة (الأصول − الالتزامات)</td><td class="num">' + moneyText(base) + '</td></tr>' +
'<tr><td>النصاب (≈ 85 غرام ذهب)</td><td class="num">' + moneyText(nisab) + '</td></tr>' +
'<tr><td>الحالة</td><td class="num">' + (eligible ? 'بلغ النصاب ✓' : 'لم يبلغ النصاب') + '</td></tr>' +
'<tr class="total"><td>الزكاة المستحقة (2.5%)<br><small style="font-weight:400;font-size:11px">' + esc(tafqit((eligible ? due : 0) / 100)) + '</small></td><td class="num">' + moneyText(eligible ? due : 0) + '</td></tr>' +
'</tbody></table>' +
'<div class="foot">الزكاة 2.5% من صافي الثروة إذا بلغ النصاب وحال عليه الحول (سنة هجرية). تم الإنشاء بواسطة موني كود</div>' +
'</body></html>';
window.__printTitle = 'زكاة النقود والمدخرات';
window.__reportExcel = function () { exportZakatExcel(); };
showReport(html);
}
function printDebtAging() {
if (!allowStatementsOrPrompt('طباعة التقارير متاحة في باقة الأعمال. يمكنك عرضها على الشاشة وتصديرها في أي وقت.')) return;
window.__printTitle = 'أعمار الديون (Debt Aging)';
var a = E.computeAnalysis();
var st = S();
var now = new Date().toISOString().slice(0, 10);
var today = E.todayISO();
var dueItems = (a.dueItems || []).slice().sort(function (x, y) {
return (x.counterparty || '').localeCompare(y.counterparty || '', 'ar');
});
var bucketOf = function (d) {
if (!d.dueDate) return 'غير محدد';
var diff = E.daysBetween(d.dueDate, today);
if (diff <= 0) return 'جاري';
if (diff <= 30) return '1-30 يوم';
if (diff <= 60) return '31-60 يوم';
if (diff <= 90) return '61-90 يوم';
return 'أكثر من 90';
};
var bucketOrder = ['جاري', '1-30 يوم', '31-60 يوم', '61-90 يوم', 'أكثر من 90', 'غير محدد'];
var byParty = {};
dueItems.forEach(function (d) {
var key = d.counterparty || 'غير محدد';
if (!byParty[key]) byParty[key] = [];
byParty[key].push(d);
});
var partyNames = Object.keys(byParty).sort(function (x, y) { return x.localeCompare(y, 'ar'); });
var bucketTotals = {};
bucketOrder.forEach(function (b) { bucketTotals[b] = { receivable: 0, payable: 0 }; });
dueItems.forEach(function (d) {
var b = bucketOf(d);
if (!bucketTotals[b]) bucketTotals[b] = { receivable: 0, payable: 0 };
if (d.kind === 'payable') bucketTotals[b].payable += (Number(d.remaining) || 0);
else bucketTotals[b].receivable += (Number(d.remaining) || 0);
});
var partyRows = partyNames.map(function (name) {
var items = byParty[name];
var itemRows = items.map(function (d) {
var payable = d.kind === 'payable';
var age = d.dueDate ? E.daysBetween(d.dueDate, today) : 0;
var ageText = age <= 0 ? '—' : (age + ' يوم');
var remText = (d.currency && d.currency !== E.BASE && d.remainingNative)
? moneyText(d.remainingNative, d.currency) + '<br><small style="color:#666">(' + moneyText(d.remaining) + ')</small>'
: moneyText(d.remaining);
return '<tr>' +
'<td class="date">' + esc(d.dueDate ? String(d.dueDate).replace(/-/g, '/') : '—') + '</td>' +
'<td>' + (payable ? 'علينا' : 'لنا') + '</td>' +
'<td>' + esc(d.memo || '') + '</td>' +
'<td>' + esc(bucketOf(d)) + '</td>' +
'<td class="num">' + ageText + '</td>' +
'<td class="num' + (payable ? ' neg' : '') + '">' + remText + '</td>' +
'</tr>';
}).join('');
var partyRec = items.reduce(function (s, d) { return s + (d.kind === 'payable' ? 0 : (Number(d.remaining) || 0)); }, 0);
var partyPay = items.reduce(function (s, d) { return s + (d.kind === 'payable' ? (Number(d.remaining) || 0) : 0); }, 0);
var partyNet = partyRec - partyPay;
return '<tr class="head"><td colspan="6">' + esc(name) + ' — لنا: ' + moneyText(partyRec) + ' / علينا: ' + moneyText(partyPay) + ' / صافي: ' + moneyText(partyNet) + '</td></tr>' + itemRows;
}).join('');
var bucketRows = bucketOrder.map(function (b) {
var bt = bucketTotals[b];
if (!bt || (bt.receivable === 0 && bt.payable === 0)) return '';
var net = bt.receivable - bt.payable;
return '<tr><td>' + esc(b) + '</td><td class="num">' + moneyText(bt.receivable) + '</td><td class="num">' + moneyText(bt.payable) + '</td><td class="num">' + moneyText(net) + '</td></tr>';
}).join('');
var totalRec = dueItems.reduce(function (s, d) { return s + (d.kind === 'payable' ? 0 : (Number(d.remaining) || 0)); }, 0);
var totalPay = dueItems.reduce(function (s, d) { return s + (d.kind === 'payable' ? (Number(d.remaining) || 0) : 0); }, 0);
var html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>أعمار الديون</title>' +
'<style>' + reportStyles() + '</style></head><body>' +
'<h1>تقرير أعمار الديون (Debt Aging)</h1>' +
'<div class="sub">موني كود — ' + esc(now) + '</div>' +
'<div class="info">' +
'<span><b>إجمالي مستحقات لنا:</b> ' + moneyText(totalRec) + ' (' + esc(tafqit(totalRec / 100)) + ')</span>' +
'<span><b>إجمالي مستحقات علينا:</b> ' + moneyText(totalPay) + ' (' + esc(tafqit(totalPay / 100)) + ')</span>' +
'<span><b>الصافي:</b> ' + moneyText(totalRec - totalPay) + '</span>' +
'<span><b>عدد البنود:</b> ' + dueItems.length + '</span>' +
'</div>' +
'<h2>ملخص حسب العمر</h2>' +
'<table><thead><tr><th>الفترة</th><th>لنا</th><th>علينا</th><th>الصافي</th></tr></thead><tbody>' +
(bucketRows || '<tr><td colspan="4">لا توجد ذمم مفتوحة.</td></tr>') +
'<tr class="total"><td>الإجمالي</td><td class="num">' + moneyText(totalRec) + '</td><td class="num">' + moneyText(totalPay) + '</td><td class="num">' + moneyText(totalRec - totalPay) + '</td></tr>' +
'</tbody></table>' +
'<h2>التفاصيل حسب الطرف</h2>' +
'<table><thead><tr><th>الاستحقاق</th><th>النوع</th><th>البيان</th><th>الفترة</th><th>العمر</th><th>المتبقي</th></tr></thead><tbody>' +
(partyRows || '<tr><td colspan="6">لا توجد ذمم مفتوحة.</td></tr>') +
'</tbody></table>' +
'<div class="section">مخطط أعمار الديون</div>' +
(function () {
var bks = ['جاري','1-30 يوم','31-60 يوم','61-90 يوم','أكثر من 90'];
var maxB = 1;
bks.forEach(function (b) { if (bucketTotals[b]) maxB = Math.max(maxB, bucketTotals[b].receivable || 0, bucketTotals[b].payable || 0); });
var bars = '';
var barW = 36, gap = 10, chartW = bks.length * (barW * 2 + gap) + gap, chartH = 90;
bks.forEach(function (b, i) {
var bt = bucketTotals[b] || { receivable: 0, payable: 0 };
if (!bt.receivable && !bt.payable) return;
var x = gap + i * (barW * 2 + gap);
var recH = maxB > 0 ? ((bt.receivable || 0) / maxB) * (chartH - 14) : 0;
var payH = maxB > 0 ? ((bt.payable || 0) / maxB) * (chartH - 14) : 0;
bars += '<rect x="' + x + '" y="' + (chartH - recH) + '" width="' + barW + '" height="' + recH + '" fill="var(--emerald)" opacity="0.85" rx="3"/>';
bars += '<rect x="' + (x + barW) + '" y="' + (chartH - payH) + '" width="' + barW + '" height="' + payH + '" fill="var(--danger)" opacity="0.8" rx="3"/>';
bars += '<text x="' + (x + barW) + '" y="' + (chartH + 12) + '" text-anchor="middle" font-size="9" fill="var(--muted)">' + esc(b) + '</text>';
});
if (!bars) return '<div class="empty" style="padding:12px;text-align:center">لا توجد ذمم مفتوحة.</div>';
return '<svg viewBox="0 0 ' + chartW + ' ' + (chartH + 16) + '" style="width:100%;height:auto;margin-top:6px" preserveAspectRatio="xMidYMid meet">' + bars + '</svg>' +
'<div style="display:flex;gap:12px;justify-content:center;margin-top:4px;font-size:calc(10px*var(--font-scale,1))">' +
'<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:var(--emerald)"></span>لنا</span>' +
'<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:var(--danger)"></span>علينا</span>' +
'</div>';
})() +
'<div class="foot">تم الإنشاء بواسطة موني كود — ' + esc(now) + '</div>' +
'</body></html>';
window.__printTitle = 'أعمار الديون';
window.__reportExcel = function () { exportDebtAgingExcel(); };
showReport(html);
}
window.__rohPdfFailed = function () { toast('تعذر تجهيز الملف', true); };
function numberPages(html) {
var PAGE_LIMIT = 900;
var frame = document.createElement('iframe');
frame.style.cssText = 'position:fixed;left:-9999px;top:0;width:174mm;height:1000px;visibility:hidden';
document.body.appendChild(frame);
try {
var doc = frame.contentDocument;
doc.open();
doc.write(html);
doc.close();
var height = function (node) {
var style = frame.contentWindow.getComputedStyle(node);
return node.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
};
var page = doc.createElement('section');
var pages = [page];
var used = 0;
var startPage = function () {
page = doc.createElement('section');
pages.push(page);
used = 0;
var compactHdr = doc.createElement('div');
compactHdr.style.cssText = 'font-size:10px;color:#5a6b63;margin:0 0 6px;padding-bottom:4px;border-bottom:1px solid #d5dbd8;';
compactHdr.textContent = (headerNodes.length && headerNodes[0].textContent ? headerNodes[0].textContent : '') + (compactAccount ? ' — ' + compactAccount : '') + '';
page.appendChild(compactHdr);
used += height(compactHdr);
};
var firstRowHeight = function (table) {
var row = table && table.tagName === 'TABLE' ? table.querySelector('tbody tr') : null;
return row ? height(row) + (table.tHead ? height(table.tHead) : 0) : 0;
};
var headerNodes = Array.prototype.slice.call(doc.body.children).filter(function (n) {
return n.tagName === 'H1' || (n.classList && (n.classList.contains('sub') || n.classList.contains('info')));
});
var compactAccount = '';
var infoNode = headerNodes.filter(function (n) { return n.classList && n.classList.contains('info'); })[0];
if (infoNode) {
var b = infoNode.querySelector('b');
if (b) compactAccount = b.textContent.trim();
}
Array.prototype.slice.call(doc.body.children).forEach(function (block) {
if (block.tagName !== 'TABLE') {
if (used && used + height(block) + firstRowHeight(block.nextElementSibling) > PAGE_LIMIT) startPage();
page.appendChild(block.cloneNode(true));
used += height(block);
return;
}
var body = null;
Array.prototype.slice.call(block.querySelectorAll('tbody tr')).forEach(function (row) {
if (used && used + height(row) > PAGE_LIMIT) { startPage(); body = null; }
if (!body) {
var table = block.cloneNode(false);
if (block.tHead) { table.appendChild(block.tHead.cloneNode(true)); used += height(block.tHead); }
body = table.appendChild(doc.createElement('tbody'));
page.appendChild(table);
}
body.appendChild(row.cloneNode(true));
used += height(row);
});
});
var style = doc.createElement('style');
style.textContent = 'section{break-after:page}section:last-child{break-after:auto}' +
'.page-no{margin-top:10px;text-align:center;color:#6b7c74;font-size: calc(10px * var(--font-scale, 1))}' +
'@media screen{section+section{border-top:1px dashed #ccc;margin-top:14px;padding-top:14px}}';
doc.head.appendChild(style);
doc.body.innerHTML = '';
pages.forEach(function (section, index) {
var number = doc.createElement('div');
number.className = 'page-no';
number.textContent = 'صفحة ' + (index + 1) + ' من ' + pages.length + ' • نُظّم بواسطة تطبيق موني كود (محاسبك الذكي بدون إنترنت — متوفر على Google Play)';
section.appendChild(number);
doc.body.appendChild(section);
});
return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
} catch (e) {
console.error('[RohUI] page numbers failed', e);
return html;
} finally {
frame.remove();
}
}
function exportStatementExcel(acc) {
if (!acc) { toast('الحساب غير موجود', true); return; }
var st = S();
var id = acc.id;
var entries = st.entries.filter(function (e) { return (e.lines || []).some(function (l) { return l.accountId === id; }); }).sort(function (x, y) { return x.date < y.date ? -1 : 1; });
var rows = [['التاريخ', 'السرد', 'العملة', 'المبلغ الأصلي', 'مدين (أساسي)', 'دائن (أساسي)', 'الرصيد (أساسي)', 'الحالة']];
var running = 0;
entries.forEach(function (e) {
var matchLines = (e.lines || []).filter(function (l) { return l.accountId === id; });
matchLines.forEach(function (line) {
var rowCurrency = line ? (line.currency || acc.currency) : acc.currency;
var debit = line ? (line.debitBase || line.debit || 0) : 0;
var credit = line ? (line.creditBase || line.credit || 0) : 0;
var debitNative = line ? (line.debit || 0) : 0;
var creditNative = line ? (line.credit || 0) : 0;
var net = debit - credit;
var signed = acc.nature === 'debit' ? net : -net;
running += signed;
rows.push([e.date, (e.memo || kindMeta(e.kind).label), rowCurrency, ((debitNative || creditNative) / 100), debit / 100, credit / 100, running / 100, signed >= 0 ? 'له' : 'عليه']);
});
});
var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
var url = URL.createObjectURL(blob);
var a = document.createElement('a');
a.href = url;
a.download = (acc.name || 'statement') + '.csv';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
toast('تم تصدير الملف');
}
function exportDashboardExcel() {
var a = E.computeAnalysis();
var st = S();
var rows = [['المؤشر', 'القيمة']];
rows.push(['السيولة', (a.liquidity || 0) / 100]);
rows.push(['صافي الثروة', (a.netWorth || 0) / 100]);
rows.push(['الأصول', (a.assets || 0) / 100]);
rows.push(['الخصوم', (a.liabilities || 0) / 100]);
rows.push(['حقوق الملكية', (a.equity || 0) / 100]);
rows.push(['الإيرادات', (a.revenue || 0) / 100]);
rows.push(['المصروفات', (a.expense || 0) / 100]);
rows.push(['الربح', (a.profit || 0) / 100]);
rows.push(['حرق 30 يوم', (a.burn30 || 0) / 100]);
rows.push(['دخل 30 يوم', (a.income30 || 0) / 100]);
rows.push(['أيام المدى المالي', a.runwayDays === null ? '—' : a.runwayDays]);
rows.push(['احتمال الضغط %', a.crisis]);
rows.push(['عدد القيود', a.entryCount]);
rows.push(['', '']);
rows.push(['الاستحقاقات (Receivables/Payables)', '']);
(a.dueItems || []).forEach(function (d) {
rows.push([ (d.kind === 'payable' ? 'علينا: ' : 'لنا: ') + (d.counterparty || 'غير محدد'), (d.remaining || 0) / 100 ]);
});
rows.push(['', '']);
rows.push(['نضج الاستحقاقات', '']);
var mb = a.maturityBuckets || {};
['overdue','soon','month','later'].forEach(function (k) {
if (mb[k]) rows.push([k, (mb[k].total || 0) / 100]);
});
var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
var url = URL.createObjectURL(blob);
var a2 = document.createElement('a'); a2.href = url; a2.download = 'dashboard.csv';
document.body.appendChild(a2); a2.click(); document.body.removeChild(a2);
setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
toast('تم تصدير لوحة القيادة (CSV)');
}
function exportBalanceSheetExcel() {
var a = E.computeAnalysis();
var st = S();
var rows = [['الحساب', 'النوع', 'الرصيد']];
st.accounts.forEach(function (acc) {
var b = a.balances && a.balances[acc.id] ? a.balances[acc.id].base : 0;
rows.push([acc.name, acc.type, b / 100]);
});
rows.push(['إجمالي الأصول', 'total', (a.assets || 0) / 100]);
rows.push(['إجمالي الالتزامات', 'total', (a.liabilities || 0) / 100]);
rows.push(['إجمالي حقوق الملكية', 'total', (a.equity || 0) / 100]);
var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
var url = URL.createObjectURL(blob);
var a2 = document.createElement('a');
a2.href = url; a2.download = 'balance-sheet.csv';
document.body.appendChild(a2); a2.click(); document.body.removeChild(a2);
setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
toast('تم تصدير الملف');
}
function exportCashFlowExcel(from, to) {
var report = E.cashFlowReport ? E.cashFlowReport(from, to) : null;
var rows = [['البند', 'المبلغ']];
if (report) {
rows.push(['السيولة أول الفترة', (report.opening || 0) / 100]);
(report.groups || []).forEach(function (g) {
(g.items || []).forEach(function (it) { rows.push([kindMeta(it.kind).label, (it.amount || 0) / 100]); });
rows.push(['صافي ' + (g.id === 'in' ? 'الوارد' : 'الصادر'), (g.net || 0) / 100]);
});
rows.push(['صافي التغير', (report.net || 0) / 100]);
rows.push(['السيولة آخر الفترة', (report.closing || 0) / 100]);
}
var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
var url = URL.createObjectURL(blob);
var a = document.createElement('a'); a.href = url; a.download = 'cash-flow.csv';
document.body.appendChild(a); a.click(); document.body.removeChild(a);
setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
toast('تم تصدير الملف');
}
function exportZakatExcel() {
var a = E.computeAnalysis();
var st = S();
var assets = a.assets || 0;
var liab = a.liabilities || 0;
var base = Math.max(0, assets - liab);
var zcfg = zakatConfig();
var nisab = zcfg.nisabMinor;
var zrate = zcfg.rate;
var due = Math.round(base * (zrate / 100));
var eligible = base >= nisab;
var rows = [['الحساب', 'النوع', 'الرصيد']];
st.accounts.filter(function (x) { return x.type === 'asset'; }).forEach(function (acc) {
var b = a.balances && a.balances[acc.id] ? a.balances[acc.id].base : 0;
rows.push([acc.name, 'asset', b / 100]);
});
st.accounts.filter(function (x) { return x.type === 'liability'; }).forEach(function (acc) {
var b = a.balances && a.balances[acc.id] ? a.balances[acc.id].base : 0;
rows.push([acc.name, 'liability', b / 100]);
});
rows.push(['صافي الثروة', 'total', base / 100]);
rows.push(['النصاب', 'total', nisab / 100]);
rows.push(['الزكاة المستحقة', 'total', (eligible ? due : 0) / 100]);
var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
var url = URL.createObjectURL(blob);
var a2 = document.createElement('a'); a2.href = url; a2.download = 'zakat.csv';
document.body.appendChild(a2); a2.click(); document.body.removeChild(a2);
setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
toast('تم تصدير الملف');
}
function exportDebtAgingExcel() {
var a = E.computeAnalysis();
var today = E.todayISO();
var dueItems = (a.dueItems || []).slice();
var rows = [['الطرف', 'النوع', 'الاستحقاق', 'المتبقي', 'العمر (أيام)', 'الفترة']];
var bucketOf = function (d) {
if (!d.dueDate) return 'غير محدد';
var diff = E.daysBetween(d.dueDate, today);
if (diff <= 0) return 'جاري';
if (diff <= 30) return '1-30 يوم';
if (diff <= 60) return '31-60 يوم';
if (diff <= 90) return '61-90 يوم';
return 'أكثر من 90';
};
dueItems.forEach(function (d) {
var payable = d.kind === 'payable';
var age = d.dueDate ? E.daysBetween(d.dueDate, today) : 0;
rows.push([d.counterparty || '', payable ? 'علينا' : 'لنا', d.dueDate || '', (Number(d.remaining) || 0) / 100, age, bucketOf(d)]);
});
var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
var url = URL.createObjectURL(blob);
var a2 = document.createElement('a'); a2.href = url; a2.download = 'debt-aging.csv';
document.body.appendChild(a2); a2.click(); document.body.removeChild(a2);
setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
toast('تم تصدير الملف');
}
function exportProfitLossExcel() {
var a = E.computeAnalysis();
var st = S();
var rows = [['الحساب', 'النوع', 'المبلغ']];
st.accounts.filter(function (x) { return x.type === 'revenue'; }).forEach(function (acc) {
var b = a.balances && a.balances[acc.id] ? a.balances[acc.id].base : 0;
rows.push([acc.name, 'revenue', Math.abs(b) / 100]);
});
rows.push(['إجمالي الإيرادات', 'total', (a.revenue || 0) / 100]);
st.accounts.filter(function (x) { return x.type === 'expense'; }).forEach(function (acc) {
var b = a.balances && a.balances[acc.id] ? a.balances[acc.id].base : 0;
rows.push([acc.name, 'expense', Math.abs(b) / 100]);
});
rows.push(['إجمالي المصروفات', 'total', (a.expense || 0) / 100]);
rows.push(['صافي الربح/(الخسارة)', 'total', ((a.revenue || 0) - (a.expense || 0)) / 100]);
var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
var url = URL.createObjectURL(blob);
var a2 = document.createElement('a'); a2.href = url; a2.download = 'profit-loss.csv';
document.body.appendChild(a2); a2.click(); document.body.removeChild(a2);
setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
toast('تم تصدير الملف');
}
function exportCounterpartyExcel(name) {
var cp = E.counterpartyBalance ? E.counterpartyBalance(name) : { entries: [], dueItems: [] };
var rows = [['التاريخ', 'النوع', 'السرد', 'المبلغ', 'الرصيد']];
var running = 0;
(cp.entries || []).forEach(function (e) {
var amt = Number(e.totalBase) || 0;
var signed = amt * (e.kind === 'expense' || e.kind === 'repay' ? -1 : 1);
running += signed;
rows.push([e.date, e.kind, (e.memo || ''), signed / 100, running / 100]);
});
var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
var url = URL.createObjectURL(blob);
var a = document.createElement('a'); a.href = url; a.download = (name || 'counterparty') + '.csv';
document.body.appendChild(a); a.click(); document.body.removeChild(a);
setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
toast('تم تصدير الملف');
}
function tafqit(num) {
if (isNaN(num)) return '';
var neg = num < 0;
num = Math.abs(num);
var intPart = Math.floor(num);
var frac = Math.round((num - intPart) * 100);
var words = intToArabicWords(intPart);
if (frac > 0) words += ' و ' + intToArabicWords(frac) + ' هللة';
if (neg) words = 'سالب ' + words;
return words || 'صفر';
}
function intToArabicWords(n) {
if (n === 0) return 'صفر';
var ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
var teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
var tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
var hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
function threeDigits(num) {
if (num === 0) return '';
var h = Math.floor(num / 100);
var r = num % 100;
var parts = [];
if (h > 0) parts.push(hundreds[h]);
if (r > 0) {
if (r < 10) parts.push(ones[r]);
else if (r < 20) parts.push(teens[r - 10]);
else {
var t = Math.floor(r / 10);
var o = r % 10;
if (o > 0) parts.push(ones[o]);
parts.push(tens[t]);
}
}
return parts.join(' و ');
}
var scales = [
{ value: 1000000000, singular: 'مليار', dual: 'ملياران', plural: 'مليارات' },
{ value: 1000000, singular: 'مليون', dual: 'مليونان', plural: 'ملايين' },
{ value: 1000, singular: 'ألف', dual: 'ألفان', plural: 'آلاف' }
];
var result = [];
var remaining = n;
for (var i = 0; i < scales.length; i++) {
var sc = scales[i];
var count = Math.floor(remaining / sc.value);
if (count > 0) {
remaining = remaining % sc.value;
if (count === 1) result.push(sc.singular);
else if (count === 2) result.push(sc.dual);
else result.push(threeDigits(count) + ' ' + sc.plural);
}
}
if (remaining > 0) result.push(threeDigits(remaining));
return result.join(' و ');
}
function printAccount(id) {
if (!allowStatementsOrPrompt('طباعة كشوف الحسابات متاحة في باقة الأعمال. يمكنك عرضها على الشاشة وتصديرها في أي وقت.')) return;
var acc = E.getAccount(id);
if (!acc) { toast('الحساب غير موجود', true); return; }
window.__printTitle = acc.name + ' — E-Statement';
window.__reportAcc = acc;
window.__reportOpts = { groupByMonth: false, groupByCurrency: false, autoMatch: false, sortBy: 'date', fromLastBalance: false };
window.__reportExcel = function () { exportStatementExcel(acc); };
showReport(statementHtml(acc, null, window.__reportOpts), function (filter) { return statementHtml(window.__reportAcc, filter, window.__reportOpts); });
}
function statementHtml(acc, filter, opts) {
opts = opts || {};
var id = acc.id;
var st = S();
var a = E.computeAnalysis();
var bal = a.balances && a.balances[id] ? a.balances[id] : { native: 0, base: 0 };
var entries = st.entries.filter(function (e) {
return (e.lines || []).some(function (l) { return l.accountId === id; });
});
if (opts.sortBy === 'amount') {
entries.sort(function (x, y) {
var lx = (x.lines || []).find(function (l) { return l.accountId === id; });
var ly = (y.lines || []).find(function (l) { return l.accountId === id; });
var ax = lx ? (lx.debitBase || lx.debit || 0) + (lx.creditBase || lx.credit || 0) : 0;
var ay = ly ? (ly.debitBase || ly.debit || 0) + (ly.creditBase || ly.credit || 0) : 0;
return ay - ax;
});
} else {
entries.sort(function (x, y) { return x.date < y.date ? -1 : 1; });
}
var startIndex = 0;
if (opts.fromLastBalance) {
var runningTmp = 0;
for (var ti = 0; ti < entries.length; ti++) {
var eTmp = entries[ti];
var lineTmp = (eTmp.lines || []).find(function (l) { return l.accountId === id; });
var dTmp = lineTmp ? (lineTmp.debitBase || lineTmp.debit || 0) : 0;
var cTmp = lineTmp ? (lineTmp.creditBase || lineTmp.credit || 0) : 0;
var netTmp = dTmp - cTmp;
var signedTmp = acc.nature === 'debit' ? netTmp : -netTmp;
runningTmp += signedTmp;
if (runningTmp === 0) startIndex = ti + 1;
}
}
var running = 0;
var runningByCur = {};
for (var oj = 0; oj < startIndex; oj++) {
var e0 = entries[oj];
var l0 = (e0.lines || []).find(function (l) { return l.accountId === id; });
var d0 = l0 ? (l0.debitBase || l0.debit || 0) : 0;
var c0 = l0 ? (l0.creditBase || l0.credit || 0) : 0;
running += acc.nature === 'debit' ? (d0 - c0) : (c0 - d0);
}
var openingBalance = running;
var shown = 0;
var totalDebit = 0;
var totalCredit = 0;
var lastBalance = running;
var monthGroups = [];
var currencyGroups = {};
var currencyGroupTotals = {};
var currentMonth = null;
var monthRows = [];
var monthDebit = 0, monthCredit = 0;
var flushMonth = function () {
if (currentMonth !== null && monthRows.length) {
monthGroups.push({ month: currentMonth, rows: monthRows.join(''), debit: monthDebit, credit: monthCredit });
}
monthRows = [];
monthDebit = 0;
monthCredit = 0;
};
var allRows = [];
for (var ri = startIndex; ri < entries.length; ri++) {
var e = entries[ri];
var matchingLines = (e.lines || []).filter(function (l) { return l.accountId === id; });
for (var li = 0; li < matchingLines.length; li++) {
var line = matchingLines[li];
var rowCurrency = line ? (line.currency || acc.currency) : acc.currency;
var debit = line ? (line.debitBase || line.debit || 0) : 0;
var credit = line ? (line.creditBase || line.credit || 0) : 0;
var debitNative = line ? (line.debit || 0) : 0;
var creditNative = line ? (line.credit || 0) : 0;
var net = debit - credit;
var netNative = debitNative - creditNative;
if (!E.statementEntryMatches(e, net, filter)) continue;
var signed = acc.nature === 'debit' ? net : -net;
running += signed;
if (runningByCur[rowCurrency] === undefined) runningByCur[rowCurrency] = 0;
runningByCur[rowCurrency] += (acc.nature === 'debit' ? netNative : -netNative);
shown++;
totalDebit += debit;
totalCredit += credit;
lastBalance = running;
var statusLabel = debit > 0 ? 'عليه' : 'له';
var dispCur = opts.groupByCurrency ? rowCurrency : null;
var showNativeTag = !dispCur && rowCurrency && rowCurrency !== E.BASE;
var debitCell = debit
? (dispCur
? moneyText(debitNative, dispCur)
: (showNativeTag ? moneyText(debitNative, rowCurrency) + '<br><small style="color:#666">(' + moneyText(debit) + ')</small>' : moneyText(debit)))
: '';
var creditCell = credit
? (dispCur
? moneyText(creditNative, dispCur)
: (showNativeTag ? moneyText(creditNative, rowCurrency) + '<br><small style="color:#666">(' + moneyText(credit) + ')</small>' : moneyText(credit)))
: '';
var rowHtml = '<tr>' +
'<td class="date">' + esc(String(e.date).replace(/-/g, '/')) + '</td>' +
'<td>' + esc(statementMemo(e, line)) + (showNativeTag ? ' <small style="color:#666">[' + esc(rowCurrency) + ']</small>' : '') + '</td>' +
'<td style="max-width:32px;width:28px">' + statusLabel + '</td>' +
'<td class="num">' + debitCell + '</td>' +
'<td class="num">' + creditCell + '</td>' +
'<td class="num' + (running < 0 ? ' neg' : '') + '">' + (dispCur ? moneyText(runningByCur[dispCur], dispCur) : moneyText(running)) + '</td>' +
'</tr>';
if (opts.groupByCurrency) {
var rc = rowCurrency;
if (!currencyGroups[rc]) { currencyGroups[rc] = []; currencyGroupTotals[rc] = { debit: 0, credit: 0 }; }
currencyGroups[rc].push(rowHtml);
currencyGroupTotals[rc].debit += debit;
currencyGroupTotals[rc].credit += credit;
} else if (opts.groupByMonth) {
var m = String(e.date).slice(0, 7);
if (currentMonth !== m) { flushMonth(); currentMonth = m; }
monthRows.push(rowHtml);
monthDebit += debit;
monthCredit += credit;
} else {
allRows.push(rowHtml);
}
}
}
if (opts.groupByMonth) flushMonth();
var rows = '';
if (opts.groupByCurrency) {
rows = Object.keys(currencyGroups).sort().map(function (cur) {
var ct = currencyGroupTotals[cur] || { debit: 0, credit: 0 };
return '<tr style="background:#e8f0ec;font-weight:700"><td colspan="6">' + esc(cur) + ' — ' + currencyGroups[cur].length + ' حركة • مدين: ' + moneyText(ct.debit) + ' / دائن: ' + moneyText(ct.credit) + '</td></tr>' + currencyGroups[cur].join('');
}).join('');
} else if (opts.groupByMonth) {
rows = monthGroups.map(function (g) {
return '<tr style="background:#e8f0ec;font-weight:700"><td colspan="6">' + esc(g.month) + ' — مدين: ' + moneyText(g.debit) + ' / دائن: ' + moneyText(g.credit) + '</td></tr>' + g.rows;
}).join('');
} else {
rows = allRows.join('');
}
if (startIndex > 0 || (filter && filter.from)) {
rows = '<tr style="font-style:italic;background:#f6f4ef"><td colspan="5">الرصيد الافتتاحي</td><td class="num">' + moneyText(openingBalance) + '</td></tr>' + rows;
}
var now = new Date().toISOString().slice(0, 10);
var byCur = bal.byCurrency || {};
var curKeys = Object.keys(byCur).filter(function (c) { return byCur[c] && (byCur[c].native !== 0 || byCur[c].base !== 0); });
var balByCurText = '';
if (curKeys.length > 1 || (curKeys.length === 1 && curKeys[0] !== acc.currency)) {
balByCurText = curKeys.map(function (c) { return c + ': ' + moneyText((byCur[c].native != null ? byCur[c].native : byCur[c].base), c); }).join(' • ') + ' (إجمالي: ' + moneyText(bal.base) + ')';
} else {
balByCurText = moneyText(bal.native, acc.currency);
}
var curLabelText = (acc.multi && acc.currencies && acc.currencies.length) ? acc.currencies.join('، ') : (curKeys.length > 1 ? curKeys.join('، ') : acc.currency);
var html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كشف حساب - ' + esc(acc.name) + '</title>' +
'<style>' + reportStyles() + '</style></head><body>' +
'<h1>كشف حساب إلكتروني (E-Statement)</h1>' +
'<div class="sub">موني كود — ' + esc(now) + '</div>' +
(reportSearchText(filter) ? '<div class="sub">نتائج البحث: ' + esc(reportSearchText(filter)) + '</div>' : '') +
'<div class="info">' +
'<span><b>الحساب: ' + esc(acc.name) + (acc.code && acc.code !== acc.id ? ' (' + esc(acc.code) + ')' : '') + '</b></span>' +
'<span><b>التصنيف:</b> ' + esc(acc.subtype || ({ asset: 'أصول', liability: 'خصوم', equity: 'حقوق ملكية', revenue: 'إيرادات', expense: 'مصروفات' }[acc.type] || acc.type)) + '</span>' +
'<span><b>العملة:</b> ' + esc(curLabelText) + '</span>' +
'<span><b>الرصيد:</b> ' + balByCurText + '</span>' +
'</div>' +
'<table><thead><tr><th>التاريخ</th><th>السرد</th><th style="max-width:32px;width:28px">الحالة</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>' +
(rows || (filter ? '<tr><td colspan="6">لا توجد حركات مطابقة للبحث.</td></tr>' : '')) +
'<tr class="total"><td colspan="3">الإجمالي ' + esc(tafqit((filter ? lastBalance : (acc.multi ? bal.base : bal.native)) / 100)) + ' ' + esc(acc.multi ? E.BASE : acc.currency) + '</td><td class="num">' + moneyText(totalDebit) + '</td>' +
'<td class="num">' + moneyText(totalCredit) + '</td>' +
'<td class="num">' + (filter ? moneyText(lastBalance) : balByCurText) + '</td></tr>' +
'</tbody></table>' +
'<div class="foot">عدد الحركات: ' + (filter ? shown + ' من ' : '') + entries.length + ' — تم الإنشاء بواسطة موني كود</div>' +
'</body></html>';
return html;
}
function printCounterparty(name) {
if (!name) { toast('اسم الطرف غير محدد', true); return; }
if (!allowStatementsOrPrompt('طباعة كشوف الحسابات متاحة في باقة الأعمال. يمكنك عرضها على الشاشة وتصديرها في أي وقت.')) return;
window.__printTitle = name + ' — كشف طرف';
window.__reportExcel = function () { exportCounterpartyExcel(name); };
showReport(counterpartyStatementHtml(name, null), function (filter) { return counterpartyStatementHtml(name, filter); });
}
function counterpartyStatementHtml(name, filter) {
var cp = E.counterpartyBalance ? E.counterpartyBalance(name) : { name: name, entries: [], dueItems: [], receivableBase: 0, payableBase: 0, netDueBase: 0 };
var entries = cp.entries || [];
var shown = 0;
var running = 0;
var opening = 0;
if (filter && filter.from) {
entries.forEach(function (e) {
if (e.date < filter.from) {
var a = Number(e.totalBase) || 0;
opening += a * (e.kind === 'expense' || e.kind === 'repay' ? -1 : 1);
}
});
running = opening;
}
var openingRow = (filter && filter.from)
? '<tr style="font-style:italic"><td class="date">' + esc(filter.from) + '</td><td colspan="2">الرصيد الافتتاحي</td><td class="num">' + moneyText(opening) + '</td><td class="num">' + moneyText(opening) + '</td></tr>'
: '';
var rows = entries.map(function (e) {
var amt = Number(e.totalBase) || 0;
if (!E.statementEntryMatches(e, amt, filter)) return '';
shown++;
var meta = kindMeta(e.kind);
var signed = amt * (e.kind === 'expense' || e.kind === 'repay' ? -1 : 1);
running += signed;
var signCls = signed >= 0 ? 'pos' : 'neg';
return '<tr>' +
'<td class="date">' + esc(String(e.date).replace(/-/g, '/')) + '</td>' +
'<td>' + esc(meta.label) + '</td>' +
'<td>' + esc((e.lines && e.lines[0] && e.lines[0].note) ? e.lines[0].note : (e.memo || meta.label)) + '</td>' +
'<td class="num ' + signCls + '">' + (signed >= 0 ? '+' : '') + moneyText(signed) + '</td>' +
'<td class="num">' + moneyText(running) + '</td>' +
'</tr>';
}).join('');
rows = openingRow + rows;
var dueRows = (cp.dueItems || []).map(function (d) {
var payable = d.kind === 'payable';
var remText = (d.currency && d.currency !== E.BASE && d.remainingNative)
? moneyText(d.remainingNative, d.currency) + '<br><small style="color:#666">(' + moneyText(d.remaining) + ')</small>'
: moneyText(d.remaining);
return '<tr>' +
'<td class="date">' + esc(d.dueDate ? String(d.dueDate).replace(/-/g, '/') : '—') + '</td>' +
'<td>' + (payable ? 'علينا' : 'لنا') + '</td>' +
'<td>' + esc(d.memo || '') + '</td>' +
'<td class="num' + (payable ? ' neg' : '') + '">' + remText + '</td>' +
'<td class="num">—</td>' +
'</tr>';
}).join('');
var now = new Date().toISOString().slice(0, 10);
var netLabel = cp.netDueBase > 0 ? 'لنا: ' + moneyText(cp.netDueBase) + ' (' + tafqit(cp.netDueBase / 100) + ')' : (cp.netDueBase < 0 ? 'علينا: ' + moneyText(Math.abs(cp.netDueBase)) + ' (' + tafqit(Math.abs(cp.netDueBase) / 100) + ')' : 'مسوّى (0)');
return '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كشف حساب طرف - ' + esc(name) + '</title>' +
'<style>' + reportStyles() + '</style></head><body>' +
'<h1>كشف حساب طرف: ' + esc(name) + '</h1>' +
'<div class="sub">موني كود — ' + esc(now) + '</div>' +
'<div class="info">' +
'<span><b>الطرف:</b> ' + esc(name) + '</span>' +
'<span><b>مستحقات لنا:</b> ' + moneyText(cp.receivableBase || 0) + '</span>' +
'<span><b>مستحقات علينا:</b> ' + moneyText(cp.payableBase || 0) + '</span>' +
'<span><b>الصافي المستحق:</b> ' + netLabel + '</span>' +
'</div>' +
(dueRows ? '<h2>الذمم المفتوحة</h2><table><thead><tr><th>الاستحقاق</th><th>النوع</th><th>البيان</th><th>المتبقي</th><th>الرصيد</th></tr></thead><tbody>' + dueRows + '</tbody></table>' : '') +
'<h2>سجل العمليات (' + (filter ? shown + ' من ' : '') + entries.length + ')</h2>' +
'<table><thead><tr><th>التاريخ</th><th>النوع</th><th>السرد</th><th>المبلغ</th><th>الرصيد</th></tr></thead><tbody>' +
(rows || '<tr><td colspan="5">لا توجد حركات مسجلة لهذا الطرف.</td></tr>') +
(rows ? '<tr style="font-weight:700;background:var(--paper-2,#f5f5f5)"><td colspan="3">الرصيد الختامي</td><td class="num">' + moneyText(cp.totalBase || 0) + '</td><td class="num">' + moneyText(running) + '</td></tr>' : '') +
'</tbody></table>' +
'<div class="foot">عدد الحركات: ' + entries.length + ' — تم الإنشاء بواسطة موني كود</div>' +
'</body></html>';
}
function openBudgetsSheet() {
var st = S();
var budgets = E.budgetList ? E.budgetList() : [];
var expAccs = st.accounts.filter(function (a) { return a.type === 'expense' || a.type === 'asset'; });
var rowsHtml = budgets.length ? budgets.map(function (b) {
var stt = E.budgetStatus(b.accountId);
var acc = E.getAccount(b.accountId);
var name = acc ? acc.name : b.accountId;
var spent = stt ? (stt.spentMinor || 0) : 0;
var limitBase = stt ? (stt.limitBase || b.monthlyLimitMinor) : b.monthlyLimitMinor;
var pct = stt ? (stt.pct || 0) : 0;
var over = stt ? !!stt.over : false;
var barColor = over ? 'var(--danger, #e53935)' : (pct >= 80 ? 'var(--warn, #fb8c00)' : 'var(--emerald, #2e7d32)');
var width = Math.max(0, Math.min(100, pct));
return '<div class="row" style="padding:8px 0">' +
'<span class="r-main"><span class="r-title">' + esc(name) + '</span>' +
'<span class="r-sub">المنفق هذا الشهر: ' + money(spent) + ' من ' + money(limitBase) + ' (' + pct + '%)' + (over ? ' — تجاوز!' : (pct >= 80 ? ' — close' : '')) + '</span>' +
'<div style="margin-top:4px;height:6px;border-radius:3px;background:var(--line, #e0e0e0);overflow:hidden"><div style="height:100%;width:' + width + '%;background:' + barColor + ';transition:width .2s"></div></div>' +
'<span class="r-sub" style="margin-top:2px">المتبقي: ' + money(Math.max(0, limitBase - spent)) + '</span></span>' +
'<button type="button" class="btn danger small" data-budget-del="' + esc(b.id) + '">حذف</button>' +
'</div>';
}).join('') : '<div class="muted" style="padding:8px 0;font-size: calc(12px * var(--font-scale, 1))">لا توجد ميزانيات مضافة بعد.</div>';
var totalSpent = budgets.reduce(function (s, b) { var stt = E.budgetStatus(b.accountId); return s + (stt ? (stt.spentMinor || 0) : 0); }, 0);
var totalLimit = budgets.reduce(function (s, b) { var stt = E.budgetStatus(b.accountId); return s + (stt ? (stt.limitBase || 0) : 0); }, 0);
var summaryHtml = budgets.length ? '<div class="row" style="padding:6px 0;font-weight:700"><span class="r-main"><span class="r-title">الإجمالي</span><span class="r-sub">' + money(totalSpent) + ' من ' + money(totalLimit) + ' (' + (totalLimit > 0 ? Math.round((totalSpent/totalLimit)*100) : 0) + '%)</span></span></div><div class="divider"></div>' : '';
var body = '<div id="budgetsSheetRoot">' +
summaryHtml +
'<div style="margin-bottom:12px">' + rowsHtml + '</div>' +
'<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700;padding:8px 0">إضافة / تحديث ميزانية شهرية</summary>' +
'<div style="margin-top:8px">' +
'<div class="field"><label>الحساب / البند</label><select id="budAccount">' +
expAccs.map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === 'expense' ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('') +
'</select></div>' +
'<div class="field"><label>السقف الشهري (' + esc(E.BASE) + ')</label><input id="budLimit" type="number" inputmode="decimal" min="1" step="any" placeholder="مثال: 1500"></div>' +
'<div class="modal-actions">' +
'<button type="button" class="btn primary" id="budSaveBtn">حفظ الميزانية</button>' +
'<button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button>' +
'</div></div></details>';
openSheet('الميزانيات الشهرية', body);
var root = document.getElementById('budgetsSheetRoot');
if (!root) return;
var accSel = document.getElementById('budAccount');
if (accSel) accSel.addEventListener('change', function () {
var b = (E.budgetList ? E.budgetList() : []).filter(function (x) { return x.accountId === accSel.value; })[0];
var inp = document.getElementById('budLimit');
if (b && inp) inp.value = (b.monthlyLimitMinor / 100);
});
root.addEventListener('click', function (ev) {
var delBtn = ev.target.closest('[data-budget-del]');
if (delBtn) {
E.removeBudget(delBtn.getAttribute('data-budget-del'));
toast('تم حذف الميزانية');
openBudgetsSheet();
renderAll();
return;
}
if (ev.target.closest('#budSaveBtn')) {
var accId = document.getElementById('budAccount').value;
var val = parseFloat(document.getElementById('budLimit').value);
if (!(val > 0)) { toast('أدخل مبلغاً صالحاً', true); return; }
var res = E.addBudget({ accountId: accId, monthlyLimitMinor: Math.round(val * 100), currency: E.BASE });
if (!res.ok) { toast(res.error, true); return; }
toast('تم حفظ الميزانية');
openBudgetsSheet();
renderAll();
}
});
}
function openRecurringSheet() {
var st = S();
var list = E.recurringList ? E.recurringList() : [];
var freqLabels = { daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري' };
var rowsHtml = list.length ? list.map(function (r) {
var isDue = r.nextDate && r.nextDate <= E.todayISO();
return '<div class="row" style="padding:8px 0">' +
'<span class="r-main"><span class="r-title">' + esc(r.memo) + ' ' +
'<span class="badge ' + (isDue ? 'soon' : '') + '">' + esc(freqLabels[r.freq] || 'شهري') + '</span></span>' +
'<span class="r-sub">القادم: ' + esc(E.fmtDate(r.nextDate)) + ' • ' + money(r.amountMinor, r.currency) + '</span></span>' +
'<span class="r-value" style="display:flex;gap:4px">' +
'<button type="button" class="btn ghost small" data-rec-edit="' + esc(r.id) + '">تعديل</button>' +
'<button type="button" class="btn primary small" data-rec-run="' + esc(r.id) + '">تسجيل</button>' +
'<button type="button" class="btn danger small" data-rec-del="' + esc(r.id) + '">حذف</button>' +
'</span></div>';
}).join('') : '<div class="muted" style="padding:8px 0;font-size: calc(12px * var(--font-scale, 1))">لا توجد قيود متكررة مضافة بعد.</div>';
var liqAccs = st.accounts.filter(function (a) { return a.liquid; });
var allAccs = st.accounts.slice();
var dueCount = list.filter(function (r) { return r.nextDate && r.nextDate <= E.todayISO(); }).length;
var runAllHtml = dueCount > 0 ? '<div style="margin:8px 0"><button type="button" class="btn primary" id="recRunAllBtn">تسجيل الكل المستحق (' + dueCount + ')</button></div>' : '';
var body = '<div id="recurringSheetRoot">' +
'<div style="margin-bottom:12px">' + rowsHtml + '</div>' +
runAllHtml +
'<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700;padding:8px 0">إضافة قيد متكرر جديد</summary>' +
'<div style="margin-top:8px">' +
'<div class="field"><label>الوصف (مثال: دفعت 1500 إيجار المكتب)</label><input id="recMemo" type="text" placeholder="دفعت 1500 إيجار"></div>' +
'<div class="form-pair">' +
'<div class="field"><label>المبلغ</label><input id="recAmount" type="number" inputmode="decimal" min="1" step="any" placeholder="1500"></div>' +      '<div class="field"><label>العملة</label><select id="recCurrency">' + E.listCurrencies().map(function (c) { return '<option value="' + esc(c.code) + '"' + (c.code === E.BASE ? ' selected' : '') + '>' + esc(c.code) + ' — ' + esc(c.name) + '</option>'; }).join('') + '</select></div>' +
'</div>' +
'<div class="form-pair">' +
'<div class="field"><label>التكرار</label><select id="recFreq"><option value="monthly">شهري</option><option value="weekly">أسبوعي</option><option value="daily">يومي</option></select></div>' +
'<div class="field"><label>تاريخ الاستحقاق القادم</label><input id="recNextDate" type="date" value="' + esc(E.todayISO()) + '"></div>' +
'</div>' +
'<div class="field"><label>النوع</label><select id="recKind"><option value="expense">مصروف</option><option value="income">إيراد</option></select></div>' +
'<div class="form-pair">' +
'<div class="field"><label>الحساب النقدي</label><select id="recAccount">' +
liqAccs.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.name) + '</option>'; }).join('') +
'</select></div>' +
'<div class="field"><label>الحساب المقابل</label><select id="recCounterAccount"><option value="">— افتراضي —</option>' +
allAccs.filter(function (a) { return !a.liquid; }).map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.name) + '</option>'; }).join('') +
'</select></div>' +
'</div>' +
'<div class="modal-actions">' +
'<button type="button" class="btn primary" id="recSaveBtn">' + (ui.recEditId ? 'تحديث القيد المتكرر' : 'إضافة القيد المتكرر') + '</button>' +
'<button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button>' +
'</div></div></details>' +
'</div>';
openSheet('القيود المتكررة', body);
var root = document.getElementById('recurringSheetRoot');
if (!root) return;
if (ui.recEditId) {
var editItem = (E.recurringList ? E.recurringList() : []).filter(function (r) { return r.id === ui.recEditId; })[0];
if (editItem) {
var mEl = document.getElementById('recMemo'); if (mEl) mEl.value = editItem.memo || '';
var aEl = document.getElementById('recAmount'); if (aEl) aEl.value = (editItem.amountMinor || 0) / 100;
var curEl = document.getElementById('recCurrency'); if (curEl) curEl.value = editItem.currency || E.BASE;
var kEl = document.getElementById('recKind'); if (kEl) kEl.value = editItem.kind || 'expense';
var fEl = document.getElementById('recFreq'); if (fEl) fEl.value = editItem.freq || 'monthly';
var acEl = document.getElementById('recAccount'); if (acEl) acEl.value = editItem.accountId || '';
var cacEl = document.getElementById('recCounterAccount'); if (cacEl) cacEl.value = editItem.counterAccountId || '';
var nEl = document.getElementById('recNextDate'); if (nEl) nEl.value = editItem.nextDate || E.todayISO();
}
}
root.addEventListener('click', function (ev) {
var editBtn = ev.target.closest('[data-rec-edit]');
if (editBtn) {
ui.recEditId = editBtn.getAttribute('data-rec-edit');
openRecurringSheet();
return;
}
if (ev.target.closest('#recRunAllBtn')) {
var rAll = E.runAllDueRecurring ? E.runAllDueRecurring() : { ok: false };
toast('تم تسجيل ' + (rAll.done || 0) + ' قيد' + (rAll.failed ? ' (فشل ' + rAll.failed + ')' : ''));
openRecurringSheet();
renderAll();
return;
}
var runBtn = ev.target.closest('[data-rec-run]');
if (runBtn) {
var rRes = E.runRecurring(runBtn.getAttribute('data-rec-run'));
if (!rRes.ok) { toast(rRes.error || 'تعذر التسجيل', true); return; }
pushReceipts(rRes.entry ? [rRes.entry.id] : null);
try { E.recordNetWorthSnapshot(); } catch (e) {}
toast('تم تسجيل القيد وترحيل الموعد القادم إلى ' + E.fmtDate(rRes.nextDate));
openRecurringSheet();
renderAll();
return;
}
var delBtn = ev.target.closest('[data-rec-del]');
if (delBtn) {
E.removeRecurring(delBtn.getAttribute('data-rec-del'));
toast('تم حذف القيد المتكرر');
openRecurringSheet();
renderAll();
return;
}
if (ev.target.closest('#recSaveBtn')) {
var memo = (document.getElementById('recMemo').value || '').trim();
var amt = parseFloat(document.getElementById('recAmount').value);
var kind = document.getElementById('recKind').value;
var freq = document.getElementById('recFreq').value;
var accId = document.getElementById('recAccount').value;
var counterId = (document.getElementById('recCounterAccount').value || '').trim() || null;
var cur = (document.getElementById('recCurrency').value || E.BASE);
var nextD = document.getElementById('recNextDate').value || E.todayISO();
if (!memo) { toast('أدخل وصف القيد', true); return; }
if (!(amt > 0)) { toast('أدخل مبلغاً صالحاً', true); return; }
if (ui.recEditId) {
var edited = E.editRecurring(ui.recEditId, { memo: memo, amountMinor: Math.round(amt * 100), kind: kind, freq: freq, accountId: accId, counterAccountId: counterId, currency: cur, nextDate: nextD });
if (!edited.ok) { toast(edited.error, true); return; }
toast('تم تحديث القيد المتكرر');
ui.recEditId = null;
} else {
var added = E.addRecurring({ memo: memo, amountMinor: Math.round(amt * 100), kind: kind, freq: freq, accountId: accId, counterAccountId: counterId, currency: cur, nextDate: nextD });
if (!added.ok) { toast(added.error, true); return; }
toast('تمت إضافة القيد المتكرر');
}
openRecurringSheet();
renderAll();
}
});
}
function openAccountInBot(id) {
var acc = E.getAccount(id);
if (!acc) { toast('الحساب غير موجود', true); return; }
botText(accountBalanceText(acc) + '\nاكتب العملية الجديدة لهذا الحساب هنا.');
E.saveState();
renderAll();
setTab('bot');
if (els.input) els.input.focus();
}
function showAccountLedger(id) {
var acc = E.getAccount(id);
if (!acc) { toast('الحساب غير موجود', true); return; }
ui.search = acc.name;
ui.filter = 'all';
setTab('ledger');
renderLedger();
toast('عرض قيود: ' + acc.name);
}
function modifyEntry(id) {
var st = S();
var entry = null;
for (var i = 0; i < st.entries.length; i++) if (st.entries[i].id === id) entry = st.entries[i];
if (!entry) { toast('القيد غير موجود', true); return; }
if ((entry.lines || []).some(isValueOnlyLine)) { toast(VALUE_ONLY_EDIT, true); return; }
var replaceable = E.canDeleteEntry(id);
if (!replaceable.ok) { toast(replaceable.error, true); return; }
var isCompound = isMultiLine(entry);
var settle = E.settlementIntent(entry);
var liquid = E.getState().accounts.filter(function (a) { return a.liquid; }).map(function (a) { return a.id; });
var primary = null, contra = null;
(entry.lines || []).forEach(function (l) {
if (liquid.indexOf(l.accountId) !== -1) primary = l.accountId;
else contra = l.accountId;
});
if (!primary && entry.lines && entry.lines[0]) primary = entry.lines[0].accountId;
if (!contra && entry.lines && entry.lines[1]) contra = entry.lines[1].accountId;
if (!contra) contra = 'expense';
var transferTo = null, transferFrom = null;
if (entry.kind === 'transfer') {
(entry.lines || []).forEach(function (l) {
if (l.debitBase > 0) transferTo = l.accountId;
if (l.creditBase > 0) transferFrom = l.accountId;
});
}
var intent = {
toAccountId: transferTo,
fromAccountId: transferFrom,
kind: isCompound ? 'compound' : entry.kind,
amountMinor: entry.totalBase || 0,
currency: entry.currency || 'SAR',
accountId: primary || 'cash',
contraAccountId: contra,
counterparty: entry.counterparty || '',
date: entry.date,
dueDate: entry.dueDate || null,
memo: entry.memo || ''
};
if (isCompound) {
intent.isCompound = true;
intent.lines = (entry.lines || []).map(function (l) {
return {
accountId: l.accountId,
currency: l.currency || entry.currency || 'SAR',
debitMinor: l.debit || 0,
creditMinor: l.credit || 0,
counterparty: entry.counterparty || ''
};
});
intent.rates = {};
(entry.lines || []).forEach(function (l) {
if (!intent.rates[l.currency || entry.currency]) intent.rates[l.currency || entry.currency] = (typeof l.rate === 'number' && l.rate > 0) ? l.rate : E.getRate(l.currency || entry.currency);
});
}
if (settle) {
intent.amountMinor = settle.amountMinor;
intent.currency = settle.currency;
intent.accountId = settle.accountId;
intent.contraAccountId = settle.contraAccountId;
intent.rates = settle.rates;
}
intent.sourceEntryId = entry.id;
var draft;
try { draft = E.buildDraft(intent); }
catch (e) { toast('تعذر بناء القيد: ' + e.message, true); return; }
draft.sourceEntryId = entry.id;
st.drafts.push(draft);
if (st.drafts.length > 20) st.drafts = st.drafts.slice(-20);
E.saveState();
pushMessage({ role: 'bot', type: 'draft', draftId: draft.id });
ui.tab = 'bot';
setTab('bot');
renderAll();
toast('تم إرسال القيد للتعديل');
}
async function pickContact(onPicked) {
if (window.RohContacts) {
window.__rohContactResult = function (json) {
var picked = {};
try { picked = JSON.parse(json) || {}; } catch (e) { picked = { failed: true }; }
if (picked.failed) toast('تعذر فتح جهات الاتصال. اكتب الاسم يدوياً.', true);
else if (picked.name) onPicked(picked.name, picked.phone);
};
window.RohContacts.pick();
return;
}
if (navigator.contacts && typeof navigator.contacts.select === 'function') {
try {
var contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
if (contacts && contacts.length) onPicked((contacts[0].name || [])[0], (contacts[0].tel || [])[0]);
} catch (e) {
toast('تعذر فتح جهات الاتصال. اكتب الاسم يدوياً.', true);
}
return;
}
toast('جهات الاتصال غير متاحة هنا. اكتب الاسم يدوياً.', true);
}
function openReceiptMore(id) {
var st = S();
var entry = null;
for (var i = 0; i < st.entries.length; i++) if (st.entries[i].id === id) entry = st.entries[i];
if (!entry) { toast('القيد غير موجود', true); return; }
openSheet('خيارات القيد',
'<div class="modal-actions" style="flex-direction:column">' +
'<button class="btn primary" data-action="modify-entry" data-id="' + esc(id) + '">✎ تعديل القيد</button>' +
'<button class="btn ghost" data-action="entry-in-ledger" data-id="' + esc(id) + '">☰ الدليل</button>' +
(window.RohOwner && E.hasPermission && !E.hasPermission('entry.delete') ? '' : '<button class="btn ghost" data-action="delete-entry" data-id="' + esc(id) + '">حذف القيد</button>') +
'<button class="btn ghost" data-action="modal-cancel">إغلاق</button>' +
'</div>');
}
function openSettlePartial(dueId) {
ux('settle.sheet');
var a = E.computeAnalysis();
var due = null;
for (var i = 0; i < a.dueItems.length; i++) if (a.dueItems[i].id === dueId) due = a.dueItems[i];
if (!due) { toast('الاستحقاق غير موجود', true); return; }
var liquid = E.getState().accounts.filter(function (x) { return x.liquid; });
var accOpts = liquid.map(function (x) {
return '<option value="' + esc(x.id) + '"' + (x.id === 'cash' ? ' selected' : '') + '>' + esc(x.name) + '</option>';
}).join('');
var dueCur = due.currency || E.BASE;
var dueLeft = due.remainingNative != null ? due.remainingNative : due.remaining;
openSheet('تسديد',
'<div class="form-row">' +
'<label for="settle-amount">' + (dueCur === E.BASE ? 'المبلغ بالريال' : 'المبلغ (' + esc(currencyName(dueCur)) + ')') + ' (الحد الأقصى: ' + esc(E.fmtMoney(dueLeft, dueCur, undefined, true)) + ')</label>' +
'<input id="settle-amount" type="text" inputmode="none" readonly class="amount-input" style="cursor:pointer" value="' + esc((dueLeft / 100).toFixed(2)) + '" /></div>' +
'<div class="form-row">' +
'<label for="settle-account">الحساب (دفع)</label>' +
'<select id="settle-account">' + accOpts + '</select></div>' +
'<div class="modal-actions">' +
'<button class="btn primary" data-action="confirm-settle-partial" data-id="' + esc(dueId) + '">تأكيد</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button>' +
'</div>');
}
function confirmSettlePartial(dueId) {
var amtStr = (document.getElementById('settle-amount') || {}).value || '';
var amt = parseFloat(amtStr);
if (!(amt > 0)) { toast('المبلغ غير صالح', true); return; }
var amountMinor = Math.round(amt * 100);
var accountId = (document.getElementById('settle-account') || {}).value || 'cash';
var a = E.computeAnalysis();
var due = null;
for (var i = 0; i < a.dueItems.length; i++) if (a.dueItems[i].id === dueId) due = a.dueItems[i];
if (!due) { toast('الاستحقاق غير موجود', true); return; }
var dueCur = due.currency || E.BASE;
var dueLeft = due.remainingNative != null ? due.remainingNative : due.remaining;
if (amountMinor > dueLeft) { toast('المبلغ يتجاوز المستحق', true); return; }
var kind = due.kind === 'receivable' ? 'collect' : 'repay';
var intent = {
kind: kind,
amountMinor: amountMinor,
currency: dueCur,
accountId: accountId,
contraAccountId: E.dueContraAccount(due),
counterparty: due.counterparty || '',
date: E.todayISO(),
dueDate: null,
memo: (amountMinor === dueLeft ? 'تسوية استحقاق: ' : 'تسديد جزئي: ') + (due.counterparty || '')
};
var draft;
try { draft = E.buildDraft(intent); }
catch (e) { toast('تعذر بناء القيد: ' + e.message, true); return; }
E.getState().drafts.push(draft);
if (E.getState().drafts.length > 20) E.getState().drafts = E.getState().drafts.slice(-20);
var res = E.confirmDraft(draft.id);
if (!res.ok) {
E.getState().drafts = E.getState().drafts.filter(function (d) { return d.id !== draft.id; });
toast(res.error || 'تعذر التسوية', true);
return;
}
var wasFull = amountMinor === dueLeft;
var fxNote = fxText(E.entryFx(res.entry));
closeSheet();
toast('تم تسديد ' + moneyText(amountMinor, dueCur) +(wasFull ? '' : ' (جزئي)') + (fxNote ? ' • ' + fxNote : ''));
renderAll();
}
function openFixOverdraft(id) {
var fix = E.overdraftFix(id);
if (!fix) { renderAll(); return; }
var amount = E.fmtMoney(fix.amount, E.BASE, false);
var html = '<p class="modal-note">رصيد «' + esc(fix.account.name) + '» سالب ' + esc(E.fmtMoney(Math.abs(fix.native), fix.account.currency, false)) + '. ما سبب ذلك؟</p>' +
'<div class="fix-option"><button class="btn primary" data-action="fix-overdraft-opening" data-id="' + esc(id) + '">تسجيل رصيد افتتاحي</button>' +
'<p class="modal-note">يُسجَّل رصيد ' + esc(amount) + ' في الحساب فيعود إلى صفر.</p></div>';
if (fix.sources.length) {
html += '<div class="fix-option"><div class="fix-transfer"><label for="fixFrom" class="muted" style="font-size:calc(12px * var(--font-scale,1))">تحويل من:</label><select id="fixFrom">' +
fix.sources.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.name) + '</option>'; }).join('') +
'</select><button class="btn primary" data-action="fix-overdraft-transfer" data-id="' + esc(id) + '">تسجيل التحويل</button></div>' +
'<p class="modal-note">يُسجَّل تحويل ' + esc(amount) + ' إلى الحساب فيعود إلى صفر.</p></div>';
}
html += '<div class="fix-option"><button class="btn ghost" data-action="fix-overdraft-review" data-id="' + esc(id) + '">مراجعة قيود الحساب</button>' +
'<p class="modal-note">إن كان سبب السحب قيداً خاطئاً، راجع قيود الحساب وصحّحه.</p></div>';
openSheet('إصلاح الرصيد السالب', html);
}
function saveFixOverdraft(id, fromAccountId) {
var res = E.fixOverdraft(id, fromAccountId);
if (!res.ok) { toast(res.error, true); return; }
pushReceipts(res.entry ? [res.entry.id] : null);
closeSheet();
toast('تم الإصلاح. يمكنك التراجع من القائمة ⋮');
}
function reviewOverdraftEntries(id) {
var acc = E.getAccount(id);
closeSheet();
ui.filter = 'all';
ui.search = acc ? acc.name : '';
setTab('ledger');
renderLedger();
}
function removeEntry(id) {
askConfirm('حذف القيد', 'سيُحذف القيد نهائياً ويُعكس أثره على الأرصدة. هل تريد المتابعة؟', function () {
var res = E.deleteEntry(id);
if (!res.ok) { toast(res.error, true); return; }
toast('تم حذف القيد');
renderAll();
}, 'حذف');
}
function openChatArchive() {
var archived = (S().settings && S().settings.archivedMessages) || [];
var html = '<div class="modal-note">رسائل مؤرشفة (أقدم من 30 يوم): ' + archived.length + ' رسالة</div>';
if (!archived.length) {
html += '<div class="muted" style="text-align:center;padding:12px">لا توجد رسائل مؤرشفة</div>';
} else {
html += '<div style="max-height:300px;overflow:auto">';
archived.slice(-50).reverse().forEach(function (m) {
html += '<div style="padding:6px 8px;margin-bottom:4px;border-radius:6px;background:var(--card-bg,rgba(0,0,0,.04));font-size:calc(11.5px * var(--font-scale,1))">' +
'<div style="font-weight:600;color:var(--muted)">' + esc(m.role === 'user' ? 'أنت' : 'البوت') + ' · ' + esc((m.at || '').slice(0, 10)) + '</div>' +
'<div style="margin-top:2px">' + esc(String(m.text || '').slice(0, 200)) + '</div>' +
'</div>';
});
html += '</div>';
}
html += '<div class="modal-actions"><button class="btn ghost" data-action="modal-cancel">إغلاق</button></div>';
openSheet('أرشيف المحادثة', html);
}
function renderLocalSnapshots() {
var box = document.getElementById('localSnapshotsList');
if (!box || !E.listBackups) return;
E.listBackups().then(function (list) {
if (!box) return;
if (!list || !list.length) {
box.innerHTML = '<div class="muted" style="padding:10px;text-align:center;font-size:calc(11.5px * var(--font-scale,1))">لا توجد نقاط استعادة محلية محفوظة بعد.</div>';
return;
}
box.innerHTML = list.map(function (b) {
var dt = String(b.createdAt || '').slice(0, 16).replace('T', ' ');
var lbl = b.label || 'نسخة محلية تلقائية';
var cnt = b.entryCount != null ? (b.entryCount + ' قيد') : '';
return '<div class="setting" style="padding:10px 12px">' +
'<div class="s-main"><span class="s-title">' + esc(lbl) + '</span>' +
'<span class="s-sub" dir="ltr" style="text-align:right">' + esc(dt) + (cnt ? ' • ' + esc(cnt) : '') + '</span></div>' +
'<button type="button" class="btn ghost small" data-action="restore-local-snapshot" data-id="' + esc(b.id) + '">استعادة</button>' +
'</div>';
}).join('');
});
}
window.__openExport = function () { openExport(); };
function openExport() {
var autoOn = S().settings.autoBackup !== false;
openSheet('مركز النسخ الاحتياطي والاستعادة',
'<p class="modal-note">تُشفَّر النسخ السحابية/الخارجية بمعيار AES-256 بمعرفة صفرية (Zero-Knowledge) بكلمة مرورك وحدك، وتُحفظ آخر 7 نسخ محلية تلقائياً على جهازك.</p>' +
'<div class="modal-actions" style="margin-bottom:8px">' +
'<button type="button" class="btn primary" data-action="send-encrypted">🔒 حفظ/إرسال نسخة مشفرة (للسحابة أو الهاتف)</button>' +
'<button type="button" class="btn ghost" data-action="create-manual-snapshot">➕ إنشاء نقطة استعادة محلية فورية الآن</button>' +
'</div>' +
'<div class="card" style="padding:0;margin-bottom:10px">' +
'<div class="setting"><div class="s-main"><span class="s-title">النسخ التلقائي اليومي (آخر 7 نسخ)</span>' +
'<span class="s-sub">يحفظ نسخة صامتة يومياً وعند التحديثات أو قبل الاستعادة</span></div>' +
'<button type="button" class="switch' + (autoOn ? ' on' : '') + '" role="switch" aria-checked="' + (autoOn ? 'true' : 'false') + '" data-action="toggle-auto-backup"></button></div>' +
'</div>' +
'<div class="form-label" style="font-weight:800;margin:6px 2px;font-size:calc(12.5px * var(--font-scale,1));color:var(--emerald)">نقاط الاستعادة المحلية على الجهاز (آخر 7 نسخ):</div>' +
'<div id="localSnapshotsList" class="card" style="padding:0;max-height:210px;overflow:auto;margin-bottom:10px"></div>' +
'<div class="form-row"><label for="exportWord">أو اكتب كلمة "نسخ" لعرض نص JSON الخام</label><input id="exportWord" type="text" autocomplete="off" /></div>' +
'<textarea id="exportArea" aria-label="بيانات التصدير" readonly spellcheck="false" hidden></textarea>' +
'<div class="modal-actions">' +
'<button class="btn ghost" data-action="copy-export" disabled>نسخ النص الخام</button>' +
'<button class="btn ghost" data-action="open-import">استعادة من ملف خارجي</button>' +
'<button class="btn ghost" data-action="modal-cancel">إغلاق</button>' +
'</div>');
renderLocalSnapshots();
var word = document.getElementById('exportWord');
var area = document.getElementById('exportArea');
var copy = els.modalBody.querySelector('[data-action="copy-export"]');
word.addEventListener('input', function () {
var show = function (visible) {
area.hidden = !visible;
area.value = visible ? E.exportJSON() : '';
copy.disabled = !visible;
};
if (word.value.trim() !== 'نسخ') { show(false); return; }
word.blur();
verifyThen('عرض النسخة الاحتياطية', function () { show(true); }, function () { word.value = ''; });
});
}
function renderLocalSnapshots() {
var box = document.getElementById('localSnapshotsList');
if (!box || !E.listBackups) return;
E.listBackups().then(function (list) {
if (!box) return;
if (!list || !list.length) {
box.innerHTML = '<div class="muted" style="padding:12px;text-align:center;font-size:calc(12px * var(--font-scale,1))">لا توجد نقاط استعادة محلية بعد. اضغط «إنشاء نقطة استعادة محلية فورية الآن» لحفظ أول لقطة.</div>';
return;
}
box.innerHTML = list.map(function (b) {
var dt = b.createdAt ? String(b.createdAt).slice(0, 16).replace('T', ' ') : '';
var cnt = b.entryCount != null ? (b.entryCount + ' قيد') : '';
var lbl = b.label || 'نسخة محلية';
return '<div class="setting" style="padding:10px 12px">' +
'<div class="s-main"><span class="s-title">' + esc(lbl) + '</span>' +
'<span class="s-sub"><span dir="ltr">' + esc(dt) + '</span>' + (cnt ? ' • ' + esc(cnt) : '') + '</span></div>' +
'<div style="display:flex;gap:6px">' +
'<button type="button" class="btn primary small" data-action="restore-snapshot" data-id="' + esc(b.id) + '">استعادة</button>' +
'<button type="button" class="btn ghost small" data-action="delete-snapshot" data-id="' + esc(b.id) + '">✕</button>' +
'</div></div>';
}).join('');
});
}
function openSendEncrypted() {
openSheet('إرسال ملف مشفر',
'<p class="modal-note">تُشفَّر النسخة بكلمة مرور تختارها، ولا يمكن فتحها دونها. احفظها جيداً: لا تُخزَّن في التطبيق، ولا يمكن استرجاعها إذا ضاعت.</p>' +
'<div class="form-row"><label for="backupPassword">كلمة المرور (8 أحرف على الأقل)</label><div class="password-field"><input id="backupPassword" type="password" autocomplete="new-password" dir="ltr" style="text-align:center" /><button type="button" class="password-toggle" data-target="backupPassword" aria-label="إظهار كلمة المرور">👁</button></div></div>' +
'<div class="form-row"><label for="backupPassword2">أعد كتابتها</label><div class="password-field"><input id="backupPassword2" type="password" autocomplete="new-password" dir="ltr" style="text-align:center" /><button type="button" class="password-toggle" data-target="backupPassword2" aria-label="إظهار كلمة المرور">👁</button></div></div>' +
'<div class="modal-actions"><button class="btn primary" id="backupSend" type="button">تشفير وإرسال</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button></div>');
var send = document.getElementById('backupSend');
send.addEventListener('click', function () {
var password = document.getElementById('backupPassword').value;
if (password !== document.getElementById('backupPassword2').value) { toast('كلمتا المرور غير متطابقتين', true); return; }
send.disabled = true;
collectAttachments().catch(function (e) {
console.error('[RohUI] backup photos unreadable', e);
return null;
}).then(function (list) {
if (!list) return { ok: false, error: 'تعذر قراءة المرفقات للنسخة' };
return E.encryptBackup(password, list);
}).then(function (res) {
send.disabled = false;
if (!res.ok) { toast(res.error, true); return; }
var name = 'MoneyCode-backup-' + E.todayISO() + '.json';
if (window.RohPrint && window.RohPrint.sendFile) {
if (!window.RohPrint.sendFile(res.text, name)) { toast('تعذر تجهيز الملف', true); return; }
} else {
downloadTextFile(res.text, name);
toast('تم تصدير الملف المشفر');
}
botText('تم إرسال نسخة مشفرة (AES-256) — ' + name + '.');
closeSheet();
});
});
}
var PAIR_TITLE = 'اقتران جهاز';
var PAIR_KIND_NAMES = { shared: 'مطابق', choice: 'متشابهان تمامًا', onlyRemote: 'ناقص عندي', onlyLocal: 'ناقص عنده', countExtra: 'فرق في العدد' };
var pairUi = { session: null, hello: '', review: null, timer: null, resendBody: null };
function pairEng() { return window.RohPairing || null; }
function escapeHtml(text) { return window.RohEngine.escapeHtml(text); }
function pairNote(text, isError) {
var note = document.getElementById('pairMsg');
if (note) { note.textContent = text; note.style.color = isError ? 'var(--danger, #b91c1c)' : ''; }
else toast(text, isError);
}
function closePairingSession(keepReview) {
pairStopScan();
if (pairUi.timer) { clearInterval(pairUi.timer); pairUi.timer = null; }
if (pairUi.session && pairEng()) pairEng().close(pairUi.session);
pairUi.session = null;
pairUi.hello = '';
if (!keepReview) pairUi.review = null;
pairUi.resendBody = null;
if (pairEng()) pairEng().stopNative();
window.__rohPairReceived = null;
}
function pairSheetOpen() { return els.modalTitle.textContent === PAIR_TITLE; }
function pairTick() {
if (!pairUi.session || !pairEng()) return;
if (pairEng().isOpen(pairUi.session)) return;
closePairingSession(true);
toast(pairUi.review ? 'انتهت جلسة الاقتران بعد 5 دقائق بلا نشاط. المراجعة باقية.' : 'انتهت جلسة الاقتران بعد 5 دقائق بلا نشاط.');
if (pairSheetOpen()) renderPairing();
}
function openPairing() {
closePairingSession();
if (!pairEng()) { toast('وحدة الاقتران غير محمّلة', true); return; }
openSheet(PAIR_TITLE,
'<div id="pairMsg" class="modal-note"></div>' +
'<div id="pairScan" hidden></div>' +
'<div id="pairBox"></div>');
var box = document.getElementById('pairBox');
box.addEventListener('click', pairClick);
box.addEventListener('change', pairChange);
document.getElementById('pairScan').addEventListener('click', pairClick);
renderPairing();
}
function pairTransportsText() {
return pairEng().transports().map(function (t) {
return t.label + (t.available ? '' : ' (' + (t.note || 'غير متاح') + ')');
}).join(' • ');
}
function renderPairing() {
var box = document.getElementById('pairBox');
if (!box || !pairEng()) return;
var s = pairUi.session;
var html;
if (!s) {
html = pairStartHtml();
if (pairUi.review) html += '<p class="modal-note">انتهت الجلسة، ومراجعتك باقية: أكمل القرارات وطبّق المقبول أو احفظ النتائج.</p>' + pairReviewHtml();
}
else if (!s.peer) html = pairHelloHtml();
else if (!s.confirmed) html = pairCodeHtml();
else html = pairActiveHtml();
box.innerHTML = html;
pairLoadSaved();
}
function pairStartHtml() {
return '<p class="modal-note">اقترن بجهاز شخص تتعامل معه لمقارنة ما بينكما: قروضه وديونه وسدادها. تُرسل قيود حسابه وحده، ثم تختار ما يُضاف إلى دفترك. لا يحتاج إلى إنترنت، ولا يُرسل شيء إلى أي خادم.</p>' +
'<p class="modal-note">قبل البدء: أضف رمز جهازه إلى حسابه في دفترك (شاشة الحسابات)، ويضيف هو رمز جهازك إلى حسابك عنده.</p>' +
'<p class="modal-note">الطرق: ' + escapeHtml(pairTransportsText()) + '</p>' +
'<div class="modal-actions">' +
'<button class="btn primary" type="button" data-pair="start">ابدأ جلسة اقتران</button>' +
'<button class="btn ghost" type="button" data-pair="share-app">دعوة شريكك لتحميل التطبيق</button>' +
'</div>' +
'<div id="pairSaved"></div>';
}
function pairQrHtml(text) {
if (!window.RohQR) return '';
try {
return '<div class="pair-qr" style="text-align:center;padding:6px 0">' +
window.RohQR.toSvg(text, { label: 'رمز QR لرسالة الاقتران', style: 'width:min(78vw, 340px);height:auto;display:block;margin:0 auto' }) +
'</div>';
} catch (e) { return ''; }
}
function pairHelloHtml() {
var list = pairEng().transports();
var nfc = list[0].available;
var canScan = list.some(function (t) { return t.id === 'qr' && t.available; });
var qr = pairQrHtml(pairUi.hello);
return (qr ? '<p class="modal-note">اعرض هذا الرمز على الجهاز الآخر ليمسحه، وامسح رمزه من جهازك.</p>' + qr +
(canScan ? '<div class="modal-actions"><button class="btn primary" type="button" data-pair="qr-scan">امسح رمز الطرف الآخر</button></div>' : '') +
'<p class="modal-note">أو أرسل الرسالة إلى الطرف الآخر، ثم الصق رسالته في الحقل أدناه.</p>'
: '<p class="modal-note">أرسل هذه الرسالة إلى الطرف الآخر، ثم الصق رسالته في الحقل أدناه.</p>') +
'<div class="form-row"><label for="pairHello">رسالتك</label><textarea id="pairHello" readonly spellcheck="false" dir="ltr">' + escapeHtml(pairUi.hello) + '</textarea></div>' +
'<div class="modal-actions">' +
'<button class="btn ghost" type="button" data-pair="share">مشاركة الرسالة</button>' +
(nfc ? '<button class="btn ghost" type="button" data-pair="nfc-offer">إرسالها بـNFC</button><button class="btn ghost" type="button" data-pair="nfc-read">استقبال بـNFC</button>' : '') +
'</div>' +
'<div class="form-row"><label for="pairPeer">رسالة الطرف الآخر</label><textarea id="pairPeer" spellcheck="false" dir="ltr" placeholder="MC1:"></textarea></div>' +
'<div class="modal-actions"><button class="btn primary" type="button" data-pair="join">تحقق من الرسالة</button>' +
'<button class="btn ghost" type="button" data-pair="end">إلغاء الجلسة</button></div>';
}
function pairCodeHtml() {
var code = pairUi.session.code || '';
return '<p class="modal-note">تأكد أن الرمز نفسه يظهر على الجهاز الآخر. إن اختلف، ألغِ الجلسة ولا تكمل.</p>' +
'<div class="pair-code" dir="ltr" style="font-size:calc(34px * var(--font-scale, 1));font-weight:700;letter-spacing:6px;text-align:center;padding:14px 0">' + escapeHtml(code.slice(0, 3) + ' ' + code.slice(3)) + '</div>' +
'<div class="modal-actions"><button class="btn primary" type="button" data-pair="confirm">الرمزان متطابقان</button>' +
'<button class="btn ghost" type="button" data-pair="end">إلغاء</button></div>';
}
function pairActiveHtml() {
var resend = '';
if (pairUi.resendBody) {
var same = pairUi.resendBody.peerDeviceCode === pairUi.session.peer.deviceCode;
resend = same
? '<p class="modal-note">إعادة إرسال نتائج المطابقة المحفوظة مع هذا الجهاز.</p><div class="modal-actions"><button class="btn gold" type="button" data-pair="send-results">أرسل النتائج المحفوظة</button></div>'
: '<p class="modal-note">النتائج المحفوظة تخص جهازاً آخر، لا يمكن إرسالها إلى هذا الجهاز.</p>';
}
var accName = pairUi.session.account ? pairUi.session.account.name : '';
var shareChecked = pairUi.session.shareSummary !== false;
return '<p class="modal-note">الجهاز المقترن: ' + escapeHtml(pairUi.session.peer.deviceCode) + ' — الرمز ' + escapeHtml(pairUi.session.code) +
' — حسابه عندك: ' + escapeHtml(accName) + '</p>' +
'<label style="display:flex;align-items:center;gap:8px;font-size:calc(12px * var(--font-scale, 1));margin:6px 0 8px;cursor:pointer">' +
'<input type="checkbox" id="pairShareSummary"' + (shareChecked ? ' checked' : '') + ' />' +
'<span>مشاركة شارة انضباط الدفتر كدليل اجتماعي (عدد القيود والتوازن وأيام السيولة فقط — بدون أي مبالغ)</span>' +
'</label>' +
'<div class="modal-actions"><button class="btn ghost" type="button" data-pair="export">تصدير قيود حسابه (ملف مشفّر)</button>' +
'<label class="btn ghost small" style="cursor:pointer">استيراد ملف الطرف الآخر<input id="pairFile" type="file" accept="application/json" hidden /></label></div>' +
resend +
(pairUi.review ? pairReviewHtml() : '<p class="modal-note">استورد ملف الطرف الآخر لتبدأ المطابقة.</p>') +
'<div class="modal-actions"><button class="btn ghost" type="button" data-pair="end">إنهاء الجلسة</button></div>' +
'<div id="pairSaved"></div>';
}
function pairItemHtml(it) {
var E = window.RohEngine;
var P = pairEng();
var e = it.entry;
var kindLabel = function (k) { return (E.KIND_META[k] || {}).label || (P.KIND_NAMES[k] || k); };
var group = it.group === 'countExtra' && it.side === 'local' ? 'فرق في العدد (عندك أكثر)' : PAIR_KIND_NAMES[it.group];
var state = it.applied ? 'أُضيف' : ({ matched: 'مطابق', notMatched: 'غير مطابق', notReviewed: 'لم يُراجع' }[it.state] || '');
var amount = E.fmtMoney(e.amountBase) + (e.currency !== E.BASE ? ' (' + e.currency + ')' : '');
var head = E.fmtDate(e.date) + ' • ' + amount + ' • ' + (it.side === 'remote' ? 'عنده: ' : 'عندك: ') + kindLabel(e.kind);
var mirror = '';
if (it.side === 'remote') {
var mk = P.mirrorKind(e.kind);
if (it.kindDiffers) mirror = 'عندك مسجّل «' + kindLabel(it.localKind) + '» بالمبلغ نفسه، والمتوقَّع «' + kindLabel(mk) + '».';
else if (it.group !== 'shared' && it.group !== 'choice') {
mirror = P.canMirror(e, E.BASE) ? 'يُضاف عندك: ' + kindLabel(mk) : 'لا يُضاف تلقائيًا، سجّله يدويًا إن كان صحيحًا.';
}
}
var memo = e.memo ? '<div class="pair-memo">' + escapeHtml(e.memo) + '</div>' : '';
var buttons = '';
if (it.side === 'remote' && !it.applied && it.group !== 'shared') {
var accept = it.group === 'choice' ? 'أضفه كقيد ثانٍ' : 'قبول';
buttons = '<div class="modal-actions">' +
'<button class="btn ghost small" type="button" data-pair="accept" data-id="' + escapeHtml(it.id) + '"' + (it.decision === 'accept' ? ' aria-pressed="true"' : '') + '>' + accept + '</button>' +
'<button class="btn ghost small" type="button" data-pair="reject" data-id="' + escapeHtml(it.id) + '"' + (it.decision === 'reject' ? ' aria-pressed="true"' : '') + '>رفض</button></div>';
}
return '<div class="pair-item" style="border-top:1px solid var(--line, #ddd);padding:8px 0">' +
'<div><strong>' + group + '</strong> — ' + state + '</div>' +
'<div>' + escapeHtml(head) + '</div>' + memo +
(mirror ? '<div class="modal-note">' + escapeHtml(mirror) + '</div>' : '') + buttons + '</div>';
}
function pairCashSelectHtml() {
var list = pairEng().cashAccounts(window.RohEngine);
if (!list.length) return '<p class="modal-note">لا يوجد حساب نقدي يقبل ' + escapeHtml(window.RohEngine.BASE) + '، فلا يمكن إضافة القيود.</p>';
if (!pairUi.cashId || !list.some(function (a) { return a.id === pairUi.cashId; })) {
pairUi.cashId = list.some(function (a) { return a.id === 'cash'; }) ? 'cash' : list[0].id;
}
return '<div class="form-row"><label for="pairCash">الحساب النقدي للقيود المضافة</label><select id="pairCash">' +
list.map(function (a) { return '<option value="' + escapeHtml(a.id) + '"' + (a.id === pairUi.cashId ? ' selected' : '') + '>' + escapeHtml(a.name) + '</option>'; }).join('') +
'</select></div>';
}
function pairReviewHtml() {
var r = pairUi.review;
var c = r.counts;
var remote = r.items.filter(function (x) { return x.side === 'remote'; });
var local = r.items.filter(function (x) { return x.side === 'local'; });
var summary = 'مطابق: ' + c.matched + ' • ناقص عندي: ' + c.onlyRemote + ' • ناقص عنده: ' + c.onlyLocal + ' • فرق في العدد: ' + c.countDiffs + ' • متشابهان: ' + c.choices +
(c.kindDiffs ? ' • نوع مختلف: ' + c.kindDiffs : '');
var socialProofHtml = '';
if (r.peerSummary && typeof r.peerSummary.entryCount === 'number') {
var spBal = r.peerSummary.balanced ? 'حسابه متوازن ✓' : 'قيد المراجعة';
var spRun = r.peerSummary.runwayDays === null ? 'سيولته مستقرة' : ('سيولته تكفي ' + r.peerSummary.runwayDays + ' يوماً');
socialProofHtml = '<div style="padding:10px 12px;border-radius:12px;background:var(--sand);border:1px solid var(--emerald);margin-bottom:8px;font-size:calc(12.5px * var(--font-scale, 1))">' +
'<b style="color:var(--emerald)">🤝 شارة انضباط الدفتر المقترن:</b><br>' +
'«المستخدم (' + escapeHtml(r.accountName || 'الطرف المقترن') + ') لديه <b>' + r.peerSummary.entryCount + ' قيداً</b>، ' + spBal + '، و' + spRun + '.»' +
'</div>';
}
var html = socialProofHtml +
'<p class="modal-note">الحساب المشترك: ' + escapeHtml(r.accountName || '') + '</p>' +
'<p class="modal-note">' + escapeHtml(summary) + '</p>';
html += remote.concat(local).map(pairItemHtml).join('') || '<p class="modal-note">لا قيود بينكما في الدفترين.</p>';
html += pairCashSelectHtml();
html += '<div class="modal-actions"><button class="btn gold" type="button" data-pair="apply">تطبيق المقبول</button>' +
'<button class="btn ghost" type="button" data-pair="save">حفظ النتائج (7 أيام)</button></div>';
return html;
}
function pairLoadSaved() {
if (!pairEng()) return;
var P = pairEng();
Promise.all([P.loadResults(), P.loadReceived()]).then(function (got) {
var box = document.getElementById('pairSaved');
if (!box) return;
var saved = got[0], received = got[1];
var html = '';
html += '<div class="settings-search-box" style="margin-bottom:10px"><input id="settingsSearch" type="search" placeholder="بحث في الإعدادات…" oninput="filterSettings(this.value)" style="width:100%;min-height:38px;padding:8px 12px;border-radius:12px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size:calc(13px*var(--font-scale,1))" /></div>';
var settingsTabs = [['all','الكل'],['profile','الهوية'],['display','العرض'],['currency','العملة'],['zakat','الزكاة'],['access','الوصول'],['backup','النسخ'],['data','البيانات']];
html += '<div class="settings-tabs" style="display:flex;gap:6px;overflow-x:auto;margin-bottom:12px;padding-bottom:4px">' +
settingsTabs.map(function (t) {
return '<button type="button" class="btn ghost small' + (ui.settingsTab === t[0] ? ' active' : '') + '" data-action="set-settings-tab" data-tab="' + t[0] + '" style="flex:0 0 auto;white-space:nowrap">' + t[1] + '</button>';
}).join('') + '</div>';
if (saved) {
var until = new Date(saved.savedAt + P.RESULT_MS);
html += '<p class="modal-note">نتائج محفوظة من الجهاز ' + escapeHtml(saved.peerDeviceCode) +
'، تُحذف في ' + escapeHtml(until.toLocaleDateString('ar')) + '.</p>' +
'<div class="modal-actions"><button class="btn ghost small" type="button" data-pair="resend-results">أعِد الإرسال</button>' +
'<button class="btn ghost small" type="button" data-pair="delete-results">حذف النتائج</button></div>';
}
if (received) {
var t = P.resultsSummary(received);
var until2 = new Date(received.savedAt + P.RESULT_MS);
html += '<p class="modal-note">نتائج مستلمة من الجهاز ' + escapeHtml(received.peerDeviceCode) + ': قبِل ' + t.accepted +
'، رفض ' + t.rejected + '، أُضيف ' + t.applied + '، لم يُراجع ' + t.notReviewed + '. تُحذف في ' + escapeHtml(until2.toLocaleDateString('ar')) + '.</p>' +
'<div class="modal-actions"><button class="btn ghost small" type="button" data-pair="delete-received">حذف النتائج المستلمة</button></div>';
}
box.innerHTML = html;
}).catch(function () { /* nothing stored */ });
}
async function pairStart(resendBody) {
if (!E.planAllows('pairing')) {
var pLeft = E.featureTrialLeft ? E.featureTrialLeft('pairing') : 0;
if (pLeft && pLeft > 0) {
var pTr = E.useFeatureTrial('pairing');
if (pTr && pTr.ok) toast('تجربة مجانية لإقران ومطابقة الأجهزة (متبقي لك ' + pTr.remaining + ' تجارب مجانية)');
} else {
openActivation('إقران الأجهزة ومطابقة الدفاتر وجهاً لوجه متاح في باقة الأعمال.');
return;
}
}
closePairingSession();
var res = await pairEng().begin();
if (!res.ok) { pairNote(res.error, true); return; }
pairUi.session = res.session;
pairUi.hello = res.hello;
pairUi.resendBody = resendBody || null;
pairUi.timer = setInterval(pairTick, 15000);
renderPairing();
}
async function pairJoinText(text) {
var s = pairUi.session;
if (!s) return;
var res = await pairEng().join(s, text);
if (!res.ok) { pairNote(res.error, true); return; }
pairStopScan();
renderPairing();
pairNote('حسابه عندك: ' + res.account.name + '. قارن الرمز على الجهازين ثم أكّد.');
}
var pairScan = { stream: null, timer: null, canvas: null };
function pairStopScan() {
if (!pairScan) return; // not set up yet (very early in boot)
if (pairScan.timer) { clearTimeout(pairScan.timer); pairScan.timer = null; }
if (pairScan.stream) {
pairScan.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) { /* already stopped */ } });
pairScan.stream = null;
}
var box = document.getElementById('pairScan');
if (box) { box.innerHTML = ''; box.hidden = true; }
}
async function pairStartScan() {
pairStopScan();
var box = document.getElementById('pairScan');
var media = navigator.mediaDevices;
if (!box || typeof window.jsQR !== 'function' || !media || !media.getUserMedia) {
pairNote('المسح غير متاح على هذا الجهاز. أرسل الرسالة والصق رسالة الطرف الآخر.', true);
return;
}
var session = pairUi.session;
box.hidden = false;
box.innerHTML = '<video id="pairVideo" playsinline muted autoplay aria-label="الكاميرا" style="width:100%;max-height:50vh;background:#000;border-radius:8px;display:block"></video>' +
'<div class="modal-actions"><button class="btn ghost" type="button" data-pair="qr-stop">إيقاف المسح</button></div>';
pairNote('اسمح باستخدام الكاميرا، ثم وجّهها إلى رمز الجهاز الآخر.');
var stream;
try {
stream = await media.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
} catch (e) {
pairStopScan();
pairNote('لم تُفتح الكاميرا. أرسل الرسالة والصق رسالة الطرف الآخر بدلاً من ذلك.', true);
return;
}
if (pairUi.session !== session || !session || session.peer || document.getElementById('pairScan') !== box) {
stream.getTracks().forEach(function (t) { t.stop(); });
return;
}
pairScan.stream = stream;
var video = document.getElementById('pairVideo');
video.srcObject = stream;
try { await video.play(); } catch (e) { /* autoplay may still start it */ }
pairScanTick();
}
function pairScanTick() {
pairScan.timer = null;
var video = document.getElementById('pairVideo');
if (!pairScan.stream || !video) return;
if (video.readyState >= 2 && video.videoWidth) {
var scale = Math.min(1, 800 / Math.max(video.videoWidth, video.videoHeight));
var w = Math.round(video.videoWidth * scale), h = Math.round(video.videoHeight * scale);
var canvas = pairScan.canvas || (pairScan.canvas = document.createElement('canvas'));
if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
var ctx = canvas.getContext('2d', { willReadFrequently: true });
ctx.drawImage(video, 0, 0, w, h);
var hit = null;
try { hit = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' }); } catch (e) { hit = null; }
if (hit && hit.data) {
if (pairEng() && pairEng().parseHello(hit.data)) {
pairStopScan();
var peer = document.getElementById('pairPeer');
if (peer) peer.value = hit.data;
pairJoinText(hit.data);
return;
}
pairNote('هذا ليس رمز اقتران من موني كود.', true);
}
}
pairScan.timer = setTimeout(pairScanTick, 200);
}
function pairClick(ev) {
var btn = ev.target.closest ? ev.target.closest('[data-pair]') : null;
if (!btn || !pairEng()) return;
var act = btn.getAttribute('data-pair');
var P = pairEng();
var s = pairUi.session;
if (act === 'start') return pairStart();
if (act === 'qr-scan') return pairStartScan();
if (act === 'qr-stop') { pairStopScan(); pairNote('أُوقف المسح.'); return; }
if (act === 'resend-results') {
return P.loadResults().then(function (saved) {
if (!saved) { pairNote('لا نتائج محفوظة، أو انتهت مدتها.', true); renderPairing(); return; }
pairStart(saved);
});
}
if (act === 'send-results') {
if (!s || !s.confirmed || !pairUi.resendBody) { pairNote('أكّد الرمز أولاً.', true); return; }
P.exportResults(s, pairUi.resendBody).then(function (res) {
if (!res.ok) { pairNote(res.error, true); return; }
var name = 'MoneyCode-results-' + window.RohEngine.todayISO() + '.json';
if (window.RohPrint && window.RohPrint.sendFile) {
if (!window.RohPrint.sendFile(res.text, name)) { pairNote('تعذر تجهيز الملف', true); return; }
} else {
downloadTextFile(res.text, name);
}
pairNote('صُدّرت النتائج مشفّرة. أرسلها إلى الجهاز الآخر.');
});
return;
}
if (act === 'end') { closePairingSession(); renderPairing(); return; }
if (act === 'share-app') {
var invite = 'حمّل تطبيق «موني كود» (محاسبك الذكي بدون إنترنت) لنطابق الحسابات والديون بيننا مباشرة عبر QR أو NFC.\n' +
'متوفر على متجر Google Play Store، وللتفعيل المباشر تواصل عبر واتساب: +967770550110 / +96899323110\n' +
'رمز جهازي لإضافته في حسابي لديك: ' + E.deviceCode();
if (window.RohPrint && window.RohPrint.sendText) { window.RohPrint.sendText(invite); return; }
copyText(invite, 'تم نسخ رسالة دعوة الشريك مع رمز جهازك');
return;
}
if (act === 'join') {
var peer = document.getElementById('pairPeer');
return pairJoinText(peer ? peer.value : '');
}
if (act === 'share') {
if (window.RohPrint && window.RohPrint.sendText) { window.RohPrint.sendText(pairUi.hello); return; }
try { navigator.clipboard.writeText(pairUi.hello); pairNote('نُسخت الرسالة.'); } catch (e) { pairNote('تعذر النسخ، انسخ الرسالة يدوياً.', true); }
return;
}
if (act === 'nfc-offer') {
var offer = P.offerNative(pairUi.hello);
pairNote(offer.ok ? 'الرسالة معروضة عبر NFC. قرّب الهاتفين.' : offer.error, !offer.ok);
return;
}
if (act === 'nfc-read') {
window.__rohPairReceived = function (text) {
window.__rohPairReceived = null;
P.stopNative();
var peer = document.getElementById('pairPeer');
if (peer) peer.value = text;
pairJoinText(text);
};
var read = P.readNative();
pairNote(read.ok ? 'قرّب الهاتف من الجهاز الآخر (الذي يعرض رسالته عبر NFC).' : read.error, !read.ok);
return;
}
if (act === 'confirm') {
var ok = P.confirm(s);
if (!ok.ok) { pairNote(ok.error, true); return; }
renderPairing();
return;
}
if (act === 'export') {
if (!s || !s.confirmed) { pairNote('أكّد الرمز أولاً.', true); return; }
P.exportBook(s).then(function (res) {
if (!res.ok) { pairNote(res.error, true); return; }
var name = 'MoneyCode-pairing-' + window.RohEngine.todayISO() + '.json';
if (window.RohPrint && window.RohPrint.sendFile) {
if (!window.RohPrint.sendFile(res.text, name)) { pairNote('تعذر تجهيز الملف', true); return; }
} else {
downloadTextFile(res.text, name);
}
pairNote('صُدِّرت قيود حسابه مشفّرة. أرسلها إليه.');
});
return;
}
if (act === 'accept' || act === 'reject') {
if (!pairUi.review) return;
if (s) P.liveSession(s); // deciding is activity: the session stays open while the owner reviews
var r = P.setDecision(pairUi.review, btn.getAttribute('data-id'), act === 'accept' ? 'accept' : 'reject');
if (!r.ok) { pairNote(r.error, true); return; }
renderPairing();
return;
}
if (act === 'apply') {
if (!pairUi.review) return;
if (s) P.liveSession(s);
var res2 = P.applyAccepted(pairUi.review, { cashAccountId: pairUi.cashId });
if (!res2.ok) { pairNote(res2.error, true); return; }
renderAll();
renderPairing();
var msg = 'أُضيف ' + res2.applied + ' قيد.';
if (res2.failed.length) msg += ' لم يُضف ' + res2.failed.length + ': ' + res2.failed[0].error;
pairNote(msg, res2.failed.length > 0);
return;
}
if (act === 'save') {
P.saveResults(pairUi.review).then(function (res) {
pairNote(res.ok ? 'حُفظت النتائج مشفّرة لسبعة أيام.' : res.error, !res.ok);
});
return;
}
if (act === 'delete-results') {
P.deleteResults();
pairNote('حُذفت النتائج المحفوظة.');
pairLoadSaved();
return;
}
if (act === 'delete-received') {
P.deleteReceived();
pairNote('حُذفت النتائج المستلمة.');
pairLoadSaved();
}
}
function pairChange(ev) {
if (ev.target && ev.target.id === 'pairShareSummary') {
if (pairUi.session) pairUi.session.shareSummary = !!ev.target.checked;
return;
}
if (ev.target && ev.target.id === 'pairCash') { pairUi.cashId = ev.target.value; return; }
if (!ev.target || ev.target.id !== 'pairFile' || !pairEng()) return;
var file = ev.target.files[0];
if (!file) return;
var reader = new FileReader();
reader.onerror = function () { pairNote('تعذرت قراءة الملف', true); };
reader.onload = function () {
var s = pairUi.session;
if (!s) return;
var text = String(reader.result || '');
pairEng().importBook(s, text).then(function (res) {
if (!res.ok && res.isResults) {
return pairEng().importResults(s, text).then(function (rr) {
if (!rr.ok) { pairNote(rr.error, true); return; }
var t = rr.summary;
var line = 'نتائج من الطرف الآخر: قبِل ' + t.accepted + ' قيداً من دفترك، ورفض ' + t.rejected + '، وأضاف ' + t.applied + '، ولم يُراجع ' + t.notReviewed + '.';
return pairEng().saveReceived(rr.body).then(function (sv) {
pairNote(sv.ok ? line + ' حُفظت مشفّرة لسبعة أيام.' : line + ' تعذر حفظها: ' + sv.error, !sv.ok);
pairLoadSaved();
});
});
}
if (!res.ok) { pairNote(res.error, true); return; }
pairUi.review = pairEng().newReview(s, res.body);
if (S().settings && S().settings.autoMatch) {
var _rev = pairUi.review;
(_rev.items || []).forEach(function (it) {
if (it.side === 'remote' && (it.group === 'shared' || (it.group === 'choice' && !it.kindDiffers))) {
pairEng().setDecision(_rev, it.id, 'accept');
}
});
var _res2 = pairEng().applyAccepted(_rev, { cashAccountId: pairUi.cashId });
if (_res2 && _res2.ok) {
renderAll();
pairNote('مطابقة تلقائية: أُضيف ' + _res2.applied + ' قيد.' + (_res2.failed.length ? ' لم يُضف ' + _res2.failed.length + '.' : ''));
renderPairing();
return;
}
}
renderPairing();
var c = pairUi.review.counts;
pairNote('قُورنت القيود بينكما: ' + c.matched + ' مطابق، ' + c.onlyRemote + ' ناقص عندك، ' + c.onlyLocal + ' ناقص عنده.');
});
};
reader.readAsText(file);
}
function openImport() {
var curCount = (S().entries || []).length;
openSheet('استعادة نسخة احتياطية (محلية أو سحابية مشفرة)',
'<p class="modal-note">اختر ملف النسخة الاحتياطية (المشفر بكلمة مرور أو JSON) أو الصق محتواه. يتم فحص سلامة وتوازن القيود قبل قبول الاستعادة.</p>' +
(curCount > 0 ? '<div class="offer-banner" style="margin-bottom:8px">🛡 شرط الأمان مفعل: يحتوي دفترك الحالي على ' + curCount + ' قيداً. سيحفظ التطبيق تلقائياً «نسخة أمان أخيرة» منها قبل الاستبدال.</div>' : '') +
'<div class="modal-actions"><button class="btn primary" type="button" id="importPick">📂 اختيار ملف نسخة احتياطية</button></div>' +
'<textarea id="importArea" aria-label="بيانات الاستيراد" spellcheck="false" placeholder="{ ... }"></textarea>' +
'<input id="importFile" type="file" hidden />' +
'<div id="importIntegrityBox" class="modal-note" hidden></div>' +
'<div class="form-row" id="importPasswordRow" hidden><label for="importPassword">كلمة مرور فك التشفير (Zero-Knowledge AES-256)</label><div class="password-field"><input id="importPassword" type="password" autocomplete="off" dir="ltr" style="text-align:center" /><button type="button" class="password-toggle" data-target="importPassword" aria-label="إظهار كلمة المرور">👁</button></div></div>' +
'<div class="modal-actions">' +
'<button class="btn gold" data-action="do-import">فحص واستعادة الدفاتر</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button>' +
'</div>');
document.getElementById('importPick').addEventListener('click', function () { document.getElementById('importFile').click(); });
document.getElementById('importFile').addEventListener('change', function (ev) {
var file = ev.target.files[0];
if (!file) return;
var reader = new FileReader();
reader.onerror = function () { toast('تعذرت قراءة الملف', true); };
reader.onload = function () {
var area = document.getElementById('importArea');
if (!area) return;
area.value = reader.result;
showImportPassword(area.value);
};
reader.readAsText(file);
});
document.getElementById('importArea').addEventListener('input', function (ev) { showImportPassword(ev.target.value); });
}
function openImportCSV() {
openSheet('استيراد مالي (CSV/OFX/QIF)',
'<p class="modal-note">الصق محتوى CSV/OFX/QIF أو اختر ملفاً (UTF-8). الأعمدة CSV: date, kind, amount, currency, counterparty, memo, account, dueDate. المبلغ مطلوب؛ kind افتراضي "expense".</p>' +
'<textarea id="csvArea" aria-label="بيانات الاستيراد" spellcheck="false" placeholder="date,kind,amount,currency,counterparty,memo"></textarea>' +
'<div class="modal-actions"><button class="btn ghost" type="button" id="csvPick">اختيار ملف</button> <button class="btn ghost" type="button" id="csvPreview">معاينة</button></div>' +
'<input id="csvFile" type="file" accept=".csv,.ofx,.qif,text/*" hidden />' +
'<div id="csvPreviewBox" class="modal-note" style="max-height:180px;overflow:auto;display:none"></div>' +
'<div class="modal-actions">' +
'<button class="btn gold" data-action="do-import-csv">استيراد</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button>' +
'</div>');
document.getElementById('csvPick').addEventListener('click', function () { document.getElementById('csvFile').click(); });
document.getElementById('csvFile').addEventListener('change', function (ev) {
var file = ev.target.files[0];
if (!file) return;
var reader = new FileReader();
reader.onerror = function () { toast('تعذرت قراءة الملف', true); };
reader.onload = function () {
var area = document.getElementById('csvArea');
if (area) area.value = reader.result;
};
reader.readAsText(file, 'UTF-8');
});
document.getElementById('csvPreview').addEventListener('click', function () {
var area = document.getElementById('csvArea');
var box = document.getElementById('csvPreviewBox');
if (!area || !box) return;
var text = area.value || '';
var res;
if (/<OFX/i.test(text)) res = E.previewCSV ? null : null;
if (/<OFX/i.test(text)) {
var ofxRes = E.importOFX ? 'OFX: ' + (text.match(/<STMTTRN>/gi) || []).length + ' معاملة' : '';
box.innerHTML = '<b>OFX</b>: ' + (text.match(/<STMTTRN>/gi) || []).length + ' معاملة';
box.style.display = 'block';
return;
}
if (/^!Type:/m.test(text)) {
var qifEntries = (text.match(/^\^$/gm) || []).length;
box.innerHTML = '<b>QIF</b>: ' + qifEntries + ' معاملة';
box.style.display = 'block';
return;
}
var pv = E.previewCSV ? E.previewCSV(text) : null;
if (!pv || !pv.ok) { box.innerHTML = '<span style="color:var(--danger)">' + esc(pv ? pv.error : 'تعذر المعاينة') + '</span>'; box.style.display = 'block'; return; }
var html = '<b>CSV</b>: ' + pv.count + ' صف<br>';
pv.rows.slice(0, 20).forEach(function (r) {
var cls = r.valid ? (r.duplicate ? 'color:var(--gold)' : 'color:var(--emerald)') : 'color:var(--danger)';
html += '<div style="font-size: calc(10.5px * var(--font-scale,1));' + cls + '">' + r.line + '. ' + esc(r.date) + ' | ' + esc(r.kind) + ' | ' + (r.amount == null ? '—' : r.amount) + ' ' + esc(r.currency) + (r.counterparty ? ' | ' + esc(r.counterparty) : '') + (r.duplicate ? ' (مكرر؟)' : '') + (r.error ? ' — ' + esc(r.error) : '') + '</div>';
});
if (pv.rows.length > 20) html += '<div>...+' + (pv.rows.length - 20) + '</div>';
box.innerHTML = html;
box.style.display = 'block';
});
}
function doImportCSV() {
var area = document.getElementById('csvArea');
if (!area) return;
var text = area.value || '';
if (!text.trim()) { toast('الصق بيانات CSV/OFX/QIF أو اختر ملفاً', true); return; }
if (E.createSafetySnapshot) E.createSafetySnapshot('pre-import');
var res = E.importFinancial ? E.importFinancial(text) : E.importCSV(text);
if (!res.ok) { toast(res.error, true); return; }
var msg = 'تم استيراد ' + res.imported + ' قيد';
if (res.format) msg = '[' + res.format + '] ' + msg;
if (res.failed) msg += '، فشل ' + res.failed;
if (res.errors && res.errors.length) msg += '\n' + res.errors.slice(0, 5).join('\n');
toast(msg, res.failed > 0);
pushReceipts(res.entryIds);
closeSheet();
renderAll();
}
function parseImportText(text) {
try { return JSON.parse(String(text).replace(/^\uFEFF/, '')); } catch (e) { return null; }
}
function showImportPassword(text) {
var parsed = parseImportText(text);
var encrypted = E.isEncryptedBackup(parsed);
var row = document.getElementById('importPasswordRow');
var intBox = document.getElementById('importIntegrityBox');
if (row) row.hidden = !encrypted;
if (encrypted) {
if (intBox) {
intBox.hidden = false;
intBox.innerHTML = '🔒 <b>ملف مشفر بمعيار Zero-Knowledge AES-256:</b> أدخل كلمة المرور لفك التشفير وفحص سلامة وتوازن القيود.';
}
document.getElementById('importPassword').focus();
return;
}
if (intBox) {
if (!parsed) {
intBox.hidden = !String(text || '').trim();
intBox.innerHTML = '<span style="color:var(--danger)">⚠ الملف ليس بتنسيق JSON صالح.</span>';
} else if (E.previewBackup) {
var pv = E.previewBackup(parsed);
intBox.hidden = false;
intBox.innerHTML = pv.ok
? '<span style="color:var(--emerald);font-weight:700">✓ فحص سلامة البيانات ناجح: ' + pv.entryCount + ' قيد متوازن • ' + pv.accountCount + ' حساب • العملة: ' + esc(pv.baseCurrency) + '</span>'
: '<span style="color:var(--danger);font-weight:700">✗ فشل فحص السلامة: ' + esc(pv.error) + '</span>';
}
}
}
function doImport() {
var area = document.getElementById('importArea');
if (!area) return;
var parsed = parseImportText(area.value);
if (!parsed) {
toast('النص ليس JSON صالحاً', true);
return;
}
if (E.isEncryptedBackup(parsed)) {
var password = document.getElementById('importPassword').value;
if (!password) { showImportPassword(area.value); toast('اكتب كلمة مرور الملف', true); return; }
E.decryptBackup(parsed, password).then(function (res) {
if (!res.ok) { toast(res.error, true); return; }
applyImport(res.data);
});
return;
}
applyImport(parsed);
}
function applyImport(parsed) {
var attachments = parsed.attachments || [];
delete parsed.attachments;
if (E.getStorageStatus().fault === 'damaged') {
E.resolveDamagedDb(parsed).then(function (out) {
if (!out.ok) { toast('استيراد مرفوض: ' + out.error, true); return; }
restoreAttachments(attachments).then(function () { afterDamageResolved('تم استيراد البيانات بنجاح'); });
});
return;
}
var runReplace = function () {
var wasActivated = E.isActivated();
var res = E.replaceState(parsed);
if (!res.ok) { toast('استيراد مرفوض: ' + res.error, true); return; }
var st = S();
if (!st.messages.length) { seedWelcome(); E.saveState(); }
var nowActivated = !wasActivated && E.isActivated();
restoreAttachments(attachments).then(function () {
closeSheet();
renderAll();
botText(nowActivated ? 'تمت الاستعادة — وعاد التفعيل من نسختك الاحتياطية.' : 'تمت الاستعادة. حُفظت نسخة أمان من بياناتك السابقة.');
toast(nowActivated ? 'تم استيراد البيانات، وعاد التفعيل من نسختك الاحتياطية' : 'تمت الاستعادة بنجاح بعد حفظ نسخة أمان من بياناتك السابقة');
});
};
if (E.createSafetySnapshot && (S().entries || []).length > 0) {
E.createSafetySnapshot('pre-restore').then(runReplace).catch(runReplace);
} else {
runReplace();
}
}
function afterDamageResolved(message) {
if (!S().messages.length) { seedWelcome(); E.saveState(); }
closeSheet();
renderStorageStatus();
setTab('bot');
toast(message);
}
function renderSaveBanner(status) {
var banner = document.getElementById('saveBanner');
if (!banner) return;
var show = !status.fault && status.save !== 'ok';
banner.hidden = !show;
if (!show) { banner.innerHTML = ''; return; }
banner.classList.toggle('critical', status.save === 'failed');
banner.innerHTML =
'<p>' + (status.save === 'failed'
? 'لم تُحفظ آخر تغييراتك وستضيع إذا أغلقت التطبيق. صدّر نسخة احتياطية الآن.'
: 'تعذر الحفظ في مخزن التطبيق، فحُفظت بياناتك في نسخة مؤقتة. يُفضل تصدير نسخة احتياطية.') + '</p>' +
(status.error ? '<code class="save-banner-detail" dir="ltr">' + esc(status.error) + '</code>' : '') +
'<div class="save-banner-actions">' +
'<button class="btn ghost small" id="saveBannerExport">تصدير نسخة</button>' +
'<button class="btn ghost small" id="saveBannerRetry">إعادة المحاولة</button>' +
'</div>';
document.getElementById('saveBannerExport').addEventListener('click', openExport);
document.getElementById('saveBannerRetry').addEventListener('click', function () {
Promise.resolve(E.saveState()).then(function (result) {
renderStorageStatus();
if (result === 'ok') toast('تم حفظ بياناتك');
else toast('ما زال الحفظ متعذراً', true);
});
});
}
function renderStorageFault(status) {
var panel = document.getElementById('storageFault');
if (!panel) return;
panel.hidden = !status.fault;
if (!status.fault) { panel.innerHTML = ''; return; }
var damaged = status.fault === 'damaged';
panel.innerHTML =
'<div class="storage-fault-card">' +
'<h1>' + (damaged ? 'تعذر فتح دفاترك' : 'تعذرت قراءة دفاترك') + '</h1>' +
'<p>' + (damaged
? 'ملف بياناتك على هذا الجهاز تالف. لم نحذف شيئاً، ولن يُكتب فوقه. يمكنك استيراد آخر نسخة احتياطية لديك، أو بدء دفاتر جديدة مع الاحتفاظ بالملف التالف على الجهاز.'
: 'لم يتمكن التطبيق من قراءة بياناتك الآن. لم يُحذف شيء. أعد المحاولة، وإن استمرت المشكلة فأعد تشغيل الجهاز.') + '</p>' +
'<div class="storage-fault-actions">' +
'<button class="btn primary" id="faultRetry">إعادة المحاولة</button>' +
(damaged
? '<button class="btn ghost" id="faultImport">استيراد نسخة احتياطية</button>' +
'<button class="btn danger" id="faultFresh">بدء دفاتر جديدة</button>'
: '') +
'</div></div>';
var faultCard = panel.querySelector('.storage-fault-card'); if (faultCard) { faultCard.setAttribute('tabindex', '-1'); try { faultCard.focus(); } catch (e) {} }
document.getElementById('faultRetry').addEventListener('click', function () { window.location.reload(); });
if (!damaged) return;
document.getElementById('faultImport').addEventListener('click', openImport);
document.getElementById('faultFresh').addEventListener('click', function () {
askConfirm('بدء دفاتر جديدة', 'ستبدأ بدفاتر فارغة، ولن تظهر فيها بياناتك الحالية. يبقى الملف التالف محفوظاً على الجهاز. هل تريد المتابعة؟', function () {
E.resolveDamagedDb().then(function (out) {
if (!out.ok) { toast(out.error, true); return; }
afterDamageResolved('بدأت دفاتر جديدة');
});
});
});
}
function renderStorageStatus() {
var status = E.getStorageStatus();
renderStorageFault(status);
renderSaveBanner(status);
}
function copyExport() {
ux('backup.export');
var area = document.getElementById('exportArea');
if (!area) return;
var text = area.value;
var done = function () { toast('تم نسخ النسخة الاحتياطية'); };
var fallback = function () {
try {
area.focus();
area.select();
area.setSelectionRange(0, text.length);
var ok = document.execCommand('copy');
if (ok) done(); else toast('تعذر النسخ تلقائياً — حدد النص وانسخه يدوياً', true);
} catch (e) {
toast('تعذر النسخ — حدد النص وانسخه يدوياً', true);
}
};
if (navigator.clipboard && navigator.clipboard.writeText) {
navigator.clipboard.writeText(text).then(done).catch(fallback);
} else fallback();
}
function runIntegrity() {
var check = E.validateState(S());
var a = E.computeAnalysis();
var missing = a.missingAccounts;
openSheet('فحص سلامة الدفاتر',
(missing.lines
? '<div class="alert danger"><span class="a-glyph">✗</span><span>' +
missing.lines + ' سطراً تشير إلى ' + missing.ids.length + ' حساب غير موجود، فهي غير محسوبة في الأرصدة وصافي الثروة (مدين ' +
money(missing.debit) + '، دائن ' + money(missing.credit) + ').</span></div>'
: '') +
'<div class="alert ' + (check.ok ? 'ok' : 'danger') + '"><span class="a-glyph">' +
(check.ok ? '✓' : '✗') + '</span><span>' +
(check.ok ? 'كل القيود متوازنة: مجموع المدين = مجموع الدائن.' : esc(check.error)) +
'</span></div>' +
row('عدد القيود', String(a.entryCount)) +
row('مجموع المدين', '<span class="amount">' + money(a.totals.debit) + '</span>') +
row('مجموع الدائن', '<span class="amount">' + money(a.totals.credit) + '</span>') +
row('الفرق', '<span class="amount ' + (a.totals.imbalance === 0 ? 'pos' : 'neg') + '">' + money(a.totals.imbalance) + '</span>') +
row('صافي الثروة', '<span class="amount">' + money(a.netWorth) + '</span>') +
'<div class="modal-actions" style="margin-top:12px">' +
'<button class="btn ghost" data-action="modal-cancel">إغلاق</button></div>');
}
function resetAll() {
askConfirm('مسح كل البيانات', 'سيتم حفظ «نسخة أمان محلية أخيرة» ثم مسح جميع القيود والحسابات والرسائل الحالية. هل أنت متأكد؟', function () {
var doReset = function () {
E.resetState();
clearAttachments();
seedWelcome();
E.saveState();
closeSheet();
renderAll();
setTab('bot');
toast('تم مسح البيانات (وحُفظت نسخة أمان محلية في مركز النسخ الاحتياطي)');
};
if (E.createSafetySnapshot && (S().entries || []).length > 0) {
E.createSafetySnapshot('pre-reset').then(doReset).catch(doReset);
} else {
doReset();
}
}, 'حذف');
}
var voicePending = null;
var voiceContinuous = false;
function updateActionBtn() {
if (!els.actionBtn) return;
var hasText = els.input && els.input.value.trim().length > 0;
els.actionBtn.innerHTML = hasText ? UI_ICONS.send : UI_ICONS.mic;
els.actionBtn.setAttribute('aria-label', hasText ? 'إرسال' : 'إدخال صوتي');
}
function stopVoiceUi() {
if (els.actionBtn) { els.actionBtn.classList.remove('listening'); updateActionBtn(); }
}
function armVoiceTimeout(ms) {
if (!voicePending) return;
if (voicePending.timer) clearTimeout(voicePending.timer);
var id = voicePending.id;
voicePending.timer = setTimeout(function () {
if (voicePending && voicePending.id === id) {
voicePending = null;
stopVoiceUi();
toast('انتهت مهلة الإدخال الصوتي.', true);
}
}, ms);
}
window.__rohVoiceDone = function (id, payload) {
if (!voicePending || voicePending.id !== id) return;
var data;
try { data = typeof payload === 'string' ? JSON.parse(payload) : payload; }
catch (e) { data = { ok: false, error: 'رد غير صالح' }; }
if (data && data.needsPermission) {
toast(data.error || 'جارٍ طلب صلاحية الميكروفون…');
armVoiceTimeout(60000);
return;
}
var entry = voicePending;
voicePending = null;
if (entry.timer) clearTimeout(entry.timer);
stopVoiceUi();
if (data && data.ok && data.transcript) {
var transcript = String(data.transcript).trim();
if (entry.onText) { entry.onText(transcript); return; }
if (voiceContinuous) {
if (els.input) {
var cur = els.input.value.trim();
els.input.value = cur ? (cur + ' ' + transcript) : transcript;
autoGrow();
updateActionBtn();
updateComposerChipsVisibility();
}
toast('تم التعرف: ' + transcript);
if (voiceContinuous) {
setTimeout(function () { if (voiceContinuous) startVoice(); }, 200);
}
return;
}
if (els.input) {
els.input.value = '';
autoGrow();
updateActionBtn();
updateComposerChipsVisibility();
}
toast('تم التعرف: ' + transcript);
handleText(transcript);
} else if (data && data.silent) {
} else {
var voiceErr = (data && data.error) ? data.error : 'تعذر التعرف على الصوت.';
toast(voiceErr, true);
if (/حزمة اللغة العربية دون اتصال|التعرف على الصوت غير متوفر|تعذر التعرف على الصوت|حزمة اللغة العربية غير مثبتة/.test(voiceErr) && window.RohNative && typeof window.RohNative.openLanguageSettings === 'function') {
setTimeout(function () {
toast('اضغط على الزر أدناه لفتح «إعدادات الصوت» وتنزيل حزمة اللغة العربية', false);
var btn = document.createElement('button');
btn.className = 'btn primary small';
btn.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:9999;white-space:nowrap;font-size:calc(12px * var(--font-scale,1))';
btn.textContent = '⚙️ فتح إعدادات الصوت (للتنزيل أو التثبيت)';
btn.addEventListener('click', function () {
try { window.RohNative.openLanguageSettings(); } catch (e) {}
btn.remove();
});
document.body.appendChild(btn);
setTimeout(function () { btn.remove(); }, 15000);
}, 600);
}
}
};
function startVoice(onText) {
ux('voice.start');
if (E.noteFeature) E.noteFeature('voice');
if (window.RohNative && typeof window.RohNative.startVoice === 'function') {
if (voicePending) return; // already listening
var id = 'voice_' + Date.now();
voicePending = { id: id, onText: onText };
toast('تحدث الآن…');
try {
if (els.actionBtn) {
els.actionBtn.classList.add('listening');
els.actionBtn.innerHTML = '<span class="voice-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
}
window.RohNative.startVoice(id);
} catch (e) {
voicePending = null;
stopVoiceUi();
toast('تعذر تشغيل الميكروفون: ' + (e && e.message ? e.message : e), true);
return;
}
armVoiceTimeout(45000);
return;
}
var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SR) {
toast('الإدخال الصوتي غير متوفر على هذا الجهاز. استخدم الكتابة.', true);
return;
}
try {
if (recognition) { recognition.abort(); }
recognition = new SR();
recognition.lang = speechLocale();
recognition.interimResults = true;
recognition.maxAlternatives = 1;
var silenceTimer = null;
var finalTranscript = '';
recognition.onstart = function () {
toast('تحدث الآن…');
if (els.actionBtn) {
els.actionBtn.classList.add('listening');
els.actionBtn.innerHTML = '<span class="voice-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
}
};
recognition.onresult = function (ev) {
var interim = '';
for (var i = ev.resultIndex; i < ev.results.length; i++) {
var t = ev.results[i][0].transcript;
if (ev.results[i].isFinal) finalTranscript += t;
else interim += t;
}
var shown = (finalTranscript + interim).trim();
els.input.value = shown;
autoGrow();
if (silenceTimer) clearTimeout(silenceTimer);
silenceTimer = setTimeout(function () {
try { recognition.stop(); } catch (e) {}
}, 1300);
};
recognition.onerror = function (ev) {
var err = ev.error;
if (err === 'not-allowed') toast('تم رفض صلاحية الميكروفون.', true);
else if (err === 'no-speech') toast('لم يتم اكتشاف أي صوت.', true);
else toast('خطأ في التعرف على الصوت: ' + err, true);
if (silenceTimer) clearTimeout(silenceTimer);
if (els.actionBtn) { els.actionBtn.classList.remove('listening'); updateActionBtn(); }
};
recognition.onend = function () {
if (silenceTimer) clearTimeout(silenceTimer);
var transcript = finalTranscript.trim();
finalTranscript = '';
if (els.input) {
els.input.value = '';
autoGrow();
updateComposerChipsVisibility();
}
if (els.actionBtn) { els.actionBtn.classList.remove('listening'); updateActionBtn(); }
if (transcript) {
if (onText) onText(transcript);
else handleText(transcript);
}
};
recognition.start();
} catch (e) {
console.error('[RohUI] voice failed', e);
toast('تعذر تشغيل الميكروفون. تأكد من منح التطبيق الصلاحيات.', true);
}
}
function wantsAI(text) {
return AI_HINTS.test(E.normalizeAr(text));
}
function aiContext() {
var a = E.computeAnalysis();
var fmt = function (minor) { return E.fmtMoney(minor, E.BASE, false); };
var lines = [
'العملة الأساس: ' + E.BASE,
'السيولة المتاحة: ' + fmt(a.liquidity),
'صافي الثروة: ' + fmt(a.netWorth),
'مصروف آخر 30 يوماً: ' + fmt(a.burn30),
'المدى المالي: ' + (a.runwayDays === null ? 'غير محسوب (لا يوجد حرق)' : a.runwayDays + ' يوم'),
'استحقاقات قريبة: ' + fmt(a.dueSoon),
'عدد القيود: ' + a.entryCount,
'سلامة الدفاتر: ' + (a.totals.imbalance === 0 ? 'متوازنة' : 'اختلال ' + fmt(a.totals.imbalance))
];
var due = (a.dueItems || []).slice(0, 5).map(function (d) {
return '- ' + (d.kind === 'payable' ? 'علينا' : 'لنا') + ' ' + (d.counterparty || 'غير محدد') +
': ' + fmt(d.remaining) + (d.dueDate ? '، الاستحقاق ' + E.fmtDate(d.dueDate) : '');
});
if (due.length) lines.push('أقرب الاستحقاقات:\n' + due.join('\n'));
return lines.join('\n');
}
function findMessage(reqId) {
var st = S();
for (var i = st.messages.length - 1; i >= 0; i--) {
if (st.messages[i].reqId === reqId) return st.messages[i];
}
return null;
}
function speechFor(text) {
var t = String(text || '').replace(/<[^>]+>/g, '').replace(/[\u200E\u2060\u2066-\u2069]/g, '').replace(/\u00A0/g, ' ');
t = t.replace(/(-?)\u20C1\s*(\d[\d,]*(?:\.\d+)?)/g, '$1$2 ريال سعودي').replace(/ر\.س\s*(\d[\d,]*(?:\.\d+)?)/g, '$1 ريال سعودي');
t = t.replace(/YER\s*(\d[\d,]*(?:\.\d+)?)/g, '$1 ريال يمني').replace(/\bYER\b/g, 'ريال يمني');
try {
var currs = E.listCurrencies();
currs.forEach(function (c) {
if (c.code && c.name && c.code !== c.name) {
var re = new RegExp('\\b' + c.code + '\\b', 'g');
t = t.replace(re, c.name);
}
});
} catch (e) {}
if (S().settings.hideAmounts) t = t.replace(/[\d٠-٩][\d٠-٩,.٬٫]*\s*(ريال)?/g, 'مبلغ مخفي ').replace(/•+/g, 'مبلغ مخفي');
return t.trim();
}
var readingTimer = null;
function setReading(on, ms) {
var btn = document.getElementById('ttsStop');
if (btn) btn.hidden = !on;
if (readingTimer) { clearTimeout(readingTimer); readingTimer = null; }
if (on && ms > 0) {
readingTimer = setTimeout(function () { setReading(false); }, Math.min(600000, ms));
}
}
window.__rohSpeakDone = function () { setReading(false); };
function stopSpeaking() {
setReading(false);
try {
if (window.RohNative && typeof window.RohNative.stopSpeaking === 'function') window.RohNative.stopSpeaking();
else if (window.speechSynthesis) window.speechSynthesis.cancel();
} catch (e) {}
}
var autoSpeechReady = false;
function autoSpeak(m) {
if (!autoSpeechReady || !S().settings.autoTts || m.role !== 'bot') return;
if (m.type === 'draft') {
var draft = (S().drafts || []).filter(function (d) { return d.id === m.draftId; })[0];
if (draft) speakText('قِيدٌ مُقْتَرَحٌ: ' + E.KIND_META[draft.kind].label + ' ' + E.fmtMoney(draft.totalBase, E.BASE, false) + '. أَكِّدْهُ أَوْ عَدِّلْهُ.');
} else if (m.type === 'report' && m.data) {
var cash = function (v) { return E.fmtMoney(v, E.BASE, false); };
speakText('السيولة المتاحة ' + cash(m.data.liquidity) + '، وصافي الثروة ' + cash(m.data.netWorth) + '، ومصروف الشهر ' + cash(m.data.burn30) + '،.');
} else if (m.type === 'similar-account') {
if (m.options) speakText('هَلْ تَقْصِدُ: ' + m.options.map(function (o) { return o.name; }).join('، أو ') + '؟');
else speakText('يوجد حساب مشابه باسم ' + (m.existingName || '') + '. هل تقصد هذا الحساب؟');
} else if (m.type === 'duplicate-confirm') {
speakText('تَمَّتْ إِضَافَةُ قَيْدٍ مُمَاثِلٍ قَبْلَ قَلِيلٍ. هل تريد إضافة هذا القيد أيضاً؟');
} else if (m.type === 'ai-permission') {
speakText('هَلْ تَسْمَحُ بِالاتِّصَالِ بِخِدْمَةِ الذَّكاءِ الاصْطِنَاعِيِّ للإِجَابَةِ على سُؤَالِكَ؟');
} else if (m.type === 'text' || m.type === 'ai' || m.type === 'ai-error') {
speakText(m.text);
}
}
function speakText(text) {
var t = speechFor(text);
if (!t) return;
setReading(true, 3500 + t.length * 95);
if (window.RohNative && typeof window.RohNative.speak === 'function') {
try {
if (window.RohNative.setReadingLocale) window.RohNative.setReadingLocale(readingLocale(t));
window.RohNative.speak(t);
} catch (e) { setReading(false); toast('تعذر القراءة.', true); }
return;
}
if (window.speechSynthesis) {
try {
window.speechSynthesis.cancel();
var u = new SpeechSynthesisUtterance(t);
u.lang = readingLocale(t);
u.onend = function () { setReading(false); };
u.onerror = function () { setReading(false); };
window.speechSynthesis.speak(u);
} catch (e) { setReading(false); toast('تعذر القراءة.', true); }
return;
}
setReading(false);
toast('القراءة الصوتية غير متوفرة.', true);
}
function botAiOff() {}
function doAskAI(text) {
ux('ai.ask');
if (!(S().settings && S().settings.aiEnabled !== false)) {
botAiOff();
return;
}
var AI = window.RohAI;
if (!AI) {
botText(E.exampleInMainCurrency(HELP_TEXT), true);
return;
}
var id = E.uid('ai');
window.__aiPending = window.__aiPending || {};
window.__aiPending[id] = true;
pushMessage({ role: 'bot', type: 'ai-pending', reqId: id });
E.saveState();
renderAll();
AI.ask(text, aiContext()).then(function (res) {
if (window.__aiPending && window.__aiPending[id] === false) return; // cancelled
var msg = findMessage(id);
if (!msg) return;
msg.type = 'ai';
msg.text = res.text;
msg.model = res.model || '';
msg.provider = res.provider || '';
msg.base = res.base || '';
msg.via = res.via || '';
autoSpeak(msg);
delete (window.__aiPending || {})[id];
E.saveState();
renderAll();
}).catch(function (err) {
if (window.__aiPending && window.__aiPending[id] === false) return; // cancelled
var msg = findMessage(id);
if (!msg) return;
msg.type = 'ai-error';
var em = (err && err.message) ? err.message : String(err);
if (/CORS|Network|Failed to fetch|ERR_/i.test(em)) em = 'تعذر الاتصال بمخدم الذكاء الاصطناعي. تحقق من العنوان/المنفذ/CORS في الإعدادات. (' + em + ')';
msg.text = em;
autoSpeak(msg);
delete (window.__aiPending || {})[id];
E.saveState();
renderAll();
});
}
function handleAiPermission(action, btn) {
if (window.__aiPermProcessing) return;
window.__aiPermProcessing = true;
try {
var msgEl = btn && btn.closest ? btn.closest('.msg') : null;
if (msgEl) {
var btns = msgEl.querySelectorAll('button');
for (var i = 0; i < btns.length; i++) {
btns[i].disabled = true;
btns[i].style.pointerEvents = 'none';
btns[i].style.opacity = '0.6';
}
}
var st = S();
if (!st.settings) st.settings = {};
var ptext = btn && btn.getAttribute ? (btn.getAttribute('data-text') || window.__pendingAiText) : window.__pendingAiText;
st.messages = st.messages.filter(function (m) { return m.type !== 'ai-permission'; });
if (action === 'ai-allow-always') {
E.setAiAlwaysAllow(true);
} else if (action === 'ai-allow-once') {
E.saveState();
} else if (action === 'ai-deny') {
E.saveState();
botText('تم إلغاء طلب الذكاء الاصطناعي.');
}
window.__pendingAiText = null;
if (action === 'ai-allow-always' || action === 'ai-allow-once') {
if (ptext) {
doAskAI(ptext);
window.__pendingAiText = null;
} else {
renderAll();
}
} else {
renderAll();
}
} finally {
setTimeout(function () { window.__aiPermProcessing = false; }, 0);
}
}
function askAI(text) {
if (!E.planAllows('localAI')) {
var aiLeft = E.featureTrialLeft ? E.featureTrialLeft('localAI') : 0;
if (aiLeft && aiLeft > 0) {
var aiTr = E.useFeatureTrial('localAI');
if (aiTr && aiTr.ok) toast('تجربة مجانية للمستشار الذكي (متبقي لك ' + aiTr.remaining + ' تجارب مجانية)');
} else {
botText('الإجابة بالذكاء الاصطناعي متاحة في باقة الأعمال. يمكنك عرض الخطط أو إدخال رمز التفعيل من الإعدادات.', true);
renderAll();
return;
}
}
var st = S();
if (!(st.settings && st.settings.aiEnabled !== false)) {
botAiOff();
renderAll();
return;
}
if (st.settings && st.settings.aiAlwaysAllow) {
doAskAI(text);
return;
}
var pid = E.uid('aiperm');
window.__pendingAiText = text;
pushMessage({ role: 'bot', type: 'ai-permission', permId: pid, text: text });
E.saveState();
renderAll();
}
function openAiConfig() {
var AI = window.RohAI;
if (!AI) {
toast('عميل الذكاء الاصطناعي غير محمّل', true);
return;
}
var cfg = AI.config();
function isCloudProvider(p) {
if (typeof p.cloud === 'boolean') return p.cloud;
return ['openrouter', 'openai', 'anthropic', 'gemini', 'mistral', 'groq'].indexOf(p.id) !== -1;
}
var allProvs = (window.RohAI && window.RohAI.providers ? window.RohAI.providers() : []);
var localProvs = allProvs.filter(function (p) { return !isCloudProvider(p); });
var cloudProvs = allProvs.filter(isCloudProvider);
var provOpts = '<optgroup label="💻 محلي">' + localProvs.map(function (p) {
return '<option value="' + esc(p.id) + '"' + (p.id === cfg.provider ? ' selected' : '') + '>' + esc(p.name) + '</option>';
}).join('') + '</optgroup>' +
'<optgroup label="☁ سحابي">' + cloudProvs.map(function (p) {
return '<option value="' + esc(p.id) + '"' + (p.id === cfg.provider ? ' selected' : '') + '>' + esc(p.name) + '</option>';
}).join('') + '</optgroup>';
openSheet('إعدادات الذكاء الاصطناعي',
'<p class="modal-note">اختر مزودًا (محلي أو عبر الإنترنت). المزودون عبر الإنترنت (OpenRouter, OpenAI, Mistral, Groq, Gemini) متوافقون مع OpenAI. Anthropic (Claude) يتطلب proxy (مثل LiteLLM). OpenRouter جاهز بمفتاحه ونموذجه الافتراضي <code dir="ltr">google/gemini-2.5-flash-lite</code> (أسرع وأرخص). النماذج المجانية تنتهي بـ <code dir="ltr">:free</code> ومحدودة بخمسين سؤالاً في اليوم وقد تكون مزدحمة.</p>' +
'<label class="field-label" for="aiProvider">المزود</label>' +
'<div class="ai-group-toggle" style="display:flex;gap:6px;margin-bottom:8px">' +
'<button type="button" class="btn ghost small" data-action="ai-group" data-group="local">💻 محلي</button>' +
'<button type="button" class="btn ghost small" data-action="ai-group" data-group="cloud">☁ سحابي</button>' +
'</div>' +
'<select id="aiProvider">' + provOpts + '</select>' +
'<label class="field-label" for="aiModel">النموذج (model)</label>' +
'<input id="aiModel" type="text" dir="ltr" spellcheck="false" list="aiModelList" value="' + esc(cfg.model) + '" placeholder="gemini-flash-latest" />' +
'<datalist id="aiModelList">' +
'<option value="gpt-4o-mini"><option value="gpt-4o"><option value="claude-3-5-haiku-20241022"><option value="claude-3-5-sonnet-20241022">' +
'<option value="gemini-flash-latest"><option value="gemini-2.5-pro"><option value="mistral-small-latest"><option value="mistral-large-latest">' +
'<option value="llama-3.1-8b-instant"><option value="llama-3.1-70b-versatile"><option value="llama3.2"><option value="local-model">' +
'<option value="meta-llama/llama-3.3-70b-instruct:free"><option value="deepseek/deepseek-chat-v3-0324:free">' +
'<option value="google/gemini-2.5-flash-lite"><option value="google/gemini-2.5-flash">' +
'<option value="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"><option value="recursive/flint-v1.0:free">' +
'</datalist>' +
'<label class="field-label" for="aiEndpoints">عنوان المخدم (URL)</label>' +
'<input id="aiEndpoints" type="text" dir="ltr" spellcheck="false" value="' + esc(cfg.endpoints[0] || '') + '" placeholder="http://127.0.0.1:8080" />' +
'<label class="field-label" for="aiKey">مفتاح API (اختياري)</label>' +
'<input id="aiKey" type="text" dir="ltr" spellcheck="false" value="' + esc(cfg.apiKey) + '" />' +
'<div class="modal-actions" style="margin-top:12px">' +
'<button class="btn gold" data-action="ai-save">حفظ</button>' +
'<button class="btn ghost" data-action="ai-reset">استعادة الافتراضي</button>' +
'<button class="btn ghost" data-action="modal-cancel">إلغاء</button>' +
'</div>');
els.modal.classList.add('compact');
}
function saveAiConfig() {
var AI = window.RohAI;
if (!AI) return;
var provider = document.getElementById('aiProvider');
var model = document.getElementById('aiModel');
var endpoint = document.getElementById('aiEndpoints');
var key = document.getElementById('aiKey');
if (provider) {
provider.addEventListener('change', function () {
var AI = window.RohAI;
if (!AI) return;
AI.setConfig({ provider: provider.value });
var newCfg = AI.config();
if (model) model.value = newCfg.model || '';
if (endpoint) endpoint.value = (newCfg.endpoints && newCfg.endpoints[0]) || '';
if (key) key.value = newCfg.apiKey || '';
});
}
var previous = AI.config();
var patch = {
provider: provider ? provider.value : '',
model: model ? model.value : '',
apiKey: key ? key.value : ''
};
var typed = endpoint ? AI.parseEndpoints(endpoint.value) : [];
if (patch.provider === previous.provider || (typed.length && typed[0] !== previous.endpoints[0])) {
patch.endpoints = typed;
}
var cfg = AI.setConfig(patch);
closeSheet();
renderAll();
toast('تم الحفظ — المخدم الأول: ' + cfg.endpoints[0]);
}
function testAi() {
if (!window.RohAI) {
toast('عميل الذكاء الاصطناعي غير محمّل', true);
return;
}
setTab('bot');
toast('أُرسل طلب حقيقي إلى الذكاء الاصطناعي…');
askAI('أرسل تحية عربية قصيرة تؤكد أن الاتصال بالذكاء الاصطناعي يعمل.');
}
function autoGrow() {
els.input.style.height = 'auto';
els.input.style.height = Math.min(120, els.input.scrollHeight) + 'px';
}
var PLACEHOLDERS = [
'اكتب قيدك… مثال: دفعت لمحمد 5000 ريال',
'مثال: استلمت راتب 12000 في البنك',
'مثال: سلفت عبدالله 1000 يرجعه بعد أسبوع',
'مثال: عندي 5000 كاش',
'مثال: كم رصيدي؟',
'مثال: حلّل وضعي المالي'
];
var placeholderIndex = 0;
var placeholderTimer = null;
function activePlaceholders() {
var p = activePersonaDef();
if (p && Array.isArray(p.examples) && p.examples.length) {
return p.examples.map(function (ex, idx) {
return (idx === 0 ? 'اكتب قيدك… مثال: ' : 'مثال: ') + ex;
});
}
return PLACEHOLDERS;
}
function rotatePlaceholder() {
if (!els.input) return;
if (els.input.value.trim()) return;
var list = activePlaceholders();
placeholderIndex = (placeholderIndex + 1) % list.length;
showPlaceholder();
}
function showPlaceholder() {
if (!els.input) return;
var list = activePlaceholders();
var item = list[placeholderIndex % list.length] || PLACEHOLDERS[0];
els.input.placeholder = E.exampleInMainCurrency(item);
}
function startPlaceholderRotation() {
showPlaceholder();
if (placeholderTimer) clearInterval(placeholderTimer);
placeholderTimer = setInterval(rotatePlaceholder, 3500);
}
function updateComposerChipsVisibility() {
var holder = document.getElementById('composerChips');
if (!holder) return;
var raw = els.input ? els.input.value.trim() : '';
var hasText = raw.length > 0;
var reports = document.getElementById('reportChips');
var showReports = hasText && E.wantsReports(raw);
if (reports) reports.hidden = !showReports;
if (!hasText) {
holder.style.display = '';
suggestionsKey = null;
renderComposerChips();
return;
}
if (showReports || raw.length > 36) {
holder.style.display = 'none';
return;
}
var normTyped = E.normalizeAr(raw);
var matches = (E.composerSuggestions ? E.composerSuggestions(Date.now(), 50) : []).filter(function (s) {
var ns = E.normalizeAr(s.text || '');
return ns && ns !== normTyped && ns.indexOf(normTyped) >= 0;
}).slice(0, 5);
if (!matches.length) {
holder.style.display = 'none';
return;
}
holder.style.display = '';
suggestionsKey = 'typing:' + normTyped;
holder.innerHTML = matches.map(suggestionChip).join('');
}
function clearComposer() {
els.input.value = '';
els.input.dispatchEvent(new Event('input', { bubbles: true }));
acHide();
}
function openReportFromChip(report) {
clearComposer();
if (report === 'cashflow') openCashFlowForm();
else if (report === 'balance') printBalanceSheet();
else openStatementPicker();
}
function openStatementPicker() {
openSheet('كشف حساب',
'<div id="statementPicker">' + S().accounts.map(function (acc) {
return '<button type="button" class="search-result" data-id="' + esc(acc.id) + '"><span class="search-result-title">' + esc(acc.name) + '</span>' +
'<span class="search-result-sub">' + esc(acc.hint || acc.currency) + '</span></button>';
}).join('') + '</div>');
document.getElementById('statementPicker').addEventListener('click', function (ev) {
var row = ev.target.closest('[data-id]');
if (!row) return;
closeSheet();
printAccount(row.getAttribute('data-id'));
});
}
function openCounterpartyPicker() {
var names = [];
(S().entries || []).forEach(function (e) {
if (e.counterparty && names.indexOf(e.counterparty) < 0) names.push(e.counterparty);
});
openSheet('كشف حساب طرف',
'<div id="cpPicker">' + (names.length ? names.map(function (n) {
return '<button type="button" class="search-result" data-name="' + esc(n) + '"><span class="search-result-title">' + esc(n) + '</span></button>';
}).join('') : '<div class="muted" style="padding:12px">لا توجد أطراف.</div>') + '</div>');
var holder = document.getElementById('cpPicker');
if (holder) holder.addEventListener('click', function (ev) {
var row = ev.target.closest('[data-name]');
if (!row) return;
closeSheet();
printCounterparty(row.getAttribute('data-name'));
});
}
function __removed_updateInputHint() {
if (!els.inputHint || !els.input) return;
var v = els.input.value.trim();
if (!v) { els.inputHint.textContent = ''; els.inputHint.className = 'input-hint'; return; }
var norm = E.normalizeAr(v);
var hasNum = /\d/.test(norm);
var kind = null;
try { kind = E.parseIntent(v).kind; } catch (e) { kind = null; }
var hint = '';
var cls = '';
if (!hasNum && kind !== 'query' && kind !== 'help') {
hint = 'لم أجد مبلغاً — أدخل رقماً (مثال: 500)';
cls = 'warn';
} else if (kind === 'needKind') {
hint = 'سجّلت المبلغ — حدد نوع العملية (مصروف/إيراد/دين)';
cls = 'warn';
} else if (kind === 'needAmount') {
hint = 'فهمت العملية — أدخل المبلغ';
cls = 'warn';
} else if (kind === 'needSplit') {
hint = 'مبلغ واحد على أكثر من حساب — سأسألك كم في كل حساب';
cls = 'warn';
} else if (kind === 'query') {
hint = 'استعلام — سيتم عرض تقرير';
cls = 'ok';
} else if (kind === 'help') {
hint = 'سؤال — سيتم الرد بالذكاء الاصطناعي';
cls = 'ok';
} else if (kind) {
hint = 'جاهز — اضغط إرسال';
cls = 'ok';
}
els.inputHint.textContent = hint;
els.inputHint.className = 'input-hint ' + cls;
}
function currentTheme() {
var st = S();
return (st.settings && st.settings.theme) || 'light';
}
function isDarkTheme() {
var t = currentTheme();
if (t === 'dark') return true;
if (t === 'light' || t === 'ocean' || t === 'burgundy' || t === 'purple') return false;
if (t === 'dark' || /-dark$/.test(t)) return true;
return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
var LANGUAGES = [
{ code: 'ar', name: 'العربية', dialects: [['العربية العامة', 'ar-001'], ['الخليجية', 'ar-SA'], ['اليمنية', 'ar-YE'], ['المصرية', 'ar-EG'], ['الجزائرية', 'ar-DZ'], ['المغربية', 'ar-MA']] },
{ code: 'en', name: 'الإنجليزية', dialects: [['الأمريكية', 'en-US'], ['البريطانية', 'en-GB'], ['الأسترالية', 'en-AU'], ['الكندية', 'en-CA'], ['الهندية', 'en-IN']] },
{ code: 'zh', name: 'الصينية (الماندرين)', dialects: [['لهجة بكين', 'zh-CN'], ['الماليزية', 'zh-MY'], ['السنغافورية', 'zh-SG'], ['التايوانية', 'zh-TW'], ['الجنوبية', 'zh-CN']] },
{ code: 'hi', name: 'الهندية', dialects: [['الكاريبية', 'hi-IN'], ['الفيجية', 'hi-IN'], ['بامباي', 'hi-IN'], ['البراجبهاشية', 'hi-IN'], ['الأودهية', 'hi-IN']] },
{ code: 'es', name: 'الإسبانية', dialects: [['المكسيكية', 'es-MX'], ['الأندلسية', 'es-ES'], ['الكاريبية', 'es-DO'], ['الأرجنتينية', 'es-AR'], ['الكولومبية', 'es-CO']] },
{ code: 'fr', name: 'الفرنسية', dialects: [['الباريسية', 'fr-FR'], ['الكيبكية', 'fr-CA'], ['الأفريقية', 'fr-SN'], ['البلجيكية', 'fr-BE'], ['السويسرية', 'fr-CH']] }
];
var DEFAULT_LANGUAGE = 'ar';
var DEFAULT_DIALECT = { ar: 2 }; // Gulf, the speech locale the app has always used.
var DIALECT_META = {
'ar-001': { flag: '🇸🇦', code: 'ar_001', hero: 'أهلًا بك في موني كود', greeting: 'أهلاً وسهلاً بك! دفاترك المالية مضبوطة بلمسة واحدة', sample: '«دفعت 100 غداء نقداً»' },
'ar-SA':  { flag: '🇸🇦', code: 'ar_SA',  hero: 'يا هلا ومرحبا في موني كود', greeting: 'يا هلا ومرحبا! دفاترك وحلالك في الحفظ والصون', sample: '«دفعت 50 قهوة من الراجحي»' },
'ar-YE':  { flag: '🇾🇪', code: 'ar_YE',  hero: 'حيّا الله من جاء في موني كود', greeting: 'حيّا الله من جاء! حسابك مضبوط بالريال والعملة', sample: '«صرفت 5000 غداء من الصندوق»' },
'ar-EG':  { flag: '🇪🇬', code: 'ar_EG',  hero: 'أهلاً بيك يا باشا في موني كود', greeting: 'أهلاً بيك يا باشا! حساباتك في جيبك من غير دوشة', sample: '«دفعت 200 غداء كاش»' },
'ar-DZ':  { flag: '🇩🇿', code: 'ar_DZ',  hero: 'مرحبا بيك خويا في موني كود', greeting: 'مرحبا بيك خويا! دراهمك وحسابك في الأمان', sample: '«خلصت 1500 فطور كاش»' },
'ar-MA':  { flag: '🇲🇦', code: 'ar_MA',  hero: 'مرحبا بيك في موني كود', greeting: 'مرحبا بيك! حساباتك مقادّة بلا صداع الراس', sample: '«خلصت 100 قهوة كاش»' },
'en-US':  { flag: '🇺🇸', code: 'en_US',  hero: 'Welcome to MoneyCode', greeting: 'Welcome aboard! Your pocket AI accountant', sample: '«Paid 50 coffee cash»' },
'en-GB':  { flag: '🇬🇧', code: 'en_GB',  hero: 'Brilliant to have you in MoneyCode', greeting: 'Brilliant to have you! Smart books, zero fuss', sample: '«Paid 40 lunch from bank»' },
'en-AU':  { flag: '🇦🇺', code: 'en_AU',  hero: "G'day! Welcome to MoneyCode", greeting: "G'day! Your finances sorted in a flash", sample: '«Paid 30 fuel cash»' },
'en-CA':  { flag: '🇨🇦', code: 'en_CA',  hero: 'Welcome to MoneyCode', greeting: 'Welcome! Simple, private bookkeeping for you', sample: '«Received 1200 project fee»' },
'en-IN':  { flag: '🇮🇳', code: 'en_IN',  hero: 'Namaste! Welcome to MoneyCode', greeting: 'Namaste & Welcome! Smart, effortless accounts', sample: '«Paid 500 groceries cash»' },
'zh-CN':  { flag: '🇨🇳', code: 'zh_CN',  hero: '欢迎来到 MoneyCode', greeting: '欢迎光临！您的随身智能会计', sample: '«دفعت 50 قهوة»' },
'zh-MY':  { flag: '🇲🇾', code: 'zh_MY',  hero: '欢迎来到 MoneyCode', greeting: '欢迎！轻松记账，一目了然', sample: '«دفعت 50 قهوة»' },
'zh-SG':  { flag: '🇸🇬', code: 'zh_SG',  hero: '欢迎加入 MoneyCode', greeting: '欢迎加入！智能财务尽在掌握', sample: '«دفعت 50 قهوة»' },
'zh-TW':  { flag: '🇹🇼', code: 'zh_TW',  hero: '歡迎使用 MoneyCode', greeting: '歡迎使用！語音記帳超輕鬆', sample: '«دفعت 50 قهوة»' },
'hi-IN':  { flag: '🇮🇳', code: 'hi_IN',  hero: 'MoneyCode में आपका स्वागत है', greeting: 'नमस्ते और स्वागत है! आपका स्मार्ट मुनीम', sample: '«دفعت 50 قهوة»' },
'es-MX':  { flag: '🇲🇽', code: 'es_MX',  hero: '¡Bienvenido a MoneyCode!', greeting: '¡Qué onda! Tu contador inteligente en el bolsillo', sample: '«دفعت 50 قهوة»' },
'es-ES':  { flag: '🇪🇸', code: 'es_ES',  hero: '¡Bienvenido a MoneyCode!', greeting: '¡Buenas! Tus cuentas claras al instante', sample: '«دفعت 50 قهوة»' },
'es-DO':  { flag: '🇩🇴', code: 'es_DO',  hero: '¡Saludos! Bienvenido a MoneyCode', greeting: '¡Saludos! Tu dinero organizado sin líos', sample: '«دفعت 50 قهوة»' },
'es-AR':  { flag: '🇦🇷', code: 'es_AR',  hero: '¡Che, bienvenido a MoneyCode!', greeting: '¡Che, bienvenido! Tus finanzas al día', sample: '«دفعت 50 قهوة»' },
'es-CO':  { flag: '🇨🇴', code: 'es_CO',  hero: '¡Bienvenido a MoneyCode, parcero!', greeting: '¡Bienvenido, parcero! Cuentas claras y seguras', sample: '«دفعت 50 قهوة»' },
'fr-FR':  { flag: '🇫🇷', code: 'fr_FR',  hero: 'Bienvenue sur MoneyCode !', greeting: 'Bienvenue ! Votre comptable intelligent en poche', sample: '«دفعت 50 قهوة»' },
'fr-CA':  { flag: '🇨🇦', code: 'fr_CA',  hero: 'Bienvenue sur MoneyCode !', greeting: 'Bienvenue ! Vos comptes réglés en un mot', sample: '«دفعت 50 قهوة»' },
'fr-SN':  { flag: '🇸🇳', code: 'fr_SN',  hero: 'Dalal ak jàmm ci MoneyCode !', greeting: 'Dalal ak jàmm ! Votre gestion claire et sûre', sample: '«دفعت 50 قهوة»' },
'fr-BE':  { flag: '🇧🇪', code: 'fr_BE',  hero: 'Bienvenue sur MoneyCode !', greeting: 'Bienvenue ! Vos finances simples et privées', sample: '«دفعت 50 قهوة»' },
'fr-CH':  { flag: '🇨🇭', code: 'fr_CH',  hero: 'Bienvenue sur MoneyCode !', greeting: 'Bienvenue ! Précision et confidentialité totales', sample: '«دفعت 50 قهوة»' }
};
var UNAVAILABLE_DIALECTS = [
{ code: 'ar_OM', lang: 'ar', flag: '🇴🇲', name: 'اللهجة العمانية (سلطنة عُمان)' },
{ code: 'ar_AE', lang: 'ar', flag: '🇦🇪', name: 'اللهجة الإماراتية (الإمارات)' },
{ code: 'ar_KW', lang: 'ar', flag: '🇰🇼', name: 'اللهجة الكويتية (الكويت)' },
{ code: 'ar_QA', lang: 'ar', flag: '🇶🇦', name: 'اللهجة القطرية (قطر)' },
{ code: 'ar_BH', lang: 'ar', flag: '🇧🇭', name: 'اللهجة البحرينية (البحرين)' },
{ code: 'ar_IQ', lang: 'ar', flag: '🇮🇶', name: 'اللهجة العراقية (العراق)' },
{ code: 'ar_JO', lang: 'ar', flag: '🇯🇴', name: 'اللهجة الأردنية (الأردن)' },
{ code: 'ar_SY', lang: 'ar', flag: '🇸🇾', name: 'اللهجة السورية / الشامية (سوريا)' },
{ code: 'ar_LB', lang: 'ar', flag: '🇱🇧', name: 'اللهجة اللبنانية (لبنان)' },
{ code: 'ar_PS', lang: 'ar', flag: '🇵🇸', name: 'اللهجة الفلسطينية (فلسطين)' },
{ code: 'ar_SD', lang: 'ar', flag: '🇸🇩', name: 'اللهجة السودانية (السودان)' },
{ code: 'ar_LY', lang: 'ar', flag: '🇱🇾', name: 'اللهجة الليبية (ليبيا)' },
{ code: 'ar_TN', lang: 'ar', flag: '🇹🇳', name: 'اللهجة التونسية (تونس)' },
{ code: 'ar_MR', lang: 'ar', flag: '🇲🇷', name: 'اللهجة الموريتانية / الحسانية (موريتانيا)' },
{ code: 'en_ZA', lang: 'en', flag: '🇿🇦', name: 'الإنجليزية الجنوب أفريقية (South Africa)' },
{ code: 'en_IE', lang: 'en', flag: '🇮🇪', name: 'الإنجليزية الأيرلندية (Ireland)' },
{ code: 'en_NZ', lang: 'en', flag: '🇳🇿', name: 'الإنجليزية النيوزيلندية (New Zealand)' },
{ code: 'en_NG', lang: 'en', flag: '🇳🇬', name: 'الإنجليزية النيجيرية (Nigeria)' },
{ code: 'es_CL', lang: 'es', flag: '🇨🇱', name: 'الإسبانية التشيلية (Chile)' },
{ code: 'es_PE', lang: 'es', flag: '🇵🇪', name: 'الإسبانية البيروفية (Perú)' },
{ code: 'fr_MA', lang: 'fr', flag: '🇲🇦', name: 'الفرنسية المغاربية (Maghreb)' },
{ code: 'zh_HK', lang: 'zh', flag: '🇭🇰', name: 'الصينية الكانتونية (هونغ كونغ)' }
];
var UNAVAILABLE_LANGUAGES = [
{ code: 'tr_TR', flag: '🇹🇷', name: 'اللغة التركية (Türkçe)' },
{ code: 'ur_PK', flag: '🇵🇰', name: 'اللغة الأردية (اردو)' },
{ code: 'id_ID', flag: '🇮🇩', name: 'اللغة الإندونيسية (Bahasa Indonesia)' },
{ code: 'ms_MY', flag: '🇲🇾', name: 'اللغة الملايوية (Bahasa Melayu)' },
{ code: 'de_DE', flag: '🇩🇪', name: 'اللغة الألمانية (Deutsch)' },
{ code: 'ru_RU', flag: '🇷🇺', name: 'اللغة الروسية (Русский)' },
{ code: 'pt_BR', flag: '🇧🇷', name: 'اللغة البرتغالية (Português)' },
{ code: 'ja_JP', flag: '🇯🇵', name: 'اللغة اليابانية (日本語)' },
{ code: 'ko_KR', flag: '🇰🇷', name: 'اللغة الكورية (한국어)' },
{ code: 'it_IT', flag: '🇮🇹', name: 'اللغة الإيطالية (Italiano)' },
{ code: 'sw_KE', flag: '🇰🇪', name: 'اللغة السواحيلية (Kiswahili)' },
{ code: 'fa_IR', flag: '🇮🇷', name: 'اللغة الفارسية (فارسی)' },
{ code: 'bn_BD', flag: '🇧🇩', name: 'اللغة البنغالية (বাংলা)' },
{ code: 'tl_PH', flag: '🇵🇭', name: 'اللغة الفلبينية (Tagalog)' },
{ code: 'am_ET', flag: '🇪🇹', name: 'اللغة الأمهرية (አማርኛ)' },
{ code: 'so_SO', flag: '🇸🇴', name: 'اللغة الصومالية (Soomaali)' }
];
var UNAVAILABLE_LOCALES = UNAVAILABLE_DIALECTS.concat(UNAVAILABLE_LANGUAGES);
function getLocaleRequestStats() {
try {
var raw = localStorage.getItem('rohapp.locale_requests');
return raw ? JSON.parse(raw) : {};
} catch (e) {
return {};
}
}
function recordLocaleRequestStat(kind, code) {
var stats = getLocaleRequestStats();
var k = (kind === 'language' ? 'lang:' : 'dialect:') + code;
stats[k] = (Number(stats[k]) || 0) + 1;
try { localStorage.setItem('rohapp.locale_requests', JSON.stringify(stats)); } catch (e) {}
return stats[k];
}
function askLocaleRequestPermission(kind, code, name, flag) {
var isLang = kind === 'language';
var kindAr = isLang ? 'اللغة' : 'اللهجة';
var kindPlural = isLang ? 'اللغات' : 'اللهجات';
var stats = getLocaleRequestStats();
var prevCount = Number(stats[(isLang ? 'lang:' : 'dialect:') + code]) || 0;
confirmAction = function () {
var newCount = recordLocaleRequestStat(kind, code);
var tag = isLang ? ('[STAT-REQ-LANG:' + code + ']') : ('[STAT-REQ-DIALECT:' + code + ']');
var msg = 'السلام عليكم (واتساب الأعمال — تطبيق موني كود)،\n' +
'أرغب في التصويت وطلب إضافة ' + kindAr + ': ' + (flag ? flag + ' ' : '') + name + ' (' + code + ') في الإصدارات القادمة.\n' +
'كود الإحصاء الآلي: ' + tag + ' (طلب رقم ' + newCount + ' من هذا الجهاز)';
var waUrl = 'https://wa.me/967770550110?text=' + encodeURIComponent(msg);
window.open(waUrl, '_blank', 'noopener');
toast('تم فتح واتساب الأعمال لإرسال طلب ' + kindAr + ' (' + code + ')');
if (onboard && !document.getElementById('onboard').hidden) drawOnboarding();
};
openSheet('إذن إرسال طلب لواتساب الأعمال',
'<div class="card" style="padding:12px;margin-bottom:10px">' +
'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
'<span style="font-size:calc(24px * var(--font-scale,1))">' + esc(flag || '🌐') + '</span>' +
'<div><b style="font-size:calc(14px * var(--font-scale,1))">' + esc(name) + '</b><br>' +
'<code dir="ltr" style="font-size:calc(11.5px * var(--font-scale,1));color:var(--muted)">' + esc(code) + '</code></div>' +
'</div>' +
'<p class="modal-note" style="margin:0">' +
'هذه ' + kindAr + ' غير متوفرة حالياً في هذا الإصدار.<br>' +
'هل تأذن بفتح <b>واتساب الأعمال</b> لإرسال طلب إضافتها إلى الإدارة بهدف <b>إحصاء ' + kindPlural + ' الأكثر طلباً</b> وتوفيرها في الإصدارات القادمة؟' +
'</p>' +
(prevCount > 0 ? '<div class="muted" style="font-size:calc(11px * var(--font-scale,1));margin-top:6px">✓ سبق لك طلب هذه ' + kindAr + ' (' + prevCount + ' مرة)</div>' : '') +
'</div>' +
'<div class="modal-actions">' +
'<button type="button" class="btn primary" data-action="modal-confirm">💬 نعم، أوافق وأرسل لواتساب الأعمال</button>' +
'<button type="button" class="btn ghost" data-action="modal-cancel">إلغاء</button>' +
'</div>');
var obRoot = document.getElementById('onboard');
if (obRoot && !obRoot.hidden) els.modal.classList.add('over-onboard');
}
function openMoreLocalesSheet(kind) {
var isLang = kind === 'language';
var list = isLang ? UNAVAILABLE_LANGUAGES : UNAVAILABLE_DIALECTS;
var title = isLang ? 'المزيد من اللغات (غير متوفرة حالياً)' : 'المزيد من اللهجات (غير متوفرة حالياً)';
var stats = getLocaleRequestStats();
var html = '<p class="modal-note">هذه ' + (isLang ? 'اللغات' : 'اللهجات') + ' غير متوفرة حالياً — انقر على أي منها لإرسال طلب إضافتها عبر <b>واتساب الأعمال</b> (بعد إذنك) لإحصاء أيهما أكثر طلباً:</p>' +
'<div style="display:flex;flex-direction:column;gap:6px;max-height:58vh;overflow-y:auto">' +
list.map(function (u) {
var c = Number(stats[(isLang ? 'lang:' : 'dialect:') + u.code]) || 0;
return '<button type="button" class="setting" style="width:100%;text-align:right;cursor:pointer;border:1px solid var(--line);border-radius:10px" data-action="request-unavailable-locale" data-kind="' + esc(kind) + '" data-code="' + esc(u.code) + '" data-name="' + esc(u.name) + '" data-flag="' + esc(u.flag) + '">' +
'<div class="s-main"><span class="s-title">' + u.flag + ' ' + esc(u.name) + ' <code dir="ltr" style="font-size:calc(11px * var(--font-scale,1));color:var(--muted)">' + esc(u.code) + '</code>' + (c ? ' <span class="badge ok">طُلبت ' + c + '</span>' : '') + '</span>' +
'<span class="s-sub">غير متوفرة حالياً — انقر لطلب إضافتها عبر واتساب الأعمال</span></div>' +
'<span class="btn ghost small">طلب 💬</span></button>';
}).join('') +
'</div>';
openSheet(title, html);
}
function dialectMetaOf(localeCode) {
var key = String(localeCode || 'ar-SA').replace(/_/g, '-');
return DIALECT_META[key] || { flag: '🌐', code: key.replace(/-/g, '_'), greeting: 'أهلاً بك في موني كود', sample: '«دفعت 50 قهوة»' };
}
function currentLanguage() {
var chosen = S().settings.language || DEFAULT_LANGUAGE;
return LANGUAGES.filter(function (l) { return l.code === chosen; })[0] || LANGUAGES[0];
}
function currentDialectRank() {
var lang = currentLanguage();
var rank = S().settings.dialectRank || DEFAULT_DIALECT[lang.code] || 1;
return lang.dialects[rank - 1] ? rank : 1;
}
function speechLocale() {
var raw = currentLanguage().dialects[currentDialectRank() - 1][1];
return raw === 'ar-001' ? 'ar-SA' : raw;
}
function readingLocale(text) {
if (!/[\u0600-\u06FF]/.test(text)) return speechLocale();
return currentLanguage().code === 'ar' ? speechLocale() : 'ar-SA';
}
var UI_I18N = {
en: {
dir: 'ltr',
brandTitle: 'MoneyCode',
brandSub: 'World’s First AI Accounting Writer',
tabBot: 'Chat',
tabRadar: 'Dashboard',
tabAccounts: 'Accounts',
tabLedger: 'Journal',
tabReports: 'Reports',
inputPlaceholder: 'Type an entry… e.g. Paid 250 fuel cash',
searchPlaceholder: 'Ask about an entry or account…',
settingsSearchPlaceholder: 'Search settings (currency, lock, reminder, zakat, backup…)',
menuCurrency: '💱 Base Currency',
menuVoiceDialect: '🗣 Voice & Typing Dialect',
menuSettings: '⚙ Settings',
menuGroups: 'Financial Groups',
menuExchange: '⇄ Currency Exchange',
menuUndo: 'Undo Last Entry',
menuShowAmounts: 'Show Amounts',
menuHideAmounts: 'Hide Amounts',
menuReports: 'Reports',
menuCashflow: 'Cash Flow',
menuBalance: 'Balance Sheet',
menuSankey: 'Cash Flow (Sankey)',
menuZakat: 'Zakat (2.5%)',
menuAging: 'Debt Aging',
secProfile: 'Identity & License',
secCurrency: 'Currency & E-Rates',
secSovereignty: 'Sovereignty & Data',
secReminders: 'Reminders (Notifications)',
secDisplay: 'Display & Preferences',
secAccess: 'Accessibility & Theme',
secZakat: 'Zakat (Cash & Savings)',
secAi: 'Artificial Intelligence',
secVector: 'Cognitive Memory (Vector RAG)',
secMarketing: 'Marketing & Growth Hub',
secFraud: 'Fraud Alerts',
secSystem: 'System & About',
tileBackup: 'Backup',
tilePairing: 'Device Pairing',
tileGuide: 'User Guide',
tilePersona: 'Book Persona'
},
fr: {
dir: 'ltr',
brandTitle: 'MoneyCode',
brandSub: '1er Comptable IA au Monde',
tabBot: 'Discussion',
tabRadar: 'Tableau',
tabAccounts: 'Comptes',
tabLedger: 'Journal',
tabReports: 'Rapports',
inputPlaceholder: 'Écrivez une écriture… ex: دفعت 250 بنزين',
searchPlaceholder: 'Rechercher une écriture ou un compte…',
settingsSearchPlaceholder: 'Rechercher dans les paramètres…',
menuCurrency: '💱 Devise de base',
menuVoiceDialect: '🗣 Dialecte vocal',
menuSettings: '⚙ Paramètres',
menuGroups: 'Groupes financiers',
menuExchange: '⇄ Change de devises',
menuUndo: 'Annuler la dernière écriture',
menuShowAmounts: 'Afficher les montants',
menuHideAmounts: 'Masquer les montants',
menuReports: 'Rapports',
menuCashflow: 'Flux de trésorerie',
menuBalance: 'Bilan',
menuSankey: 'Flux (Sankey)',
menuZakat: 'Zakat (2.5%)',
menuAging: 'Âge des dettes',
secProfile: 'Identité & Licence',
secCurrency: 'Devises & Taux (E-Rates)',
secSovereignty: 'Souveraineté & Données',
secReminders: 'Rappels (Notifications)',
secDisplay: 'Affichage',
secAccess: 'Accessibilité & Thème',
secZakat: 'Zakat (Trésorerie & Épargne)',
secAi: 'Intelligence Artificielle',
secVector: 'Mémoire Cognitive (Vector RAG)',
secMarketing: 'Hub Marketing',
secFraud: 'Alertes de fraude',
secSystem: 'Système',
tileBackup: 'Sauvegarde',
tilePairing: 'Appairage',
tileGuide: 'Guide',
tilePersona: 'Profil'
},
es: {
dir: 'ltr',
brandTitle: 'MoneyCode',
brandSub: 'El Primer Contable con IA del Mundo',
tabBot: 'Chat',
tabRadar: 'Panel',
tabAccounts: 'Cuentas',
tabLedger: 'Diario',
tabReports: 'Informes',
inputPlaceholder: 'Escribe un asiento… ej: دفعت 250 بنزين',
searchPlaceholder: 'Buscar asiento o cuenta…',
settingsSearchPlaceholder: 'Buscar en ajustes…',
menuCurrency: '💱 Moneda base',
menuVoiceDialect: '🗣 Dialecto de voz',
menuSettings: '⚙ Ajustes',
menuGroups: 'Grupos financieros',
menuExchange: '⇄ Cambio de divisa',
menuUndo: 'Deshacer último asiento',
menuShowAmounts: 'Mostrar importes',
menuHideAmounts: 'Ocultar importes',
menuReports: 'Informes',
menuCashflow: 'Flujo de caja',
menuBalance: 'Balance general',
menuSankey: 'Flujo (Sankey)',
menuZakat: 'Zakat (2.5%)',
menuAging: 'Antigüedad de deuda',
secProfile: 'Identidad y Licencia',
secCurrency: 'Moneda y Tasas (E-Rates)',
secSovereignty: 'Soberanía y Datos',
secReminders: 'Recordatorios',
secDisplay: 'Pantalla',
secAccess: 'Accesibilidad y Tema',
secZakat: 'Zakat (Efectivo y Ahorros)',
secAi: 'Inteligencia Artificial',
secVector: 'Memoria Cognitiva (Vector RAG)',
secMarketing: 'Centro de Marketing',
secFraud: 'Alertas de fraude',
secSystem: 'Sistema',
tileBackup: 'Copia',
tilePairing: 'Vincular',
tileGuide: 'Guía',
tilePersona: 'Perfil'
},
zh: {
dir: 'ltr',
brandTitle: 'MoneyCode',
brandSub: '全球首款 AI 智能记账助手',
tabBot: '对话记账',
tabRadar: '仪表盘',
tabAccounts: '账户',
tabLedger: '账本',
tabReports: '报表',
inputPlaceholder: '输入记账内容…',
searchPlaceholder: '搜索记录或账户…',
settingsSearchPlaceholder: '搜索设置…',
menuCurrency: '💱 基础货币',
menuVoiceDialect: '🗣 语音与方言',
menuSettings: '⚙ 设置',
menuGroups: 'AA制群组',
menuExchange: '⇄ 货币兑换',
menuUndo: '撤销上一笔',
menuShowAmounts: '显示金额',
menuHideAmounts: '隐藏金额',
menuReports: '财务报表',
menuCashflow: '现金流',
menuBalance: '资产负债表',
menuSankey: '桑基图 (Sankey)',
menuZakat: '天课 (2.5%)',
menuAging: '账龄分析',
secProfile: '身份与授权',
secCurrency: '货币与汇率 (E-Rates)',
secSovereignty: '数据主权与备份',
secReminders: '到期提醒',
secDisplay: '显示设置',
secAccess: '外观与无障碍',
secZakat: '天课设置',
secAi: '人工智能 (AI)',
secVector: '认知向量记忆 (Vector RAG)',
secMarketing: '营销与分享中心',
secFraud: '风险提醒',
secSystem: '系统信息',
tileBackup: '备份恢复',
tilePairing: '设备配对',
tileGuide: '使用指南',
tilePersona: '账本模式'
},
hi: {
dir: 'ltr',
brandTitle: 'MoneyCode',
brandSub: 'दुनिया का पहला AI अकाउंटेंट',
tabBot: 'चैट',
tabRadar: 'डैशबोर्ड',
tabAccounts: 'खाते',
tabLedger: 'लेजर',
tabReports: 'रिपोर्ट',
inputPlaceholder: 'अपनी एंट्री लिखें…',
searchPlaceholder: 'एंट्री या खाता खोजें…',
settingsSearchPlaceholder: 'सेटिंग्स में खोजें…',
menuCurrency: '💱 मुख्य मुद्रा',
menuVoiceDialect: '🗣 आवाज़ और बोली',
menuSettings: '⚙ सेटिंग्स',
menuGroups: 'वित्तीय समूह',
menuExchange: '⇄ मुद्रा विनिमय',
menuUndo: 'पिछली एंट्री पूर्ववत करें',
menuShowAmounts: 'राशि दिखाएं',
menuHideAmounts: 'राशि छिपाएं',
menuReports: 'रिपोर्ट',
menuCashflow: 'कैश फ्लो',
menuBalance: 'बैलेंस शीट',
menuSankey: 'सैंकी चार्ट (Sankey)',
menuZakat: 'ज़कात (2.5%)',
menuAging: 'ऋण आयु',
secProfile: 'पहचान और लाइसेंस',
secCurrency: 'मुद्रा और दरें (E-Rates)',
secSovereignty: 'डेटा संप्रभुता और बैकअप',
secReminders: 'रिमाइंडर',
secDisplay: 'डिस्प्ले',
secAccess: 'थीम और एक्सेसिबिलिटी',
secZakat: 'ज़कात (नकद और बचत)',
secAi: 'आर्टिफिशियल इंटेलिजेंस',
secVector: 'कॉग्निटिव मेमोरी (Vector RAG)',
secMarketing: 'मार्केटिंग हब',
secFraud: 'धोखाधड़ी अलर्ट',
secSystem: 'सिस्टम',
tileBackup: 'बैकअप',
tilePairing: 'पेयरिंग',
tileGuide: 'गाइड',
tilePersona: 'प्रोफ़ाइल'
}
};
function uiStr(key, arFallback) {
var lang = currentLanguage();
var pack = lang && lang.code && UI_I18N[lang.code];
return (pack && pack[key]) ? pack[key] : arFallback;
}
function applyUiTranslations() {
var lang = currentLanguage();
var code = (lang && lang.code) || 'ar';
var pack = UI_I18N[code] || null;
document.documentElement.setAttribute('lang', code);
var brandEl = document.querySelector('.brand-text');
if (brandEl) {
brandEl.innerHTML = esc(uiStr('brandTitle', 'موني كود')) + '<small>' + esc(uiStr('brandSub', 'أول كاتب حسابات بالذكاء الاصطناعي في العالم')) + '</small>';
}
var tabLabels = [
['#tab-bot', 'tabBot', 'المحادثة'],
['#tab-radar', 'tabRadar', 'لوحة القيادة'],
['#tab-accounts', 'tabAccounts', 'الحسابات'],
['#tab-ledger', 'tabLedger', 'الدليل'],
['#tab-reports', 'tabReports', 'التقارير']
];
tabLabels.forEach(function (item) {
var btn = document.querySelector(item[0]);
if (!btn) return;
var label = uiStr(item[1], item[2]);
for (var i = 0; i < btn.childNodes.length; i++) {
if (btn.childNodes[i].nodeType === 3 && btn.childNodes[i].nodeValue.trim()) {
btn.childNodes[i].nodeValue = label;
break;
}
}
});
var gs = document.getElementById('globalSearch');
if (gs) gs.setAttribute('placeholder', uiStr('searchPlaceholder', 'اسأل عن قيد أو حساب…'));
if (els.input && pack && pack.inputPlaceholder) {
els.input.setAttribute('placeholder', pack.inputPlaceholder);
}
}
function applyLanguage() {
var lang = currentLanguage();
var dialect = lang.dialects[currentDialectRank() - 1][0];
if (window.RohAI && window.RohAI.setReplyStyle) {
window.RohAI.setReplyStyle(lang.code === 'ar'
? 'أجب بالعربية المبسطة مع مراعاة اللهجة ' + dialect
: 'أجب باللغة ' + lang.name + ' (' + dialect + ')');
}
if (window.RohNative && window.RohNative.setVoiceLocale) window.RohNative.setVoiceLocale(speechLocale());
try { applyUiTranslations(); } catch (e) {}
}
function languageRowsHtml() {
var lang = currentLanguage();
var rank = currentDialectRank();
var select = 'style="width:130px;padding:6px 8px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size: calc(12px * var(--font-scale, 1))"';
return '<div class="setting"><div class="s-main"><span class="s-title">لغة التطبيق</span>' +
'<span class="s-sub">' + (lang.code === 'ar' ? 'تضبط لغة الواجهة والصوت وردود الذكاء الاصطناعي' : 'تترجم شريط التنقل والقائمة والأقسام والصوت وردود الذكاء الاصطناعي') + '</span></div>' +
'<div style="display:flex;align-items:center;gap:6px">' +
'<select id="appLanguage" aria-label="لغة التطبيق" ' + select + '>' +
LANGUAGES.map(function (l) { return '<option value="' + l.code + '"' + (l.code === lang.code ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') +
'<option value="__more_langs__">＋ المزيد من اللغات…</option>' +
'</select>' +
'<button type="button" class="btn ghost small" data-action="open-more-languages" title="لغات أخرى غير متوفرة حالياً">المزيد</button>' +
'</div></div>' +
'<div class="setting"><div class="s-main"><span class="s-title">اللهجة</span><span class="s-sub">للتعرف على كلامك والرد عليك</span></div>' +
'<div style="display:flex;align-items:center;gap:6px">' +
'<select id="appDialect" aria-label="اللهجة" ' + select + '>' +
lang.dialects.map(function (d, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === rank ? ' selected' : '') + '>' + esc(d[0]) + '</option>'; }).join('') +
'<option value="__more_dialects__">＋ المزيد من اللهجات…</option>' +
'</select>' +
'<button type="button" class="btn ghost small" data-action="open-more-dialects" title="لهجات أخرى غير متوفرة حالياً">المزيد</button>' +
'</div></div>';
}
function bindLanguage() {
els.settings.addEventListener('change', function (ev) {
if (ev.target.id === 'appLanguage') {
if (ev.target.value === '__more_langs__') {
ev.target.value = currentLanguage().code;
openMoreLocalesSheet('language');
return;
}
E.setLanguage(ev.target.value, DEFAULT_DIALECT[ev.target.value] || 1);
} else if (ev.target.id === 'appDialect') {
if (ev.target.value === '__more_dialects__') {
ev.target.value = String(currentDialectRank());
openMoreLocalesSheet('dialect');
return;
}
E.setLanguage(currentLanguage().code, ev.target.value);
} else return;
applyLanguage();
updateTopCurrencyFlag();
renderAll();
document.addEventListener('visibilitychange', function () {
if (document.visibilityState === 'hidden' && E.flushSaves) E.flushSaves();
});
window.addEventListener('beforeunload', function () {
if (E.flushSaves) E.flushSaves();
});
toast('تم حفظ اللغة واللهجة');
});
}
var FONT_SCALES = [1, 1.1, 1.2];
function applyFontStep() {
var scale = FONT_SCALES[S().settings.fontStep || 0] || 1;
document.documentElement.style.setProperty('--font-scale', String(scale));
try { localStorage.setItem('rohapp.fontScale', String(scale)); } catch (e) {}
}
var THEME_META_COLORS = {
'emerald:light': '#064e3b',
'emerald:dark': '#0a1f18',
'ocean:light': '#1d6fa5',
'ocean:dark': '#07192b',
'burgundy:light': '#7f1d1d',
'burgundy:dark': '#22080d',
'purple:light': '#6d28d9',
'purple:dark': '#150a2a',
'teal:light': '#0d9488',
'teal:dark': '#021a19',
'amber:light': '#d97706',
'amber:dark': '#1c0a00',
'royal-gold:dark': '#0c0902',
'cyberpunk:dark': '#070514'
};
function checkScheduledReport() {
var st = S();
var rs = st.settings && st.settings.reportSchedule;
if (!rs || !rs.enabled || !rs.nextRun) return;
var today = E.todayISO();
if (rs.nextRun > today) return;
if (rs.type === 'cashflow') openCashFlowForm();
else if (rs.type === 'balance') printBalanceSheet();
else if (rs.type === 'pl') printProfitLoss();
var now = new Date();
var next = new Date(now);
if (rs.frequency === 'daily') next.setDate(next.getDate() + 1);
else if (rs.frequency === 'weekly') next.setDate(next.getDate() + 7);
else next.setMonth(next.getMonth() + 1);
rs.nextRun = next.toISOString().slice(0, 10);
E.saveState();
toast('تقرير مجدول: ' + (rs.type === 'cashflow' ? 'التدفق النقدي' : (rs.type === 'balance' ? 'الميزانية' : 'الأرباح والخسائر')));
}
function applyTheme() {
var t = currentTheme();
var mode = (t === 'system') ? ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light') : (/dark$/.test(t) ? 'dark' : (t === 'dark' ? 'dark' : 'light'));
var accent = String(t || 'light').replace(/-dark$/, '');
if (accent !== 'ocean' && accent !== 'burgundy' && accent !== 'purple' && accent !== 'teal' && accent !== 'amber' && accent !== 'royal-gold' && accent !== 'cyberpunk') accent = 'emerald';
document.documentElement.setAttribute('data-theme', mode);
document.documentElement.setAttribute('data-accent', accent);
var metaTheme = document.querySelector('meta[name="theme-color"]');
if (metaTheme) metaTheme.setAttribute('content', THEME_META_COLORS[accent + ':' + mode] || '#064e3b');
var icon = accent === 'royal-gold' ? '👑' : (accent === 'cyberpunk' ? '⚡' : (mode === 'dark' ? '☀' : (accent === 'ocean' ? '🌊' : (accent === 'burgundy' ? '🍷' : (accent === 'purple' ? '💜' : (accent === 'amber' ? '🟠' : (accent === 'teal' ? '🟢' : '🌙')))))));
if (els.themeBtn) els.themeBtn.textContent = icon;
try { localStorage.setItem('rohapp.theme', t); } catch (e) {}
}
var AC_KINDS = [
{ t: 'دفعت', h: 'مصروف' }, { t: 'صرفت', h: 'مصروف' }, { t: 'اشتريت', h: 'مصروف' },
{ t: 'استلمت', h: 'إيراد' }, { t: 'قبضت', h: 'إيراد' }, { t: 'بعت', h: 'إيراد' },
{ t: 'سلفت', h: 'دين لنا' }, { t: 'أقرضت', h: 'دين لنا' },
{ t: 'تسلفت', h: 'دين علينا' }, { t: 'استلفت', h: 'دين علينا' }, { t: 'اقترضت', h: 'دين علينا' },
{ t: 'سددت', h: 'سداد' }, { t: 'حصلت', h: 'تحصيل' },
{ t: 'حولت', h: 'تحويل' }, { t: 'نقلت', h: 'تحويل' },
{ t: 'عندي', h: 'رصيد افتتاحي' }, { t: 'رصيد', h: 'استعلام' }
];
var AC_ACCOUNTS = [
{ t: 'كاش', h: 'الصندوق' }, { t: 'صندوق', h: 'الصندوق' },
{ t: 'بنك', h: 'البنك' }, { t: 'دولار', h: 'عملة' }, { t: 'ريال', h: 'عملة' }
];
var acPartyCache = { key: null, items: [] };
function acParties() {
var st = S();
var key = st.updatedAt + '|' + (st.entries || []).length + '|' + (st.drafts || []).length + '|' + (st.accounts || []).length;
if (acPartyCache.key !== key) acPartyCache = { key: key, items: collectParties() };
return acPartyCache.items;
}
function collectParties() {
var st = S(); var seen = {}; var out = [];
function add(name, hint) {
var n = String(name || '').trim();
if (n && !seen[n]) { seen[n] = true; out.push({ t: n, h: hint }); }
}
var _ranked = (E.rankedAccounts ? E.rankedAccounts() : (st.accounts || []));
var _rankMap = {};
_ranked.forEach(function (a, i) { _rankMap[a.id] = i; });
var _sortedAccs = (st.accounts || []).slice().sort(function (x, y) { var rx = _rankMap[x.id]; var ry = _rankMap[y.id]; if (rx == null && ry == null) return 0; if (rx == null) return 1; if (ry == null) return -1; return rx - ry; });
_sortedAccs.forEach(function (a) {
add(a.name, 'حساب');
var item = out[out.length - 1];
if (item && item.t === String(a.name || '').trim()) {
item.nick = String(a.nickname || '').trim();
item.phone = E.normalizeAr(a.phone || '').replace(/\D/g, '');
}
});
(st.entries || []).forEach(function (e) { add(e.counterparty, 'طرف'); });
(st.drafts || []).forEach(function (d) { add(d.counterparty, 'طرف'); });
return out;
}
function acWordAt(value, caret) {
var start = caret, end = caret;
while (start > 0 && !/\s/.test(value.charAt(start - 1))) start--;
while (end < value.length && !/\s/.test(value.charAt(end))) end++;
return { start: start, end: end, word: value.slice(start, end) };
}
function acDistance(a, b) {
var prev = [], cur, i, j;
for (j = 0; j <= b.length; j++) prev[j] = j;
for (i = 1; i <= a.length; i++) {
cur = [i];
for (j = 1; j <= b.length; j++) {
cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
}
prev = cur;
}
return prev[b.length];
}
function acScore(candidate, word) {
var c = E.normalizeAr(candidate);
if (c === word) return null;
if (c.indexOf(word) === 0 || c.replace(/^ال/, '').indexOf(word) === 0) return 0;
if (word.length >= 2 && c.indexOf(word) > 0) return 1;
if (word.length < 3) return null;
var allowed = word.length <= 4 ? 1 : 2;
var d = Math.min(acDistance(word, c), acDistance(word, c.slice(0, word.length)));
return d <= allowed ? 2 + d : null;
}
function acSuggestions(word) {
var w = E.normalizeAr(word || '');
if (!w) return [];
var pool = AC_KINDS.concat(AC_ACCOUNTS).concat(acParties());
var seen = {}; var scored = [];
if (/^[\d.,+]+$/.test(w)) {
var digits = w.replace(/\D/g, '');
if (digits.length < 4) return [];
pool.forEach(function (s) {
var at = s.phone ? s.phone.indexOf(digits) : -1;
if (at >= 0) scored.push({ s: { t: s.t, h: s.phone }, score: at === 0 ? 0 : 1 });
});
scored.sort(function (a, b) { return a.score - b.score; });
return scored.slice(0, 8).map(function (x) { return x.s; });
}
var kinds = {};
pool.forEach(function (s) { if (E.normalizeAr(s.t) === w) kinds[s.h] = true; });
var bare = w.replace(/^(لل|ل|ب|و)/, '');
var pre = bare.length >= 2 && bare !== w ? String(word).slice(0, w.length - bare.length) : '';
pool.forEach(function (s) {
if (seen[s.t]) return;
seen[s.t] = true;
var score = acScore(s.t, w);
var hint = s.h;
var lead = '';
var isName = s.h === 'حساب' || s.h === 'طرف';
if (isName && pre && E.normalizeName(s.t) === E.normalizeName(bare)) return;
[isName ? '' : null, isName && pre ? pre : null].forEach(function (p) {
if (p === null) return;
var q = p ? bare : w;
[[s.t, s.h], [s.nick, s.nick]].forEach(function (pair) {
if (!pair[0]) return;
var sc = E.normalizeAr(pair[0]) === q ? (pair[0] === s.t ? null : 0) : acScore(pair[0], q);
if (sc !== null && (score === null || sc < score)) { score = sc; hint = pair[1]; lead = p; }
});
});
if (score === null && kinds[s.h] && E.normalizeAr(s.t) !== w) score = 1.5;
if (score === null) return;
var item = hint === s.h && !lead ? s : { t: s.t, h: hint };
if (lead) item.ins = /ل$/.test(lead) && /^ال/.test(s.t) ? lead.replace(/ل+$/, '') + 'ل' + s.t.slice(1) : lead + s.t;
scored.push({ s: item, score: score });
});
scored.sort(function (a, b) { return a.score - b.score || a.s.t.length - b.s.t.length; });
return scored.slice(0, 8).map(function (x) { return x.s; });
}
var acIndex = -1;
var acItems = [];
var acRange = null;
function acRender(items) {
acItems = items || [];
acIndex = -1;
if (!els.ac) return;
if (!acItems.length) { els.ac.hidden = true; els.ac.innerHTML = ''; return; }
els.ac.innerHTML = acItems.map(function (s, i) {
return '<div class="ac-item" role="option" data-idx="' + i + '">' +
'<span class="ac-text">' + E.escapeHtml(s.t) + '</span>' +
'<span class="ac-hint">' + E.escapeHtml(s.h) + '</span>' +
'</div>';
}).join('');
els.ac.hidden = false;
}
function acHide() {
if (els.ac) { els.ac.hidden = true; els.ac.innerHTML = ''; }
acItems = []; acIndex = -1; acRange = null;
}
function acApply(item) {
if (!item || !acRange) return;
var val = els.input.value;
var after = val.slice(acRange.end);
var gap = /^\s/.test(after) ? '' : ' ';
var text = item.ins || item.t;
els.input.value = val.slice(0, acRange.start) + text + gap + after;
var caret = acRange.start + text.length + 1;
autoGrow();
els.input.focus();
try { els.input.selectionStart = els.input.selectionEnd = caret; } catch (e) {}
acHide();
}
function acUpdate() {
if (!els.input) return;
var v = els.input.value;
var caret = els.input.selectionStart == null ? v.length : els.input.selectionStart;
if (!v.trim() || els.input.selectionEnd !== caret) { acHide(); return; }
var at = acWordAt(v, caret);
var items = acSuggestions(at.word);
acRender(items);
acRange = items.length ? at : null;
}
function acKeyDown(ev) {
if (!els.ac || els.ac.hidden) return;
if (ev.key === 'ArrowDown') {
ev.preventDefault();
acIndex = (acIndex + 1) % acItems.length;
acHighlight();
} else if (ev.key === 'ArrowUp') {
ev.preventDefault();
acIndex = (acIndex - 1 + acItems.length) % acItems.length;
acHighlight();
} else if (ev.key === 'Enter' && acIndex >= 0) {
ev.preventDefault();
ev.stopPropagation();
acApply(acItems[acIndex]);
} else if (ev.key === 'Escape') {
acHide();
}
}
function acHighlight() {
if (!els.ac) return;
var nodes = els.ac.querySelectorAll('.ac-item');
nodes.forEach(function (n, i) {
n.classList.toggle('active', i === acIndex);
});
}
function bindEvents() {
document.querySelectorAll('.tab').forEach(function (btn) {
btn.addEventListener('click', function () {
setTab(btn.getAttribute('data-tab'));
});
});
if (els.actionBtn) {
var _dialectClicks = 0;
var _dialectTimer = null;
els.actionBtn.addEventListener('click', function () {
if (voiceContinuous) {
voiceContinuous = false;
if (voicePending) { voicePending = null; }
toast('أوقف الإصغاء.');
stopVoiceUi();
return;
}
if (els.input && els.input.value.trim().length > 0) {
var value = els.input.value;
els.input.value = '';
autoGrow();
acHide();
updateActionBtn();
handleText(value);
return;
}
_dialectClicks++;
if (_dialectClicks >= 5) {
_dialectClicks = 0;
if (_dialectTimer) { clearTimeout(_dialectTimer); _dialectTimer = null; }
openVoiceDialectQuickSheet();
return;
}
if (!_dialectTimer) {
_dialectTimer = setTimeout(function () { _dialectClicks = 0; _dialectTimer = null; }, 1000);
}
startVoice();
});
var micLpTimer = null;
els.actionBtn.addEventListener('contextmenu', function (ev) {
if (!els.input || !els.input.value.trim()) {
ev.preventDefault();
openVoiceDialectQuickSheet();
}
});
els.actionBtn.addEventListener('touchstart', function () {
if (els.input && els.input.value.trim()) return;
micLpTimer = setTimeout(function () {
micLpTimer = null;
voiceContinuous = true;
if (els.actionBtn) { els.actionBtn.classList.add('listening'); els.actionBtn.innerHTML = '<span class="voice-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>'; }
toast('استمرار الإصغاء… (اضغط مرة لإيقاف)');
startVoice();
}, 600);
}, { passive: true });
['touchend', 'touchmove', 'touchcancel'].forEach(function (evName) {
els.actionBtn.addEventListener(evName, function () {
if (micLpTimer) { clearTimeout(micLpTimer); micLpTimer = null; }
});
});
}
els.input.addEventListener('input', function () { autoGrow(); acUpdate(); updateActionBtn(); updateComposerChipsVisibility(); });
document.getElementById('formBtn').addEventListener('click', function () {
window.__pendingAmount = null;
openEditDraft('new');
});
document.getElementById('clearBtn').addEventListener('click', function () {
clearComposer();
els.input.focus();
});
document.getElementById('reportChips').addEventListener('click', function (ev) {
var chip = ev.target.closest('[data-report]');
if (chip) openReportFromChip(chip.getAttribute('data-report'));
});
els.input.addEventListener('keydown', function (ev) {
if (els.ac && !els.ac.hidden && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'Escape' || (ev.key === 'Enter' && acIndex >= 0))) {
acKeyDown(ev);
if (ev.defaultPrevented) return;
}
if (ev.key === 'Enter' && !ev.shiftKey) {
acHide();
ev.preventDefault();
if (els.actionBtn) els.actionBtn.click();
}
});
els.input.addEventListener('blur', function () {
setTimeout(function () { acHide(); }, 180);
});
els.input.addEventListener('click', acUpdate);
els.input.addEventListener('keyup', function (ev) {
if (/^Arrow(Left|Right)$|^Home$|^End$/.test(ev.key)) acUpdate();
});
if (els.ac) {
els.ac.addEventListener('click', function (ev) {
var item = ev.target.closest('.ac-item');
if (!item) return;
var idx = parseInt(item.getAttribute('data-idx'), 10);
if (!isNaN(idx) && acItems[idx]) acApply(acItems[idx]);
});
}
document.addEventListener('click', function (ev) {
var inp = ev.target.closest('.amount-input');
if (!inp || inp.id === 'edit-amount' || inp.classList.contains('cash-recon-input')) return;
ev.preventDefault();
if (inp.blur) inp.blur();
if (inp.id) openNumpad(inp.id);
});
var ttsStopBtn = document.getElementById('ttsStop');
if (ttsStopBtn) {
ttsStopBtn.addEventListener('click', function (ev) {
ev.preventDefault();
stopSpeaking();
});
}
var typingStopBtn = document.getElementById('typingStop');
if (typingStopBtn) {
typingStopBtn.addEventListener('click', function (ev) {
ev.preventDefault();
if (ui.typingTimer) { clearInterval(ui.typingTimer); ui.typingTimer = null; }
if (ui.typingMsgId) {
ui.typingPos = ui.typingFullText.length;
ui.typingMsgId = null;
ui.typingIsReport = false;
if (els.chat) {
var _sp = els.chat.querySelector('span.typed-text[data-msg="' + (typingStopBtn.getAttribute('data-msg') || '') + '"]');
}
renderAll();
}
typingStopBtn.hidden = true;
});
}
var composerChipsHolder = document.getElementById('composerChips');
if (composerChipsHolder) {
bindExampleChips(composerChipsHolder);
var suggestHoldTimer = null;
var suggestHeld = false;
var startSuggestHold = function (ev) {
if (!ev.target.closest('.suggest-btn')) return;
suggestHeld = false;
suggestHoldTimer = setTimeout(function () {
suggestHeld = true;
suggestHoldTimer = null;
toggleComposerChips();
}, 500);
};
var stopSuggestHold = function () {
if (suggestHoldTimer) { clearTimeout(suggestHoldTimer); suggestHoldTimer = null; }
};
composerChipsHolder.addEventListener('mousedown', startSuggestHold);
composerChipsHolder.addEventListener('touchstart', startSuggestHold, { passive: true });
composerChipsHolder.addEventListener('mouseup', stopSuggestHold);
composerChipsHolder.addEventListener('mouseleave', stopSuggestHold);
composerChipsHolder.addEventListener('touchend', stopSuggestHold);
composerChipsHolder.addEventListener('touchmove', stopSuggestHold);
composerChipsHolder.addEventListener('click', function (ev) {
if (!suggestHeld) return;
suggestHeld = false;
ev.stopPropagation();
ev.preventDefault();
}, true);
}
bindMaskedAmounts();
bindGlobalSearch();
bindAttachments();
bindChatScroll();
document.addEventListener('focusin', function (ev) {
var t = ev.target;
if (!t || !t.matches || !t.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select')) return;
setTimeout(function () {
if (document.activeElement === t && t.scrollIntoView) t.scrollIntoView({ block: 'nearest' });
}, 300);
});
if (window.visualViewport) {
window.visualViewport.addEventListener('resize', function () {
var t = document.activeElement;
if (t && t.scrollIntoView) {
setTimeout(function () { t.scrollIntoView({ block: 'nearest' }); }, 100);
}
});
}
bindLanguage();
document.querySelector('.topbar').addEventListener('click', function (ev) {
var btn = ev.target.closest('[data-action]');
if (!btn) return;
var action = btn.getAttribute('data-action');
if (action === 'top-menu') {
openRowMenu(btn, ev.currentTarget, [
['toggle-amounts', S().settings.hideAmounts ? MENU_ICONS.show + uiStr('menuShowAmounts', 'إظهار المبالغ') : MENU_ICONS.hide + uiStr('menuHideAmounts', 'إخفاء المبالغ')],
['undo-last', MENU_ICONS.undo + uiStr('menuUndo', 'تراجع عن أخر قيد')],
['money-groups', MENU_ICONS.group + uiStr('menuGroups', 'المجموعات المالية')],
['exchange', MENU_ICONS.exchange + uiStr('menuExchange', 'صرف عملة')],
['open-currency', MENU_ICONS.currency + uiStr('menuCurrency', 'العملة الأساسية')],
['voice-dialect', MENU_ICONS.voiceDialect + uiStr('menuVoiceDialect', 'لهجة الصوت والكتابة')],
['open-status-card', MENU_ICONS.statusCard + uiStr('menuStatusCard', 'بطاقة حالة اليوم (PNG)')],
['open-backup', MENU_ICONS.backup + uiStr('tileBackup', 'نسخة احتياطية')],
['open-settings', MENU_ICONS.settings + uiStr('menuSettings', 'الإعدادات')]
].concat(window.RohTrainer || S().settings.trainingOption ? [['open-trainer', MENU_ICONS.train + 'تدريب البوت']] : [])
.concat(window.RohOwner && S().settings.ownerCodesOption ? [['owner-codes', MENU_ICONS.search + 'رموز التفعيل']] : []));
return;
}
closeRowMenu();
if (action === 'open-currency') { openSettingsSection('currency'); return; }
if (action === 'voice-dialect') { openVoiceDialectQuickSheet(); return; }
if (action === 'open-status-card') { openStatusCardSheet(); return; }
if (action === 'open-settings') { setTab('settings'); return; }
if (action === 'open-backup') { openExport(); return; }
if (action === 'global-search') openGlobalSearch();
if (action === 'bot-tour') { try { localStorage.setItem('rohapp.botTourHintShown', '1'); localStorage.removeItem('rohapp.parseErrorCount'); localStorage.removeItem('rohapp.cancelCount'); } catch (e) {} var _bm = document.querySelector('.brand-mark'); if (_bm) _bm.classList.remove('bot-tour-pulse'); openBotTour(); return; }
if (action === 'open-trainer') openTrainer();
if (action === 'money-groups') openMoneyGroups();
if (action === 'exchange') { openExchangeSheet(); return; }
if (action === 'owner-codes') requireOwner(function () { openOwnerCodes(); });
if (action === 'report-cashflow') openCashFlowForm();
else if (action === 'open-reports-hub') openReportsHub();
if (action === 'sankey') { printSankey(); return; }
if (action === 'sankey') { printSankey(); return; }
if (action === 'report-balance') printBalanceSheet();
if (action === 'profit-loss') { printProfitLoss(); return; }
if (action === 'sankey') { printSankey(); return; }
if (action === 'profit-loss') { printProfitLoss(); return; }
if (action === 'sankey') { printSankey(); return; }
if (action === 'zakat') { openZakat(); return; }
if (action === 'open-zakat') { openZakat(); return; }
if (action === 'debt-aging') { printDebtAging(); return; }
if (action === 'undo-last') {
verifyThen('حذف آخر قيد', function () {
var u = E.undoLast();
if (u.ok) { botText('تم التراجع عن آخر قيد وحذفه من الدفاتر.' + undoEntrySummary(u.entry)); toast('تم التراجع'); } else toast('تعذر التراجع: ' + u.error, true);
renderAll();
});
return;
}
if (action === 'toggle-amounts') {
E.setHideAmounts(!S().settings.hideAmounts);
renderAll();
toast(S().settings.hideAmounts ? 'المبالغ مخفية' : 'المبالغ ظاهرة');
}
});
els.chat.addEventListener('focusout', function (ev) {
var el = ev.target;
if (!el || !el.classList || !el.classList.contains('details')) return;
var draftId = el.getAttribute('data-draft-id');
var idx = Number(el.getAttribute('data-line-index'));
var draft = E.findDraft(draftId);
if (!draft) return;
var line = (draft.lines || [])[idx];
if (!line) return;
var val = (el.textContent || '').trim();
if (val === (line.note || '')) return;
line.note = val;
E.saveState();
toast('تم حفظ الملاحظة');
});
els.chat.addEventListener('keydown', function (ev) {
var el = ev.target;
if (!el || !el.classList || !el.classList.contains('details')) return;
if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
});
els.chat.addEventListener('focusout', function (ev) {
var el = ev.target;
if (!el || !el.classList || !el.classList.contains('rate-inline')) return;
applyRateInline(el);
});
els.chat.addEventListener('change', function (ev) {
var el = ev.target;
if (!el || !el.classList || !el.classList.contains('rate-inline')) return;
applyRateInline(el);
});
els.chat.addEventListener('keydown', function (ev) {
var el = ev.target;
if (!el || !el.classList || !el.classList.contains('rate-inline')) return;
if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
});
els.chat.addEventListener('dblclick', function (ev) {
var bubble = ev.target.closest('.bubble');
if (!bubble) return;
var text = (bubble.innerText || bubble.textContent || '').trim();
if (!text) return;
if (typeof copyText === 'function') { copyText(text, 'تم نسخ النص'); }
else if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { toast('تم نسخ النص'); }).catch(function () {}); }
});
var longPressTimer = null;
var longPressTarget = null;
function startLongPress(ev) {
var msg = ev.target.closest('.msg.user');
if (!msg) return;
longPressTarget = msg;
longPressTimer = setTimeout(function () {
askConfirm('حذف آخر قيد', 'سيُحذف آخر قيد من الدفاتر. هل تريد المتابعة؟', function () {
var u = E.undoLast();
if (u.ok) { toast('تم التراجع'); } else toast('تعذر التراجع: ' + u.error, true);
renderAll();
});
longPressTimer = null;
}, 500);
}
function cancelLongPress() {
if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
longPressTarget = null;
}
els.chat.addEventListener('mousedown', startLongPress);
els.chat.addEventListener('touchstart', startLongPress, { passive: true });
els.chat.addEventListener('mouseup', cancelLongPress);
els.chat.addEventListener('mouseleave', cancelLongPress);
els.chat.addEventListener('touchend', cancelLongPress);
els.chat.addEventListener('touchmove', cancelLongPress);
els.chat.addEventListener('click', function (ev) {
var pick = ev.target.closest('[data-choice-index]');
var row = pick && pick.closest('[data-choice-msg]');
if (!row) return;
var answeredMsg = S().messages.filter(function (x) { return x.id === row.getAttribute('data-choice-msg'); })[0];
if (!answeredMsg || !answeredMsg.data || answeredMsg.data.answered !== undefined) return;
answeredMsg.data.answered = Number(pick.getAttribute('data-choice-index'));
E.saveState();
setTimeout(renderAll, 0);
});
els.chat.addEventListener('click', function (ev) {
var chip = ev.target.closest('[data-chip]');
var btn = ev.target.closest('[data-action]');
if (!btn) return;
var action = btn.getAttribute('data-action');
var id = btn.getAttribute('data-id');
if (action === 'view-attachment') openAttachment(id);
else if (action === 'more-chips') openMoreChips();
else if (action === 'rag-toggle') { var _rid = btn.getAttribute('data-id'); var _rd = document.querySelector('.rag-details[data-id="' + _rid + '"]'); if (_rd) _rd.style.display = (_rd.style.display === 'none' ? 'block' : 'none'); }
else if (action === 'vector-correct') { openVectorCorrectSheet(btn.getAttribute('data-phrase') || '', btn.getAttribute('data-acc') || ''); return; }
else if (action === 'toggle-draft-lines') { var st = S(); if (!st.settings) st.settings = {}; st.settings.hideDraftLines = !st.settings.hideDraftLines; E.saveState(); renderAll(); }
else if (action === 'need-kind' || action === 'need-amount') { handleText(btn.getAttribute('data-text') || ''); return; }
else if (action === 'advance-yes') { ui.advanceOkText = btn.getAttribute('data-text') || ''; handleText(ui.advanceOkText); return; }
else if (action === 'advance-no') { botText('حسناً، سجّل الشراء بالآجل أولاً، ثم الدفعة.'); renderAll(); return; }
else if (action === 'sent-go-draft') {
var waitingDraft = S().messages.filter(function (x) { return x.type === 'draft' && x.from === id; })[0];
var draftEl = waitingDraft ? document.querySelector('[data-msg-id="' + waitingDraft.id + '"]') : null;
if (draftEl) { draftEl.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
else toast('القيد لم يعد بانتظار التأكيد', true);
return;
}
else if (action === 'sent-confirmed-at') {
var confirmedMsg = S().messages.filter(function (x) { return x.id === id; })[0];
toast(confirmedMsg && confirmedMsg.confirmedAt ? 'تم الاعتماد: ' + fmtStamp(confirmedMsg.confirmedAt) : 'وقت الاعتماد غير متوفر');
return;
}
else if (action === 'confirm-draft') confirmDraft(id);
else if (action === 'edit-draft') openEditDraft(id);
else if (action === 'rate-edit') { ui.editingRateDraftId = btn.getAttribute('data-draft-id'); renderAll(); }
else if (action === 'cancel-draft') cancelDraft(id);
else if (action === 'print-account') { var pid = btn.getAttribute('data-id'); if (pid) printAccount(pid); }
else if (action === 'print-counterparty') { var pname = btn.getAttribute('data-name'); if (pname) printCounterparty(pname); }
else if (action === 'save-draft-template') saveDraftTemplate(id);
else if (action === 'rate-edit-btn') { ui.editingRateDraftId = id; renderAll(); }
else if (action === 'edit-line-note') editLineNote(btn.getAttribute('data-draft-id'), Number(btn.getAttribute('data-line-index')));
else if (action === 'note-clear' || action === 'note-mic') {
var noteDraft = E.findDraft(btn.getAttribute('data-draft-id'));
var noteLine = noteDraft && (noteDraft.lines || [])[Number(btn.getAttribute('data-line-index'))];
if (!noteLine) { toast('القيد غير موجود', true); return; }
if (action === 'note-clear') {
noteLine.note = '';
E.saveState();
renderAll();
toast('تم مسح الملاحظة');
} else {
startVoice(function (said) {
said = String(said || '').trim();
if (!said) return;
noteLine.note = noteLine.note ? noteLine.note + ' ' + said : said;
E.saveState();
renderAll();
toast('تمت إضافة الملاحظة');
});
}
}
else if (action === 'fx-gain') showFxGain(btn);
else if (action === 'fx-record') recordFxGain(btn);
else if (action === 'duplicate-draft') duplicateDraft(id);
else if (action === 'delete-entry') removeEntry(id);
else if (action === 'tts') speakText(btn.getAttribute('data-text'));
else if (action === 'typing-stop') {
var stopId = btn.getAttribute('data-id');
if (ui.typingTimer) { clearInterval(ui.typingTimer); ui.typingTimer = null; }
ui.typingPos = ui.typingFullText.length;
ui.typingMsgId = null;
ui.typingIsReport = false;
if (els.chat) {
var stopBtn = els.chat.querySelector('[data-action="typing-stop"][data-id="' + stopId + '"]');
if (stopBtn) stopBtn.remove();
var span = els.chat.querySelector('span.typed-text[data-msg="' + stopId + '"]');
if (span) span.textContent = ui.typingFullText;
}
return;
}
else if (action === 'share-wa') shareToWhatsApp(btn.getAttribute('data-id'));
else if (action === 'print-receipt') {
var aid = btn.getAttribute('data-id');
if (aid) printAccount(aid);
else toast('لا يوجد حساب', true);
} else if (action === 'print-counterparty') {
printCounterparty(btn.getAttribute('data-name'));
} else if (action === 'open-statement-picker') { openStatementPicker(); return; }
if (action === 'open-counterparty-picker') { openCounterpartyPicker(); return; } else if (action === 'account-ledger') {
showAccountLedger(btn.getAttribute('data-id'));
} else if (action === 'print-contra') {
var cid = btn.getAttribute('data-id');
if (cid) printAccount(cid);
else toast('لا يوجد حساب مقابل', true);
} else if (action === 'balance-primary') {
var pid = btn.getAttribute('data-id');
if (!pid) { toast('لا يوجد حساب', true); return; }
var pacc = E.getAccount(pid);
if (!pacc) { toast('الحساب غير موجود', true); return; }
botAccountBalance(pacc);
renderAll();
} else if (action === 'contra-balance') {
var cid = btn.getAttribute('data-id');
if (!cid) { toast('لا يوجد حساب مقابل', true); return; }
var acc = E.getAccount(cid);
if (!acc) { toast('الحساب غير موجود', true); return; }
botText(accountBalanceText(acc));
renderAll();
} else if (action === 'open-radar') {
setTab('radar');
renderAll();
} else if (action === 'receipt-more') {
var eid = btn.getAttribute('data-id');
openReceiptMore(eid);
} else if (action === 'money-pick') {
ui.chosenMoney = btn.getAttribute('data-name');
ui.chosenName = btn.getAttribute('data-carry') || null;
ui.keptCurrency = btn.getAttribute('data-currency') || null;
handleText(btn.getAttribute('data-text'));
} else if (action === 'assistant-goal-ask') {
var gm = E.todayISO().slice(0, 7);
var gopts = E.goalOptions(gm);
pushMessage({ role: 'bot', type: 'text', text: 'لو اخترت شيئاً واحداً تنتبه له هذا الشهر، ماذا يكون؟',
data: { assistant: 'question', tight: true, choices: gopts.map(function (o) { return { label: o.label, action: 'assistant-goal', name: o.kind, text: JSON.stringify(o) }; })
.concat([{ label: 'ليس الآن', action: 'assistant-goal-later', name: '', text: '' }, { label: 'لا تسألني', action: 'assistant-mute', name: 'question', text: '' }]) } });
renderAll();
} else if (action === 'assistant-goal') {
var gopt = null;
try { gopt = JSON.parse(btn.getAttribute('data-text') || ''); } catch (e) { gopt = null; }
var gres = E.setMonthlyGoal(gopt);
if (!gres.ok) { toast(gres.error, true); return; }
botText('اتفقنا: ' + gres.goal.label + ' هذا الشهر. أعود إليه حين ينتهي الشهر.');
renderAll();
} else if (action === 'assistant-goal-later') {
botText('حسناً، نعود إليه الشهر القادم.');
renderAll();
} else if (action === 'assistant-ledger') {
setTab('ledger');
} else if (action === 'assistant-month-report') {
printProfitLoss();
} else if (action === 'fraud-cancel') {
var fcId = btn.getAttribute('data-name');
if (E.findDraft(fcId)) cancelDraft(fcId);
settleHeldDraft(fcId, 'أُلغي قيد موقوف.');
renderAll();
} else if (action === 'fraud-review') {
var frId = btn.getAttribute('data-name');
if (!E.findDraft(frId)) { toast('القيد لم يعد موجوداً', true); return; }
openEditDraft(frId);
} else if (action === 'fraud-save') {
var fsId = btn.getAttribute('data-name');
var fsDraft = E.findDraft(fsId);
if (!fsDraft) { toast('القيد لم يعد موجوداً', true); return; }
verifyAlways('تأكيد قيد موقوف', function () {
settleHeldDraft(fsId, 'حُفظ قيد موقوف بعد تأكيدك.');
confirmDraftProceed(fsId, fsDraft.sourceEntryId || null);
});
} else if (action === 'assistant-more') {
assistantSpeak('more');
} else if (action === 'assistant-mute') {
var mk = btn.getAttribute('data-name');
E.muteAssistant(mk);
botText('حسناً، لن أخبرك عن ' + (ASSISTANT_KIND_NAMES[mk] || 'هذا') + ' بعد الآن. تعيدها من الإعدادات متى شئت.');
renderAll();
} else if (action === 'assistant-remind') {
sendReminderText(btn.getAttribute('data-text') || '');
} else if (action === 'assistant-due') {
openRescheduleDue(btn.getAttribute('data-name'));
} else if (action === 'assistant-fix-overdraft') {
openFixOverdraft(btn.getAttribute('data-id') || btn.getAttribute('data-name'));
} else if (action === 'assistant-budget') {
openBudgetsSheet();
} else if (action === 'assistant-open-export' || action === 'open-export') {
openExport();
} else if (action === 'assistant-later') {
botText('حسناً، أذكّرك به غداً.');
renderAll();
} else if (action === 'assistant-run-recurring') {
var rr = E.runRecurring(btn.getAttribute('data-name'));
if (!rr || !rr.ok) { toast((rr && rr.error) || 'تعذر تسجيل القيد', true); return; }
renderAll();
} else if (action === 'add-currency-yes') {
addCurrencyAndRetry((btn.getAttribute('data-name') || '').split(',').filter(Boolean), btn.getAttribute('data-currency'), btn.getAttribute('data-text'));
} else if (action === 'add-currency-no') {
ui.keepCurrencyAsIs = true;
handleText(btn.getAttribute('data-text'));
} else if (action === 'add-currency-cancel') {
botText('لم أسجل شيئاً. يبقى المبلغ بعملته، فأضفها للحسابات أولاً أو اذكر حساباً يقبلها.');
renderAll();
} else if (action === 'split-open') {
var again = E.parseIntent(btn.getAttribute('data-text') || '');
if (again && again.kind === 'needSplit') openSplitSheet(again);
else toast('تعذر قراءة الجملة من جديد', true);
} else if (action === 'reval-yes') {
var rvDraft = null;
try { rvDraft = E.buildRevaluationDraft((btn.getAttribute('data-name') || '').split(',').filter(Boolean)); }
catch (e) { toast(e.message, true); return; }
if (!rvDraft) { botText('لا توجد أرصدة تحتاج إعادة تقييم الآن.'); renderAll(); return; }
ux('reval.yes');
S().drafts.push(rvDraft);
if (S().drafts.length > 20) S().drafts = S().drafts.slice(-20);
pushMessage({ role: 'bot', type: 'draft', draftId: rvDraft.id });
E.saveState();
renderAll();
} else if (action === 'uxp-yes') {
openUxConsent();
} else if (action === 'uxp-no') {
botText('حسناً، لن يُجمع شيء. يمكنك الانضمام لاحقاً من الإعدادات ← برنامج تحسين التجربة.');
renderAll();
} else if (action === 'reval-no') {
botText('تبقى الأرصدة بقيمتها الحالية. يُحسب فرق الصرف عند التسوية، أو حين تغيّر السعر وتوافق على إعادة التقييم.');
renderAll();
} else if (action === 'person-pick') {
ui.chosenName = btn.getAttribute('data-name');
handleText(btn.getAttribute('data-text'));
} else if (action === 'person-new') {
openNewAccountForm('asset', 'العملاء', btn.getAttribute('data-name'));
ui.afterNewAccount = { text: btn.getAttribute('data-text'), short: btn.getAttribute('data-name') };
} else if (action === 'similar-yes' || action === 'similar-pick') {
var ps = ui.pendingSimilar;
if (!ps) { toast('لا يوجد طلب معلق', true); return; }
var picked = action === 'similar-pick' ? E.getAccount(btn.getAttribute('data-id')) : ps.existing;
if (!picked) { toast('الحساب غير موجود', true); return; }
ps.intent.contraAccountId = picked.id;
ps.intent.counterparty = picked.name;
var st = S();
st.messages = st.messages.filter(function (m) { return m.type !== 'similar-account'; });
ui.pendingSimilar = null;
try {
var draft = E.buildDraft(ps.intent);
st.drafts.push(draft);
if (st.drafts.length > 20) st.drafts = st.drafts.slice(-20);
E.saveState();
pushMessage({ role: 'bot', type: 'draft', draftId: draft.id });
} catch (e) {
botText('لم أستطع بناء القيد: ' + e.message);
}
E.saveState();
renderAll();
} else if (action === 'similar-no') {
var ps = ui.pendingSimilar;
if (!ps) { toast('لا يوجد طلب معلق', true); return; }
var cp = ps.name;
var isReceivable = (ps.intent.kind === 'lend' || ps.intent.kind === 'collect');
var newAcc = E.addAccount({
name: cp,
type: isReceivable ? 'asset' : 'liability',
nature: isReceivable ? 'debit' : 'credit',
currency: ps.intent.currency || 'SAR',
liquid: false,
glyph: isReceivable ? '⇢' : '⇠',
hint: isReceivable ? 'عميل' : 'مورد',
subtype: isReceivable ? 'العملاء' : 'الموردون'
});
if (newAcc && newAcc.ok) {
ps.intent.contraAccountId = newAcc.account.id;
window.__autoCreatedAccount = newAcc.account.name;
}
var st = S();
st.messages = st.messages.filter(function (m) { return m.type !== 'similar-account'; });
ui.pendingSimilar = null;
try {
var draft = E.buildDraft(ps.intent);
st.drafts.push(draft);
if (st.drafts.length > 20) st.drafts = st.drafts.slice(-20);
E.saveState();
pushMessage({ role: 'bot', type: 'draft', draftId: draft.id });
} catch (e) {
botText('لم أستطع بناء القيد: ' + e.message);
}
E.saveState();
renderAll();
}
else if (action === 'currency-account-yes') {
var pca = ui.pendingCurrencyAccount;
if (!pca) { toast('لا يوجد طلب معلق', true); return; }
var cur = pca.currency;
var cashAcc = E.getAccount('cash');
var cashCodes = cashAcc ? (cashAcc.multi ? (cashAcc.currencies || []).slice() : [cashAcc.currency]) : [];
var newAcc = cashAcc && cashCodes.indexOf(cur) < 0 ? E.setAccountCurrencies('cash', cashCodes.concat([cur])) : { ok: !!cashAcc };
if (newAcc && newAcc.ok && cashAcc) { pca.intent.accountId = 'cash'; toast('صار «' + cashAcc.name + '» يقبل ' + currencyName(cur)); }
else if (newAcc && newAcc.error) toast(newAcc.error, true);
ui.pendingCurrencyAccount = null;
try {
var draft = E.buildDraft(pca.intent);
if (window.__autoCreatedAccount) { setTimeout(function () { toast('تم إنشاء الحساب "' + window.__autoCreatedAccount + '" تلقائياً'); window.__autoCreatedAccount = null; }, 100); }
var st = S();
st.drafts.push(draft);
if (st.drafts.length > 20) st.drafts = st.drafts.slice(-20);
E.saveState();
pushMessage({ role: 'bot', type: 'draft', draftId: draft.id });
} catch (e) {
botText('لم أستطع بناء القيد: ' + e.message);
}
E.saveState();
renderAll();
}
else if (action === 'currency-account-no') {
var pca2 = ui.pendingCurrencyAccount;
if (!pca2) { toast('لا يوجد طلب معلق', true); return; }
ui.pendingCurrencyAccount = null;
try {
var draft = E.buildDraft(pca2.intent);
var st = S();
st.drafts.push(draft);
if (st.drafts.length > 20) st.drafts = st.drafts.slice(-20);
E.saveState();
pushMessage({ role: 'bot', type: 'draft', draftId: draft.id });
} catch (e) {
botText('لم أستطع بناء القيد: ' + e.message);
}
E.saveState();
renderAll();
}
else if (action === 'dup-confirm') {
var pd = ui.pendingDuplicate;
if (!pd) { toast('لا يوجد طلب معلق', true); return; }
var st = S();
st.messages = st.messages.filter(function (m) { return m.type !== 'duplicate-confirm'; });
ui.pendingDuplicate = null;
ui.pendingDuplicateEntry = null;
try {
var draft = E.buildDraft(pd);
if (window.__autoCreatedAccount) { setTimeout(function () { toast('تم إنشاء الحساب "' + window.__autoCreatedAccount + '" تلقائياً'); window.__autoCreatedAccount = null; }, 100); }
st.drafts.push(draft);
if (st.drafts.length > 20) st.drafts = st.drafts.slice(-20);
E.saveState();
pushMessage({ role: 'bot', type: 'draft', draftId: draft.id });
} catch (e) {
botText('لم أستطع بناء القيد: ' + e.message);
}
E.saveState();
renderAll();
} else if (action === 'dup-cancel') {
var st = S();
st.messages = st.messages.filter(function (m) { return m.type !== 'duplicate-confirm'; });
ui.pendingDuplicate = null;
ui.pendingDuplicateEntry = null;
botText('تم إلغاء الإضافة.');
E.saveState();
renderAll();
}
else if (action === 'ai-stop') {
var rid = btn.getAttribute('data-id');
if (window.__aiPending) window.__aiPending[rid] = false;
var m = findMessage(rid);
if (m) { m.type = 'ai-error'; m.text = 'تم إيقاف الطلب.'; }
E.saveState();
renderAll();
toast('تم إيقاف طلب الذكاء الاصطناعي');
} else if (action === 'ai-allow-always' || action === 'ai-allow-once' || action === 'ai-deny') {
handleAiPermission(action, btn);
}
});
els.ledger.addEventListener('click', function (ev) {
var attachment = ev.target.closest('[data-action="view-attachment"]');
if (attachment) { openAttachment(attachment.getAttribute('data-id')); return; }
var menuBtn = ev.target.closest('[data-action="entry-menu"]');
if (menuBtn) {
openRowMenu(menuBtn, els.ledger, [['modify-entry', '✎ تعديل'], ['save-template', 'حفظ كقالب'], ['delete-entry', 'حذف', true]]);
return;
}
closeRowMenu();
var advf = ev.target.closest('[data-action="open-ledger-adv-filter"]');
if (advf) { openLedgerAdvFilter(); return; }
var ledOpts = ev.target.closest('[data-action="ledger-options"]');
if (ledOpts) {
openRowMenu(ledOpts, els.ledger, [
['open-ledger-adv-filter', 'فلتر متقدم'],
['open-entry-templates', 'قوالب القيود'],
['toggle-multiselect', ui.multiSelect ? '✕ إلغاء التحديد' : '☑ تحديد متعدد']
]);
return;
}
var filter = ev.target.closest('[data-filter]');
if (filter) {
ui.filter = filter.getAttribute('data-filter');
ui.ledgerVisible = 50;
ui._ledgerFiltered = null;
ui._ledgerFilterUnchanged = false;
renderLedger();
return;
}
var btn = ev.target.closest('[data-action="delete-entry"]');
if (btn) removeEntry(btn.getAttribute('data-id'));
var mbtn = ev.target.closest('[data-action="modify-entry"]');
if (mbtn) modifyEntry(mbtn.getAttribute('data-id'));
var lo = ev.target.closest('[data-action="open-ledger-adv-filter"],[data-action="open-entry-templates"],[data-action="toggle-multiselect"]');
if (lo) {
var a2 = lo.getAttribute('data-action');
if (a2 === 'open-ledger-adv-filter') openLedgerAdvFilter();
else if (a2 === 'open-entry-templates') openEntryTemplatesSheet();
else if (a2 === 'toggle-multiselect') { ui.multiSelect = !ui.multiSelect; if (!ui.multiSelect) ui.selectedEntries = {}; renderLedger(); }
closeRowMenu();
return;
}
var stpl = ev.target.closest('[data-action="save-template"]');
if (stpl) saveEntryTemplate(stpl.getAttribute('data-id'));
var otpl = ev.target.closest('[data-action="open-entry-templates"]');
if (otpl) openEntryTemplatesSheet();
var ms = ev.target.closest('[data-action="toggle-multiselect"]');
if (ms) { ui.multiSelect = !ui.multiSelect; if (!ui.multiSelect) ui.selectedEntries = {}; renderLedger(); return; }
var bd = ev.target.closest('[data-action="bulk-delete"]');
if (bd) {
var ids = Object.keys(ui.selectedEntries).filter(function(k){return ui.selectedEntries[k];});
if (!ids.length) { toast('لم يتم تحديد أي قيد', true); return; }
verifyThen('حذف ' + ids.length + ' قيد', function () {
ids.forEach(function (id) { E.deleteEntry(id); });
ui.selectedEntries = {};
ui.multiSelect = false;
toast('تم حذف ' + ids.length + ' قيد');
renderLedger();
});
(function () {
var timer = null;
var target = null;
function cancel() { if (timer) { clearTimeout(timer); timer = null; } target = null; }
function start(ev) {
var t = ev.target;
if (ev.touches && ev.touches[0]) t = ev.touches[0].target;
var entry = t ? t.closest('[data-longpress="true"]') : null;
if (!entry) { cancel(); return; }
target = entry;
timer = setTimeout(function () {
if (!target) return;
var eid = target.getAttribute('data-id');
ui.multiSelect = true;
ui.selectedEntries = {};
if (eid) ui.selectedEntries[eid] = true;
renderLedgerList();
toast('وضع التحديد المتعدد');
}, 500);
}
els.ledger.addEventListener('mousedown', start);
els.ledger.addEventListener('mouseup', cancel);
els.ledger.addEventListener('mouseleave', cancel);
els.ledger.addEventListener('touchstart', start, { passive: true });
els.ledger.addEventListener('touchend', cancel);
els.ledger.addEventListener('touchmove', cancel);
})();
return;
}
var te = ev.target.closest('[data-action="toggle-entry"]');
if (te && !ev.target.closest('[data-action="entry-menu"]') && !ev.target.closest('.entry-select-cb')) {
var eid = te.getAttribute('data-id');
if (ui.multiSelect) {
if (eid) { ui.selectedEntries[eid] = !ui.selectedEntries[eid]; renderLedgerList(); }
} else {
if (eid) { ui.expandedEntries[eid] = !ui.expandedEntries[eid]; ui._ledgerFilterUnchanged = false; renderLedgerList(); }
}
}
var cb = ev.target.closest('.entry-select-cb');
if (cb) {
var cid = cb.getAttribute('data-id');
if (cid) { ui.selectedEntries[cid] = cb.checked; renderLedgerList(); }
}
var gtab = ev.target.closest('[data-action="go-tab"]');
if (gtab) { setTab(gtab.getAttribute('data-tab-name')); }
});
if (els.radar) {
els.radar.addEventListener('click', function (ev) {
var btn = ev.target.closest('[data-action]');
if (!btn) return;
var action = btn.getAttribute('data-action');
var id = btn.getAttribute('data-id');
if (action === 'settle-partial') openSettlePartial(id);
else if (action === 'reminder-due') openReminder(id);
else if (action === 'print-counterparty') printCounterparty(btn.getAttribute('data-name'));
else if (action === 'export-dashboard') exportDashboardExcel();
else if (action === 'open-status-card') openStatusCardSheet();
else if (action === 'radar-prefs') { if (E.noteFeature) E.noteFeature('radar'); openRadarPrefsSheet(); }
else if (action === 'open-budgets') openBudgetsSheet();
else if (action === 'open-report-schedule') openReportScheduleSheet();
else if (action === 'open-autoconfirm-tuning') openAutoConfirmTuning();
else if (action === 'toggle-auto-match-setting') { var st = S(); if (!st.settings) st.settings = {}; st.settings.autoMatch = !st.settings.autoMatch; E.saveState(); renderAll(); toast(st.settings.autoMatch ? 'تم تفعيل Auto-match' : 'تم تعطيل Auto-match'); }
else if (action === 'toggle-bypass-governor') { var st = S(); if (!st.settings) st.settings = {}; st.settings.bypassGovernor = !st.settings.bypassGovernor; E.saveState(); renderAll(); toast(st.settings.bypassGovernor ? 'تم تفعيل Bypass Governor' : 'تم تعطيل Bypass Governor'); }
else if (action === 'open-cash-recon') openCashReconSheet();
else if (action === 'open-merge-accounts') openMergeAccountsSheet();
else if (action === 'validate-accounts') validateAccounts();
else if (action === 'accounts-options') { openAccountsOptionsSheet(); return; }
else if (action === 'open-merge-accounts') openMergeAccountsSheet();
else if (action === 'validate-accounts') validateAccounts();
else if (action === 'merge-accounts-run') runMergeAccounts();
else if (action === 'open-recurring') openRecurringSheet();
else if (action === 'open-zakat') openZakat();
else if (action === 'debt-aging') printDebtAging();
else if (action === 'open-onboarding') openOnboarding();
else if (action === 'run-recurring') {
var rRes = E.runRecurring(id);
if (!rRes.ok) { toast(rRes.error || 'تعذر التسجيل', true); return; }
pushReceipts(rRes.entry ? [rRes.entry.id] : null);
try { E.recordNetWorthSnapshot(); } catch (e) {}
toast('تم تسجيل القيد وترحيل الموعد القادم إلى ' + E.fmtDate(rRes.nextDate));
renderAll();
}
else if (action === 'fix-overdraft') openFixOverdraft(id);
else if (action === 'go-tab') { setTab(btn.getAttribute('data-tab-name')); }
else if (action === 'radar-filter') { ui.radarFilter = btn.getAttribute('data-filter') || 'ALL'; renderAll(); }
else if (action === 'settle-due') { var sid = btn.getAttribute('data-id'); if (sid) { verifyThen('تسوية استحقاق', function () { var r = E.settleDueItem(sid, 'cash'); if (r && r.ok) { toast('تمت التسوية'); renderAll(); } else toast((r && r.error) || 'تعذر التسوية', true); }); } }
});
}
if (els.accounts) {
bindAccountRows();
els.accounts.addEventListener('click', function (ev) {
var btn = ev.target.closest('[data-action]');
if (btn) {
var action = btn.getAttribute('data-action');
var id = btn.getAttribute('data-id');
if (action === 'clear-accounts-filter') { ui.accountsSubtypeFilter = 'ALL'; ui.accountsFilter = 'ALL'; ui.accountsCurrency = null; var as = document.getElementById('accountsSearch'); if (as) as.value = ''; renderAccounts(); return; }
if (action === 'add-account') { openNewAccountForm(btn.getAttribute('data-type'), btn.getAttribute('data-subtype')); return; }
if (action === 'account-menu') {
openAccountMenu(btn, id);
return;
}
closeRowMenu();
if (action === 'toggle-accounts-search') { toggleAccountsSearch(); return; }
if (action === 'account-bot') { openAccountInBot(id); return; }
if (action === 'edit-account') { openEditAccount(id); return; }
if (action === 'print-account') { printAccount(id); return; }
if (action === 'print-counterparty') { printCounterparty(btn.getAttribute('data-name')); return; }
if (action === 'open-cash-recon') { openCashReconSheet(); closeRowMenu(); return; }
if (action === 'open-merge-accounts') { openMergeAccountsSheet(); closeRowMenu(); return; }
if (action === 'validate-accounts') { validateAccounts(); closeRowMenu(); return; }
if (action === 'accounts-options') {
if (typeof window.openAccountsOptionsSheet === 'function') window.openAccountsOptionsSheet();
return;
}
if (action === 'toggle-favorite') {
var favoriteResult = E.toggleFavoriteAccount(id);
if (!favoriteResult.ok) { toast(favoriteResult.error, true); return; }
renderAccounts();
toast(favoriteResult.favorite ? 'أضيف إلى المفضلة' : 'أزيل من المفضلة');
return;
}
if (action === 'account-notes') { openAccountNotes(id); return; }
if (action === 'account-budget') { openAccountBudget(id); return; }
if (action === 'opening-balance') { openAccountOpeningSheet(id); return; }
if (action === 'close-balance') { openCloseBalance(id); return; }
if (action === 'show-account-ledger') { showAccountLedger(id); return; }
if (action === 'delete-account') { deleteAccountUI(id); return; }
}
var generalHead = ev.target.closest('[data-general]');
if (generalHead) {
tapGeneralHead(generalHead.getAttribute('data-general'));
return;
}
var curChip = ev.target.closest('[data-acccurrency]');
if (curChip) {
var chosenCur = curChip.getAttribute('data-acccurrency');
ui.accountsCurrency = ui.accountsCurrency === chosenCur ? null : chosenCur;
renderAccounts();
return;
}
var subtypeFilter = ev.target.closest('[data-accsubtype]');
if (subtypeFilter) {
var chosenFilter = subtypeFilter.getAttribute('data-accsubtype');
ui.accountsSubtypeFilter = ui.accountsSubtypeFilter === chosenFilter ? 'ALL' : chosenFilter;
renderAccounts();
return;
}
var filter = ev.target.closest('[data-accfilter]');
if (filter) { ui.accountsFilter = filter.getAttribute('data-accfilter'); renderAccounts(); return; }
});
}
if (els.accounts) {
var accountsSearchTimer = null;
els.accounts.addEventListener('input', function (ev) {
if (ev.target && ev.target.id === 'accountsSearch') {
ui.accountsSearch = ev.target.value;
if (accountsSearchTimer) clearTimeout(accountsSearchTimer);
accountsSearchTimer = setTimeout(function () { renderAccountsList(); }, 140);
}
});
document.addEventListener('click', function (ev) {
if (!ev.target.closest('#rowMenu, .row-menu-btn')) closeRowMenu();
});
document.addEventListener('keydown', function (ev) {
if (ev.key === 'Escape') closeRowMenu(true);
});
window.addEventListener('scroll', function () {
var owner = rowMenuOwner;
if (owner && Math.abs(owner.getBoundingClientRect().top - rowMenuAnchorTop) > 2) closeRowMenu();
}, true);
window.addEventListener('resize', function () { closeRowMenu(); });
els.accounts.addEventListener('focusout', function (ev) {
if (!ev.target || ev.target.id !== 'accountsSearch') return;
if (ev.relatedTarget && ev.relatedTarget.id === 'accountsSearchToggle') return;
setTimeout(function () {
var box = document.getElementById('accountsSearch');
if (!box || ui.accountsSearch || document.activeElement === box) return;
ui.accountsSearchOpen = false;
renderAccounts();
}, 200);
});
}
var ledgerSearchTimer = null;
els.ledger.addEventListener('input', function (ev) {
if (ev.target && ev.target.id === 'ledgerSearch') {
ui.search = ev.target.value;
if (ledgerSearchTimer) clearTimeout(ledgerSearchTimer);
ledgerSearchTimer = setTimeout(function () { ui.ledgerVisible = 50; ui._ledgerFiltered = null; ui._ledgerFilterUnchanged = false; renderLedgerList(); }, 140);
}
});
els.settings.addEventListener('change', function (ev) {
if (ev.target && ev.target.id === 'baseCurrency') {
var newBase = ev.target.value;
var changed = E.mainCurrencyLocked() ? E.setMainCurrency(newBase) : E.setBaseCurrency(newBase);
renderAll();
if (!changed.ok) { toast(changed.error, true); return; }
showPlaceholder();
toast('العملة الأساسية: ' + newBase);
openRatesSetupModal(newBase);
}
if (ev.target && ev.target.getAttribute('data-action') === 'set-due-days') {
var d = Number(ev.target.value);
var res = E.setDefaultDueDays(d);
if (res.ok) toast('تم تعيين ' + res.days + ' يوم');
else toast(res.error, true);
renderAll();
}
if (ev.target && ev.target.getAttribute('data-action') === 'set-reminder-time') {
var res = E.setReminderTime(ev.target.value);
if (res.ok) toast('تم تعيين وقت التذكير: ' + res.time);
else toast(res.error, true);
renderAll();
}
});
els.settings.addEventListener('click', function (ev) {
var gt = ev.target.closest('.group-title');
if (gt && !ev.target.closest('[data-action]')) {
var groups = [].slice.call(els.settings.querySelectorAll('.group-title'));
var idx = groups.indexOf(gt);
var key = settingsGroupKey(gt, idx >= 0 ? idx : 0);
tapSettingsGroup(key);
return;
}
var btn = ev.target.closest('[data-action]');
if (!btn) return;
var action = btn.getAttribute('data-action');
if (action === 'open-onboarding') { openOnboarding(); return; }
if (action === 'app-version') {
window.__verClicks = (window.__verClicks || 0) + 1;
if (window.__verTimer) clearTimeout(window.__verTimer);
window.__verTimer = setTimeout(function () { window.__verClicks = 0; }, 2000);
if (window.__verClicks >= 5) {
window.__verClicks = 0;
clearTimeout(window.__verTimer);
showAllVersions();
}
return;
}
if (action === 'open-more-languages') { openMoreLocalesSheet('language'); return; }
if (action === 'open-more-dialects') { openMoreLocalesSheet('dialect'); return; }
if (action === 'open-user-guide') { openUserGuide(); return; }
if (action === 'open-privacy') { openLegal('privacy'); return; }
if (action === 'open-terms') { openLegal('terms'); return; }
if (action === 'edit-profile') { openProfileSheet(); return; }
if (action === 'settings-options') {
var sGroups = [].slice.call(els.settings.querySelectorAll('.group-title'));
var sOpenCount = Object.keys(settingsOpen).filter(function (k) { return !!settingsOpen[k]; }).length;
var sAllOpen = sGroups.length > 0 && sOpenCount === sGroups.length;
var sMenuItems = [
[sAllOpen ? 'settings-collapse-all' : 'settings-expand-all', sAllOpen ? '▴ طي جميع الأقسام' : '▾ فتح جميع الأقسام (' + sGroups.length + ')'],
['copy-export', '🔒 مركز النسخ الاحتياطي'],
['open-import', '📂 استعادة نسخة احتياطية'],
['open-pairing', '📲 اقتران جهاز'],
['open-user-guide', '📖 دليل الاستخدام'],
[null, 'أقسام الإعدادات']
];
sGroups.forEach(function (g, idx) {
var k = settingsGroupKey(g, idx);
var rawT = (g.textContent || '').replace('＋ إضافة عملة', '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
sMenuItems.push(['settings-jump:' + k, (settingsOpen[k] ? '✓ ' : '') + esc(rawT)]);
});
openRowMenu(btn, els.settings, sMenuItems);
return;
}
if (action === 'settings-expand-all') {
closeRowMenu();
[].slice.call(els.settings.querySelectorAll('.group-title')).forEach(function (g, i) { settingsOpen[settingsGroupKey(g, i)] = true; });
syncSettingsGroupsAndChips();
return;
}
if (action === 'settings-collapse-all') {
closeRowMenu();
settingsOpen = {};
syncSettingsGroupsAndChips();
return;
}
if (action && action.indexOf('settings-jump:') === 0) {
closeRowMenu();
openSettingsSection(action.slice('settings-jump:'.length));
return;
}
if (action === 'currency-menu') {
var currencyItems = [['toggle-favorite-currency', E.isFavoriteCurrency(btn.getAttribute('data-id')) ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'], ['edit-currency-rate', 'تعديل المعادل'], ['currency-history', 'السجل']];
if (!btn.getAttribute('data-used')) currencyItems.push(['remove-currency', 'حذف', true]);
openRowMenu(btn, els.settings, currencyItems);
return;
}
closeRowMenu();
if (action === 'add-currency') { openAddCurrency(); return; }
if (action === 'edit-currency' || action === 'edit-currency-data' || action === 'edit-currency-rate') { openEditCurrency(btn.getAttribute('data-id')); return; }
if (action === 'currency-history') { openCurrencyHistory(btn.getAttribute('data-id')); return; }
if (action === 'toggle-favorite-currency') { var fr = E.toggleFavoriteCurrency(btn.getAttribute('data-id')); if (!fr.ok) { toast(fr.error, true); return; } toast(fr.favorite ? 'أضيف إلى المفضلة' : 'أزيل من المفضلة'); renderAll(); return; }
if (action === 'remove-currency') { removeCurrencyUI(btn.getAttribute('data-id')); return; }
if (action === 'toggle-hide') {
E.setHideAmounts(!S().settings.hideAmounts);
renderAll();
} else if (action === 'toggle-default-multi') {
E.setDefaultMultiCurrency(!E.defaultMultiCurrency());
renderSettings();
} else if (action === 'toggle-simple') {
E.setSimpleMode(!S().settings.simpleMode);
renderAll();
} else if (action === 'open-budgets') {
openBudgetsSheet();
} else if (action === 'open-recurring') {
openRecurringSheet();
} else if (action === 'toggle-owner-gate') {
E.setOwnerGate(!(S().settings.ownerGate !== false));
toast(S().settings.ownerGate !== false ? 'فُعّل دخول نسخة المالك' : 'أُلغي دخول نسخة المالك');
renderAll();
return;
} else if (action === 'toggle-app-lock') {
toggleAppLock();
} else if (action === 'set-lock-time') {
setAppLockTime(Number(btn.getAttribute('data-minutes')));
} else if (action === 'toggle-verify') {
toggleVerifyActions();
} else if (action === 'set-due-days') {
var d = Number(btn.value);
var res = E.setDefaultDueDays(d);
if (res.ok) toast('تم تعيين ' + res.days + ' يوم');
else toast(res.error, true);
} else if (action === 'toggle-uxp') {
if (E.isUxProgram()) { E.setUxProgram(false); toast('خرجت من البرنامج وحُذف ما جُمع'); renderAll(); }
else openUxConsent();
} else if (action === 'uxp-view') {
openUxReport();
} else if (action === 'uxp-send') {
sendUxReport();
} else if (action === 'set-settings-tab') { ui.settingsTab = btn.getAttribute('data-tab'); renderSettings(); return; }
if (action === 'toggle-auto-tts') {
E.setAutoTts(!S().settings.autoTts);
if (S().settings.autoTts) speakText('تم تفعيل القراءة التلقائية');
else stopSpeaking();
renderAll();
} else if (action === 'set-font') {
E.setFontStep(btn.getAttribute('data-step'));
applyFontStep();
renderAll();
} else if (action === 'set-theme') {
var th = btn.getAttribute('data-theme-choice');
if ((th === 'royal-gold-dark' || th === 'cyberpunk-dark') && (E.cfoRank ? E.cfoRank().rank : 1) < 3) {
toast('🔒 هذا المظهر الحصري يُفتح عند الوصول لرتبة «مدير تنفيذي — Pro CFO» (20 قيداً + 3 ميزات)');
return;
}
var st = S();
if (!st.settings) st.settings = {};
st.settings.theme = th;
E.saveState();
applyTheme();
renderAll();
toast(th === 'royal-gold-dark' ? '👑 المظهر الملكي الذهبي (Pro CFO)' : (th === 'cyberpunk-dark' ? '⚡ مظهر سايبربانك (Pro CFO)' : (th === 'dark' ? 'الوضع الداكن' : (th === 'light' ? 'الوضع الفاتح' : (th === 'ocean' ? 'المظهر المحيطي' : (th === 'ocean-dark' ? 'المظهر المحيطي الداكن' : (th === 'burgundy' ? 'المظهر العنابي' : (th === 'burgundy-dark' ? 'المظهر العنابي الداكن' : (th === 'purple' ? 'المظهر البنفسجي' : (th === 'purple-dark' ? 'المظهر البنفسجي الداكن' : (th === 'amber-dark' ? 'المظهر الكهرماني الداكن' : (th === 'teal' ? 'المظهر الفيروزي' : (th === 'teal-dark' ? 'المظهر الفيروزي الداكن' : (th === 'amber' ? 'المظهر الكهرماني' : 'حسب النظام'))))))))))))));
} else if (action === 'toggle-ai') {
E.setAIEnabled(!(S().settings && S().settings.aiEnabled));
renderAll();
toast((S().settings.aiEnabled) ? 'تم تفعيل الذكاء الاصطناعي' : 'تم تعطيل الذكاء الاصطناعي');
} else if (action === 'toggle-auto-learn') {
E.setAutoLearn(!(S().settings && S().settings.autoLearn));
renderAll();
toast((S().settings.autoLearn) ? 'تم تفعيل التعلم التلقائي' : 'تم تعطيل التعلم التلقائي');
} else if (action === 'open-voice-pack') {
openVoicePackSheet();
} else if (action === 'send-feedback') {
openFeedbackSheet();
} else if (action === 'copy-export') openExport();
else if (action === 'open-chat-archive') openChatArchive();
else if (action === 'open-plans') openPlans();
else if (action === 'open-activation') openActivation();
else if (action === 'open-users') openUsers();
else if (action === 'open-audit-log') openAuditLog();
else if (action === 'open-event-log') openEventLog();
else if (action === 'open-import') openImport();
else if (action === 'open-pairing') openPairing();
else if (action === 'open-import-csv') openImportCSV();
else if (action === 'do-import-csv') doImportCSV();
else if (action === 'integrity') runIntegrity();
else if (action === 'dict-integrity') {
var ic = E.integrityCheck();
toast(ic.ok ? 'القاموس سليم' : 'مشكلة: ' + ic.messages.join('؛ '), !ic.ok);
openSheet('فحص القاموس', '<div class="modal-note">' + ic.messages.map(function (m) { return esc(m); }).join('<br>') + '</div><div class="modal-actions"><button class="btn ghost" data-action="modal-cancel">إغلاق</button></div>');
} else if (action === 'dict-reset') {
askConfirm('إعادة تعيين القاموس', 'سيتم حذف المفردات المشحونة والمتعلّمة (الإبقاء على taught/trained). متابعة؟', function () {
var r = E.resetDictionary();
toast('تم. مفردات: ' + r.vocabCount);
renderAll();
});
}
else if (action === 'toggle-vector-memory') {
var vmNew = !(E.vectorMemoryEnabled && E.vectorMemoryEnabled());
if (E.setVectorMemoryEnabled) E.setVectorMemoryEnabled(vmNew);
toast(vmNew ? 'تم تفعيل الذاكرة المعرفية' : 'تم تعطيل الذاكرة المعرفية');
renderSettings();
} else if (action === 'toggle-vector-autoconfirm') {
var vaNew = !(E.vectorAutoConfirm && E.vectorAutoConfirm());
if (E.setVectorAutoConfirm) E.setVectorAutoConfirm(vaNew);
toast(vaNew ? 'تم تفعيل الاعتماد التلقائي' : 'تم تعطيل الاعتماد التلقائي');
renderSettings();
} else if (action === 'vector-build-repertoire') {
try {
if (E.buildContextualRepertoire) E.buildContextualRepertoire();
if (E.runChargingOpportunityBuilder) E.runChargingOpportunityBuilder();
var rep = (E.getContextualRepertoire ? E.getContextualRepertoire() : []) || [];
toast('تم بناء الذخيرة السياقية: ' + rep.length + ' مثال');
renderSettings();
} catch (e) { toast('خطأ في البناء', true); }
} else if (action === 'vector-details') {
openVectorDetailsSheet();
} else if (action === 'vector-correct') {
openVectorCorrectSheet();
} else if (action === 'vector-details-run') {
runVectorDetails();
} else if (action === 'vector-correct-run') {
runVectorCorrect();
} else if (action === 'open-ai-insight') {
var insText = (window.RohAI && window.RohAI.generateFinancialInsight) ? window.RohAI.generateFinancialInsight() : 'المحرك الاستشاري غير متاح.';
openSheet('🧭 التقرير الاستشاري الذكي',
'<div class="account-form"><pre style="white-space:pre-wrap;font-family:inherit;font-size:calc(13px * var(--font-scale, 1));line-height:1.7;background:var(--sand);padding:12px;border-radius:12px;border:1px solid var(--line)">' + esc(insText) + '</pre>' +
'<div class="modal-actions">' +
'<button type="button" class="btn primary" id="copyAiInsightBtn">نسخ / مشاركة</button>' +
'<button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button>' +
'</div></div>');
var cpBtn = document.getElementById('copyAiInsightBtn');
if (cpBtn) cpBtn.addEventListener('click', function () {
sendOrCopyText('التقرير الاستشاري الذكي — موني كود', insText);
});
} else if (action === 'marketing-monthly' || action === 'marketing-referral' || action === 'marketing-social' || action === 'marketing-testimonial') {
var mTypeMap = { 'marketing-monthly': 'monthly_report', 'marketing-referral': 'referral_message', 'marketing-social': 'social_post', 'marketing-testimonial': 'testimonial' };
var mTitleMap = { 'marketing-monthly': 'التقرير الشهري التسويقي', 'marketing-referral': 'رسالة دعوة صديق (خصم 15%)', 'marketing-social': 'منشور وسائل التواصل', 'marketing-testimonial': 'شهادة تجربة التطبيق' };
var mType = mTypeMap[action];
var mText = (E.generateMarketingContent ? E.generateMarketingContent(mType) : '');
openSheet(mTitleMap[action] || 'محتوى تسويقي',
'<div class="account-form"><pre style="white-space:pre-wrap;font-family:inherit;font-size:calc(13px * var(--font-scale, 1));line-height:1.7;background:var(--sand);padding:12px;border-radius:12px;border:1px solid var(--line)">' + esc(mText) + '</pre>' +
'<div class="modal-actions">' +
'<button type="button" class="btn primary" id="copyMarketingBtn">نسخ / مشاركة عبر واتساب</button>' +
'<button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button>' +
'</div></div>');
var mkBtn = document.getElementById('copyMarketingBtn');
if (mkBtn) mkBtn.addEventListener('click', function () {
sendOrCopyText(mTitleMap[action] || 'موني كود', mText);
});
} else if (action === 'marketing-dealer-card') {
var qrSvg = (window.RohQR && typeof window.RohQR.svg === 'function')
? window.RohQR.svg('https://wa.me/967770550110?text=%D8%A3%D8%B1%D8%BA%D8%A8%20%D9%81%D9%8A%20%D8%A7%D9%84%D8%AD%D8%B5%D9%88%D9%84%20%D8%B9%D9%84%D9%89%20%D8%B1%D9%85%D8%B2%20%D8%AA%D9%81%D8%B9%D9%8A%D9%84%20%D9%85%D9%88%D9%86%D9%8A%20%D9%83%D9%88%D8%AF', 'رمز واتساب التفعيل المباشر')
: '';
var cardHtml = '<div id="dealerQrPrintArea" style="border:3px solid var(--emerald);border-radius:16px;overflow:hidden;text-align:center;background:var(--paper);color:var(--ink)">' +
'<div style="background:var(--emerald);color:#fff;padding:16px">' +
'<h3 style="margin:0;font-size:calc(18px * var(--font-scale,1))">نقطة تفعيل معتمدة — تطبيق موني كود</h3>' +
'<p style="margin:4px 0 0;color:#fde68a;font-size:calc(12px * var(--font-scale,1));font-weight:700">محاسبك الذكي بالصوت وباللهجة العامية وبدون إنترنت</p>' +
'</div>' +
'<div style="padding:16px">' +
(qrSvg ? '<div style="width:160px;height:160px;margin:0 auto 12px">' + qrSvg + '</div>' : '') +
'<div style="text-align:right;font-size:calc(12.5px * var(--font-scale,1));margin-bottom:8px">1️⃣ حمّل تطبيق <b>«موني كود»</b> من متجر Google Play Store.</div>' +
'<div style="text-align:right;font-size:calc(12.5px * var(--font-scale,1));margin-bottom:8px">2️⃣ سجّل مصاريفك وديونك وعملاتك بالصوت أو بكتابة جملة عامية في ثوانٍ.</div>' +
'<div style="text-align:right;font-size:calc(12.5px * var(--font-scale,1));margin-bottom:10px">3️⃣ احصل على رمز التفعيل الفوري لجهازك من نقطة التفعيل هذه أو عبر واتساب:</div>' +
'<div dir="ltr" style="background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:10px;padding:10px;font-weight:800;font-size:calc(14px * var(--font-scale,1))">+967 770 550 110 &nbsp;|&nbsp; +968 993 23 110</div>' +
'</div></div>' +
'<div class="modal-actions" style="margin-top:12px">' +
'<button type="button" class="btn primary" id="printDealerCardBtn">🖨 طباعة البطاقة</button>' +
'<button type="button" class="btn ghost" data-action="modal-cancel">إغلاق</button>' +
'</div>';
openSheet('بطاقة نقطة تفعيل معتمدة (QR)', cardHtml);
var prBtn = document.getElementById('printDealerCardBtn');
if (prBtn) prBtn.addEventListener('click', function () {
var area = document.getElementById('dealerQrPrintArea');
if (area && typeof showReport === 'function') {
closeSheet();
showReport('بطاقة نقطة تفعيل معتمدة — موني كود', '<section class="report-page">' + area.outerHTML + '</section>');
} else {
window.print();
}
});
}
else if (action === 'train-vocab') { try { var c = E.trainVocabulary(); toast('تم تدريب ' + c + ' كلمة'); renderAll(); } catch (e) { toast('تعذر التدريب', 'error'); } }
else if (action === 'open-vocab') openVocabSheet();
else if (action === 'toggle-assistant-level') { E.setAssistantLevel(S().settings.assistantLevel === 'quiet' ? 'normal' : 'quiet'); renderAll(); }
else if (action === 'assistant-unmute') { E.unmuteAssistant(); toast('سيخبرك المحاسب بها من جديد'); renderAll(); }
else if (action === 'toggle-notify-category') { var ncat = btn.getAttribute('data-cat'); E.setNotificationCategory(ncat, !E.notificationCategoryOn(ncat)); renderAll(); }
else if (action === 'toggle-notifications' && window.RohReminders) toggleReminders();
else if (action === 'test-notification' && window.RohReminders) testReminder();
else if (action === 'toggle-notifications') {
if (!('Notification' in window)) { toast('الإشعارات غير مدعومة', 'error'); return; }
Notification.requestPermission().then(function (perm) {
if (perm === 'granted') { toast('تم تفعيل التذكيرات'); try { new Notification('موني كود', { body: 'تم تفعيل التذكيرات.' }); } catch (e) {} }
else toast('تم رفض الإذن', 'error');
renderAll();
});
} else if (action === 'test-notification') {
if (!('Notification' in window)) { toast('الإشعارات غير مدعومة', 'error'); return; }
if (Notification.permission !== 'granted') {
Notification.requestPermission().then(function (perm) {
if (perm === 'granted') { try { new Notification('موني كود — تذكير', { body: 'هذا إشعار تجريبي.' }); toast('تم الإرسال'); } catch (e) { toast('تعذر الإرسال', 'error'); } }
else toast('فعّل التذكيرات أولاً', 'error');
renderAll();
});
return;
}
try { new Notification('موني كود — تذكير', { body: 'هذا إشعار تجريبي.' }); toast('تم الإرسال'); } catch (e) { toast('تعذر الإرسال', 'error'); }
}
else if (action === 'ai-test') testAi();
else if (action === 'ai-config') openAiConfig();
else if (action === 'reset') resetAll();
});
els.modal.addEventListener('click', function (ev) {
if (ev.target === els.modal) { closeSheet(); return; }
var btn = ev.target.closest('[data-action]');
if (!btn) return;
var action = btn.getAttribute('data-action');
if (action === 'modal-cancel') closeSheet();
else if (action === 'add-account') { closeSheet(); openNewAccountForm(btn.getAttribute('data-type') || '', btn.getAttribute('data-subtype') || ''); }
else if (action === 'accounts-sort') { ui.accountsSort = btn.getAttribute('data-mode') || 'rank'; closeSheet(); renderAccounts(); }
else if (action === 'accounts-view') { ui.accountsView = btn.getAttribute('data-mode') || 'grouped'; closeSheet(); renderAccounts(); }
else if (action === 'open-cash-recon') { closeSheet(); openCashReconSheet(); }
else if (action === 'open-merge-accounts') { closeSheet(); openMergeAccountsSheet(); }
else if (action === 'validate-accounts') { closeSheet(); validateAccounts(); }
else if (action === 'ai-group') {
var group = btn.getAttribute('data-group');
var sel = document.getElementById('aiProvider');
if (sel) {
Array.from(sel.options).forEach(function (opt) {
var p = window.RohAI && window.RohAI.providerInfo ? window.RohAI.providerInfo(opt.value) : null;
var isCloud = p && typeof p.cloud === 'boolean'
? p.cloud
: ['openrouter', 'openai', 'anthropic', 'gemini', 'mistral', 'groq'].indexOf(opt.value) !== -1;
opt.hidden = (group === 'local' && isCloud) || (group === 'cloud' && !isCloud);
});
var first = Array.from(sel.options).find(function (o) { return !o.hidden; });
if (first) sel.value = first.value;
}
return;
}
else if (action === 'bot-tour-next') { if (botTour) { botTour.index = (botTour.index + 1) % botTour.examples.length; renderBotTourStep(); } }
else if (action === 'bot-tour-prev') { if (botTour) { botTour.index = (botTour.index - 1 + botTour.examples.length) % botTour.examples.length; renderBotTourStep(); } }
else if (action === 'bot-tour-auto') { if (botTour) { botTour.auto = !botTour.auto; var ab = ev.target.closest('[data-action="bot-tour-auto"]'); if (ab) ab.textContent = botTour.auto ? '⏸ إيقاف' : '▶ تشغيل تلقائي'; if (botTour.auto) renderBotTourStep(); else if (botTour.autoTimer) { clearTimeout(botTour.autoTimer); botTour.autoTimer = null; } } }
else if (action === 'bot-tour-try') {
if (botTour && botTour.examples[botTour.index]) {
var phraseToTry = botTour.examples[botTour.index];
if (botTour.typingTimer) clearInterval(botTour.typingTimer);
if (botTour.autoTimer) clearTimeout(botTour.autoTimer);
botTour = null;
closeSheet();
setTab('bot');
els.input.value = phraseToTry;
els.input.dispatchEvent(new Event('input', { bubbles: true }));
els.input.focus();
}
}
else if (action === 'open-learned-words') openLearnedWordsSheet();
else if (action === 'promote-learned') {
var pid = Number(btn.getAttribute('data-id'));
var kind = prompt('نوع العملية (expense/income/lend/borrow/collect/repay/transfer/capital):', 'expense');
if (kind) { var r = E.promoteLearnedWord(pid, kind, null); toast(r.ok ? 'تم الاعتماد' : (r.error || 'تعذر')); openLearnedWordsSheet(); renderAll(); }
} else if (action === 'dismiss-learned') {
var did = Number(btn.getAttribute('data-id'));
E.dismissLearnedWord(did); toast('تم الحذف'); openLearnedWordsSheet(); renderAll();
}
else if (action === 'modify-entry') { closeSheet(); modifyEntry(btn.getAttribute('data-id')); }
else if (action === 'entry-in-ledger') {
closeSheet();
ui.expandedEntries[btn.getAttribute('data-id')] = true;
openSearchResult('entry', btn.getAttribute('data-id'), '');
}
else if (action === 'delete-entry') { closeSheet(); removeEntry(btn.getAttribute('data-id')); }
else if (action === 'save-erates') {
var inputs = els.modal.querySelectorAll('.erate-input');
var changedRates = [];
inputs.forEach(function (inp) {
var code = inp.getAttribute('data-code');
var val = parseFloat(inp.value);
if (code && val > 0 && E.setRate) {
var before = E.getRate(code);
E.setRate(code, val);
if (E.getRate(code) !== before) changedRates.push(code);
}
});
closeSheet();
renderAll();
toast('تم حفظ أسعار الصرف والمعادلات بنجاح');
offerRevaluation(changedRates);
}
else if (action === 'modal-confirm') {
var fn = confirmAction;
confirmAction = null;
closeSheet();
if (typeof fn === 'function') fn();
} else if (action === 'request-unavailable-locale') {
askLocaleRequestPermission(
btn.getAttribute('data-kind') || 'dialect',
btn.getAttribute('data-code') || '',
btn.getAttribute('data-name') || '',
btn.getAttribute('data-flag') || '🌐'
);
} else if (action === 'copy-export') copyExport();
else if (action === 'send-encrypted') openSendEncrypted();
else if (action === 'do-import') doImport();
else if (action === 'ai-save') saveAiConfig();
else if (action === 'ai-allow-always' || action === 'ai-allow-once' || action === 'ai-deny') {
handleAiPermission(action, btn);
}
else if (action === 'similar-yes') {
var ps = ui.pendingSimilar;
if (!ps) { toast('لا يوجد طلب معلق', true); return; }
ps.intent.contraAccountId = ps.existing.id;
var st = S();
st.messages = st.messages.filter(function (m) { return m.type !== 'similar-account'; });
ui.pendingSimilar = null;
try {
var draft = E.buildDraft(ps.intent);
st.drafts.push(draft);
if (st.drafts.length > 20) st.drafts = st.drafts.slice(-20);
E.saveState();
pushMessage({ role: 'bot', type: 'draft', draftId: draft.id });
} catch (e) {
botText('لم أستطع بناء القيد: ' + e.message);
}
E.saveState();
renderAll();
} else if (action === 'similar-no') {
var ps = ui.pendingSimilar;
if (!ps) { toast('لا يوجد طلب معلق', true); return; }
var cp = ps.name;
var isReceivable = (ps.intent.kind === 'lend' || ps.intent.kind === 'collect');
var newAcc = E.addAccount({
name: cp,
type: isReceivable ? 'asset' : 'liability',
nature: isReceivable ? 'debit' : 'credit',
currency: ps.intent.currency || 'SAR',
liquid: false,
glyph: isReceivable ? '⇢' : '⇠',
hint: isReceivable ? 'عميل' : 'مورد',
subtype: isReceivable ? 'العملاء' : 'الموردون'
});
if (newAcc && newAcc.ok) {
ps.intent.contraAccountId = newAcc.account.id;
window.__autoCreatedAccount = newAcc.account.name;
}
var st = S();
st.messages = st.messages.filter(function (m) { return m.type !== 'similar-account'; });
ui.pendingSimilar = null;
try {
var draft = E.buildDraft(ps.intent);
st.drafts.push(draft);
if (st.drafts.length > 20) st.drafts = st.drafts.slice(-20);
E.saveState();
pushMessage({ role: 'bot', type: 'draft', draftId: draft.id });
} catch (e) {
botText('لم أستطع بناء القيد: ' + e.message);
}
if (window.__autoCreatedAccount) {
setTimeout(function () { toast('تم إنشاء الحساب "' + window.__autoCreatedAccount + '" تلقائياً'); window.__autoCreatedAccount = null; }, 100);
}
E.saveState();
renderAll();
}
else if (action === 'dup-confirm') {
var pd = ui.pendingDuplicate;
if (!pd) { toast('لا يوجد طلب معلق', true); return; }
var st = S();
st.messages = st.messages.filter(function (m) { return m.type !== 'duplicate-confirm'; });
ui.pendingDuplicate = null;
ui.pendingDuplicateEntry = null;
try {
var draft = E.buildDraft(pd);
if (window.__autoCreatedAccount) { setTimeout(function () { toast('تم إنشاء الحساب "' + window.__autoCreatedAccount + '" تلقائياً'); window.__autoCreatedAccount = null; }, 100); }
st.drafts.push(draft);
if (st.drafts.length > 20) st.drafts = st.drafts.slice(-20);
E.saveState();
pushMessage({ role: 'bot', type: 'draft', draftId: draft.id });
} catch (e) {
botText('لم أستطع بناء القيد: ' + e.message);
}
E.saveState();
renderAll();
} else if (action === 'dup-cancel') {
var st = S();
st.messages = st.messages.filter(function (m) { return m.type !== 'duplicate-confirm'; });
ui.pendingDuplicate = null;
ui.pendingDuplicateEntry = null;
botText('تم إلغاء الإضافة.');
E.saveState();
renderAll();
}
else if (action === 'compound-add-line') {
syncCompoundLinesFromDom();
var curLines = window.__editCompoundLines || [];
var last = curLines.slice(-1)[0];
var dSum = 0, cSum = 0;
curLines.forEach(function (l) {
if (l.side === 'debit') dSum += (Number(l.amountMinor) || 0);
else cSum += (Number(l.amountMinor) || 0);
});
var diff = dSum - cSum;
var nextSide = diff > 0 ? 'credit' : (diff < 0 ? 'debit' : (last && last.side === 'debit' ? 'credit' : 'debit'));
var nextAmt = Math.abs(diff);
var defaultAcc = nextSide === 'debit' ? 'expense' : 'cash';
if (last && last.accountId === defaultAcc) defaultAcc = nextSide === 'debit' ? 'receivable' : 'payable';
(window.__editCompoundLines = curLines).push({
accountId: E.getAccount(defaultAcc) ? defaultAcc : (last ? last.accountId : 'cash'),
currency: last ? last.currency : E.BASE,
rate: last ? last.rate : E.getRate(E.BASE),
side: nextSide,
amountMinor: nextAmt,
counterparty: '',
note: ''
});
renderEditCompoundDraft();
}
else if (action === 'compound-line-menu') {
openRowMenu(btn, els.modalBody, [
['compound-move-up', '↑ تحريك لأعلى'],
['compound-move-down', '↓ تحريك لأسفل'],
['compound-dup-line', '⧉ نسخ السطر'],
['compound-remove-line', '✕ حذف السطر', true]
]);
return;
}
else if (action === 'compound-move-up') {
closeRowMenu();
syncCompoundLinesFromDom();
var uidx = Number(btn.getAttribute('data-index') != null ? btn.getAttribute('data-index') : btn.getAttribute('data-id'));
if (uidx > 0 && window.__editCompoundLines) {
var tmp = window.__editCompoundLines[uidx - 1];
window.__editCompoundLines[uidx - 1] = window.__editCompoundLines[uidx];
window.__editCompoundLines[uidx] = tmp;
renderEditCompoundDraft();
}
}
else if (action === 'compound-move-down') {
closeRowMenu();
syncCompoundLinesFromDom();
var didx = Number(btn.getAttribute('data-index') != null ? btn.getAttribute('data-index') : btn.getAttribute('data-id'));
if (window.__editCompoundLines && didx < window.__editCompoundLines.length - 1) {
var tmp2 = window.__editCompoundLines[didx + 1];
window.__editCompoundLines[didx + 1] = window.__editCompoundLines[didx];
window.__editCompoundLines[didx] = tmp2;
renderEditCompoundDraft();
}
}
else if (action === 'compound-dup-line') {
closeRowMenu();
syncCompoundLinesFromDom();
var dupidx = Number(btn.getAttribute('data-index') != null ? btn.getAttribute('data-index') : btn.getAttribute('data-id'));
if (window.__editCompoundLines && window.__editCompoundLines[dupidx]) {
var clone = JSON.parse(JSON.stringify(window.__editCompoundLines[dupidx]));
window.__editCompoundLines.splice(dupidx + 1, 0, clone);
renderEditCompoundDraft();
}
}
else if (action === 'compound-remove-line') {
closeRowMenu();
syncCompoundLinesFromDom();
var ridx = Number(btn.getAttribute('data-index') != null ? btn.getAttribute('data-index') : btn.getAttribute('data-id'));
if ((window.__editCompoundLines || []).length <= 2) { toast('القيد يجب أن يحتوي على سطرين على الأقل', true); return; }
(window.__editCompoundLines || []).splice(ridx, 1);
renderEditCompoundDraft();
}
else if (action === 'save-edit-draft') {
var d = E.findDraft(btn.getAttribute('data-id'));
if (d && isMultiLine(d)) saveEditCompoundDraft(btn.getAttribute('data-id'));
else saveEditDraft(btn.getAttribute('data-id'));
}
else if (action === 'confirm-settle-partial') confirmSettlePartial(btn.getAttribute('data-id'));
else if (action === 'new-contra-account') openNewAccount('edit-contra');
else if (action === 'save-new-account') saveNewAccount(btn.getAttribute('data-target'));
else if (action === 'save-profile') saveProfileSheet();
else if (action === 'pf-photo-pick') pickProfilePhoto(function (data) { sheetPhoto = data; drawSheetPhoto(); });
else if (action === 'pf-photo-remove') { sheetPhoto = ''; drawSheetPhoto(); }
else if (action === 'save-new-account2') saveNewAccountForm(btn.getAttribute('data-id'));
else if (action === 'uxp-join') { E.setUxProgram(true); closeSheet(); botText('شكراً لك! مشاركتك تساعدنا على تحسين التطبيق.'); toast('شكراً لمشاركتك. يمكنك عرض التقرير وإرساله من الإعدادات.'); }
else if (action === 'uxp-send') sendUxReport();
else if (action === 'uxp-clear') { E.clearUxData(); closeSheet(); toast('حُذف ما جُمع، وتبقى مشاركاً'); }
else if (action === 'split-save') saveSplitSheet();
else if (action === 'confirm-reassign-account') confirmReassignAccount(btn.getAttribute('data-id'));
else if (action === 'save-new-reassign-account') saveNewReassignAccount(btn.getAttribute('data-id'));
else if (action === 'new-reassign-account') openNewReassignAccount(btn.getAttribute('data-id'));
else if (action === 'save-currency') saveCurrency();
else if (action === 'copy-device-code') copyDeviceCode();
else if (action === 'request-activation') requestActivationCode();
else if (action === 'select-tier') selectLicenseTier(btn.getAttribute('data-tier'));
else if (action === 'apply-promo') applyPromoInSheet();
else if (action === 'request-recovery') requestForeignRecovery();
else if (action === 'record-sub-expense') recordSubscriptionExpense();
else if (action === 'open-transfer-license') openTransferLicenseSheet();
else if (action === 'submit-transfer-license') submitTransferLicense();
else if (action === 'open-refund-license') openRefundLicenseSheet();
else if (action === 'submit-refund-license') submitRefundLicense();
else if (action === 'open-user-guide') openUserGuide();
else if (action === 'try-guide-phrase') {
var ph = btn.getAttribute('data-phrase') || '';
closeSheet();
setTab('bot');
if (els.input && ph) {
els.input.value = ph;
updateActionBtn();
els.input.focus();
toast('تم وضع الجملة في المحادثة — اضغط إرسال لتجربتها');
}
}
else if (action === 'send-cert-text') {
var certMsg = btn.getAttribute('data-msg') || '';
if (window.RohPrint && window.RohPrint.sendText) window.RohPrint.sendText(certMsg);
else copyText(certMsg, 'تم نسخ الشهادة/الإيصال إلى الحافظة');
}
else if (action === 'create-manual-snapshot') {
if (E.autoBackup) {
E.autoBackup({ force: true, reason: 'manual' }).then(function (res) {
if (res && res.ok) {
toast('✓ تم إنشاء نقطة استعادة محلية فورية (' + res.entryCount + ' قيد)');
botText('تم حفظ نسخة احتياطية محلية.');
renderLocalSnapshots();
} else {
toast('تعذر إنشاء النسخة المحلية', true);
}
});
}
}
else if (action === 'toggle-auto-backup') {
var nextAuto = !(S().settings.autoBackup !== false);
E.setAutoBackup(nextAuto);
btn.classList.toggle('on', nextAuto);
btn.setAttribute('aria-checked', nextAuto ? 'true' : 'false');
toast(nextAuto ? 'تم تفعيل النسخ التلقائي اليومي' : 'تم إيقاف النسخ التلقائي اليومي');
}
else if (action === 'restore-snapshot') {
var snapId = btn.getAttribute('data-id');
if (snapId && E.restoreBackup) {
askConfirm('استعادة نقطة محلية', 'سيقوم التطبيق بحفظ «نسخة أمان أخيرة» من بياناتك الحالية تلقائياً ثم استعادة هذه النسخة. هل تريد المتابعة؟', function () {
E.restoreBackup(snapId).then(function (r) {
if (!r || !r.ok) { toast((r && r.error) || 'تعذرت الاستعادة', true); return; }
closeSheet();
renderAll();
botText('تمت استعادة النسخة. حُفظت نسخة أمان من بياناتك السابقة.');
toast('✓ تمت استعادة النسخة بنجاح (' + r.entryCount + ' قيد)');
});
}, 'استعادة');
}
}
else if (action === 'delete-snapshot') {
var delId = btn.getAttribute('data-id');
if (delId && E.deleteBackup) {
E.deleteBackup(delId).then(function () {
toast('حُذفت نقطة الاستعادة');
renderLocalSnapshots();
});
}
}
else if (action === 'open-store') openAppStore(Number(btn.getAttribute('data-id')));
else if (action === 'activate-app') submitActivation();
else if (action === 'paste-activation') pasteActivation();
else if (action === 'scan-activation-qr') startActivationQrScan();
else if (action === 'stop-act-qr') stopActivationQrScan();
else if (action === 'switch-fact-tab') openFactSummariesSheet(btn.getAttribute('data-mode'));
else if (action === 'copy-fact-summary') {
var fData = computeFactSummary(window.__currentFactMode || 'invoice30');
copyText((fData.title ? (fData.title + '\n') : '') + fData.text, 'تم نسخ الحقائق المالية إلى الحافظة');
closeSheet();
}
else if (action === 'post-fact-chat') {
var fData2 = computeFactSummary(window.__currentFactMode || 'invoice30');
closeSheet();
setTab('bot');
botText(fData2.text);
}
else if (action === 'save-edit-currency') saveEditCurrency(btn.getAttribute('data-id'));
else if (action === 'fix-overdraft-opening') saveFixOverdraft(btn.getAttribute('data-id'));
else if (action === 'fix-overdraft-transfer') saveFixOverdraft(btn.getAttribute('data-id'), document.getElementById('fixFrom').value);
else if (action === 'fix-overdraft-review') reviewOverdraftEntries(btn.getAttribute('data-id'));
else if (action === 'copy-reminder') copyReminder();
else if (action === 'copy-status-text') {
copyText(statusCardText(statusCardOpts), 'تم نسخ السطر الرقمي لحالة واتساب');
}
else if (action === 'wa-status-text') {
var stTxt = statusCardText(statusCardOpts);
var waLink = 'https://wa.me/?text=' + encodeURIComponent(stTxt);
try {
var w = window.open(waLink, '_blank');
if (!w) copyText(stTxt, 'تم نسخ السطر الرقمي — الصقه في حالة واتساب');
} catch (e) {
copyText(stTxt, 'تم نسخ السطر الرقمي — الصقه في حالة واتساب');
}
}
else if (action === 'download-status-png') {
var cnv = document.getElementById('statusCardCanvas');
if (cnv) {
var fname = 'moneycode-status-' + E.todayISO() + '.png';
var triggerDownload = function (dataUrl) {
var aTag = document.createElement('a');
aTag.href = dataUrl;
aTag.download = fname;
document.body.appendChild(aTag);
aTag.click();
document.body.removeChild(aTag);
toast('✓ تم حفظ صورة بطاقة الحالة (PNG)');
};
try {
if (cnv.toBlob && navigator.share && typeof File === 'function') {
cnv.toBlob(function (blob) {
if (!blob) { triggerDownload(cnv.toDataURL('image/png')); return; }
var file = new File([blob], fname, { type: 'image/png' });
if (navigator.canShare && navigator.canShare({ files: [file] })) {
navigator.share({ files: [file], text: statusCardText(statusCardOpts) }).catch(function () {
triggerDownload(cnv.toDataURL('image/png'));
});
} else {
triggerDownload(cnv.toDataURL('image/png'));
}
}, 'image/png');
} else {
triggerDownload(cnv.toDataURL('image/png'));
}
} catch (e) {
triggerDownload(cnv.toDataURL('image/png'));
}
}
}
else if (action === 'open-whatsapp') {
var url = btn.getAttribute('data-url');
if (url) {
var done = function () { toast('تم نسخ رابط واتساب — افتح واتساب والصق الرسالة'); };
var fallback = function () {
try { if (document.execCommand) { var t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); done(); } else toast('تعذر فتح واتساب', true); }
catch (e) { toast('تعذر فتح واتساب', true); }
};
if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done).catch(fallback);
else fallback();
}
} else if (action === 'numpad-clear') {
window.__numpadValue = '';
window.__numpadFresh = true;
var d0 = document.getElementById('numpadDisplay');
if (d0) d0.textContent = '0';
} else if (action === 'numpad-ok') {
if (window.__calcOp && window.__calcAcc !== null) {
var numLast = parseFloat(window.__numpadValue || '0') || 0;
window.__numpadValue = window.__fmtNumpadNumber ? window.__fmtNumpadNumber(applyOp(window.__calcAcc, numLast, window.__calcOp)) : String(applyOp(window.__calcAcc, numLast, window.__calcOp));
window.__calcAcc = null;
window.__calcOp = null;
} else if (window.__numpadValue && isFinite(Number(window.__numpadValue)) && window.__fmtNumpadNumber) {
window.__numpadValue = window.__fmtNumpadNumber(window.__numpadValue);
}
var finalVal = window.__numpadValue || '';
if (window.__numpadCompoundIdx != null && window.__editCompoundLines && window.__editCompoundLines[window.__numpadCompoundIdx]) {
var cIdx = window.__numpadCompoundIdx;
window.__numpadCompoundIdx = null;
var parsedNum = parseFloat(String(finalVal).replace(/,/g, '')) || 0;
window.__editCompoundLines[cIdx].amountMinor = Math.round(Math.max(0, parsedNum) * 100);
renderEditCompoundDraft();
return;
}
if (window.__numpadCurInputState) {
var cis = window.__numpadCurInputState;
window.__numpadCurInputState = null;
if (cis.mode === 'edit' && cis.code) {
openEditCurrency(cis.code);
var cr1 = document.getElementById('curRate');
if (cr1) cr1.value = finalVal;
return;
}
if (cis.mode === 'add') {
openAddCurrency();
if (document.getElementById('curCode')) document.getElementById('curCode').value = cis.code || '';
if (document.getElementById('curName')) document.getElementById('curName').value = cis.name || '';
if (document.getElementById('curSymbol')) document.getElementById('curSymbol').value = cis.symbol || '';
if (document.getElementById('curType')) document.getElementById('curType').value = cis.type || 'paper';
if (document.getElementById('curRate')) document.getElementById('curRate').value = finalVal;
return;
}
if (cis.mode === 'settle' && cis.dueId) {
openSettlePartial(cis.dueId);
if (document.getElementById('settle-amount')) document.getElementById('settle-amount').value = finalVal;
if (document.getElementById('settle-account') && cis.accountId) document.getElementById('settle-account').value = cis.accountId;
return;
}
}
window.__pendingAmount = finalVal;
closeSheet();
setTimeout(function () {
if (window.__editDraftId) openEditDraft(window.__editDraftId);
}, 50);
}
else if (action === 'ai-reset') {
if (window.RohAI) window.RohAI.resetConfig();
closeSheet();
renderAll();
toast('تمت استعادة إعدادات الذكاء الاصطناعي الافتراضية');
}
});
document.addEventListener('keydown', function (ev) {
if (ev.key === 'Escape' && els.modal.classList.contains('open')) { closeSheet(); return; }
if (ev.key === 'Escape' && isGlobalSearchOpen()) { closeGlobalSearch(); return; }
});
window.addEventListener('error', function (ev) {
console.error('[RohUI] uncaught', ev.message);
try { E.noteError(ev.error && ev.error.name || 'Error', (ev.filename || '') + ':' + (ev.lineno || 0)); } catch (e) {}
});
window.addEventListener('unhandledrejection', function (ev) {
console.error('[RohUI] unhandled rejection', ev.reason);
try {
var r = ev.reason;
var at = r && r.stack ? (/([A-Za-z0-9_\-]+\.js(?:\?[^:\s)]*)?:\d+)/.exec(r.stack) || [])[1] : '';
E.noteError(r && r.name || 'Error', at || '');
} catch (e) {}
});
}
var OLD_RIYAL_SYMBOL = 'ر.س';
function glyphPixels(ch, family) {
var canvas = document.createElement('canvas');
canvas.width = canvas.height = 60;
var ctx = canvas.getContext('2d', { willReadFrequently: true });
ctx.font = '40px ' + family;
ctx.textBaseline = 'middle';
ctx.fillText(ch, 10, 30);
var data = ctx.getImageData(0, 0, 60, 60).data;
var ink = '';
for (var i = 3; i < data.length; i += 4) ink += data[i] > 64 ? '1' : '0';
return ink;
}
function canDrawRiyalSymbol() {
return canDrawSign(E.SYMBOL.SAR);
}
function canDrawSign(sign) {
try {
var family = getComputedStyle(document.body).fontFamily;
var ink = glyphPixels(sign, family);
if (ink.indexOf('1') < 0) return false;
return ['\u0378', '\uFFFF'].every(function (missing) { return glyphPixels(missing, family) !== ink; });
} catch (e) {
return false;
}
}
async function useRiyalSymbolThatDraws() {
try { await document.fonts.load('40px MoneyRiyal', E.SYMBOL.SAR + '⃄'); } catch (e) {}
Object.keys(E.NEW_SIGNS).forEach(function (code) {
if (!canDrawSign(E.NEW_SIGNS[code])) delete E.NEW_SIGNS[code];
});
var newSymbol = E.SYMBOL.SAR;
if (canDrawRiyalSymbol()) {
S().messages.forEach(function (m) {
if (typeof m.text === 'string') m.text = m.text.split(OLD_RIYAL_SYMBOL + '\u200E').join(newSymbol + '\u200E');
});
return;
}
E.SYMBOL.SAR = OLD_RIYAL_SYMBOL;
S().messages.forEach(function (m) {
if (typeof m.text === 'string') m.text = m.text.split(newSymbol).join(OLD_RIYAL_SYMBOL);
});
}
function openRatesSetupModal(baseCode) {
baseCode = baseCode || E.BASE;
var list = E.listCurrencies ? E.listCurrencies() : [];
var rates = (E.getRates ? E.getRates() : (E.RATES_LIVE ? E.RATES_LIVE() : {}));
var added = (list || []).filter(function (c) { return c.code !== baseCode; });
if (!added.length) return;
var html = '<div class="sheet-title" style="margin-bottom:8px">ضبط أسعار الصرف والمعادلات (E-Rates)</div>' +
'<div class="muted" style="margin-bottom:14px;font-size: calc(12px * var(--font-scale, 1))">حدد سعر معادل كل عملة مقابل العملة الأساسية (' + esc(baseCode) + '):</div>' +
'<div style="max-height:260px;overflow-y:auto;margin-bottom:14px">';
added.forEach(function (c) {
var r = rates[c.code] || c.rate || 1;
html += '<div class="row" style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--sand)">' +
'<span>1 ' + esc(c.code) + ' <span class="muted">(' + esc(c.name || '') + ')</span></span>' +
'<div style="display:flex;align-items:center;gap:4px">' +
'<input type="number" step="any" class="input-text erate-input" data-code="' + esc(c.code) + '" value="' + r + '" style="width:110px;text-align:center;padding:4px 8px"/>' +
'<span style="font-size: calc(12px * var(--font-scale, 1))">' + esc(baseCode) + '</span>' +
'</div></div>';
});
html += '</div>' +
'<div style="display:flex;gap:8px">' +
'<button class="btn ghost flex-1" data-action="close-modal">تجاوز</button>' +
'<button class="btn primary flex-1" data-action="save-erates" data-base="' + esc(baseCode) + '">حفظ المعادلة</button>' +
'</div>';
openModal(html);
}
var botTour = null;
var FULL_ONBOARD_STEPS = ['welcome', 'pitch', 'dialect', 'currency', 'erates', 'persona', 'accounts', 'zakat', 'profile', 'settings', 'learns'];
var ESSENTIAL_ONBOARD_STEPS = ['dialect', 'currency', 'erates', 'persona', 'accounts', 'learns'];
var ONBOARD_STEPS = FULL_ONBOARD_STEPS;
var onboard = null;
var PITCH_SIM_EXAMPLES = [
{
phrase: 'سلفت خالد 2,000 ريال لموعد الأسبوع الجاي',
kind: 'دين لنا (سلفة مستردة)',
debit: 'ديون لنا — خالد (+2,000)',
credit: 'الصندوق (-2,000)',
extra: '⏰ تذكير آلي بموعد السداد بعد 7 أيام'
},
{
phrase: 'دفعت للمقاول سعد 12,000 ريال من البنك',
kind: 'مصروف / دفعة مقاول',
debit: 'مستحقات مقاولي الباطن — سعد (+12,000)',
credit: 'البنك (-12,000)',
extra: '🧾 يظهر فوراً في كشف حساب سعد PDF'
},
{
phrase: 'شريت بضاعة بـ 500 دولار كاش',
kind: 'مشتريات متعددة العملات',
debit: 'مخزون البضاعة (+500 $)',
credit: 'صندوق العملات الأجنبية (-500 $)',
extra: '💱 يُحفظ بالدولار ويُقيّم بالعملة الأساسية تلقائياً'
},
{
phrase: 'قبضت إيجار الشقة 1,800 ريال كاش',
kind: 'إيراد إيجار عقاري',
debit: 'الصندوق (+1,800)',
credit: 'إيرادات إيجارات وحدات (+1,800)',
extra: '📊 يرفع السيولة المتاحة وصافي الدخل فوراً'
}
];
function activeOnboardSteps() {
var base = (onboard && onboard.essentialOnly) ? ESSENTIAL_ONBOARD_STEPS : FULL_ONBOARD_STEPS;
var hasMultiCur = E.listCurrencies().length > 1;
var licensedMulti = !(onboard && onboard.essentialOnly) || !!(E.planAllows && E.planAllows('multiCurrency').ok);
return base.filter(function (s) {
if (s === 'erates') return hasMultiCur && licensedMulti;
return true;
});
}
function openBotTour() {
var p = activePersonaDef();
var pExamples = (p && Array.isArray(p.examples)) ? p.examples : [];
var rawPool = pExamples.concat(E.EXAMPLE_PHRASES || []);
var seen = {};
var examples = [];
rawPool.forEach(function (item) {
var converted = E.exampleInMainCurrency ? E.exampleInMainCurrency(item) : item;
if (!converted || seen[converted] || examples.length >= 10) return;
seen[converted] = true;
examples.push(converted);
});
if (!examples.length) return;
var pBadge = p ? '<span class="badge ok">' + esc(p.title) + '</span>' : '';
var body = '<div id="botTour" style="display:flex;flex-direction:column;gap:10px">' +
'<div style="display:flex;align-items:center;justify-content:space-between">' +
'<span class="muted" style="font-size:calc(12px * var(--font-scale, 1))">المثال <b id="botTourCounter">1</b> من ' + examples.length + '</span>' +
pBadge +
'</div>' +
'<div style="border:1px solid var(--line-strong);border-radius:12px;padding:10px 12px;background:var(--sand)">' +
'<div style="font-size:calc(11px * var(--font-scale, 1));color:var(--muted);margin-bottom:4px">🎙️ ما تقوله أو تكتبه باللهجة العامية:</div>' +
'<div id="botTourInput" style="min-height:24px;font-size:calc(14.5px * var(--font-scale, 1));font-weight:800;color:var(--ink);white-space:pre-wrap"></div>' +
'</div>' +
'<div style="border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--paper)" id="botTourResult"></div>' +
'<button type="button" class="btn gold small" data-action="bot-tour-try" style="width:100%">⚡ جرّب هذه الجملة في المحادثة</button>' +
'<div style="display:flex;gap:8px;justify-content:space-between">' +
'<button class="btn ghost small" data-action="bot-tour-prev">السابق</button>' +
'<button class="btn ghost small" data-action="bot-tour-auto">▶ تشغيل تلقائي</button>' +
'<button class="btn primary small" data-action="bot-tour-next">التالي</button>' +
'</div>' +
'</div>';
openSheet('جولة تفاعلية في البوت الذكي', body);
if (botTour && botTour.typingTimer) clearInterval(botTour.typingTimer);
if (botTour && botTour.autoTimer) clearTimeout(botTour.autoTimer);
botTour = { examples: examples, index: 0, typingTimer: null, autoTimer: null, auto: false, charIndex: 0 };
renderBotTourStep();
}
function renderBotTourStep() {
if (!botTour) return;
var bt = botTour;
var ex = bt.examples[bt.index];
var counter = document.getElementById('botTourCounter');
if (counter) counter.textContent = (bt.index + 1);
var inputEl = document.getElementById('botTourInput');
var resultEl = document.getElementById('botTourResult');
if (inputEl) inputEl.textContent = '';
if (resultEl) resultEl.innerHTML = '<span class="muted" style="font-size:calc(12px * var(--font-scale, 1))">جاري تحليل الجملة…</span>';
bt.charIndex = 0;
if (bt.typingTimer) clearInterval(bt.typingTimer);
bt.typingTimer = setInterval(function () {
var inp = document.getElementById('botTourInput');
if (!inp) { if (bt.typingTimer) { clearInterval(bt.typingTimer); bt.typingTimer = null; } return; }
if (bt.charIndex < ex.length) {
bt.charIndex++;
inp.textContent = ex.slice(0, bt.charIndex);
} else {
if (bt.typingTimer) { clearInterval(bt.typingTimer); bt.typingTimer = null; }
showBotTourResult(ex);
}
}, 80);
}
function showBotTourResult(ex) {
if (!botTour) return;
var bt = botTour;
var resultEl = document.getElementById('botTourResult');
if (!resultEl) return;
var intent = null;
try { intent = E.parseIntent(ex); } catch (e) { intent = null; }
var meta = intent && intent.kind ? kindMeta(intent.kind) : null;
var html = '<div style="font-size:calc(11px * var(--font-scale, 1));color:var(--muted);margin-bottom:6px">⚡ تحويل المحرك المحاسبي المزدوج:</div>';
if (intent && intent.kind && intent.kind !== 'query' && intent.kind !== 'help') {
var previewDraft = null;
try { previewDraft = E.buildDraft(intent); } catch (e) { previewDraft = null; }
var amtShown = intent.amountMinor
? money(intent.amountMinor, intent.currency || E.BASE)
: (previewDraft && previewDraft.totalBase ? money(previewDraft.totalBase, E.BASE) : '');
html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
'<b>' + (meta ? esc(meta.glyph) + ' ' + esc(meta.label) : esc(intent.kind)) + (intent.counterparty ? ' • ' + esc(intent.counterparty) : '') + '</b>' +
(amtShown ? '<span class="amount" style="font-weight:800;color:var(--emerald)">' + amtShown + '</span>' : '') +
'</div>';
if (previewDraft && Array.isArray(previewDraft.lines) && previewDraft.lines.length) {
html += '<div style="display:flex;flex-direction:column;gap:4px;border-top:1px dashed var(--line);padding-top:6px">';
previewDraft.lines.forEach(function (l) {
var isDeb = (Number(l.debit) || Number(l.debitBase) || 0) > 0;
var lineAmt = isDeb ? (l.debit || l.debitBase) : (l.credit || l.creditBase);
var lineCur = l.currency || E.BASE;
html += '<div style="display:flex;align-items:center;justify-content:space-between;font-size:calc(12px * var(--font-scale, 1))">' +
'<span><span class="badge ' + (isDeb ? 'ok' : 'soon') + '" style="margin-inline-end:6px">' + (isDeb ? 'مدين' : 'دائن') + '</span>' + esc(accountName(l.accountId)) + (l.counterparty ? ' (' + esc(l.counterparty) + ')' : '') + '</span>' +
'<span class="amount">' + money(lineAmt, lineCur) + '</span>' +
'</div>';
});
html += '</div>';
} else if (intent.accountId) {
html += '<div class="muted" style="font-size:calc(12px * var(--font-scale, 1));margin-top:4px">الحساب: <b>' + esc(accountName(intent.accountId)) + '</b></div>';
}
} else if (intent && (intent.kind === 'query' || intent.query || /كم|رصيد|حلل|ملخص|كشف/.test(ex))) {
var a = E.computeAnalysis();
html += '<div><b style="color:var(--emerald)">📊 استعلام وتحليل مالي فوري</b></div>' +
'<div class="muted" style="font-size:calc(12px * var(--font-scale, 1));margin-top:4px">يجيب البوت فوراً من دفاترك — السيولة المتاحة: <span class="amount"><b>' + money(a.liquidity) + '</b></span> • صافي الثروة: <span class="amount"><b>' + money(a.netWorth) + '</b></span></div>';
} else {
html += '<div class="muted" style="font-size:calc(12px * var(--font-scale, 1))">جملة حوارية أو استعلام عام — يتفاعل معها المحاسب الذكي فوراً.</div>';
}
resultEl.innerHTML = html;
if (bt.auto) {
if (bt.autoTimer) clearTimeout(bt.autoTimer);
bt.autoTimer = setTimeout(function () {
if (!botTour || !botTour.auto) return;
botTour.index = (botTour.index + 1) % botTour.examples.length;
renderBotTourStep();
}, 2600);
}
}
function openOnboarding() {
var st = S();
var p = E.getProfile();
var bank = E.getAccount('bank');
var curPersona = (E.getPersona && E.getPersona()) || 'student';
var personaDef = (E.PERSONAS && E.PERSONAS[curPersona]) || { settings: { simpleMode: true } };
onboard = {
step: 0,
essentialOnly: false,
locked: E.mainCurrencyLocked(),
expandedPersona: null,
persona: curPersona,
simpleMode: st.settings.persona ? !!st.settings.simpleMode : !!personaDef.settings.simpleMode,
profile: { name: p.name, business: p.business, phone: p.phone, email: p.email, photo: p.photo },
currency: E.BASE,
_currencySuggested: false,
zakatAmount: '',
zakatTouched: false,
langCode: currentLanguage().code,
dialect: currentDialectRank(),
dialectQuery: '',
moreLangsOpen: false,
moreDialectsOpen: false,
simIndex: 0,
bankName: bank ? bank.name : 'البنك',
cashOpening: '',
bankOpening: '',
theme: st.settings.theme || 'light',
appLock: !!st.settings.appLock,
hideAmounts: !!st.settings.hideAmounts,
reminders: true,
autoTts: !!st.settings.autoTts
};
ONBOARD_STEPS = activeOnboardSteps();
if (!onboard.locked) {
try {
var _obLoc = onboardLocaleCode();
var _obDlMeta = dialectMetaOf(_obLoc);
var _obSug = E.topCurrenciesForDialect ? E.topCurrenciesForDialect(_obDlMeta.code) : [];
if (_obSug && _obSug.length) { onboard.currency = _obSug[0].code; onboard._currencySuggested = true; }
} catch (e) {}
}
var root = document.getElementById('onboard');
if (!root) {
root = document.createElement('div');
root.id = 'onboard';
root.className = 'onboard';
root.setAttribute('role', 'dialog');
root.setAttribute('aria-modal', 'true');
root.setAttribute('aria-label', 'مرحبًا بك في موني كود');
document.body.appendChild(root);
root.addEventListener('click', onboardClick);
root.addEventListener('input', onboardInput);
}
root.hidden = false;
drawOnboarding();
}
function onboardLangObj() {
var code = (onboard && onboard.langCode) || currentLanguage().code || DEFAULT_LANGUAGE;
return LANGUAGES.filter(function (l) { return l.code === code; })[0] || LANGUAGES[0];
}
function onboardLocaleCode() {
var lang = onboardLangObj();
var rank = (onboard && onboard.dialect) || 1;
var pair = lang.dialects[rank - 1] || lang.dialects[0];
return pair ? pair[1] : 'ar-SA';
}
function onboardArt(step) {
var svg = function (body) { return '<svg class="ob-art" viewBox="0 0 240 150" direction="ltr" aria-hidden="true">' + body + '</svg>'; };
if (step === 'welcome') {
return svg(
'<g class="ob-float"><rect x="18" y="22" width="92" height="34" rx="14" class="ob-bubble"/>' +
'<text x="64" y="44" class="ob-txt" text-anchor="middle">دفعت 50 قهوة</text></g>' +
'<path d="M112 48 C130 48 128 78 146 78" class="ob-draw"/>' +
'<g class="ob-pop"><rect x="138" y="62" width="88" height="62" rx="12" class="ob-card"/>' +
'<rect x="148" y="74" width="16" height="9" rx="4" class="ob-tag"/>' +
'<text x="216" y="82" class="ob-small" text-anchor="end">مصروف</text>' +
'<line x1="148" y1="94" x2="216" y2="94" class="ob-line"/>' +
'<text x="216" y="112" class="ob-num" text-anchor="end">50</text></g>' +
'<circle cx="40" cy="104" r="11" class="ob-coin ob-c1"/><circle cx="72" cy="122" r="8" class="ob-coin ob-c2"/><circle cx="100" cy="100" r="6" class="ob-coin ob-c3"/>');
}
if (step === 'pitch') {
return svg(
'<g class="ob-float"><rect x="14" y="18" width="104" height="34" rx="14" class="ob-bubble"/>' +
'<text x="66" y="39" class="ob-txt" text-anchor="middle">🎙️ سلفت خالد 2000</text></g>' +
'<path d="M118 36 C136 36 130 62 146 62" class="ob-draw"/>' +
'<g class="ob-pop"><rect x="68" y="58" width="154" height="72" rx="14" class="ob-card"/>' +
'<rect x="78" y="68" width="46" height="14" rx="6" class="ob-tag"/>' +
'<text x="101" y="78" style="fill:#fff;font:700 8.5px Tahoma,sans-serif" text-anchor="middle">قيد متوازن ✓</text>' +
'<text x="212" y="79" class="ob-small" text-anchor="end">مدين = دائن</text>' +
'<line x1="78" y1="88" x2="212" y2="88" class="ob-line"/>' +
'<text x="212" y="104" class="ob-small" text-anchor="end">من حـ/ ديون لنا (+2,000)</text>' +
'<text x="212" y="120" class="ob-small" text-anchor="end">إلى حـ/ الصندوق (-2,000)</text></g>' +
'<circle cx="34" cy="96" r="12" class="ob-coin ob-c1"/><circle cx="52" cy="122" r="8" class="ob-coin ob-c2"/>');
}
if (step === 'erates') {
return svg(
'<g class="ob-stack1"><circle cx="74" cy="76" r="34" class="ob-bigcoin"/><text x="74" y="86" class="ob-sym" style="font-size:26px" text-anchor="middle">$</text></g>' +
'<path d="M112 64 H132 M126 58 L134 64 L126 70 M132 88 H112 M118 82 L110 88 L118 94" class="ob-draw"/>' +
'<g class="ob-stack2"><circle cx="168" cy="76" r="34" class="ob-bigcoin"/><text x="168" y="85" class="ob-sym" style="font-size:22px" text-anchor="middle">' + esc(E.BASE) + '</text></g>' +
'<circle cx="42" cy="34" r="7" class="ob-coin ob-c1"/><circle cx="204" cy="116" r="9" class="ob-coin ob-c2"/>');
}
if (step === 'persona') {
return svg(
'<g class="ob-stack1"><rect x="24" y="28" width="60" height="94" rx="12" class="ob-card"/><circle cx="54" cy="56" r="12" class="ob-avatar"/><rect x="34" y="80" width="40" height="8" rx="4" class="ob-tag"/><text x="54" y="106" class="ob-small" text-anchor="middle">طالب</text></g>' +
'<g class="ob-stack2"><rect x="90" y="20" width="60" height="102" rx="12" class="ob-card"/><circle cx="120" cy="50" r="14" class="ob-coin"/><rect x="100" y="76" width="40" height="8" rx="4" class="ob-tag"/><text x="120" y="104" class="ob-small" text-anchor="middle">تاجر</text></g>' +
'<g class="ob-stack3"><rect x="156" y="28" width="60" height="94" rx="12" class="ob-card"/><path d="M168 68 L180 56 L190 62 L204 44" class="ob-draw"/><rect x="166" y="80" width="40" height="8" rx="4" class="ob-tag"/><text x="186" y="106" class="ob-small" text-anchor="middle">مستثمر</text></g>');
}
if (step === 'profile') {
var photo = onboard.profile.photo;
return '<button type="button" class="ob-art-btn" data-ob="photo" aria-label="' + (photo ? 'تغيير صورتك' : 'أضف صورتك') + '">' + svg(
'<g class="ob-pop"><rect x="45" y="20" width="150" height="104" rx="16" class="ob-card"/>' +
(photo
? '<clipPath id="obPhotoClip"><circle cx="120" cy="56" r="24"/></clipPath>' +
'<image href="' + esc(photo) + '" x="96" y="32" width="48" height="48" clip-path="url(#obPhotoClip)" preserveAspectRatio="xMidYMid slice"/>' +
'<circle cx="120" cy="56" r="24" class="ob-photo-ring"/>'
: '<circle cx="120" cy="58" r="20" class="ob-avatar"/><circle cx="120" cy="52" r="8" class="ob-face"/>' +
'<path d="M106 72 C110 62 130 62 134 72" class="ob-face-line"/>' +
'<circle cx="136" cy="72" r="8" class="ob-plus-dot"/><path d="M136 68V76M132 72H140" class="ob-plus"/>') +
'<rect x="80" y="90" width="80" height="8" rx="4" class="ob-tag ob-grow"/>' +
'<rect x="95" y="104" width="50" height="6" rx="3" class="ob-line-f ob-grow2"/></g>') + '</button>';
}
if (step === 'learns') {
return svg(
'<rect x="64" y="96" width="22" height="34" rx="5" class="ob-bar ob-b1"/>' +
'<rect x="96" y="76" width="22" height="54" rx="5" class="ob-bar ob-b2"/>' +
'<rect x="128" y="54" width="22" height="76" rx="5" class="ob-bar ob-b3"/>' +
'<rect x="160" y="30" width="22" height="100" rx="5" class="ob-bar ob-b4"/>' +
'<path d="M58 84 L106 62 L138 42 L176 16" class="ob-draw"/>' +
'<path d="M196 26 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" class="ob-star ob-s1"/>' +
'<path d="M44 40 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" class="ob-star ob-s2"/>' +
'<path d="M206 100 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" class="ob-star ob-s3"/>');
}
if (step === 'dialect') {
return svg(
'<g class="ob-pop"><rect x="102" y="22" width="36" height="62" rx="18" class="ob-card"/>' +
'<path d="M88 66 A32 32 0 0 0 152 66" class="ob-mic-arc"/><path d="M120 98 V116 M104 118 H136" class="ob-mic-arc"/></g>' +
'<path d="M70 52 Q62 64 70 76" class="ob-wave ob-w1"/><path d="M54 42 Q40 64 54 86" class="ob-wave ob-w2"/>' +
'<path d="M170 52 Q178 64 170 76" class="ob-wave ob-w1"/><path d="M186 42 Q200 64 186 86" class="ob-wave ob-w2"/>');
}
if (step === 'currency') {
var cur = E.listCurrencies().filter(function (c) { return c.code === onboard.currency; })[0];
var sym = cur ? cur.symbol : onboard.currency;
return svg(
'<g class="ob-spin"><circle cx="120" cy="72" r="46" class="ob-bigcoin"/><circle cx="120" cy="72" r="36" class="ob-bigcoin-in"/>' +
'<text x="120" y="86" class="ob-sym" text-anchor="middle">' + esc(sym) + '</text></g>' +
'<circle cx="46" cy="40" r="9" class="ob-coin ob-c1"/><circle cx="196" cy="112" r="11" class="ob-coin ob-c2"/><circle cx="200" cy="34" r="6" class="ob-coin ob-c3"/>');
}
if (step === 'zakat') {
return svg(
'<g class="ob-spin"><circle cx="120" cy="72" r="46" class="ob-bigcoin"/><circle cx="120" cy="72" r="36" class="ob-bigcoin-in"/>' +
'<text x="120" y="80" class="ob-sym" text-anchor="middle">2.5%</text></g>' +
'<path d="M40 118 H200" class="ob-line"/><circle cx="60" cy="34" r="7" class="ob-coin ob-c1"/><circle cx="184" cy="110" r="9" class="ob-coin ob-c2"/>');
}
if (step === 'accounts') {
return svg(
'<g class="ob-stack1"><rect x="40" y="28" width="160" height="32" rx="10" class="ob-card"/><text x="188" y="49" class="ob-small" text-anchor="end">الصندوق</text><rect x="52" y="38" width="36" height="10" rx="5" class="ob-tag"/></g>' +
'<g class="ob-stack2"><rect x="40" y="66" width="160" height="32" rx="10" class="ob-card"/><text x="188" y="87" class="ob-small" text-anchor="end">البنك</text><rect x="52" y="76" width="48" height="10" rx="5" class="ob-tag"/></g>' +
'<g class="ob-stack3"><rect x="40" y="104" width="160" height="32" rx="10" class="ob-card"/><text x="188" y="125" class="ob-small" text-anchor="end">ديون لنا</text><rect x="52" y="114" width="28" height="10" rx="5" class="ob-tag"/></g>');
}
return svg(
'<g class="ob-pop"><path d="M120 18 L168 36 V72 C168 102 146 124 120 134 C94 124 72 102 72 72 V36 Z" class="ob-shield"/>' +
'<rect x="104" y="70" width="32" height="26" rx="5" class="ob-lock"/><path d="M110 70 V62 A10 10 0 0 1 130 62 V70" class="ob-lock-arc"/></g>' +
'<circle cx="50" cy="50" r="7" class="ob-coin ob-c1"/><circle cx="192" cy="104" r="9" class="ob-coin ob-c2"/>');
}
function onboardSwitch(key, title, sub) {
return '<div class="ob-switch-row"><div><b>' + title + '</b><span>' + sub + '</span></div>' +
'<button type="button" class="switch" role="switch" aria-checked="' + (onboard[key] ? 'true' : 'false') + '" aria-label="' + esc(title) + '" data-ob-toggle="' + key + '"></button></div>';
}
var WELCOME_SHOWCASE_DIALECTS = [
{ lang: 'ar', idx: 1, label: 'العربية العامة', loc: 'ar-001' },
{ lang: 'ar', idx: 2, label: 'الخليجية', loc: 'ar-SA' },
{ lang: 'ar', idx: 3, label: 'اليمنية', loc: 'ar-YE' },
{ lang: 'ar', idx: 4, label: 'المصرية', loc: 'ar-EG' },
{ lang: 'ar', idx: 5, label: 'الجزائرية', loc: 'ar-DZ' },
{ lang: 'ar', idx: 6, label: 'المغربية', loc: 'ar-MA' },
{ lang: 'en', idx: 1, label: 'English', loc: 'en-US' },
{ lang: 'fr', idx: 1, label: 'Français', loc: 'fr-FR' },
{ lang: 'es', idx: 1, label: 'Español', loc: 'es-MX' },
{ lang: 'hi', idx: 1, label: 'हिन्दी', loc: 'hi-IN' },
{ lang: 'zh', idx: 1, label: '中文', loc: 'zh-CN' }
];
var welcomeHeroTimer = null;
var welcomeHeroIndex = 0;
function stopWelcomeHeroTimer() {
if (welcomeHeroTimer) {
clearInterval(welcomeHeroTimer);
welcomeHeroTimer = null;
}
}
function startWelcomeHeroTimer() {
stopWelcomeHeroTimer();
welcomeHeroTimer = setInterval(function () {
if (!onboard || ONBOARD_STEPS[onboard.step] !== 'welcome') {
stopWelcomeHeroTimer();
return;
}
var h1 = document.getElementById('obWelcomeHeroH1');
if (!h1) { stopWelcomeHeroTimer(); return; }
welcomeHeroIndex = (welcomeHeroIndex + 1) % WELCOME_SHOWCASE_DIALECTS.length;
var item = WELCOME_SHOWCASE_DIALECTS[welcomeHeroIndex];
var meta = dialectMetaOf(item.loc);
h1.classList.remove('ob-hero-anim');
void h1.offsetWidth;
h1.innerHTML = '<span class="ob-hero-flag">' + meta.flag + '</span> <span>' + esc(meta.hero || 'أهلًا بك في موني كود') + '</span>';
h1.classList.add('ob-hero-anim');
var bannerFlag = document.getElementById('obGreetFlag');
var bannerGreet = document.getElementById('obGreetMain');
var bannerSample = document.getElementById('obGreetSample');
if (bannerFlag) bannerFlag.textContent = meta.flag;
if (bannerGreet) bannerGreet.textContent = meta.greeting;
if (bannerSample) bannerSample.textContent = 'مثال بلهجتك (' + item.label + '): ' + meta.sample;
var pills = document.querySelectorAll('[data-ob-welcome-dl]');
pills.forEach(function (p, idx) {
p.classList.toggle('on', idx === welcomeHeroIndex);
});
}, 2200);
}
function renderObDialectGrid() {
var lang = onboardLangObj();
var q = String((onboard && onboard.dialectQuery) || '').trim().toLowerCase();
var items = lang.dialects.map(function (dl, i) {
var meta = dialectMetaOf(dl[1]);
return { idx: i + 1, name: dl[0], locale: dl[1], meta: meta };
}).filter(function (item) {
if (!q) return true;
return item.name.toLowerCase().indexOf(q) >= 0 ||
item.meta.code.toLowerCase().indexOf(q) >= 0 ||
item.meta.greeting.toLowerCase().indexOf(q) >= 0;
});
if (!items.length) {
return '<div class="ob-note" style="padding:10px;text-align:center">لا توجد لهجة مطابقة في هذه اللغة — افتح قائمة «المزيد من اللهجات» بالأسفل لطلب إضافتها.</div>';
}
return items.map(function (item) {
var active = item.idx === onboard.dialect;
return '<button type="button" class="ob-cur ob-dialect-card' + (active ? ' on' : '') + '" data-ob-dialect="' + item.idx + '">' +
'<div class="ob-dl-top"><b>' + esc(item.name) + '</b><span class="ob-dl-code">' + esc(item.locale.split('-')[1] === '001' ? 'AR' : (item.locale.split('-')[1] || '')) + '</span></div>' +
'<small class="ob-dl-greet">' + esc(item.meta.greeting) + '</small>' +
'</button>';
}).join('');
}
function onboardBody(step) {
if (step === 'welcome') {
var curLoc = onboardLocaleCode();
var curMeta = dialectMetaOf(curLoc);
return '<h1 id="obWelcomeHeroH1" class="ob-hero-anim"><span class="ob-hero-flag">' + curMeta.flag + '</span> <span>' + esc(curMeta.hero || 'أهلًا بك في موني كود') + '</span></h1><p class="ob-lead">محاسبك الشخصي في جيبك: تكتب كما تتكلم، ويرتّب لك الحسابات.</p>' +
'<div class="ob-dialect-showcase" aria-label="الترحيب بجميع اللهجات">' +
'<div class="ob-greet-banner">' +
'<span id="obGreetFlag" class="ob-greet-flag">' + curMeta.flag + '</span>' +
'<div class="ob-greet-text"><b id="obGreetMain">' + esc(curMeta.greeting) + '</b><span id="obGreetSample">مثال بلهجتك: ' + esc(curMeta.sample) + '</span></div>' +
'</div>' +
'<div class="ob-greet-pills">' + WELCOME_SHOWCASE_DIALECTS.map(function (d) {
var m = dialectMetaOf(d.loc);
var isOn = onboard.langCode === d.lang && onboard.dialect === d.idx;
return '<button type="button" class="ob-greet-pill' + (isOn ? ' on' : '') + '" data-ob-welcome-dl="' + d.lang + ':' + d.idx + '">' +
'<span>' + m.flag + '</span><b>' + esc(d.label) + '</b></button>';
}).join('') + '</div>' +
'</div>' +
'<ul class="ob-points">' +
'<li><b>جملة واحدة تكفي</b><span>اكتب أو قل «دفعت 50 قهوة» فيصير قيدًا محاسبيًا مزدوجًا متوازنًا.</span></li>' +
'<li><b>حصّل ديونك وطابق حساباتك بلمسة</b><span>ينبّهك بمواعيد السداد، يُصدر كشوف حسابات PDF فورية، ويطابق الدفاتر مع الطرف الآخر عبر QR أو NFC بلا إنترنت!</span></li>' +
'<li><b>صورة مالية كاملة</b><span>سيولتك وديونك ومواعيدك في لوحة واحدة، مع تنبيه قبل أن يضيق المال.</span></li>' +
'<li><b>بياناتك لك وحدك</b><span>كل شيء محفوظ على هاتفك ولا يُرسل إلى أي جهة، ويعمل بلا إنترنت.</span></li>' +
'<li><b>ابحث في كل شيء</b><span>من زر البحث أعلى الشاشة تجد أي قيد أو حساب أو موعد.</span></li>' +
'</ul>' +
'<div style="margin-top:12px;text-align:center"><button type="button" class="btn ghost small" data-ob="restore-backup" style="width:100%">📥 لدي نسخة احتياطية سابقة — استعادة دفاتري</button></div>';
}
if (step === 'pitch') {
var simIdx = (onboard.simIndex || 0) % PITCH_SIM_EXAMPLES.length;
var sim = PITCH_SIM_EXAMPLES[simIdx];
return '<div class="ob-pitch-badge">✨ تقنية سيادية حصرية • 100% بدون إنترنت</div>' +
'<h1>أول كاتب حسابات بالذكاء الاصطناعي في العالم</h1>' +
'<p class="ob-lead">تكلّم بلهجتك كما في السوق والعمل، وتتحول جملتك في ثانية إلى قيد محاسبي مزدوج متوازن دون تعبئة حقول أو جداول معقدة!</p>' +
'<div class="ob-sim-box">' +
'<div class="ob-sim-title">جرّب بنفسك الآن — اضغط على أي جملة عامية:</div>' +
'<div class="ob-sim-chips">' + PITCH_SIM_EXAMPLES.map(function (ex, idx) {
return '<button type="button" class="ob-sim-chip' + (idx === simIdx ? ' on' : '') + '" data-ob-sim="' + idx + '">«' + esc(ex.phrase) + '»</button>';
}).join('') + '</div>' +
'<div class="ob-sim-result">' +
'<div class="ob-sim-head"><span>⚡ القيد المزدوج المتكون في ثانية:</span><span class="ob-sim-tag">' + esc(sim.kind) + '</span></div>' +
'<div class="ob-sim-line"><span>الطرف المدين (من حـ/)</span><b>' + esc(sim.debit) + '</b></div>' +
'<div class="ob-sim-line"><span>الطرف الدائن (إلى حـ/)</span><b>' + esc(sim.credit) + '</b></div>' +
'<div class="ob-sim-extra">' + esc(sim.extra) + '</div>' +
'</div>' +
'</div>';
}
if (step === 'persona') {
var personas = E.PERSONAS || {};
var keys = ['merchant', 'freelancer', 'logistics', 'landlord', 'contractor', 'student', 'employee', 'investor'];
return '<h1>كيف ستستخدم موني كود؟</h1><p class="ob-lead">اختر نشاطك أو شخصيتك ليُبنى عليها دليل حساباتك وإعداداتك تلقائيًا.</p>' +
'<div class="ob-personas">' + keys.map(function (k) {
var p = personas[k];
if (!p) return '';
var accNames = (p.accounts || []).map(function (a) { return a.name; }).join(' • ');
var modeNote = p.settings && p.settings.simpleMode ? 'الوضع البسيط مفعّل' : 'الوضع المحاسبي الكامل';
var sampleEx = p.examples && p.examples[0] ? 'مثال: «' + p.examples[0] + '»' : '';
var isChosen = onboard.persona === k;
var isExpanded = true;
return '<button type="button" class="ob-persona' + (isChosen ? ' on' : '') + '" data-ob-persona="' + esc(k) + '" aria-pressed="' + isChosen + '">' +
'<div style="display:flex;align-items:center;justify-content:space-between;width:100%"><b>' + (isChosen ? '✓ ' : '') + esc(p.title) + '</b><small style="margin:0">' + esc(modeNote) + '</small></div>' +
(isExpanded ? '<span>' + esc(p.subtitle) + '</span><small>الحسابات: ' + esc(accNames) + '</small>' + (sampleEx ? '<small style="background:rgba(255,255,255,0.14)">' + esc(sampleEx) + '</small>' : '') : '') +
'</button>';
}).join('') + '</div>';
}
if (step === 'profile') {
var f = function (key, label, type, ph) {
return '<label class="ob-field"><span>' + label + '</span><input data-ob-field="' + key + '" type="' + type + '" value="' + esc(onboard.profile[key]) + '" placeholder="' + esc(ph) + '" autocomplete="off" /></label>';
};
return '<h1>عرّف سجلاتك بك</h1><p class="ob-lead">تظهر بياناتك في الإعدادات وكشوف الحسابات، ولا تغادر هاتفك.</p>' +
'<div class="ob-photo-actions"><button type="button" data-ob="photo">' + (onboard.profile.photo ? 'تغيير صورتك' : '＋ أضف صورتك') + '</button>' +
(onboard.profile.photo ? '<button type="button" data-ob="photo-remove">إزالة الصورة</button>' : '') + '</div>' +
f('name', 'اسمك', 'text', 'مثال: طه') +
f('business', 'اسم نشاطك (اختياري)', 'text', 'مثال: متجر الأمل') +
'<div class="ob-pair">' + f('phone', 'الهاتف (اختياري)', 'tel', '05xxxxxxxx') + f('email', 'البريد (اختياري)', 'email', 'name@mail.com') + '</div>';
}
if (step === 'dialect') {
var curLang = onboardLangObj();
var reqStats = getLocaleRequestStats();
var unavDialectsSorted = UNAVAILABLE_DIALECTS.slice().sort(function (a, b) {
var am = a.lang === curLang.code ? 0 : 1;
var bm = b.lang === curLang.code ? 0 : 1;
return am - bm;
});
return '<h1>لهجتك ولغة الصوت</h1><p class="ob-lead">بها يتعرف البوت على كلامك حين تتحدث إليه، ويقترح عملاتك، ويقرأ لك ردوده.</p>' +
'<div class="ob-note" style="margin-bottom:4px;font-weight:700;color:rgba(255,255,255,0.88)">1. اختر اللغة:</div>' +
'<div class="ob-lang-tabs" role="tablist" aria-label="اللغات المتاحة">' + LANGUAGES.map(function (l) {
var on = l.code === curLang.code;
return '<button type="button" class="ob-lang-tab' + (on ? ' on' : '') + '" data-ob-lang="' + esc(l.code) + '" aria-selected="' + on + '">' + esc(l.name) + '</button>';
}).join('') +
'<button type="button" class="ob-lang-tab ob-lang-more' + (onboard.moreLangsOpen ? ' on' : '') + '" data-ob="toggle-more-langs" aria-expanded="' + (onboard.moreLangsOpen ? 'true' : 'false') + '">＋ المزيد من اللغات (' + UNAVAILABLE_LANGUAGES.length + ') ' + (onboard.moreLangsOpen ? '▴' : '▾') + '</button>' +
'</div>' +
(onboard.moreLangsOpen
? '<div class="ob-unavailable-box" style="margin-bottom:10px">' +
'<div class="ob-unavailable-banner">🌐 اللغات التالية غير متوفرة حالياً — انقر على أي لغة لطلب إضافتها عبر <b>واتساب الأعمال</b> (بعد إذنك) لإحصاء اللغات الأكثر طلباً:</div>' +
'<div class="ob-unavailable-list">' + UNAVAILABLE_LANGUAGES.map(function (u) {
var cnt = Number(reqStats['lang:' + u.code]) || 0;
return '<button type="button" class="ob-unavailable-item" data-ob-wa-lang="' + esc(u.code) + '" data-name="' + esc(u.name) + '" data-flag="' + esc(u.flag) + '">' +
'<div class="ob-unav-main"><b>' + esc(u.name) + '</b>' + (cnt ? '<span class="ob-cur-badge">طُلبت ' + cnt + '</span>' : '') + '<span class="ob-dl-code">' + u.flag + '</span></div>' +
'<small>هذه اللغة غير متوفرة حالياً — انقر عليها لإرسال طلب لواتساب الأعمال بعد إذنك لإحصاء الأكثر طلباً</small>' +
'</button>';
}).join('') + '</div>' +
'</div>'
: '') +
'<div class="ob-note" style="margin:6px 0 4px;font-weight:700;color:rgba(255,255,255,0.88)">2. اختر اللهجة (' + esc(curLang.name) + '):</div>' +
'<label class="ob-field" style="margin-bottom:8px"><input data-ob-field="dialectQuery" type="search" value="' + esc(onboard.dialectQuery || '') + '" placeholder="ابحث عن لهجة (مثل: اليمنية، الخليجية، المصرية)…" autocomplete="off" /></label>' +
'<div id="obDialectList" class="ob-currencies ob-dialect-grid">' + renderObDialectGrid() + '</div>' +
'<div class="ob-more-dialects-wrap">' +
'<button type="button" class="ob-more-toggle" data-ob="toggle-more-dialects" aria-expanded="' + (onboard.moreDialectsOpen ? 'true' : 'false') + '">' +
'<span>＋ المزيد من اللهجات غير المتوفرة حالياً (' + unavDialectsSorted.length + ')</span><span>' + (onboard.moreDialectsOpen ? '▴' : '▾') + '</span>' +
'</button>' +
(onboard.moreDialectsOpen
? '<div class="ob-unavailable-box">' +
'<div class="ob-unavailable-banner">💬 اللهجات التالية غير متوفرة حالياً — انقر على أي لهجة لطلب إضافتها عبر <b>واتساب الأعمال</b> (بعد إذنك) لإحصاء اللهجات الأكثر طلباً:</div>' +
'<div class="ob-unavailable-list">' + unavDialectsSorted.map(function (u) {
var cntD = Number(reqStats['dialect:' + u.code]) || 0;
return '<button type="button" class="ob-unavailable-item" data-ob-wa-dialect="' + esc(u.code) + '" data-name="' + esc(u.name) + '" data-flag="' + esc(u.flag) + '">' +
'<div class="ob-unav-main"><b>' + esc(u.name) + '</b>' + (cntD ? '<span class="ob-cur-badge">طُلبت ' + cntD + '</span>' : '') + '<span class="ob-dl-code">' + u.flag + '</span></div>' +
'<small>هذه اللهجة غير متاحة حالياً — انقر عليها لإرسال طلب لواتساب الأعمال بعد إذنك لإحصاء الأكثر طلباً</small>' +
'</button>';
}).join('') + '</div>' +
'</div>'
: '') +
'</div>' +
'<p class="ob-note">تغيّرها متى شئت من الإعدادات.</p>';
}
if (step === 'currency') {
var activeLoc = onboardLocaleCode();
var activeDlMeta = dialectMetaOf(activeLoc);
var suggested3 = E.topCurrenciesForDialect ? E.topCurrenciesForDialect(activeDlMeta.code) : [];
var suggestedCodes = suggested3.map(function (s) { return s.code; });
return '<h1>عملتك الأساسية</h1><p class="ob-lead">' + (onboard.locked
? 'دفاترك فيها قيود، فعملتها ثابتة: ' + esc(E.BASE) + '.'
: 'تُحسب بها دفاترك وتُعرض بها الأرقام. تختارها الآن، ولا تتغير بعد أول قيد.') + '</p>' +
(suggested3.length
? '<div class="ob-suggested-wrap">' +
'<div class="ob-suggested-title">' + activeDlMeta.flag + ' 3 عملات دارجة مقترحة حسب لهجتك:</div>' +
'<div class="ob-currencies ob-suggested-grid">' + suggested3.map(function (s) {
var isPicked = s.code === onboard.currency;
return '<button type="button" class="ob-cur ob-cur-suggested' + (isPicked ? ' on' : '') + '" data-ob-suggested-currency="' + esc(s.code) + '"' + (onboard.locked ? ' disabled' : '') + '>' +
'<span class="ob-cur-badge">★ مقترحة</span>' +
'<span class="ob-cur-sym">' + esc(s.symbol) + '</span><b>' + esc(s.name) + '</b><span>' + esc(s.code) + '</span>' +
'</button>';
}).join('') + '</div>' +
'</div>'
: '') +
'<div class="ob-note" style="margin:8px 0 6px;font-weight:700;color:rgba(255,255,255,0.85)">جميع العملات المتاحة:</div>' +
'<div class="ob-currencies">' + E.listCurrencies().slice().sort(function (a, b) {
var sa = suggestedCodes.indexOf(a.code) >= 0 ? 0 : 1;
var sb = suggestedCodes.indexOf(b.code) >= 0 ? 0 : 1;
if (sa !== sb) return sa - sb;
var fa = E.isFavoriteCurrency ? (E.isFavoriteCurrency(a.code) ? 0 : 1) : 1;
var fb = E.isFavoriteCurrency ? (E.isFavoriteCurrency(b.code) ? 0 : 1) : 1;
if (fa !== fb) return fa - fb;
return a.code === E.BASE ? -1 : (b.code === E.BASE ? 1 : a.name.localeCompare(b.name, 'ar'));
}).map(function (c) {
return '<button type="button" class="ob-cur' + (c.code === onboard.currency ? ' on' : '') + '" data-ob-currency="' + esc(c.code) + '"' + (onboard.locked ? ' disabled' : '') + '>' +
'<span class="ob-cur-sym">' + esc(c.symbol) + '</span><b>' + esc(c.name) + '</b><span>' + esc(c.code) + '</span>' +
(c.code !== E.BASE ? '<small style="font-size:calc(10px * var(--font-scale,1));opacity:.7">' + (E.getRate(c.code) ? obRateShown(c.code) : '') + '</small>' : '') +
'</button>';
}).join('') +
(onboard.locked ? '' : '<button type="button" class="ob-cur ob-cur-add" data-ob="add-currency"><span class="ob-cur-sym">＋</span><b>عملة أخرى</b><span>من عملات العالم</span></button>') +
'</div>' +
'<p class="ob-note">العملة الأساسية تبقى ثابتة بعد أول قيد، فاختر العملة التي تريد أن تُحسب بها دفاترك كلها. ويمكنك إضافة عملات أخرى لاحقًا من الإعدادات.</p>';
}
if (step === 'erates') {
var curList = E.listCurrencies();
var isSingle = curList.length <= 1;
if (isSingle) {
return '<h1>أسعار الصرف (E-Rates)</h1><p class="ob-lead">لديك عملة واحدة فقط (' + esc(E.BASE) + '). لا حاجة لضبط أسعار الصرف.</p>' +
'<div class="ob-note">يمكنك إضافة عملات لاحقاً من الإعدادات.</div>';
}
var ratesHtml = curList.filter(function (c) { return c.code !== E.BASE; }).map(function (c) {
var shown = obRateShown(c.code);
return '<div class="ob-rate-row" style="display:flex;align-items:center;gap:8px;margin:6px 0">' +
'<span style="flex:1">' + esc(c.name) + ' (' + esc(c.code) + ')</span>' +
'<input type="number" step="any" min="0" value="' + esc(shown) + '" data-shown="' + esc(shown) + '" data-ob-rate="' + esc(c.code) + '" style="width:100px;padding:6px 8px;border-radius:8px;border:1px solid var(--line-strong);background:var(--paper);color:var(--ink);font-size:calc(12px * var(--font-scale,1))" />' +
'<button type="button" class="btn ghost small" data-ob="remove-currency" data-code="' + esc(c.code) + '" title="حذف">✕</button>' +
'</div>';
}).join('');
return '<h1>أسعار الصرف (E-Rates)</h1><p class="ob-lead">حدد أسعار تحويل العملات مقابل عملتك الأساسية (' + esc(E.BASE) + '). يمكنك تعديلها لاحقاً من الإعدادات.</p>' +
ratesHtml +
'<div style="margin-top:8px"><button type="button" class="btn ghost small" data-ob="add-currency">＋ إضافة عملة</button></div>';
}
if (step === 'zakat') {
if (!onboard.zakatTouched && !onboard.zakatAmount) {
var openSum = (Number(String(onboard.cashOpening || '').replace(/,/g, '')) || 0) +
(Number(String(onboard.bankOpening || '').replace(/,/g, '')) || 0);
if (openSum > 0) onboard.zakatAmount = String(openSum);
}
var zCur = E.listCurrencies().filter(function (c) { return c.code === onboard.currency; })[0];
var zName = zCur ? zCur.name : onboard.currency;
var zSym = zCur ? zCur.symbol : onboard.currency;
var zNisab = E.fromBase(2125000, onboard.currency);
var zAmtStr = String(onboard.zakatAmount || '').replace(/,/g, '').trim();
var zAmt = Number(zAmtStr);
var zMinor = (isFinite(zAmt) && zAmt >= 0) ? Math.round(zAmt * 100) : 0;
var zEligible = zMinor > 0 && zMinor >= zNisab;
var zDue = zEligible ? Math.round(zMinor * 0.025) : 0;
var zResult = '';
if (zMinor > 0) {
zResult = '<div class="ob-zakat-result">' +
'<div>المبلغ: <b>' + moneyText(zMinor, onboard.currency) + '</b></div>' +
'<div>النصاب: <b>' + moneyText(zNisab, onboard.currency) + '</b></div>' +
(zEligible
? '<div class="pos" style="margin-top:6px">بلغ النصاب ✓ — الزكاة المستحقة: <b>' + moneyText(zDue, onboard.currency) + '</b></div>'
: '<div class="muted" style="margin-top:6px">لم يبلغ النصاب، لا زكاة.</div>') +
'</div>';
} else {
zResult = '<div class="muted">أدخل مبلغًا (اختياري) لحساب زكاته.</div>';
}
return '<h1>زكاة أموالك</h1><p class="ob-lead">زكاة النقود والمدخرات 2.5% من صافي الثروة (الأصول − الالتزامات) إذا بلغ النصاب (≈ 85 غرام ذهب) وحال عليه الحول (سنة هجرية).</p>' +
'<div class="ob-note">عملتك: ' + esc(zName) + ' (' + esc(zSym) + '). النصاب ≈ ' + moneyText(zNisab, onboard.currency) + '.</div>' +
'<label class="ob-field"><span>مبلغ لحساب زكاته (اختياري)</span><input id="obZakatInput" data-ob-field="zakatAmount" type="text" inputmode="decimal" dir="ltr" value="' + esc(onboard.zakatAmount || '') + '" placeholder="0" /></label>' +
'<div id="obZakatResult">' + zResult + '</div>' +
'<p class="ob-note">يمكنك حساب زكاة تجارتِك بالتفصيل من لوحة القيادة (زر زكاة) بعد إدخال قيودك.</p>';
}
if (step === 'accounts') {
var empty = !E.mainCurrencyLocked();
var chosenP = (E.PERSONAS && E.PERSONAS[onboard.persona]) || null;
var pAccountsHtml = chosenP && chosenP.accounts && chosenP.accounts.length
? '<div class="ob-note" style="margin-bottom:4px">حسابات «' + esc(chosenP.title) + '» التي ستُضاف لدليلك:</div>' +
'<div class="ob-persona-tags">' + chosenP.accounts.map(function (a) { return '<span>' + esc(a.name) + '</span>'; }).join('') + '</div>'
: '';
var popularBanks = ['الراجحي', 'الأهلي', 'الإنماء', 'الكريمي', 'بنك مسقط', 'بنك مصر', 'بنك الكويت الوطني'];
var bankChipsHtml = '<div class="ob-bank-chips">' + popularBanks.map(function (b) {
var on = onboard.bankName === b;
return '<button type="button" class="ob-bank-chip' + (on ? ' on' : '') + '" data-ob-bank="' + esc(b) + '">' + esc(b) + '</button>';
}).join('') + '</div>';
return '<h1>حساباتك جاهزة (السيولة والأرصدة الافتتاحية)</h1><p class="ob-lead">الصندوق والبنك وحسابات الديون والإيرادات والمصروفات موجودة من البداية. سمِّ بنكك' + (empty ? '، وأخبرنا بما معك الآن لتبدأ بأرقام صحيحة.' : '.') + '</p>' +
pAccountsHtml +
'<div class="ob-note" style="margin-bottom:4px">اختر بنكك بضغطة أو اكتب اسمه:</div>' +
bankChipsHtml +
'<label class="ob-field"><span>اسم بنكك</span><input id="obBankNameInput" data-ob-field="bankName" type="text" value="' + esc(onboard.bankName) + '" placeholder="مثال: الراجحي" autocomplete="off" /></label>' +
(empty ? '<div class="ob-pair">' +
'<label class="ob-field"><span>رصيد الصندوق الآن (اختياري)</span><input data-ob-field="cashOpening" type="text" inputmode="decimal" dir="ltr" value="' + esc(onboard.cashOpening) + '" placeholder="0" /></label>' +
'<label class="ob-field"><span>رصيد البنك الآن (اختياري)</span><input data-ob-field="bankOpening" type="text" inputmode="decimal" dir="ltr" value="' + esc(onboard.bankOpening) + '" placeholder="0" /></label>' +
'</div><p class="ob-note">يُسجَّل كل رصيد قيدَ رأس مال بعملتك الأساسية (' + esc(onboard.currency) + ').</p>' : '');
}
if (step === 'learns') {
var sumLang = onboardLangObj();
var sumDl = sumLang.dialects[onboard.dialect - 1] || sumLang.dialects[0];
var sumMeta = dialectMetaOf(sumDl ? sumDl[1] : 'ar-SA');
var sumPersona = (E.PERSONAS && E.PERSONAS[onboard.persona]) ? E.PERSONAS[onboard.persona].title : onboard.persona;
var sumCur = E.listCurrencies().filter(function (c) { return c.code === onboard.currency; })[0];
var sumCurText = sumCur ? (sumCur.name + ' (' + sumCur.code + ')') : onboard.currency;
return '<h1>جاهز لتبدأ</h1>' +
'<p class="ob-lead">تم تجهيز دفاترك حسب اختياراتك، ويتعلم التطبيق معك مع الوقت ويبقى كل ما فيه على هاتفك.</p>' +
'<div class="ob-summary">' +
'<div class="ob-summary-title">📋 ملخص إعداد دفاترك:</div>' +
'<div class="ob-summary-grid">' +
'<div><span>اللهجة:</span><b>' + sumMeta.flag + ' ' + esc(sumDl ? sumDl[0] : '') + '</b></div>' +
'<div><span>العملة الأساسية:</span><b>' + esc(sumCurText) + '</b></div>' +
'<div><span>النشاط:</span><b>' + esc(sumPersona) + '</b></div>' +
'<div><span>البنك الرئيسي:</span><b>' + esc(onboard.bankName || 'البنك') + '</b></div>' +
'</div>' +
'</div>' +
'<ul class="ob-points">' +
'<li><b>الميزانيات والقيود المتكررة</b><span>تجدهما في الإعدادات، وتُنبَّه إذا تجاوزت حدًّا أو تأخر قيد مستحق.</span></li>' +
'<li><b>استيراد كشفك البنكي</b><span>من الإعدادات، استورد ملف CSV أو OFX أو QIF بنفسك، من بنكك أو من Excel.</span></li>' +
'<li><b>نسخة احتياطية مشفّرة</b><span>كلمة مرور النسخة لا تُحفظ في التطبيق، فاحفظها في مكان آمن، وإلا تعذّر استرجاعها.</span></li>' +
'</ul>';
}
return '<h1>إعدادات تحميك</h1><p class="ob-lead">ضبطناها حسب شخصيتك المختارة، ويمكنك تعديلها الآن أو لاحقًا من الإعدادات.</p>' +
'<p class="ob-note">نوصي بتفعيل قفل التطبيق، ومن الإعدادات خذ نسخة احتياطية مشفّرة قبل أي تغيير كبير.</p>' +
'<div class="ob-theme-groups">' +
'<div class="ob-theme" role="group" aria-label="المظهر الفاتح">' + [['light', '<span class="theme-dot" style="background:#064e3b" title="فاتح"></span>'], ['ocean', '<span class="theme-dot" style="background:#1d6fa5" title="محيط"></span>'], ['burgundy', '<span class="theme-dot" style="background:#7f1d1d" title="عنابي"></span>'], ['purple', '<span class="theme-dot" style="background:#6d28d9" title="بنفسجي"></span>'], ['teal', '<span class="theme-dot" style="background:#0d9488" title="فيروزي"></span>'], ['amber', '<span class="theme-dot" style="background:#d97706" title="كهرماني"></span>'], ['system', '<span class="theme-dot" style="background:#8fa89d;border:1px solid #5b7a99" title="تلقائي"></span>']].map(function (t) {
return '<button type="button" data-ob-theme="' + t[0] + '" aria-pressed="' + (onboard.theme === t[0]) + '">' + t[1] + '</button>';
}).join('') + '</div>' +
'<div class="ob-theme" role="group" aria-label="المظهر الداكن">' + [['dark', '<span class="theme-dot" style="background:#0a1f18;border:1px solid #8fa89d" title="داكن"></span>'], ['ocean-dark', '<span class="theme-dot" style="background:#0284c7;border:1px solid #88a8c4" title="محيط داكن"></span>'], ['burgundy-dark', '<span class="theme-dot" style="background:#9f1239;border:1px solid #c49ba3" title="عنابي داكن"></span>'], ['purple-dark', '<span class="theme-dot" style="background:#6d28d9;border:1px solid #a898c9" title="بنفسجي داكن"></span>'], ['teal-dark', '<span class="theme-dot" style="background:#2dd4bf;border:1px solid #7ab8b3" title="فيروزي داكن"></span>'], ['amber-dark', '<span class="theme-dot" style="background:#f59e0b;border:1px solid #d4a017" title="كهرماني داكن"></span>']].map(function (t) {
return '<button type="button" data-ob-theme="' + t[0] + '" aria-pressed="' + (onboard.theme === t[0]) + '">' + t[1] + '</button>';
}).join('') + '</div>' +
'</div>' +
onboardSwitch('simpleMode', 'وضع بسيط', 'يخفي تفاصيل المدين والدائن لغير المحاسبين') +
onboardSwitch('appLock', 'قفل التطبيق', 'يطلب قفل الهاتف عند فتحه') +
onboardSwitch('reminders', 'تفعيل التذكيرات', 'ينبهك قبل مواعيد الديون والاستحقاقات') +
onboardSwitch('hideAmounts', 'إخفاء المبالغ', 'تختفي الأرقام لمزيد من الخصوصية') +
onboardSwitch('autoTts', 'قراءة الردود بصوت', 'يقرأ البوت ردوده تلقائيًا');
}
function obRateShown(code) {
var v = Number(E.getRate(code));
if (!isFinite(v)) return '';
var set = (S().settings || {}).rateDecimals || {};
var dec = set[code] != null && isFinite(Number(set[code])) ? Math.max(0, Math.min(8, Math.round(Number(set[code]))))
: v < 1 ? 5 : v > 10 ? 0 : 2;
return String(Number(v.toFixed(dec)));
}
function saveObRates() {
document.querySelectorAll('[data-ob-rate]').forEach(function (inp) {
if (inp.value === inp.getAttribute('data-shown')) return;
var val = parseFloat(inp.value);
if (val > 0) E.setRate(inp.getAttribute('data-ob-rate'), val);
});
}
function drawOnboarding() {
var root = document.getElementById('onboard');
if (!root || !onboard) { stopWelcomeHeroTimer(); return; }
ONBOARD_STEPS = activeOnboardSteps();
if (onboard.step >= ONBOARD_STEPS.length) onboard.step = ONBOARD_STEPS.length - 1;
if (onboard.step < 0) onboard.step = 0;
var step = ONBOARD_STEPS[onboard.step];
var last = onboard.step === ONBOARD_STEPS.length - 1;
var skipLabel = (!onboard.locked && !onboard.essentialOnly) ? 'تخطي (الإعداد الأساسي)' : 'تخطي';
root.innerHTML =
'<div class="ob-top">' +
'<span class="ob-step-count">' + (onboard.essentialOnly ? 'أساسي ' : '') + (onboard.step + 1) + ' / ' + ONBOARD_STEPS.length + '</span>' +
'<div class="ob-progress" aria-label="التقدم"><div class="ob-progress-bar" style="width:' + Math.round((onboard.step / Math.max(1, ONBOARD_STEPS.length - 1)) * 100) + '%"></div></div>' +
'<button type="button" class="ob-skip" data-ob="try-now" title="تخطي الإعداد وتجربة كتابة قيد فوراً" style="margin-inline-end:4px">⚡ جرّب فوراً</button>' +
'<button type="button" class="ob-skip" data-ob="skip">' + skipLabel + '</button>' +
'</div>' +
'<div class="ob-stage ob-step-in" data-step="' + step + '">' + onboardArt(step) + '<div class="ob-body">' + onboardBody(step) + '</div></div>' +
'<div class="ob-bottom">' +
(onboard.step ? '<button type="button" class="ob-back" data-ob="back">السابق</button>' : '<span></span>') +
'<button type="button" class="ob-next" data-ob="next">' + (last ? 'ابدأ الآن' : onboard.step ? 'التالي' : 'لنبدأ') + '</button></div>';
if (step === 'welcome') startWelcomeHeroTimer();
else stopWelcomeHeroTimer();
if (onboard._shownStep !== onboard.step) {
onboard._shownStep = onboard.step;
var stepHeading = root.querySelector('.ob-body h1');
if (stepHeading) {
stepHeading.setAttribute('tabindex', '-1');
stepHeading.focus({ preventScroll: true });
}
}
}
function onboardInput(ev) {
var key = ev.target.getAttribute('data-ob-field');
if (!key || !onboard) return;
if (key in onboard.profile) onboard.profile[key] = ev.target.value;
else onboard[key] = ev.target.value;
if (key === 'dialectQuery') {
var listBox = document.getElementById('obDialectList');
if (listBox) listBox.innerHTML = renderObDialectGrid();
return;
}
if (key === 'zakatAmount') {
onboard.zakatTouched = true;
var box = document.getElementById('obZakatResult');
if (box) {
var zNisab = E.fromBase(2125000, onboard.currency);
var zAmt = Number(String(onboard.zakatAmount || '').replace(/,/g, '').trim());
var zMinor = (isFinite(zAmt) && zAmt >= 0) ? Math.round(zAmt * 100) : 0;
var zEligible = zMinor > 0 && zMinor >= zNisab;
var zDue = zEligible ? Math.round(zMinor * 0.025) : 0;
var html = '';
if (zMinor > 0) {
html = '<div class="ob-zakat-result">' +
'<div>المبلغ: <b>' + moneyText(zMinor, onboard.currency) + '</b></div>' +
'<div>النصاب: <b>' + moneyText(zNisab, onboard.currency) + '</b></div>' +
(zEligible
? '<div class="pos" style="margin-top:6px">بلغ النصاب ✓ — الزكاة المستحقة: <b>' + moneyText(zDue, onboard.currency) + '</b></div>'
: '<div class="muted" style="margin-top:6px">لم يبلغ النصاب، لا زكاة.</div>') +
'</div>';
} else {
html = '<div class="muted">أدخل مبلغًا (اختياري) لحساب زكاته.</div>';
}
box.innerHTML = html;
}
}
}
function onboardClick(ev) {
if (!onboard) return;
var t = ev.target.closest('[data-ob],[data-ob-persona],[data-ob-currency],[data-ob-suggested-currency],[data-ob-dialect],[data-ob-lang],[data-ob-welcome-dl],[data-ob-wa-lang],[data-ob-wa-dialect],[data-ob-sim],[data-ob-bank],[data-ob-toggle],[data-ob-theme]');
if (!t) return;
ONBOARD_STEPS = activeOnboardSteps();
if (t.hasAttribute('data-ob-welcome-dl')) {
var parts = (t.getAttribute('data-ob-welcome-dl') || 'ar:2').split(':');
onboard.langCode = parts[0] || 'ar';
onboard.dialect = Number(parts[1]) || 1;
E.setLanguage(onboard.langCode, onboard.dialect);
applyLanguage();
drawOnboarding();
return;
}
if (t.hasAttribute('data-ob-sim')) {
onboard.simIndex = Number(t.getAttribute('data-ob-sim')) || 0;
drawOnboarding();
return;
}
if (t.hasAttribute('data-ob-lang')) {
onboard.langCode = t.getAttribute('data-ob-lang') || 'ar';
onboard.dialect = DEFAULT_DIALECT[onboard.langCode] || 1;
onboard.dialectQuery = '';
E.setLanguage(onboard.langCode, onboard.dialect);
applyLanguage();
drawOnboarding();
return;
}
if (t.hasAttribute('data-ob-wa-lang')) {
askLocaleRequestPermission(
'language',
t.getAttribute('data-ob-wa-lang') || '',
t.getAttribute('data-name') || '',
t.getAttribute('data-flag') || '🌐'
);
return;
}
if (t.hasAttribute('data-ob-wa-dialect')) {
askLocaleRequestPermission(
'dialect',
t.getAttribute('data-ob-wa-dialect') || '',
t.getAttribute('data-name') || '',
t.getAttribute('data-flag') || '🌐'
);
return;
}
if (t.hasAttribute('data-ob-bank')) {
onboard.bankName = t.getAttribute('data-ob-bank') || 'البنك';
var bankInp = document.getElementById('obBankNameInput');
if (bankInp) bankInp.value = onboard.bankName;
drawOnboarding();
return;
}
if (t.hasAttribute('data-ob-persona')) {
var pKey = t.getAttribute('data-ob-persona');
onboard.persona = pKey;
onboard.expandedPersona = pKey;
var pDef = E.PERSONAS && E.PERSONAS[pKey];
if (pDef && pDef.settings) {
onboard.simpleMode = !!pDef.settings.simpleMode;
if (typeof pDef.settings.reminders === 'boolean') onboard.reminders = pDef.settings.reminders;
}
if (onboard.step < ONBOARD_STEPS.length - 1) onboard.step++;
drawOnboarding();
return;
}
if (t.hasAttribute('data-ob-dialect')) {
onboard.dialect = Number(t.getAttribute('data-ob-dialect'));
E.setLanguage(onboard.langCode || currentLanguage().code, onboard.dialect);
applyLanguage();
if (!onboard.locked) {
try {
var _dLoc = onboardLocaleCode();
var _dMeta = dialectMetaOf(_dLoc);
var _dSug = E.topCurrenciesForDialect ? E.topCurrenciesForDialect(_dMeta.code) : [];
if (_dSug && _dSug.length) { onboard.currency = _dSug[0].code; }
} catch (e) {}
}
if (onboard.step < ONBOARD_STEPS.length - 1) onboard.step++;
drawOnboarding();
return;
}
if (t.hasAttribute('data-ob-suggested-currency')) {
var sugCode = t.getAttribute('data-ob-suggested-currency');
if (!onboard.locked && E.selectSuggestedBaseCurrency) {
var sugRes = E.selectSuggestedBaseCurrency(sugCode);
if (!sugRes.ok) toast(sugRes.error, true);
else onboard.currency = E.BASE;
} else {
onboard.currency = sugCode;
}
ONBOARD_STEPS = activeOnboardSteps();
if (onboard.step < ONBOARD_STEPS.length - 1) onboard.step++;
drawOnboarding();
return;
}
if (t.hasAttribute('data-ob-currency')) {
onboard.currency = t.getAttribute('data-ob-currency');
if (!onboard.locked) {
var picked = E.setBaseCurrency(onboard.currency);
if (!picked.ok) toast(picked.error, true);
}
ONBOARD_STEPS = activeOnboardSteps();
if (onboard.step < ONBOARD_STEPS.length - 1) onboard.step++;
drawOnboarding();
return;
}
if (t.hasAttribute('data-ob-toggle')) {
var k = t.getAttribute('data-ob-toggle');
onboard[k] = !onboard[k];
t.setAttribute('aria-checked', onboard[k] ? 'true' : 'false');
return;
}
if (t.hasAttribute('data-ob-theme')) {
onboard.theme = t.getAttribute('data-ob-theme');
S().settings.theme = onboard.theme;
applyTheme();
drawOnboarding();
return;
}
var act = t.getAttribute('data-ob');
if (act === 'toggle-more-langs') {
onboard.moreLangsOpen = !onboard.moreLangsOpen;
drawOnboarding();
return;
}
if (act === 'toggle-more-dialects') {
onboard.moreDialectsOpen = !onboard.moreDialectsOpen;
drawOnboarding();
return;
}
if (act === 'try-now') {
closeOnboarding();
renderQuickTryBar();
if (els.input) setTimeout(function () { els.input.focus(); }, 50);
return;
}
if (act === 'skip') {
if (!E.mainCurrencyLocked()) {
if (!onboard.essentialOnly) {
onboard.essentialOnly = true;
ONBOARD_STEPS = activeOnboardSteps();
onboard.step = 0;
toast('المسار الأساسي السريع: أدخل اللهجة والعملة والنشاط وحساباتك');
drawOnboarding();
return;
}
if (onboard.step < ONBOARD_STEPS.length - 1) {
applyOnboardingProgress();
onboard.step++;
drawOnboarding();
return;
}
finishOnboarding();
return;
}
closeOnboarding();
return;
}
if (act === 'restore-backup') {
closeOnboarding();
openImport();
return;
}
if (act === 'photo') {
pickProfilePhoto(function (data) { if (onboard) { onboard.profile.photo = data; drawOnboarding(); } });
return;
}
if (act === 'photo-remove') { onboard.profile.photo = ''; drawOnboarding(); return; }
if (act === 'add-currency') {
ui.afterAddCurrency = function (code) {
if (onboard) {
onboard.currency = code;
ONBOARD_STEPS = activeOnboardSteps();
drawOnboarding();
}
};
openAddCurrency();
els.modal.classList.add('over-onboard');
return;
}
if (act === 'open-erates') {
openRatesSetupModal(onboard.currency || E.BASE);
els.modal.classList.add('over-onboard');
return;
}
if (act === 'remove-currency') {
var code = t.getAttribute('data-code');
if (code) {
var res = E.removeCurrency(code);
if (res.ok) toast('تم حذف ' + code);
else toast(res.error, true);
ONBOARD_STEPS = activeOnboardSteps();
drawOnboarding();
}
return;
}
if (act === 'back') {
onboard.step = Math.max(0, onboard.step - 1);
drawOnboarding();
return;
}
if (act === 'next') {
if (ONBOARD_STEPS[onboard.step] === 'erates') {
saveObRates();
E.saveState();
}
if (ONBOARD_STEPS[onboard.step] === 'accounts') {
var bad = ['cashOpening', 'bankOpening'].filter(function (key) {
var v = String(onboard[key] || '').replace(/,/g, '').trim();
return v && !(Number(v) >= 0);
});
if (bad.length) { toast('اكتب الرصيد رقمًا', true); return; }
}
applyOnboardingProgress();
ONBOARD_STEPS = activeOnboardSteps();
if (onboard.step < ONBOARD_STEPS.length - 1) { onboard.step++; drawOnboarding(); return; }
finishOnboarding();
}
}
function applyOnboardingProgress() {
if (!onboard) return;
var o = onboard;
E.setProfile(o.profile);
if (o.langCode !== currentLanguage().code || o.dialect !== currentDialectRank()) {
E.setLanguage(o.langCode || currentLanguage().code, o.dialect);
applyLanguage();
}
if (!o.locked && o.currency !== E.BASE) {
var cur = E.setBaseCurrency(o.currency);
if (!cur.ok) toast(cur.error, true);
}
if (o.persona && E.applyPersona) {
E.applyPersona(o.persona, { simpleMode: !!o.simpleMode });
} else {
E.setSimpleMode(!!o.simpleMode);
}
var bank = E.getAccount('bank');
var bankName = String(o.bankName || '').trim();
if (bank && bankName && bankName !== bank.name) {
var taken = S().accounts.some(function (a) { return a.id !== 'bank' && E.normalizeName(a.name) === E.normalizeName(bankName); });
if (!taken) bank.name = bankName.slice(0, 40);
}
if (!onboard._balancesApplied && (ONBOARD_STEPS[onboard.step] === 'accounts' || onboard.step >= ONBOARD_STEPS.indexOf('accounts')) && !E.mainCurrencyLocked()) {
[['cash', o.cashOpening], ['bank', o.bankOpening]].forEach(function (pair) {
var amount = Number(String(pair[1] || '').replace(/,/g, ''));
if (!(amount > 0)) return;
var made = E.addDraft({ kind: 'capital', amountMinor: Math.round(amount * 100), currency: E.BASE, accountId: pair[0], memo: 'رصيد افتتاحي — ' + E.getAccount(pair[0]).name, date: E.todayISO() });
if (made.ok) { var cRes = E.confirmDraft(made.draft.id); if (cRes.ok && cRes.entry) pushReceipts([cRes.entry.id]); }
});
onboard._balancesApplied = true;
}
var st = S();
st.settings.theme = o.theme;
E.setAppLock(o.appLock);
if (!o.reminders) E.setRemindersEnabled(false);
else E.setRemindersEnabled(true);
E.setHideAmounts(o.hideAmounts);
E.setAutoTts(o.autoTts);
applyTheme();
}
async function finishOnboarding() {
var o = onboard;
applyOnboardingProgress();
if (o.reminders && window.RohReminders) withNotificationPermission(function () { E.setRemindersEnabled(true); renderAll(); });
await (E.flushSaves ? E.flushSaves() : E.saveState());
closeOnboarding();
S().messages = S().messages.filter(function (m) { return !isWelcome(m); });
seedWelcome();
await (E.flushSaves ? E.flushSaves() : E.saveState());
renderAll();
}
function closeOnboarding() {
stopWelcomeHeroTimer();
E.setOnboarded(true);
onboard = null;
var root = document.getElementById('onboard');
if (root) { root.hidden = true; root.innerHTML = ''; }
showPlaceholder();
renderAll();
}
async function boot() {
try {
els.chat = document.getElementById('chat');
els.input = document.getElementById('input');
els.actionBtn = document.getElementById('actionBtn');
els.topMenuBtn = document.getElementById('topMenuBtn');
els.toast = document.getElementById('toast');
if (els.toast) els.toast.addEventListener('click', hideToast);
if (els.toast) {
var _ty0 = 0, _swiping = false;
els.toast.addEventListener('touchstart', function (ev) {
if (!ev.touches || !ev.touches.length) return;
_ty0 = ev.touches[0].clientY;
_swiping = true;
}, { passive: true });
els.toast.addEventListener('touchmove', function (ev) {
if (!_swiping || !ev.touches || !ev.touches.length) return;
var dy = ev.touches[0].clientY - _ty0;
if (dy < -8) {
els.toast.style.transform = 'translateY(' + dy + 'px)';
els.toast.style.opacity = String(Math.max(0.3, 1 + dy / 80));
}
}, { passive: true });
els.toast.addEventListener('touchend', function (ev) {
if (!_swiping) return;
_swiping = false;
var dy = (ev.changedTouches && ev.changedTouches.length) ? (ev.changedTouches[0].clientY - _ty0) : 0;
if (dy < -40) { hideToast(); }
else { els.toast.style.transform = ''; els.toast.style.opacity = ''; }
});
}
els.srAnnouncer = document.getElementById('srAnnouncer');
els.radar = document.getElementById('radarBody');
els.ledger = document.getElementById('ledgerBody');
if (els.ledger) els.ledger.addEventListener('scroll', function () {
if (ui.ledgerLoading) return;
if (els.ledger.scrollTop + els.ledger.clientHeight < els.ledger.scrollHeight - 60) return;
var total = filteredEntries().length;
if ((ui.ledgerVisible || 50) >= total) return;
ui.ledgerLoading = true;
ui.ledgerVisible = (ui.ledgerVisible || 50) + 50;
renderLedgerList();
ui.ledgerLoading = false;
}, { passive: true });
els.accounts = document.getElementById('accountsBody');
els.settings = document.getElementById('settingsBody');
els.reports = document.getElementById('reportsBody');
els.modal = document.getElementById('modal');
els.modalTitle = document.getElementById('modalTitle');
els.modalBody = document.getElementById('modalBody');
els.modalClose = document.getElementById('modalClose');
els.ac = document.getElementById('autocomplete');
if (window.visualViewport) {
var vv = window.visualViewport;
var updateKeyboard = function () {
var open = vv.height < (window.innerHeight || document.documentElement.clientHeight) * 0.75;
document.body.classList.toggle('keyboard-open', open);
};
vv.addEventListener('resize', updateKeyboard);
vv.addEventListener('scroll', updateKeyboard);
updateKeyboard();
}
applyTheme();
if (els.modalClose) els.modalClose.addEventListener('click', closeSheet);
document.addEventListener('keydown', function (ev) {
var modal = document.getElementById('modal');
if (!modal || !modal.classList.contains('open')) return;
if (ev.key === 'Tab') {
var card = modal.querySelector('.modal-card');
if (!card) return;
var focusables = card.querySelectorAll('button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
if (!focusables.length) return;
var first = focusables[0];
var last = focusables[focusables.length - 1];
if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
}
});
if (window.RohOwner) {
var _ownerBoot = document.getElementById('bootLoading');
if (_ownerBoot) _ownerBoot.classList.add('hidden');
await startOwnerEdition();
if (_ownerBoot) _ownerBoot.classList.remove('hidden');
}
await E.loadState();
applyTheme();
try { checkScheduledReport(); } catch (e) {}
try {
var _vs = E.getVocabStatus();
if (_vs && _vs.warning) setTimeout(function () { toast(_vs.warning, true); }, 1500);
} catch (e) {}
try { E.recordNetWorthSnapshot(); } catch (e) {}
await useRiyalSymbolThatDraws();
applyFontStep();
applyLanguage();
updateTopCurrencyFlag();
if (window.navigator && typeof window.navigator.getBattery === 'function') {
try {
window.navigator.getBattery().then(function (bat) {
var push = function () {
if (E.updateBatteryStatus) E.updateBatteryStatus({ charging: !!bat.charging, level: bat.level });
};
push();
bat.addEventListener('chargingchange', push);
bat.addEventListener('levelchange', push);
}).catch(function () {});
} catch (e) {}
}
startTrainerEdition();
await loadOwnerIssued();
await loadAttachments();
startAppLock();
var _bootLoading = document.getElementById('bootLoading');
if (_bootLoading) _bootLoading.classList.add('hidden');
var st = S();
E.onStorageStatus(renderStorageStatus);
st.messages.forEach(function (m) {
if (m.type === 'ai-pending') {
m.type = 'ai-error';
m.text = 'انقطع الاتصال قبل وصول الرد. أعد إرسال سؤالك.';
}
});
if (E.recordLaunch() > WELCOME_RUNS) st.messages = st.messages.filter(function (m) { return !isWelcome(m); });
if (st.messages.some(function (m) { return isWelcome(m) && !(m.data && m.data.welcome); })) {
st.messages = st.messages.filter(function (m) { return !isWelcome(m); });
seedWelcome();
}
if (!st.messages.length) { seedWelcome(); }
E.saveState();
bindEvents();
if (E.setOnEntryConfirmed) {
E.setOnEntryConfirmed(function (entry, draftId) {
try {
var _bm = document.querySelector('.brand-mark');
if (_bm) { _bm.classList.remove('wink'); void _bm.offsetWidth; _bm.classList.add('wink'); setTimeout(function () { _bm.classList.remove('wink'); }, 400); }
} catch (e) {}
var st = S();
var found = false;
(st.messages || []).forEach(function (m) {
if (m.type === 'draft' && m.draftId === draftId) {
markSentenceState(m.from, 'confirmed');
m.type = 'receipt';
m.entryId = entry.id;
delete m.draftId;
found = true;
}
});
if (!found) {
var lastSent = st.messages[st.messages.length - 1];
if (lastSent && lastSent.role === 'user') markSentenceState(lastSent.id, 'confirmed');
pushMessage({ role: 'bot', type: 'receipt', entryId: entry.id });
}
E.saveState();
renderAll();
setTimeout(function () { assistantSpeak('entry'); }, 0);
});
}
renderAll();
setTab('bot');
autoGrow();
try { if (window.RohBackup && window.RohBackup.hasPending && window.RohBackup.hasPending()) window.__rohPendingBackup(); } catch (e) {}
ui._booting = false;
try {
var _pec = Number(localStorage.getItem('rohapp.parseErrorCount') || 0);
var _ccc = Number(localStorage.getItem('rohapp.cancelCount') || 0);
var _hintShown = localStorage.getItem('rohapp.botTourHintShown');
var _fewEntries = (S().entries || []).length < 3;
if (!_hintShown && (_fewEntries || _pec >= 2 || _ccc >= 2)) {
botText('اضغط على شعار موني كود (أعلى) لبدء الجولة.');
var _bm0 = document.querySelector('.brand-mark');
if (_bm0) _bm0.classList.add('bot-tour-pulse');
}
} catch (e) {}
startPlaceholderRotation();
try {
var params = new URLSearchParams(window.location.search);
var open = params.get('open');
if (open) {
if (open.indexOf('entry:') === 0) {
var eid = open.slice(6);
setTimeout(function () { setTab('ledger'); }, 300);
} else if (open.indexOf('due:') === 0) {
var did = open.slice(4);
setTimeout(function () { openDueInChat(did); }, 300);
} else if (open.indexOf('report:') === 0) {
var rtype = open.slice(7);
setTimeout(function () {
if (rtype === 'cashflow') openCashFlowForm();
else if (rtype === 'balance') printBalanceSheet();
else if (rtype === 'zakat') openZakat();
else if (rtype === 'aging') printDebtAging();
else if (rtype === 'pl') printProfitLoss();
}, 300);
}
}
} catch (e) {}
if (!st.settings.onboarded) {
if (st.entries.length || st.drafts.length) E.setOnboarded(true);
else if (isWebQuickTry()) {
renderQuickTryBar();
if (els.input) setTimeout(function () { els.input.focus(); }, 60);
}
else openOnboarding();
}
if (window.RohOwner && E.listUsers().length && !E.currentUser()) {
openOwnerLogin();
}
try {
document.addEventListener('visibilitychange', function () {
if (document.hidden) {
if (placeholderTimer) { clearInterval(placeholderTimer); placeholderTimer = null; }
} else {
startPlaceholderRotation();
}
});
} catch (e) {}
renderStorageStatus();
if (E.getStorageStatus().recovered) toast('استعدنا آخر بياناتك من النسخة المؤقتة');
if (st.settings.onboarded) assistantSpeak('open');
try {
document.addEventListener('visibilitychange', function () {
if (!document.hidden && S().settings.onboarded && !els.input.value.trim()) assistantSpeak('open');
});
} catch (e) {}
autoSpeechReady = true;
} catch (e) {
console.error('[RohUI] boot failed', e);
document.body.innerHTML = '<div style="padding:24px;font-family:Tahoma;direction:rtl;text-align:center">' +
'<div style="font-size: calc(18px * var(--font-scale, 1));margin-bottom:12px">تعذر تشغيل موني كود</div>' +
'<div style="color:#6b7c74;margin-bottom:16px">' + E.escapeHtml(e.message) + '</div>' +
'<button onclick="location.reload()" style="padding:10px 20px;border-radius:10px;border:none;background:var(--emerald);color:#fff;cursor:pointer">إعادة المحاولة</button></div>';
}
}
window.__rohOpenEntry = function (id) { setTab('ledger'); };
window.__rohOpenDue = function (id) { openDueInChat(id); };
window.__rohPendingBackup = function () {
if (!window.RohBackup || !window.RohBackup.hasPending || !window.RohBackup.hasPending()) return;
var text = window.RohBackup.consume();
if (!text) { toast('تعذر قراءة ملف النسخة الاحتياطية', true); return; }
openImport();
setTimeout(function () {
var area = document.getElementById('importArea');
if (area) { area.value = text; if (typeof showImportPassword === 'function') showImportPassword(text); }
}, 0);
};
window.__rohOpenReport = function (type) {
if (type === 'cashflow') openCashFlowForm();
else if (type === 'balance') printBalanceSheet();
else if (type === 'zakat') openZakat();
else if (type === 'aging') printDebtAging();
else if (type === 'pl') printProfitLoss();
};
document.addEventListener('click', function (ev) {
var inp = ev.target.closest('input[type="number"], input[inputmode="decimal"], input.amount-input');
if (inp && !inp.readOnly && !inp.classList.contains('amount-input')) { try { inp.select(); } catch (e) {} }
var btn = ev.target.closest('.password-toggle');
if (!btn) return;
var targetId = btn.getAttribute('data-target');
var input = document.getElementById(targetId);
if (!input) return;
if (input.type === 'password') {
input.type = 'text';
btn.textContent = '🙈';
btn.setAttribute('aria-label', 'إخفاء كلمة المرور');
} else {
input.type = 'password';
btn.textContent = '👁';
btn.setAttribute('aria-label', 'إظهار كلمة المرور');
}
});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
