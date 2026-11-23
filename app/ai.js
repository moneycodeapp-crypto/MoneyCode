/*! MoneyCode (موني كود) — Sovereign Financial Intelligence | Copyright (c) 2026 طه الدقيل (Taha Al-Dogail). All Rights Reserved. | com.moneycode.sovereign | Ed25519: CF48395FC0FE136D */
/*! ============================================================
MoneyCode (موني كود) — local AI client
Copyright (c) 2026 طه الدقيل (Taha Al-Dogail). All Rights Reserved.
Package: com.moneycode.sovereign
Talks to a local model server with an OpenAI-compatible
/v1/chat/completions endpoint (llama.cpp, Ollama, LM Studio, ...),
on the phone itself (127.0.0.1) or on the local network.
The ledger engine (engine.js) never depends on this file: if the
server is unreachable the app keeps working offline and says so.
On Android requests go through the native bridge (AiBridge.chat), so
CORS doesn't apply; the browser preview uses fetch(), which needs it.
============================================================ */
(function (global) {
'use strict';
var STORE_KEY = 'MoneyCode.ai.v1';
var PROVIDERS = [
{ id: 'builtin', name: 'محرك موني كود الذكي المدمج (بدون إنترنت)', defaultUrl: 'builtin://local', defaultModel: 'sovereign-offline-v1' },
{ id: 'llamacpp', name: 'llama.cpp server', defaultUrl: 'http://127.0.0.1:8080', defaultModel: 'local' },
{ id: 'ollama', name: 'Ollama', defaultUrl: 'http://127.0.0.1:11434', defaultModel: 'llama3.2' },
{ id: 'lmstudio', name: 'LM Studio', defaultUrl: 'http://127.0.0.1:1234', defaultModel: 'local-model' },
{ id: 'localai', name: 'LocalAI', defaultUrl: 'http://127.0.0.1:8080', defaultModel: 'gpt-3.5-turbo' },
{ id: 'gpt4all', name: 'GPT4All', defaultUrl: 'http://127.0.0.1:4891', defaultModel: 'local' },
{ id: 'koboldcpp', name: 'KoboldCpp', defaultUrl: 'http://5001', defaultModel: 'local' },
{ id: 'pocketpal', name: 'PocketPal AI', defaultUrl: 'http://127.0.0.1:8080', defaultModel: 'local' },
{ id: 'openrouter', name: 'OpenRouter', cloud: true, defaultUrl: 'https://openrouter.ai/api/v1', defaultModel: 'google/gemini-2.5-flash-lite' },
{ id: 'openai', name: 'OpenAI', cloud: true, defaultUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
{ id: 'anthropic', name: 'Anthropic (Claude)', cloud: true, defaultUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-3-5-haiku-20241022' },
{ id: 'gemini', name: 'Google (Gemini)', cloud: true, defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-flash-latest' },
{ id: 'mistral', name: 'Mistral AI', cloud: true, defaultUrl: 'https://api.mistral.ai/v1', defaultModel: 'mistral-small-latest' },
{ id: 'groq', name: 'Groq', cloud: true, defaultUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.1-8b-instant' }
];
var DEFAULTS = {
provider: 'builtin',
model: 'sovereign-offline-v1',
endpoints: ['builtin://local'],
apiKey: '',
timeoutMs: 180000,
maxTokens: 300
};
function providerById(id) {
return PROVIDERS.filter(function (p) { return p.id === id; })[0] || null;
}
function readStore() {
try {
var raw = global.localStorage ? global.localStorage.getItem(STORE_KEY) : null;
var parsed = raw ? JSON.parse(raw) : null;
return parsed && typeof parsed === 'object' ? parsed : {};
} catch (e) {
return {};
}
}
function sanitizeEndpoints(list) {
var seen = {};
var out = [];
(list || []).forEach(function (value) {
var base = String(value || '').trim();
if (!base) return;
if (!/^https?:\/\//i.test(base)) base = 'http://' + base;
base = base.replace(/\/+$/, '');
if (seen[base]) return;
seen[base] = true;
out.push(base);
});
return out;
}
function parseEndpoints(value) {
var parts = Array.isArray(value) ? value : String(value || '').split(/[\s,;\n]+/);
return sanitizeEndpoints(parts);
}
function config() {
var saved = readStore();
var provider = String(saved.provider || DEFAULTS.provider);
if (!providerById(provider)) { provider = DEFAULTS.provider; }
var prov = providerById(provider) || PROVIDERS[0];
var provCfg = (saved.providers && saved.providers[provider]) || {};
var endpoints = Array.isArray(provCfg.endpoints) ? sanitizeEndpoints(provCfg.endpoints) : [];
var timeout = Number(saved.timeoutMs);
var model = String(provCfg.model || '');
var apiKey = provCfg.apiKey || prov.defaultKey || '';
var maxTokens = Number(provCfg.maxTokens) || DEFAULTS.maxTokens;
if (!endpoints.length) endpoints = [prov.defaultUrl];
if (!model) model = prov.defaultModel || '';
return {
provider: provider,
model: model,
endpoints: endpoints,
apiKey: apiKey,
timeoutMs: isFinite(timeout) && timeout >= 10000 ? timeout : DEFAULTS.timeoutMs,
maxTokens: isFinite(maxTokens) && maxTokens >= 50 ? maxTokens : DEFAULTS.maxTokens,
providers: saved.providers || {}
};
}
function setConfig(patch) {
patch = patch || {};
var saved = readStore();
var cfg = config();
var provider = cfg.provider;
if (typeof patch.provider === 'string' && patch.provider.trim()) {
var pid = patch.provider.trim();
if (providerById(pid)) {
provider = pid;
var pcfg = (saved.providers && saved.providers[pid]) || {};
var prov = providerById(pid);
cfg.provider = pid;
cfg.endpoints = (Array.isArray(pcfg.endpoints) && pcfg.endpoints.length) ? sanitizeEndpoints(pcfg.endpoints) : [prov.defaultUrl];
cfg.model = pcfg.model || prov.defaultModel || '';
cfg.apiKey = pcfg.apiKey || prov.defaultKey || '';
}
}
if (typeof patch.model === 'string') cfg.model = patch.model.trim();
if (typeof patch.apiKey === 'string') cfg.apiKey = patch.apiKey.trim();
if (typeof patch.maxTokens === 'number') cfg.maxTokens = patch.maxTokens;
if (patch.endpoints !== undefined) {
var list = parseEndpoints(patch.endpoints);
if (list.length) cfg.endpoints = list;
}
if (!saved.providers) saved.providers = {};
saved.providers[cfg.provider] = {
model: cfg.model,
apiKey: cfg.apiKey,
endpoints: cfg.endpoints,
maxTokens: cfg.maxTokens
};
saved.provider = cfg.provider;
saved.timeoutMs = cfg.timeoutMs;
if (global.localStorage) {
global.localStorage.setItem(STORE_KEY, JSON.stringify(saved));
}
return cfg;
}
function resetConfig() {
if (global.localStorage) global.localStorage.removeItem(STORE_KEY);
return config();
}
function status() {
var cfg = config();
var prov = providerById(cfg.provider);
return {
provider: cfg.provider,
providerName: prov.name,
model: cfg.model || prov.defaultModel,
endpoints: cfg.endpoints.slice(),
hasKey: !!cfg.apiKey
};
}
var replyStyle = 'أجب بالعربية الفصحى المبسطة';
function buildPrompt(text, context) {
var parts = [];
parts.push('أنت "موني كود" — مستشار مالي سيادي. ' + replyStyle + '، بإيجاز (3-5 جمل)، بأسلوب مستشار مالي محترف.');
parts.push('قواعد:\n' +
'- لا تخترع أرقاماً. استخدم فقط البيانات في السياق أدناه.\n' +
'- إذا لم تكفِ البيانات، اطلب المعلومات الناقصة بجملة واحدة.\n' +
'- قدم توصيات عملية (تقليل مصاريف، ادخار، سداد ديون).\n' +
'- استخدم الأرقام من السياق (ريال سعودي).');
if (context) {
parts.push('سياق مالي محلي من دفاتر المستخدم (لا تخترع أرقاماً خارجه):\n' + context);
}
parts.push('سؤال المستخدم:\n' + String(text || '').trim());
return parts.join('\n\n');
}
function openAICompatUrl(cfg) {
var base = (cfg.endpoints && cfg.endpoints[0]) ? cfg.endpoints[0] : DEFAULTS.endpoints[0];
base = base.replace(/\/+$/, '');
if (/\/chat\/completions$/i.test(base)) return base;
if (/\/(v1|openai)$/i.test(base)) return base + '/chat/completions';
return base + '/v1/chat/completions';
}
function askOpenAICompat(prompt, cfg) {
var prov = providerById(cfg.provider) || PROVIDERS[0];
var model = cfg.model || prov.defaultModel || 'local';
var url = openAICompatUrl(cfg);
var perTry = cfg.timeoutMs;
return new Promise(function (resolve, reject) {
var controller = typeof global.AbortController !== 'undefined' ? new global.AbortController() : null;
var timer = global.setTimeout(function () {
if (controller) controller.abort();
reject(new Error('انتهت المهلة (' + Math.round(perTry / 1000) + ' ثانية)'));
}, perTry);
var init = {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
model: model,
messages: [{ role: 'user', content: prompt }],
stream: false,
max_tokens: cfg.maxTokens
})
};
if (cfg.apiKey) init.headers['Authorization'] = 'Bearer ' + cfg.apiKey;
if (controller) init.signal = controller.signal;
global.fetch(url, init).then(function (res) {
return res.text().then(function (raw) {
if (!res.ok) throw new Error('HTTP ' + res.status + ' — ' + raw.replace(/\s+/g, ' ').slice(0, 180));
var data = JSON.parse(raw);
var text = '';
if (data && data.choices && data.choices[0] && data.choices[0].message) text = data.choices[0].message.content;
else if (data && data.response) text = data.response;
else if (data && data.content) text = data.content;
text = String(text || '').trim();
if (!text) throw new Error('وصل رد فارغ من المخدم.');
global.clearTimeout(timer);
resolve({ text: text, model: model, provider: prov.name, base: url, via: 'fetch' });
});
}).catch(function (err) {
global.clearTimeout(timer);
if (err && err.name === 'AbortError') reject(new Error('انتهت المهلة'));
else reject(new Error(err && err.message ? err.message : String(err)));
});
});
}
function generateFinancialInsight() {
var E = global.RohEngine;
if (!E || !E.getState) return 'محرك موني كود الذكي المدمج جاهز. سجّل قيودك للحصول على تحليل مالي كامل.';
var st = E.getState();
var radar = E.computeTradingRadar ? E.computeTradingRadar() : { cashDrag: 0, concentrationRisk: [], currencyExposure: {}, opportunities: [] };
var trend = E.computeNetWorthTrend ? E.computeNetWorthTrend() : null;
var forecast = E.computeCashFlowForecast ? E.computeCashFlowForecast(30) : [];
var cur = (st && st.settings && st.settings.currency) || E.BASE || 'SAR';
var fmt = function (minor) { return E.fmtMoney ? E.fmtMoney(minor, cur, false) : String(minor); };
var lines = [];
lines.push('🧭 تحليل الذكاء المالي (Sovereign AI Financial Insight):');
var a = E.computeAnalysis();
var runway = a.runwayDays || 0;
var liqScore = Math.min(10, Math.max(1, Math.round(runway / 3)));
lines.push('• تقييم السيولة (Liquidity Score): ' + liqScore + '/10 (' + (runway > 0 ? 'تغطي ' + runway + ' يوماً' : 'لا توجد بيانات كافية') + ').');
lines.push('• صافي الثروة: ' + fmt(a.netWorth || 0) + (trend ? ' (' + (trend.direction === 'up' ? '↑' : '↓') + ' ' + Math.abs(trend.pct) + '% عن الشهر الماضي)' : '') + '.');
lines.push('• صافي الربح: ' + fmt(a.profit || 0) + ' (إيرادات ' + fmt(a.revenue || 0) + ' − مصروفات ' + fmt(a.expense || 0) + ').');
if (radar.cashDrag > 0) lines.push('• أموال «سائبة» (Cash Drag): ' + fmt(radar.cashDrag) + ' — يوصى بتوظيفها استثمارياً.');
if (radar.concentrationRisk && radar.concentrationRisk.length) lines.push('• ⚠ تركز المخاطر: ' + radar.concentrationRisk.map(function(c){ return c.party + ' (' + c.pct + '%)'; }).join('، ') + '.');
if (radar.currencyExposure && Object.keys(radar.currencyExposure).length) lines.push('• 💱 انكشاف عملة: ' + Object.keys(radar.currencyExposure).map(function(c){ return c + ' (' + radar.currencyExposure[c] + '%)'; }).join('، ') + '.');
var recDue = (a.dueItems || []).filter(function(d) { return !d.settled && d.remaining > 0 && d.kind === 'receivable'; });
var payDue = (a.dueItems || []).filter(function(d) { return !d.settled && d.remaining > 0 && d.kind === 'payable'; });
if (recDue.length || payDue.length) {
lines.push('• الديون: لك ' + fmt(recDue.reduce(function(s,d){ return s + (Number(d.remaining)||0); }, 0)) + ' (' + recDue.length + ' استحقاق) | عليك ' + fmt(payDue.reduce(function(s,d){ return s + (Number(d.remaining)||0); }, 0)) + ' (' + payDue.length + ' استحقاق).');
}
if (forecast.length > 1) {
var lastBal = forecast[forecast.length - 1].balance;
lines.push('• توقع التدفق (30 يوماً): رصيد متوقع ≈ ' + fmt(lastBal) + '.');
}
if (radar.opportunities && radar.opportunities.length) {
lines.push('💡 خطة العمل: ' + radar.opportunities.map(function(o){ return o.suggestion; }).join(' '));
} else {
lines.push('💡 توصية: حافظ على سيولة تغطي 30 يوماً على الأقل، وتابع تحصيل الذمم في موعدها.');
}
return lines.join('\n');
}
function hasNative() {
return !!(global.RohNative && typeof global.RohNative.chat === 'function');
}
global.__rohAiDone = function (id, payload) {
var entry = pending[id];
if (!entry) return;
delete pending[id];
global.clearTimeout(entry.timer);
var data;
try {
data = typeof payload === 'string' ? JSON.parse(payload) : payload;
} catch (e) {
entry.reject(new Error('رد غير صالح من الجسر المحلي.'));
return;
}
if (data && data.ok && data.text) {
entry.resolve({ text: String(data.text), model: String(data.model || entry.model), provider: entry.provider, base: String(data.base || ''), via: 'native' });
} else {
entry.reject(new Error((data && data.error) || 'تعذر الحصول على رد من الذكاء الاصطناعي.'));
}
};
function askNative(prompt, cfg) {
var prov = providerById(cfg.provider) || PROVIDERS[0];
var model = cfg.model || prov.defaultModel || 'local';
return new Promise(function (resolve, reject) {
var id = 'ai_' + (++seq) + '_' + Date.now();
var timer = global.setTimeout(function () {
delete pending[id];
reject(new Error('انتهت مهلة الاتصال بالذكاء الاصطناعي.'));
}, cfg.timeoutMs + 15000);
pending[id] = { resolve: resolve, reject: reject, timer: timer, model: model, provider: prov.name };
try {
global.RohNative.chat(JSON.stringify({
url: openAICompatUrl(cfg),
model: model,
message: prompt,
apiKey: cfg.apiKey,
timeoutMs: cfg.timeoutMs,
maxTokens: cfg.maxTokens
}), id);
} catch (e) {
global.clearTimeout(timer);
delete pending[id];
reject(new Error('تعذر استدعاء الجسر المحلي: ' + (e && e.message ? e.message : e)));
}
});
}
function answerBuiltinOffline(question, context) {
var E = global.RohEngine;
if (!E || typeof E.computeAnalysis !== 'function') {
return 'محرك موني كود الذكي المدمج جاهز ويعمل محلياً 100% بدون إنترنت.';
}
var q = String(question || '').trim();
if (/تؤكد أن الاتصال يعمل|فحص|اختبار/i.test(q)) {
return '✓ محرك موني كود الذكي المدمج يعمل بكفاءة 100% محلياً على جهازك دون الحاجة لأي اتصال بالإنترنت.';
}
var a = E.computeAnalysis();
var st = E.getState();
var cur = (E.mainCurrency && E.mainCurrency()) || E.BASE || 'SAR';
var fmt = function (minor) {
return E.fmtMoney ? E.fmtMoney(E.fromBase ? E.fromBase(minor, cur) : minor, cur, false) : String(Math.round((minor || 0) / 100)) + ' ' + cur;
};
var totalEntries = (st.entries || []).length;
if (totalEntries === 0) {
return 'دفترك فارغ حالياً. ابدأ بتسجيل أول قيد صوتياً أو كتابةً (مثل: «قبضت 5000 ريال مبيعات» أو «دفعت 150 ريال بنزين») وسأقدم لك تحليلاً مالياً كاملاً لسيولتك ومصروفاتك وديونك فوراً بدون إنترنت.';
}
var recDue = (a.dueItems || []).filter(function (d) { return !d.settled && d.remaining > 0 && d.kind === 'receivable'; });
var payDue = (a.dueItems || []).filter(function (d) { return !d.settled && d.remaining > 0 && d.kind === 'payable'; });
var recSum = recDue.reduce(function (s, d) { return s + (Number(d.remaining) || 0); }, 0);
var paySum = payDue.reduce(function (s, d) { return s + (Number(d.remaining) || 0); }, 0);
var expAccs = (st.accounts || []).filter(function (ac) { return ac.type === 'expense'; });
var topExp = null;
expAccs.forEach(function (ac) {
var bal = a.balances && a.balances[ac.id] ? Math.abs(Number(a.balances[ac.id].base) || 0) : 0;
if (bal > 0 && (!topExp || bal > topExp.amount)) topExp = { name: ac.name, amount: bal };
});
var lines = [];
var today = (E.todayISO && E.todayISO()) || new Date().toISOString().slice(0, 10);
var curYm = today.slice(0, 7);
var prevY = Number(curYm.slice(0, 4)), prevM = Number(curYm.slice(5, 7)) - 1;
if (prevM <= 0) { prevM = 12; prevY--; }
var prevYm = prevY + '-' + (prevM < 10 ? '0' + prevM : String(prevM));
var calcMonth = function (ym) {
var inc = 0, exp = 0;
(st.entries || []).forEach(function (e) {
if (!e || String(e.date || '').slice(0, 7) !== ym) return;
if (e.kind === 'income') inc += Number(e.totalBase) || 0;
else if (e.kind === 'expense') exp += Number(e.totalBase) || 0;
});
return { inc: inc, exp: exp, net: inc - exp };
};
var mNow = calcMonth(curYm);
var mPrev = calcMonth(prevYm);
if (/مخاطر|تركز|انكشاف|سائبة|سائب|توقع|تنبؤ|استثمار|توظيف|تقييم\s+السيولة/.test(q)) {
return generateFinancialInsight();
}
if (/زكاة|نصاب|ثروة|ثروتي/.test(q)) {
var zBase = Math.max(0, (a.assets || 0) - (a.liabilities || 0));
var nisabBase = 2125000; // 21,250 SAR in minor units
var zDue = zBase >= nisabBase ? Math.round(zBase * 0.025) : 0;
lines.push('🕌 تحليل صافي الثروة والزكاة التقديرية:');
lines.push('• صافي الثروة الزكوية (الأصول − الالتزامات): ' + fmt(zBase) + '.');
lines.push('• نصاب الزكاة التقديري (≈ 85 غرام ذهب): ' + fmt(nisabBase) + '.');
lines.push(zBase >= nisabBase
? '• الحالة: بلغ المال النصاب ✓ — الزكاة المستحقة (2.5% عند تمام الحول): ' + fmt(zDue) + '.'
: '• الحالة: لم يبلغ صافي الثروة النصاب بعد، فلا تجب فيه الزكاة حالياً.');
return lines.join('\n');
}
if (/ديون|مديون|لنا|علينا|متأخر|تحصيل|سداد|خطة/.test(q)) {
lines.push('📊 تحليل الذمم وخطة إدارة الديون:');
lines.push('• ديون لك عند الآخرين (ذمم مدينة): ' + fmt(recSum) + ' موزعة على ' + recDue.length + ' استحقاق.');
lines.push('• ديون عليك للآخرين (ذمم دائنة): ' + fmt(paySum) + ' موزعة على ' + payDue.length + ' استحقاق.');
if (recDue.length) {
var biggestRec = recDue.slice().sort(function (x, y) { return (y.remaining || 0) - (x.remaining || 0); })[0];
lines.push('• أولوية التحصيل: أكبر مبلغ مستحق لك هو لدى «' + (biggestRec.counterparty || 'عميل') + '» بقيمة ' + fmt(biggestRec.remaining) + '.');
}
if (payDue.length) {
var snowball = payDue.slice().sort(function (x, y) { return (x.remaining || 0) - (y.remaining || 0); })[0];
lines.push('💡 خطة السداد الذكية (كرة الثلج): ابدأ بإغلاق أصغر دين عليك أولاً وهو لـ «' + (snowball.counterparty || 'مورد') + '» بقيمة ' + fmt(snowball.remaining) + ' لتقليل عدد الالتزامات المفتوحة.');
}
return lines.join('\n');
}
if (/مصروف|مصاريف|صرف|وين راحت|أكبر|توفير|ادخار|نصيح|شهر|مقارن|اتجاه/.test(q)) {
lines.push('📉 تحليل المصروفات والاتجاه الشهري المقارن:');
lines.push('• هذا الشهر (' + curYm + '): إيرادات ' + fmt(mNow.inc) + ' | مصروفات ' + fmt(mNow.exp) + '.');
if (mPrev.exp > 0 || mPrev.inc > 0) {
var diffPct = mPrev.exp > 0 ? Math.round(((mNow.exp - mPrev.exp) / mPrev.exp) * 100) : 0;
var trendTxt = diffPct > 0 ? ('أعلى بـ ' + diffPct + '% من الشهر الماضي') : (diffPct < 0 ? ('أقل بـ ' + Math.abs(diffPct) + '% من الشهر الماضي 👏') : 'مطابق للشهر الماضي');
lines.push('• مقارنة بالشهر الماضي (' + prevYm + '): صرفك الحالي ' + trendTxt + '.');
}
if (topExp) {
var pct = a.expense > 0 ? Math.round((topExp.amount / a.expense) * 100) : 0;
lines.push('• أعلى بند استهلاكاً للمال في دفترك هو «' + topExp.name + '» بقيمة ' + fmt(topExp.amount) + ' (' + pct + '% من إجمالي المصروفات).');
}
lines.push('💡 توصية: تحديد سقف ميزانية شهرية لبند «' + (topExp ? topExp.name : 'المصروفات العامة') + '» من تبويب الإعدادات سيساعدك على توفير 15%–20% شهرياً.');
return lines.join('\n');
}
lines.push('🧭 الملخص المالي الذكي لدفترك (محلياً 100%):');
lines.push('• السيولة النقدية المتاحة الآن: ' + fmt(a.liquidity || 0) + (a.runwayDays ? ' (تغطي مصروفاتك المعتادة لنحو ' + a.runwayDays + ' يوماً).' : '.'));
lines.push('• صافي الثروة (الأصول − الالتزامات): ' + fmt(a.netWorth || 0) + ' | صافي الربح: ' + fmt(a.profit || 0) + '.');
if (recSum > 0 || paySum > 0) {
lines.push('• الديون لك: ' + fmt(recSum) + ' | الديون عليك: ' + fmt(paySum) + '.');
}
if (topExp) {
lines.push('• أكبر بند مصروفات: «' + topExp.name + '» (' + fmt(topExp.amount) + ').');
}
lines.push('💡 توصية: حافظ على سيولة نقدية تغطي 30 يوماً على الأقل، وبادر بتحصيل الذمم المستحقة في موعدها.');
return lines.join('\n');
}
function ask(text, context) {
var clean = String(text || '').trim();
if (!clean) return Promise.reject(new Error('لا يوجد سؤال لإرساله.'));
var cfg = config();
if (cfg.provider === 'builtin' || /^builtin:/i.test((cfg.endpoints && cfg.endpoints[0]) || '')) {
return Promise.resolve({
text: answerBuiltinOffline(clean, context),
model: 'sovereign-offline-v1',
provider: 'محرك موني كود المدمج (بدون إنترنت)',
base: 'builtin://local',
via: 'builtin'
});
}
var prompt = buildPrompt(clean, context);
var reqPromise = hasNative() ? askNative(prompt, cfg) : askOpenAICompat(prompt, cfg);
return reqPromise.catch(function () {
return {
text: answerBuiltinOffline(clean, context),
model: 'sovereign-offline-v1',
provider: 'محرك موني كود المدمج (تراجع محلي تلقائي)',
base: 'builtin://local',
via: 'builtin-fallback'
};
});
}
function test() {
return ask('قل جملة عربية قصيرة واحدة تؤكد أن الاتصال يعمل.');
}
global.RohAI = {
setReplyStyle: function (style) { if (style) replyStyle = String(style); },
ask: ask,
test: test,
config: config,
setConfig: setConfig,
resetConfig: resetConfig,
status: status,
parseEndpoints: parseEndpoints,
providers: function () { return PROVIDERS.slice(); },
providerInfo: providerById,
generateFinancialInsight: generateFinancialInsight,
generateMarketingContent: function (type) {
return (global.RohEngine && global.RohEngine.generateMarketingContent) ? global.RohEngine.generateMarketingContent(type) : '';
}
};
global.__rohAiLoaded = true;
})(typeof window !== 'undefined' ? window : this);
