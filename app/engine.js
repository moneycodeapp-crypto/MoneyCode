/*! MoneyCode (موني كود) — Sovereign Financial Intelligence | Copyright (c) 2026 طه الدقيل (Taha Al-Dogail). All Rights Reserved. | com.moneycode.sovereign | Ed25519: CF48395FC0FE136D */
/*! ============================================================
MoneyCode (موني كود) — Sovereign Financial Intelligence (offline engine)
Copyright (c) 2026 طه الدقيل (Taha Al-Dogail). All Rights Reserved.
Package: com.moneycode.sovereign | Ed25519 Fingerprint: CF48395FC0FE136D
------------------------------------------------------------
Strict double-entry ledger, Arabic dialect parser, liquidity
radar, due-date tracking, overdraft detection.
No network. No telemetry. All data stays on the device.
============================================================ */
(function (root) {
'use strict';
var STORAGE_KEY = 'rohapp.state.v3';
var DB_STORAGE_KEY = 'rohapp.db.v1';
var DB_FALLBACK_KEY = 'rohapp.db.fallback.v1';
var SCHEMA_VERSION = 5;
var VERSION = '1.2.3';
var SQL = null;
var db = null;
var dbReady = false;
var BASE = 'SAR';
var RATES = { SAR: 1, USD: 3.75, EUR: 4.05, YER: 1 / 410 };
var SAR_RATES = { SAR: 1, USD: 3.75, EUR: 4.05, YER: 1 / 410 };
var BASE_CROSS_OVERRIDES = {
YER: { YER: 1, SAR: 410, USD: 1560, YRO: 410 / 140 },
YRO: { YRO: 1, SAR: 140, USD: 531, YER: 140 / 410 }
};
function applyBase(code, sarRate) {
var rate = SAR_RATES[code] || Number(sarRate);
if (!(rate > 0)) return false;
BASE = code;
Object.keys(SAR_RATES).forEach(function (k) { RATES[k] = SAR_RATES[k] / rate; });
if (BASE_CROSS_OVERRIDES[code]) {
Object.keys(BASE_CROSS_OVERRIDES[code]).forEach(function (k) {
if (RATES[k] !== undefined) RATES[k] = BASE_CROSS_OVERRIDES[code][k];
});
}
return true;
}
function baseInRiyals() {
return SAR_RATES[BASE] || Number(state && state.settings && state.settings.baseSarRate) || 1;
}
function getRate(code) {
if (state && state.settings && state.settings.rates && state.settings.rates[code] != null) {
var v = Number(state.settings.rates[code]);
if (v > 0) return v;
}
return RATES[code] || 1;
}
function setRate(code, rate) {
if (!state) return { ok: false, error: 'المحرك غير محمّل' };
if (!state.settings) state.settings = {};
if (!state.settings.rates) state.settings.rates = {};
var v = Number(rate);
if (!(v > 0)) return { ok: false, error: 'سعر غير صالح' };
recordRateChange(code, getRate(code), v);
state.settings.rates[code] = v;
state.settings.ratesUpdatedAt = new Date().toISOString();
saveState();
return { ok: true };
}
var BASE_ACCOUNT_IDS = ['cash', 'wallet', 'bank', 'receivable', 'payable', 'capital', 'revenue', 'expense', 'fx_gain', 'fx_loss'];
function setBaseCurrency(code) {
if (!state) return { ok: false, error: 'المحرك غير محمّل' };
code = String(code || '').trim().toUpperCase();
if (code === BASE) return { ok: true, base: code };
if ((state.entries || []).length || (state.drafts || []).length) return { ok: false, error: 'لا يمكن تغيير العملة الأساسية بعد تسجيل حركة' };
var listed = listCurrencies().some(function (c) { return c.code === code; });
if (!SAR_RATES[code] && !(listed && getRate(code) > 0)) return { ok: false, error: 'هذه العملة لا تصلح عملة أساسية' };
var oldBase = BASE;
var factor = getRate(code);
var sarRate = factor * baseInRiyals();
if (state.settings.rates) {
var restated = {};
Object.keys(state.settings.rates).forEach(function (k) {
var r = Number(state.settings.rates[k]);
if (r > 0) restated[k] = r / factor;
});
state.settings.rates = restated;
}
applyBase(code, sarRate);
state.settings.baseCurrency = code;
state.settings.baseSarRate = sarRate;
state.settings.currency = code;
state.accounts.forEach(function (a) {
if (a.multi) return;
if (BASE_ACCOUNT_IDS.indexOf(a.id) >= 0 || (/^acc_/.test(a.id) && a.currency === oldBase)) a.currency = code;
});
saveState();
return { ok: true, base: code };
}
function getProfile() {
var p = state && state.settings && state.settings.profile;
return { name: (p && p.name) || '', business: (p && p.business) || '', phone: (p && p.phone) || '', email: (p && p.email) || '', photo: (p && p.photo) || '' };
}
var PROFILE_PHOTO_MAX = 300000;
function cleanProfilePhoto(value) {
var v = String(value || '');
return v.length <= PROFILE_PHOTO_MAX && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(v) ? v : '';
}
function setProfile(fields) {
var clean = function (v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max); };
var f = fields || {};
var photo = f.photo === undefined ? getProfile().photo : cleanProfilePhoto(f.photo);
getState().settings.profile = { name: clean(f.name, 40), business: clean(f.business, 60), phone: clean(f.phone, 20), email: clean(f.email, 80), photo: photo };
saveState();
return getProfile();
}
function setOnboarded(done) {
getState().settings.onboarded = !!done;
saveState();
}
var PERSONAS = {
student: {
key: 'student',
title: 'طالب جامعي / شباب',
subtitle: 'متابعة المصروفات اليومية، المكافأة الجامعية، وتقسيم الوجبات والفواتير',
welcomeText: 'وضع الطالب والشباب جاهز: تتبع مصروفاتك، مكافأتك، وتقسيم الفواتير والعشاء مع أصدقائك بسهولة. جرّب:',
settings: { simpleMode: true, reminders: true },
examples: [
'دفعت 25 قهوة',
'دفعت 60 مطعم',
'قسمت عشاء 150 ريال بيني وبين سعد وخالد',
'استلمت 1000 مكافأة',
'دفعت 80 كتب ومذكرات',
'كم رصيدي؟'
],
accounts: [
{ code: 'acc_food', name: 'الطعام والمقاهي', type: 'expense', subtype: 'مصروفات عامة', hint: 'مطاعم وقهوة وبقالة', glyph: '↗', keywords: ['قهوة', 'مطعم', 'غداء', 'عشاء', 'فطور', 'بقالة', 'كافيه', 'وجبة'] },
{ code: 'acc_transport', name: 'المواصلات والوقود', type: 'expense', subtype: 'مصروفات عامة', hint: 'بنزين ومشاوير', glyph: '↗', keywords: ['بنزين', 'وقود', 'مشوار', 'اوبر', 'كريم', 'تاكسي', 'مواصلات', 'باص'] },
{ code: 'acc_study', name: 'الدراسة والكتب', type: 'expense', subtype: 'مصروفات عامة', hint: 'قرطاسية ومراجع واشتراكات', glyph: '↗', keywords: ['كتب', 'كتاب', 'مذكرة', 'قرطاسية', 'دراسة', 'جامعة', 'دورة', 'اشتراك'] },
{ code: 'acc_housing', name: 'السكن والإيجار', type: 'expense', subtype: 'الإيجار', hint: 'إيجار وفواتير السكن', glyph: '↗', keywords: ['سكن', 'ايجار سكن', 'غرفة'] },
{ code: 'acc_allowance', name: 'المكافأة والراتب', type: 'revenue', subtype: 'إيرادات النشاط', hint: 'مكافأة شهرية أو دخل شخصي', glyph: '↙', keywords: ['مكافأة', 'مكافاه', 'مصروف شهري'] }
]
},
employee: {
key: 'employee',
title: 'موظف / راتب شهري',
subtitle: 'إدارة الراتب، الالتزامات الشهرية، أقساط التمويل، والبطاقات الائتمانية',
welcomeText: 'وضع الموظف جاهز: نظّم راتبك الشهري، سدد أقساطك والالتزامات الأسرية والبطاقات الائتمانية. جرّب:',
settings: { simpleMode: false, reminders: true },
examples: [
'استلمت راتب 12000 ريال',
'دفعت 1500 قسط السيارة',
'دفعت 800 مقاضي البيت',
'سددت 2000 فيزا',
'سددت 1000 للبنك و 500 لأحمد',
'كم المتبقي من الراتب؟'
],
accounts: [
{ code: 'acc_salary', name: 'الراتب والثوابت', type: 'revenue', subtype: 'إيرادات النشاط', hint: 'الراتب الشهري والبدلات', glyph: '↙', keywords: ['راتب', 'الراتب', 'بدل', 'حافز', 'مكافأة عمل'] },
{ code: 'acc_commitments', name: 'أقساط والتزامات تمويلية', type: 'expense', subtype: 'مصروفات عامة', hint: 'قسط سيارة وقروض شخصية', glyph: '↗', keywords: ['قسط', 'اقساط', 'تمويل', 'قرض', 'التزام'] },
{ code: 'acc_home_expenses', name: 'المصاريف المنزلية والأسرية', type: 'expense', subtype: 'مصروفات عامة', hint: 'مقاضي وسوبرماركت وفواتير', glyph: '↗', keywords: ['مقاضي', 'سوبرماركت', 'بيت', 'منزل', 'عائلة', 'كهرباء', 'ماء'] },
{ code: 'acc_personal_savings', name: 'الادخار والطوارئ', type: 'asset', subtype: 'سيولة نقدية', hint: 'صندوق الادخار للطوارئ', glyph: '◆', keywords: ['ادخار', 'طوارئ', 'مدخرات', 'توفير'] },
{ code: 'acc_credit_card', name: 'البطاقة الائتمانية', type: 'liability', subtype: 'الالتزامات', hint: 'رصيد ومستحقات الفيزا/الماستركارد', glyph: '▤', keywords: ['فيزا', 'بطاقة ائتمانية', 'بطاقه ائتمان', 'ماستركارد'] }
]
},
freelancer: {
key: 'freelancer',
title: 'أعمال حرة / خدمات',
subtitle: 'متابعة مستحقات المشاريع، فواتير العملاء، واشتراكات أدوات العمل',
welcomeText: 'وضع الأعمال الحرة جاهز: تتبع مستحقاتك لدى العملاء، مصاريف تشغيل خدماتك، وافصل سيولتك بسهولة. جرّب:',
settings: { simpleMode: false, reminders: true },
examples: [
'استلمت 5000 تصميم موقع',
'قدمت استشارة لعبدالله 3000 ولمحمد 2000 آجل',
'حصلت 5000 من عبدالله 3000 ومن محمد 2000',
'دفعت 150 دولار اشتراك سحابة/أدوات',
'كشف حساب عميل'
],
accounts: [
{ code: 'acc_freelance_rev', name: 'إيرادات الخدمات والمشاريع', type: 'revenue', subtype: 'إيرادات النشاط', hint: 'أتعاب استشارات وتصميم وبرمجة', glyph: '↙', keywords: ['موقع', 'تصميم', 'برمجة', 'استشارة', 'شعار', 'خدمة', 'مشروع'] },
{ code: 'acc_client_dues', name: 'ذمم ومستحقات العملاء', type: 'asset', subtype: 'العملاء', hint: 'مستحقات آجة لدى عملاء العمل الحر', glyph: '▤', keywords: ['عميل', 'عملاء', 'مستحق', 'دفعة مشروع'] },
{ code: 'acc_software_tools', name: 'أدوات واشتراكات عمل', type: 'expense', subtype: 'مصروفات عامة', hint: 'اشتراكات سحابية واستضافة وبرامج', glyph: '↗', keywords: ['استضافة', 'سحابة', 'اشتراك برامج', 'سيرفر', 'دومين'] },
{ code: 'acc_freelance_exp', name: 'مصاريف التشغيل الحر', type: 'expense', subtype: 'مصروفات عامة', hint: 'إعلانات ومصاريف تنفيذ', glyph: '↗', keywords: ['اعلانات', 'تسويق', 'عمولة منصة', 'تشغيل'] }
]
},
merchant: {
key: 'merchant',
title: 'تاجر / صاحب متجر',
subtitle: 'إدارة المبيعات، البضاعة، وديون العملاء والموردين مع كشوف الحسابات',
welcomeText: 'وضع التاجر جاهز: سجل مبيعاتك ومشتريات البضاعة وديون العملاء والموردين وأصدر كشوف الحسابات بضغطة زر. جرّب:',
settings: { simpleMode: false, reminders: true },
examples: [
'قبضت 1500 مبيعات اليوم',
'دفعت 3000 بضاعة',
'سلفت خالد 500 يرجعه بعد أسبوع',
'دفعت 2000 رواتب العمال',
'دفعت 1500 إيجار المحل',
'كشف حساب'
],
accounts: [
{ code: 'acc_inventory', name: 'مخزون البضاعة', type: 'asset', subtype: 'المخزون', hint: 'بضاعة المتجر والمشتريات', glyph: '▤', keywords: ['بضاعة', 'بضاعه', 'مخزون', 'كرتون', 'توريد', 'مشتريات'] },
{ code: 'acc_sales', name: 'مبيعات المتجر', type: 'revenue', subtype: 'إيرادات النشاط', hint: 'إيراد المبيعات اليومية', glyph: '↙', keywords: ['مبيعات', 'غلة', 'غله', 'كاشير', 'بيعة'] },
{ code: 'acc_rent', name: 'إيجار المحل', type: 'expense', subtype: 'الإيجار', hint: 'إيجار المعرض أو المستودع', glyph: '↗', keywords: ['ايجار المحل', 'ايجار المعرض', 'ايجار المستودع'] },
{ code: 'acc_wages', name: 'رواتب العمال', type: 'expense', subtype: 'الرواتب', hint: 'أجور ومرتبات', glyph: '↗', keywords: ['رواتب العمال', 'راتب عامل', 'اجور', 'يومية عامل'] },
{ code: 'acc_utilities', name: 'كهرباء وخدمات المحل', type: 'expense', subtype: 'الكهرباء والماء', hint: 'فواتير الكهرباء والماء والإنترنت', glyph: '↗', keywords: ['كهرباء المحل', 'فاتورة كهرباء', 'فاتورة ماء', 'انترنت المحل'] }
]
},
logistics: {
key: 'logistics',
title: 'النقل والمواصلات',
subtitle: 'إدارة أساطيل المركبات، سائقي الأجرة والتوصيل، الوقود، والصيانة',
welcomeText: 'وضع النقل والمواصلات جاهز: تابع إيرادات المشاوير والتوصيل، مصروفات المحروقات والصيانة، ومستحقات الشحن. جرّب:',
settings: { simpleMode: false, reminders: true },
examples: [
'استلمت 450 مشاوير اليوم',
'دفعت 120 بنزين وزيت',
'حصلت 3500 توصيل من شركة1 و 2000 من شركة2',
'دفعت 800 صيانة الشاحنة/السيارة',
'رواتب السائقين'
],
accounts: [
{ code: 'acc_fleet_assets', name: 'أساطيل ومركبات النقل والتوصيل', type: 'asset', subtype: 'الأصول الثابتة', hint: 'شاحنات وسيارات وحافلات نقل', glyph: '▤', keywords: ['شاحنة', 'سيارة نقل', 'دينا', 'باص', 'مركبة'] },
{ code: 'acc_fuel_maint', name: 'وقود وصيانة المركبات', type: 'expense', subtype: 'مصروفات عامة', hint: 'بنزين وديزل وتغيير زيت وقطع غيار', glyph: '↗', keywords: ['بنزين', 'ديزل', 'زيت', 'صيانة سيارة', 'اطارات', 'غسيل'] },
{ code: 'acc_freight_dues', name: 'مستحقات الشحن والتوصيل', type: 'asset', subtype: 'العملاء', hint: 'مستحقات آجة لدى شركات الشحن', glyph: '▤', keywords: ['توصيل', 'شحن', 'مشوار', 'نقلية', 'شركة شحن'] },
{ code: 'acc_driver_wages', name: 'أجور ومصروفات السائقين', type: 'expense', subtype: 'الرواتب', hint: 'مرتبات وإعاشة كباتن وسائقين', glyph: '↗', keywords: ['سائق', 'كابتن', 'اعاشة سائق', 'يومية سائق'] }
]
},
investor: {
key: 'investor',
title: 'مستثمر / إدارة ثروة',
subtitle: 'متابعة المحافظ الاستثمارية، العقارات، العوائد، ونمو صافي الثروة',
welcomeText: 'وضع المستثمر جاهز: تابع محفظة الأسهم والعقارات والذهب وتوزيعات الأرباح ونمو صافي ثروتك عبر الزمن. جرّب:',
settings: { simpleMode: false, reminders: true },
examples: [
'دفعت 5000 أسهم',
'استلمت 1200 توزيعات أرباح',
'دفعت 3000 ذهب',
'شريت أصول من خالد 100000 ومن سعد 50000 آجل',
'استلمت عوائد 10000 منها 6000 من عقار1 و 4000 من أسهم2',
'حلّل وضعي المالي باختصار'
],
accounts: [
{ code: 'acc_stocks', name: 'محفظة الأسهم', type: 'asset', subtype: 'استثمارات', hint: 'أسهم وصناديق استثمارية', glyph: '◆', keywords: ['أسهم', 'اسهم', 'سهم', 'تدأول', 'صندوق استثماري', 'اكتتاب'] },
{ code: 'acc_realestate', name: 'العقارات والأراضي', type: 'asset', subtype: 'الأراضي والمباني', hint: 'أصول عقارية استثمارية', glyph: '▤', keywords: ['عقار', 'عقارات', 'ارض', 'شقة استثمارية', 'فيلا'] },
{ code: 'acc_crypto', name: 'الأصول الرقمية والذهب', type: 'asset', subtype: 'استثمارات', hint: 'عملات رقمية ومعادن', glyph: '◆', keywords: ['ذهب', 'سبائك', 'عملات رقمية', 'بيتكوين', 'كريبتو'] },
{ code: 'acc_dividends', name: 'توزيعات وعوائد الاستثمار', type: 'revenue', subtype: 'إيرادات النشاط', hint: 'أرباح أسهم وإيجارات عقارات', glyph: '↙', keywords: ['توزيعات', 'عوائد', 'ارباح اسهم', 'عائد ايجار'] },
{ code: 'acc_inv_fees', name: 'عمولات ومصاريف استثمارية', type: 'expense', subtype: 'مصروفات عامة', hint: 'رسوم تدأول وصيانة أصول', glyph: '↗', keywords: ['عمولة تدأول', 'رسوم محفظة', 'عمولات استثمار'] }
]
},
contractor: {
key: 'contractor',
title: 'المقأولات وتأجير المعدات والمهندسين',
subtitle: 'إدارة مستخلصات المشاريع، المعدات الثقيلة، أتعاب الهندسة، ومقأولي الباطن',
welcomeText: 'وضع المقأولات والمهندسين جاهز: سجل مستخلصاتك الهندسية، مصاريف المعدات والديزل، والالتزامات لمقأولي الباطن. جرّب:',
settings: { simpleMode: false, reminders: true },
examples: [
'قبضت 80000 مستخلص مشروع',
'دفعت 15000 ديزل وصيانة',
'سددت لمقأولي الباطن 20000 منها 12000 لخالد و 8000 لسعد',
'قبضت أتعاب استشارة هندسية 15000 من الشركة1',
'شريت معدة بـ 120000 كاش وتسهيلات'
],
accounts: [
{ code: 'acc_equipment', name: 'معدات وآليات ثقيلة', type: 'asset', subtype: 'الأصول الثابتة', hint: 'بوكلينات وحفارات ومعدات ثقيلة', glyph: '▤', keywords: ['معدة', 'بوكلين', 'حفار', 'رافعة', 'شيول', 'اليات'] },
{ code: 'acc_project_rev', name: 'مستخلصات وإيرادات مشاريع وهندسية', type: 'revenue', subtype: 'إيرادات النشاط', hint: 'إيرادات مستخلصات واستشارات هندسية', glyph: '↙', keywords: ['مستخلص', 'مشروع', 'مستخلصات', 'استشارة هندسية', 'اشراف'] },
{ code: 'acc_diesel_maint', name: 'ديزل وصيانة المعدات', type: 'expense', subtype: 'مصروفات عامة', hint: 'محروقات ديزل وزيوت وقطع غيار', glyph: '↗', keywords: ['ديزل', 'زيوت معدات', 'قطع غيار', 'صيانة بوكلين'] },
{ code: 'acc_subcontractors', name: 'مستحقات مقأولي الباطن والمهندسين', type: 'liability', subtype: 'الموردين', hint: 'التزامات مالية لمقأولي الباطن والمكاتب', glyph: '▤', keywords: ['مقأول باطن', 'مستحقات مقأول', 'مهندس باطن'] }
]
},
landlord: {
key: 'landlord',
title: 'أصحاب العقارات والمؤجرين',
subtitle: 'إدارة محفظة العقارات، متابعة ديون المستأجرين، صيانة الوحدات، وعوائد الإيجار',
welcomeText: 'وضع العقارات والمؤجرين جاهز: تابع عقاراتك ووحداتك المؤجرة، متأخرات المستأجرين، ومصروفات الصيانة لكل عقار. جرّب:',
settings: { simpleMode: false, reminders: true },
examples: [
'قبضت إيجارات 15000 منها 10000 من عبدالأحد و 5000 من فهد',
'دفعت 3500 صيانة العمارة منها 2000 لشقة1 و 1500 لشقة2',
'شريت عقار بـ 500000 دفعت 200000 والباقي تمويل',
'قبضت 3000 إيجار 2000 كاش والباقي 1000 على فهد',
'كشف حساب مستأجر'
],
accounts: [
{ code: 'acc_property_portfolio', name: 'أصول ومباني عقارية', type: 'asset', subtype: 'الأراضي والمباني', hint: 'عمارات وشقق ومحلات استثمارية', glyph: '▤', keywords: ['عمارة', 'شقة مؤجرة', 'معرض مؤجر', 'مبنى عقاري', 'فيلا مؤجرة'] },
{ code: 'acc_rental_rev', name: 'إيرادات إيجارات وحدات', type: 'revenue', subtype: 'إيرادات النشاط', hint: 'عائد إيجارات الشقق والمحلات', glyph: '↙', keywords: ['ايجار شقة', 'ايجار محل', 'ايجارات', 'عائد ايجاري'] },
{ code: 'acc_tenant_dues', name: 'ذمم ومستحقات المستأجرين', type: 'asset', subtype: 'العملاء', hint: 'متأخرات وديون على المستأجرين', glyph: '▤', keywords: ['مستأجر', 'مستاجر', 'دين مستأجر', 'متأخرات ايجار'] },
{ code: 'acc_property_maint', name: 'صيانة وتجديد عقارات', type: 'expense', subtype: 'مصروفات عامة', hint: 'صيانة سباكة وكهرباء ودهان للعقارات', glyph: '↗', keywords: ['صيانة عمارة', 'سباكة شقة', 'كهرباء شقة', 'دهان شقة', 'ترميم'] },
{ code: 'acc_property_tax_services', name: 'فواتير وخدمات عقارية', type: 'expense', subtype: 'مصروفات عامة', hint: 'رسوم خدمات وحراسة وفواتير العقارات', glyph: '↗', keywords: ['حراسة عمارة', 'نظافة عمارة', 'رسوم عقار'] }
]
}
};
function getPersona() {
var st = getState();
return (st && st.settings && st.settings.persona) || '';
}
function applyPersona(key, overrides) {
var p = PERSONAS[key];
if (!p) return { ok: false, error: 'شخصية غير معروفة' };
var st = getState();
var targetCodes = {};
(p.accounts || []).forEach(function (tpl) { targetCodes[tpl.code] = true; });
var otherPersonaCodes = {};
Object.keys(PERSONAS).forEach(function (pk) {
if (pk === key) return;
(PERSONAS[pk].accounts || []).forEach(function (tpl) {
if (!targetCodes[tpl.code]) otherPersonaCodes[tpl.code] = true;
});
});
st.accounts = (st.accounts || []).filter(function (acc) {
if (!otherPersonaCodes[acc.id]) return true;
return isAccountLocked(acc.id);
});
_stateRev++;
st.settings.persona = p.key;
var opts = overrides || {};
var simple = typeof opts.simpleMode === 'boolean' ? opts.simpleMode : !!p.settings.simpleMode;
st.settings.simpleMode = simple;
var added = [];
(p.accounts || []).forEach(function (tpl) {
var existing = getAccount(tpl.code);
if (existing) return;
var res = addAccount({
code: tpl.code,
name: tpl.name,
type: tpl.type,
subtype: tpl.subtype,
hint: tpl.hint,
glyph: tpl.glyph,
currency: BASE,
liquid: false
});
if (res && res.ok) added.push(res.account);
});
if (db) {
try {
db.run("DELETE FROM semantic_dictionary WHERE source = 'persona'");
var nowIso = new Date().toISOString();
(p.accounts || []).forEach(function (tpl) {
var mappedAction = tpl.type === 'revenue' ? 'قبض' : 'صرف';
(tpl.keywords || []).forEach(function (kw) {
var normKw = normalizeAr(kw).trim();
if (!normKw) return;
db.run('INSERT OR REPLACE INTO semantic_dictionary (keyword, mapped_action, account_hint, account_id, usage_count, last_used, language, source) VALUES (?,?,?,?,?,?,?,?)',
[normKw, mappedAction, tpl.name, tpl.code, 1, nowIso, 'ar', 'persona']);
});
});
reloadMemory();
} catch (e) {}
}
saveState();
return { ok: true, persona: p.key, simpleMode: simple, addedAccounts: added };
}
function RATES_LIVE() {
var out = {};
listCurrencies().forEach(function (c) { out[c.code] = c.rate; });
return out;
}
function reminderHour() {
var t = (getState().settings && getState().settings.reminderTime) || '09:00';
var h = parseInt(String(t).split(':')[0], 10);
if (!isFinite(h) || h < 0 || h > 23) h = 9;
return h;
}
function setReminderTime(time) {
var m = String(time || '').match(/^(\d{1,2}):(\d{2})$/);
if (!m) return { ok: false, error: 'صيغة الوقت: HH:MM' };
var h = Number(m[1]), mm = Number(m[2]);
if (h < 0 || h > 23 || mm < 0 || mm > 59) return { ok: false, error: 'وقت غير صالح' };
getState().settings.reminderTime = ('0' + h).slice(-2) + ':' + ('0' + mm).slice(-2);
saveState();
return { ok: true, time: getState().settings.reminderTime };
}
function setAutoBackup(value) {
getState().settings.autoBackup = !!value;
saveState();
return { ok: true, value: !!value };
}
var REMINDER_LIMIT = 60;
function notifyDetail() {
var v = state && state.settings && state.settings.notifyDetail;
return v === 'name' || v === 'full' ? v : 'general';
}
function setNotifyDetail(value) {
if (!state) return { ok: false, error: 'المحرك غير محمّل' };
state.settings.notifyDetail = value === 'name' || value === 'full' ? value : 'general';
saveState();
return { ok: true };
}
function dueCountText(n, when) {
if (n === 1) return 'عندك استحقاق ' + when + '.';
if (n === 2) return 'عندك استحقاقان ' + when + '.';
return 'عندك ' + n + (n <= 10 ? ' استحقاقات ' : ' استحقاقاً ') + when + '.';
}
var NOTIFY_CATEGORIES = ['reminders', 'alerts', 'recurring', 'drafts', 'summary', 'system'];
function quietHoursOn() { var s = getState(); return !!(s && s.settings && s.settings.quietHours); }
function quietStart() { var s = getState(); return (s && s.settings && s.settings.quietStart) || '22:00'; }
function quietEnd() { var s = getState(); return (s && s.settings && s.settings.quietEnd) || '07:00'; }
function dailyCap() { var s = getState(); var n = Number(s && s.settings && s.settings.dailyCap); return n > 0 ? Math.round(n) : 3; }
function backupReminderDays() { var s = getState(); var n = Number(s && s.settings && s.settings.backupReminderDays); return n > 0 ? Math.round(n) : 1; }
function applyQuietHours(at, ignore) {
if (ignore || !quietHoursOn()) return at;
var d = new Date(at);
var h = d.getHours(), m = d.getMinutes();
var sh = parseInt(quietStart().split(':')[0], 10), sm = parseInt(quietStart().split(':')[1], 10);
var eh = parseInt(quietEnd().split(':')[0], 10), em = parseInt(quietEnd().split(':')[1], 10);
var startMin = sh * 60 + sm, endMin = eh * 60 + em, curMin = h * 60 + m;
var inWindow = startMin < endMin ? (curMin >= startMin && curMin < endMin) : (curMin >= startMin || curMin < endMin);
if (!inWindow) return at;
var out = new Date(d);
out.setHours(eh, em, 0, 0);
if (out.getTime() <= at) out.setDate(out.getDate() + 1);
return out.getTime();
}
function notificationSeen() { var s = getState(); if (!s.settings.notificationSeen) s.settings.notificationSeen = {}; return s.settings.notificationSeen; }
function notificationSeenKey(key) { var seen = notificationSeen(); var now = Date.now(); if (!seen[key]) seen[key] = now; return key; }
function pruneNotificationSeen() { var seen = notificationSeen(); var cutoff = Date.now() - 40 * 86400000; Object.keys(seen).forEach(function (k) { if (seen[k] < cutoff) delete seen[k]; }); }
function quietHoursOn() { var s = getState(); return !!(s && s.settings && s.settings.quietHours); }
function quietStart() { var s = getState(); return (s && s.settings && s.settings.quietStart) || '22:00'; }
function quietEnd() { var s = getState(); return (s && s.settings && s.settings.quietEnd) || '07:00'; }
function dailyCap() { var s = getState(); var n = Number(s && s.settings && s.settings.dailyCap); return n > 0 ? Math.round(n) : 3; }
function backupReminderDays() { var s = getState(); var n = Number(s && s.settings && s.settings.backupReminderDays); return n > 0 ? Math.round(n) : 1; }
function applyQuietHours(at, ignore) {
if (ignore || !quietHoursOn()) return at;
var d = new Date(at);
var sh = parseInt(quietStart().split(':')[0], 10), sm = parseInt(quietStart().split(':')[1], 10);
var eh = parseInt(quietEnd().split(':')[0], 10), em = parseInt(quietEnd().split(':')[1], 10);
var curMin = d.getHours() * 60 + d.getMinutes();
var startMin = sh * 60 + sm, endMin = eh * 60 + em;
var inWindow = startMin < endMin ? (curMin >= startMin && curMin < endMin) : (curMin >= startMin || curMin < endMin);
if (!inWindow) return at;
var out = new Date(d);
out.setHours(eh, em, 0, 0);
if (out.getTime() <= at) out.setDate(out.getDate() + 1);
return out.getTime();
}
function notificationCategoryOn(cat) {
if (NOTIFY_CATEGORIES.indexOf(cat) < 0) return false;
if (cat === 'reminders') return !!(state && state.settings.remindersEnabled);
var saved = state && state.settings.notifyCategories;
return !(saved && saved[cat] === false);
}
function setNotificationCategory(cat, value) {
if (NOTIFY_CATEGORIES.indexOf(cat) < 0) return { ok: false, error: 'فئة إشعار غير معروفة' };
var settings = getState().settings;
if (cat === 'reminders') settings.remindersEnabled = !!value;
else {
settings.notifyCategories = settings.notifyCategories || {};
settings.notifyCategories[cat] = !!value;
}
saveState();
return { ok: true, category: cat, on: notificationCategoryOn(cat) };
}
function quietHoursOn() { return !!(state && state.settings && state.settings.quietHours); }
function quietStart() { var s = state && state.settings && state.settings.quietStart; return typeof s === 'string' && /^\d{2}:\d{2}$/.test(s) ? s : '22:00'; }
function quietEnd() { var s = state && state.settings && state.settings.quietEnd; return typeof s === 'string' && /^\d{2}:\d{2}$/.test(s) ? s : '07:00'; }
function dailyCap() { var n = state && state.settings && Number(state.settings.dailyCap); return isFinite(n) && n >= 0 ? Math.round(n) : 3; }
function backupReminderDays() { var n = state && state.settings && Number(state.settings.backupReminderDays); return isFinite(n) && n >= 0 ? Math.round(n) : 30; }
function inQuietHours(ms) {
if (!quietHoursOn()) return false;
var d = new Date(ms);
var m = d.getHours() * 60 + d.getMinutes();
var sp = quietStart().split(':'); var ep = quietEnd().split(':');
var s = (+sp[0] || 0) * 60 + (+sp[1] || 0);
var e = (+ep[0] || 0) * 60 + (+ep[1] || 0);
if (s < e) return m >= s && m < e;
return m >= s || m < e;
}
function nextAllowedTime(ms) {
if (!inQuietHours(ms)) return ms;
var d = new Date(ms);
var ep = quietEnd().split(':');
var eh = +ep[0] || 0, em = +ep[1] || 0;
var target = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em, 0).getTime();
if (target <= ms) target += 86400000;
return target;
}
function phaseBNotifications(nowMs) {
if (!state || !state.settings) return [];
var now = nowMs == null ? Date.now() : nowMs;
var out = [];
var today = new Date(now).toISOString().slice(0, 10);
var seen = (state.settings.notificationSeen && typeof state.settings.notificationSeen === 'object') ? state.settings.notificationSeen : {};
var markSeen = function (key) { if (!state.settings.notificationSeen) state.settings.notificationSeen = {}; state.settings.notificationSeen[key] = today; };
if (notificationCategoryOn('alerts')) {
(computeAnalysis().dueItems || []).forEach(function (d) {
if (!(d.remaining > 0) || !isValidDate(d.dueDate) || d.dueDate >= today) return;
var key = 'overdue:' + (d.id || '') + ':' + today;
if (seen[key]) return;
var hour = reminderHour(); var minute = parseInt(String(state.settings.reminderTime || '09:00').split(':')[1], 10);
if (!(minute >= 0 && minute <= 59)) minute = 0;
var parts = d.dueDate.split('-');
var at = new Date(+parts[0], +parts[1] - 1, +parts[2], hour, minute, 0).getTime();
if (at > now) return;
at = nextAllowedTime(now + 60000);
var who = d.counterparty || 'طرف غير محدد';
var money = fmtMoney(d.remaining);
var body = (d.kind === 'receivable' ? 'تحصيل ' : 'دفعة ') + money + ' من ' + who + ' متأخر.';
out.push({ at: at, title: 'استحقاق متأخر', body: body, publicBody: 'عندك استحقاق متأخر.', dueId: d.id, category: 'alerts', _key: key });
});
}
if (notificationCategoryOn('recurring') && typeof recurringDue === 'function') {
(recurringDue() || []).forEach(function (r) {
var key = 'recurring:' + (r.id || '') + ':' + today;
if (seen[key]) return;
var at = nextAllowedTime(now + 60000);
var body = (r.memo || 'قيد متكرر') + ' مستحق اليوم. ' + fmtMoney(r.amountMinor, r.currency);
out.push({ at: at, title: 'قيد متكرر', body: body, publicBody: 'عندك قيد متكرر مستحق.', dueId: '', category: 'recurring', _key: key });
});
}
if (notificationCategoryOn('alerts') && typeof budgetList === 'function' && typeof budgetStatus === 'function') {
(budgetList() || []).forEach(function (b) {
var stt = budgetStatus(b.accountId);
if (!stt) return;
var level = stt.over ? '100' : (stt.pct >= 80 ? '80' : '');
if (!level) return;
var key = 'budget:' + (b.accountId || '') + ':' + today.slice(0, 7) + ':' + level;
if (seen[key]) return;
var at = nextAllowedTime(now + 60000);
var name = (getAccount(b.accountId) && getAccount(b.accountId).name) || b.accountId;
var body = level === '100'
? 'تجاوزت ميزانية «' + name + '» بـ ' + fmtMoney(stt.spentMinor - (stt.limitBase || 0)) + '.'
: 'ميزانية «' + name + '» وصلت ' + stt.pct + '%. المتبقي: ' + fmtMoney(Math.max(0, (stt.limitBase || 0) - stt.spentMinor)) + '.';
out.push({ at: at, title: 'ميزانية', body: body, publicBody: 'عندك تنبيه ميزانية.', dueId: '', category: 'alerts', _key: key });
});
}
if (notificationCategoryOn('alerts')) {
(state.accounts || []).forEach(function (a) {
if (!a.liquid) return;
var bal = computeAnalysis().balances && computeAnalysis().balances[a.id];
if (!bal || bal.base >= 0) return;
var key = 'overdraft:' + (a.id || '') + ':' + today;
if (seen[key]) return;
var at = nextAllowedTime(now + 60000);
var body = '«' + (a.name || a.id) + '» سالب ' + fmtMoney(Math.abs(bal.native), a.currency, false) + '. راجع حركاتك.';
out.push({ at: at, title: 'سحب على المكشوف', body: body, publicBody: 'عندك حساب سالب.', dueId: '', category: 'alerts', _key: key });
});
}
if (notificationCategoryOn('drafts')) {
(state.drafts || []).forEach(function (d) {
var created = d.createdAt || d.at;
if (!created) return;
var age = now - new Date(created).getTime();
if (age < 86400000) return;
var key = 'draft:' + (d.id || '') + ':' + today;
if (seen[key]) return;
var at = nextAllowedTime(now + 60000);
var body = 'قيد «' + (d.memo || 'مسودة') + '» بانتظار التأكيد desde ' + Math.floor(age / 86400000) + ' يوم.';
out.push({ at: at, title: 'قيد معلّق', body: body, publicBody: 'عندك قيد بانتظار التأكيد.', dueId: '', category: 'drafts', _key: key });
});
}
if (notificationCategoryOn('alerts')) {
var month = today.slice(0, 7);
var count = (state.entries || []).filter(function (e) { return String(e.date || '').slice(0, 7) === month; }).length;
if (count >= 48) {
var key = 'limit:' + month;
if (!seen[key]) {
var at = nextAllowedTime(now + 60000);
var body = 'استخدمت ' + count + ' من 60 قيد هذا الشهر. ' + (count >= 60 ? 'بلغت الحد.' : 'تبقّى ' + (60 - count) + ' قيد.');
out.push({ at: at, title: 'حد القيود', body: body, publicBody: 'عندك تنبيه بحد القيود.', dueId: '', category: 'alerts', _key: key });
}
}
}
if (notificationCategoryOn('system')) {
var last = state.settings.lastBackupAt;
var days = last ? (now - new Date(last).getTime()) / 86400000 : 999;
if (days >= backupReminderDays()) {
var month = today.slice(0, 7);
var key = 'backup:' + month;
if (!seen[key]) {
var at = nextAllowedTime(now + 60000);
var body = 'لم تأخذ نسخة احتياطية منذ ' + (last ? Math.floor(days) + ' يوماً' : 'فترة طويلة') + '. خذ نسخة مشفّرة من الإعدادات.';
out.push({ at: at, title: 'نسخة احتياطية', body: body, publicBody: 'تذكير بنسخة احتياطية.', dueId: '', category: 'system', _key: key });
}
}
}
return out;
}
function notificationSchedule(nowMs) {
if (!state || !state.settings) return [];
var now = nowMs == null ? Date.now() : nowMs;
var due = notificationCategoryOn('reminders') ? reminderSchedule(now) : [];
due.forEach(function (s) { s.category = 'reminders'; });
var extra = phaseBNotifications(now);
var merged = due.concat(extra);
var dueToday = merged.filter(function (s) { return s.category === 'reminders' && new Date(s.at).toISOString().slice(0, 10) === new Date(now).toISOString().slice(0, 10); });
var others = merged.filter(function (s) { return !(s.category === 'reminders' && new Date(s.at).toISOString().slice(0, 10) === new Date(now).toISOString().slice(0, 10)); });
var cap = dailyCap();
if (cap >= 0 && others.length > cap) {
var priority = { overdue: 0, alerts: 1, recurring: 2, drafts: 3, summary: 4, system: 5 };
others.sort(function (a, b) { return (priority[a.category] != null ? priority[a.category] : 9) - (priority[b.category] != null ? priority[b.category] : 9); });
others = others.slice(0, cap);
}
var final = dueToday.concat(others).sort(function (a, b) { return a.at - b.at; });
final.forEach(function (s) { if (s._key) markNotificationSeen(s._key); });
return final.map(function (s) {
var copy = {};
Object.keys(s).forEach(function (k) { if (k.charAt(0) !== '_') copy[k] = s[k]; });
return copy;
});
}
function markNotificationSeen(key) {
if (!key) return;
if (!state.settings.notificationSeen) state.settings.notificationSeen = {};
state.settings.notificationSeen[key] = new Date().toISOString().slice(0, 10);
}
function notificationSchedule(nowMs) {
var now = nowMs == null ? Date.now() : nowMs;
var out = [];
pruneNotificationSeen();
var seen = notificationSeen();
if (state && state.settings.remindersEnabled) {
var detail = notifyDetail();
var hour = reminderHour();
var minute = parseInt(String(state.settings.reminderTime || '09:00').split(':')[1], 10);
if (!(minute >= 0 && minute <= 59)) minute = 0;
var slots = [];
(state.dueItems || []).forEach(function (d) {
if (!(d.remaining > 0) || !isValidDate(d.dueDate)) return;
var parts = d.dueDate.split('-');
var dueAt = new Date(+parts[0], +parts[1] - 1, +parts[2], hour, minute, 0).getTime();
var dayBefore = new Date(+parts[0], +parts[1] - 1, +parts[2] - 1, hour, minute, 0).getTime();
if (dayBefore > now) slots.push({ at: dayBefore, when: 'غداً', d: d });
if (dueAt > now) slots.push({ at: dueAt, when: 'اليوم', d: d });
});
if (detail === 'general') {
var byAt = {};
slots.forEach(function (sl) { (byAt[sl.at] = byAt[sl.at] || []).push(sl); });
Object.keys(byAt).forEach(function (at) {
var group = byAt[at];
var body = dueCountText(group.length, group[0].when);
out.push({ at: applyQuietHours(+at, true), title: 'تذكير بالاستحقاقات', body: body, publicBody: body, dueId: group.length === 1 ? group[0].d.id : '', category: 'reminders' });
});
} else {
slots.forEach(function (sl) {
var d = sl.d;
var who = d.counterparty || 'طرف غير محدد';
var money = detail === 'full' ? ' ' + fmtMoney(d.remaining) : '';
var what = d.kind === 'receivable' ? 'تحصيل' + money + ' من ' + who : 'دفعة' + money + ' ' + toParty(who);
out.push({ at: applyQuietHours(sl.at, true), title: sl.when === 'غداً' ? 'استحقاق غداً' : 'استحقاق اليوم', body: what + ' ' + sl.when + '.', publicBody: dueCountText(1, sl.when), dueId: d.id, category: 'reminders' });
});
}
}
if (notificationCategoryOn('alerts')) {
(state.dueItems || []).forEach(function (d) {
if (!(d.remaining > 0) || !isValidDate(d.dueDate)) return;
if (d.dueDate >= todayISO()) return;
var key = 'overdue:' + d.id + ':' + todayISO();
if (seen[key]) return;
var parts = d.dueDate.split('-');
var at = applyQuietHours(new Date(+parts[0], +parts[1] - 1, +parts[2], 9, 0, 0).getTime(), false);
if (at <= now) at = applyQuietHours(now + 60000, false);
out.push({ at: at, title: 'استحقاق متأخر', body: (d.kind === 'receivable' ? 'تحصيل من ' : 'دفعة ') + (d.counterparty || 'طرف') + ' متأخر ' + Math.abs(daysBetween(d.dueDate, todayISO())) + ' يوم.', publicBody: 'عندك استحقاق متأخر.', dueId: d.id, category: 'alerts' });
notificationSeenKey(key);
});
}
if (notificationCategoryOn('recurring')) {
var recDue = (recurringDue ? recurringDue() : []) || [];
recDue.forEach(function (r) {
var key = 'recurring:' + r.id + ':' + todayISO();
if (seen[key]) return;
var at = applyQuietHours(now + 120000, false);
out.push({ at: at, title: 'قيد متكرر مستحق', body: 'القيد «' + (r.memo || r.id) + '» حان موعده. ' + money(r.amountMinor, r.currency), publicBody: 'عندك قيد متكرر مستحق.', dueId: '', category: 'recurring' });
notificationSeenKey(key);
});
}
if (notificationCategoryOn('alerts')) {
var budgets = (budgetList ? budgetList() : []) || [];
budgets.forEach(function (b) {
var stt = budgetStatus ? budgetStatus(b.accountId) : null;
if (!stt) return;
var level = stt.over ? '100' : (stt.pct >= 80 ? '80' : '');
if (!level) return;
var key = 'budget:' + b.accountId + ':' + todayISO().slice(0, 7) + ':' + level;
if (seen[key]) return;
var at = applyQuietHours(now + 180000, false);
var acc = getAccount(b.accountId);
out.push({ at: at, title: level === '100' ? 'تجاوزت الميزانية' : 'ميزانية close 80%', body: (acc ? acc.name : b.accountId) + ': ' + stt.pct + '% من ' + fmtMoney(stt.limitBase || 0) + '.', publicBody: 'أحد الميزانيات close 80%.', dueId: '', category: 'alerts' });
notificationSeenKey(key);
});
}
if (notificationCategoryOn('alerts')) {
var _bal = computeAnalysis().balances || {};
(state.accounts || []).forEach(function (a) {
if (!a.liquid) return;
var bal = _bal[a.id];
if (!bal || bal.base >= 0) return;
var key = 'overdraft:' + a.id + ':' + todayISO();
if (seen[key]) return;
var at = applyQuietHours(now + 240000, false);
out.push({ at: at, title: 'سحب على المكشوف', body: '«' + a.name + '» سالب ' + fmtMoney(Math.abs(bal.native), a.currency, false) + '.', publicBody: 'عندك حساب سالب.', dueId: '', category: 'alerts' });
notificationSeenKey(key);
});
}
if (notificationCategoryOn('drafts')) {
var oneDay = 86400000;
(state.drafts || []).forEach(function (dr) {
var created = dr.createdAt ? new Date(dr.createdAt).getTime() : 0;
if (!created || now - created < oneDay) return;
var key = 'draft:' + dr.id + ':' + todayISO();
if (seen[key]) return;
var at = applyQuietHours(now + 300000, false);
out.push({ at: at, title: 'قيد بانتظار التأكيد', body: 'قيد لم تؤكده منذ ' + Math.floor((now - created) / 86400000) + ' يوم.', publicBody: 'عندك قيد بانتظار التأكيد.', dueId: '', category: 'drafts' });
notificationSeenKey(key);
});
}
if (notificationCategoryOn('alerts') && ENTRY_LIMIT_ENFORCED) {
var count = 0;
(state.entries || []).forEach(function (e) { if (e.date && e.date.slice(0, 7) === todayISO().slice(0, 7) && !e.corrects) count++; });
if (count >= 48) {
var key = 'limit:' + todayISO().slice(0, 7);
if (!seen[key]) {
var at = applyQuietHours(now + 360000, false);
out.push({ at: at, title: 'اقتربت من حد القيود', body: 'سجّلت ' + count + ' قيداً هذا الشهر من 60. فعّل النسخة الكاملة لتواصل.', publicBody: 'اقتربت من حد القيود الشهري.', dueId: '', category: 'alerts' });
notificationSeenKey(key);
}
}
}
if (notificationCategoryOn('system')) {
var last = state.settings.lastBackupAt ? new Date(state.settings.lastBackupAt).getTime() : 0;
var days = last ? Math.floor((now - last) / 86400000) : 999;
if (days >= backupReminderDays()) {
var key = 'backup:' + todayISO().slice(0, 7);
if (!seen[key]) {
var at = applyQuietHours(now + 420000, false);
out.push({ at: at, title: 'نسخة احتياطية', body: 'مر ' + (last ? days + ' يوماً' : 'وقت طويل') + ' منذ آخر نسخة احتياطية مشفّرة.', publicBody: 'تذكير بنسخة احتياطية.', dueId: '', category: 'system' });
notificationSeenKey(key);
}
}
}
var priority = { overdue: 1, overdraft: 2, budget100: 3, recurring: 4, budget80: 5, draft: 6, limit: 7, backup: 8 };
var dueToday = out.filter(function (n) { return n.category === 'reminders'; });
var rest = out.filter(function (n) { return dueToday.indexOf(n) < 0; });
if (rest.length > dailyCap()) {
rest.sort(function (a, b) { return (priority[a.title] || 9) - (priority[b.title] || 9); });
rest = rest.slice(0, dailyCap());
}
out = dueToday.concat(rest);
out = out.map(function (n) { return n; });
return out.sort(function (a, b) { return a.at - b.at; }).slice(0, 60);
}
function reminderSchedule(nowMs) {
return notificationSchedule(nowMs).filter(function (n) { return n.category === 'reminders'; });
}
function recordLaunch() {
var settings = getState().settings;
settings.launchCount = (settings.launchCount || 0) + 1;
return settings.launchCount;
}
function setLastBackupAt(iso) {
if (!state || !state.settings) return;
state.settings.lastBackupAt = iso || new Date().toISOString();
saveState();
return { ok: true, at: state.settings.lastBackupAt };
}
function getLastBackupAt() {
return (state && state.settings && state.settings.lastBackupAt) || null;
}
function setQuietHours(value) { getState().settings.quietHours = !!value; saveState(); return { ok: true, on: !!getState().settings.quietHours }; }
function setQuietStart(value) { if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return { ok: false, error: 'وقت غير صالح' }; getState().settings.quietStart = value; saveState(); return { ok: true, time: value }; }
function setQuietEnd(value) { if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return { ok: false, error: 'وقت غير صالح' }; getState().settings.quietEnd = value; saveState(); return { ok: true, time: value }; }
function setDailyCap(value) { var n = Number(value); if (!(n > 0)) return { ok: false, error: 'عدد غير صالح' }; getState().settings.dailyCap = Math.round(n); saveState(); return { ok: true, cap: Math.round(n) }; }
function setBackupReminderDays(value) { var n = Number(value); if (!(n > 0)) return { ok: false, error: 'عدد غير صالح' }; getState().settings.backupReminderDays = Math.round(n); saveState(); return { ok: true, days: Math.round(n) }; }
function setRemindersEnabled(value) { getState().settings.remindersEnabled = !!value; saveState(); return { ok: true, enabled: !!getState().settings.remindersEnabled }; }
function recordBackup() { getState().settings.lastBackupAt = new Date().toISOString(); saveState(); return { ok: true, at: getState().settings.lastBackupAt }; }
function setQuietHours(value) { getState().settings.quietHours = !!value; saveState(); return { ok: true, on: !!getState().settings.quietHours }; }
function setQuietStart(value) { if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return { ok: false, error: 'وقت غير صالح' }; getState().settings.quietStart = value; saveState(); return { ok: true, time: value }; }
function setQuietEnd(value) { if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return { ok: false, error: 'وقت غير صالح' }; getState().settings.quietEnd = value; saveState(); return { ok: true, time: value }; }
function setDailyCap(value) { var n = Number(value); if (!isFinite(n) || n < 0) return { ok: false, error: 'عدد غير صالح' }; getState().settings.dailyCap = Math.round(n); saveState(); return { ok: true, cap: getState().settings.dailyCap }; }
function setBackupReminderDays(value) { var n = Number(value); if (!isFinite(n) || n < 0) return { ok: false, error: 'عدد غير صالح' }; getState().settings.backupReminderDays = Math.round(n); saveState(); return { ok: true, days: getState().settings.backupReminderDays }; }
function setQuietHours(value) { var s = getState().settings; s.quietHours = !!value; if (!s.quietStart) s.quietStart = '22:00'; if (!s.quietEnd) s.quietEnd = '07:00'; saveState(); return { ok: true, on: !!s.quietHours }; }
function setQuietStart(v) { var s = getState().settings; if (!/^\d{2}:\d{2}$/.test(v)) return { ok: false, error: 'وقت غير صالح' }; s.quietStart = v; saveState(); return { ok: true, time: v }; }
function setQuietEnd(v) { var s = getState().settings; if (!/^\d{2}:\d{2}$/.test(v)) return { ok: false, error: 'وقت غير صالح' }; s.quietEnd = v; saveState(); return { ok: true, time: v }; }
function setDailyCap(n) { var v = Number(n); if (!(v > 0)) return { ok: false, error: 'عدد غير صالح' }; getState().settings.dailyCap = Math.round(v); saveState(); return { ok: true, cap: Math.round(v) }; }
function setBackupReminderDays(n) { var v = Number(n); if (!(v > 0)) return { ok: false, error: 'عدد غير صالح' }; getState().settings.backupReminderDays = Math.round(v); saveState(); return { ok: true, days: Math.round(v) }; }
function setQuietHours(value) { var s = getState().settings; s.quietHours = !!value; if (!s.quietStart) s.quietStart = '22:00'; if (!s.quietEnd) s.quietEnd = '07:00'; saveState(); return { ok: true, on: !!s.quietHours }; }
function setQuietStart(v) { var s = getState().settings; if (!/^\d{2}:\d{2}$/.test(v)) return { ok: false, error: 'وقت غير صالح' }; s.quietStart = v; saveState(); return { ok: true, time: v }; }
function setQuietEnd(v) { var s = getState().settings; if (!/^\d{2}:\d{2}$/.test(v)) return { ok: false, error: 'وقت غير صالح' }; s.quietEnd = v; saveState(); return { ok: true, time: v }; }
function setDailyCap(n) { var v = Number(n); if (!(v > 0)) return { ok: false, error: 'عدد غير صالح' }; getState().settings.dailyCap = Math.round(v); saveState(); return { ok: true, cap: Math.round(v) }; }
function setBackupReminderDays(n) { var v = Number(n); if (!(v > 0)) return { ok: false, error: 'عدد غير صالح' }; getState().settings.backupReminderDays = Math.round(v); saveState(); return { ok: true, days: Math.round(v) }; }
function setQuietHours(value) { var s = getState().settings; s.quietHours = !!value; if (!s.quietStart) s.quietStart = '22:00'; if (!s.quietEnd) s.quietEnd = '07:00'; saveState(); return { ok: true, on: !!s.quietHours }; }
function setQuietStart(v) { var s = getState().settings; if (!/^\d{2}:\d{2}$/.test(v)) return { ok: false, error: 'وقت غير صالح' }; s.quietStart = v; saveState(); return { ok: true, time: v }; }
function setQuietEnd(v) { var s = getState().settings; if (!/^\d{2}:\d{2}$/.test(v)) return { ok: false, error: 'وقت غير صالح' }; s.quietEnd = v; saveState(); return { ok: true, time: v }; }
function setDailyCap(n) { var v = Number(n); if (!(v > 0)) return { ok: false, error: 'عدد غير صالح' }; getState().settings.dailyCap = Math.round(v); saveState(); return { ok: true, cap: Math.round(v) }; }
function setBackupReminderDays(n) { var v = Number(n); if (!(v > 0)) return { ok: false, error: 'عدد غير صالح' }; getState().settings.backupReminderDays = Math.round(v); saveState(); return { ok: true, days: Math.round(v) }; }
function setRemindersEnabled(value) {
getState().settings.remindersEnabled = !!value;
saveState();
return { ok: true, enabled: !!getState().settings.remindersEnabled };
}
function recordBackup() {
getState().settings.lastBackupAt = new Date().toISOString();
saveState();
return { ok: true, at: getState().settings.lastBackupAt };
}
var EXAMPLE_PHRASES = [
'عندي 5000 كاش', 'دفعت 250 بنزين', 'دفعت 85 قهوة', 'دفعت 1200 إيجار', 'صرفت 300 بقالة',
'دفعت 450 كهرباء', 'استلمت راتب 12000 في البنك', 'قبضت 3000 عمولة', 'بعت بضاعة 800 كاش',
'سلفت عبدالله 1000 يرجعه بعد أسبوع', 'استلفت من سامي 2000', 'حصلت من خالد 400', 'سددت سامي 500',
'حولت 500 من الكاش للبنك', 'كم رصيدي؟', 'حلّل وضعي المالي باختصار', 'ملخص وضعي',
'كم حساب محمد طه', 'رصيد خالد', 'كم في البنك', 'حساب البنك'
];
var EXAMPLE_CURRENCY_WORDS = { SAR: 'ريال', USD: 'دولار', EUR: 'يورو', YER: 'ريال يمني' };
function exampleInMainCurrency(text) {
var code = mainCurrency();
var added = currencyConfig().added.filter(function (c) { return c.code === code; })[0];
var word = EXAMPLE_CURRENCY_WORDS[code] || (added ? added.name : code);
var plain = String(text).replace(/ ?ريال/g, '');
if (code === BASE) return String(text);
var rate = getRate(code) || 1;
return plain.replace(/\d[\d,.]*/g, function (amount) {
var num = parseFloat(String(amount).replace(/,/g, ''));
if (isNaN(num) || rate <= 0) return amount + ' ' + word;
var converted = num / rate;
var shown = (Math.abs(converted - Math.round(converted)) < 0.0001) ? String(Math.round(converted)) : (Math.round(converted * 100) / 100).toString();
return shown + ' ' + word;
});
}
var SUGGESTION_SYSTEM_MEMO = /تسويه استحقاق|تسديد جزئي|\[تعديل|test/i;
var SUGGESTION_HISTORY = 400;
function dueSuggestions(today) {
return state.dueItems.filter(function (d) {
return d.remaining > 0 && d.counterparty && isValidDate(d.dueDate) && daysBetween(today, d.dueDate) <= 3;
}).sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; }).map(function (d) {
var kind = d.kind === 'receivable' ? 'collect' : 'repay';
var amount = d.remaining / 100;
var text = (kind === 'collect' ? 'حصلت من ' : 'سددت ') + d.counterparty + ' ' + amount + (mainCurrency() === BASE ? '' : ' ريال');
var days = daysBetween(today, d.dueDate);
var why = days < 0 ? 'متأخر' : days === 0 ? 'مستحق اليوم' : 'مستحق قريباً';
var parsed = parseIntent(text);
var fits = parsed.kind === kind && parsed.amountMinor === d.remaining && parsed.currency === BASE;
return fits ? { text: text, reason: why, smart: true } : null;
}).filter(Boolean);
}
function habitSuggestions(now, today) {
var groups = {};
state.entries.slice(-SUGGESTION_HISTORY).forEach(function (e) {
if ((e.kind !== 'expense' && e.kind !== 'income') || !e.memo || !isValidDate(e.date) || e.date > today) return;
var norm = normalizeAr(e.memo);
if (SUGGESTION_SYSTEM_MEMO.test(norm) || e.memo.length > 40) return;
var key = e.kind + '|' + norm.replace(/[\d.,]+/g, '').replace(/\s+/g, ' ').trim();
if (!groups[key]) groups[key] = { kind: e.kind, dates: [], hours: [], last: e };
groups[key].dates.push(e.date);
if (e.createdAt) {
var made = new Date(e.createdAt);
if (!isNaN(made.getTime()) && daysBetween(e.date, today) <= 21) groups[key].hours.push(made.getHours());
}
if (e.date >= groups[key].last.date) groups[key].last = e;
});
var month = today.slice(0, 7);
var dayOfMonth = Number(today.slice(8, 10));
var weekday = now.getDay();
var hour = now.getHours();
var out = [];
Object.keys(groups).forEach(function (key) {
var g = groups[key];
var months = {};
var weeksSameDay = {};
var nearDay = 0;
var recent = false;
g.dates.forEach(function (date) {
months[date.slice(0, 7)] = true;
if (Math.abs(Number(date.slice(8, 10)) - dayOfMonth) <= 2) nearDay++;
var parts = date.split('-');
if (new Date(+parts[0], +parts[1] - 1, +parts[2]).getDay() === weekday) weeksSameDay[date] = true;
if (daysBetween(date, today) < 6) recent = true;
});
var doneThisMonth = !!months[month];
var doneToday = g.dates.indexOf(today) >= 0;
var score = 0;
var reason = '';
if (Object.keys(months).length >= 2 && nearDay >= 2 && !doneThisMonth) {
score = 3; reason = 'معتاد في هذا الوقت من الشهر';
} else if (Object.keys(weeksSameDay).length >= 2 && !recent) {
score = 2; reason = 'معتاد في هذا اليوم من الأسبوع';
} else if (!doneToday && g.hours.filter(function (h) { return Math.abs(h - hour) <= 1; }).length >= 3) {
score = 1; reason = 'معتاد في هذه الساعة';
}
if (!score) return;
var parsed = parseIntent(g.last.memo);
if (parsed.kind !== g.kind || !(parsed.amountMinor > 0)) return;
if (parsed.currency !== (g.last.currency || BASE)) return;
out.push({ text: g.last.memo, reason: reason, smart: true, score: score, count: g.dates.length });
});
return out.sort(function (a, b) { return b.score - a.score || b.count - a.count; }).map(function (s) {
return { text: s.text, reason: s.reason, smart: true };
});
}
var EXAMPLE_FADE_DAYS = 14;
var EXAMPLE_STATS_MAX = 120;
function exampleKey(text) {
return normalizeAr(String(text || '')).replace(/[\d.,]+/g, '').replace(/[؟?]/g, '').replace(/\s+/g, ' ').trim();
}
function exampleStats() {
var settings = state.settings;
if (!settings.exampleStats || typeof settings.exampleStats !== 'object') settings.exampleStats = {};
return settings.exampleStats;
}
function noteExamples(texts, event, nowMs) {
if (!state) return;
var stats = exampleStats();
var today = isoDate(new Date(nowMs == null ? Date.now() : nowMs));
var changed = false;
(Array.isArray(texts) ? texts : [texts]).forEach(function (text) {
var key = exampleKey(text);
if (!key) return;
var item = stats[key] || (stats[key] = { days: 0, taps: 0, last: '' });
if (event === 'tap') { item.taps++; changed = true; }
else if (item.last !== today) { item.days++; item.last = today; changed = true; }
});
var keys = Object.keys(stats);
if (keys.length > EXAMPLE_STATS_MAX) {
keys.sort(function (a, b) { return (stats[a].taps - stats[b].taps) || (stats[a].last < stats[b].last ? -1 : 1); })
.slice(0, keys.length - EXAMPLE_STATS_MAX).forEach(function (k) { delete stats[k]; });
}
if (changed) saveState();
}
function exampleTaps(text) {
var item = exampleStats()[exampleKey(text)];
return item ? item.taps : 0;
}
function exampleFaded(text) {
var item = exampleStats()[exampleKey(text)];
return !!item && item.taps === 0 && item.days >= EXAMPLE_FADE_DAYS;
}
function learnedSuggestions(today) {
var groups = {};
state.entries.slice(-SUGGESTION_HISTORY).forEach(function (e) {
if (!e.memo || e.memo.length > 40 || !isValidDate(e.date) || e.date > today) return;
if (SUGGESTION_SYSTEM_MEMO.test(normalizeAr(e.memo))) return;
var key = exampleKey(e.memo);
if (!key) return;
var g = groups[key] || (groups[key] = { score: 0, count: 0, last: e });
g.score += Math.exp(-Math.max(0, daysBetween(e.date, today)) / 30);
g.count++;
if (e.date >= g.last.date) g.last = e;
});
var out = [];
Object.keys(groups).forEach(function (key) {
var g = groups[key];
if (g.count < 2) return;
var parsed = parseIntent(g.last.memo);
if (parsed.kind !== g.last.kind || !(parsed.amountMinor > 0)) return;
if (parsed.currency !== (g.last.currency || BASE)) return;
out.push({ text: g.last.memo, reason: 'من استخدامك، ' + g.count + ' مرات', score: g.score + exampleTaps(g.last.memo) * 0.5 });
});
return out.sort(function (a, b) { return b.score - a.score; }).map(function (x) {
return { text: x.text, reason: x.reason, smart: false, learned: true };
});
}
function composerSuggestions(nowMs, count, todayOverride) {
var limit = count || 6;
var now = new Date(nowMs == null ? Date.now() : nowMs);
var today = (typeof todayOverride === 'string' && todayOverride) ? todayOverride : isoDate(now);
var picks = [];
var add = function (item) {
var key = exampleKey(item.text);
if (picks.length >= limit || picks.some(function (p) { return p.text === item.text || exampleKey(p.text) === key; })) return;
picks.push(item);
};
if (state) {
dueSuggestions(today).slice(0, 3).forEach(add);
habitSuggestions(now, today).slice(0, 3).forEach(add);
learnedSuggestions(today).slice(0, Math.max(2, limit - 12)).forEach(add);
(recurringDue(today) || []).slice(0, 3).forEach(function (r) {
add({ text: r.memo, reason: 'قيد متكرر مستحق', smart: false, learned: false });
});
}
if (!state || !state.entries.length) add({ text: exampleInMainCurrency('عندي 5000 كاش'), reason: '', smart: false });
if (Number(today.slice(8, 10)) <= 3) add({ text: 'حلّل وضعي المالي باختصار', reason: '', smart: false });
if (now.getHours() >= 18) add({ text: 'ملخص وضعي', reason: '', smart: false });
var activePersona = state && state.settings && state.settings.persona ? PERSONAS[state.settings.persona] : null;
if (activePersona && Array.isArray(activePersona.examples)) {
activePersona.examples.forEach(function (text) {
if (!state || !exampleFaded(text)) add({ text: exampleInMainCurrency(text), reason: activePersona.title, smart: false });
});
}
if (vectorMemoryEnabled() && _contextualRepertoire.length) {
_contextualRepertoire.forEach(function (repItem) {
if (repItem && repItem.text && (!state || !exampleFaded(repItem.text))) {
add({ text: repItem.text, reason: repItem.reason || 'ذخيرة سياقية', smart: false, learned: false, repertoire: true });
}
});
}
var pool = EXAMPLE_PHRASES.filter(function (text) { return !state || !exampleFaded(text); });
for (var i = pool.length - 1; i > 0; i--) {
var j = Math.floor(Math.random() * (i + 1));
var swap = pool[i]; pool[i] = pool[j]; pool[j] = swap;
}
if (state) pool.sort(function (a, b) { return exampleTaps(b) - exampleTaps(a); });
pool.forEach(function (text) { add({ text: exampleInMainCurrency(text), reason: '', smart: false }); });
return picks;
}
var SEARCH_GROUP_LIMIT = 5;
function searchNorm(value) {
return normalizeAr(String(value == null ? '' : value)).toLowerCase();
}
function searchAll(query, date) {
var term = searchNorm(query).trim();
if ((!term && !date) || !state) return [];
var accountName = function (id) { var a = getAccount(id); return a ? a.name : id; };
var hit = function (parts) { return searchNorm(parts.join(' ')).indexOf(term) >= 0; };
var groups = [];
var addGroup = function (key, title, items) {
if (items.length) groups.push({ key: key, title: title, total: items.length, items: date ? items : items.slice(0, SEARCH_GROUP_LIMIT) });
};
addGroup('entries', 'القيود', state.entries.filter(function (e) {
if (date && e.date !== date) return false;
var label = (KIND_META[e.kind] || {}).label;
return hit([e.memo, e.counterparty, label, e.date, (e.totalBase || 0) / 100].concat((e.lines || []).map(function (l) { return accountName(l.accountId); })));
}).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).map(function (e) {
return { type: 'entry', id: e.id, title: e.memo || (KIND_META[e.kind] || {}).label || e.kind, sub: fmtDate(e.date) + ' • ' + fmtMoney(e.totalBase) };
}));
addGroup('accounts', 'الحسابات', date ? [] : state.accounts.filter(function (a) {
return hit([a.name, a.nickname, a.hint, a.subtype, a.phone, a.currency]);
}).map(function (a) {
return { type: 'account', id: a.id, title: a.name, sub: [a.subtype || a.hint, a.currency].filter(Boolean).join(' • ') };
}));
addGroup('due', 'الاستحقاقات', state.dueItems.filter(function (d) {
if (date && d.dueDate !== date) return false;
return d.remaining > 0 && hit([d.counterparty, d.dueDate, d.remaining / 100, d.kind === 'receivable' ? 'لنا' : 'علينا']);
}).map(function (d) {
return { type: 'due', id: d.id, title: d.counterparty || 'بدون طرف', sub: (d.dueDate ? fmtDate(d.dueDate) + ' • ' : '') + fmtMoney(d.remaining) };
}));
addGroup('messages', 'المحادثة', state.messages.filter(function (m) {
if (date && (!m.at || isoDate(new Date(m.at)) !== date)) return false;
return m.text && hit([m.text]);
}).slice().reverse().map(function (m) {
var text = String(m.text).replace(/\s+/g, ' ').trim();
return { type: 'message', id: m.id, title: text.length > 60 ? text.slice(0, 60) + '…' : text, sub: m.role === 'user' ? 'أنت' : 'البوت' };
}));
addGroup('currencies', 'العملات', date ? [] : listCurrencies().filter(function (c) {
return hit([c.code, c.name, c.symbol]);
}).map(function (c) {
return { type: 'currency', id: c.code, title: c.code + (c.name ? ' — ' + c.name : ''), sub: c.code === BASE ? 'العملة الأساسية' : String(c.rate) };
}));
return groups;
}
var CURRENCY_NAMES = { SAR: 'ريال سعودي', USD: 'دولار', EUR: 'يورو', YER: 'ريال يمني' };
var CURRENCY_FLAGS = { SAR: '🇸🇦', USD: '🇺🇸', EUR: '🇪🇺', YER: '🇾🇪', YRO: '🇾🇪', GBP: '🇬🇧', JPY: '🇯🇵', CNY: '🇨🇳', INR: '🇮🇳', KWD: '🇰🇼', QAR: '🇶🇦', BHD: '🇧🇭', OMR: '🇴🇲', EGP: '🇪🇬', TRY: '🇹🇷', PKR: '🇵🇰', CHF: '🇨🇭', CAD: '🇨🇦', AUD: '🇦🇺', BRL: '🇧🇷', MXN: '🇲🇽', RUB: '🇷🇺', ZAR: '🇿🇦' };
var CURRENCY_COUNTRIES = { SAR: 'المملكة العربية السعودية', USD: 'الولايات المتحدة', EUR: 'الاتحاد الأوروبي', YER: 'اليمن', YRO: 'اليمن (طبعة قديمة)', GBP: 'المملكة المتحدة', JPY: 'اليابان', CNY: 'الصين', INR: 'الهند', KWD: 'الكويت', QAR: 'قطر', BHD: 'البحرين', OMR: 'عمان', EGP: 'مصر', TRY: 'تركيا', PKR: 'باكستان', CHF: 'سويسرا', CAD: 'كندا', AUD: 'أستراليا', BRL: 'البرازيل', MXN: 'المكسيك', RUB: 'روسيا', ZAR: 'جنوب أفريقيا' };
function currencyFlag(code) {
if (CURRENCY_FLAGS[code]) return CURRENCY_FLAGS[code];
var cc = String(code || '').slice(0, 2).toUpperCase();
if (!/^[A-Z]{2}$/.test(cc) || cc.charAt(0) === 'X') return '';
var a = cc.charCodeAt(0) - 65 + 0x1F1E6;
var b = cc.charCodeAt(1) - 65 + 0x1F1E6;
return String.fromCodePoint(a, b);
}
function currencyCountry(code) { return CURRENCY_COUNTRIES[code] || ''; }
var WORLD_CURRENCIES = [
{ code: 'YRO', name: 'ريال يمني قديم', symbol: 'ر.يق' },
{ code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', type: 'paper' },
{ code: 'KWD', name: 'دينار كويتي', symbol: 'د.ك' },
{ code: 'QAR', name: 'ريال قطري', symbol: 'ر.ق' },
{ code: 'BHD', name: 'دينار بحريني', symbol: 'د.ب' },
{ code: 'OMR', name: 'ريال عماني', symbol: 'ر.ع' },
{ code: 'EGP', name: 'جنيه مصري', symbol: 'ج.م' },
{ code: 'JOD', name: 'دينار أردني', symbol: 'JD' },
{ code: 'IQD', name: 'دينار عراقي', symbol: 'د.ع' },
{ code: 'LBP', name: 'ليرة لبنانية', symbol: 'ل.ل' },
{ code: 'SYP', name: 'ليرة سورية', symbol: 'ل.س' },
{ code: 'SDG', name: 'جنيه سوداني', symbol: 'ج.س' },
{ code: 'TND', name: 'دينار تونسي', symbol: 'د.ت' },
{ code: 'MAD', name: 'درهم مغربي', symbol: 'د.م' },
{ code: 'DZD', name: 'دينار جزائري', symbol: 'د.ج' },
{ code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل' },
{ code: 'GBP', name: 'جنيه إسترليني', symbol: '£' },
{ code: 'JPY', name: 'ين ياباني', symbol: '¥' },
{ code: 'CNY', name: 'يوان صيني', symbol: 'CN¥' },
{ code: 'INR', name: 'روبية هندية', symbol: '₹' },
{ code: 'PKR', name: 'روبية باكستانية', symbol: 'Rs' },
{ code: 'BDT', name: 'تاكا بنغلاديشي', symbol: '৳' },
{ code: 'TRY', name: 'ليرة تركية', symbol: '₺' },
{ code: 'CHF', name: 'فرنك سويسري', symbol: 'CHF' },
{ code: 'CAD', name: 'دولار كندي', symbol: 'C$' },
{ code: 'AUD', name: 'دولار أسترالي', symbol: 'A$' },
{ code: 'NZD', name: 'دولار نيوزيلندي', symbol: 'NZ$' },
{ code: 'SGD', name: 'دولار سنغافوري', symbol: 'S$' },
{ code: 'HKD', name: 'دولار هونغ كونغ', symbol: 'HK$' },
{ code: 'MYR', name: 'رينغيت ماليزي', symbol: 'RM' },
{ code: 'IDR', name: 'روبية إندونيسية', symbol: 'Rp' },
{ code: 'PHP', name: 'بيزو فلبيني', symbol: '₱' },
{ code: 'THB', name: 'بات تايلندي', symbol: '฿' },
{ code: 'KRW', name: 'وون كوري', symbol: '₩' },
{ code: 'VND', name: 'دونغ فيتنامي', symbol: '₫' },
{ code: 'BRL', name: 'ريال برازيلي', symbol: 'R$' },
{ code: 'MXN', name: 'بيزو مكسيكي', symbol: 'MX$' },
{ code: 'RUB', name: 'روبل روسي', symbol: '₽' },
{ code: 'UAH', name: 'هريفنيا أوكرانية', symbol: '₴' },
{ code: 'ZAR', name: 'راند جنوب أفريقي', symbol: 'R' },
{ code: 'NGN', name: 'نايرا نيجيرية', symbol: '₦' },
{ code: 'SEK', name: 'كرونة سويدية', symbol: 'kr' },
{ code: 'NOK', name: 'كرونة نرويجية', symbol: 'kr' },
{ code: 'DKK', name: 'كرونة دنماركية', symbol: 'kr' },
{ code: 'PLN', name: 'زلوتي بولندي', symbol: 'zł' },
{ code: 'IRR', name: 'ريال إيراني', symbol: 'ر.إ' },
{ code: 'AFN', name: 'أفغاني', symbol: '؋', type: 'paper' },
{ code: 'XAU', name: 'ذهب (أونصة)', symbol: 'Au', type: 'metal' },
{ code: 'XAG', name: 'فضة (أونصة)', symbol: 'Ag', type: 'metal' },
{ code: 'XPT', name: 'بلاتين (أونصة)', symbol: 'Pt', type: 'metal' },
{ code: 'XPD', name: 'بالاديوم (أونصة)', symbol: 'Pd', type: 'metal' },
{ code: 'BTC', name: 'بيتكوين', symbol: '₿', type: 'digital' },
{ code: 'ETH', name: 'إيثريوم', symbol: 'Ξ', type: 'digital' },
{ code: 'XRP', name: 'ريبل', symbol: 'XRP', type: 'digital' },
{ code: 'BNB', name: 'بينانس كوين', symbol: 'BNB', type: 'digital' },
{ code: 'SOL', name: 'سولانا', symbol: 'SOL', type: 'digital' },
{ code: 'ADA', name: 'كاردانو', symbol: 'ADA', type: 'digital' },
{ code: 'LTC', name: 'لايت كوين', symbol: 'Ł', type: 'digital' },
{ code: 'XLM', name: 'ستيلار', symbol: 'XLM', type: 'digital' },
{ code: 'XDR', name: 'حقوق السحب الخاصة (SDR)', symbol: 'XDR', type: 'representative' }
];
var BUILT_IN_WORDS = ['ريال', 'سعودي', 'دولار', 'دولارات', 'درهم', 'دراهم', 'يورو', 'يمني'];
function currencyConfig() {
return (state && state.settings && state.settings.currencyConfig) || { added: [], removed: [] };
}
function cleanCurrencyConfig(raw) {
if (!raw || typeof raw !== 'object') return null;
var added = (Array.isArray(raw.added) ? raw.added : []).filter(function (c) {
return c && /^[A-Z]{3}$/.test(c.code) && !RATES[c.code] && validCurrencyName(c.name) && validCurrencySymbol(c.symbol) && (c.type == null || CURRENCY_TYPES.indexOf(c.type) >= 0);
}).map(function (c) { return { code: c.code, name: c.name, symbol: c.symbol, type: CURRENCY_TYPES.indexOf(c.type) >= 0 ? c.type : 'paper' }; });
var removed = (Array.isArray(raw.removed) ? raw.removed : []).filter(function (code) {
return RATES[code] && code !== BASE;
});
return { added: added, removed: removed };
}
function validCurrencyName(name) {
return typeof name === 'string' && /^[؀-ۿa-zA-Z0-9 ()\-]{2,30}$/.test(name);
}
function validCurrencySymbol(symbol) {
return typeof symbol === 'string' && symbol.length >= 1 && symbol.length <= 4 && !/[<>&"'`]/.test(symbol);
}
var NEW_SIGNS = { OMR: '⃄' };
var CURRENCY_TYPES = ['paper', 'metal', 'digital', 'representative'];
var CURRENCY_TYPE_NAMES = { paper: 'عملات ورقية', metal: 'عملات معادن', digital: 'عملات رقمية', representative: 'عملات تمثيلية' };
var BUILTIN_CURRENCY_TYPE = { SAR: 'paper', USD: 'paper', EUR: 'paper', YER: 'paper' };
function currencySymbol(code) {
if (SYMBOL[code]) return SYMBOL[code];
if (NEW_SIGNS[code]) return NEW_SIGNS[code];
var found = currencyConfig().added.filter(function (c) { return c.code === code; })[0];
return found ? found.symbol : code;
}
function isCurrencyRemoved(code) {
return currencyConfig().removed.indexOf(code) >= 0;
}
function isCurrencyUsed(code) {
if (!state) return false;
var inLines = function (rec) {
return rec.currency === code || (rec.lines || []).some(function (l) { return l.currency === code; });
};
var hasActivity = function (accountId) {
return state.entries.concat(state.drafts).some(function (rec) {
return (rec.lines || []).some(function (l) { return l.accountId === accountId; });
});
};
var isDefault = function (accountId) {
return ACCOUNT_DEFS.some(function (def) { return def.id === accountId; });
};
return (state.settings && state.settings.currency === code) ||
state.accounts.some(function (a) { return a.currency === code && (!isDefault(a.id) || hasActivity(a.id)); }) ||
state.entries.some(inLines) || state.drafts.some(inLines);
}
function listCurrencies() {
var config = currencyConfig();
var builtIn = Object.keys(RATES).filter(function (c) { return config.removed.indexOf(c) < 0; }).map(function (c) {
return { code: c, name: CURRENCY_NAMES[c], symbol: SYMBOL[c], builtIn: true, type: BUILTIN_CURRENCY_TYPE[c] || 'paper' };
});
return builtIn.concat(config.added.map(function (c) {
return { code: c.code, name: c.name, symbol: NEW_SIGNS[c.code] || c.symbol, builtIn: false, type: CURRENCY_TYPES.indexOf(c.type) >= 0 ? c.type : 'paper' };
})).map(function (c) {
c.rate = getRate(c.code);
c.used = c.code === BASE || isCurrencyUsed(c.code);
return c;
});
}
var DEFAULT_WORLD_SAR_RATES = {
SAR: 1, USD: 3.75, AED: 1.02, EUR: 4.05, YER: 1 / 410, YRO: 1 / 140,
OMR: 9.74, KWD: 12.22, QAR: 1.03, BHD: 9.95,
EGP: 0.076, DZD: 0.028, MAD: 0.38, TND: 1.20, JOD: 5.29, IQD: 0.0028,
GBP: 4.75, CAD: 2.70, AUD: 2.45, INR: 0.045, CNY: 0.52,
MYR: 0.85, SGD: 2.80, MXN: 0.19, CHF: 4.25
};
var DIALECT_TOP_CURRENCIES = {
ar_001: ['SAR', 'USD', 'EUR'],
ar_SA: ['SAR', 'OMR', 'USD'],
ar_YE: ['YER', 'SAR', 'USD'],
ar_EG: ['EGP', 'SAR', 'USD'],
ar_DZ: ['DZD', 'EUR', 'USD'],
ar_MA: ['MAD', 'EUR', 'USD'],
en_US: ['USD', 'EUR', 'GBP'],
en_GB: ['GBP', 'EUR', 'USD'],
en_AU: ['AUD', 'USD', 'EUR'],
en_CA: ['CAD', 'USD', 'EUR'],
en_IN: ['INR', 'USD', 'SAR'],
zh_CN: ['CNY', 'USD', 'EUR'],
zh_MY: ['MYR', 'USD', 'SGD'],
zh_SG: ['SGD', 'USD', 'CNY'],
zh_TW: ['CNY', 'USD', 'EUR'],
hi_IN: ['INR', 'USD', 'SAR'],
es_MX: ['MXN', 'USD', 'EUR'],
es_ES: ['EUR', 'USD', 'GBP'],
es_DO: ['USD', 'EUR', 'MXN'],
es_AR: ['USD', 'EUR', 'MXN'],
es_CO: ['USD', 'EUR', 'MXN'],
fr_FR: ['EUR', 'USD', 'GBP'],
fr_CA: ['CAD', 'USD', 'EUR'],
fr_SN: ['EUR', 'USD', 'SAR'],
fr_BE: ['EUR', 'USD', 'GBP'],
fr_CH: ['CHF', 'EUR', 'USD']
};
function setDefaultMultiCurrency(val) {
if (!state) return { ok: false };
state.settings = state.settings || {};
state.settings.defaultMultiCurrency = !!val;
saveState();
return { ok: true };
}
function defaultMultiCurrency() {
return !!(state && state.settings && state.settings.defaultMultiCurrency);
}
function topCurrenciesForDialect(locale) {
var norm = String(locale || 'ar_SA').trim().replace(/-/g, '_');
var codes = DIALECT_TOP_CURRENCIES[norm] || DIALECT_TOP_CURRENCIES[norm.split('_')[0] + '_001'] || ['SAR', 'USD', 'EUR'];
var listed = listCurrencies();
return codes.map(function (code) {
var found = listed.filter(function (c) { return c.code === code; })[0];
if (found) return { code: found.code, name: found.name, symbol: found.symbol, sarRate: DEFAULT_WORLD_SAR_RATES[code] || 1 };
if (RATES[code]) return { code: code, name: CURRENCY_NAMES[code] || code, symbol: NEW_SIGNS[code] || SYMBOL[code] || code, sarRate: DEFAULT_WORLD_SAR_RATES[code] || 1 };
var world = WORLD_CURRENCIES.filter(function (c) { return c.code === code; })[0];
if (world) return { code: world.code, name: world.name, symbol: NEW_SIGNS[code] || world.symbol, sarRate: DEFAULT_WORLD_SAR_RATES[code] || 1 };
return { code: code, name: code, symbol: code, sarRate: DEFAULT_WORLD_SAR_RATES[code] || 1 };
});
}
function selectSuggestedBaseCurrency(code) {
if (!state) return { ok: false, error: 'المحرك غير محمّل' };
code = String(code || '').trim().toUpperCase();
var isListed = listCurrencies().some(function (c) { return c.code === code; });
if (!isListed) {
var world = WORLD_CURRENCIES.filter(function (c) { return c.code === code; })[0] ||
(RATES[code] ? { code: code, name: CURRENCY_NAMES[code] || code, symbol: SYMBOL[code] || code, type: BUILTIN_CURRENCY_TYPE[code] || 'paper' } : null);
var sarRate = DEFAULT_WORLD_SAR_RATES[code] || 1;
var rateInCurrentBase = sarRate / (baseInRiyals() || 1);
if (world) {
addCurrency({
code: world.code,
name: world.name,
symbol: NEW_SIGNS[world.code] || world.symbol || world.code,
type: world.type || 'paper',
rate: rateInCurrentBase > 0 ? rateInCurrentBase : 1
});
}
}
return setBaseCurrency(code);
}
function addCurrency(input) {
if (!state) return { ok: false, error: 'المحرك غير محمّل' };
input = input || {};
var code = String(input.code || '').trim().toUpperCase();
var name = String(input.name || '').trim();
var symbol = String(input.symbol || '').trim() || code;
var type = CURRENCY_TYPES.indexOf(input.type) >= 0 ? input.type : 'paper';
var rate = Number(input.rate);
if (!/^[A-Z]{3}$/.test(code)) return { ok: false, error: 'رمز العملة ثلاثة أحرف إنجليزية، مثل EGP' };
if (!(rate > 0)) return { ok: false, error: 'سعر غير صالح' };
var config = currencyConfig();
var taken = listCurrencies().some(function (c) { return c.code === code; });
if (taken) return { ok: false, error: 'العملة ' + code + ' موجودة بالفعل' };
var next = { added: config.added.slice(), removed: config.removed.slice() };
if (RATES[code]) {
next.removed = next.removed.filter(function (c) { return c !== code; });
} else {
if (!validCurrencyName(name)) return { ok: false, error: 'اكتب اسم العملة كما تكتبه في القيود، مثل جنيه' };
if (!validCurrencySymbol(symbol)) return { ok: false, error: 'رمز العرض غير صالح' };
var word = normalizeAr(name);
if (BUILT_IN_WORDS.indexOf(word) >= 0) return { ok: false, error: 'الاسم "' + name + '" مستخدم لعملة أخرى. أضف ما يميزه، مثل ريال قطري' };
var clash = next.added.some(function (c) { return normalizeAr(c.name) === word; });
if (clash) return { ok: false, error: 'الاسم "' + name + '" مستخدم لعملة أخرى' };
next.added.push({ code: code, name: name, symbol: symbol, type: type });
}
state.settings.currencyConfig = next;
if (!state.settings.rates) state.settings.rates = {};
state.settings.rates[code] = rate;
saveState();
return { ok: true, code: code };
}
function removeCurrency(code) {
if (!state) return { ok: false, error: 'المحرك غير محمّل' };
if (code === BASE) return { ok: false, error: 'لا يمكن حذف العملة الأساسية' };
if (isCurrencyUsed(code)) return { ok: false, error: 'لا يمكن حذف عملة مستخدمة في حساب أو قيد' };
var config = currencyConfig();
var next = {
added: config.added.filter(function (c) { return c.code !== code; }),
removed: config.removed.slice()
};
if (RATES[code] && next.removed.indexOf(code) < 0) next.removed.push(code);
state.settings.currencyConfig = next;
if (state.settings.rates) delete state.settings.rates[code];
if (state.settings.rateHistory) delete state.settings.rateHistory[code];
saveState();
return { ok: true };
}
function editCurrency(code, input) {
if (!state) return { ok: false, error: 'المحرك غير محمّل' };
if (code === BASE) return { ok: false, error: 'لا يمكن تعديل العملة الأساسية' };
input = input || {};
var rate = Number(input.rate);
if (!(rate > 0)) return { ok: false, error: 'سعر غير صالح' };
var config = currencyConfig();
var own = config.added.filter(function (c) { return c.code === code; })[0];
if (own) {
var name = String(input.name || '').trim();
var symbol = String(input.symbol || '').trim() || code;
var type = CURRENCY_TYPES.indexOf(input.type) >= 0 ? input.type : (own.type || 'paper');
if (!validCurrencyName(name)) return { ok: false, error: 'اكتب اسم العملة كما تكتبه في القيود، مثل جنيه' };
if (!validCurrencySymbol(symbol)) return { ok: false, error: 'رمز العرض غير صالح' };
var word = normalizeAr(name);
var clash = BUILT_IN_WORDS.indexOf(word) >= 0 || config.added.some(function (c) {
return c.code !== code && normalizeAr(c.name) === word;
});
if (clash) return { ok: false, error: 'الاسم "' + name + '" مستخدم لعملة أخرى' };
state.settings.currencyConfig = {
added: config.added.map(function (c) { return c.code === code ? { code: code, name: name, symbol: symbol, type: type } : c; }),
removed: config.removed.slice()
};
} else if (!RATES[code] || isCurrencyRemoved(code)) {
return { ok: false, error: 'العملة غير موجودة' };
}
return setRate(code, rate);
}
var RATE_HISTORY_LIMIT = 50;
function recordRateChange(code, from, to) {
if (from === to) return;
var all = state.settings.rateHistory || {};
var list = (all[code] || []).concat([{ at: new Date().toISOString(), from: from, to: to }]);
all[code] = list.slice(-RATE_HISTORY_LIMIT);
state.settings.rateHistory = all;
}
function currencyHistory(code) {
var all = (state && state.settings && state.settings.rateHistory) || {};
return (all[code] || []).slice().reverse();
}
function cleanRateHistory(raw) {
if (!raw || typeof raw !== 'object') return null;
var out = {};
Object.keys(raw).forEach(function (code) {
if (!/^[A-Z]{3}$/.test(code) || !Array.isArray(raw[code])) return;
var list = raw[code].filter(function (h) {
return h && Number(h.from) > 0 && Number(h.to) > 0 && isValidDate(String(h.at || '').slice(0, 10));
}).map(function (h) { return { at: String(h.at), from: Number(h.from), to: Number(h.to) }; });
if (list.length) out[code] = list.slice(-RATE_HISTORY_LIMIT);
});
return out;
}
function symbolIn(symbol, text) {
if (!symbol || /^[a-z]+$/i.test(symbol)) return false;
var plain = normalizeAr(symbol).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
return new RegExp('(?:^|[^ء-ي])' + plain + '(?=$|[^ء-ي])', 'i').test(text);
}
function addedCurrencyIn(text) {
var added = currencyConfig().added.slice().sort(function (a, b) { return b.name.length - a.name.length; });
for (var i = 0; i < added.length; i++) {
var name = normalizeAr(added[i].name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
if (new RegExp('(?:^|[^ء-ي])(?:بال?)?' + name + '(?=$|[^ء-ي])', 'i').test(text)) return added[i].code;
if (added[i].code === 'YRO' && /(?:^|[^ء-ي])(?:بال?)?(?:ريال\s+يمني\s+قديم|يمني\s+قديم|ريال\s+قديم|طبعه\s+قديمه|قعيطي|ر\.ي\.?ق)(?=$|[^ء-ي])/i.test(normalizeAr(text))) return 'YRO';
if (symbolIn(added[i].symbol, text)) return added[i].code;
var code = added[i].code;
if (new RegExp('\\d\\s*' + code + '(?![a-z])|(?:^|[^a-z])' + code + '\\s*\\d', 'i').test(text)) return code;
}
if (/(?:^|[^ء-ي])(?:بال?)?(?:ريال\s+يمني\s+قديم|يمني\s+قديم|ريال\s+قديم|طبعه\s+قديمه|قعيطي|ر\.ي\.?ق)(?=$|[^ء-ي])|\d\s*yro(?![a-z])|(?:^|[^a-z])yro\s*\d/i.test(normalizeAr(text))) {
if (state && state.settings) {
var yroRate = BASE === 'YER' ? (410 / 140) : (BASE === 'USD' ? (1 / 531) : (BASE === 'YRO' ? 1 : (1 / 140)));
addCurrency({ code: 'YRO', name: 'ريال يمني قديم', symbol: 'ر.يق', rate: yroRate });
return 'YRO';
}
}
return null;
}
var SYMBOL = { SAR: '\u20C1', USD: '$', EUR: '€', YER: 'YER' };
var MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
var ACCOUNT_DEFS = [
{ id: 'cash', name: 'الصندوق', hint: 'نقد', type: 'asset', nature: 'debit', currency: 'SAR', liquid: true, glyph: '◍' },
{ id: 'wallet', name: 'المحفظة الإلكترونية', hint: 'محفظة إلكترونية', type: 'asset', nature: 'debit', currency: 'SAR', liquid: true, glyph: '\uD83D\uDC5B', subtype: 'wallet' },
{ id: 'bank', name: 'البنك', hint: 'حساب جاري', type: 'asset', nature: 'debit', currency: 'SAR', liquid: true, glyph: '▤' },
{ id: 'usd_box', name: 'صندوق العملات الأجنبية', hint: 'عملة أجنبية', type: 'asset', nature: 'debit', currency: 'USD', liquid: true, glyph: '$' },
{ id: 'sar_box', name: 'المدخرات', hint: 'مدخرات', type: 'asset', nature: 'debit', currency: 'SAR', liquid: true, glyph: '◆' },
{ id: 'receivable', name: 'ديون لنا', hint: 'أصول', type: 'asset', nature: 'debit', currency: 'SAR', liquid: false, glyph: '⇢' },
{ id: 'payable', name: 'ديون علينا', hint: 'التزامات', type: 'liability', nature: 'credit', currency: 'SAR', liquid: false, glyph: '⇠' },
{ id: 'capital', name: 'رأس المال', hint: 'حقوق ملكية', type: 'equity', nature: 'credit', currency: 'SAR', liquid: false, glyph: '◆' },
{ id: 'revenue', name: 'الإيرادات', hint: 'دخل', type: 'revenue', nature: 'credit', currency: 'SAR', liquid: false, glyph: '↙' },
{ id: 'expense', name: 'المصروفات', hint: 'مصروف', type: 'expense', nature: 'debit', currency: 'SAR', liquid: false, glyph: '↗' },
{ id: 'fx_gain', name: 'أرباح فروق الصرف', hint: 'فرق صرف', type: 'revenue', nature: 'credit', currency: 'SAR', liquid: false, glyph: '±' },
{ id: 'fx_loss', name: 'خسائر فروق الصرف', hint: 'فرق صرف', type: 'expense', nature: 'debit', currency: 'SAR', liquid: false, glyph: '±' }
];
var KIND_META = {
expense: { label: 'مصروف', glyph: '↗', sign: -1 },
income: { label: 'إيراد', glyph: '↙', sign: 1 },
lend: { label: 'دين لنا', glyph: '⇢', sign: 0 },
borrow: { label: 'دين علينا', glyph: '⇠', sign: 0 },
collect: { label: 'تحصيل دين', glyph: '✓', sign: 1 },
repay: { label: 'سداد دين', glyph: '✓', sign: -1 },
transfer: { label: 'تحويل داخلي', glyph: '⇄', sign: 0 },
settlement: { label: 'تسويه', glyph: '✓', sign: 0 },
exchange: { label: 'صرف عملة', glyph: '⇄', sign: 0 },
capital: { label: 'رأس مال', glyph: '◆', sign: 1 },
compound: { label: 'قيد مركب', glyph: '❖', sign: 0 }
};
var ACCOUNT_WORDS = {
'الصندوق': 'cash', 'صندوق': 'cash', 'كاش': 'cash', 'نقد': 'cash', 'الكاش': 'cash',
'البنك': 'bank', 'بنك': 'bank', 'الحساب': 'bank', 'حساب': 'bank',
'صندوق الدولار': 'usd_box', 'الدولار': 'usd_box', 'صندوق العملات الاجنبيه': 'usd_box', 'صندوق العملات': 'usd_box',
'صندوق الريال': 'sar_box', 'صندوق الرياض': 'sar_box', 'المدخرات': 'sar_box', 'مدخرات': 'sar_box', 'التوفير': 'sar_box',
'المحفظة الإلكترونية': 'wallet', 'المحفظة': 'wallet', 'محفظة': 'wallet', 'محفظتي': 'wallet', 'E-Wallets': 'wallet'
};
var STOP_PARTY = ['ريال', 'دولار', 'درهم', 'يورو', 'بنك', 'البنك', 'كاش', 'صندوق', 'الصندوق', 'مبلغ', 'المبلغ', 'بمبلغ',
'الحساب', 'حساب', 'راتب', 'دين', 'قرض', 'اليوم', 'امس', 'غدا', 'بكره', 'شهر', 'اسبوع',
'سنه', 'مصروف', 'ايراد', 'شراء', 'بنزين', 'فاتوره', 'ايجار', 'اجار', 'طعام', 'قهوه',
'فطور', 'افطار', 'غداء', 'عشاء', 'سحور', 'وجبه', 'وجبة',
'مطعم', 'بقاله', 'كهرباء', 'انترنت', 'صيانه', 'علاج', 'دواء', 'سفر', 'تذاكر', 'المدخرات',
'بقيمه', 'دفعنا', 'دفعت', 'بترول', 'حق', 'ثمن', 'سعر', 'قيمة', 'مشتريات', 'عربون',
'نا', 'لنا', 'علينا', 'لي', 'لك', 'لهم', 'منها', 'منه', 'مندوب', 'عميل', 'مورد', 'عهده', 'عهدة'];
var memoryStore = {};
var state = null;
var _stateRev = 0;
var adaptiveMemory = {};
var _memBuckets = {};
var _analysisCache = null;
var _analysisCacheKey = null;
var _parseCache = new Map();
var _parseCacheMax = 300;
function uid(prefix) {
return (prefix || 'id') + '_' + Date.now().toString(36) + '_' +
Math.random().toString(36).slice(2, 8);
}
function pad2(n) { return n < 10 ? '0' + n : String(n); }
function isoDate(d) {
return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function todayISO() { return isoDate(new Date()); }
function addDays(iso, n) {
var p = String(iso).split('-');
var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
d.setDate(d.getDate() + n);
return isoDate(d);
}
function daysBetween(a, b) {
var pa = String(a).split('-'), pb = String(b).split('-');
var da = Date.UTC(Number(pa[0]), Number(pa[1]) - 1, Number(pa[2]));
var db = Date.UTC(Number(pb[0]), Number(pb[1]) - 1, Number(pb[2]));
return Math.round((db - da) / 86400000);
}
function isValidDate(iso) {
return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) && !isNaN(Date.parse(iso + 'T00:00:00'));
}
function fmtDate(iso) {
if (!iso) return 'غير محدد';
var p = String(iso).split('-');
if (p.length !== 3) return iso;
return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0];
}
function storageGet(key) {
try { return localStorage.getItem(key); } catch (e) { return memoryStore[key] || null; }
}
function storageSet(key, value) {
try { localStorage.setItem(key, value); } catch (e) { memoryStore[key] = value; }
}
function storageRemove(key) {
try { localStorage.removeItem(key); } catch (e) { delete memoryStore[key]; }
}
function log(level, message, extra) {
var line = '[RohEngine] ' + message;
if (level === 'error') console.error(line, extra || '');
else if (level === 'warn') console.warn(line, extra || '');
else console.log(line, extra || '');
}
function toBase(minor, currency) {
var r = getRate(currency);
return Math.round(minor * r);
}
function fromBase(baseMinor, currency) {
var r = getRate(currency);
return Math.round(baseMinor / r);
}
function mainCurrency() {
var chosen = state && state.settings && state.settings.currency;
if (!chosen || chosen === BASE || isCurrencyRemoved(chosen)) return BASE;
var known = RATES[chosen] || currencyConfig().added.some(function (c) { return c.code === chosen; });
return known ? chosen : BASE;
}
function rateAgainstMain(code) {
var main = mainCurrency();
if (code === main) return 1;
if (main === BASE) return getRate(code);
return Number((getRate(code) / getRate(main)).toPrecision(5));
}
function currencyDecimals(code) {
if (state && state.settings && state.settings.rateDecimals && state.settings.rateDecimals[code] != null) {
var o = Number(state.settings.rateDecimals[code]);
if (isFinite(o) && o >= 0 && o <= 8) return Math.round(o);
}
var v;
try { v = rateAgainstMain(code); } catch (e) { v = 0; }
if (v < 1) return 5;
if (v > 10) return 0;
return 2;
}
function fmtRate(code) {
var v;
try { v = rateAgainstMain(code); } catch (e) { return '—'; }
if (v === null || v === undefined || isNaN(v)) return '—';
var dec = currencyDecimals(code);
if (dec === 0) return String(Math.round(v));
var factor = Math.pow(10, dec);
var rounded = Math.round(v * factor) / factor;
var s = rounded.toFixed(dec).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
return s === '' ? '0' : s;
}
function setRateDecimals(code, decimals) {
if (!state) return { ok: false, error: 'المحرك غير محمّل' };
if (!state.settings.rateDecimals) state.settings.rateDecimals = {};
var d = Number(decimals);
if (!isFinite(d) || d < 0 || d > 8) return { ok: false, error: 'عدد كسور غير صالح (0–8)' };
state.settings.rateDecimals[code] = Math.round(d);
saveState();
return { ok: true, decimals: Math.round(d) };
}
function getRateDecimals(code) {
return currencyDecimals(code);
}
function accountBalanceShown(acc, balance) {
var bal = balance || { native: 0, base: 0 };
return acc.currency === BASE ? { minor: bal.base, currency: BASE } : { minor: bal.native, currency: acc.currency };
}
function accountCurrencies(acc, balance) {
var bal = balance || { native: 0, base: 0, byCurrency: {} };
if (!acc) return [];
if (!acc.multi) return [{ currency: acc.currency || BASE, native: Number(bal.native) || 0, base: Number(bal.base) || 0 }];
var parts = bal.byCurrency || {};
return Object.keys(parts).filter(function (c) { return parts[c].native !== 0; }).map(function (c) {
return { currency: c, native: parts[c].native, base: parts[c].base };
});
}
function rateFromMain(value) {
var main = mainCurrency();
if (main === BASE) return Number(value);
return Number((Number(value) * getRate(main)).toPrecision(10));
}
function mainCurrencyLocked() {
return !!state && (state.entries.length > 0 || state.drafts.length > 0);
}
function setDefaultMultiCurrency(val) { if (!state) return { ok: false }; state.settings = state.settings || {}; state.settings.defaultMultiCurrency = !!val; saveState(); return { ok: true }; }
function setMainCurrency(code) {
if (!state) return { ok: false, error: 'المحرك غير محمّل' };
if (code === mainCurrency()) return { ok: true };
if (mainCurrencyLocked() && code !== BASE) return { ok: false, error: 'لا يمكن تغيير العملة الأساسية بعد تسجيل حركة' };
state.settings.currency = code;
saveState();
return { ok: true };
}
function fmtMoney(minor, currency, hide, keepCurrency) {
var hidden = hide;
if (typeof hidden === 'undefined') hidden = !!(state && state.settings && state.settings.hideAmounts);
if (hidden) return '••••';
var origCur = currency || BASE;
var origMinor = minor;
var cur = origCur;
if (cur === BASE && !keepCurrency && mainCurrency() !== BASE) {
cur = mainCurrency();
minor = fromBase(minor, cur);
}
var value = (Number(minor) || 0) / 100;
var yerRate = getRate('YER') || 0.0042;
var baseMinor = (Number(origMinor) || 0) * (getRate(origCur) || 1);
var isYer = (origCur === 'YER');
var tiny = Math.abs(baseMinor) < (yerRate * 100);
var decimals = (isYer || tiny) ? 0 : 2;
var formatted;
try {
formatted = new Intl.NumberFormat('en-US', {
minimumFractionDigits: decimals,
maximumFractionDigits: decimals
}).format(value);
} catch (e) {
formatted = (decimals === 0 ? String(Math.round(value)) : value.toFixed(decimals));
}
if (cur === BASE) return '\u2066' + (value < 0 ? '-\u2060' : '') + currencySymbol(cur) + '\u200E\u00A0' + formatted.replace('-', '') + '\u2069';
return '\u2066' + formatted + '\u00A0' + currencySymbol(cur) + '\u2069';
}
function escapeHtml(value) {
return String(value == null ? '' : value)
.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
var AR_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
var FA_DIGITS = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
function normalizeAr(input) {
return String(input == null ? '' : input)
.replace(/[\u064B-\u0652\u0670\u0640]/g, '')
.replace(/[٠-٩]/g, function (d) { return AR_DIGITS[d]; })
.replace(/[۰-۹]/g, function (d) { return FA_DIGITS[d]; })
.replace(/[إأآٱ]/g, 'ا')
.replace(/\b(رحت|سرت|رحنا|ذهبنا)\b/g, 'ذهب')
.replace(/ى/g, 'ي')
.replace(/ؤ/g, 'و')
.replace(/ئ/g, 'ي')
.replace(/ة/g, 'ه')
.replace(/٫/g, '.')
.replace(/٬/g, ',')
.replace(/[ـ]/g, '')
.replace(/\s+/g, ' ')
.trim();
}
function normalizeName(name) {
return normalizeAr(name).replace(/^ال/, '').trim();
}
var CURRENCY_WORDS = [
{ re: /(دولار|دولارات|\$|(?:^|[^a-z])usd(?![a-z]))/i, cur: 'USD' },
{ re: /(يورو|€|(?:^|[^a-z])euro?(?![a-z]))/i, cur: 'EUR' },
{ re: /(يمني(?!\s*قديم)|ريال يمني(?!\s*قديم)|(?:^|[^a-z])yer(?![a-z])|(?:^|[^ء-ي])ر(?:\.\s?|\s)ي(?=$|[^ء-ي.ق]))/i, cur: 'YER' },
{ re: /(ريال|سعودي|(?:^|[^a-z])sar(?![a-z])|\u20C1|(?:^|[^ء-ي])ر(?:\.\s?|\s)س(?=$|[^ء-ي]))/i, cur: 'SAR' }
];
function detectCurrencyCore(segment) {
var added = addedCurrencyIn(segment);
if (added) return added;
for (var i = 0; i < CURRENCY_WORDS.length; i++) {
if (CURRENCY_WORDS[i].re.test(segment)) {
if (CURRENCY_WORDS[i].cur === 'SAR' && BASE === 'YER' && !/(سعودي|(?:^|[^a-z])sar(?![a-z])|\u20C1|(?:^|[^ء-ي])ر(?:\.\s?|\s)س(?=$|[^ء-ي]))/i.test(segment)) return BASE;
return CURRENCY_WORDS[i].cur;
}
}
return null;
}
function detectCurrency(text) {
var s = String(text || '');
var splitMatch = s.match(/^([\s\S]+?)(?:@|=\s*\d|بمعادل|يعادل|بسعر|سعر\s*تحويل)/);
if (splitMatch) {
var preCur = detectCurrencyCore(splitMatch[1]);
if (preCur) return preCur;
}
return detectCurrencyCore(s) || mainCurrency();
}
function normalizeRateValue(rawRate, amountVal, currency) {
if (!(rawRate > 0) || !isFinite(rawRate)) return null;
var cur = currency || null;
var stdRate = (cur && cur !== BASE) ? getRate(cur) : 1;
if (amountVal > 1 && cur && cur !== BASE && stdRate > 0) {
var expectedBase = amountVal * stdRate;
if (rawRate > stdRate * 3 && rawRate >= expectedBase * 0.4 && rawRate <= expectedBase * 2.5) {
return rawRate / amountVal;
}
if (stdRate < 0.5 && rawRate > 1) {
var invRate = 1 / rawRate;
if (invRate >= stdRate * 0.05 && invRate <= stdRate * 20) {
return invRate;
}
}
}
return rawRate;
}
function extractRate(text, amountVal, currency) {
var t = normalizeAr(text || '');
var cur = currency || detectCurrency(t);
var amt = Number(amountVal) > 0 ? Number(amountVal) : 0;
var eqMatch = t.match(/(?:بمعادل|يعادل|معادل)\s*[:：]?\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)\s*(مليون|الف|الاف)?/);
if (!eqMatch) {
eqMatch = t.match(/(?:دولار(?:ات)?|\$|usd|درهم|دراهم|aed|يورو|€|euro?|يمني|yer|سعودي|sar|ريال)\s*=\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)\s*(مليون|الف|الاف)?/i);
}
if (eqMatch && amt > 0) {
var eqNum = parseFloat(String(eqMatch[1]).replace(/,/g, ''));
var eqMult = eqMatch[2] === 'مليون' ? 1000000 : (eqMatch[2] === 'الف' || eqMatch[2] === 'الاف' ? 1000 : 1);
var eqTotal = eqNum * eqMult;
if (eqTotal > 0 && isFinite(eqTotal)) return eqTotal / amt;
}
var atMatch = t.match(/@\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)\s*(مليون|الف|الاف)?/);
if (atMatch) {
var atNum = parseFloat(String(atMatch[1]).replace(/,/g, ''));
var atMult = atMatch[2] === 'مليون' ? 1000000 : (atMatch[2] === 'الف' || atMatch[2] === 'الاف' ? 1000 : 1);
return normalizeRateValue(atNum * atMult, amt, cur);
}
var m = t.match(/(?:سعر\s*تحويل|تحويل)\s*[:：]?\s*(\d+(?:[.,]\d+)?)/);
if (m) return normalizeRateValue(Number(String(m[1]).replace(',', '.')), amt, cur);
m = t.match(/بسعر\s+(\d+(?:[.,]\d+)?)/);
if (m) return normalizeRateValue(Number(String(m[1]).replace(',', '.')), amt, cur);
m = t.match(/(?:بسعر|بسعر)\s*[:：]?\s*(\d+(?:[.,]\d+)?)/);
if (m) return normalizeRateValue(Number(String(m[1]).replace(',', '.')), amt, cur);
return null;
}
function extractReceiveCurrency(text) {
var t = normalizeAr(text || '');
var m = t.match(/ل[يى]ستلم[هها]*\s+(?:ب|بال|بـ|بواسطة)\s*(.+?)(?=\s+(?:بسعر|سعر|تست|بعد|،|\.|$))/);
if (m) {
var cur = detectCurrency(m[1]);
if (cur && cur !== mainCurrency()) return cur;
if (/(ريال|دولار|يورو|درهم|دينار|ریال|دولار)/.test(m[1])) return cur;
}
m = t.match(/بال(ريال|دولار|يورو|درهم|دينار)/);
if (m) {
var cur2 = detectCurrency(m[0]);
if (cur2) return cur2;
}
return null;
}
var UNSUPPORTED_WORDS = /(?:^|[^ء-ي])(?:بال?)?(جنيه|جنيهات|دينار|دنانير|ليره|ليرات|شيكل|روبيه|روبيات|باوند|استرليني|فرنك|(?:درهم|دراهم) مغربيه?|ريال (?:قطري|عماني|ايراني)|دولار (?:كندي|استرالي))(?=$|[^ء-ي])/;
var UNSUPPORTED_CODES = /\d\s*(egp|mad|dzd|kwd|bhd|omr|qar|jod|iqd|tnd|lyd|gbp|try|cad|aud|inr|pkr|cny|jpy|chf)(?![a-z])|(?:^|[^a-z])(egp|mad|dzd|kwd|bhd|omr|qar|jod|iqd|tnd|lyd|gbp|try|cad|aud|inr|pkr|cny|jpy|chf)\s*\d/i;
function detectUnsupportedCurrency(text) {
if (addedCurrencyIn(text)) return null;
var word = UNSUPPORTED_WORDS.exec(text);
if (word) return word[1];
var known = listCurrencies().map(function (c) { return c.code; });
var world = WORLD_CURRENCIES.filter(function (c) {
return known.indexOf(c.code) < 0 && (symbolIn(c.symbol, text) || text.indexOf(normalizeAr(c.name)) >= 0);
})[0];
if (world) return world.name;
var code = UNSUPPORTED_CODES.exec(text);
return code ? (code[1] || code[2]).toUpperCase() : null;
}
var DUR_WORDS = {
'يوم': 1, 'يومين': 2, 'ايام': 1, 'اسبوع': 7, 'اسبوعين': 14,
'اسابيع': 7, 'شهر': 30, 'شهرين': 60, 'شهور': 30, 'سنه': 365,
'سنتين': 730, 'سنوات': 365
};
function parseDuration(segment) {
var t = normalizeAr(segment);
var m = t.match(/(\d+)\s*(سنوات|سنتين|اسبوعين|اسابيع|اسبوع|شهور|شهرين|شهر|يومين|ايام|يوم|سنه)/);
if (m) return Number(m[1]) * (DUR_WORDS[m[2]] || 1);
var w = t.match(/(سنوات|سنتين|اسبوعين|اسابيع|اسبوع|شهرين|شهور|شهر|يومين|ايام|يوم|سنه)/);
if (w) return DUR_WORDS[w[1]] || null;
if (/نص\s+شهر/.test(t)) return 15;
if (/ربع\s+سنه/.test(t)) return 90;
return null;
}
function extractWhen(text) {
var today = todayISO();
var rest = text;
var entryDate = today;
var dueDate = null;
var explicit = false;
var isDue = /يستحق|تستحق|لموعد/.test(rest);
if (isDue) rest = rest.replace(/يستحق|تستحق|لموعد/g, ' ');
var iso = rest.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
if (iso && isValidDate(iso[0])) {
rest = rest.replace(iso[0], ' ');
if (isDue) return { entryDate: today, dueDate: iso[0], explicit: true, rest: rest };
entryDate = iso[0];
explicit = true;
return { entryDate: entryDate, dueDate: null, explicit: true, rest: rest };
}
var dmy = rest.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
if (dmy) {
var day = Number(dmy[1]), month = Number(dmy[2]);
var year = dmy[3] ? Number(dmy[3]) : new Date().getFullYear();
if (year < 100) year += 2000;
if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
var built = year + '-' + pad2(month) + '-' + pad2(day);
if (isValidDate(built)) {
rest = rest.replace(dmy[0], ' ');
if (isDue) return { entryDate: today, dueDate: built, explicit: true, rest: rest };
entryDate = built;
explicit = true;
return { entryDate: entryDate, dueDate: null, explicit: true, rest: rest };
}
}
}
var after = rest.match(/بعد\s+([^,.!?؟،]+)/);
if (after) {
var days = parseDuration(after[1]);
if (days != null && days > 0) {
dueDate = addDays(today, days);
rest = rest.replace(after[0], ' ');
}
}
var during = rest.match(/خلال\s+([^,.!?؟،]+)/);
if (during) {
var durDays = parseDuration(during[1]);
if (durDays != null && durDays > 0) {
dueDate = addDays(today, durDays);
rest = rest.replace(during[0], ' ');
}
}
if (/نهايه\s+الاسبوع\s+القادم|نهايه\s+الاسبوع\s+القادم/.test(rest)) {
entryDate = addDays(today, 10);
rest = rest.replace(/نهايه\s+الاسبوع\s+القادم|نهايه\s+الاسبوع\s+القادم/g, ' ');
} else if (/نهايه\s+الاسبوع(?!\s+القادم)/.test(rest)) {
var wd = new Date(today + 'T00:00:00').getDay(); // 0=Sun..5=Fri..6=Sat
var daysToFri = (5 - wd + 7) % 7;
if (daysToFri === 0) daysToFri = 7;
entryDate = addDays(today, daysToFri);
rest = rest.replace(/نهايه\s+الاسبوع(?!\s+القادم)/g, ' ');
}
if (/منتصف\s+الشهر|نص\s+الشهر|نصف\s+الشهر/.test(rest)) {
var mY = Number(today.slice(0, 4)), mM = Number(today.slice(5, 7)), mD = Number(today.slice(8, 10));
if (mD > 15) { mM++; if (mM > 12) { mM = 1; mY++; } }
entryDate = mY + '-' + pad2(mM) + '-15';
rest = rest.replace(/منتصف\s+الشهر|نص\s+الشهر|نصف\s+الشهر/g, ' ');
}
if (/بدايه\s+الشهر\s+القادم|أول\s+الشهر\s+الجاي|أول\s+الشهر\s+الجاي/.test(rest)) {
var nd = new Date(today + 'T00:00:00');
nd.setMonth(nd.getMonth() + 1);
nd.setDate(1);
entryDate = nd.toISOString().slice(0, 10);
rest = rest.replace(/بدايه\s+الشهر\s+القادم|أول\s+الشهر\s+الجاي|أول\s+الشهر\s+الجاي/g, ' ');
}
if (/نهايه\s+الشهر\s+الحالي|[\u0623\u0627]\u062E\u0631\s+الشهر(?!\s+القادم)|[\u0623\u0627]\u062E\u0631\s+الشهر(?!\s+القادم)/.test(rest)) {
var cd = new Date(today + 'T00:00:00');
cd.setMonth(cd.getMonth() + 1);
cd.setDate(0);
entryDate = cd.toISOString().slice(0, 10);
rest = rest.replace(/نهايه\s+الشهر\s+الحالي|[\u0623\u0627]\u062E\u0631\s+الشهر(?!\s+القادم)|[\u0623\u0627]\u062E\u0631\s+الشهر(?!\s+القادم)/g, ' ');
}
if (/نهايه\s+الشهر\s+القادم|[\u0623\u0627]\u062E\u0631\s+الشهر\s+القادم|[\u0623\u0627]\u062E\u0631\s+الشهر\s+القادم/.test(rest)) {
var nd2 = new Date(today + 'T00:00:00');
nd2.setMonth(nd2.getMonth() + 2);
nd2.setDate(0);
entryDate = nd2.toISOString().slice(0, 10);
rest = rest.replace(/نهايه\s+الشهر\s+القادم|[\u0623\u0627]\u062E\u0631\s+الشهر\s+القادم|[\u0623\u0627]\u062E\u0631\s+الشهر\s+القادم/g, ' ');
}
if (/غدا|بكره|بكره|غداً/.test(rest)) {
entryDate = addDays(today, 1);
rest = rest.replace(/غداً|غدا|بكره/g, ' ');
} else if (/امس|أمس/.test(rest)) {
entryDate = addDays(today, -1);
rest = rest.replace(/أمس|امس/g, ' ');
} else if (/(?:^|\s)اليوم(?=\s|$)/.test(rest)) {
rest = rest.replace(/(?:^|\s)اليوم(?=\s|$)/g, ' ');
} else if (/الاسبوع\s+القادم/.test(rest)) {
entryDate = addDays(today, 7);
rest = rest.replace(/الاسبوع\s+القادم/g, ' ');
} else if (/الشهر\s+القادم/.test(rest)) {
entryDate = addDays(today, 30);
rest = rest.replace(/الشهر\s+القادم/g, ' ');
}
if (isDue && dueDate === null && entryDate !== today) {
dueDate = entryDate;
entryDate = today;
}
return { entryDate: entryDate, dueDate: dueDate, explicit: explicit, rest: rest };
}
var NUMBER_WORDS = {
'واحد':1,'واحده':1,'واحدة':1,'اثنين':2,'اثنان':2,'اثنتين':2,'ثلاثة':3,'ثلاث':3,'اربعة':4,'أربعة':4,'خمسة':5,'ستة':6,'سبعة':7,'ثمانية':8,'ثمان':8,'تسعة':9,'عشرة':10,'عشر':10,'أحدعشر':11,'احدعشر':11,'اثناعشر':12,'اثناعشر':12,
'عشرون':20,'ثلاثون':30,'اربعون':40,'أربعة':4,'خمسون':50,'ستون':60,'سبعون':70,'ثمانون':80,'تسعون':90,
'مائة':100,'مئة':100,'مئه':100, 'میة':100, 'ميه':100,'میه':100,'ميه':100,'میة':100,'میه':100,'مايه':100,'مائه':100,'ماية':100,'ثلاثمايه':300,'خمسمايه':500,'ميتين':200,'مئتان':200,'مئتين':200,'خمسين':50,'خمسون':50,'ثلاثين':30,'ثلاثون':30,'أربعين':40,'اربعين':40,'ستين':60,'ستون':60,'سبعين':70,'سبعون':70,'ثمانين':80,'ثمانون':80,'تسعين':90,'تسعون':90,'عشرين':20,'عشرون':20,'ألف':1000,'الف':1000,'مليون':1000000,'ملايين':1000000,'مليار':1000000000,
'نصف':0.5,'ربع':0.25,'ثلث':0.333,'ألفين':2000,'مليونين':2000000
};
var NUM_RE = /(\d{1,3}(?:,\d{3})+(?:\.\d+)?(?!\d)|\d{1,3}(?:\.\d{3})+(?:,\d+)?(?!\d)|\d+(?:[.,]\d+)?)\s*(مليار|مليونين|ملايين|مليون|الفين|الاف|الف)?/;
var PHONE_WORD = /(?:^|\s)((?:ل|لل|ال|و|ب|على|الى|من)?(?:\s*)(?:رقم|رقمه|رقمها|الرقم|جوال|جواله|جوالها|جوالي|الجوال|هاتف|هاتفه|الهاتف|تلفون|تليفون|موبايل|واتس|واتساب))\s*$/;
var COUNTRY_CODES = /^(?:966|967|971|965|968|973|974|962|20)/;
function phoneAccount(digits) {
var tail = digits.slice(-9);
return (state && state.accounts || []).filter(function (a) {
var p = String(a.phone || '').replace(/[٠-٩]/g, function (d) { return AR_DIGITS[d]; }).replace(/\D/g, '');
return p.length >= 7 && (p.slice(-9) === tail || p === digits);
})[0] || null;
}
function takePhones(text) {
var t = String(text || '').replace(/[٠-٩]/g, function (d) { return AR_DIGITS[d]; });
var found = [];
var re = /(?:\+|00)?\d(?:[\d\-]{5,})\d/g;
var m, cands = [];
while ((m = re.exec(t))) cands.push({ raw: m[0], start: m.index, end: m.index + m[0].length, digits: m[0].replace(/\D/g, '') });
var others = function (skip) {
var rest = t;
cands.forEach(function (c) { if (c !== skip) rest = rest.slice(0, c.start) + new Array(c.raw.length + 1).join(' ') + rest.slice(c.end); });
return /\d/.test(rest.slice(0, skip.start) + rest.slice(skip.end));
};
cands.forEach(function (c) {
if (c.digits.length < 7) return;
var before = t.slice(0, c.start);
var word = before.match(PHONE_WORD);
var account = phoneAccount(c.digits);
var phone = /^(?:\+|00)/.test(c.raw) || (c.digits.charAt(0) === '0' && c.digits.length >= 9 && c.digits.length <= 11) ||
(COUNTRY_CODES.test(c.digits) && c.digits.length >= 11) || !!word || !!account ||
(c.digits.length >= 9 && /^[57]/.test(c.digits) && others(c));
if (!phone) return;
c.phone = true;
c.cut = word ? c.start - word[1].length - (before.length - before.replace(/\s+$/, '').length) : c.start;
var dirWord = word ? word[1] : before.replace(/\s+$/, '').split(/\s+/).pop() || '';
c.dir = /^(?:ل|لل|الى)/.test(dirWord) ? 'to' : /^من/.test(dirWord) ? 'from' : null;
found.push({ digits: c.digits, account: account, dir: c.dir });
});
var out = t;
cands.filter(function (c) { return c.phone; }).sort(function (a, b) { return b.start - a.start; }).forEach(function (c) {
out = out.slice(0, c.cut) + ' ' + out.slice(c.end);
});
return { text: out.replace(/\s+/g, ' ').trim(), phones: found };
}
function parseMathOperand(numStr, unitStr) {
var clean = String(numStr || '').replace(/,/g, '');
var n = parseFloat(clean);
if (!isFinite(n)) return null;
var mult = 1;
var u = String(unitStr || '').trim();
if (u === 'الف' || u === 'الاف') mult = 1000;
else if (u === 'الفين') mult = 2000;
else if (u === 'مليون' || u === 'ملايين') mult = 1000000;
else if (u === 'مليونين') mult = 2000000;
else if (u === 'مليار') mult = 1000000000;
return n * mult;
}
function evaluateInlineMath(t) {
var mathRe = /\(?\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(مليار|مليونين|ملايين|مليون|الفين|الاف|الف)?((?:\s*[+\-*×/÷]\s*(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:مليار|مليونين|ملايين|مليون|الفين|الاف|الف)?)+)\s*\)?(?:\s*=\s*(?:[a-zA-Zء-ي?؟_]+|\d+(?:\.\d+)?))?/;
var m = t.match(mathRe);
if (!m) return null;
var fullRaw = m[0];
if (/^\s*\d{4}-\d{1,2}-\d{1,2}\s*$/.test(fullRaw)) return null;
var dmyCheck = fullRaw.match(/^\s*(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\s*$/);
if (dmyCheck && Number(dmyCheck[1]) <= 31 && Number(dmyCheck[2]) <= 12) return null;
var firstVal = parseMathOperand(m[1], m[2]);
if (firstVal === null) return null;
var tail = m[3];
var stepRe = /\s*([+\-*×/÷])\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(مليار|مليونين|ملايين|مليون|الفين|الاف|الف)?/g;
var tokens = [firstVal];
var ops = [];
var sm;
while ((sm = stepRe.exec(tail))) {
var op = sm[1];
var val = parseMathOperand(sm[2], sm[3]);
if (val === null) return null;
if (op === '×') op = '*';
if (op === '÷') op = '/';
if (op === '/' && val === 0) return null;
ops.push(op);
tokens.push(val);
}
if (!ops.length) return null;
var pTokens = [tokens[0]];
var pOps = [];
for (var i = 0; i < ops.length; i++) {
if (ops[i] === '*' || ops[i] === '/') {
var prev = pTokens.pop();
pTokens.push(ops[i] === '*' ? prev * tokens[i + 1] : prev / tokens[i + 1]);
} else {
pOps.push(ops[i]);
pTokens.push(tokens[i + 1]);
}
}
var result = pTokens[0];
for (var j = 0; j < pOps.length; j++) {
result = pOps[j] === '+' ? result + pTokens[j + 1] : result - pTokens[j + 1];
}
if (!isFinite(result) || result <= 0 || result > 1e12) return null;
return { value: Math.round(result * 100) / 100, raw: fullRaw };
}
function extractAmount(text) {
var t = normalizeAr(text);
var nightMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:ر\.?س|ريال|ريال\s*سعودي|sar)\s*ل(?:ل?ليله|ل?يوم|ل?شهر|ل?اسبوع)\s*(?:ال?واحده?|ال?واحد)?\s*ل?عدد\s*(\d+)/);
if (nightMatch) {
var perNight = parseFloat(nightMatch[1]);
var nights = parseInt(nightMatch[2], 10);
if (isFinite(perNight) && perNight > 0 && isFinite(nights) && nights > 0) {
return { value: perNight * nights, raw: nightMatch[0] };
}
}
var tClean = t
.replace(/(?:@|بسعر|سعر\s*تحويل|تحويل)\s*[:：]?\s*(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)(?:\s*(?:مليون|الف|الاف))?/gi, ' ')
.replace(/(?:بمعادل|يعادل|معادل)\s*[:：]?\s*(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)(?:\s*(?:مليون|الف|الاف))?/gi, ' ')
.replace(/(دولار(?:ات)?|\$|usd|درهم|دراهم|aed|يورو|€|euro?|يمني|yer|سعودي|sar|ريال)\s*=\s*(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)(?:\s*(?:مليون|الف|الاف))?/gi, '$1 ');
var mathRes = evaluateInlineMath(tClean);
if (mathRes) return mathRes;
var m = tClean.match(NUM_RE);
if (m) {
var raw = m[0];
var word = m[2] || '';
var numText = m[1];
if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(numText)) numText = numText.replace(/,/g, '');
else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(numText)) numText = numText.replace(/\./g, '');
var num = parseFloat(numText.replace(',', '.'));
if (isFinite(num) && num >= 0) {
var mult = 1;
if (word === 'الف' || word === 'الاف') mult = 1000;
else if (word === 'الفين') mult = 2000;
else if (word === 'مليون' || word === 'ملايين') mult = 1000000;
else if (word === 'مليونين') mult = 2000000;
else if (word === 'مليار') mult = 1000000000;
var value = num * mult;
if (value <= 1e12) return { value: value, raw: raw };
}
}
if (/(^|\s)الفين(\s|$)/.test(t)) return { value: 2000, raw: 'الفين' };
if (/(^|\s)مليونين(\s|$)/.test(t)) return { value: 2000000, raw: 'مليونين' };
t = t.replace(/احد\s+عشر/g, 'أحدعشر');
t = t.replace(/اثنا\s+عشر|اثنتا\s+عشر/g, 'اثناعشر');
var tokens = t.split(/\s+/);
if (t.indexOf('ربع مليون') >= 0) return { value: 250000, raw: 'ربع مليون' };
if (t.indexOf('نصف مليون') >= 0 || t.indexOf('نص مليون') >= 0) return { value: 500000, raw: 'نصف مليون' };
if (t.indexOf('مليون ونصف') >= 0 || t.indexOf('مليون ونص') >= 0) return { value: 1500000, raw: 'مليون ونصف' };
if (t.indexOf('أحد عشر') >= 0 || t.indexOf('احد عشر') >= 0) { /* handled in token loop */ }
var total = 0, current = 0, matched = false;
for (var i = 0; i < tokens.length; i++) {
var clean = tokens[i].replace(/[،,\.]/g, '').replace(/^و/, '');
if (NUMBER_WORDS[clean] === undefined && clean.length > 1) {
var _stripped = clean.replace(/^[بل]/, '');
if (NUMBER_WORDS[_stripped] !== undefined) clean = _stripped;
}
var val = NUMBER_WORDS[clean];
if (val !== undefined) {
matched = true;
if (clean === 'ألف' || clean === 'الف' || clean === 'ألفين' || clean === 'الفين' ||
clean === 'مليون' || clean === 'مليونين' || clean === 'ملايين' ||
clean === 'مليار' || clean === 'ألف' ) {
if (current === 0) current = 1;
current *= val;
total += current;
current = 0;
} else if (clean === 'مائة' || clean === 'مئة' || clean === 'مئه') {
if (current === 0) current = 1;
current *= 100;
} else if (val === 0.5 || val === 0.25 || val === 0.333) {
current += val;
} else {
current += val;
}
} else if (clean === 'و') {
} else {
if (current > 0) { total += current; current = 0; }
}
}
if (current > 0) total += current;
if (matched && total > 0) return { value: total, raw: t };
return null;
}
function detectKind(text) {
if (/(حولت|تحويل|نقلت)/.test(text)) return 'transfer';
if (/(سددت|سددنا|وفيت|رجعت\s+(?:ال)?دين|سداد\s+دين|دفعت\s+(?:ال)?دين)/.test(text)) return 'repay';
if (/(حصلت|قبضت\s+من|استلمت\s+من|استرجعت|رجع\s+لي|سدد\s+لي)/.test(text)) return 'collect';
if (/(?:^|\s)ا?تسلفت/.test(text)) return 'borrow';
if (/(سلفت|اقرضت|دين\s+ل(?:ي|نا)|ل(?:ي|نا)\s+عند|عهده\s+مندوب|اعطيت\s+.*(?:دين|عهده))/.test(text)) return 'lend';
if (/(استلفت|اقترضت|دين\s+علي|علي\s+دين)/.test(text)) return 'borrow';
if (/(?:^|\s)(?:بعت|بعنا|بيعت|باع)(?=\s|$)/.test(text)) return 'income';
if (/(?:^|\s)(?:شحنت|عبيت|عبيت\s+لي|شحن)\s+(?:ال)?رصيد/.test(text)) return 'expense';
if (/(?:^|\s)(?:حق|ثمن|سعر|قيمة)\s+[ء-ي]/.test(text)) return 'expense';
if (/(صرفت|اشتريت|شريت|شرينا|خلصت|دفع(?:ت|نا)|سددت\s+.*مصروف|انفقت|اصرف)/.test(text)) return 'expense';
if (/(عربون\s+مبيعات|عربون\s+بيع|عربون\s+من)/.test(text)) return 'income';
if (/(استلمت|قبضت|ربحت|وصلني|حصلت\s+على)/.test(text)) return 'income';
if (/(راتب|مرتب|ماهيه|معاش|مانضه|يوميه|ايراد|مبيعات|دخل|بيع|عموله|ربح)/.test(text)) return 'income';
if (/(مصروف|شراء|مشتريات|عربون|فاتوره|ايجار|اجار|كراء|بنزين|بقاله|مقاضي|مسواك|تقديه|مطعم|بوفيه|كشري|منقوشه|قهوه|فطور|افطار|غداء|عشاء|سحور|وجبه|كهرباء|مولده|انترنت|صيانه|علاج|دواء|سفر|تذاكر|كروه|سرفيس|توك\s*توك|ميكروباص|طاكسي|ركشه|امجاد|فرزه|طعام|جعاله|ملبس|إيجار|إيجارات|ضريبه|زكاه|صدقه|هدايا|اشتراك|رسوم|غرامه|جزاء|تصليح|تعمير|تأثيث|تأجير|وقود|بترول|مازوت|ليسونس|دبه\s+غاز|وايت\s+ماء|كشته|خرجيه)/.test(text)) return 'expense';
if (/(رصيد\s+افتتاحي|رصيد\s+سابق|رصيد\s+بداية|رصيد\s+مستحق|حساب\s+قديم|مديوني[ةه]\s+سابق[ةه]|راس\s+المال|راس\s+مال|رأس\s+المال|عندي)/.test(text)) return 'capital';
if (/(?:^|\s)(كم|رصيد|كشف|ملخص|وضعي|تحليل|رادار|لوحة القيادة|لوحه القياده|مصاريفي|ايراداتي|تقرير|بيان|كيف\s+وضع|من\s+هم|هات\s+حساب|عطني\s+حساب|اعطني\s+حساب|وريني\s+حساب)(?=\s|$|[?؟])/.test(text)) return 'query';
if (/(مساعده|كيف|ماذا|وش\s+تسوي|وش\s+تقدر|help)/.test(text)) return 'help';
return null;
}
function extractParty(text) {
var broMatch = text.match(/الاخو[ةه] +(.+?) +ل+ك+م/);
if (broMatch) {
var candidate = broMatch[1].trim();
if (candidate.length >= 2) return candidate;
}
var nameChunk = '([\\u0600-\\u06FF]{2,20}(?:\\s+[\\u0600-\\u06FF]{2,20}){0,2})';
var patterns = [
new RegExp('(?:من)\\s+' + nameChunk),
new RegExp('(?:الي|الى)\\s+' + nameChunk),
new RegExp('\\sل' + nameChunk),
new RegExp('(?:سلفت|اقرضت|استلفت|سددت|وفيت)\\s+' + nameChunk)
];
for (var i = 0; i < patterns.length; i++) {
var m = text.match(patterns[i]);
if (!m) continue;
var candidate = m[1].trim();
var ROLE_WORDS = ['مورد', 'موردون', 'عميل', 'عملاء', 'موظف', 'موظفون', 'مستخدم', 'مستخدمون'];
var rparts = candidate.split(/\s+/);
if (rparts.length > 1 && ROLE_WORDS.indexOf(rparts[0]) >= 0) { rparts.shift(); candidate = rparts.join(' '); }
while (candidate.length > 2) {
var parts = candidate.split(/\s+/);
if (parts.length <= 1) break;
var last = parts[parts.length - 1];
if (STOP_PARTY.indexOf(last) >= 0 || STOP_PARTY.indexOf(normalizeName(last)) >= 0 || /^\d+$/.test(last) || ACCOUNT_WORDS[last]) {
parts.pop();
candidate = parts.join(' ');
} else break;
}
if (candidate.length < 2) continue;
if (STOP_PARTY.indexOf(candidate) >= 0) continue;
if (STOP_PARTY.indexOf(normalizeName(candidate)) >= 0) continue;
if (ACCOUNT_WORDS[candidate]) continue;
if (/^\d+$/.test(candidate)) continue;
return candidate;
}
return '';
}
function extractPartyRaw(text) {
var broMatch = text.match(/الاخو[ةه] +(.+?) +ل+ك+م/);
if (broMatch) {
var candidate = broMatch[1].trim();
if (candidate.length >= 2) return candidate;
}
var nameChunk = '([\\u0600-\\u06FF]{2,20}(?:\\s+[\\u0600-\\u06FF]{2,20}){0,2})';
var patterns = [
new RegExp('(?:من)\\s+' + nameChunk),
new RegExp('(?:إلى|الى|الي)\\s+' + nameChunk),
new RegExp('\\sل' + nameChunk),
new RegExp('(?:سلفت|أقرضت|اقرضت|استلفت|سددت|وفيت)\\s+' + nameChunk)
];
for (var i = 0; i < patterns.length; i++) {
var m = text.match(patterns[i]);
if (!m) continue;
var candidate = m[1].trim();
var rparts = candidate.split(/\s+/);
if (rparts.length > 1 && ['مورد', 'موردون', 'عميل', 'عملاء', 'موظف', 'موظفون', 'مستخدم', 'مستخدمون'].indexOf(rparts[0]) >= 0) { rparts.shift(); candidate = rparts.join(' '); }
while (candidate.length > 2) {
var parts = candidate.split(/\s+/);
if (parts.length <= 1) break;
var last = parts[parts.length - 1];
if (STOP_PARTY.indexOf(last) >= 0 || STOP_PARTY.indexOf(normalizeName(last)) >= 0 || /^\d+$/.test(last) || ACCOUNT_WORDS[last]) {
parts.pop();
candidate = parts.join(' ');
} else break;
}
if (candidate.length < 2) continue;
var norm = normalizeName(candidate);
if (STOP_PARTY.indexOf(candidate) >= 0 || STOP_PARTY.indexOf(norm) >= 0) continue;
if (ACCOUNT_WORDS[candidate]) continue;
if (/^\d+$/.test(candidate)) continue;
return candidate;
}
return '';
}
function extractEntities(text) {
var amount = extractAmount(text);
var account = detectAccount(text);
var t = normalizeAr(text);
var currency = detectCurrency(t);
var party = extractParty(text);
var when = extractWhen(text);
var dueDate = when ? when.dueDate : null;
var multiLeg = /كاش.*اجل|اجل.*كاش|جزء.*جزء/.test(t);
return { amount: amount ? amount.value : null, rawAmount: amount ? amount.raw : null, currency: currency, account: account, party: party, kind: detectKind(text), dueDate: dueDate, multiLeg: multiLeg, entryDate: when ? when.entryDate : null };
}
function detectAccount(text) {
if (/صندوق\s+الدولار|دولار|(?:^|[^a-z])usd(?![a-z])/i.test(text)) return 'usd_box';
if (/صندوق\s+(?:الريال|الرياض)/.test(text)) return 'sar_box';
if (/المحفظة\s+الإلكترونية|محفظتي|محفظة|e-wallets|wallet/.test(text)) return 'wallet';
if (/مدخرات|توفير/.test(text)) return 'sar_box';
if (/بنك|حساب|راجحي|اهلي|الاهلي|سامبا|رياض|انماء|البلاد|الانماء|الراجحي|الأهلي/.test(text)) return 'bank';
if (/كاش|نقد|صندوق|جيب/.test(text)) return 'cash';
return null;
}
var MONEY_PLACE_WORDS = [
['usd_box', /صندوق\s+(?:الدولار|العملات)/],
['sar_box', /صندوق\s+(?:الريال|الرياض)|مدخرات|توفير/],
['wallet', /محفظ|wallet/i],
['bank', /بنك|راجحي|الاهلي|الأهلي|سامبا|انماء|الانماء|البلاد/],
['cash', /كاش|نقد|جيب|صندوق(?!\s+(?:الدولار|الريال|الرياض|العملات))/]
];
function moneyPlacesIn(body) {
var found = [];
var padded = ' ' + String(body || '') + ' ';
(state && state.accounts || []).filter(function (acc) {
return acc.liquid && !MONEY_PLACE_WORDS.some(function (p) { return p[0] === acc.id; }) && normalizeName(acc.name).length >= 2;
}).sort(function (a, b) { return normalizeName(b.name).length - normalizeName(a.name).length; }).forEach(function (acc) {
var n = normalizeName(acc.name);
var word = ' ' + n + ' ';
var at = padded.indexOf(word);
if (at < 0) { word = ' ال' + n + ' '; at = padded.indexOf(word); }
if (at < 0) return;
found.push({ id: acc.id, at: at });
padded = padded.slice(0, at) + new Array(word.length + 1).join(' ') + padded.slice(at + word.length);
});
MONEY_PLACE_WORDS.forEach(function (p) {
var at = padded.search(p[1]);
if (at >= 0 && getAccount(p[0])) found.push({ id: p[0], at: at });
});
return found.sort(function (a, b) { return a.at - b.at; }).map(function (f) { return f.id; })
.filter(function (id, i, all) { return all.indexOf(id) === i; });
}
var BUILT_IN_TRANSFER = { cash: true, bank: true, usd_box: true, sar_box: true };
function namedTransferAccounts(text) {
var found = { from: null, to: null }, lengths = { from: 0, to: 0 };
(state && state.accounts || []).forEach(function (acc) {
if (!acc.liquid || BUILT_IN_TRANSFER[acc.id]) return;
var core = normalizeName(acc.name);
if (core.length < 2) return;
var esc = core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
var re = new RegExp('(?:^|\\s)(?:(من)\\s+(?:ال)?|(?:الى|الي)\\s+(?:ال)?|لل?)' + esc + '(?=$|\\s)');
var m = text.match(re);
if (!m) return;
var side = m[1] ? 'from' : 'to';
if (core.length > lengths[side]) { found[side] = acc.id; lengths[side] = core.length; }
});
return found;
}
function detectTransfer(text, named) {
var from = null, to = null;
var f = text.match(/من\s+(الصندوق|البنك|كاش|صندوق العملات الاجنبيه|صندوق العملات|صندوق الدولار|صندوق الريال|صندوق الرياض|المدخرات|مدخرات|المحفظة\s+الإلكترونية|محفظتي|محفظة)/);
if (f) from = ACCOUNT_WORDS[f[1]] || null;
var t = text.match(/(?:الي|الى)\s+(الصندوق|البنك|كاش|صندوق العملات الاجنبيه|صندوق العملات|صندوق الدولار|صندوق الريال|صندوق الرياض|المدخرات|مدخرات|المحفظة\s+الإلكترونية|محفظتي|محفظة)/);
if (t) to = ACCOUNT_WORDS[t[1]] || null;
if (named && named.from) from = named.from;
if (named && named.to) to = named.to;
if (!from && !to) { from = 'cash'; to = 'bank'; }
else if (!from) from = to === 'cash' ? 'bank' : 'cash';
else if (!to) to = from === 'bank' ? 'cash' : 'bank';
if (from === to) { from = 'cash'; to = 'bank'; }
return { from: from, to: to };
}
function _lev(a, b) {
if (a === b) return 0;
if (!a.length) return b.length;
if (!b.length) return a.length;
var la = a.length, lb = b.length;
var d = [];
for (var i = 0; i <= la; i++) { d[i] = []; for (var j = 0; j <= lb; j++) d[i][j] = (i === 0) ? j : (j === 0 ? i : 0); }
for (var i = 1; i <= la; i++) {
for (var j = 1; j <= lb; j++) {
var cost = a[i-1] === b[j-1] ? 0 : 1;
d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + cost);
if (i > 1 && j > 1 && a[i-1] === b[j-2] && a[i-2] === b[j-1]) {
d[i][j] = Math.min(d[i][j], d[i-2][j-2] + cost);
}
}
}
return d[la][lb];
}
function ensureMemoryLoaded() {
try {
var rows = db.exec('SELECT keyword, mapped_action, account_hint, source, usage_count FROM semantic_dictionary');
adaptiveMemory = {};
if (rows && rows[0]) {
rows[0].values.forEach(function (r) {
if (r[0]) {
var _lk = String(r[0]).toLowerCase();
var _entry = { intent: r[1], account: r[2] || null, source: r[3] || null, usage: Number(r[4]) || 0, dbKey: r[0], key: _lk };
adaptiveMemory[_lk] = _entry;
var _nk = normalizeAr(_lk).trim();
if (_nk && !adaptiveMemory[_nk]) adaptiveMemory[_nk] = _entry;
}
});
}
_memBuckets = {};
var ks = Object.keys(adaptiveMemory);
for (var i = 0; i < ks.length; i++) {
var fc = ks[i].charAt(0) || '';
if (!_memBuckets[fc]) _memBuckets[fc] = [];
_memBuckets[fc].push(ks[i]);
}
} catch (e) {}
try { _parseCache.clear(); } catch (e) {}
}
function isTaught(memory) {
return memory.source === 'trained' || memory.source === 'taught';
}
function isTimeCode(word, text, now) {
var match = normalizeAr(text).trim().match(new RegExp('^' + normalizeAr(word) + '\\s*\\(?\\s*(\\d{1,3})\\s*\\)?$'));
if (!match) return false;
var at = now || new Date();
var before = new Date(at.getTime() - 60000);
var value = Number(match[1]);
return value === at.getHours() + at.getMinutes() || value === before.getHours() + before.getMinutes();
}
function isTrainingCode(text, now) { return isTimeCode('تدريب', text, now); }
function isDictionaryCode(text, now) { return isTimeCode('القاموس', text, now); }
function isOwnerCode(text, now) {
if (!root.RohOwner) return false;
return isTimeCode('MonCod', text, now);
}
function setDefaultDueDays(days) {
var d = Number(days);
if (!isFinite(d) || d < 1 || d > 365) return { ok: false, error: 'أدخل عدد أيام بين 1 و 365' };
getState().settings.defaultDueDays = Math.round(d);
saveState();
return { ok: true, days: Math.round(d) };
}
function isAnomalous(acc, balance) {
if (!acc) return false;
var b = Number(balance) || 0;
return b < 0;
}
function setAppLock(on, minutes) {
var settings = getState().settings;
settings.appLock = !!on;
if (minutes != null) settings.appLockMinutes = Math.max(0, Number(minutes) || 0);
saveState();
}
function setOwnerGate(on) {
if (!getState()) return;
getState().settings.ownerGate = !!on;
saveState();
}
function setVerifyActions(on) {
getState().settings.verifyActions = !!on;
saveState();
}
function setDictionaryOption(visible) {
getState().settings.dictionaryOption = !!visible;
saveState();
}
function setTrainingOption(visible) {
getState().settings.trainingOption = !!visible;
saveState();
}
function setOwnerCodesOption(visible) {
getState().settings.ownerCodesOption = !!visible;
saveState();
}
function sentenceKeyword(text) {
return normalizeAr(String(text || '')).toLowerCase().replace(/[0-9٠-٩][0-9٠-٩,.٬٫]*/g, ' ').replace(/\s+/g, ' ').trim();
}
var TRAINABLE_KINDS = ['expense', 'income', 'lend', 'borrow', 'collect', 'repay', 'transfer', 'capital'];
function trainSentence(text, kind, accountId) {
var keyword = sentenceKeyword(text);
if (keyword.length < 2) return { ok: false, error: 'اكتب جملة فيها كلمات' };
if (TRAINABLE_KINDS.indexOf(kind) < 0) return { ok: false, error: 'اختر نوع القيد' };
db.run('INSERT OR REPLACE INTO semantic_dictionary (keyword, mapped_action, account_hint, account_id, usage_count, last_used, language, source) VALUES (?,?,?,?,?,?,?,?)',
[keyword, kind, String(text).slice(0, 200), accountId || null, 0, new Date().toISOString(), 'ar', root.RohTrainer ? 'trained' : 'taught']);
ensureMemoryLoaded();
saveState();
return { ok: true, keyword: keyword };
}
function listTrained() {
var rows = db.exec("SELECT keyword, mapped_action, account_hint, last_used FROM semantic_dictionary WHERE source IN ('trained', 'taught') ORDER BY last_used DESC");
return rows && rows[0] ? rows[0].values.map(function (r) { return { keyword: r[0], kind: r[1], example: r[2] || '', at: r[3] || '' }; }) : [];
}
function removeTrained(keyword) {
db.run("DELETE FROM semantic_dictionary WHERE keyword = ? AND source IN ('trained', 'taught')", [keyword]);
ensureMemoryLoaded();
saveState();
}
function exportTraining() {
return JSON.stringify({
app: 'MoneyCode',
type: 'training',
version: 1,
exportedAt: new Date().toISOString(),
sentences: listTrained()
}, null, 2);
}
function readTrainingFile(text) {
var data;
try { data = JSON.parse(String(text).replace(/^\uFEFF/, '')); } catch (e) { return { ok: false, error: 'الملف ليس بصيغة JSON صحيحة' }; }
var records = data && (data.sentences || data.trained);
if (!Array.isArray(records)) return { ok: false, error: 'هذا ليس ملف تدريب' };
if (records.length > 10000) return { ok: false, error: 'الملف فيه أكثر من 10000 جملة' };
var current = {};
listTrained().forEach(function (t) { current[t.keyword] = t.kind; });
var seen = {};
var skipped = 0;
var items = [];
records.forEach(function (r) {
var sentence = r && typeof (r.example || r.keyword) === 'string' ? (r.example || r.keyword).slice(0, 200) : '';
var keyword = sentenceKeyword(sentence);
if (keyword.length < 2 || TRAINABLE_KINDS.indexOf(r && r.kind) < 0 || seen[keyword]) { skipped++; return; }
seen[keyword] = true;
var was = current[keyword];
items.push({ keyword: keyword, kind: r.kind, example: sentence, status: !was ? 'new' : was === r.kind ? 'same' : 'changed', was: was || '' });
});
return { ok: true, items: items, skipped: skipped };
}
function loadShippedTraining() {
var shipped = root.ROH_TRAINED;
if (!Array.isArray(shipped)) return;
if (!root.RohTrainer) db.run("DELETE FROM semantic_dictionary WHERE source = 'trained'");
if (!shipped.length) return;
var own = db.exec("SELECT keyword FROM semantic_dictionary WHERE source = 'taught'");
var ownSet = {};
if (own && own[0]) own[0].values.forEach(function (r) { ownSet[r[0]] = true; });
var nowIso = new Date().toISOString();
var stmt = null;
try {
db.run('BEGIN TRANSACTION');
stmt = db.prepare('INSERT OR REPLACE INTO semantic_dictionary (keyword, mapped_action, account_hint, usage_count, last_used, language, source) VALUES (?,?,?,?,?,?,?)');
for (var i = 0; i < shipped.length; i++) {
var t = shipped[i];
if (!t || !t.keyword || TRAINABLE_KINDS.indexOf(t.kind) < 0 || ownSet[t.keyword]) continue;
stmt.run([t.keyword, t.kind, t.example || null, 0, t.at || nowIso, 'ar', 'trained']);
}
stmt.free();
stmt = null;
db.run('COMMIT');
} catch (e) {
if (stmt) { try { stmt.free(); } catch (e2) {} }
try { db.run('ROLLBACK'); } catch (e3) {}
}
}
function adaptiveLookup(text) {
var q = String(text || '').toLowerCase().trim();
if (!q) return null;
var sk = sentenceKeyword(q);
var taught = adaptiveMemory[sk];
if (taught && isTaught(taught)) return taught;
if (adaptiveMemory[q]) return adaptiveMemory[q];
if (sk && adaptiveMemory[sk]) return adaptiveMemory[sk];
if (q.length >= 4) {
var best = null, bestD = 3;
var fc = q.charAt(0);
var bucket = _memBuckets[fc];
var keys = bucket || Object.keys(adaptiveMemory);
for (var i = 0; i < keys.length; i++) {
var k = keys[i];
if (Math.abs(k.length - q.length) > 2) continue;
var d = _lev(q, k);
var cand = adaptiveMemory[k];
if (d < bestD) { bestD = d; best = cand; if (d === 0) break; }
else if (d === bestD && cand && best && (cand.usage || 0) > (best.usage || 0)) { best = cand; }
}
if (best && bestD <= 2) return best;
}
var keys2 = Object.keys(adaptiveMemory);
var bestSub = null, bestSubLen = 0;
for (var i2 = 0; i2 < keys2.length; i2++) {
var k2 = keys2[i2];
if (k2.length >= 3 && k2.length > bestSubLen && q.indexOf(k2) >= 0) {
bestSub = adaptiveMemory[k2];
bestSubLen = k2.length;
}
}
if (bestSub) return bestSub;
return null;
}
function reloadMemory() { ensureMemoryLoaded(); }
var VECTOR_DIMS = 128;
var _vectorMemory = [];
var _govBattery = { charging: false, level: null };
var _govLastLatencyMs = 0;
var _repertoireBuiltRev = -1;
var _contextualRepertoire = [];
var CONCEPT_CLUSTERS = [
{ dim: 0,  re: /قهوه|كافيه|مطعم|غداء|عشاء|فطور|وجبه|بقاله|سوبرماركت|مقاضي|طعام|ماء|عصير|شاي/ },
{ dim: 1,  re: /بنزين|وقود|ديزل|زيت|مشوار|تاكسي|اوبر|كريم|باص|مواصلات|سياره|شاحنه|صيانه|اطارات|غسيل/ },
{ dim: 2,  re: /كتاب|كتب|مذكره|مذكرات|دراسه|جامعه|دوره|تعليم|منصه|قرطاسيه|مدرسه|كلية/ },
{ dim: 3,  re: /ايجار|سكن|شقه|عماره|فيلا|غرفه|معرض|مستودع|محل|دكان|عقار|مبنى|اراضي/ },
{ dim: 4,  re: /راتب|رواتب|مرتب|مكافاه|بدل|حافز|اجور|يوميه|عمال|موظف|سائق|كابتن/ },
{ dim: 5,  re: /معده|بوكلين|حفار|رافعه|شيول|اليات|مقأول|باطن|مستخلص|مشروع|هندسيه|اشراف|بناء|ترميم/ },
{ dim: 6,  re: /بضاعه|مخزون|مبيعات|غله|توريد|مشتريات|كرتون|كاشير|بيعه|متجر/ },
{ dim: 7,  re: /اسهم|سهم|تدأول|ذهب|سبائك|بيتكوين|كريبتو|توزيعات|عوائد|استثمار|محفظه/ },
{ dim: 8,  re: /كهرباء|ماء|انترنت|نت|اتصالات|جوال|فاتوره|فواتير|خدمات|حراسه|نظافه/ },
{ dim: 9,  re: /قسط|اقساط|تمويل|قرض|تسهيلات|فيزا|ائتمانيه|التزام/ },
{ dim: 10, re: /تصميم|برمجه|موقع|استشاره|شعار|سيرفر|سحابه|دومين|استضافه|اعلانات|تسويق/ },
{ dim: 11, re: /سلفت|اقرضت|استلفت|دين|سلفه|حصلت|سددت|دفعه|تسويه/ }
];
var ACTION_STOP_WORDS = {
'دفعت': 1, 'دفعنا': 1, 'صرفت': 1, 'خلصت': 1, 'سددت': 1, 'سددنا': 1, 'شريت': 1, 'شرينا': 1, 'اشتريت': 1, 'اشترينا': 1, 'بترول': 1, 'حق': 1, 'ثمن': 1, 'سعر': 1, 'قيمة': 1, 'مشتريات': 1, 'عربون': 1,
'قبضت': 1, 'استلمت': 1, 'حصلت': 1, 'سلفت': 1, 'اقرضت': 1, 'استلفت': 1,
'حولت': 1, 'عندي': 1, 'ريال': 1, 'دولار': 1, 'جنيه': 1, 'درهم': 1, 'دينار': 1,
'كاش': 1, 'نقدا': 1, 'من': 1, 'الى': 1, 'في': 1, 'على': 1, 'عن': 1
};
function stemArWord(w) {
var s = String(w || '').trim();
if (s.length > 4 && /^ال/.test(s)) s = s.slice(2);
else if (s.length > 5 && /^[وبفل]ال/.test(s)) s = s.slice(3);
if (s.length > 4 && /(ات|ين|ون|ان|ها|هم|كم|نا)$/.test(s)) s = s.slice(0, -2);
else if (s.length > 3 && /[هيهة]$/.test(s)) s = s.slice(0, -1);
return s;
}
function hashTokenToDim(str, minDim, maxDim) {
var h = 2166136261;
for (var i = 0; i < str.length; i++) {
h ^= str.charCodeAt(i);
h = Math.imul ? Math.imul(h, 16777619) : ((h * 16777619) | 0);
}
var span = maxDim - minDim;
return minDim + (Math.abs(h) % span);
}
function embed(text) {
var vec = new Array(VECTOR_DIMS);
for (var i = 0; i < VECTOR_DIMS; i++) vec[i] = 0;
var norm = normalizeAr(String(text || '')).toLowerCase()
.replace(/[0-9٠-٩.,+\-*/=?!؟،؛:"'()[\]{}]/g, ' ')
.replace(/\s+/g, ' ')
.trim();
if (!norm) return vec;
for (var ci = 0; ci < CONCEPT_CLUSTERS.length; ci++) {
if (CONCEPT_CLUSTERS[ci].re.test(norm)) vec[CONCEPT_CLUSTERS[ci].dim] += 2.5;
}
var words = norm.split(' ').filter(function (w) { return w && w.length >= 2 && !ACTION_STOP_WORDS[w]; });
if (!words.length) words = norm.split(' ').filter(Boolean);
for (var wi = 0; wi < words.length; wi++) {
var w = words[wi];
var stem = stemArWord(w);
vec[hashTokenToDim('w:' + w, 16, 80)] += 2.0;
vec[hashTokenToDim('s:' + stem, 16, 80)] += 1.6;
for (var ti = 0; ti <= w.length - 2; ti++) {
var gram = w.slice(ti, Math.min(w.length, ti + 3));
vec[hashTokenToDim('g:' + gram, 80, VECTOR_DIMS)] += 0.7;
}
}
var sumSq = 0;
for (var k = 0; k < VECTOR_DIMS; k++) sumSq += vec[k] * vec[k];
var mag = Math.sqrt(sumSq);
if (mag > 0) {
for (var m = 0; m < VECTOR_DIMS; m++) {
vec[m] = Math.round((vec[m] / mag) * 10000) / 10000;
}
}
return vec;
}
function cosineSimilarity(a, b) {
if (!a || !b || a.length !== b.length) return 0;
var dot = 0, ma = 0, mb = 0;
for (var i = 0; i < a.length; i++) {
dot += a[i] * b[i];
ma += a[i] * a[i];
mb += b[i] * b[i];
}
if (ma === 0 || mb === 0) return 0;
return dot / (Math.sqrt(ma) * Math.sqrt(mb));
}
function detectDeviceCapabilityTier() {
var cores = (typeof navigator !== 'undefined' && Number(navigator.hardwareConcurrency)) || 6;
var mem = (typeof navigator !== 'undefined' && Number(navigator.deviceMemory)) || 4;
if (cores <= 4 || mem <= 2 || _govLastLatencyMs > 12) return 'lite';
if (cores >= 8 && mem >= 6) return 'full';
return 'balanced';
}
function aiGovernorStatus() {
var tier = detectDeviceCapabilityTier();
var maxVectors = tier === 'lite' ? 150 : (tier === 'full' ? 600 : 400);
var dims = VECTOR_DIMS;
var mode = 'on-demand';
if (_govBattery.charging) {
mode = 'charging-boost';
} else if (!(state && state.settings && state.settings.bypassGovernor) && ((_govBattery.level !== null && _govBattery.level < 0.20) || _govLastLatencyMs > 12)) {
mode = 'ultra-eco';
}
var needsRep = _repertoireBuiltRev !== _stateRev || !_contextualRepertoire.length;
return {
tier: tier,
mode: mode,
charging: !!_govBattery.charging,
batteryLevel: _govBattery.level,
maxVectors: maxVectors,
dims: dims,
lastLatencyMs: _govLastLatencyMs,
needsRepertoireBuild: needsRep
};
}
function vectorMemoryEnabled() {
return !(state && state.settings && state.settings.vectorMemoryEnabled === false);
}
function setVectorMemoryEnabled(val) {
if (!state) return { ok: false };
state.settings = state.settings || {};
state.settings.vectorMemoryEnabled = !!val;
saveState();
return { ok: true, enabled: state.settings.vectorMemoryEnabled };
}
function vectorAutoConfirm() {
return !(state && state.settings && state.settings.vectorAutoConfirm === false);
}
function setVectorAutoConfirm(val) {
if (!state) return { ok: false };
state.settings = state.settings || {};
state.settings.vectorAutoConfirm = !!val;
saveState();
return { ok: true, autoConfirm: state.settings.vectorAutoConfirm };
}
function vectorCount() {
return _vectorMemory.length;
}
function trainVectorMemory(record) {
if (!vectorMemoryEnabled()) return { ok: false, reason: 'disabled' };
if (!record || !record.text) return { ok: false, reason: 'empty' };
var text = String(record.text).trim();
var kind = String(record.kind || 'expense').trim();
var accountId = String(record.accountId || '').trim();
var shapeKey = kind + '|' + accountId + '|' + exampleKey(text);
var id = record.id || ('vec_' + vocabSaltedHash(shapeKey).slice(0, 12));
var v = embed(text);
var existing = null;
for (var i = 0; i < _vectorMemory.length; i++) {
if (_vectorMemory[i].id === id || (_vectorMemory[i].accountId === accountId && _vectorMemory[i].kind === kind && exampleKey(_vectorMemory[i].text) === exampleKey(text))) {
existing = _vectorMemory[i];
break;
}
}
var nowIso = new Date().toISOString();
if (existing) {
existing.text = text;
existing.kind = kind;
existing.accountId = accountId;
existing.vector = v;
existing.usageCount = (Number(existing.usageCount) || 1) + (Number(record.usageDelta) || 1);
existing.createdAt = nowIso;
id = existing.id;
} else {
var item = {
id: id,
kind: kind,
text: text,
accountId: accountId,
vector: v,
createdAt: nowIso,
usageCount: Number(record.usageCount) || 1
};
_vectorMemory.push(item);
existing = item;
}
var cap = aiGovernorStatus().maxVectors;
if (_vectorMemory.length > cap) {
_vectorMemory.sort(function (a, b) { return (b.usageCount || 0) - (a.usageCount || 0); });
_vectorMemory = _vectorMemory.slice(0, cap);
}
if (db) {
try {
db.run('INSERT OR REPLACE INTO semantic_vectors (id, kind, text, account_id, vector, created_at, usage_count) VALUES (?,?,?,?,?,?,?)',
[existing.id, existing.kind, existing.text, existing.accountId, JSON.stringify(existing.vector), existing.createdAt, existing.usageCount]);
} catch (e) {}
}
return { ok: true, id: existing.id, usageCount: existing.usageCount };
}
function vectorSearch(query, k) {
if (!vectorMemoryEnabled()) return [];
var gov = aiGovernorStatus();
if (gov.mode === 'ultra-eco') return [];
if (!_vectorMemory.length || !query) return [];
var t0 = Date.now();
var qVec = embed(query);
var limit = Math.max(1, Number(k) || 5);
var scored = [];
for (var i = 0; i < _vectorMemory.length; i++) {
if ((i & 31) === 31 && (Date.now() - t0) > 10) break;
var item = _vectorMemory[i];
if (!item || !Array.isArray(item.vector)) continue;
var sim = cosineSimilarity(qVec, item.vector);
if (sim <= 0.05) continue;
var usageBoost = Math.min(0.06, Math.max(0, ((item.usageCount || 1) - 1) * 0.02));
var finalScore = Math.min(1, Math.round((sim + usageBoost) * 1000) / 1000);
scored.push({
id: item.id,
kind: item.kind,
text: item.text,
accountId: item.accountId,
usageCount: item.usageCount || 1,
score: finalScore,
confidence: Math.round(finalScore * 100)
});
}
_govLastLatencyMs = Date.now() - t0;
scored.sort(function (a, b) { return b.score - a.score || b.usageCount - a.usageCount; });
return scored.slice(0, limit);
}
function correctClassification(patch) {
if (!patch || !patch.phrase) return { ok: false, error: 'بيانات التصحيح ناقصة' };
var phrase = String(patch.phrase).trim();
var correctedKind = String(patch.correctedKind || patch.originalKind || 'expense').trim();
var correctedAccId = String(patch.correctedAccountId || '').trim();
var originalAccId = String(patch.originalAccountId || '').trim();
var acc = correctedAccId ? getAccount(correctedAccId) : null;
var norm = normalizeAr(phrase).toLowerCase().replace(/[0-9٠-٩.,]+/g, ' ').replace(/\s+/g, ' ').trim();
var words = norm.split(' ').filter(function (w) { return w && w.length >= 2 && !ACTION_STOP_WORDS[w]; });
var shape = exampleKey(phrase);
_vectorMemory = _vectorMemory.filter(function (v) {
if (originalAccId && v.accountId === originalAccId && exampleKey(v.text) === shape) {
if (db) { try { db.run('DELETE FROM semantic_vectors WHERE id = ?', [v.id]); } catch (e) {} }
return false;
}
return true;
});
trainVectorMemory({
kind: correctedKind,
text: phrase,
accountId: correctedAccId,
usageCount: 3,
usageDelta: 3
});
var nowIso = new Date().toISOString();
var mappedAction = correctedKind === 'income' ? 'قبض' : (correctedKind === 'lend' ? 'سلف' : (correctedKind === 'borrow' ? 'استلاف' : 'صرف'));
if (db) {
words.forEach(function (w) {
try {
db.run('INSERT OR REPLACE INTO semantic_dictionary (keyword, mapped_action, account_hint, account_id, usage_count, last_used, language, source, confidence) VALUES (?,?,?,?,?,?,?,?,?)',
[w, mappedAction, acc ? acc.name : correctedAccId, correctedAccId, 5, nowIso, 'ar', 'taught', 0.98]);
} catch (e) {}
});
}
if (state && state.settings && state.settings.persona && PERSONAS[state.settings.persona]) {
var pAccs = PERSONAS[state.settings.persona].accounts || [];
pAccs.forEach(function (pa) {
if (!Array.isArray(pa.keywords)) pa.keywords = [];
if (pa.code === originalAccId) {
pa.keywords = pa.keywords.filter(function (kw) {
var nkw = normalizeAr(kw).trim();
return words.indexOf(nkw) < 0;
});
}
if (pa.code === correctedAccId) {
words.forEach(function (w) {
if (pa.keywords.indexOf(w) < 0) pa.keywords.unshift(w);
});
}
});
}
ensureMemoryLoaded();
try { _parseCache.clear(); } catch (e) {}
_stateRev++;
saveState();
return { ok: true, accountId: correctedAccId, kind: correctedKind };
}
function evaluateAutoConfirm(intent, text) {
if (!vectorMemoryEnabled() || !vectorAutoConfirm()) {
return { autoConfirm: false, confidence: 0, reason: 'disabled' };
}
if (!intent || !intent.kind || !(intent.amountMinor > 0)) {
return { autoConfirm: false, confidence: 0, reason: 'incomplete' };
}
if (intent.kind === 'needSplit' || intent.kind === 'needAmount' || intent.kind === 'needKind' || (intent.lacksCurrency && intent.lacksCurrency.length)) {
return { autoConfirm: false, confidence: 0, reason: 'needs-clarification' };
}
var hits = vectorSearch(text || intent.memo || '', 1);
if (!hits.length) return { autoConfirm: false, confidence: 0, reason: 'no-match' };
var top = hits[0];
var _acThresh = (state.settings && typeof state.settings.autoConfirmThreshold === 'number') ? state.settings.autoConfirmThreshold : 92;
var _acUsage = (state.settings && typeof state.settings.autoConfirmUsageCount === 'number') ? state.settings.autoConfirmUsageCount : 3;
if (top.confidence < _acThresh || (top.usageCount || 0) < _acUsage || top.kind !== intent.kind) {
return { autoConfirm: false, confidence: top.confidence, reason: 'below-threshold', match: top };
}
try {
var draft = buildDraft(intent);
var fr = detectFraudRisk(draft);
if (fr && fr.risk !== 'low') {
return { autoConfirm: false, confidence: top.confidence, reason: 'fraud-guard', risk: fr.risk };
}
} catch (e) {
return { autoConfirm: false, confidence: top.confidence, reason: 'build-error' };
}
return {
autoConfirm: true,
confidence: top.confidence,
accountId: top.accountId,
usageCount: top.usageCount,
reason: 'verified-pattern'
};
}
function buildContextualRepertoire() {
if (!state) return [];
var out = [];
var seen = {};
var addRep = function (text, accId, kind, why) {
var conv = exampleInMainCurrency(text);
var k = exampleKey(conv);
if (!conv || !k || seen[k]) return;
seen[k] = true;
out.push({ text: conv, accountId: accId || '', kind: kind || 'expense', reason: why || 'ذخيرة سياقية', smart: false, learned: false, repertoire: true });
};
var locale = String((state.settings && state.settings.language) || 'ar-SA');
var payVerb = /^ar-YE/i.test(locale) ? 'صرفت' : (/^ar-(DZ|MA)/i.test(locale) ? 'خلصت' : 'دفعت');
var bankAcc = getAccount('bank');
var bankName = (bankAcc && bankAcc.name && bankAcc.name !== 'البنك') ? bankAcc.name : 'البنك';
(state.dueItems || []).filter(function (d) { return d && d.remaining > 0 && d.counterparty; }).slice(0, 3).forEach(function (d) {
var amt = Math.round((d.remaining || 100000) / 100);
if (d.kind === 'payable') addRep('سددت ' + d.counterparty + ' ' + amt + ' من ' + bankName, 'payable', 'repay', 'من التزامات دفترك');
else addRep('حصلت من ' + d.counterparty + ' ' + amt, 'receivable', 'collect', 'من مستحقات دفترك');
});
var knownParties = [];
(state.entries || []).slice(-30).forEach(function (e) {
if (e && e.counterparty && knownParties.indexOf(e.counterparty) < 0) knownParties.push(e.counterparty);
});
if (knownParties[0]) {
addRep(payVerb + ' 500 لـ ' + knownParties[0] + ' من ' + bankName, 'expense', 'expense', 'طرف في دفترك');
}
addRep('حولت 1000 من الصندوق إلى ' + bankName, 'bank', 'transfer', 'تحويل لبنكك');
var pKey = (state.settings && state.settings.persona) || 'student';
var pDef = PERSONAS[pKey] || PERSONAS.student;
if (pDef && Array.isArray(pDef.accounts)) {
pDef.accounts.forEach(function (pa) {
var kw = (pa.keywords && pa.keywords[0]) || pa.name;
if (pa.type === 'revenue') {
addRep('قبضت 2500 ' + kw + ' في ' + bankName, pa.code, 'income', pDef.title);
} else if (pa.type === 'expense') {
addRep(payVerb + ' 150 ' + kw + ' كاش', pa.code, 'expense', pDef.title);
}
});
}
_contextualRepertoire = out.slice(0, 12);
_repertoireBuiltRev = _stateRev;
if (state.settings) state.settings.contextualRepertoire = _contextualRepertoire;
return _contextualRepertoire.slice();
}
function getContextualRepertoire() {
if (!_contextualRepertoire.length && state && state.settings && Array.isArray(state.settings.contextualRepertoire)) {
_contextualRepertoire = state.settings.contextualRepertoire;
}
return _contextualRepertoire.slice();
}
function runChargingOpportunityBuilder() {
if (!state || !vectorMemoryEnabled()) return { ok: false, reason: 'disabled' };
var rep = buildContextualRepertoire();
var builtVectors = 0;
rep.forEach(function (r) {
if (r.text && r.accountId) {
var tr = trainVectorMemory({ kind: r.kind || 'expense', text: r.text, accountId: r.accountId, usageCount: 1 });
if (tr && tr.ok) builtVectors++;
}
});
(state.entries || []).slice(-80).forEach(function (e) {
if (!e || !e.memo) return;
var nonLiquid = (e.lines || []).filter(function (l) { var a = getAccount(l.accountId); return a && !a.liquid; })[0];
if (nonLiquid) {
var trE = trainVectorMemory({ kind: e.kind, text: e.memo, accountId: nonLiquid.accountId, usageCount: 2 });
if (trE && trE.ok) builtVectors++;
}
});
return { ok: true, builtVectors: builtVectors, builtRepertoire: rep.length };
}
function updateBatteryStatus(info) {
info = info || {};
if (typeof info.charging === 'boolean') _govBattery.charging = info.charging;
if (typeof info.level === 'number' && isFinite(info.level)) _govBattery.level = Math.max(0, Math.min(1, info.level));
var status = aiGovernorStatus();
if (status.charging && status.needsRepertoireBuild && vectorMemoryEnabled()) {
runChargingOpportunityBuilder();
status = aiGovernorStatus();
}
return status;
}
function noteUsage(keyword) {
if (!keyword) return { ok: false, error: 'no keyword' };
var key = String(keyword).toLowerCase().trim();
var mem = adaptiveMemory[key];
var dbKey = mem && mem.dbKey ? mem.dbKey : keyword;
try {
db.run('UPDATE semantic_dictionary SET usage_count = COALESCE(usage_count,0) + 1, last_used = ? WHERE keyword = ?', [new Date().toISOString(), dbKey]);
} catch (e) { log('warn', 'noteUsage failed', e); }
if (mem) mem.usage = (mem.usage || 0) + 1;
try { _parseCache.clear(); } catch (e) {}
saveState();
return { ok: true };
}
var DIALECT_VOCAB_SEEDS = [
{ keyword: 'كروة', action: 'صرف', hint: 'مواصلات', language: 'ar-YE' },
{ keyword: 'جعالة', action: 'صرف', hint: 'ضيافة', language: 'ar-YE' },
{ keyword: 'دبة غاز', action: 'صرف', hint: 'فواتير', language: 'ar-YE' },
{ keyword: 'وايت ماء', action: 'صرف', hint: 'فواتير', language: 'ar-YE' },
{ keyword: 'فرزة', action: 'صرف', hint: 'مواصلات', language: 'ar-YE' },
{ keyword: 'مقاضي', action: 'صرف', hint: 'بقالة', language: 'ar-SA' },
{ keyword: 'تموينات', action: 'صرف', hint: 'بقالة', language: 'ar-SA' },
{ keyword: 'كشتة', action: 'صرف', hint: 'ترفيه', language: 'ar-SA' },
{ keyword: 'بوفية', action: 'صرف', hint: 'مطعم', language: 'ar-SA' },
{ keyword: 'توك توك', action: 'صرف', hint: 'مواصلات', language: 'ar-EG' },
{ keyword: 'ميكروباص', action: 'صرف', hint: 'مواصلات', language: 'ar-EG' },
{ keyword: 'كشري', action: 'صرف', hint: 'طعام', language: 'ar-EG' },
{ keyword: 'مرتب', action: 'قبض', hint: 'راتب', language: 'ar-EG' },
{ keyword: 'ماهية', action: 'قبض', hint: 'راتب', language: 'ar-EG' },
{ keyword: 'سرفيس', action: 'صرف', hint: 'مواصلات', language: 'ar-SY' },
{ keyword: 'مازوت', action: 'صرف', hint: 'وقود', language: 'ar-SY' },
{ keyword: 'منقوشة', action: 'صرف', hint: 'طعام', language: 'ar-LB' },
{ keyword: 'مونة', action: 'صرف', hint: 'بقالة', language: 'ar-SY' },
{ keyword: 'خرجية', action: 'صرف', hint: 'مصروف', language: 'ar-SY' },
{ keyword: 'معاش', action: 'قبض', hint: 'راتب', language: 'ar-JO' },
{ keyword: 'خلصت', action: 'صرف', hint: 'مصروف', language: 'ar-MA' },
{ keyword: 'كراء', action: 'صرف', hint: 'إيجار', language: 'ar-MA' },
{ keyword: 'تقدية', action: 'صرف', hint: 'بقالة', language: 'ar-MA' },
{ keyword: 'ليسونس', action: 'صرف', hint: 'وقود', language: 'ar-DZ' },
{ keyword: 'طاكسي', action: 'صرف', hint: 'مواصلات', language: 'ar-MA' },
{ keyword: 'مانضة', action: 'قبض', hint: 'راتب', language: 'ar-DZ' },
{ keyword: 'مسواك', action: 'صرف', hint: 'بقالة', language: 'ar-IQ' },
{ keyword: 'مولدة', action: 'صرف', hint: 'كهرباء', language: 'ar-IQ' },
{ keyword: 'ركشة', action: 'صرف', hint: 'مواصلات', language: 'ar-SD' },
{ keyword: 'امجاد', action: 'صرف', hint: 'مواصلات', language: 'ar-SD' },
{ keyword: 'يومية', action: 'قبض', hint: 'إيراد', language: 'ar-SD' }
];
function trainVocabulary() {
if (!db) return 0;
var allSeeds = (VOCAB_SEEDS && VOCAB_SEEDS.length ? VOCAB_SEEDS : []).concat(DIALECT_VOCAB_SEEDS);
var nowIso = new Date().toISOString();
var stmt = null;
try {
db.run('BEGIN TRANSACTION');
stmt = db.prepare('INSERT OR IGNORE INTO semantic_dictionary (keyword, mapped_action, account_hint, usage_count, last_used, language, source) VALUES (?,?,?,?,?,?,?)');
for (var i = 0; i < allSeeds.length; i++) {
var s = allSeeds[i];
if (!s || !s.keyword) continue;
try {
stmt.run([s.keyword, s.action, s.hint || null, 0, nowIso, s.language || 'ar', 'vocab']);
} catch (e0) {}
}
stmt.free();
stmt = null;
db.run('COMMIT');
} catch (e) {
if (stmt) { try { stmt.free(); } catch (e2) {} }
try { db.run('ROLLBACK'); } catch (e3) {}
}
ensureMemoryLoaded();
try {
var crow = db.exec('SELECT COUNT(*) AS c FROM semantic_dictionary');
var c = (crow && crow[0] && crow[0].values && crow[0].values[0]) ? crow[0].values[0][0] : 0;
return c;
} catch (e) { return 0; }
}
function listVocab(query, actionFilter, langFilter, limit) {
limit = limit || 200;
var sql = 'SELECT id, keyword, mapped_action, account_hint, account_id, usage_count, language FROM semantic_dictionary WHERE 1=1';
var params = [];
if (query) { sql += ' AND (keyword LIKE ? OR mapped_action LIKE ? OR account_hint LIKE ?)'; params.push('%'+query+'%', '%'+query+'%', '%'+query+'%'); }
if (actionFilter && actionFilter !== 'الكل') { sql += ' AND mapped_action = ?'; params.push(actionFilter); }
if (langFilter && langFilter !== 'الكل') { sql += ' AND language = ?'; params.push(langFilter); }
sql += ' ORDER BY usage_count DESC, keyword ASC LIMIT ?';
params.push(limit);
try {
var stmt = db.prepare(sql);
stmt.bind(params);
var out = [];
while (stmt.step()) {
var r = stmt.getAsObject();
var _acc = r.account_id ? getAccount(r.account_id) : null;
var _hint = _acc ? _acc.name : r.account_hint;
out.push({ id: r.id, keyword: r.keyword, mapped_action: r.mapped_action, account_hint: _hint, account_id: r.account_id, usage_count: r.usage_count, language: r.language });
}
stmt.free();
if (query && out.length < 10) {
try {
var all = db.prepare('SELECT id, keyword, mapped_action, account_hint, account_id, usage_count, language FROM semantic_dictionary');
var seen = {};
out.forEach(function (o) { seen[o.id] = true; });
var q = String(query).toLowerCase();
while (all.step()) {
var r = all.getAsObject();
if (seen[r.id]) continue;
if (actionFilter && actionFilter !== '\u0627\u0644\u0643\u0644' && r.mapped_action !== actionFilter) continue;
if (langFilter && langFilter !== '\u0627\u0644\u0643\u0644' && r.language !== langFilter) continue;
if (_lev(q, String(r.keyword).toLowerCase()) <= 2) {
var _acc = r.account_id ? getAccount(r.account_id) : null;
var _hint = _acc ? _acc.name : r.account_hint;
out.push({ id: r.id, keyword: r.keyword, mapped_action: r.mapped_action, account_hint: _hint, account_id: r.account_id, usage_count: r.usage_count, language: r.language });
seen[r.id] = true;
if (out.length >= 300) break;
}
}
all.free();
} catch (e) {}
}
return out;
} catch (e) { return []; }
}
function deleteVocab(id) {
try {
var rows = db.exec('SELECT keyword, mapped_action, account_hint, usage_count, last_used FROM semantic_dictionary WHERE id = ' + Number(id));
if (rows && rows[0] && rows[0].values && rows[0].values[0]) {
var r = rows[0].values[0];
db.run('INSERT INTO semantic_dictionary_trash (keyword, mapped_action, account_hint, usage_count, last_used) VALUES (?,?,?,?,?)', [r[0], r[1], r[2], r[3], r[4]]);
}
db.run('DELETE FROM semantic_dictionary WHERE id = ' + Number(id));
ensureMemoryLoaded();
return true;
} catch (e) { return false; }
}
function restoreVocab(id) {
try {
var rows = db.exec('SELECT keyword, mapped_action, account_hint, usage_count, last_used FROM semantic_dictionary_trash WHERE id = ' + Number(id));
if (rows && rows[0] && rows[0].values && rows[0].values[0]) {
var r = rows[0].values[0];
db.run('INSERT OR IGNORE INTO semantic_dictionary (keyword, mapped_action, account_hint, usage_count, last_used, language, source) VALUES (?,?,?,?,?,?,?)', [r[0], r[1], r[2], r[3], r[4], 'ar', 'restored']);
}
db.run('DELETE FROM semantic_dictionary_trash WHERE id = ' + Number(id));
ensureMemoryLoaded();
return true;
} catch (e) { return false; }
}
function listVocabTrash() {
try {
var rows = db.exec('SELECT id, keyword, mapped_action, account_hint, usage_count FROM semantic_dictionary_trash ORDER BY deleted_at DESC LIMIT 200');
var out = [];
if (rows && rows[0]) rows[0].values.forEach(function (r) { out.push({ id: r[0], keyword: r[1], mapped_action: r[2], account_hint: r[3], usage_count: r[4] }); });
return out;
} catch (e) { return []; }
}
function emptyVocabTrash() {
try { db.run('DELETE FROM semantic_dictionary_trash'); return true; } catch (e) { return false; }
}
function exportVocabJSON() {
try {
var rows = db.exec('SELECT keyword, mapped_action, account_hint, usage_count, language, source FROM semantic_dictionary');
var arr = [];
if (rows && rows[0]) rows[0].values.forEach(function (r) {
arr.push({ keyword: r[0], action: r[1], hint: r[2], usage_count: r[3], language: r[4], source: r[5] });
});
return JSON.stringify(arr, null, 2);
} catch (e) { return '[]'; }
}
function importVocabJSON(jsonStr) {
var added = 0;
try {
var arr = JSON.parse(jsonStr);
if (!Array.isArray(arr)) return 0;
arr.forEach(function (s) {
try {
db.run('INSERT OR IGNORE INTO semantic_dictionary (keyword, mapped_action, account_hint, usage_count, last_used, language, source) VALUES (?,?,?,?,?,?,?)',
[s.keyword, s.action || s.mapped_action || 'صرف', s.hint || s.account_hint || null, s.usage_count || 0, new Date().toISOString(), s.language || 'ar', s.source || 'import']);
added++;
} catch (e) {}
});
ensureMemoryLoaded();
} catch (e) {}
return added;
}
function getVocabCount() {
try {
var crow = db.exec('SELECT COUNT(*) AS c FROM semantic_dictionary');
return (crow && crow[0] && crow[0].values && crow[0].values[0]) ? crow[0].values[0][0] : 0;
} catch (e) { return 0; }
}
function integrityCheck() {
var msgs = [];
var ok = true;
try {
var r = db.exec('PRAGMA integrity_check');
var res = (r && r[0] && r[0].values && r[0].values[0]) ? String(r[0].values[0][0]) : 'unknown';
if (res.toLowerCase() !== 'ok') { ok = false; msgs.push('integrity_check: ' + res); }
else msgs.push('integrity_check: ok');
} catch (e) { ok = false; msgs.push('integrity_check failed: ' + String(e)); }
try {
var d = db.exec('SELECT COUNT(*) FROM semantic_dictionary WHERE account_id IS NOT NULL AND account_id NOT IN (SELECT id FROM accounts)');
var n = (d && d[0] && d[0].values && d[0].values[0]) ? d[0].values[0][0] : 0;
if (n > 0) { ok = false; msgs.push('dangling account_id: ' + n); }
else msgs.push('account_id references: ok');
} catch (e) { msgs.push('account_id check failed: ' + String(e)); }
try {
var lw = db.exec('SELECT COUNT(*) FROM learned_words');
var lwc = (lw && lw[0] && lw[0].values && lw[0].values[0]) ? lw[0].values[0][0] : 0;
msgs.push('learned_words: ' + lwc);
} catch (e) {}
return { ok: ok, messages: msgs };
}
function resetDictionary() {
try {
db.run("DELETE FROM semantic_dictionary WHERE source IN ('vocab','learned','import','restored')");
db.run("DELETE FROM learned_words");
} catch (e) { log('warn', 'resetDictionary delete failed', e); }
var shippedVer = (typeof window !== 'undefined' && window.ROH_VOCAB_VERSION) ? Number(window.ROH_VOCAB_VERSION) : 1;
try { db.run("DELETE FROM settings WHERE key = 'vocabVersion'"); } catch (e) {}
if (VOCAB_SEEDS && VOCAB_SEEDS.length) trainVocabulary();
try { db.run("INSERT OR REPLACE INTO settings (key,value) VALUES ('vocabVersion',?)", [String(shippedVer)]); } catch (e) {}
ensureMemoryLoaded();
saveState();
return { ok: true, vocabCount: getVocabCount() };
}
function transferParty(party) {
return /كاش|بنك|صندوق|محفظ|مدخرات|حساب|راجحي|اهلي|سامبا|رياض|انماء|البلاد|دولار/.test(normalizeAr(party)) ? '' : party;
}
var CANDIDATE_SKIP = { receivable: true, payable: true, capital: true, revenue: true, expense: true };
var COMMON_NAME_WORDS = ['ابو', 'ام', 'بن', 'بنت', 'عبد', 'ال'];
function accountCandidates(query, limit) {
var q = normalizeName(query || '');
var digits = normalizeAr(query || '').replace(/\D/g, '');
if (!q && digits.length < 7) return [];
var qWords = q.split(' ').filter(function (w) { return w.length >= 3 && COMMON_NAME_WORDS.indexOf(w) < 0; });
var out = [];
(state && state.accounts || []).forEach(function (acc) {
if (acc.liquid || CANDIDATE_SKIP[acc.id] || (acc.type !== 'asset' && acc.type !== 'liability')) return;
var best = null, exact = false, via = '';
var phone = normalizeAr(acc.phone || '').replace(/\D/g, '');
if (digits.length >= 7 && phone && (phone.indexOf(digits) >= 0 || digits.indexOf(phone.slice(-9)) >= 0)) { best = 0; exact = true; via = acc.phone; }
[[acc.name, ''], [acc.nickname, acc.nickname]].forEach(function (pair) {
var n = normalizeName(pair[0] || '');
if (!n || !q) return;
var score = null;
if (n === q) { score = 0; exact = true; }
else if (n.indexOf(q + ' ') === 0 || q.indexOf(n + ' ') === 0) score = 1;
else if (q.length >= 3 && (n.indexOf(q) >= 0 || q.indexOf(n) >= 0)) score = 2;
else if (qWords.some(function (w) { return n.split(' ').indexOf(w) >= 0; })) score = 2;
else if (q.length >= 3) {
var d = _lev(q, n);
if (d <= (q.length <= 4 ? 1 : 2)) score = 2 + d;
}
if (score !== null && (best === null || score < best)) { best = score; via = pair[1]; }
});
if (best !== null) out.push({ id: acc.id, name: acc.name, exact: exact, score: best, via: via || '' });
});
out.sort(function (a, b) { return a.score - b.score || a.name.length - b.name.length; });
return out.slice(0, limit || 5);
}
function writtenMoneyAccount(body) {
var padded = ' ' + body + ' ';
var found = null, length = 0;
(state && state.accounts || []).forEach(function (acc) {
if (!acc.liquid) return;
accountNamesOf(acc).forEach(function (name) {
var n = normalizeName(name);
if (n.length < 2 || n.length <= length) return;
if (padded.indexOf(' ' + n + ' ') >= 0 || padded.indexOf(' ال' + n + ' ') >= 0) { found = acc.id; length = n.length; }
});
});
return found;
}
function moneyAccountChoice(body) {
var liquid = (state && state.accounts || []).filter(function (a) { return a.liquid; });
var padded = ' ' + body + ' ';
var re = /(?:^|\s)(?:من|الى|الي)\s+(\S+)/g, m;
while ((m = re.exec(body))) {
var w = normalizeName(m[1]);
if (w.length < 2) continue;
var cands = liquid.filter(function (a) { return normalizeName(a.name).split(' ').indexOf(w) >= 0; });
if (cands.length < 2) continue;
var settled = liquid.some(function (a) {
return accountNamesOf(a).some(function (name) {
var n = normalizeName(name);
return n.indexOf(' ') > 0 && (padded.indexOf(' ' + n + ' ') >= 0 || padded.indexOf(' ال' + n + ' ') >= 0);
});
});
if (settled) continue;
cands.sort(function (a, b) { return (normalizeName(b.name) === w) - (normalizeName(a.name) === w) || a.name.length - b.name.length; });
return { word: m[1], candidates: cands.map(function (a) { return a.name; }) };
}
return null;
}
function personAccountsFor(body, word) {
var padded = ' ' + body + ' ';
var first = normalizeName(word);
var full = null, fullLength = 0, starts = [];
(state && state.accounts || []).forEach(function (acc) {
if (acc.liquid || (acc.type !== 'asset' && acc.type !== 'liability')) return;
[acc.name, acc.nickname].forEach(function (n) {
var norm = normalizeAr(n || '');
if (norm.indexOf(' ') > 0 && padded.indexOf(' ' + norm + ' ') >= 0 && norm.length > fullLength) { full = acc.name; fullLength = norm.length; }
});
[acc.name, acc.nickname].forEach(function (n) {
if (n && normalizeName(String(n).split(/\s+/)[0]) === first && starts.indexOf(acc.name) < 0) starts.push(acc.name);
});
});
return full ? [full] : starts;
}
function kindFromAction(action) {
var mapped = String(action || '').toLowerCase();
if (mapped.indexOf('صرف') >= 0 || mapped === 'expense') return 'expense';
if (mapped.indexOf('قبض') >= 0 || mapped === 'income') return 'income';
if (mapped.indexOf('تحصيل') >= 0) return 'collect';
if (mapped.indexOf('تسديد') >= 0) return 'repay';
if (mapped.indexOf('تحويل') >= 0) return 'transfer';
if (mapped.indexOf('شراء') >= 0 || mapped === 'buy') return 'expense';
if (mapped.indexOf('بيع') >= 0) return 'income';
return null;
}
var FINANCING_WORDS = /تسهيلات|تسهيل|تمويل|تقسيط|بالاجل|بالآجل|قرض|علي\s*الحساب/;
function resolvePersonAccount(name, type) {
var n = normalizeName(name);
if (!n) return null;
var people = (state && state.accounts || []).filter(function (a) { return !a.liquid && (a.type === 'asset' || a.type === 'liability'); });
var exact = people.filter(function (a) { return normalizeName(a.name) === n || (a.nickname && normalizeName(a.nickname) === n); });
if (exact.length) {
var sameType = exact.filter(function (a) { return a.type === type; });
return (sameType[0] || exact[0]).id;
}
var starts = people.filter(function (a) { return normalizeName(String(a.name).split(/\s+/)[0]) === n; });
return starts.length === 1 ? starts[0].id : null;
}
function personLine(name, type, side, minor, currency) {
var own = resolvePersonAccount(name, type);
var line = { accountId: own || (type === 'liability' ? 'payable' : 'receivable'), currency: currency, debitMinor: side === 'debit' ? minor : 0, creditMinor: side === 'credit' ? minor : 0, counterparty: name };
if (!own) line.newPerson = { name: name, type: type, subtype: type === 'liability' ? 'الموردين' : 'العملاء' };
return line;
}
var PROPERTY_WORDS = /عقار|ارض|أرض|شقه|شقة|فيلا|فله|عماره|عمارة|مبنى|مبني|محل/;
function assetAccountFor(word) {
var w = normalizeAr(String(word || '')).trim();
if (!w) return null;
var found = null;
Object.keys(PERSONAS).some(function (key) {
return (PERSONAS[key].accounts || []).some(function (pa) {
if (pa.type !== 'asset' || !getAccount(pa.code)) return false;
var hit = (pa.keywords || []).some(function (kw) { var k = normalizeAr(kw).trim(); return k && (w.indexOf(k) >= 0 || k.indexOf(w) >= 0); });
if (hit) found = pa.code;
return hit;
});
});
if (found) return found;
var n = normalizeName(w);
var named = (state && state.accounts || []).filter(function (a) { return a.type === 'asset' && !a.liquid && normalizeName(a.name) === n; })[0];
return named ? named.id : null;
}
function ensurePeopleAccounts(intent) {
(intent && intent.lines || []).forEach(function (l) {
if (l.enableCurrency && l.accountId) {
var liqAcc = getAccount(l.accountId);
if (liqAcc && liqAcc.liquid && !accountTakes(liqAcc, l.enableCurrency)) {
var existingCurs = liqAcc.multi ? (liqAcc.currencies || []).slice() : [liqAcc.currency || BASE];
if (existingCurs.indexOf(l.enableCurrency) < 0) existingCurs.push(l.enableCurrency);
setAccountCurrencies(liqAcc.id, existingCurs);
}
delete l.enableCurrency;
}
if (l.newAccount) {
var aid = assetAccountFor(l.newAccount.name);
if (!aid) {
var made = addAccount({ name: l.newAccount.name, type: l.newAccount.type, subtype: l.newAccount.subtype, currencies: [BASE] });
aid = made.ok ? made.account.id : null;
}
if (aid) { l.accountId = aid; delete l.newAccount; }
return;
}
if (!l.newPerson) return;
var id = resolvePersonAccount(l.newPerson.name, l.newPerson.type);
if (!id) {
var res = addAccount({ name: l.newPerson.name, type: l.newPerson.type, subtype: l.newPerson.subtype, currencies: [BASE] });
id = res.ok ? res.account.id : null;
}
if (id) { l.accountId = id; delete l.newPerson; }
});
return intent;
}
function transferPerson(body) {
var patterns = [[/(?:^|\s)(?:الي|الى)\s+([ء-ي]{2,20})/, 'to'], [/(?:^|\s)ل([ء-ي]{2,20})/, 'to'], [/(?:^|\s)من\s+([ء-ي]{2,20})/, 'from']];
for (var i = 0; i < patterns.length; i++) {
var m = body.match(patterns[i][0]);
if (!m) continue;
var word = m[1];
if (/كاش|بنك|صندوق|محفظ|مدخرات|حساب|راجحي|اهلي|سامبا|رياض|انماء|البلاد|دولار/.test(word)) continue;
if (STOP_PARTY.indexOf(word) >= 0 || STOP_PARTY.indexOf(normalizeName(word)) >= 0) continue;
return { word: word, dir: patterns[i][1] };
}
return null;
}
function parseMultiClauseIntent(norm, raw) {
if (!norm) return null;
var clauses = String(norm).split(/\s*(?:وبعدين|بعدين|ومن ثم|ثم|،|؛)\s*/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length >= 2; });
if (clauses.length < 2) return null;
var when = extractWhen(norm);
var currency = detectCurrency(norm);
var lines = [];
var totalMinor = 0;
var hasAmount = 0;
clauses.forEach(function (cl) {
var amt = extractAmount(cl);
if (!amt || !(amt.value > 0)) return;
hasAmount++;
var minor = Math.round(amt.value * 100);
totalMinor += minor;
var acc = detectAccount(cl) || 'expense';
if (acc === 'cash' || acc === 'bank' || acc === 'wallet' || acc === 'usd_box' || acc === 'sar_box') acc = 'expense';
lines.push({ accountId: acc, currency: currency, debitMinor: minor, creditMinor: 0, note: cl });
});
if (hasAmount < 2 || lines.length === 0) return null;
lines.push({ accountId: 'cash', currency: currency, debitMinor: 0, creditMinor: totalMinor });
return {
kind: 'compound',
isCompound: true,
amountMinor: totalMinor,
currency: currency,
memo: String(raw).trim(),
date: when.entryDate,
dueDate: when.dueDate,
lines: lines
};
}
function parseCompoundIntent(norm, raw) {
if (!norm) return null;
var when = extractWhen(norm);
var body = when.rest;
var currency = detectCurrency(body);
var splitMatch = norm.match(/(?:قسمت|تقسيم|توزيع)\s+(?:([ء-ي\s]{2,20})\s+)?(\d+(?:\.\d+)?|\d+\s*الف)\s*(?:ريال|دولار|د\.إ)?\s*بيني\s+وبين\s+([ء-ي\s]+)/);
if (splitMatch) {
var expName = splitMatch[1] || 'مصروفات عامة';
var amtObj = extractAmount(splitMatch[2]);
if (amtObj && amtObj.value > 0) {
var totalMinor = Math.round(amtObj.value * 100);
var peopleText = splitMatch[3];
var rawPeople = peopleText.split(/\s*(?:و|\+|\n)\s*/).map(function(p) { return p.replace(/^لـ?/, '').trim(); }).filter(function(p) { return p.length >= 2 && p !== 'بيني' && p !== 'وبين'; });
if (rawPeople.length >= 1) {
var totalCount = 1 + rawPeople.length;
var perShareMinor = Math.round(totalMinor / totalCount);
var remainderMinor = totalMinor - (perShareMinor * totalCount);
var expAccId = detectAccount(expName) || 'expense';
if (state && state.settings && state.settings.persona && PERSONAS[state.settings.persona]) {
var pAccs = PERSONAS[state.settings.persona].accounts || [];
for (var pa = 0; pa < pAccs.length; pa++) {
var kws = pAccs[pa].keywords || [];
for (var kw = 0; kw < kws.length; kw++) {
if (expName.indexOf(normalizeAr(kws[kw])) >= 0) { expAccId = pAccs[pa].code; break; }
}
}
}
var lines = [];
lines.push({ accountId: expAccId, currency: currency, debitMinor: perShareMinor + remainderMinor, creditMinor: 0 });
rawPeople.forEach(function(person) {
lines.push({ accountId: 'receivable', currency: currency, debitMinor: perShareMinor, creditMinor: 0, counterparty: person });
});
var payAcc = detectAccount(body) || 'cash';
lines.push({ accountId: payAcc, currency: currency, debitMinor: 0, creditMinor: totalMinor });
return {
kind: 'compound',
isCompound: true,
amountMinor: totalMinor,
currency: currency,
memo: String(raw).trim(),
date: when.entryDate,
dueDate: when.dueDate,
lines: lines
};
}
}
}
var collSplit = norm.match(/(?:قبضت|حصلت|استلمت|تحصيل)\s+(?:([ء-ي\s]{2,20})\s+)?(\d+(?:\.\d+)?|\d+\s*الف)\s*(?:ريال|دولار)?\s*منها\s+([ء-ي0-9\s]+)/);
if (collSplit) {
var totalAmt = extractAmount(collSplit[2]);
if (totalAmt && totalAmt.value > 0) {
var totalMinor = Math.round(totalAmt.value * 100);
var partsText = collSplit[3];
var parts = partsText.split(/(?:و|\n)/);
var lines = [];
var partySumMinor = 0;
parts.forEach(function(pt) {
var pm = pt.match(/(\d+(?:\.\d+)?|\d+\s*الف)\s*(?:من|منها|عن)?\s*([ء-ي]{2,20})/);
if (!pm) pm = pt.match(/(?:من|عن)?\s*([ء-ي]{2,20})\s*(\d+(?:\.\d+)?|\d+\s*الف)/);
if (pm) {
var valStr = /^\d/.test(pm[1]) ? pm[1] : pm[2];
var nameStr = /^\d/.test(pm[1]) ? pm[2] : pm[1];
var subAmt = extractAmount(valStr);
if (subAmt && subAmt.value > 0 && nameStr && STOP_PARTY.indexOf(nameStr) < 0) {
var subMinor = Math.round(subAmt.value * 100);
partySumMinor += subMinor;
lines.push(personLine(nameStr, 'asset', 'credit', subMinor, currency));
}
}
});
if (lines.length >= 2 && partySumMinor === totalMinor) {
var recAcc = detectAccount(body) || 'cash';
lines.unshift({ accountId: recAcc, currency: currency, debitMinor: totalMinor, creditMinor: 0 });
return {
kind: 'compound',
isCompound: true,
amountMinor: totalMinor,
currency: currency,
memo: String(raw).trim(),
date: when.entryDate,
dueDate: when.dueDate,
lines: lines
};
}
}
}
var repaySplit = norm.match(/(?:سددت|دفعت|وفيت)\s+(?:([ء-ي\s]{2,20})\s+)?(\d+(?:\.\d+)?|\d+\s*الف)\s*(?:ريال|دولار)?\s*منها\s+([ء-ي0-9\s]+)/);
if (repaySplit) {
var totalAmt = extractAmount(repaySplit[2]);
if (totalAmt && totalAmt.value > 0) {
var totalMinor = Math.round(totalAmt.value * 100);
var partsText = repaySplit[3];
var parts = partsText.split(/(?:و|\n)/);
var lines = [];
var partySumMinor = 0;
parts.forEach(function(pt) {
var pm = pt.match(/(\d+(?:\.\d+)?|\d+\s*الف)\s*(?:ل|لـ|للمورد)?\s*([ء-ي]{2,20})/);
if (!pm) pm = pt.match(/(?:ل|لـ|للمورد)?\s*([ء-ي]{2,20})\s*(\d+(?:\.\d+)?|\d+\s*الف)/);
if (pm) {
var valStr = /^\d/.test(pm[1]) ? pm[1] : pm[2];
var nameStr = /^\d/.test(pm[1]) ? pm[2] : pm[1];
nameStr = nameStr.replace(/^لـ?/, '');
var subAmt = extractAmount(valStr);
if (subAmt && subAmt.value > 0 && nameStr && STOP_PARTY.indexOf(nameStr) < 0) {
var subMinor = Math.round(subAmt.value * 100);
partySumMinor += subMinor;
lines.push(personLine(nameStr, 'liability', 'debit', subMinor, currency));
}
}
});
if (lines.length >= 2 && partySumMinor === totalMinor) {
var payAcc = detectAccount(body) || 'cash';
lines.push({ accountId: payAcc, currency: currency, debitMinor: 0, creditMinor: totalMinor });
return {
kind: 'compound',
isCompound: true,
amountMinor: totalMinor,
currency: currency,
memo: String(raw).trim(),
date: when.entryDate,
dueDate: when.dueDate,
lines: lines
};
}
}
}
var partPay = norm.match(/(?:شريت|شرينا|اشتريت|اشترينا|شراء)\s+([ء-ي]{2,20})\s+(?:ب|بـ|مقابل)?\s*(\d+(?:\.\d+)?(?:\s*الف|\s*الاف|\s*الفين|\s*مليون)?)\s*دفع(?:ت|نا)\s+(\d+(?:\.\d+)?(?:\s*الف|\s*الاف|\s*الفين|\s*مليون)?)\s*([ء-ي]+)?\s*والباقي\s+(?:(\d+(?:\.\d+)?(?:\s*الف|\s*الاف|\s*الفين|\s*مليون)?)\s*)?([ء-ي\s]+)/);
if (partPay) {
var assetName = partPay[1];
var totAmt = extractAmount(partPay[2]);
var paidAmt = extractAmount(partPay[3]);
var remAmt = partPay[5] ? extractAmount(partPay[5]) : (totAmt && paidAmt && totAmt.value > paidAmt.value ? { value: totAmt.value - paidAmt.value } : null);
if (totAmt && paidAmt && remAmt && remAmt.value > 0 && Math.round((paidAmt.value + remAmt.value) * 100) === Math.round(totAmt.value * 100)) {
var totMinor = Math.round(totAmt.value * 100);
var paidMinor = Math.round(paidAmt.value * 100);
var remMinor = Math.round(remAmt.value * 100);
var assetAcc = assetAccountFor(assetName);
var assetLine = { accountId: assetAcc || 'expense', currency: currency, debitMinor: totMinor, creditMinor: 0 };
var writtenName = String(raw).split(/\s+/).filter(function (w) { return normalizeAr(w) === assetName; })[0] || assetName;
if (!assetAcc) assetLine.newAccount = { name: writtenName, type: 'asset', subtype: PROPERTY_WORDS.test(assetName) ? 'الأراضي والمباني' : 'الأصول الثابتة' };
var payAcc = detectAccount(partPay[4] || 'كاش') || 'cash';
var debtTarget = partPay[6] || 'تمويل';
var counterpartyStr = extractParty(debtTarget) || debtTarget.trim();
var lines = [
assetLine,
{ accountId: payAcc, currency: currency, debitMinor: 0, creditMinor: paidMinor },
{ accountId: 'payable', currency: currency, debitMinor: 0, creditMinor: remMinor, counterparty: counterpartyStr }
];
return {
kind: 'compound',
isCompound: true,
amountMinor: totMinor,
currency: currency,
memo: String(raw).trim(),
date: when.entryDate,
dueDate: when.dueDate,
lines: lines
};
}
}
var partColl = norm.match(/(?:قبضت|حصلت|استلمت|تحصيل)\s+(\d+(?:\.\d+)?|\d+\s*الف)\s+([ء-ي\s]{2,20})\s+(\d+(?:\.\d+)?|\d+\s*الف)\s*([ء-ي]+)?\s*والباقي\s+(?:(\d+(?:\.\d+)?|\d+\s*الف)\s*)?(?:على|علي|آجل|اجل|من|لـ)?\s*([ء-ي\s]+)?/);
if (partColl) {
var totAmt = extractAmount(partColl[1]);
var revName = partColl[2];
var recAmt = extractAmount(partColl[3]);
var remAmt = partColl[5] ? extractAmount(partColl[5]) : (totAmt && recAmt && totAmt.value > recAmt.value ? { value: totAmt.value - recAmt.value } : null);
var partyStr = partColl[6] ? partColl[6].trim() : 'مستأجر';
if (totAmt && recAmt && remAmt && remAmt.value > 0 && Math.round((recAmt.value + remAmt.value) * 100) === Math.round(totAmt.value * 100)) {
var totMinor = Math.round(totAmt.value * 100);
var recMinor = Math.round(recAmt.value * 100);
var remMinor = Math.round(remAmt.value * 100);
var revAcc = detectAccount(revName) || (getAccount('acc_rental_rev') ? 'acc_rental_rev' : 'revenue');
var cashAcc = detectAccount(partColl[4] || 'كاش') || 'cash';
var lines = [
{ accountId: cashAcc, currency: currency, debitMinor: recMinor, creditMinor: 0 },
{ accountId: 'receivable', currency: currency, debitMinor: remMinor, creditMinor: 0, counterparty: partyStr },
{ accountId: revAcc, currency: currency, debitMinor: 0, creditMinor: totMinor }
];
return {
kind: 'compound',
isCompound: true,
amountMinor: totMinor,
currency: currency,
memo: String(raw).trim(),
date: when.entryDate,
dueDate: when.dueDate,
lines: lines
};
}
}
if (/^(?:رصيد\s+(?:افتتاحي|سابق|بداية|مستحق)|حساب\s+قديم|مديوني[ةه]\s+سابق[ةه]|عندي)(?:\s|$)/.test(body)) {
var openRest = body.replace(/^(?:رصيد\s+(?:افتتاحي|سابق|بداية|مستحق)|حساب\s+قديم|مديوني[ةه]\s+سابق[ةه]|عندي)\s*/, '');
var rawOpenRest = extractWhen(String(raw || '')).rest.replace(/^\s*(?:رصيد\s+(?:افتتاحي|سابق|بداية|مستحق)|حساب\s+قديم|مديوني[ةه]\s+سابق[ةه]|عندي)\s*/, '');
var openSplitRe = /(?:\s+و\s+|\s+و(?=[ء-ي0-9])|\s*[+،,\n]\s*)/;
var openParts = openRest.split(openSplitRe).filter(function (s) { return s && s.trim().length > 0; });
var rawOpenParts = rawOpenRest.split(openSplitRe).filter(function (s) { return s && s.trim().length > 0; });
if (openParts.length >= 2) {
var openLines = [];
var debitBaseSum = 0;
var creditBaseSum = 0;
var validParts = 0;
var lastLiquidAccId = null;
openParts.forEach(function (pt, idx) {
var rawPt = rawOpenParts[idx] || pt;
var subAmt = extractAmount(pt);
if (!subAmt || !(subAmt.value > 0)) return;
validParts++;
var subMinor = Math.round(subAmt.value * 100);
var ptCur = detectCurrencyCore(pt) || currency || BASE;
var ptRate = ptCur === BASE ? 1 : (extractRate(pt, subAmt.value, ptCur) || getRate(ptCur));
var subBase = ptCur === BASE ? subMinor : Math.round(subMinor * ptRate);
var isLiab = /(علينا|لصالح|مستحق\s+ل|للمورد|فيزا|بطاق)/.test(pt);
var partyRe = /(?:^|\s)(?:عند\s+(?:ال)?(?:عميل|مورد)?\s*|لصالح\s+(?:ال)?(?:مورد|عميل)?\s*|للمورد\s+|للعميل\s+|علينا\s+ل(?:لمورد\s+)?|لـ\s+|ل\s+)([ء-ي][ء-ي\s]{1,25})/;
var pm = rawPt.match(partyRe) || pt.match(partyRe);
var party = pm ? pm[1].trim().replace(/\s+(?:بقيمة|مبلغ|ريال|دولار|درهم|يورو|\d|@).*/, '').trim() : '';
if (party && (STOP_PARTY.indexOf(party) >= 0 || STOP_PARTY.indexOf(normalizeName(party)) >= 0 || ACCOUNT_WORDS[party])) party = '';
var explicitAccId = writtenMoneyAccount(pt) || detectAccount(pt);
if (explicitAccId && getAccount(explicitAccId) && getAccount(explicitAccId).liquid) {
lastLiquidAccId = explicitAccId;
}
if (isLiab) {
openLines.push({
accountId: party ? 'payable' : (explicitAccId || 'payable'),
currency: ptCur,
rate: ptRate,
debitMinor: 0,
creditMinor: subMinor,
debitBase: 0,
creditBase: subBase,
counterparty: party || '',
createDue: party ? 'payable' : null
});
creditBaseSum += subBase;
} else if (party || /(?:عند|للعميل|عميل)/.test(pt)) {
openLines.push({
accountId: 'receivable',
currency: ptCur,
rate: ptRate,
debitMinor: subMinor,
creditMinor: 0,
debitBase: subBase,
creditBase: 0,
counterparty: party || '',
createDue: party ? 'receivable' : null
});
debitBaseSum += subBase;
} else {
var targetAccId = explicitAccId || lastLiquidAccId || (ptCur === 'USD' ? 'usd_box' : 'cash');
openLines.push({
accountId: targetAccId,
currency: ptCur,
rate: ptRate,
debitMinor: subMinor,
creditMinor: 0,
debitBase: subBase,
creditBase: 0,
enableCurrency: ptCur !== BASE ? ptCur : null
});
debitBaseSum += subBase;
}
});
if (validParts >= 2 && validParts === openParts.length && (debitBaseSum > 0 || creditBaseSum > 0)) {
var netCapBase = debitBaseSum - creditBaseSum;
if (netCapBase > 0) openLines.push({ accountId: 'capital', currency: BASE, rate: 1, debitMinor: 0, creditMinor: netCapBase, debitBase: 0, creditBase: netCapBase });
else if (netCapBase < 0) openLines.push({ accountId: 'capital', currency: BASE, rate: 1, debitMinor: -netCapBase, creditMinor: 0, debitBase: -netCapBase, creditBase: 0 });
var totOpenBase = Math.max(debitBaseSum, creditBaseSum);
return {
kind: 'capital',
isCompound: true,
amountMinor: totOpenBase,
currency: BASE,
memo: String(raw).trim(),
date: when.entryDate,
dueDate: when.dueDate,
lines: openLines
};
}
}
}
var trSettle = body.match(/(?:حولت|نقلت|سحبت)\s+(\d+(?:\.\d+)?|\d+\s*الف)\s*(?:ريال|دولار)?\s*([^،]+?)\s+و\s*(?:سددت|دفعت|وفيت)(?:\s+منها)?\s+(\d+(?:\.\d+)?|\d+\s*الف)\s*(?:ريال|دولار)?\s*(?:ل|لـ|للمورد|الى|إلى)?\s*([ء-ي]{2,20})/);
if (trSettle) {
var trTot = extractAmount(trSettle[1]);
var trSub = extractAmount(trSettle[3]);
var trParty = trSettle[4] ? trSettle[4].replace(/^لـ?/, '').trim() : '';
if (trTot && trSub && trTot.value > 0 && trSub.value > 0 && trSub.value <= trTot.value && trParty && STOP_PARTY.indexOf(trParty) < 0) {
var trTotMinor = Math.round(trTot.value * 100);
var trSubMinor = Math.round(trSub.value * 100);
var trRemMinor = trTotMinor - trSubMinor;
var trNamed = namedTransferAccounts(trSettle[2]);
var fromAcc = (trNamed && trNamed.from) || 'bank';
var toAcc = (trNamed && trNamed.to) || (fromAcc === 'bank' ? 'cash' : 'bank');
var trLines = [];
if (trRemMinor > 0) trLines.push({ accountId: toAcc, currency: currency, debitMinor: trRemMinor, creditMinor: 0 });
trLines.push(personLine(trParty, 'liability', 'debit', trSubMinor, currency));
trLines.push({ accountId: fromAcc, currency: currency, debitMinor: 0, creditMinor: trTotMinor });
return {
kind: 'compound',
isCompound: true,
amountMinor: trTotMinor,
currency: currency,
memo: String(raw).trim(),
date: when.entryDate,
dueDate: when.dueDate,
lines: trLines
};
}
}
function cleanPaidParty(seg) {
var s = String(seg || '').trim();
s = s.replace(/^(?:ريال\s+سعودي|ريال\s+يمني|ريال|ر\.س|ر\.ي|دولار|درهم|يورو|كاش|نقداً|نقدا|نقد|من\s+الصندوق|من\s+البنك|من\s+المحفظ[ةه])+\s*/i, '').trim();
s = s.replace(/\s+(?:كاش|نقداً|نقدا|نقد|من\s+الصندوق|من\s+البنك|من\s+المحفظ[ةه]|و)\s*$/i, '').trim();
if (/^(?:إلى|الى|الي|للمورد|للعميل|لصالح|عند|من|لـ)\s+/.test(s)) {
s = s.replace(/^(?:إلى|الى|الي|للمورد|للعميل|لصالح|عند|من|لـ)\s+/, '').trim();
} else if (/^لل([ء-ي]{2,})/.test(s)) {
s = s.replace(/^لل([ء-ي]{2,})/, 'ال$1').trim();
} else if (/^ل([ء-ي]{2,})/.test(s)) {
s = s.replace(/^ل([ء-ي]{2,})/, '$1').trim();
}
return s;
}
function detectExpenseContra(segNorm) {
var found = null;
if (state && state.settings && state.settings.persona && PERSONAS[state.settings.persona]) {
var pAccs = PERSONAS[state.settings.persona].accounts || [];
for (var pi = 0; pi < pAccs.length && !found; pi++) {
var pA = pAccs[pi];
if (pA.type !== 'expense' || !getAccount(pA.code)) continue;
var kws = pA.keywords || [];
for (var ki = 0; ki < kws.length; ki++) {
var nkw = normalizeAr(kws[ki]).trim();
if (nkw && segNorm.indexOf(nkw) >= 0) { found = pA.code; break; }
}
}
}
return found || 'expense';
}
var compToday = todayISO();
var compDueDate = when.dueDate || (when.entryDate > compToday ? when.entryDate : null);
var compEntryDate = when.entryDate > compToday ? compToday : when.entryDate;
var rawCleanWhen = extractWhen(String(raw || '')).rest;
var overPayMatch = rawCleanWhen.match(/(?:دفعت|دفعنا|صرفت|صرفنا|سددت|سددنا|أعطيت|اعطيت|عطيت)\s+(\d[\d,.]*(?:\s*(?:ألف|الف|آلاف|الاف|ألفين|الفين|مليون))?)\s+(.+?)\s+(?:و\s*)?(?:ال)?باقي\s+(?:لي|لنا)(?:\s+(?:عليهم|عليه|عليها|عندهم|عنده|عندها|لديهم|لديه))?(?:\s+(\d[\d,.]*(?:\s*(?:ألف|الف|آلاف|الاف|ألفين|الفين|مليون))?))?(?=\s|$|[.،,])/i);
if (overPayMatch) {
var opPaidAmt = extractAmount(overPayMatch[1]);
var opMidRaw = overPayMatch[2];
var opRemAmt = overPayMatch[3] ? extractAmount(overPayMatch[3]) : null;
if (!opRemAmt && opPaidAmt) {
var midBillMatch = opMidRaw.match(/(?:حسابهم|حسابه|حساب|المصروف|الفاتور[ةه]|بقيم[ةه]|بمبلغ|بـ|ب)\s*(\d[\d,.]*(?:\s*(?:ألف|الف|آلاف|الاف|ألفين|الفين|مليون))?)/i);
if (midBillMatch) {
var billAmt = extractAmount(midBillMatch[1]);
if (billAmt && opPaidAmt.value > billAmt.value && billAmt.value > 0) {
opRemAmt = { value: opPaidAmt.value - billAmt.value };
opMidRaw = opMidRaw.replace(midBillMatch[0], ' ').trim();
}
}
}
var opMidNorm = normalizeAr(opMidRaw);
if (opPaidAmt && opRemAmt && opPaidAmt.value > opRemAmt.value && opRemAmt.value > 0) {
var opPaidMinor = Math.round(opPaidAmt.value * 100);
var opRemMinor = Math.round(opRemAmt.value * 100);
var opExpMinor = opPaidMinor - opRemMinor;
var opParty = cleanPaidParty(opMidRaw) || extractParty(opMidNorm) || 'غير محدد';
var opPayAcc = writtenMoneyAccount(opMidNorm) || detectAccount(opMidNorm) || 'cash';
var opExpAcc = detectExpenseContra(opMidNorm);
var opAm = adaptiveLookup(opMidNorm);
var opKw = opAm ? (opAm.key || null) : null;
return {
kind: 'compound',
isCompound: true,
amountMinor: opPaidMinor,
currency: currency,
counterparty: opParty,
memo: String(raw).trim(),
date: compEntryDate,
dueDate: compDueDate,
matchedKeyword: opKw,
lines: [
{ accountId: opExpAcc, currency: currency, debitMinor: opExpMinor, creditMinor: 0, counterparty: opParty },
{ accountId: 'receivable', currency: currency, debitMinor: opRemMinor, creditMinor: 0, counterparty: opParty, createDue: 'receivable' },
{ accountId: opPayAcc, currency: currency, debitMinor: 0, creditMinor: opPaidMinor }
]
};
}
}
var underPayMatch = rawCleanWhen.match(/(?:دفعت|دفعنا|صرفت|صرفنا|سددت|سددنا|أعطيت|اعطيت|عطيت)\s+(\d[\d,.]*(?:\s*(?:ألف|الف|آلاف|الاف|ألفين|الفين|مليون))?)\s+(.+?)\s+(?:و\s*)?(?:ال)?باقي\s+(?:(?:لهم|له|لها)(?:\s+(?:عليّ|علي|عليا|علينا))?|(?:عليّ|علي|عليا|علينا)(?:\s+(?:لهم|له|لها))?)(?:\s+(\d[\d,.]*(?:\s*(?:ألف|الف|آلاف|الاف|ألفين|الفين|مليون))?))?(?=\s|$|[.،,])/i);
if (underPayMatch) {
var upPaidAmt = extractAmount(underPayMatch[1]);
var upMidRaw = underPayMatch[2];
var upRemAmt = underPayMatch[3] ? extractAmount(underPayMatch[3]) : null;
if (!upRemAmt && upPaidAmt) {
var upBillMatch = upMidRaw.match(/(?:حسابهم|حسابه|حساب|المصروف|الفاتور[ةه]|إجمالي|اجمالي|بقيم[ةه]|بمبلغ|بـ|ب)\s*(\d[\d,.]*(?:\s*(?:ألف|الف|آلاف|الاف|ألفين|الفين|مليون))?)/i);
if (upBillMatch) {
var upBillAmt = extractAmount(upBillMatch[1]);
if (upBillAmt && upBillAmt.value > upPaidAmt.value && upPaidAmt.value > 0) {
upRemAmt = { value: upBillAmt.value - upPaidAmt.value };
upMidRaw = upMidRaw.replace(upBillMatch[0], ' ').trim();
}
}
}
var upMidNorm = normalizeAr(upMidRaw);
if (upPaidAmt && upRemAmt && upPaidAmt.value > 0 && upRemAmt.value > 0) {
var upPaidMinor = Math.round(upPaidAmt.value * 100);
var upRemMinor = Math.round(upRemAmt.value * 100);
var upTotMinor = upPaidMinor + upRemMinor;
var upParty = cleanPaidParty(upMidRaw) || extractParty(upMidNorm) || 'غير محدد';
var upPayAcc = writtenMoneyAccount(upMidNorm) || detectAccount(upMidNorm) || 'cash';
var upExpAcc = detectExpenseContra(upMidNorm);
var upAm = adaptiveLookup(upMidNorm);
var upKw = upAm ? (upAm.key || null) : null;
return {
kind: 'compound',
isCompound: true,
amountMinor: upTotMinor,
currency: currency,
counterparty: upParty,
memo: String(raw).trim(),
date: compEntryDate,
dueDate: compDueDate,
matchedKeyword: upKw,
lines: [
{ accountId: upExpAcc, currency: currency, debitMinor: upTotMinor, creditMinor: 0, counterparty: upParty },
{ accountId: upPayAcc, currency: currency, debitMinor: 0, creditMinor: upPaidMinor },
{ accountId: 'payable', currency: currency, debitMinor: 0, creditMinor: upRemMinor, counterparty: upParty, createDue: 'payable' }
]
};
}
}
return null;
}
var EXCH_CUR = '(?:دولار(?:ات)?|\\$|usd|درهم|دراهم|aed|يورو|€|eur|ريال\\s+يمني|ريال\\s+سعودي|ريال|يمني|سعودي|yer|sar)';
function exchangeCurrencyOf(word) {
var w = normalizeAr(word);
if (/يمني|yer/.test(w)) return 'YER';
return detectCurrency(w);
}
function parseExchangeIntent(norm, raw) {
var verb = norm.match(/(?:^|\s)(صرفت|صرفنا|بدلت|غيرت|حولت|بعت|بعنا|اشتريت|اشترينا|شريت|شرينا)(?=\s)/);
if (!verb) return null;
var buying = /^(?:اشتريت|اشترينا|شريت|شرينا)$/.test(verb[1]);
var first = new RegExp('(\\d[\\d,]*(?:\\.\\d+)?)\\s*(' + EXCH_CUR + ')(?![ء-ي])', 'i').exec(norm);
if (!first) return null;
var after = norm.slice(first.index + first[0].length);
var second = new RegExp('^\\s*(?:الي|الى|مقابل|بال|ب)\\s*(?:(\\d[\\d,]*(?:\\.\\d+)?)\\s*)?(?:ال)?(' + EXCH_CUR + ')(?![ء-ي])', 'i').exec(after);
if (!second) return null;
var A = exchangeCurrencyOf(first[2]), B = exchangeCurrencyOf(second[2]);
if (!A || !B || A === B) return null;
var n1 = Math.round(Number(String(first[1]).replace(/,/g, '')) * 100);
var n2 = second[1] ? Math.round(Number(String(second[1]).replace(/,/g, '')) * 100) : 0;
if (!(n1 > 0)) return null;
var rest = after.slice(second[0].length);
var rate = n2 ? 0 : (extractRate(rest) || 0);
var sellCur = buying ? B : A, buyCur = buying ? A : B;
var sellMinor = buying ? n2 : n1, buyMinor = buying ? n1 : n2;
var when = extractWhen(norm);
var fromAt = norm.search(/(?:^|\s)من\s/);
var fromId = null;
if (fromAt >= 0) {
var named = moneyPlacesIn(norm.slice(fromAt)).filter(function (id) { var a = getAccount(id); return a && a.liquid; });
if (named.length) fromId = named[0];
}
var liquid = (state && state.accounts || []).filter(function (a) { return a.liquid; });
var lacks = [], lacksCode = null;
if (!fromId) {
var holders = liquid.filter(function (a) { return accountTakes(a, sellCur); });
holders.sort(function (a, b) { return avgCostOf(b.id, sellCur).native - avgCostOf(a.id, sellCur).native; });
fromId = holders.length ? holders[0].id : null;
}
if (!fromId) { fromId = getAccount('cash') ? 'cash' : (liquid[0] && liquid[0].id); lacks = [fromId]; lacksCode = sellCur; }
var from = getAccount(fromId);
var toId = null;
if (from && accountTakes(from, buyCur)) toId = fromId;
else {
var takers = liquid.filter(function (a) { return accountTakes(a, buyCur); });
var cashFirst = takers.filter(function (a) { return a.id === 'cash'; })[0] || takers[0];
if (cashFirst) toId = cashFirst.id;
else if (!lacks.length) { toId = getAccount('cash') ? 'cash' : fromId; lacks = [toId]; lacksCode = buyCur; }
else toId = fromId;
}
var exSettle = rest.match(/و\s*(?:سددت|دفعت|وفيت)(?:\s+منها)?\s+(\d[\d,]*(?:\.\d+)?|\d+\s*الف)\s*(?:ريال|دولار)?\s*(?:ل|لـ|للمورد|الى|إلى)?\s*([ء-ي]{2,20})/);
if (exSettle && !lacks.length) {
var stAmt = extractAmount(exSettle[1]);
var stParty = exSettle[2] ? exSettle[2].replace(/^لـ?/, '').trim() : '';
if (stAmt && stAmt.value > 0 && stParty && STOP_PARTY.indexOf(stParty) < 0) {
var qEx = exchangeQuote({ fromAccountId: fromId, sellCurrency: sellCur, sellMinor: sellMinor, buyCurrency: buyCur, buyMinor: buyMinor, rate: rate || null });
var stMinor = Math.round(stAmt.value * 100);
if (qEx.buyMinor > 0 && stMinor <= qEx.buyMinor) {
var rateBuy = getRate(buyCur);
var stBase = Math.round(stMinor * rateBuy);
var remBuy = qEx.buyMinor - stMinor;
var remBase = qEx.proceedsBase - stBase;
var exLines = [];
if (remBuy > 0 && remBase > 0) {
exLines.push({ accountId: toId, currency: buyCur, rate: remBase / remBuy, debitMinor: remBuy, creditMinor: 0, debitBase: remBase, creditBase: 0 });
}
var pL = personLine(stParty, 'liability', 'debit', stMinor, buyCur);
pL.debitBase = stBase;
pL.creditBase = 0;
pL.rate = rateBuy;
exLines.push(pL);
exLines.push({ accountId: fromId, currency: sellCur, rate: qEx.carryingBase / qEx.sellMinor, debitMinor: 0, creditMinor: qEx.sellMinor, debitBase: 0, creditBase: qEx.carryingBase });
if (qEx.gainBase > 0) exLines.push({ accountId: 'fx_gain', currency: BASE, rate: 1, debitMinor: 0, creditMinor: qEx.gainBase, debitBase: 0, creditBase: qEx.gainBase });
else if (qEx.gainBase < 0) exLines.push({ accountId: 'fx_loss', currency: BASE, rate: 1, debitMinor: -qEx.gainBase, creditMinor: 0, debitBase: -qEx.gainBase, creditBase: 0 });
return {
kind: 'compound',
isCompound: true,
amountMinor: qEx.sellMinor,
currency: sellCur,
memo: String(raw).trim(),
date: when.entryDate,
dueDate: when.dueDate,
lines: exLines
};
}
}
}
return {
kind: 'exchange',
currency: lacksCode || sellCur,
amountMinor: sellMinor,
lacksCurrency: lacks,
exchange: { fromAccountId: fromId, toAccountId: toId, sellCurrency: sellCur, sellMinor: sellMinor,
buyCurrency: buyCur, buyMinor: buyMinor, rate: rate || null, date: when.entryDate, memo: String(raw).trim() },
date: when.entryDate,
memo: String(raw).trim(),
counterparty: ''
};
}
function detectMixedKinds(norm, raw) {
if (!norm) return null;
var pairs = [];
var re = /(\d+(?:\.\d+)?|\d+\s*الف)\s*([ء-ي]{2,20})/g;
var m;
while ((m = re.exec(norm)) !== null) {
var amtObj = extractAmount(m[1]);
if (amtObj && amtObj.value > 0) {
pairs.push({ amount: amtObj.value, keyword: m[2].trim() });
}
}
if (pairs.length < 2) return null;
var hasWa = /و/.test(norm);
if (!hasWa) return null;
var kinds = [];
var allDetermined = true;
pairs.forEach(function (p) {
var am = adaptiveLookup(p.keyword);
var k = null;
if (am && am.intent && am.intent !== 'UNKNOWN') {
var mapped = String(am.intent).toLowerCase();
k = kindFromAction(mapped) || mapped;
}
if (!k) {
k = detectKind(p.keyword);
}
if (!k) allDetermined = false;
kinds.push(k);
});
if (!allDetermined) return null;
var hasIncome = kinds.some(function (k) { return k === 'income' || k === 'collect'; });
var hasExpense = kinds.some(function (k) { return k === 'expense' || k === 'repay' || k === 'borrow'; });
if (hasIncome && hasExpense) {
return { kind: 'mixedKinds', memo: raw, pairs: pairs };
}
return null;
}
function parseIntentCore(raw) {
var phoneInfo = takePhones(String(raw == null ? '' : raw));
var phoneAcc = (phoneInfo.phones.filter(function (p) { return p.account; })[0]) || null;
var partyRaw = phoneInfo.text;
var norm = normalizeAr(phoneInfo.text);
if (!norm) return { kind: 'help' };
if (/(الغاء|احذف|حذف|تراجع)/.test(norm) && /(قيد|عمليه|اخير|الاخير|حركه|تراجع)/.test(norm)) {
return { kind: 'undo' };
}
var exchangeIntentFound = parseExchangeIntent(norm, raw);
if (exchangeIntentFound) return exchangeIntentFound;
var mixedCheck = detectMixedKinds(norm, raw);
if (mixedCheck) return mixedCheck;
var multiClauseIntent = parseMultiClauseIntent(norm, raw);
if (multiClauseIntent) return multiClauseIntent;
var compoundIntent = parseCompoundIntent(norm, raw);
if (compoundIntent) return compoundIntent;
var when = extractWhen(norm);
var body = when.rest;
var currency = detectCurrency(body);
var amountInfo = extractAmount(body);
var rate = extractRate(body, amountInfo && amountInfo.value, currency);
var receiveCurrency = extractReceiveCurrency(body);
var kind = detectKind(body);
var wordKind = kind;
var normSk = sentenceKeyword(norm);
var bodySk = sentenceKeyword(body);
var am = (adaptiveMemory[normSk] && isTaught(adaptiveMemory[normSk])) ? adaptiveMemory[normSk] : adaptiveLookup(body);
var matchedKeyword = am ? (am.key || null) : null;
var amKeyNorm = am && am.key ? sentenceKeyword(am.key) : '';
var isExactTrained = !!(am && am.source === 'trained' && (amKeyNorm === bodySk || amKeyNorm === normSk));
var isExactVocabPhrase = !!(am && am.source === 'vocab' && (amKeyNorm === bodySk || amKeyNorm === normSk));
if (am && am.intent && am.intent !== 'UNKNOWN' && ((am.source !== 'vocab' && (am.source !== 'trained' || isExactTrained)) || isExactVocabPhrase || !kind || kind === 'help')) {
var mapped = String(am.intent).toLowerCase();
if (isTaught(am)) kind = mapped;
else if (kindFromAction(mapped)) kind = kindFromAction(mapped);
}
if (!amountInfo) {
if (kind === 'query' || /[?؟]/.test(norm)) return { kind: 'query' };
if (kind === 'help' || !kind || (!wordKind && am && am.source === 'vocab')) return { kind: 'help' };
return { kind: 'needAmount', intended: kind, memo: raw };
}
if (kind === 'query') return { kind: 'query' };
var unsupportedCurrency = detectUnsupportedCurrency(body) || (isCurrencyRemoved(currency) ? currency : null);
if (unsupportedCurrency) return { kind: 'unsupportedCurrency', currencyWord: unsupportedCurrency, memo: raw };
if (!kind || kind === 'help') return { kind: 'needKind', memo: raw, amountMinor: Math.round(amountInfo.value * 100), currency: currency };
var places = [];
if (kind === 'capital' || kind === 'opening' || kind === 'income' || kind === 'expense') {
var seg = body;
if (kind === 'expense') {
var fromAt = body.search(/(?:^|\s)من\s/);
var amountAt = amountInfo.raw ? body.indexOf(String(amountInfo.raw)) : -1;
seg = fromAt >= 0 ? body.slice(fromAt) : amountAt >= 0 ? body.slice(amountAt + String(amountInfo.raw).length) : '';
}
places = moneyPlacesIn(seg);
if (kind === 'expense') {
var hasFinancing = FINANCING_WORDS.test(seg) || /وال?باقي[\s\S]*اجل/.test(seg);
if (hasFinancing && places.indexOf('payable') < 0) places.push('payable');
}
}
var named = kind === 'transfer' ? namedTransferAccounts(body) : null;
var personName = null;
if (kind === 'transfer' && !named.from && !named.to) {
var person = transferPerson(body);
if (person) {
var people = personAccountsFor(body, person.word);
if (people.length > 1) return { kind: 'personTransfer', person: person.word, candidates: people, amountMinor: Math.round(amountInfo.value * 100), currency: currency, memo: raw };
personName = people.length === 1 ? people[0] : person.word;
kind = person.dir === 'from' ? 'borrow' : 'lend';
} else if (phoneAcc && phoneAcc.account) {
personName = phoneAcc.account.name;
kind = phoneAcc.dir === 'from' ? 'borrow' : 'lend';
}
}
var openingDirection = null;
var openingParty = null;
var isOpening = (kind === 'capital') && /(رصيد\s+(افتتاحي|سابق|بداية|مستحق)|حساب\s+قديم|مديوني[ةه]\s+سابق[ةه])/.test(body);
if (isOpening) {
if (/(علينا|لصالح|مستحق\s+ل|للمورد|فيزا|بطاق)/.test(body)) openingDirection = 'liability';
else openingDirection = 'asset';
var openPartyRe = /(?:^|\s)(?:عند\s+(?:ال)?(?:عميل|مورد)?\s*|لصالح\s+(?:ال)?(?:مورد|عميل)?\s*|للمورد\s+|للعميل\s+|علينا\s+ل(?:لمورد\s+)?|على\s+(?:ال)?(?:عميل\s+)?|لـ\s+|ل\s+)([ء-ي][ء-ي\s]{1,30})/;
var pm = String(partyRaw || '').match(openPartyRe) || body.match(openPartyRe);
if (pm) openingParty = pm[1].trim().replace(/\s+(?:بقيمة|مبلغ|ريال|دولار|درهم|يورو|\d|@).*/, '').trim();
if (openingParty && (STOP_PARTY.indexOf(openingParty) >= 0 || STOP_PARTY.indexOf(normalizeName(openingParty)) >= 0 || ACCOUNT_WORDS[openingParty])) openingParty = null;
}
var accountId = detectAccount(body);
var isOpeningDebt = isOpening && (openingParty || openingDirection === 'liability');
if (isOpening && openingDirection === 'asset' && openingParty) { accountId = 'receivable'; }
if (isOpening && openingDirection === 'liability') { accountId = 'capital'; }
if (!accountId) accountId = currency === 'USD' ? 'usd_box' : 'cash';
if (!isOpeningDebt && currency === 'USD' && !/بنك|حساب/.test(body)) accountId = 'usd_box';
var writtenMoney = kind === 'transfer' ? null : writtenMoneyAccount(body);
if (writtenMoney) accountId = writtenMoney;
var lacksCurrency = [];
if (kind !== 'transfer' && currency && currency !== BASE) {
var namedPlaces = moneyPlacesIn(body);
var place = namedPlaces.length === 1 ? namedPlaces[0] : null;
if (place && accountTakes(getAccount(place), currency)) accountId = place;
else if (place) lacksCurrency = [place];
}
if (kind === 'expense' && places.length === 1 && places[0] === 'payable') accountId = 'payable';
var contraAccountId = null;
var partyCandidate = extractPartyRaw(partyRaw) || extractParty(body);
if (isOpening && openingParty) partyCandidate = openingParty;
if (phoneAcc && phoneAcc.account) {
if (!personName) personName = phoneAcc.account.name;
if (kind !== 'transfer') partyCandidate = phoneAcc.account.name;
}
if (partyCandidate) {
for (var ai = 0; ai < state.accounts.length; ai++) {
if (normalizeName(state.accounts[ai].name) === normalizeName(partyCandidate)) { contraAccountId = state.accounts[ai].id; break; }
}
}
if (isOpening && openingDirection === 'liability') { contraAccountId = 'payable'; }
if (!contraAccountId) {
for (var ai = 0; ai < state.accounts.length; ai++) {
var accName = state.accounts[ai].name;
if (accName && accName.length >= 2 && body.indexOf(normalizeName(accName)) >= 0) {
if (state.accounts[ai].id !== accountId) { contraAccountId = state.accounts[ai].id; break; }
}
}
}
if (!contraAccountId && state && state.settings && state.settings.persona && PERSONAS[state.settings.persona]) {
var pAccounts = PERSONAS[state.settings.persona].accounts || [];
for (var pi = 0; pi < pAccounts.length && !contraAccountId; pi++) {
var pAcc = pAccounts[pi];
if (!getAccount(pAcc.code)) continue;
var kws = pAcc.keywords || [];
for (var ki = 0; ki < kws.length; ki++) {
var nkw = normalizeAr(kws[ki]).trim();
if (nkw && body.indexOf(nkw) >= 0) {
contraAccountId = pAcc.code;
break;
}
}
}
}
if (!contraAccountId && am && am.account && (kind === 'expense' || kind === 'income')) {
var wantType = kind === 'expense' ? 'expense' : 'revenue';
var normHint = normalizeName(am.account);
for (var hi = 0; hi < state.accounts.length; hi++) {
var hAcc = state.accounts[hi];
if (hAcc.type === wantType && hAcc.id !== 'expense' && hAcc.id !== 'revenue' && (hAcc.id === am.account || normalizeName(hAcc.name) === normHint)) {
contraAccountId = hAcc.id;
break;
}
}
}
if (!contraAccountId && (kind === 'expense' || kind === 'income') && vectorMemoryEnabled() && _vectorMemory.length && aiGovernorStatus().mode !== 'ultra-eco') {
var vHits = vectorSearch(raw, 1);
if (vHits.length && vHits[0].score >= 0.85 && vHits[0].accountId && getAccount(vHits[0].accountId)) {
contraAccountId = vHits[0].accountId;
}
}
if (places.length >= 2) {
return { kind: 'needSplit', intended: kind, accounts: places, amountMinor: Math.round(amountInfo.value * 100), currency: currency, memo: raw,
contraAccountId: contraAccountId,
lacksCurrency: currency && currency !== BASE ? places.filter(function (id) { return !accountTakes(getAccount(id), currency); }) : [],
dueDate: when.dueDate,
counterparty: partyCandidate || '' };
}
var transfer = null;
if (kind === 'transfer') transfer = detectTransfer(body, named);
var entryDate = when.entryDate;
var dueDate = when.dueDate;
var isDebt = kind === 'lend' || kind === 'borrow';
if (isDebt) {
if (!dueDate && when.explicit) dueDate = when.entryDate;
entryDate = when.dueDate && !when.explicit ? todayISO() : (when.explicit ? todayISO() : entryDate);
} else {
dueDate = null;
}
return {
kind: kind,
amountMinor: Math.round(amountInfo.value * 100),
currency: currency,
rate: rate,
receiveCurrency: receiveCurrency,
accountId: accountId,
contraAccountId: contraAccountId,
toAccountId: transfer ? transfer.to : null,
fromAccountId: transfer ? transfer.from : null,
counterparty: personName || (isOpening && openingParty ? openingParty : (kind === 'transfer' ? transferParty(extractPartyRaw(partyRaw) || extractParty(body)) : (extractPartyRaw(partyRaw) || extractParty(body)))),
date: entryDate,
dueDate: dueDate,
memo: String(raw).trim(),
rawAmount: amountInfo.raw,
moneyChoice: moneyAccountChoice(body),
lacksCurrency: lacksCurrency,
matchedKeyword: matchedKeyword
};
}
function _cloneIntent(x) {
if (x === null || typeof x !== 'object') return x;
if (Array.isArray(x)) {
var a = new Array(x.length);
for (var i = 0; i < x.length; i++) a[i] = _cloneIntent(x[i]);
return a;
}
var o = {};
for (var k in x) {
if (Object.prototype.hasOwnProperty.call(x, k)) o[k] = _cloneIntent(x[k]);
}
return o;
}
function parseIntent(raw) {
var key = String(raw == null ? '' : raw) + '|' + _stateRev;
if (_parseCache.has(key)) return _cloneIntent(_parseCache.get(key));
var res = parseIntentCore(raw);
if (_parseCache.size >= _parseCacheMax) {
var first = _parseCache.keys().next().value;
_parseCache.delete(first);
}
_parseCache.set(key, res);
return _cloneIntent(res);
}
var _accountMap = null;
var _accountMapRev = -1;
var _accountMapArr = null;
var _accountMapLen = -1;
function _rebuildAccountMap() {
_accountMap = {};
if (state && Array.isArray(state.accounts)) {
for (var i = 0; i < state.accounts.length; i++) {
var a = state.accounts[i];
if (a && a.id != null) _accountMap[a.id] = a;
}
}
_accountMapRev = _stateRev;
_accountMapArr = state ? state.accounts : null;
_accountMapLen = state && state.accounts ? state.accounts.length : -1;
}
function getAccount(id) {
if (!state) return null;
if (!_accountMap || _accountMapRev !== _stateRev ||
_accountMapArr !== state.accounts || _accountMapLen !== state.accounts.length) {
_rebuildAccountMap();
}
return Object.prototype.hasOwnProperty.call(_accountMap, id) ? _accountMap[id] : null;
}
var NAME_CURRENCY_WORDS = ['دولار', 'دولارات', 'ريال', 'ريالات', 'درهم', 'دراهم', 'يورو', 'دينار', 'دنانير', 'جنيه', 'جنيهات',
'ليره', 'ليرات', 'روبيه', 'روبيات', 'شيكل', 'فرنك', 'يوان', 'باوند', 'استرليني', 'روبل', 'بيزو', 'كرونه', 'بتكوين'];
var NAME_CURRENCY_SIGNS = ['$', '€', '£', '¥', '﷼', '\u20C1', '\u20C4', 'ر.س', 'د.إ', 'ر.ع', 'ر.ق', 'YER'];
function accountNameCurrency(name) {
var raw = String(name || '');
for (var i = 0; i < NAME_CURRENCY_SIGNS.length; i++) if (raw.indexOf(NAME_CURRENCY_SIGNS[i]) >= 0) return NAME_CURRENCY_SIGNS[i];
var codes = {};
listCurrencies().forEach(function (c) { codes[c.code] = true; });
WORLD_CURRENCIES.forEach(function (c) { codes[c.code] = true; });
var latin = raw.match(/[A-Za-z]+/g) || [];
for (var j = 0; j < latin.length; j++) if (latin[j].length === 3 && codes[latin[j].toUpperCase()]) return latin[j];
var words = normalizeAr(raw).split(/\s+/);
for (var k = 0; k < words.length; k++) {
var w = words[k].replace(/^(?:وال|بال|لل|ال|و|ب|ل)(?=..)/, '');
if (NAME_CURRENCY_WORDS.indexOf(w) >= 0) return words[k];
}
var padded = ' ' + normalizeAr(raw) + ' ';
var added = currencyConfig().added;
for (var a = 0; a < added.length; a++) {
var n = normalizeAr(added[a].name);
if (n && (padded.indexOf(' ' + n + ' ') >= 0 || padded.indexOf(' ال' + n + ' ') >= 0)) return added[a].name;
}
return null;
}
var LEGACY_ACCOUNT_NAMES = { usd_box: ['صندوق الدولار'], sar_box: ['صندوق الريال', 'صندوق الرياض'] };
function accountNamesOf(acc) { return [acc.name].concat(LEGACY_ACCOUNT_NAMES[acc.id] || []); }
function checkAccountName(name) {
var found = accountNameCurrency(name);
if (found) return { ok: false, error: 'لا يُكتب اسم العملة في اسم الحساب («' + found + '»). اختر العملة من حقل العملة واكتب الاسم بدونها، مثل «صندوق السفر».' };
return { ok: true };
}
function addAccount(def) {
if (!state) return { ok: false, error: 'المحرك غير محمّل' };
def = def || {};
var nameCheck = checkAccountName(def.name || '');
if (!nameCheck.ok) return nameCheck;
var code = String(def.code || def.id || '').trim();
if (!code) code = 'acc_' + uid('a').slice(-6);
var base = code; var n = 2;
while (getAccount(code)) { code = base + '_' + n; n++; }
var type = String(def.type || 'expense').toLowerCase();
var nature = def.nature || (type === 'asset' || type === 'expense' ? 'debit' : 'credit');
if (type === 'asset' || type === 'expense') nature = 'debit';
else if (type === 'liability' || type === 'equity' || type === 'revenue') nature = 'credit';
var settingDefault = !!(state.settings && state.settings.defaultMultiCurrency === true);
var hasExplicit = (Array.isArray(def.currencies) && def.currencies.length) || !!def.currency;
var picked = Array.isArray(def.currencies) && def.currencies.length
? def.currencies.filter(function (c, i, all) { return c && all.indexOf(c) === i; })
: (def.multi === false || hasExplicit ? [] : (settingDefault ? listCurrencies().map(function (c) { return c.code; }) : []));
var multi = (def.multi === false) ? false : (picked.length > 1 || !!def.multi);
var currency = multi ? BASE : (picked[0] || def.currency || 'SAR');
var liquid = !!def.liquid;
var acc = {
id: code,
code: code,
name: def.name || code,
nickname: def.nickname || '',
hint: def.hint || '',
phone: def.phone || null,
email: def.email || null,
is_account: !!def.is_account || /^acc_/.test(code),
deviceCode: def.deviceCode || null,
type: type,
subtype: def.subtype || '',
nature: nature,
currency: currency,
liquid: liquid,
multi: multi,
currencies: multi ? picked : [],
glyph: def.glyph || '◆'
};
state.accounts.push(acc);
saveState();
return { ok: true, account: acc };
}
var GENERAL_CASH = 'سيولة نقدية';
var GENERAL_OTHER = 'أخرى';
var GENERAL_ACCOUNTS = {
asset: [GENERAL_CASH, 'العملاء', 'المخزون', 'مصروفات مقدمة', 'استثمارات', 'الأراضي والمباني', 'السيارات والمعدات'],
liability: ['الموردون', 'مصروفات مستحقة', 'قروض'],
equity: ['رأس المال', 'الأرباح المحتجزة', 'المسحوبات'],
revenue: ['إيرادات النشاط', 'إيرادات أخرى'],
expense: ['الرواتب', 'الإيجار', 'الكهرباء والماء', 'مصروفات عامة']
};
var GENERAL_ALIASES = { 'عميل': 'العملاء', 'مورد': 'الموردون', 'مزود خدمة': 'الموردون', 'محفظة إلكترونية': GENERAL_CASH, wallet: GENERAL_CASH, 'النقد وما في حكمه': GENERAL_CASH };
var GENERAL_BUILT_IN = { receivable: 'العملاء', payable: 'الموردون', capital: 'رأس المال', revenue: 'إيرادات النشاط', expense: 'مصروفات عامة' };
function onAccountRenamed(id, newName) {
if (!id) return { ok: false, error: 'no id' };
try {
db.run('UPDATE semantic_dictionary SET account_hint = ?, account_id = account_id WHERE account_id = ?', [newName, id]);
} catch (e) { log('warn', 'onAccountRenamed failed', e); }
try {
db.run('UPDATE semantic_dictionary SET account_hint = ? WHERE account_id IS NULL AND account_hint = (SELECT name FROM accounts WHERE id = ?)', [newName, id]);
} catch (e) {}
ensureMemoryLoaded();
saveState();
return { ok: true };
}
function onAccountRemoved(id, replacementId) {
if (!id) return { ok: false, error: 'no id' };
try {
if (replacementId) {
db.run('UPDATE semantic_dictionary SET account_id = ?, account_hint = (SELECT name FROM accounts WHERE id = ?) WHERE account_id = ?', [replacementId, replacementId, id]);
} else {
db.run('UPDATE semantic_dictionary SET account_id = NULL, account_hint = NULL WHERE account_id = ?', [id]);
}
} catch (e) { log('warn', 'onAccountRemoved failed', e); }
ensureMemoryLoaded();
saveState();
return { ok: true };
}
function queueLearnedWord(token, suggestedAction, suggestedAccountId) {
if (!token) return { ok: false, error: 'no token' };
var t = String(token).trim();
if (t.length < 2) return { ok: false, error: 'too short' };
var now = new Date().toISOString();
try {
var rows = db.exec("SELECT id, seen_count FROM learned_words WHERE token = ?", [t]);
if (rows && rows[0] && rows[0].values && rows[0].values.length) {
var id = rows[0].values[0][0];
db.run("UPDATE learned_words SET seen_count = seen_count + 1, last_seen = ?, suggested_action = COALESCE(suggested_action, ?), suggested_account_id = COALESCE(suggested_account_id, ?) WHERE id = ?",
[now, suggestedAction || null, suggestedAccountId || null, id]);
} else {
db.run("INSERT INTO learned_words (token, suggested_action, suggested_account_id, seen_count, first_seen, last_seen, promoted) VALUES (?,?,?,?,?,?,0)",
[t, suggestedAction || null, suggestedAccountId || null, 1, now, now]);
}
} catch (e) { log('warn', 'queueLearnedWord failed', e); return { ok: false, error: String(e) }; }
saveState();
return { ok: true };
}
function listLearnedWords(limit) {
limit = limit || 200;
try {
var rows = db.exec("SELECT id, token, suggested_action, suggested_account_id, seen_count, first_seen, last_seen, promoted FROM learned_words WHERE promoted = 0 ORDER BY seen_count DESC, last_seen DESC LIMIT " + Number(limit));
if (!rows || !rows[0]) return [];
return rows[0].values.map(function (r) {
return { id: r[0], token: r[1], suggestedAction: r[2], suggestedAccountId: r[3], seenCount: r[4], firstSeen: r[5], lastSeen: r[6], promoted: !!r[7] };
});
} catch (e) { return []; }
}
function promoteLearnedWord(id, kind, accountId) {
if (!kind) return { ok: false, error: 'no kind' };
var rows;
try { rows = db.exec("SELECT token, suggested_account_id FROM learned_words WHERE id = " + Number(id)); } catch (e) { return { ok: false, error: String(e) }; }
if (!rows || !rows[0] || !rows[0].values || !rows[0].values.length) return { ok: false, error: 'not found' };
var token = rows[0].values[0][0];
var accId = accountId || rows[0].values[0][1];
var res = trainSentence(token, kind, accId);
if (!res.ok) return res;
try { db.run("UPDATE learned_words SET promoted = 1 WHERE id = ?", [Number(id)]); } catch (e) {}
ensureMemoryLoaded();
saveState();
return { ok: true, keyword: res.keyword };
}
function dismissLearnedWord(id) {
try { db.run("DELETE FROM learned_words WHERE id = ?", [Number(id)]); } catch (e) { return { ok: false, error: String(e) }; }
saveState();
return { ok: true };
}
function generalAccountOf(acc) {
var subtype = String((acc && acc.subtype) || '').trim();
if (subtype) return GENERAL_ALIASES[subtype] || subtype;
if (GENERAL_BUILT_IN[acc.id]) return GENERAL_BUILT_IN[acc.id];
return acc.liquid ? GENERAL_CASH : GENERAL_OTHER;
}
function generalAccountsFor(type) {
return (GENERAL_ACCOUNTS[type] || []).slice();
}
function generalAccountGroups(accounts, type) {
var listed = generalAccountsFor(type);
var groups = {};
accounts.forEach(function (acc) {
var name = generalAccountOf(acc);
(groups[name] = groups[name] || []).push(acc);
});
var rank = function (name) {
if (name === GENERAL_OTHER) return listed.length + 1;
var at = listed.indexOf(name);
return at < 0 ? listed.length : at;
};
return Object.keys(groups).sort(function (a, b) {
return rank(a) - rank(b) || a.localeCompare(b, 'ar');
}).map(function (name) { return { name: name, accounts: groups[name] }; });
}
function favoriteAccounts() {
var settings = getState().settings;
if (!Array.isArray(settings.favoriteAccounts)) settings.favoriteAccounts = [];
return settings.favoriteAccounts;
}
function isFavoriteAccount(id) {
return favoriteAccounts().indexOf(id) >= 0;
}
function toggleFavoriteAccount(id) {
if (!getAccount(id)) return { ok: false, error: 'الحساب غير موجود' };
var settings = getState().settings;
var favorite = !isFavoriteAccount(id);
settings.favoriteAccounts = favorite ? favoriteAccounts().concat(id) : favoriteAccounts().filter(function (x) { return x !== id; });
saveState();
return { ok: true, favorite: favorite };
}
function favoriteCurrencies() {
var settings = getState().settings;
if (!Array.isArray(settings.favoriteCurrencies)) settings.favoriteCurrencies = [];
return settings.favoriteCurrencies;
}
function isFavoriteCurrency(code) {
return favoriteCurrencies().indexOf(code) >= 0;
}
function toggleFavoriteCurrency(code) {
var settings = getState().settings;
var favorite = !isFavoriteCurrency(code);
settings.favoriteCurrencies = favorite ? favoriteCurrencies().concat(code) : favoriteCurrencies().filter(function (x) { return x !== code; });
saveState();
return { ok: true, favorite: favorite };
}
function makeLine(accountId, side, baseMinor, rateOf, entryCurrency, note) {
var acc = getAccount(accountId);
if (!acc) throw new Error('الحساب غير موجود: ' + accountId);
var currency = acc.multi && entryCurrency ? entryCurrency : acc.currency;
if (acc.multi && acc.currencies && acc.currencies.length && acc.currencies.indexOf(currency) < 0) currency = acc.currencies[0];
var rate = rateOf ? rateOf(currency) : getRate(currency);
var native = Math.round(baseMinor / rate);
return {
accountId: accountId,
currency: currency,
debit: side === 'debit' ? native : 0,
credit: side === 'credit' ? native : 0,
debitBase: side === 'debit' ? baseMinor : 0,
creditBase: side === 'credit' ? baseMinor : 0,
rate: rate,
note: note || ''
};
}
function lineRate(l) {
if (l && Number(l.rate) > 0) return Number(l.rate);
var native = Number(l && (l.debit || l.credit)) || 0;
var base = Number(l && (l.debitBase || l.creditBase)) || 0;
return native > 0 && base > 0 ? base / native : getRate(l && l.currency);
}
function linesExchange(lines) {
var byCurrency = {};
(lines || []).forEach(function (l) { if (l && l.currency && !byCurrency[l.currency]) byCurrency[l.currency] = lineRate(l); });
var codes = Object.keys(byCurrency);
if (codes.length !== 2) return null;
var a = codes[0], b = codes[1];
if (byCurrency[a] < byCurrency[b]) { var t = a; a = b; b = t; }
return { from: a, to: b, rate: byCurrency[a] / byCurrency[b] };
}
function validateLines(lines) {
if (!lines || !lines.length) return { ok: false, error: 'لا توجد سطور في القيد' };
var debit = 0, credit = 0;
for (var i = 0; i < lines.length; i++) {
var l = lines[i];
if (!getAccount(l.accountId)) return { ok: false, error: 'حساب غير معروف: ' + l.accountId };
var d = Number(l.debitBase) || 0;
var c = Number(l.creditBase) || 0;
if (d < 0 || c < 0) return { ok: false, error: 'لا يُسمح بالمبالغ السالبة' };
if ((d > 0 && c > 0) || (d === 0 && c === 0)) return { ok: false, error: 'كل سطر يجب أن يكون مديناً أو دائناً' };
debit += d;
credit += c;
}
if (debit !== credit) {
return { ok: false, error: 'اختلال في القيد: مدين ' + debit + ' ≠ دائن ' + credit };
}
if (debit <= 0) return { ok: false, error: 'قيمة القيد يجب أن تكون أكبر من صفر' };
return { ok: true, totalBase: debit };
}
function buildDraft(intent) {
if (intent && intent.kind === 'exchange' && intent.exchange) return buildExchangeDraft(intent.exchange);
var own = intent.rates || {};
if (intent.rate && Number(intent.rate) > 0 && intent.currency && intent.currency !== BASE && !own[intent.currency]) {
own[intent.currency] = Number(intent.rate);
}
var rateOf = function (code) { return code !== BASE && Number(own[code]) > 0 && isFinite(own[code]) ? Number(own[code]) : getRate(code); };
if (intent.isCompound || (Array.isArray(intent.lines) && intent.lines.length >= 2)) {
var lines = intent.lines.map(function (l) {
var lineCur = l.currency || intent.currency || BASE;
var r = Number(l.rate) > 0 ? Number(l.rate) : rateOf(lineCur);
var accId = l.accountId || 'cash';
var dMinor = Number(l.debitMinor != null ? l.debitMinor : l.debit) || 0;
var cMinor = Number(l.creditMinor != null ? l.creditMinor : l.credit) || 0;
var dBase = l.debitBase != null ? Number(l.debitBase) : (dMinor > 0 ? Math.round(dMinor * r) : 0);
var cBase = l.creditBase != null ? Number(l.creditBase) : (cMinor > 0 ? Math.round(cMinor * r) : 0);
return {
accountId: accId,
currency: lineCur,
rate: r,
debit: dMinor,
credit: cMinor,
debitBase: dBase,
creditBase: cBase,
counterparty: l.counterparty || intent.counterparty || '',
note: l.note || intent.note || '',
createDue: l.createDue || null
};
});
var check = validateLines(lines);
if (!check.ok) throw new Error(check.error);
var parsedDate = isValidDate(intent.date) ? intent.date : todayISO();
var dueDate = isValidDate(intent.dueDate) ? intent.dueDate : null;
return {
id: uid('draft'),
kind: intent.kind || 'compound',
isCompound: true,
date: parsedDate,
dueDate: dueDate,
currency: intent.currency || BASE,
amountMinor: intent.amountMinor || check.totalBase,
counterparty: intent.counterparty || '',
memo: intent.memo || '',
lines: lines,
totalBase: check.totalBase,
matchedKeyword: intent.matchedKeyword || null,
createdAt: new Date().toISOString()
};
}
var baseMinor = Math.round(intent.amountMinor * rateOf(intent.currency));
if (!(baseMinor > 0)) throw new Error('المبلغ غير صالح');
var kind = intent.kind;
var acc = intent.accountId;
var contra = intent.contraAccountId || null;
var lines;
var fx = null;
switch (kind) {
case 'expense':
lines = [makeLine(contra || 'expense', 'debit', baseMinor, rateOf, intent.currency, intent.note), makeLine(acc, 'credit', baseMinor, rateOf, intent.currency, intent.note)];
break;
case 'income':
lines = [makeLine(acc, 'debit', baseMinor, rateOf, intent.currency, intent.note), makeLine(contra || 'revenue', 'credit', baseMinor, rateOf, intent.currency, intent.note)];
break;
case 'lend':
lines = [makeLine(contra || 'receivable', 'debit', baseMinor, rateOf, intent.currency, intent.note), makeLine(acc, 'credit', baseMinor, rateOf, intent.currency, intent.note)];
break;
case 'borrow':
lines = [makeLine(acc, 'debit', baseMinor, rateOf, intent.currency, intent.note), makeLine(contra || 'payable', 'credit', baseMinor, rateOf, intent.currency, intent.note)];
break;
case 'collect':
case 'repay':
fx = allocateSettlement(kind, intent.counterparty, baseMinor, rateOf, intent.sourceEntryId || null);
var carrying = fx.fxBase ? fx.carryingBase : baseMinor;
lines = kind === 'collect'
? [makeLine(acc, 'debit', baseMinor, rateOf, intent.currency, intent.note), makeLine(contra || 'receivable', 'credit', carrying, rateOf, intent.currency, intent.note)]
: [makeLine(contra || 'payable', 'debit', carrying, rateOf, intent.currency, intent.note), makeLine(acc, 'credit', baseMinor, rateOf, intent.currency, intent.note)];
if (fx.fxBase && !fx.extraBase && fx.allocations.length) {
var cLine = kind === 'collect' ? lines[1] : lines[0];
var dueCur = {};
var units = 0;
fx.allocations.forEach(function (a) {
var d = state.dueItems.filter(function (x) { return x.id === a.dueId; })[0];
if (d) dueCur[d.currency] = true;
units += a.native;
});
var curs = Object.keys(dueCur);
if (curs.length === 1 && curs[0] === cLine.currency && units > 0) {
if (kind === 'collect') cLine.credit = units; else cLine.debit = units;
cLine.rate = carrying / units;
}
}
if (fx.fxBase > 0) lines.push(makeLine('fx_gain', 'credit', fx.fxBase, null, BASE, intent.note));
else if (fx.fxBase < 0) lines.push(makeLine('fx_loss', 'debit', -fx.fxBase, null, BASE, intent.note));
break;
case 'capital':
lines = [makeLine(acc, 'debit', baseMinor, rateOf, intent.currency, intent.note), makeLine(contra || 'capital', 'credit', baseMinor, rateOf, intent.currency, intent.note)];
break;
case 'settlement':
case 'transfer':
lines = [
makeLine(intent.toAccountId || 'bank', 'debit', baseMinor, rateOf, intent.currency, intent.note),
makeLine(intent.fromAccountId || intent.accountId || 'cash', 'credit', baseMinor, rateOf, intent.currency, intent.note)
];
break;
default:
throw new Error('نوع القيد غير مدعوم: ' + kind);
}
var check = validateLines(lines);
if (!check.ok) throw new Error(check.error);
var parsedDate = isValidDate(intent.date) ? intent.date : todayISO();
var dueDate = isValidDate(intent.dueDate) ? intent.dueDate : null;
return {
id: uid('draft'),
kind: kind,
date: parsedDate,
dueDate: dueDate,
currency: intent.currency,
amountMinor: intent.amountMinor,
counterparty: intent.counterparty || '',
memo: intent.memo || '',
lines: lines,
totalBase: fx ? baseMinor : check.totalBase,
fx: fx ? { base: fx.fxBase, paidBase: baseMinor, allocations: fx.allocations } : null,
matchedKeyword: intent.matchedKeyword || null,
createdAt: new Date().toISOString()
};
}
function buildSplitDraft(spec) {
spec = spec || {};
var kind = spec.kind;
if (kind !== 'capital' && kind !== 'income' && kind !== 'expense') throw new Error('نوع القيد غير مدعوم للتقسيم: ' + kind);
var currency = spec.currency || BASE;
var own = spec.rates || {};
var rateOf = function (code) { return code !== BASE && Number(own[code]) > 0 ? Number(own[code]) : getRate(code); };
var parts = (spec.parts || []).filter(function (p) { return p && Number(p.amountMinor) > 0 && getAccount(p.accountId); });
if (!parts.length) throw new Error('أدخل مبلغاً لحساب واحد على الأقل');
var lacking = parts.filter(function (p) { return !accountTakes(getAccount(p.accountId), currency); })
.map(function (p) { return getAccount(p.accountId).name; });
if (lacking.length) throw new Error('هذه الحسابات لا تقبل عملة ' + currency + ': ' + lacking.join('، ') + '. أضف العملة لها أولاً.');
var outgoing = kind === 'expense';
var total = 0;
var lines = parts.map(function (p) {
var base = Math.round(Number(p.amountMinor) * rateOf(currency));
total += base;
return makeLine(p.accountId, outgoing ? 'credit' : 'debit', base, rateOf, currency, spec.note);
});
var contra = spec.contraAccountId || (kind === 'capital' ? 'capital' : kind === 'income' ? 'revenue' : 'expense');
lines.push(makeLine(contra, outgoing ? 'debit' : 'credit', total, rateOf, currency, spec.note));
var check = validateLines(lines);
if (!check.ok) throw new Error(check.error);
return {
id: uid('draft'),
kind: kind,
isCompound: true,
date: isValidDate(spec.date) ? spec.date : todayISO(),
dueDate: spec.dueDate || null,
currency: currency,
amountMinor: parts.reduce(function (s, p) { return s + Number(p.amountMinor); }, 0),
counterparty: spec.counterparty || '',
memo: spec.memo || '',
lines: lines,
totalBase: check.totalBase,
fx: null,
matchedKeyword: null,
createdAt: new Date().toISOString()
};
}
function avgCostOf(accountId, currency, ignoreEntryId) {
var native = 0, base = 0;
var acc = getAccount(accountId);
state.entries.forEach(function (e) {
if (ignoreEntryId && e.id === ignoreEntryId) return;
(e.lines || []).forEach(function (l) {
if (l.accountId !== accountId) return;
if ((l.currency || (acc && acc.currency)) !== currency) return;
native += (Number(l.debit) || 0) - (Number(l.credit) || 0);
base += (Number(l.debitBase) || 0) - (Number(l.creditBase) || 0);
});
});
var rate = native > 0 && base > 0 ? base / native : (currency === BASE ? 1 : getRate(currency));
return { native: native, base: base, rate: rate };
}
function exchangeQuote(spec) {
spec = spec || {};
var A = spec.sellCurrency, B = spec.buyCurrency;
var sell = Math.round(Number(spec.sellMinor) || 0);
var rateA = getRate(A), rateB = getRate(B);
var strongerIs = rateA >= rateB ? A : B;
var buy = Math.round(Number(spec.buyMinor) || 0);
var typedRate = Number(spec.rate) > 0 ? Number(spec.rate) : 0;
if (!(buy > 0)) {
if (typedRate) buy = Math.round(strongerIs === A ? sell * typedRate : sell / typedRate);
else buy = Math.round(sell * rateA / rateB);
}
var rate = sell > 0 && buy > 0 ? (strongerIs === A ? buy / sell : sell / buy) : 0;
var held = avgCostOf(spec.fromAccountId, A, spec.ignoreEntryId);
var carrying = sell > 0 && sell === held.native ? held.base : Math.round(sell * held.rate);
var proceeds = Math.round(buy * rateB);
return {
sellMinor: sell, buyMinor: buy, rate: rate, strongerIs: strongerIs, avgRate: held.rate,
carryingBase: carrying, proceedsBase: proceeds, gainBase: proceeds - carrying, shortfall: sell > held.native
};
}
function buildExchangeDraft(spec) {
spec = spec || {};
var A = spec.sellCurrency, B = spec.buyCurrency;
if (!A || !B || A === B) throw new Error('اختر عملتين مختلفتين للصرف');
var from = getAccount(spec.fromAccountId), to = getAccount(spec.toAccountId);
if (!from || !from.liquid) throw new Error('اختر حساباً نقدياً تُصرف منه العملة');
if (!to || !to.liquid) throw new Error('اختر حساباً نقدياً يستلم العملة');
if (!accountTakes(from, A)) throw new Error('الحساب «' + from.name + '» لا يقبل ' + A);
if (!accountTakes(to, B)) throw new Error('الحساب «' + to.name + '» لا يقبل ' + B);
var q = exchangeQuote({
fromAccountId: from.id, sellCurrency: A, sellMinor: spec.sellMinor, buyCurrency: B,
buyMinor: spec.buyMinor, rate: spec.rate, ignoreEntryId: spec.ignoreEntryId || spec.sourceEntryId
});
if (!(q.sellMinor > 0)) throw new Error('اكتب المبلغ المراد صرفه');
if (!(q.buyMinor > 0)) throw new Error('اكتب المبلغ المستلم أو سعر الصرف');
if (!(q.proceedsBase > 0) || !(q.carryingBase > 0)) throw new Error('المبلغ صغير جداً');
var lines = [
{ accountId: to.id, currency: B, rate: q.proceedsBase / q.buyMinor, debit: q.buyMinor, credit: 0, debitBase: q.proceedsBase, creditBase: 0, counterparty: '', note: '' },
{ accountId: from.id, currency: A, rate: q.carryingBase / q.sellMinor, debit: 0, credit: q.sellMinor, debitBase: 0, creditBase: q.carryingBase, counterparty: '', note: '' }
];
if (q.gainBase > 0) lines.push(makeLine('fx_gain', 'credit', q.gainBase, null, BASE, ''));
else if (q.gainBase < 0) lines.push(makeLine('fx_loss', 'debit', -q.gainBase, null, BASE, ''));
var check = validateLines(lines);
if (!check.ok) throw new Error(check.error);
var plain = function (minor, cur) { return (minor / 100).toFixed(2) + ' ' + cur; };
return {
id: uid('draft'),
kind: 'exchange',
date: isValidDate(spec.date) ? spec.date : todayISO(),
dueDate: null,
currency: A,
amountMinor: q.sellMinor,
counterparty: '',
memo: String(spec.memo || '').trim() || ('صرف ' + plain(q.sellMinor, A) + ' إلى ' + plain(q.buyMinor, B)),
lines: lines,
totalBase: check.totalBase,
fx: null,
exchange: q,
matchedKeyword: null,
createdAt: new Date().toISOString()
};
}
function exchangeIntent(e) {
if (!e || e.kind !== 'exchange') return null;
var lines = (e.lines || []).filter(function (l) { return l.accountId !== 'fx_gain' && l.accountId !== 'fx_loss'; });
var inn = lines.filter(function (l) { return (Number(l.debitBase) || 0) > 0; })[0];
var out = lines.filter(function (l) { return (Number(l.creditBase) || 0) > 0; })[0];
if (!inn || !out) return null;
return {
fromAccountId: out.accountId, toAccountId: inn.accountId,
sellCurrency: out.currency, sellMinor: Number(out.credit) || 0,
buyCurrency: inn.currency, buyMinor: Number(inn.debit) || 0,
date: e.date, memo: e.memo || ''
};
}
function draftAmount(draft) {
if (draft.amountMinor != null) return draft.amountMinor;
var own = (draft.lines || []).filter(function (l) { return l.currency === draft.currency; })[0];
if (own) return own.debit || own.credit;
return fromBase(draft.totalBase, draft.currency);
}
function createDraft(text) {
var intent = parseIntent(text);
if (intent.kind !== 'expense' && intent.kind !== 'income' && intent.kind !== 'lend' &&
intent.kind !== 'borrow' && intent.kind !== 'collect' && intent.kind !== 'repay' &&
intent.kind !== 'transfer' && intent.kind !== 'capital' && intent.kind !== 'exchange' &&
intent.kind !== 'compound' && !intent.isCompound) {
return intent;
}
ensurePeopleAccounts(intent);
var draft = buildDraft(intent);
state.drafts.push(draft);
if (state.drafts.length > 20) state.drafts = state.drafts.slice(-20);
return draft;
}
function findDraft(id) {
for (var i = 0; i < state.drafts.length; i++) if (state.drafts[i].id === id) return state.drafts[i];
return null;
}
function cancelDraft(id) {
var before = state.drafts.length;
state.drafts = state.drafts.filter(function (d) { return d.id !== id; });
if (state.drafts.length === before) return { ok: false, error: 'القيد غير موجود' };
saveState();
return { ok: true };
}
function postOpeningBalance(spec) {
spec = spec || {};
var acc = getAccount(spec.accountId);
if (!acc) return { ok: false, error: 'الحساب غير موجود' };
var rawItems = Array.isArray(spec.amounts) && spec.amounts.length
? spec.amounts
: [{ currency: spec.currency || acc.currency || BASE, amountMinor: spec.amountMinor, rate: spec.rate }];
var items = rawItems.filter(function (x) { return x && Number(x.amountMinor) > 0; });
if (!items.length) return { ok: false, error: 'أدخل مبلغاً أكبر من صفر' };
if (acc.liquid) {
var curList = acc.multi ? (acc.currencies || []).slice() : [acc.currency || BASE];
var addedCur = false;
items.forEach(function (it) {
var c = it.currency || BASE;
if (curList.indexOf(c) < 0) { curList.push(c); addedCur = true; }
});
if (addedCur) setAccountCurrencies(acc.id, curList);
}
var isLiab = acc.type === 'liability';
var isDueParty = !acc.liquid && (acc.id === 'receivable' || acc.id === 'payable' || acc.type === 'liability' || /عميل|عملاء|مورد|موردين/.test(acc.subtype || ''));
var dueKind = isDueParty ? (isLiab ? 'payable' : 'receivable') : null;
var partyName = spec.counterparty || (!acc.liquid && acc.id !== 'receivable' && acc.id !== 'payable' ? acc.name : '');
var lines = [];
var totalBase = 0;
items.forEach(function (it) {
var cur = it.currency || acc.currency || BASE;
var nativeMinor = Math.round(Number(it.amountMinor) || 0);
var r = cur === BASE ? 1 : (Number(it.rate) > 0 ? Number(it.rate) : getRate(cur));
var baseMinor = cur === BASE ? nativeMinor : Math.round(nativeMinor * r);
totalBase += baseMinor;
lines.push({
accountId: acc.id,
currency: cur,
rate: r,
debitMinor: isLiab ? 0 : nativeMinor,
creditMinor: isLiab ? nativeMinor : 0,
debitBase: isLiab ? 0 : baseMinor,
creditBase: isLiab ? baseMinor : 0,
counterparty: partyName,
createDue: partyName ? dueKind : null
});
});
lines.push({
accountId: 'capital',
currency: BASE,
rate: 1,
debitMinor: isLiab ? totalBase : 0,
creditMinor: isLiab ? 0 : totalBase,
debitBase: isLiab ? totalBase : 0,
creditBase: isLiab ? 0 : totalBase,
counterparty: partyName
});
var draft;
try {
draft = buildDraft({
kind: 'capital',
isCompound: true,
date: isValidDate(spec.date) ? spec.date : todayISO(),
dueDate: isValidDate(spec.dueDate) ? spec.dueDate : null,
currency: items.length === 1 ? (items[0].currency || BASE) : BASE,
amountMinor: totalBase,
counterparty: partyName,
memo: spec.memo || ('رصيد افتتاحي — ' + acc.name),
lines: lines
});
} catch (e) {
return { ok: false, error: e.message };
}
state.drafts.push(draft);
if (state.drafts.length > 20) state.drafts = state.drafts.slice(-20);
if (spec.draftOnly) {
saveState();
return { ok: true, draft: draft };
}
var cRes = confirmDraft(draft.id);
if (!cRes.ok) {
state.drafts = state.drafts.filter(function (d) { return d.id !== draft.id; });
saveState();
return cRes;
}
return { ok: true, entry: cRes.entry };
}
function duplicateDraft(id) {
var old = findDraft(id);
if (!old) return { ok: false, error: 'القيد غير موجود' };
var clone = JSON.parse(JSON.stringify(old));
clone.id = uid('draft');
clone.createdAt = new Date().toISOString();
if (clone.sourceEntryId) delete clone.sourceEntryId;
state.drafts.push(clone);
if (state.drafts.length > 20) state.drafts = state.drafts.slice(-20);
saveState();
return { ok: true, draft: clone };
}
function addDraft(fields) {
var draft;
if (fields && fields.kind === 'exchange') {
try { draft = buildExchangeDraft(fields.exchange || fields); }
catch (e) { return { ok: false, error: e.message }; }
state.drafts.push(draft);
if (state.drafts.length > 20) state.drafts = state.drafts.slice(-20);
saveState();
return { ok: true, draft: draft };
}
try {
draft = buildDraft({
kind: fields.kind,
amountMinor: fields.amountMinor,
currency: fields.currency,
accountId: fields.accountId,
contraAccountId: fields.contraAccountId || null,
toAccountId: fields.toAccountId || null,
fromAccountId: fields.fromAccountId || null,
counterparty: fields.counterparty || '',
memo: fields.memo || '',
date: fields.date,
dueDate: fields.dueDate || null,
rates: fields.rates || null,
rate: fields.rate || null,
matchedKeyword: fields.matchedKeyword || null
});
} catch (e) { return { ok: false, error: e.message }; }
state.drafts.push(draft);
if (state.drafts.length > 20) state.drafts = state.drafts.slice(-20);
saveState();
return { ok: true, draft: draft };
}
function updateDraft(id, fields) {
var old = findDraft(id);
if (!old) return { ok: false, error: 'القيد المقترح غير موجود' };
fields = fields || {};
if (fields.kind === 'exchange') {
var spec = Object.assign({}, fields.exchange || {});
if (!spec.date) spec.date = fields.date || old.date;
if (spec.memo === undefined && fields.memo !== undefined) spec.memo = fields.memo;
if (old.sourceEntryId && !spec.ignoreEntryId) spec.ignoreEntryId = old.sourceEntryId;
var xd;
try { xd = buildExchangeDraft(spec); }
catch (e) { return { ok: false, error: e.message }; }
xd.id = id; xd.createdAt = old.createdAt;
if (old.sourceEntryId) xd.sourceEntryId = old.sourceEntryId;
for (var xi = 0; xi < state.drafts.length; xi++) {
if (state.drafts[xi].id === id) { state.drafts[xi] = xd; break; }
}
saveState();
return { ok: true, draft: xd };
}
var isCompound = !!(old.isCompound || fields.isCompound || fields.kind === 'compound' ||
(Array.isArray(fields.lines) && fields.lines.length >= 2));
if (isCompound) {
var newCounterparty = (fields.counterparty === undefined ? old.counterparty : fields.counterparty) || '';
var newMemo = (fields.memo === undefined ? old.memo : fields.memo) || '';
var newDate = (fields.date && isValidDate(fields.date)) ? fields.date : old.date;
var newDue = (fields.dueDate === undefined)
? old.dueDate
: (isValidDate(fields.dueDate) ? fields.dueDate : null);
var newCurrency = fields.currency || old.currency || BASE;
if (Array.isArray(fields.lines) && fields.lines.length >= 2) {
var intent = {
isCompound: true,
kind: 'compound',
lines: fields.lines,
currency: newCurrency,
counterparty: newCounterparty,
memo: newMemo,
date: newDate,
dueDate: newDue,
rates: fields.rates || old.rates || null,
rate: fields.rate || old.rate,
amountMinor: fields.amountMinor
};
var rebuilt;
try { rebuilt = buildDraft(intent); }
catch (e) { return { ok: false, error: e.message }; }
rebuilt.id = id;
rebuilt.createdAt = old.createdAt;
if (old.sourceEntryId) rebuilt.sourceEntryId = old.sourceEntryId;
if (old.matchedKeyword) rebuilt.matchedKeyword = old.matchedKeyword;
for (var ri = 0; ri < state.drafts.length; ri++) {
if (state.drafts[ri].id === id) { state.drafts[ri] = rebuilt; break; }
}
saveState();
return { ok: true, draft: rebuilt };
}
var preservedLines = (old.lines || []).map(function (l) {
return {
accountId: l.accountId, currency: l.currency, rate: l.rate,
debit: l.debit, credit: l.credit,
debitBase: l.debitBase, creditBase: l.creditBase,
counterparty: (fields.counterparty === undefined ? (l.counterparty || '') : (fields.counterparty || l.counterparty || '')),
note: (fields.note === undefined ? (l.note || '') : (fields.note || l.note || ''))
};
});
var preserved = {
id: id,
kind: 'compound',
isCompound: true,
date: newDate,
dueDate: newDue,
currency: newCurrency,
amountMinor: old.amountMinor,
counterparty: newCounterparty,
memo: newMemo,
lines: preservedLines,
totalBase: old.totalBase,
matchedKeyword: old.matchedKeyword,
createdAt: old.createdAt
};
if (old.sourceEntryId) preserved.sourceEntryId = old.sourceEntryId;
for (var pi = 0; pi < state.drafts.length; pi++) {
if (state.drafts[pi].id === id) { state.drafts[pi] = preserved; break; }
}
saveState();
return { ok: true, draft: preserved };
}
var intent2 = {
kind: fields.kind,
amountMinor: fields.amountMinor,
currency: fields.currency,
accountId: fields.accountId,
contraAccountId: fields.contraAccountId || null,
toAccountId: fields.toAccountId || null,
fromAccountId: fields.fromAccountId || null,
counterparty: (fields.counterparty === undefined ? old.counterparty : fields.counterparty) || '',
memo: (fields.memo === undefined ? old.memo : fields.memo) || '',
date: fields.date,
dueDate: fields.dueDate || null,
rates: fields.rates || null,
rate: fields.rate || null,
note: fields.note || (old.lines && old.lines[0] ? old.lines[0].note : ''),
sourceEntryId: old.sourceEntryId || null
};
var newDraft;
try { newDraft = buildDraft(intent2); }
catch (e) { return { ok: false, error: e.message }; }
newDraft.id = id;
newDraft.createdAt = old.createdAt;
if (old.sourceEntryId) newDraft.sourceEntryId = old.sourceEntryId;
for (var i = 0; i < state.drafts.length; i++) {
if (state.drafts[i].id === id) { state.drafts[i] = newDraft; break; }
}
if (vectorMemoryEnabled() && fields.contraAccountId !== undefined && old.contraAccountId && fields.contraAccountId !== old.contraAccountId) {
correctClassification({
phrase: old.memo || newDraft.memo || '',
originalKind: old.kind || newDraft.kind,
originalAccountId: old.contraAccountId || '',
correctedKind: newDraft.kind,
correctedAccountId: fields.contraAccountId
});
}
saveState();
return { ok: true, draft: newDraft };
}
function openDuesFor(dueKind, party, ignoreEntryId) {
var back = {};
if (ignoreEntryId) state.settlements.forEach(function (s) {
if (s.entryId !== ignoreEntryId) return;
var b = back[s.dueId] || (back[s.dueId] = { base: 0, native: 0, guessed: false });
b.base += Number(s.amount) || 0;
if (s.native != null) b.native += Number(s.native); else b.guessed = true;
});
var items = state.dueItems
.map(function (d) {
normalizeDue(d);
var b = back[d.id];
if (!b) return d;
var copy = JSON.parse(JSON.stringify(d));
copy.remaining += b.base;
copy.remainingNative += b.guessed ? (d.rate === 1 ? b.base : Math.round(b.base / d.rate)) : b.native;
return copy;
})
.filter(function (d) { return d.kind === dueKind && d.remaining > 0; })
.sort(function (a, b) {
if (!a.dueDate) return 1;
if (!b.dueDate) return -1;
return a.dueDate < b.dueDate ? -1 : 1;
});
if (party) items = items.filter(function (d) { return normalizeName(d.counterparty) === normalizeName(party); });
return items;
}
function allocateSettlement(kind, party, paidBase, rateOf, ignoreEntryId) {
rateOf = rateOf || getRate;
var items = openDuesFor(kind === 'collect' ? 'receivable' : 'payable', party, ignoreEntryId);
var left = Math.max(0, Math.round(Number(paidBase) || 0));
var out = { carryingBase: 0, fxBase: 0, extraBase: 0, allocations: [] };
var lastFull = null;
for (var i = 0; i < items.length && left > 0; i++) {
var due = normalizeDue(items[i]);
var cur = due.currency === BASE ? 1 : (Number(rateOf(due.currency)) || due.rate);
var full = Math.round(due.remainingNative * cur) <= left;
var n = full ? due.remainingNative : Math.min(due.remainingNative, Math.round(left / cur));
if (!(n > 0)) break;
var used = full ? due.remaining : Math.round(n * (due.remaining / due.remainingNative));
var paid = full ? Math.min(left, Math.round(n * cur)) : Math.round(n * cur);
if (paid > left) paid = left;
var a = { dueId: due.id, used: used, native: n, cur: cur, paid: paid };
out.allocations.push(a);
if (full) lastFull = a;
left -= paid;
}
if (left > 0 && lastFull && left < lastFull.cur && items.every(function (d) {
return out.allocations.some(function (x) { return x.dueId === d.id; });
})) { lastFull.paid += left; left = 0; }
out.extraBase = left;
out.allocations.forEach(function (a) {
out.carryingBase += a.used;
out.fxBase += kind === 'collect' ? a.paid - a.used : a.used - a.paid;
});
out.carryingBase += out.extraBase;
return out;
}
function revaluationPreview(codes) {
var balances = computeAnalysis().balances || {};
var out = [];
state.accounts.forEach(function (acc) {
if (!acc.liquid) return;
accountCurrencies(acc, balances[acc.id]).forEach(function (p) {
if (p.currency === BASE || !p.native) return;
if (codes && codes.indexOf(p.currency) < 0) return;
var target = Math.round(p.native * getRate(p.currency));
if (target === p.base) return;
out.push({ accountId: acc.id, currency: p.currency, native: p.native, base: p.base, target: target, diff: target - p.base });
});
});
return out;
}
function buildRevaluationDraft(codes) {
var items = revaluationPreview(codes);
if (!items.length) return null;
var lines = [], gain = 0, loss = 0;
items.forEach(function (it) {
var up = it.diff > 0;
lines.push({ accountId: it.accountId, currency: it.currency, debit: 0, credit: 0,
debitBase: up ? it.diff : 0, creditBase: up ? 0 : -it.diff, rate: getRate(it.currency), note: 'إعادة تقييم ' + it.currency });
if (up) gain += it.diff; else loss -= it.diff;
});
if (gain) lines.push({ accountId: 'fx_gain', currency: BASE, debit: 0, credit: gain, debitBase: 0, creditBase: gain, rate: 1, note: '' });
if (loss) lines.push({ accountId: 'fx_loss', currency: BASE, debit: loss, credit: 0, debitBase: loss, creditBase: 0, rate: 1, note: '' });
var check = validateLines(lines);
if (!check.ok) throw new Error(check.error);
var used = items.map(function (it) { return it.currency; }).filter(function (c, i, all) { return all.indexOf(c) === i; });
return {
id: uid('draft'),
kind: 'compound',
isCompound: true,
date: todayISO(),
dueDate: null,
currency: BASE,
amountMinor: check.totalBase,
counterparty: '',
memo: 'إعادة تقييم الأرصدة الأجنبية بالسعر الجديد: ' + used.map(function (c) { return c + ' ' + getRate(c); }).join('، '),
lines: lines,
totalBase: check.totalBase,
fx: null,
revaluation: true,
matchedKeyword: null,
createdAt: new Date().toISOString()
};
}
function entryFx(e) {
var net = 0;
((e && e.lines) || []).forEach(function (l) {
if (l.accountId === 'fx_gain') net += (Number(l.creditBase) || 0) - (Number(l.debitBase) || 0);
else if (l.accountId === 'fx_loss') net -= (Number(l.debitBase) || 0) - (Number(l.creditBase) || 0);
});
return net;
}
function settlementIntent(e) {
if (!e || !isSettlement(e.kind) || e.isCompound) return null;
var lines = e.lines || [];
var collect = e.kind === 'collect';
var pay = lines.filter(function (l) { return l.accountId !== 'fx_gain' && l.accountId !== 'fx_loss' && (collect ? l.debitBase > 0 : l.creditBase > 0); })[0];
var contra = lines.filter(function (l) { return l.accountId !== 'fx_gain' && l.accountId !== 'fx_loss' && (collect ? l.creditBase > 0 : l.debitBase > 0); })[0];
if (!pay || !contra) return null;
var rates = {};
if (pay.currency !== BASE) rates[pay.currency] = lineRate(pay);
return {
kind: e.kind,
amountMinor: Number(pay.debit || pay.credit) || 0,
currency: pay.currency || BASE,
accountId: pay.accountId,
contraAccountId: contra.accountId,
counterparty: e.counterparty || '',
memo: e.memo || '',
date: e.date,
dueDate: e.dueDate || null,
rates: rates
};
}
function settleDue(kind, party, baseMinor, entryId, allocations) {
if (Array.isArray(allocations)) {
var now = new Date().toISOString();
allocations.forEach(function (a) {
var item = state.dueItems.filter(function (d) { return d.id === a.dueId; })[0];
if (!item) return;
normalizeDue(item);
item.remaining -= a.used;
item.remainingNative -= a.native;
item.settled = item.remaining <= 0;
item.updatedAt = now;
state.settlements.push({ id: uid('set'), entryId: entryId, dueId: item.id, amount: a.used, native: a.native, createdAt: now });
});
return;
}
if (!(baseMinor > 0)) return;
var items = state.dueItems
.filter(function (d) { return d.kind === kind && d.remaining > 0; })
.sort(function (a, b) {
if (!a.dueDate) return 1;
if (!b.dueDate) return -1;
return a.dueDate < b.dueDate ? -1 : 1;
});
if (party) {
items = items.filter(function (d) { return normalizeName(d.counterparty) === normalizeName(party); });
}
var left = baseMinor;
for (var i = 0; i < items.length && left > 0; i++) {
var item = normalizeDue(items[i]);
var used = Math.min(item.remaining, left);
var native = used >= item.remaining ? item.remainingNative : Math.round(used * item.remainingNative / item.remaining);
item.remaining -= used;
item.remainingNative -= native;
item.settled = item.remaining <= 0;
item.updatedAt = new Date().toISOString();
state.settlements.push({
id: uid('set'),
entryId: entryId,
dueId: item.id,
amount: used,
native: native,
createdAt: new Date().toISOString()
});
left -= used;
}
}
function normalizeDue(d, hint) {
if (!d) return d;
if (d.currency && Number(d.rate) > 0 && d.native != null && d.remainingNative != null) return d;
var entry = null;
for (var i = 0; d.entryId && i < state.entries.length; i++) if (state.entries[i].id === d.entryId) { entry = state.entries[i]; break; }
var currency = (hint && hint.currency) || (entry && entry.currency) || BASE;
var rate = 0;
if (currency === BASE) rate = 1;
if (!rate && entry) {
var own = (entry.lines || []).filter(function (l) { return l.currency === currency; })[0];
if (own) rate = lineRate(own);
}
if (!rate && hint && Number(hint.amountMinor) > 0 && Number(d.amount) > 0) rate = Math.round(d.amount / hint.amountMinor * 1e6) / 1e6;
if (!rate) rate = getRate(currency) || 1;
d.currency = currency;
d.rate = rate;
d.native = hint && Number(hint.amountMinor) > 0 ? Number(hint.amountMinor) : (rate === 1 ? d.amount : Math.round(d.amount / rate));
d.remainingNative = d.remaining === d.amount ? d.native : (rate === 1 ? d.remaining : Math.round(d.remaining / rate));
return d;
}
function dueContraAccount(due) {
if (!due || !due.entryId) return null;
for (var i = 0; i < state.entries.length; i++) {
if (state.entries[i].id !== due.entryId) continue;
var lines = state.entries[i].lines || [];
for (var j = 0; j < lines.length; j++) {
var side = due.kind === 'receivable' ? lines[j].debitBase : lines[j].creditBase;
if (side > 0 && getAccount(lines[j].accountId)) return lines[j].accountId;
}
}
return null;
}
function settleDueItem(dueId, paymentAccountId) {
var due = null;
for (var i = 0; i < state.dueItems.length; i++) if (state.dueItems[i].id === dueId) due = state.dueItems[i];
if (!due) return { ok: false, error: 'الاستحقاق غير موجود' };
if (!(due.remaining > 0)) return { ok: false, error: 'تمت التسوية مسبقاً' };
var kind = due.kind === 'receivable' ? 'collect' : 'repay';
normalizeDue(due);
var intent = {
kind: kind,
amountMinor: due.remainingNative,
currency: due.currency || BASE,
accountId: paymentAccountId || 'cash',
contraAccountId: dueContraAccount(due),
counterparty: due.counterparty || '',
date: todayISO(),
dueDate: null,
memo: 'تسوية استحقاق: ' + (due.counterparty || '')
};
var draft;
try { draft = buildDraft(intent); }
catch (e) { return { ok: false, error: e.message }; }
state.drafts.push(draft);
if (state.drafts.length > 20) state.drafts = state.drafts.slice(-20);
var res = confirmDraft(draft.id);
if (!res.ok) {
state.drafts = state.drafts.filter(function (d) { return d.id !== draft.id; });
saveState();
return res;
}
return { ok: true, entry: res.entry, dueId: dueId };
}
function overdraftFix(accountId) {
var acc = getAccount(accountId);
if (!acc || !acc.liquid) return null;
var balances = computeAnalysis().balances;
var own = balances[accountId];
if (!own || !(own.native < 0 || own.base < 0)) return null;
var amount = Math.max(-own.base, own.native < 0 ? toBase(-own.native, acc.currency) : 0, 1);
for (var i = 0; i < 10 && fromBase(amount, acc.currency) < -own.native; i++) amount++;
return {
account: acc,
native: own.native,
amount: amount,
sources: state.accounts.filter(function (a) {
var b = balances[a.id];
return a.liquid && a.id !== accountId && b && b.base >= amount && b.native >= fromBase(amount, a.currency);
})
};
}
function fixOverdraft(accountId, fromAccountId) {
var fix = overdraftFix(accountId);
if (!fix) return { ok: false, error: 'لا يوجد رصيد سالب في هذا الحساب' };
var source = null;
if (fromAccountId) {
source = fix.sources.filter(function (a) { return a.id === fromAccountId; })[0];
if (!source) return { ok: false, error: 'رصيد الحساب المختار لا يكفي' };
}
var draft;
try {
draft = buildDraft({
kind: source ? 'transfer' : 'capital',
amountMinor: fix.amount,
currency: BASE,
accountId: accountId,
toAccountId: accountId,
fromAccountId: fromAccountId || null,
date: todayISO(),
memo: (source ? 'تغطية الرصيد السالب في ' : 'رصيد لم يُسجل في ') + fix.account.name
});
} catch (e) { return { ok: false, error: e.message }; }
state.drafts.push(draft);
if (state.drafts.length > 20) state.drafts = state.drafts.slice(-20);
var res = confirmDraft(draft.id);
if (!res.ok) {
state.drafts = state.drafts.filter(function (d) { return d.id !== draft.id; });
saveState();
}
return res;
}
function accountLedgerBalance(id) {
var out = { base: 0, native: 0 };
state.entries.forEach(function (e) {
(e.lines || []).forEach(function (l) {
if (l.accountId !== id) return;
out.base += (Number(l.debitBase) || 0) - (Number(l.creditBase) || 0);
out.native += (Number(l.debit) || 0) - (Number(l.credit) || 0);
});
});
if (getAccount(id) && getAccount(id).multi) out.native = out.base;
return out;
}
function closeAccountBalance(accountId, contraId) {
var acc = getAccount(accountId);
if (!acc) return { ok: false, error: 'الحساب غير موجود' };
if (!getAccount(contraId) || contraId === accountId) return { ok: false, error: 'اختر الحساب الذي يُنقل إليه الرصيد' };
var open = state.dueItems.some(function (d) { return d.remaining > 0 && dueContraAccount(d) === accountId; });
if (open) return { ok: false, error: 'على هذا الحساب استحقاقات مفتوحة. سوّها أولاً.' };
var balance = accountLedgerBalance(accountId);
if (!balance.base) return { ok: false, error: 'رصيد هذا الحساب صفر' };
var draft;
try {
draft = buildDraft({
kind: 'transfer', amountMinor: Math.abs(balance.base), currency: BASE,
toAccountId: balance.base > 0 ? contraId : accountId,
fromAccountId: balance.base > 0 ? accountId : contraId,
date: todayISO(), memo: 'إقفال رصيد حساب ' + acc.name
});
} catch (e) { return { ok: false, error: e.message }; }
draft.lines.forEach(function (l) {
if (l.accountId !== accountId) return;
if (balance.base > 0) l.credit = Math.abs(balance.native);
else l.debit = Math.abs(balance.native);
});
draft.sourceEntryId = accountId;
state.drafts.push(draft);
var res = confirmDraft(draft.id);
if (!res.ok) state.drafts = state.drafts.filter(function (d) { return d.id !== draft.id; });
return res;
}
function isAccountLocked(id) {
if (ACCOUNT_DEFS.some(function (a) { return a.id === id; })) return true;
var uses = function (record) {
return (record.lines || []).some(function (l) { return l.accountId === id; });
};
return state.entries.some(uses) || state.drafts.some(uses);
}
function accountTakes(acc, cur) {
if (!acc || !cur) return false;
if (acc.multi) return (acc.currencies || []).indexOf(cur) >= 0;
return (acc.currency || BASE) === cur;
}
function setAccountCurrencies(id, codes) {
var acc = getAccount(id);
if (!acc) return { ok: false, error: 'الحساب غير موجود' };
var picked = (Array.isArray(codes) ? codes : []).filter(function (c, i, all) { return c && all.indexOf(c) === i; });
if (!picked.length) return { ok: false, error: 'اختر عملة واحدة على الأقل' };
if (isAccountLocked(id)) {
if (!acc.liquid) return { ok: false, error: 'عملة هذا الحساب مقفلة لأنه أساسي أو عليه قيود.' };
var held = accountCurrencies(acc, computeAnalysis().balances[id]).filter(function (p) { return p.native !== 0; });
var dropped = held.filter(function (p) { return picked.indexOf(p.currency) < 0; }).map(function (p) { return p.currency; });
if (dropped.length) return { ok: false, error: 'لا يمكن إزالة عملة عليها رصيد: ' + dropped.join('، ') };
if (picked.length === 1) {
var other = state.entries.concat(state.drafts).some(function (e) {
return (e.lines || []).some(function (l) { return l.accountId === id && (l.currency || acc.currency) !== picked[0]; });
});
if (other) return { ok: false, error: 'على الحساب قيود بعملات أخرى، فلا يعود لعملة واحدة.' };
}
}
acc.multi = picked.length > 1;
acc.currencies = acc.multi ? picked : [];
acc.currency = acc.multi ? BASE : picked[0];
saveState();
return { ok: true, account: acc };
}
function detectFraudRisk(draft, ctx) {
var reasons = [];
var risk = 'low';
if (!draft) return { risk: 'low', reasons: [] };
ctx = ctx || {};
var now = (typeof ctx.now === 'number') ? ctx.now : Date.now();
var excludeId = ctx.excludeId || null;
var amount = draft.totalBase || 0;
var kind = draft.kind;
var party = (draft.counterparty || '').trim();
var st = state;
for (var i = 0; i < (st.entries || []).length; i++) {
var e = st.entries[i];
if (!e || e.kind !== kind) continue;
if (excludeId && e.id === excludeId) continue;
if (Math.abs((e.totalBase || 0) - amount) > 1) continue;
if (party && E_normalizeName(e.counterparty || '') !== E_normalizeName(party)) continue;
var created = e.createdAt ? new Date(e.createdAt).getTime() : 0;
if (created && (now - created) < 30000) { reasons.push('القيد نفسه (النوع والمبلغ والطرف) سُجّل قبل أقل من 30 ثانية'); risk = 'high'; break; }
}
var sameKind = (st.entries || []).filter(function (e) { return e && e.kind === kind && (!excludeId || e.id !== excludeId); });
if (sameKind.length >= 3) {
var avg = 0;
sameKind.forEach(function (e) { avg += Math.abs(e.totalBase || 0); });
avg = avg / sameKind.length;
if (avg > 0 && amount > avg * 3) { reasons.push('المبلغ ' + fmtMoney(amount, BASE, false) + ' يتجاوز ثلاثة أضعاف المتوسط لهذا النوع (' + fmtMoney(Math.round(avg), BASE, false) + ')'); if (risk !== 'high') risk = 'medium'; }
}
if (party) {
var known = (st.entries || []).some(function (e) { return (!excludeId || e.id !== excludeId) && E_normalizeName(e.counterparty || '') === E_normalizeName(party); });
if (!known && amount > 500000) { reasons.push('جهة لم تتعامل معها من قبل («' + party + '») بمبلغ ' + fmtMoney(amount, BASE, false)); if (risk !== 'high') risk = 'medium'; }
}
var recent = 0;
for (var j = 0; j < (st.entries || []).length; j++) {
if (excludeId && st.entries[j].id === excludeId) continue;
var c = st.entries[j].createdAt ? new Date(st.entries[j].createdAt).getTime() : 0;
if (c && (now - c) < 300000) recent++;
}
if (recent >= 5) { reasons.push(recent + ' قيود خلال 5 دقائق، وهذا أسرع من المعتاد'); if (risk !== 'high') risk = 'medium'; }
return { risk: risk, reasons: reasons };
}
function E_normalizeName(n) { return normalizeAr(n).replace(/^ال/, '').trim().toLowerCase(); }
var LIMITS_ENFORCED = true;
var FREE_MONTHLY_ENTRIES = 60;
var ENTRY_LIMIT_ENFORCED = true;
var ACTIVATION_PUBLIC_KEY = '6a45ae28c38b939b84879ffd2bd62ded91244b51bb277b2cd392fb48469aed4b';
var PUBLIC_KEY_FINGERPRINT = 'CF48395FC0FE136D';
var CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
var DEVICE_CODE_KEY = 'rohapp.deviceCode';
var ACTIVATION_KEY = 'rohapp.activation';
var REVOKED_KEY = 'rohapp.revokedCodes';
var USED_PROMOS_KEY = 'rohapp.usedPromos';
var MAX_DATE_KEY = 'rohapp.maxSeenDate';
var LICENSE_EPOCH = '2026-01-01';
var SUBSCRIPTION_GRACE_DAYS = 7;
var REFUND_WINDOW_DAYS = 7;
var REFUND_FAIR_USE_ENTRIES = 150;
var FEATURE_TRIAL_LIMITS = { statements: 3, multiCurrency: 3, pairing: 1, localAI: 3, unlimitedGroups: 3 };
var PRO_FEATURES = { unlimitedEntries: true, multiCurrency: true, localAI: true, statements: true, pairing: true, unlimitedGroups: true };
var PLANS = {
free: { id: 'free', name: 'مجاني', features: {} },
pro: { id: 'pro', name: 'برو', features: PRO_FEATURES },
annual: { id: 'annual', name: 'باقة الأعمال السنوية', features: PRO_FEATURES },
lifetime: { id: 'lifetime', name: 'رخصة مدى الحياة', features: PRO_FEATURES },
subscription: {
id: 'subscription',
name: 'اشتراك شهري',
features: {
unlimitedEntries: true, multiCurrency: true, localAI: true, statements: true,
pairing: true, unlimitedGroups: true, cloudBackup: true, hostedAI: true
}
}
};
function maxSeenDate() {
var sDate = (state && state.settings && state.settings.maxSeenDate) || '';
var lDate = storageGet(MAX_DATE_KEY) || '';
return sDate > lDate ? sDate : lDate;
}
function recordSeenDate(iso) {
var d = isValidDate(iso) ? iso : todayISO();
var cur = maxSeenDate();
if (!cur || d > cur) {
if (state && state.settings) state.settings.maxSeenDate = d;
storageSet(MAX_DATE_KEY, d);
}
return maxSeenDate();
}
function setMaxSeenDate(iso) {
if (!iso) {
if (state && state.settings) state.settings.maxSeenDate = null;
storageRemove(MAX_DATE_KEY);
return null;
}
if (!isValidDate(iso)) return null;
if (state && state.settings) state.settings.maxSeenDate = iso;
storageSet(MAX_DATE_KEY, iso);
return iso;
}
function isClockRolledBack(nowISO) {
var today = isValidDate(nowISO) ? nowISO : todayISO();
var maxD = maxSeenDate();
if (!maxD || !isValidDate(maxD)) return false;
return daysBetween(today, maxD) > 1;
}
function storedPlan() {
var p = state && state.settings && state.settings.plan;
return p && PLANS[p.id] ? p : { id: 'free', expiresAt: null };
}
function activePlanId() {
var p = storedPlan();
if ((p.id === 'subscription' || p.id === 'annual') && p.expiresAt) {
if (isClockRolledBack()) return 'free';
if (todayISO() > addDays(p.expiresAt, SUBSCRIPTION_GRACE_DAYS)) return 'free';
}
return p.id;
}
function planAllows(feature) {
if (!LIMITS_ENFORCED) return true;
var id = activePlanId();
if (PLANS[id] && PLANS[id].features[feature] === true) return true;
if (id === 'free' && isActivated() && PRO_FEATURES[feature] === true) return true;
return false;
}
var UX_KEY = 'rohapp.uxp';
var UX_DAYS = 30;
var UX_EVENTS = [
'entry.bot', 'entry.form', 'draft.confirm', 'draft.cancel', 'draft.edit',
'parse.needKind', 'parse.needAmount', 'parse.needSplit', 'parse.help', 'parse.query', 'parse.failed',
'voice.start', 'split.sheet', 'currency.add', 'reval.offer', 'reval.yes',
'report.print', 'report.send', 'backup.export', 'search', 'ai.ask', 'settle.sheet'
];
function isUxProgram() { return !!(state && state.settings && state.settings.uxProgram); }
function readUx() {
try { var d = JSON.parse(storageGet(UX_KEY) || 'null'); return d && typeof d === 'object' ? d : { days: {}, errors: {} }; }
catch (e) { return { days: {}, errors: {} }; }
}
function writeUx(d) {
var from = addDays(todayISO(), -(UX_DAYS - 1));
Object.keys(d.days || {}).forEach(function (day) { if (day < from) delete d.days[day]; });
storageSet(UX_KEY, JSON.stringify(d));
}
function clearUxData() { storageRemove(UX_KEY); }
function setUxProgram(on) {
if (!state) return { ok: false, error: 'المحرك غير محمّل' };
state.settings.uxProgram = !!on;
state.settings.uxAskedAt = state.settings.uxAskedAt || new Date().toISOString();
if (!on) clearUxData();
saveState();
return { ok: true };
}
function noteUsage(name, day) {
if (!isUxProgram() || UX_EVENTS.indexOf(name) < 0) return;
var d = readUx();
var when = isValidDate(day) ? day : todayISO();
d.days = d.days || {};
var bucket = d.days[when] || (d.days[when] = {});
bucket[name] = (bucket[name] || 0) + 1;
writeUx(d);
}
function noteError(type, where) {
if (!isUxProgram()) return;
var t = String(type || '').trim();
if (!/^[A-Za-z]{1,40}$/.test(t)) return;
var m = /([A-Za-z0-9_\-]+\.js)(?:\?[^:]*)?:(\d{1,6})/.exec(String(where || ''));
if (!m) return;
var d = readUx();
d.errors = d.errors || {};
var k = t + '@' + m[1] + ':' + m[2];
d.errors[k] = (d.errors[k] || 0) + 1;
writeUx(d);
}
function uxReport() {
var d = readUx();
var days = Object.keys(d.days || {}).sort();
var totals = {};
days.forEach(function (day) {
Object.keys(d.days[day]).forEach(function (k) { if (UX_EVENTS.indexOf(k) >= 0) totals[k] = (totals[k] || 0) + d.days[day][k]; });
});
return {
version: VERSION,
platform: (typeof window !== 'undefined' && window.RohNative) ? 'android' : 'web',
from: days[0] || null,
to: days[days.length - 1] || null,
activeDays: days.length,
totals: totals,
errors: d.errors || {}
};
}
function uxReportText() {
var r = uxReport();
var lines = ['تقرير برنامج تحسين التجربة — موني كود ' + r.version,
'المنصة: ' + r.platform + ' • الأيام: ' + r.activeDays + (r.from ? ' (' + r.from + ' إلى ' + r.to + ')' : ''),
'لا يحتوي التقرير على مبالغ أو أسماء أو نصوص.', ''];
var keys = Object.keys(r.totals).sort();
lines.push(keys.length ? keys.map(function (k) { return k + ': ' + r.totals[k]; }).join('\n') : 'لا توجد بيانات بعد.');
var errs = Object.keys(r.errors);
if (errs.length) lines.push('', 'أخطاء: ' + errs.map(function (k) { return k + ' ×' + r.errors[k]; }).join('، '));
lines.push('', JSON.stringify(r));
return lines.join('\n');
}
function isSettlement(kind) { return kind === 'collect' || kind === 'repay'; }
function entriesThisMonth() {
var month = todayISO().slice(0, 7);
return state.entries.filter(function (e) {
return !isSettlement(e.kind) && String(e.createdAt || e.date || '').slice(0, 7) === month;
}).length;
}
function getPlanInfo() {
var p = storedPlan();
var id = activePlanId();
var used = entriesThisMonth();
var act = isActivated();
var lic = activeLicenseMeta();
var clockBack = isClockRolledBack();
var expiresAt = (lic && lic.expiresAt) || p.expiresAt || null;
var expiredByCode = !!(lic && lic.expiresAt && todayISO() > addDays(lic.expiresAt, SUBSCRIPTION_GRACE_DAYS));
var inGrace = (p.id === id && !!p.expiresAt && todayISO() > p.expiresAt) ||
(act && !!(lic && lic.expiresAt) && todayISO() > lic.expiresAt && todayISO() <= addDays(lic.expiresAt, SUBSCRIPTION_GRACE_DAYS));
var unlimited = PLANS[id].features.unlimitedEntries === true || act;
return {
id: id,
name: PLANS[id].name,
purchasedId: p.id,
licenseKind: lic ? lic.kind : (p.id !== 'free' ? p.id : 'free'),
expiresAt: expiresAt,
expired: p.id !== id || expiredByCode,
inGrace: inGrace,
clockRolledBack: clockBack,
enforced: LIMITS_ENFORCED,
activated: act,
entryLimitOn: ENTRY_LIMIT_ENFORCED,
entriesThisMonth: used,
monthlyLimit: unlimited ? null : FREE_MONTHLY_ENTRIES,
entriesLeft: unlimited ? null : Math.max(0, FREE_MONTHLY_ENTRIES - used)
};
}
function setPlan(id, expiresAt) {
if (!PLANS[id]) return { ok: false, error: 'خطة غير معروفة' };
var keepExpiry = (id === 'subscription' || id === 'annual') ? (expiresAt || null) : null;
getState().settings.plan = { id: id, expiresAt: keepExpiry };
saveState();
return { ok: true };
}
function setLimitsEnforced(value) { LIMITS_ENFORCED = !!value; }
function setEntryLimitEnforced(value) {
ENTRY_LIMIT_ENFORCED = !!value;
if (!value) LIMITS_ENFORCED = false;
}
function setFreeMonthlyEntries(value) {
var n = Math.floor(Number(value));
if (n > 0) FREE_MONTHLY_ENTRIES = n;
return FREE_MONTHLY_ENTRIES;
}
function sha256(text) {
var k = [];
var h = [];
var isPrime = function (n) { for (var f = 2; f * f <= n; f++) { if (n % f === 0) return false; } return true; };
for (var c = 2; k.length < 64; c++) {
if (!isPrime(c)) continue;
if (h.length < 8) h.push(Math.floor((Math.sqrt(c) % 1) * 4294967296));
k.push(Math.floor((Math.cbrt(c) % 1) * 4294967296));
}
var bytes = [];
var encoded = unescape(encodeURIComponent(text));
for (var i = 0; i < encoded.length; i++) bytes.push(encoded.charCodeAt(i));
var bits = bytes.length * 8;
bytes.push(0x80);
while (bytes.length % 64 !== 56) bytes.push(0);
for (var b = 7; b >= 0; b--) bytes.push(b >= 4 ? 0 : (bits >>> (b * 8)) & 255);
var rotr = function (x, n) { return (x >>> n) | (x << (32 - n)); };
for (var offset = 0; offset < bytes.length; offset += 64) {
var w = [];
for (var t = 0; t < 64; t++) {
if (t < 16) {
w[t] = (bytes[offset + t * 4] << 24) | (bytes[offset + t * 4 + 1] << 16) | (bytes[offset + t * 4 + 2] << 8) | bytes[offset + t * 4 + 3];
} else {
var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
}
}
var v = h.slice();
for (var r = 0; r < 64; r++) {
var t1 = (v[7] + (rotr(v[4], 6) ^ rotr(v[4], 11) ^ rotr(v[4], 25)) + ((v[4] & v[5]) ^ (~v[4] & v[6])) + k[r] + w[r]) | 0;
var t2 = ((rotr(v[0], 2) ^ rotr(v[0], 13) ^ rotr(v[0], 22)) + ((v[0] & v[1]) ^ (v[0] & v[2]) ^ (v[1] & v[2]))) | 0;
v = [(t1 + t2) | 0, v[0], v[1], v[2], (v[3] + t1) | 0, v[4], v[5], v[6]];
}
h = h.map(function (x, n) { return (x + v[n]) | 0; });
}
var out = [];
h.forEach(function (x) { for (var s = 24; s >= 0; s -= 8) out.push((x >>> s) & 255); });
return out;
}
function sha256Hex(text) {
return sha256(text).map(function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('').toUpperCase();
}
function vocabSaltedHash(term) {
var norm = normalizeAr(String(term || '')).trim();
if (!norm) return '';
return sha256Hex('MoneyCode-vocab-salt-1:' + ACTIVATION_PUBLIC_KEY.slice(0, 16) + ':' + norm).slice(0, 16);
}
function plainCode(value) {
return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function groupCode(code) {
return code.replace(/(.{4})(?=.)/g, '$1-');
}
var DEVICE_SALT = 'MoneyCode-device-1:';
function deviceCodeFromPhone() {
var id = '';
try { id = root.RohDevice && root.RohDevice.id ? String(root.RohDevice.id() || '') : ''; } catch (e) { id = ''; }
id = id.trim();
if (id.length < 6 || /^0+$/.test(id)) return null;
return codeFromBytes(sha512((DEVICE_SALT + id).split('').map(function (c) { return c.charCodeAt(0) & 255; }))).slice(0, 12);
}
function deviceCode() {
var code = storageGet(DEVICE_CODE_KEY);
if (!code) {
code = deviceCodeFromPhone();
if (!code) {
code = '';
for (var i = 0; i < 12; i++) code += CODE_LETTERS.charAt(Math.floor(Math.random() * CODE_LETTERS.length));
}
storageSet(DEVICE_CODE_KEY, code);
}
return groupCode(code);
}
var edState = null;
function ed() {
if (edState) return edState;
var B = BigInt;
var one = B(1), two = B(2), zero = B(0);
var p = (one << B(255)) - B(19);
var mod = function (a) { var r = a % p; return r < zero ? r + p : r; };
var pow = function (base, exp) {
var out = one;
base = mod(base);
while (exp > zero) {
if (exp & one) out = (out * base) % p;
base = (base * base) % p;
exp >>= one;
}
return out;
};
var inv = function (a) { return pow(a, p - two); };
var d = mod(B(-121665) * inv(B(121666)));
var sqrtM1 = pow(two, (p - one) / B(4));
var recoverX = function (y, sign) {
if (y >= p) return null;
var x2 = mod((y * y - one) * inv(d * y * y + one));
if (x2 === zero) return sign ? null : zero;
var x = pow(x2, (p + B(3)) / B(8));
if (mod(x * x - x2) !== zero) x = (x * sqrtM1) % p;
if (mod(x * x - x2) !== zero) return null;
if ((x & one) !== B(sign)) x = p - x;
return x;
};
var baseY = mod(B(4) * inv(B(5)));
var baseX = recoverX(baseY, 0);
var primes = [];
for (var n = 2; primes.length < 80; n++) {
if (primes.every(function (q) { return n % q !== 0; })) primes.push(n);
}
var root2 = function (v, degree) {
var x = one << B(Math.ceil(v.toString(2).length / degree) + 1);
var deg = B(degree);
for (;;) {
var next = ((deg - one) * x + v / (degree === 2 ? x : x * x)) / deg;
if (next >= x) return x;
x = next;
}
};
var mask = (one << B(64)) - one;
edState = {
B: B, one: one, zero: zero, p: p, d: d, mod: mod, inv: inv, recoverX: recoverX, mask: mask,
q: (one << B(252)) + B('27742317777372353535851937790883648493'),
base: [baseX, baseY, one, mod(baseX * baseY)],
shaK: primes.map(function (q) { return root2(B(q) << B(192), 3) & mask; }),
shaH: primes.slice(0, 8).map(function (q) { return root2(B(q) << B(128), 2) & mask; })
};
return edState;
}
function sha512(bytes) {
var e = ed(), B = e.B, mask = e.mask;
var msg = bytes.slice();
var bits = msg.length * 8;
msg.push(128);
while (msg.length % 128 !== 112) msg.push(0);
for (var z = 0; z < 12; z++) msg.push(0);
for (var s = 24; s >= 0; s -= 8) msg.push((bits >>> s) & 255);
var rotr = function (x, n) { return ((x >> B(n)) | (x << B(64 - n))) & mask; };
var h = e.shaH.slice();
for (var offset = 0; offset < msg.length; offset += 128) {
var w = [];
for (var t = 0; t < 80; t++) {
if (t < 16) {
var word = B(0);
for (var b = 0; b < 8; b++) word = (word << B(8)) | B(msg[offset + t * 8 + b]);
w[t] = word;
} else {
var s0 = rotr(w[t - 15], 1) ^ rotr(w[t - 15], 8) ^ (w[t - 15] >> B(7));
var s1 = rotr(w[t - 2], 19) ^ rotr(w[t - 2], 61) ^ (w[t - 2] >> B(6));
w[t] = (w[t - 16] + s0 + w[t - 7] + s1) & mask;
}
}
var v = h.slice();
for (var r = 0; r < 80; r++) {
var t1 = v[7] + (rotr(v[4], 14) ^ rotr(v[4], 18) ^ rotr(v[4], 41)) + ((v[4] & v[5]) ^ ((v[4] ^ mask) & v[6])) + e.shaK[r] + w[r];
var t2 = (rotr(v[0], 28) ^ rotr(v[0], 34) ^ rotr(v[0], 39)) + ((v[0] & v[1]) ^ (v[0] & v[2]) ^ (v[1] & v[2]));
v = [(t1 + t2) & mask, v[0], v[1], v[2], (v[3] + t1) & mask, v[4], v[5], v[6]];
}
h = h.map(function (x, i) { return (x + v[i]) & mask; });
}
var out = [];
h.forEach(function (x) {
for (var o = 56; o >= 0; o -= 8) out.push(Number((x >> B(o)) & B(255)));
});
return out;
}
function edNumber(bytes) {
var e = ed(), n = e.zero;
for (var i = bytes.length - 1; i >= 0; i--) n = (n << e.B(8)) | e.B(bytes[i]);
return n;
}
function edBytes(n) {
var e = ed(), out = [];
for (var i = 0; i < 32; i++) {
out.push(Number(n & e.B(255)));
n >>= e.B(8);
}
return out;
}
function edAdd(a, b) {
var e = ed(), p = e.p, two = e.B(2);
var A = ((a[1] - a[0]) * (b[1] - b[0])) % p;
var C = ((a[1] + a[0]) * (b[1] + b[0])) % p;
var T = (two * a[3] * b[3] % p * e.d) % p;
var D = (two * a[2] * b[2]) % p;
var E2 = C - A, F = D - T, G = D + T, H = C + A;
return [e.mod(E2 * F), e.mod(G * H), e.mod(F * G), e.mod(E2 * H)];
}
function edMul(point, scalar) {
var e = ed();
var out = [e.zero, e.one, e.one, e.zero];
while (scalar > e.zero) {
if (scalar & e.one) out = edAdd(out, point);
point = edAdd(point, point);
scalar >>= e.one;
}
return out;
}
function edCompress(point) {
var e = ed(), zi = e.inv(point[2]);
var x = e.mod(point[0] * zi), y = e.mod(point[1] * zi);
return edBytes(y | ((x & e.one) << e.B(255)));
}
function edDecompress(bytes) {
var e = ed(), n = edNumber(bytes);
var sign = Number(n >> e.B(255));
var y = n & ((e.one << e.B(255)) - e.one);
var x = e.recoverX(y, sign);
return x === null ? null : [x, y, e.one, e.mod(x * y)];
}
function edHashToScalar(bytes) {
return edNumber(sha512(bytes)) % ed().q;
}
function edSign(seed, message) {
var e = ed(), hash = sha512(seed);
var clear = (e.one << e.B(254)) - e.B(8);
var scalar = (edNumber(hash.slice(0, 32)) & clear) | (e.one << e.B(254));
var publicBytes = edCompress(edMul(e.base, scalar));
var nonce = edHashToScalar(hash.slice(32).concat(message));
var R = edCompress(edMul(e.base, nonce));
var challenge = edHashToScalar(R.concat(publicBytes, message));
return R.concat(edBytes((nonce + challenge * scalar) % e.q));
}
function edVerify(publicBytes, message, signature) {
if (signature.length !== 64) return false;
var e = ed();
var A = edDecompress(publicBytes);
var R = edDecompress(signature.slice(0, 32));
var s = edNumber(signature.slice(32));
if (!A || !R || s >= e.q) return false;
var challenge = edHashToScalar(signature.slice(0, 32).concat(publicBytes, message));
var left = edMul(e.base, s);
var right = edAdd(R, edMul(A, challenge));
return e.mod(left[0] * right[2] - right[0] * left[2]) === e.zero && e.mod(left[1] * right[2] - right[1] * left[2]) === e.zero;
}
function hexToByteList(hex) {
var out = [];
for (var i = 0; i < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
return out;
}
function activationMessage(device) {
return ('MoneyCode-activation-1:' + plainCode(device)).split('').map(function (c) { return c.charCodeAt(0); });
}
function timedActivationMessage(device, expiresISO, tier) {
var suffix = (tier === 'B' || tier === 'C') ? (':' + tier) : '';
return ('MoneyCode-activation-2:' + plainCode(device) + ':' + expiresISO + suffix).split('').map(function (c) { return c.charCodeAt(0); });
}
function bookRegionalTier() {
var cur = String((state && state.settings && state.settings.currency) || BASE || 'SAR').toUpperCase();
var locale = String((state && state.settings && state.settings.language) || 'ar-SA');
if (cur === 'YER' || cur === 'EGP' || cur === 'SDG' || cur === 'SYP' || cur === 'INR' || /^ar-(YE|EG)|^hi-|^en-IN|^fr-SN/i.test(locale)) {
return 'C';
}
if (cur === 'DZD' || cur === 'MAD' || cur === 'TND' || cur === 'JOD' || cur === 'IQD' || /^ar-(DZ|MA)|^zh-(MY|TW|CN)|^es-(MX|AR|CO|DO)|^fr-CA/i.test(locale)) {
return 'B';
}
return 'A';
}
function licenseTierAllowedOnBook(codeTier) {
if (!codeTier || codeTier === 'A') return true;
var bookTier = bookRegionalTier();
if (codeTier === 'B') return bookTier === 'B' || bookTier === 'C';
if (codeTier === 'C') return bookTier === 'C';
return true;
}
function isTimedPrefix(ch) {
return ch === 'T' || ch === 'U' || ch === 'V';
}
function tierFromPrefix(ch) {
return ch === 'V' ? 'C' : (ch === 'U' ? 'B' : 'A');
}
function prefixFromTier(tier) {
var t = String(tier || 'A').toUpperCase();
return t === 'C' ? 'V' : (t === 'B' ? 'U' : 'T');
}
function promoActivationMessage(campaign4, days, validUntilISO) {
return ('MoneyCode-promo-1:' + campaign4 + ':' + days + ':' + validUntilISO).split('').map(function (c) { return c.charCodeAt(0); });
}
function encodeNumToCode(num, len) {
var n = Math.max(0, Math.floor(Number(num) || 0));
var out = '';
for (var i = len - 1; i >= 0; i--) out += CODE_LETTERS.charAt((n >>> (i * 5)) & 31);
return out;
}
function decodeCodeToNum(str) {
var n = 0;
for (var i = 0; i < str.length; i++) {
var idx = CODE_LETTERS.indexOf(str.charAt(i));
if (idx < 0) return -1;
n = (n << 5) | idx;
}
return n;
}
function dateToCode4(iso) {
return encodeNumToCode(daysBetween(LICENSE_EPOCH, iso), 4);
}
function code4ToDate(c4) {
if (!c4 || c4.length !== 4) return null;
var d = decodeCodeToNum(c4);
return d < 0 ? null : addDays(LICENSE_EPOCH, d);
}
function normalizeCampaign4(raw) {
var map = { '0': '2', '1': '3', 'O': 'P', 'I': 'J' };
var clean = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/[01OI]/g, function (c) { return map[c] || 'A'; });
return (clean + 'AAAA').slice(0, 4);
}
function codeFromBytes(bytes) {
var out = '', bits = 0, value = 0;
bytes.forEach(function (byte) {
value = (value << 8) | byte;
bits += 8;
while (bits >= 5) {
out += CODE_LETTERS.charAt((value >>> (bits - 5)) & 31);
bits -= 5;
}
value &= (1 << bits) - 1;
});
return bits ? out + CODE_LETTERS.charAt((value << (5 - bits)) & 31) : out;
}
function bytesFromCode(code) {
if (code.length !== 103) return null;
var out = [], bits = 0, value = 0;
for (var i = 0; i < code.length; i++) {
var digit = CODE_LETTERS.indexOf(code.charAt(i));
if (digit < 0) return null;
value = (value << 5) | digit;
bits += 5;
if (bits >= 8) {
out.push((value >>> (bits - 8)) & 255);
bits -= 8;
}
value &= (1 << bits) - 1;
}
return value === 0 ? out : null;
}
function revokedList() {
var sList = (state && state.settings && Array.isArray(state.settings.revokedCodes)) ? state.settings.revokedCodes : [];
var lList = [];
try { lList = JSON.parse(storageGet(REVOKED_KEY) || '[]'); if (!Array.isArray(lList)) lList = []; } catch (e) { lList = []; }
var out = [];
sList.concat(lList).forEach(function (h) { if (h && out.indexOf(h) < 0) out.push(h); });
return out;
}
function isCodeRevoked(code) {
var clean = plainCode(code);
if (!clean) return false;
var h = sha256Hex(clean);
return revokedList().indexOf(h) >= 0;
}
function rememberRevokedCode(code) {
var clean = plainCode(code);
if (!clean) return;
var h = sha256Hex(clean);
var list = revokedList();
if (list.indexOf(h) < 0) list.unshift(h);
if (state && state.settings) state.settings.revokedCodes = list;
storageSet(REVOKED_KEY, JSON.stringify(list));
activationChecked = { key: null, ok: false };
restoreChecked = { key: null, ok: false };
}
function usedPromosList() {
var sList = (state && state.settings && Array.isArray(state.settings.usedPromos)) ? state.settings.usedPromos : [];
var lList = [];
try { lList = JSON.parse(storageGet(USED_PROMOS_KEY) || '[]'); if (!Array.isArray(lList)) lList = []; } catch (e) { lList = []; }
var out = [];
sList.concat(lList).forEach(function (p) { if (p && out.indexOf(p) < 0) out.push(p); });
return out;
}
function rememberUsedPromo(campaign) {
var c = normalizeCampaign4(campaign);
var list = usedPromosList();
if (list.indexOf(c) < 0) list.push(c);
if (state && state.settings) state.settings.usedPromos = list;
storageSet(USED_PROMOS_KEY, JSON.stringify(list));
}
var CODE_LENGTH = 103;
var TIMED_CODE_LENGTH = 108;
var PROMO_CODE_LENGTH = 114;
function verifyOwnerPublicKeyIntegrity() {
if (root.RohDevice && typeof root.RohDevice.genuine === 'function' && !root.RohDevice.genuine()) return false;
if (typeof ACTIVATION_PUBLIC_KEY !== 'string' || ACTIVATION_PUBLIC_KEY.length !== 64) return false;
var b0 = parseInt(ACTIVATION_PUBLIC_KEY.slice(0, 2), 16);
var b31 = parseInt(ACTIVATION_PUBLIC_KEY.slice(62, 64), 16);
return b0 === 0x6a && b31 === 0x4b && sha256Hex('MoneyCode-pk:' + ACTIVATION_PUBLIC_KEY).slice(0, 16) === PUBLIC_KEY_FINGERPRINT;
}
function parseActivationCode(code, deviceText) {
var clean = plainCode(code);
var device = plainCode(deviceText || deviceCode());
if (!clean || !device || !verifyOwnerPublicKeyIntegrity()) return { ok: false };
if (isCodeRevoked(clean)) return { ok: false, revoked: true, code: clean };
try {
var pub = hexToByteList(ACTIVATION_PUBLIC_KEY);
if (clean.length === CODE_LENGTH) {
var sig = bytesFromCode(clean);
var ok1 = !!sig && edVerify(pub, activationMessage(device), sig);
return ok1 ? { ok: true, kind: 'lifetime', code: clean, expiresAt: null } : { ok: false, code: clean };
}
if (clean.length === TIMED_CODE_LENGTH && isTimedPrefix(clean.charAt(0))) {
var cTier = tierFromPrefix(clean.charAt(0));
var expISO = code4ToDate(clean.slice(1, 5));
var sigT = bytesFromCode(clean.slice(5));
if (!expISO || !sigT) return { ok: false, code: clean };
var okT = edVerify(pub, timedActivationMessage(device, expISO, cTier), sigT);
return okT ? { ok: true, kind: 'annual', tier: cTier, code: clean, expiresAt: expISO } : { ok: false, code: clean };
}
if (clean.length === PROMO_CODE_LENGTH && clean.charAt(0) === 'P') {
var campaign = clean.slice(1, 5);
var days = decodeCodeToNum(clean.slice(5, 7));
var validUntil = code4ToDate(clean.slice(7, 11));
var sigP = bytesFromCode(clean.slice(11));
if (!campaign || days <= 0 || !validUntil || !sigP) return { ok: false, code: clean };
var okP = edVerify(pub, promoActivationMessage(campaign, days, validUntil), sigP);
return okP ? { ok: true, kind: 'promo', code: clean, campaign: campaign, days: days, validUntil: validUntil } : { ok: false, code: clean };
}
} catch (e) {
return { ok: false, code: clean };
}
return { ok: false, code: clean };
}
var activationChecked = { key: null, ok: false };
function activationValid(code) {
var clean = plainCode(code);
if (!clean || isCodeRevoked(clean)) return false;
var device = plainCode(deviceCode());
var today = todayISO();
var clockBack = isClockRolledBack(today);
var bTier = bookRegionalTier();
var key = device + ':' + clean + ':' + today + ':' + (clockBack ? '1' : '0') + ':' + bTier;
if (activationChecked.key === key) return activationChecked.ok;
var parsed = parseActivationCode(clean, device);
var ok = false;
if (parsed.ok) {
if (parsed.kind === 'lifetime') {
ok = true;
} else if (parsed.kind === 'annual' && parsed.expiresAt) {
ok = !clockBack && licenseTierAllowedOnBook(parsed.tier) && today <= addDays(parsed.expiresAt, SUBSCRIPTION_GRACE_DAYS);
}
}
activationChecked = { key: key, ok: ok };
return ok;
}
function activeLicenseMeta() {
var code = storageGet(ACTIVATION_KEY) || '';
if (!code && state && state.settings && (state.settings.activationCodes || []).length) {
activationFromBooks();
code = storageGet(ACTIVATION_KEY) || '';
}
if (!code) return null;
var parsed = parseActivationCode(code);
return parsed && parsed.ok ? parsed : null;
}
var ACTIVATION_CODES_MAX = 10;
function rememberActivationCode(code) {
if (!state || !code) return;
var list = (state.settings.activationCodes || []).filter(function (c) { return c && c !== code; });
list.unshift(code);
state.settings.activationCodes = list.slice(0, ACTIVATION_CODES_MAX);
}
function mergeActivationCodes(a, b) {
var out = [];
(a || []).concat(b || []).forEach(function (c) { c = plainCode(c); if (c && out.indexOf(c) < 0) out.push(c); });
return out.slice(0, ACTIVATION_CODES_MAX);
}
var restoreChecked = { key: null, ok: false };
function activationFromBooks() {
var list = (state && state.settings && state.settings.activationCodes) || [];
if (!list.length) return false;
var key = plainCode(deviceCode()) + '|' + list.join(',') + '|' + todayISO() + '|' + revokedList().join(',');
if (restoreChecked.key === key) return restoreChecked.ok;
var found = list.filter(function (c) { return activationValid(c); })[0] || null;
if (found) storageSet(ACTIVATION_KEY, found);
restoreChecked = { key: key, ok: !!found };
return !!found;
}
function isActivated() {
return !!root.RohOwner || activationValid(storageGet(ACTIVATION_KEY) || '') || activationFromBooks();
}
function activationCodeHere() {
return storageGet(ACTIVATION_KEY) || '';
}
function activationValidFor(deviceText, code) {
var device = plainCode(deviceText);
if (!device || !code) return false;
var parsed = parseActivationCode(code, device);
if (!parsed.ok) return false;
if (parsed.kind === 'annual' && parsed.expiresAt) {
return todayISO() <= addDays(parsed.expiresAt, SUBSCRIPTION_GRACE_DAYS);
}
return parsed.kind === 'lifetime';
}
function ownerActivationCode(device, opts) {
if (!root.RohOwner) return { ok: false, error: 'غير متاح في هذه النسخة' };
var seed = root.RohOwner.signingKey ? String(root.RohOwner.signingKey()) : '';
if (!/^[0-9a-f]{64}$/.test(seed)) return { ok: false, error: 'مفتاح التوقيع غير موجود في هذه النسخة' };
if (opts && opts.promo) {
var campaign4 = normalizeCampaign4(opts.promo);
var days = Math.max(1, Math.min(1023, Number(opts.days) || 14));
var validUntil = (opts.validUntil && isValidDate(opts.validUntil)) ? opts.validUntil : addDays(todayISO(), 90);
var pSig = codeFromBytes(edSign(hexToByteList(seed), promoActivationMessage(campaign4, days, validUntil)));
var pFull = 'P' + campaign4 + encodeNumToCode(days, 2) + dateToCode4(validUntil) + pSig;
return { ok: true, kind: 'promo', campaign: campaign4, days: days, validUntil: validUntil, code: groupCode(pFull) };
}
var plain = plainCode(device);
if (plain.length !== 8 && plain.length !== 12) return { ok: false, error: 'رمز الجهاز غير صحيح: الطول ' + plain.length + ' (يجب 8 أو 12)' };
var bad = '';
for (var i = 0; i < plain.length; i++) { if (CODE_LETTERS.indexOf(plain.charAt(i)) < 0) { bad = plain.charAt(i); break; } }
if (bad) return { ok: false, error: 'رمز الجهاز غير صحيح: حرف غير مسموح "' + bad + '"' };
if (opts && (opts.expiresAt || opts.days)) {
var expISO = (opts.expiresAt && isValidDate(opts.expiresAt)) ? opts.expiresAt : addDays(todayISO(), Math.max(1, Number(opts.days) || 365));
var rTier = (opts.tier === 'B' || opts.tier === 'C') ? opts.tier : 'A';
var tSig = codeFromBytes(edSign(hexToByteList(seed), timedActivationMessage(plain, expISO, rTier)));
var tFull = prefixFromTier(rTier) + dateToCode4(expISO) + tSig;
return { ok: true, kind: 'annual', tier: rTier, device: groupCode(plain), expiresAt: expISO, code: groupCode(tFull) };
}
return { ok: true, kind: 'lifetime', device: groupCode(plain), code: groupCode(codeFromBytes(edSign(hexToByteList(seed), activationMessage(plain)))) };
}
function checkActivationInput(text) {
var t = String(text == null ? '' : text)
.replace(/[٠-٩]/g, function (d) { return AR_DIGITS[d]; })
.replace(/[​-‏‪-‮⁦-⁩﻿]/g, '')
.toUpperCase();
var runs = t.match(/[A-Z0-9]+(?:[\s\-_.]+[A-Z0-9]+)*/g) || [];
var best = '';
runs.forEach(function (r) {
var joined = r.replace(/[\s\-_.]+/g, '');
if ((joined.length === TIMED_CODE_LENGTH && isTimedPrefix(joined.charAt(0))) ||
(joined.length === PROMO_CODE_LENGTH && joined.charAt(0) === 'P')) {
best = joined;
} else if (best.length !== TIMED_CODE_LENGTH && best.length !== PROMO_CODE_LENGTH) {
if (Math.abs(joined.length - CODE_LENGTH) < Math.abs(best.length - CODE_LENGTH)) best = joined;
}
});
if (!best) return { ok: false, error: 'الصق رمز التفعيل' };
var bad = best.split('').filter(function (c) { return CODE_LETTERS.indexOf(c) < 0; });
if (!bad.length && best.length === TIMED_CODE_LENGTH && isTimedPrefix(best.charAt(0))) {
if (isCodeRevoked(best)) return { ok: false, code: best, revoked: true, error: 'تم إبطال هذا الرمز مسبقاً بناءً على طلب استرجاع أو نقل رخصة.' };
var parsedT = parseActivationCode(best);
if (!parsedT.ok) return { ok: false, code: best, error: 'الرمز لا يخص هذا الجهاز. تأكد أنه صادر لرمز جهازك ' + deviceCode() };
if (!licenseTierAllowedOnBook(parsedT.tier)) {
return { ok: false, code: best, tierMismatch: true, error: 'هذه الرخصة الإقليمية المدعومة (الفئة ' + parsedT.tier + ') مخصصة للعملات المدعومة ولا تعمل على فئة دفترك الحالية (' + bookRegionalTier() + ').' };
}
if (isClockRolledBack()) return { ok: false, code: best, error: 'تاريخ الجهاز غير متطابق مع تسلسل دفاترك. يرجى ضبط تاريخ الهاتف لتفعيل الرخصة.' };
if (todayISO() > addDays(parsedT.expiresAt, SUBSCRIPTION_GRACE_DAYS)) return { ok: false, code: best, expired: true, error: 'انتهت صلاحية رمز التفعيل في ' + parsedT.expiresAt };
return { ok: true, code: best, kind: 'annual', tier: parsedT.tier, expiresAt: parsedT.expiresAt };
}
if (!bad.length && best.length === PROMO_CODE_LENGTH && best.charAt(0) === 'P') {
var parsedP = parseActivationCode(best);
if (!parsedP.ok) return { ok: false, code: best, error: 'الرمز الترويجي غير صحيح' };
if (isClockRolledBack()) return { ok: false, code: best, error: 'تاريخ الجهاز غير متطابق مع تسلسل دفاترك. يرجى ضبط تاريخ الهاتف لتفعيل العرض.' };
if (todayISO() > parsedP.validUntil) return { ok: false, code: best, expired: true, error: 'انتهت صلاحية العرض الترويجي في ' + parsedP.validUntil };
if (usedPromosList().indexOf(parsedP.campaign) >= 0) return { ok: false, code: best, used: true, error: 'تم استخدام هذا العرض الترويجي مسبقاً على هذا الجهاز' };
return { ok: true, code: best, kind: 'promo', campaign: parsedP.campaign, days: parsedP.days, validUntil: parsedP.validUntil, expiresAt: addDays(todayISO(), parsedP.days) };
}
if (best.length > CODE_LENGTH) {
var candidateLengths = [PROMO_CODE_LENGTH, TIMED_CODE_LENGTH, CODE_LENGTH];
for (var cl = 0; cl < candidateLengths.length; cl++) {
var len = candidateLengths[cl];
if (best.length <= len) continue;
var ends = [best.slice(-len), best.slice(0, len)];
for (var e = 0; e < ends.length; e++) {
var cand = ends[e];
var whole = cand.split('').every(function (c) { return CODE_LETTERS.indexOf(c) >= 0; });
if (!whole) continue;
if (len === CODE_LENGTH && activationValid(cand)) return { ok: true, code: cand, kind: 'lifetime' };
if (len === TIMED_CODE_LENGTH && isTimedPrefix(cand.charAt(0)) && activationValid(cand)) {
var pt = parseActivationCode(cand);
return { ok: true, code: cand, kind: 'annual', tier: pt.tier, expiresAt: pt.expiresAt };
}
if (len === PROMO_CODE_LENGTH && cand.charAt(0) === 'P') {
var pp = parseActivationCode(cand);
if (pp.ok && !isClockRolledBack() && todayISO() <= pp.validUntil && usedPromosList().indexOf(pp.campaign) < 0) {
return { ok: true, code: cand, kind: 'promo', campaign: pp.campaign, days: pp.days, validUntil: pp.validUntil, expiresAt: addDays(todayISO(), pp.days) };
}
}
}
}
}
if (bad.length) {
return { ok: false, code: best, error: 'حرف لا يُستخدم في رموز التفعيل: ' + bad.filter(function (c, i, all) { return all.indexOf(c) === i; }).join('، ') + ' (الرموز لا تحتوي على O و0 وI و1)' };
}
if (best.length < CODE_LENGTH) return { ok: false, code: best, error: 'الرمز ناقص: ' + best.length + ' من ' + CODE_LENGTH + ' حرفاً' };
if (best.length > CODE_LENGTH) return { ok: false, code: best, error: 'الرمز أطول من اللازم: ' + best.length + ' من ' + CODE_LENGTH };
if (isCodeRevoked(best)) return { ok: false, code: best, revoked: true, error: 'تم إبطال هذا الرمز مسبقاً بناءً على طلب استرجاع أو نقل رخصة.' };
if (!activationValid(best)) return { ok: false, code: best, error: 'الرمز لا يخص هذا الجهاز. تأكد أنه صادر لرمز جهازك ' + deviceCode() };
return { ok: true, code: best, kind: 'lifetime' };
}
function activateApp(input) {
var checked = checkActivationInput(input);
if (!checked.ok) return { ok: false, error: checked.error };
recordSeenDate(todayISO());
if (checked.kind === 'promo') {
rememberUsedPromo(checked.campaign);
if (state && state.settings) {
state.settings.plan = {
id: 'annual',
expiresAt: checked.expiresAt,
promoCampaign: checked.campaign,
activatedAt: todayISO(),
entriesAtActivation: entriesThisMonth()
};
}
saveState();
return { ok: true, kind: 'promo', campaign: checked.campaign, days: checked.days, expiresAt: checked.expiresAt };
}
storageSet(ACTIVATION_KEY, checked.code);
rememberActivationCode(checked.code);
if (state && state.settings) {
if (checked.kind === 'annual' && checked.expiresAt) {
state.settings.plan = {
id: 'annual',
expiresAt: checked.expiresAt,
activatedAt: todayISO(),
entriesAtActivation: entriesThisMonth()
};
} else {
state.settings.activatedAt = todayISO();
state.settings.entriesAtActivation = entriesThisMonth();
}
}
saveState();
return { ok: true, kind: checked.kind || 'lifetime', expiresAt: checked.expiresAt || null };
}
function refundReceiptFor(deviceText, codeText) {
var dev = plainCode(deviceText);
var c = plainCode(codeText);
return 'REFUND-' + dev.slice(0, 4) + '-' + sha256Hex('MoneyCode-refund-1:' + dev + ':' + c).slice(0, 8);
}
function verifyRefundReceipt(deviceText, codeText, receiptText) {
var dev = plainCode(deviceText);
var c = plainCode(codeText);
var r = String(receiptText || '').trim().toUpperCase();
if (!dev || !c || !r) return false;
return r === refundReceiptFor(dev, c);
}
function revokeLicenseForRefund() {
if (!isActivated()) return { ok: false, error: 'لا توجد رخصة مفعّلة لإلغائها.' };
var code = storageGet(ACTIVATION_KEY) || ((state && state.settings && state.settings.activationCodes && state.settings.activationCodes[0]) || '');
if (!code) return { ok: false, error: 'لم يُعثر على رمز التفعيل في هذا الجهاز.' };
var actDate = (state && state.settings && (state.settings.activatedAt || (state.settings.plan && state.settings.plan.activatedAt))) || null;
if (actDate && isValidDate(actDate) && daysBetween(actDate, todayISO()) > REFUND_WINDOW_DAYS) {
return { ok: false, error: 'تجاوزت الرخصة مهلة ضمان الاسترجاع (' + REFUND_WINDOW_DAYS + ' أيام).' };
}
var baseEntries = Number(state && state.settings && (state.settings.entriesAtActivation != null ? state.settings.entriesAtActivation : (state.settings.plan && state.settings.plan.entriesAtActivation))) || 0;
if (entriesThisMonth() - baseEntries > REFUND_FAIR_USE_ENTRIES) {
return { ok: false, error: 'تجاوز الاستخدام سقف الاسترجاع العادل (' + REFUND_FAIR_USE_ENTRIES + ' قيداً).' };
}
var clean = plainCode(code);
var receipt = refundReceiptFor(deviceCode(), clean);
rememberRevokedCode(clean);
storageRemove(ACTIVATION_KEY);
if (state && state.settings) {
state.settings.activationCodes = (state.settings.activationCodes || []).filter(function (x) { return plainCode(x) !== clean; });
state.settings.plan = { id: 'free', expiresAt: null };
}
saveState();
return { ok: true, receipt: receipt, device: deviceCode() };
}
function transferCertificateFor(oldDevText, newDevText, codeText, expTag) {
var oldD = plainCode(oldDevText);
var newD = plainCode(newDevText);
var c = plainCode(codeText);
var tag = String(expTag || 'LIFETIME').replace(/-/g, '');
var sig8 = sha256Hex('MoneyCode-transfer-1:' + oldD + ':' + newD + ':' + c + ':' + tag).slice(0, 8);
return 'TRANSFER-' + oldD.slice(0, 4) + '-' + newD.slice(0, 4) + '-' + tag + '-' + sig8;
}
function verifyTransferCertificate(oldDevText, newDevText, codeText, expTag, certText) {
var cert = String(certText || '').trim().toUpperCase();
if (!cert) return false;
return cert === transferCertificateFor(oldDevText, newDevText, codeText, expTag);
}
function transferLicense(newDeviceInput) {
if (!isActivated()) return { ok: false, error: 'لا توجد رخصة مفعّلة لنقلها.' };
var newPlain = plainCode(newDeviceInput);
if (newPlain.length !== 8 && newPlain.length !== 12) return { ok: false, error: 'رمز الجهاز الجديد غير صحيح (يجب أن يتكون من 12 حرفاً).' };
for (var i = 0; i < newPlain.length; i++) {
if (CODE_LETTERS.indexOf(newPlain.charAt(i)) < 0) return { ok: false, error: 'رمز الجهاز الجديد يحتوي على حرف غير مسموح: ' + newPlain.charAt(i) };
}
var oldPlain = plainCode(deviceCode());
if (newPlain === oldPlain) return { ok: false, error: 'رمز الجهاز الجديد مطابق لرمز هذا الجهاز الحالي.' };
var code = storageGet(ACTIVATION_KEY) || ((state && state.settings && state.settings.activationCodes && state.settings.activationCodes[0]) || '');
if (!code) return { ok: false, error: 'لم يُعثر على رمز التفعيل لنقله.' };
var clean = plainCode(code);
var parsed = parseActivationCode(clean, oldPlain);
var expTag = (parsed && parsed.expiresAt) || (state && state.settings && state.settings.plan && state.settings.plan.expiresAt) || 'LIFETIME';
var cert = transferCertificateFor(oldPlain, newPlain, clean, expTag);
rememberRevokedCode(clean);
storageRemove(ACTIVATION_KEY);
if (state && state.settings) {
state.settings.activationCodes = (state.settings.activationCodes || []).filter(function (x) { return plainCode(x) !== clean; });
state.settings.plan = { id: 'free', expiresAt: null };
}
saveState();
return {
ok: true,
certificate: cert,
oldDevice: deviceCode(),
newDevice: groupCode(newPlain),
expiresAt: expTag === 'LIFETIME' ? null : expTag
};
}
function foreignLicenseInBooks() {
if (isActivated()) return { found: false };
var list = (state && state.settings && state.settings.activationCodes) || [];
for (var i = 0; i < list.length; i++) {
var c = plainCode(list[i]);
if (!c || isCodeRevoked(c)) continue;
var validShape = (c.length === CODE_LENGTH && !!bytesFromCode(c)) ||
(c.length === TIMED_CODE_LENGTH && c.charAt(0) === 'T' && !!bytesFromCode(c.slice(5)));
if (validShape && !activationValid(c)) {
var proof = 'RECOVERY-' + plainCode(deviceCode()).slice(0, 4) + '-' + sha256Hex('MoneyCode-recovery-1:' + plainCode(deviceCode()) + ':' + c).slice(0, 8);
return {
found: true,
codeHint: c.slice(0, 4) + '…' + c.slice(-4),
recoveryCode: proof,
newDevice: deviceCode()
};
}
}
return { found: false };
}
function featureTrialLeft(feature) {
if (planAllows(feature)) return null;
var limit = FEATURE_TRIAL_LIMITS[feature] || 0;
if (!limit) return 0;
var trials = (state && state.settings && state.settings.featureTrials) || {};
var used = Math.max(0, Math.floor(Number(trials[feature]) || 0));
return Math.max(0, limit - used);
}
function useFeatureTrial(feature) {
if (planAllows(feature)) return { ok: true, unlimited: true };
var left = featureTrialLeft(feature);
if (!left || left <= 0) {
return { ok: false, limited: true, remaining: 0, error: 'استنفدت التجارب المجانية لهذه الميزة. رقِّ حسابك لفتحها بلا حدود.' };
}
if (!state.settings.featureTrials || typeof state.settings.featureTrials !== 'object') state.settings.featureTrials = {};
state.settings.featureTrials[feature] = (Number(state.settings.featureTrials[feature]) || 0) + 1;
if (feature === 'multiCurrency') {
state.settings.trialPassMultiCurrency = (Number(state.settings.trialPassMultiCurrency) || 0) + 1;
}
saveState();
return { ok: true, trial: true, remaining: left - 1 };
}
function resetFeatureTrials() {
if (state && state.settings) {
state.settings.featureTrials = {};
state.settings.trialPassMultiCurrency = 0;
saveState();
}
}
var PROMO_DISCOUNTS = {
RAMADAN30: { pct: 30, label: 'خصم رمضان 30%' },
EID25: { pct: 25, label: 'عيدية موني كود 25%' },
STUDENT50: { pct: 50, label: 'خصم الطلاب 50%' },
AHMED20: { pct: 20, label: 'خصم المندوب 20%' },
WELCOME15: { pct: 15, label: 'خصم الترحيب 15%' },
PARTNER50: { pct: 50, label: 'رخصة الجهاز الإضافي 50%' }
};
function getPricingOffer(opts) {
opts = opts || {};
var cur = String(opts.currency || (state && state.settings && state.settings.currency) || BASE).toUpperCase();
var locale = String(opts.locale || (state && state.settings && state.settings.language) || 'ar-SA');
var persona = String(opts.persona || getPersona() || 'general');
var today = isValidDate(opts.today) ? opts.today : todayISO();
var promoInput = String(opts.promoCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
var tier = 'A';
if (cur === 'YER' || cur === 'EGP' || /^ar-(YE|EG)|^hi-|^en-IN|^fr-SN/i.test(locale)) {
tier = 'C';
} else if (/^ar-(DZ|MA)|^zh-(MY|TW|CN)|^es-(MX|AR|CO|DO)|^fr-CA/i.test(locale)) {
tier = 'B';
}
var baseAnnual = tier === 'C' ? 39 : (tier === 'B' ? 59 : 99);
var baseLifetime = tier === 'C' ? 129 : (tier === 'B' ? 199 : 349);
var storeAnnual = tier === 'C' ? 49 : (tier === 'B' ? 69 : 119);
var storeLifetime = tier === 'C' ? 149 : (tier === 'B' ? 229 : 399);
var discountPct = 0;
var offerLabel = null;
var month = Number(today.slice(5, 7));
var day = Number(today.slice(8, 10));
if ((month === 12 && day >= 20) || (month === 1 && day <= 10)) {
discountPct = 25;
offerLabel = 'عرض إقفال السنة المالية (خصم 25%)';
} else if (month === 11 && day >= 10 && day <= 30) {
discountPct = 25;
offerLabel = 'عرض موسم نوفمبر (خصم 25%)';
} else if ((month === 3 || month === 4) && /^ar-/.test(locale)) {
discountPct = 25;
offerLabel = 'عرض الموسم السنوي (خصم 25%)';
}
var info = getPlanInfo();
if (info.expiresAt && daysBetween(today, info.expiresAt) <= 14 && daysBetween(today, info.expiresAt) >= -SUBSCRIPTION_GRACE_DAYS) {
if (25 >= discountPct) {
discountPct = 25;
offerLabel = 'خصم تجديد الولاء (25%)';
}
}
if (persona === 'student' && 50 > discountPct) {
discountPct = 50;
offerLabel = 'خصم باقة الطالب (50%)';
}
var promoValid = false;
if (promoInput) {
if (PROMO_DISCOUNTS[promoInput]) {
promoValid = true;
if (PROMO_DISCOUNTS[promoInput].pct >= discountPct) {
discountPct = PROMO_DISCOUNTS[promoInput].pct;
offerLabel = PROMO_DISCOUNTS[promoInput].label;
}
} else if (/^[A-Z2-9]{6,8}$/.test(promoInput) && promoInput !== plainCode(deviceCode()).slice(0, promoInput.length)) {
promoValid = true;
if (15 > discountPct) {
discountPct = 15;
offerLabel = 'خصم دعوة صديق (15%)';
}
}
}
var finalAnnual = Math.max(15, Math.round(baseAnnual * (100 - discountPct) / 100));
var finalLifetime = Math.max(49, Math.round(baseLifetime * (100 - (persona === 'student' ? 25 : discountPct)) / 100));
return {
tier: tier,
currency: 'SAR',
locale: locale,
persona: persona,
baseAnnual: baseAnnual,
finalAnnual: finalAnnual,
storeAnnual: storeAnnual,
baseLifetime: baseLifetime,
finalLifetime: finalLifetime,
storeLifetime: storeLifetime,
discountPct: discountPct,
offerLabel: offerLabel,
promoCode: promoValid ? promoInput : null,
promoValid: promoInput ? promoValid : null
};
}
function entryLimitApplies() {
if (LIMITS_ENFORCED && !PLANS[activePlanId()].features.unlimitedEntries && !isActivated()) return true;
return ENTRY_LIMIT_ENFORCED && !isActivated() && !PLANS[activePlanId()].features.unlimitedEntries;
}
function checkDraftAllowed(draft) {
if (draft.sourceEntryId || isSettlement(draft.kind)) return { ok: true };
if (!planAllows('multiCurrency')) {
var foreign = draft.currency !== BASE || (draft.lines || []).some(function (l) { return l.currency !== BASE; });
if (foreign) {
var trialPass = Number(state && state.settings && state.settings.trialPassMultiCurrency) || 0;
if (trialPass <= 0) {
return { ok: false, limited: true, reason: 'currency', trialLeft: featureTrialLeft('multiCurrency'), error: 'القيود بعملات أخرى متاحة في خطة برو.' };
}
}
}
if (entryLimitApplies() && entriesThisMonth() >= FREE_MONTHLY_ENTRIES) {
return { ok: false, limited: true, reason: 'entryLimit', error: 'وصلت إلى حد ' + FREE_MONTHLY_ENTRIES + ' قيد لهذا الشهر.' };
}
return { ok: true };
}
var onEntryConfirmed = null;
function setOnEntryConfirmed(fn) { onEntryConfirmed = (typeof fn === 'function') ? fn : null; }
function suggestDueDate(entry, draft) {
if (entry.counterparty) {
var prevItems = (getState().dueItems || []).filter(function (d) { return d.counterparty === entry.counterparty && d.dueDate; });
if (prevItems.length) {
var totalDays = 0, cnt = 0;
prevItems.forEach(function (d) {
var e = (getState().entries || []).filter(function (x) { return x.id === d.entryId; })[0];
if (e && e.date && d.dueDate) { totalDays += daysBetween(e.date, d.dueDate); cnt++; }
});
if (cnt > 0) {
var avgDays = Math.round(totalDays / cnt);
if (avgDays > 0) return addDays(entry.date, avgDays);
}
}
}
return addDays(entry.date, (getState().settings && getState().settings.defaultDueDays) || 3);
}
function getOrCreateCounterparty(name) {
if (!name) return null;
var norm = normalizeAr(String(name)).trim();
if (!norm) return null;
var existing = (state.counterparties || []).filter(function (c) { return normalizeAr(c.name || '') === norm; })[0];
if (existing) return existing.id;
var id = uid('cp');
(state.counterparties || []).push({ id: id, name: String(name).trim(), phone: null, email: null, address: null, notes: null, type: 'other' });
return id;
}
function confirmDraft(id) {
var draft = findDraft(id);
if (!draft) return { ok: false, error: 'القيد المقترح غير موجود' };
var check = validateLines(draft.lines);
if (!check.ok) return { ok: false, error: check.error };
var allowed = checkDraftAllowed(draft);
if (!allowed.ok) return allowed;
if (!draft.sourceEntryId && !isSettlement(draft.kind) && !planAllows('multiCurrency')) {
var isForeign = draft.currency !== BASE || (draft.lines || []).some(function (l) { return l.currency !== BASE; });
if (isForeign && state && state.settings && state.settings.trialPassMultiCurrency > 0) {
state.settings.trialPassMultiCurrency = Math.max(0, Number(state.settings.trialPassMultiCurrency) - 1);
}
}
recordSeenDate(todayISO());
var settleAlloc = null;
if (isSettlement(draft.kind) && !draft.isCompound) {
var recorded = {};
((draft.fx && draft.fx.allocations) || []).forEach(function (a) { recorded[a.dueId] = a; });
var curOf = {};
state.dueItems.forEach(function (d) { if (recorded[d.id]) curOf[d.currency || BASE] = recorded[d.id].cur; });
var payLine = draft.lines.filter(function (l) {
return l.accountId !== 'fx_gain' && l.accountId !== 'fx_loss' && (draft.kind === 'collect' ? l.debitBase > 0 : l.creditBase > 0);
})[0];
if (payLine && payLine.currency && payLine.currency !== BASE && !curOf[payLine.currency]) curOf[payLine.currency] = lineRate(payLine);
var paidBase = draft.fx ? draft.fx.paidBase : (Number(payLine && (payLine.debitBase || payLine.creditBase)) || 0);
settleAlloc = allocateSettlement(draft.kind, draft.counterparty, paidBase,
function (code) { return curOf[code] || getRate(code); }, draft.sourceEntryId || null);
if (settleAlloc.fxBase !== entryFx(draft)) return { ok: false, stale: true, error: 'تغيّرت الديون المفتوحة منذ إعداد هذا القيد. اكتبه من جديد.' };
}
var entry = {
id: uid('entry'),
date: draft.date,
dueDate: draft.dueDate || null,
kind: draft.kind,
currency: draft.currency,
counterparty: draft.counterparty || '',
counterparty_id: getOrCreateCounterparty(draft.counterparty || ''),
memo: draft.memo || '',
lines: draft.lines.map(function (l) {
return {
accountId: l.accountId, currency: l.currency,
debit: l.debit, credit: l.credit,
debitBase: l.debitBase, creditBase: l.creditBase,
rate: lineRate(l),
note: l.note || ''
};
}),
totalBase: settleAlloc ? paidBase : check.totalBase,
createdAt: new Date().toISOString()
};
entry.fraudRisk = detectFraudRisk(draft);
state.entries.push(entry);
try { (entry.lines || []).forEach(function (l) { if (l.accountId) noteAccountUsage(l.accountId); }); } catch (e) {}
try { if (draft && draft.isCompound && typeof noteFeature === 'function') noteFeature('compound'); } catch (e) {}
try {
var hasForeignLine = (draft && draft.currency && draft.currency !== BASE) || (entry.lines || []).some(function (l) { return l.currency && l.currency !== BASE; });
if (hasForeignLine && typeof noteFeature === 'function') noteFeature('multiCurrency');
} catch (e) {}
try {
if (draft && draft.createdAt && typeof noteEntrySpeed === 'function') {
var elapsed = Date.now() - Date.parse(draft.createdAt);
if (elapsed >= 0 && elapsed <= 5000) noteEntrySpeed(elapsed || 1);
}
} catch (e) {}
auditLog('create', 'entry', entry.id, null, entry);
if (entry.kind === 'lend' || entry.kind === 'borrow') {
state.dueItems.push(normalizeDue({
id: uid('due'),
kind: entry.kind === 'lend' ? 'receivable' : 'payable',
counterparty: entry.counterparty || 'غير محدد',
counterparty_id: entry.counterparty_id,
entryId: entry.id,
accountId: draft.contraAccountId || null,
amount: entry.totalBase,
remaining: entry.totalBase,
dueDate: entry.dueDate || suggestDueDate(entry, draft),
defaulted: !entry.dueDate,
settled: false,
createdAt: new Date().toISOString()
}, { currency: draft.currency || BASE, amountMinor: draft.amountMinor }));
} else if (entry.kind === 'collect') {
settleDue('receivable', entry.counterparty, entry.totalBase, entry.id, settleAlloc && settleAlloc.allocations);
} else if (entry.kind === 'repay') {
settleDue('payable', entry.counterparty, entry.totalBase, entry.id, settleAlloc && settleAlloc.allocations);
} else if (entry.kind === 'capital' && !draft.isCompound && entry.counterparty) {
var capRecLine = (entry.lines || []).filter(function (l) {
var a = getAccount(l.accountId);
return l.debitBase > 0 && (l.accountId === 'receivable' || (a && a.type === 'asset' && !a.liquid));
})[0];
var capPayLine = (entry.lines || []).filter(function (l) {
var a = getAccount(l.accountId);
return l.creditBase > 0 && (l.accountId === 'payable' || (a && a.type === 'liability' && !a.liquid));
})[0];
if (capRecLine) {
state.dueItems.push(normalizeDue({
id: uid('due'),
kind: 'receivable',
counterparty: entry.counterparty,
counterparty_id: entry.counterparty_id,
entryId: entry.id,
accountId: capRecLine.accountId,
amount: capRecLine.debitBase,
remaining: capRecLine.debitBase,
dueDate: entry.dueDate || suggestDueDate(entry, draft),
defaulted: !entry.dueDate,
settled: false,
createdAt: new Date().toISOString()
}, { currency: draft.currency || capRecLine.currency || BASE, amountMinor: draft.amountMinor || capRecLine.debit }));
} else if (capPayLine) {
state.dueItems.push(normalizeDue({
id: uid('due'),
kind: 'payable',
counterparty: entry.counterparty,
counterparty_id: entry.counterparty_id,
entryId: entry.id,
accountId: capPayLine.accountId,
amount: capPayLine.creditBase,
remaining: capPayLine.creditBase,
dueDate: entry.dueDate || suggestDueDate(entry, draft),
defaulted: !entry.dueDate,
settled: false,
createdAt: new Date().toISOString()
}, { currency: draft.currency || capPayLine.currency || BASE, amountMinor: draft.amountMinor || capPayLine.credit }));
}
} else if (draft.isCompound) {
draft.lines.forEach(function (l) {
if (l.createDue === 'receivable' && l.debitBase > 0) {
var recParty = l.counterparty || entry.counterparty || 'غير محدد';
state.dueItems.push(normalizeDue({
id: uid('due'),
kind: 'receivable',
counterparty: recParty,
counterparty_id: getOrCreateCounterparty(recParty),
entryId: entry.id,
accountId: l.accountId || 'receivable',
amount: l.debitBase,
remaining: l.debitBase,
dueDate: entry.dueDate || suggestDueDate(entry, draft),
defaulted: !entry.dueDate,
settled: false,
createdAt: new Date().toISOString()
}, { currency: l.currency || draft.currency || BASE, amountMinor: l.debit || l.debitBase }));
return;
}
if (l.createDue === 'payable' && l.creditBase > 0) {
var payParty = l.counterparty || entry.counterparty || 'غير محدد';
state.dueItems.push(normalizeDue({
id: uid('due'),
kind: 'payable',
counterparty: payParty,
counterparty_id: getOrCreateCounterparty(payParty),
entryId: entry.id,
accountId: l.accountId || 'payable',
amount: l.creditBase,
remaining: l.creditBase,
dueDate: entry.dueDate || suggestDueDate(entry, draft),
defaulted: !entry.dueDate,
settled: false,
createdAt: new Date().toISOString()
}, { currency: l.currency || draft.currency || BASE, amountMinor: l.credit || l.creditBase }));
return;
}
var acc = getAccount(l.accountId);
if (!acc || acc.liquid) return;
var person = l.counterparty || (/^acc_/.test(acc.id) ? acc.name : '');
if (!person) return;
if (acc.type === 'liability' && l.debitBase > 0) settleDue('payable', person, l.debitBase, entry.id);
else if (acc.type === 'asset' && l.creditBase > 0) settleDue('receivable', person, l.creditBase, entry.id);
});
}
state.drafts = state.drafts.filter(function (d) { return d.id !== id; });
if (draft.matchedKeyword) noteUsage(draft.matchedKeyword);
learnFromConfirmed(draft.memo, draft.kind, null);
if (vectorMemoryEnabled()) {
var _nonLiquid = (draft.lines || []).filter(function (l) { var a = getAccount(l.accountId); return a && !a.liquid; })[0];
trainVectorMemory({ kind: draft.kind, text: draft.memo, accountId: _nonLiquid ? _nonLiquid.accountId : (draft.contraAccountId || 'expense'), usageCount: 1 });
}
saveState();
if (typeof onEntryConfirmed === 'function') {
try { onEntryConfirmed(entry, id); } catch (e) { log('warn', 'onEntryConfirmed failed', e); }
}
return { ok: true, entry: entry };
}
function canDeleteEntry(id) {
var ownDueIds = state.dueItems
.filter(function (d) { return d.entryId === id; })
.map(function (d) { return d.id; });
var linked = state.settlements.filter(function (s) {
return ownDueIds.indexOf(s.dueId) >= 0;
});
if (linked.length) {
return { ok: false, error: 'لا يمكن حذف هذا القيد لوجود تحصيل أو سداد مرتبط به. احذف قيد التحصيل أولاً.' };
}
return { ok: true };
}
function deleteEntry(id) {
var index = -1;
for (var i = 0; i < state.entries.length; i++) if (state.entries[i].id === id) index = i;
if (index < 0) return { ok: false, error: 'القيد غير موجود' };
var allowed = canDeleteEntry(id);
if (!allowed.ok) return allowed;
var groups = state.settings.moneyGroups || [];
for (var gi = 0; gi < groups.length; gi++) {
var group = groups[gi];
for (var ei = group.expenses.length - 1; ei >= 0; ei--) {
var exp = group.expenses[ei];
if (!Array.isArray(exp.entryIds) || exp.entryIds.indexOf(id) < 0) continue;
exp.entryIds = exp.entryIds.filter(function (x) { return x !== id; });
if (exp.entryIds.length === 0) group.expenses.splice(ei, 1);
}
}
state.settings.moneyGroups = groups;
state.settlements = state.settlements.filter(function (s) {
if (s.entryId !== id) return true;
for (var j = 0; j < state.dueItems.length; j++) {
if (state.dueItems[j].id === s.dueId) {
var due = normalizeDue(state.dueItems[j]);
due.remaining += s.amount;
due.remainingNative += s.native != null ? s.native : (due.rate === 1 ? s.amount : Math.round(s.amount / due.rate));
due.settled = due.remaining <= 0;
}
}
return false;
});
var deletedEntry = state.entries[index];
state.dueItems = state.dueItems.filter(function (d) { return d.entryId !== id; });
state.entries.splice(index, 1);
saveState();
auditLog('delete', 'entry', id, deletedEntry, null);
return { ok: true, entry: deletedEntry };
}
var GROUP_ME = 'me';
function moneyGroups() {
var settings = getState().settings;
if (!Array.isArray(settings.moneyGroups)) settings.moneyGroups = [];
return settings.moneyGroups;
}
function findMoneyGroup(id) {
return moneyGroups().filter(function (g) { return g.id === id; })[0] || null;
}
function groupMember(group, id) {
return group.members.filter(function (m) { return m.id === id; })[0] || null;
}
function createMoneyGroup(input) {
var name = String((input && input.name) || '').trim().slice(0, 40);
if (!name) return { ok: false, error: 'اكتب اسم المجموعة' };
var members = [{ id: GROUP_ME, name: 'أنا', accountId: null }];
var seen = {};
seen[normalizeName('أنا')] = true;
((input && input.members) || []).forEach(function (m, i) {
var memberName = String((m && m.name) || '').trim().slice(0, 40);
var key = normalizeName(memberName);
if (!memberName || seen[key]) return;
seen[key] = true;
members.push({ id: 'm' + (i + 1), name: memberName, accountId: m.accountId && getAccount(m.accountId) ? m.accountId : null });
});
if (members.length < 2) return { ok: false, error: 'أضف عضواً واحداً على الأقل' };
var group = { id: uid('group'), name: name, members: members, expenses: [], settlements: [], createdAt: new Date().toISOString() };
moneyGroups().push(group);
saveState();
return { ok: true, group: group };
}
function deleteMoneyGroup(id) {
var settings = getState().settings;
if (!findMoneyGroup(id)) return { ok: false, error: 'المجموعة غير موجودة' };
settings.moneyGroups = moneyGroups().filter(function (g) { return g.id !== id; });
saveState();
return { ok: true };
}
function equalShares(total, memberIds) {
var shares = {};
var part = Math.floor(total / memberIds.length);
var extra = total - part * memberIds.length;
memberIds.forEach(function (id, i) { shares[id] = part + (i < extra ? 1 : 0); });
return shares;
}
function groupIntent(kind, accountId, contraId, amount, counterparty, memo) {
return {
kind: kind, amountMinor: amount, currency: BASE, accountId: accountId, contraAccountId: contraId,
counterparty: counterparty, memo: memo, date: todayISO(), dueDate: null
};
}
function postGroupDraft(draft) {
state.drafts.push(draft);
var res = confirmDraft(draft.id);
if (!res.ok) state.drafts = state.drafts.filter(function (d) { return d.id !== draft.id; });
return res;
}
function addGroupExpense(groupId, input) {
var group = findMoneyGroup(groupId);
if (!group) return { ok: false, error: 'المجموعة غير موجودة' };
var total = Math.round(Number(input.amount));
if (!(total > 0)) return { ok: false, error: 'اكتب مبلغاً صحيحاً' };
var memo = String(input.memo || '').trim().slice(0, 80);
if (!memo) return { ok: false, error: 'اكتب وصف المصروف' };
if (!groupMember(group, input.paidBy)) return { ok: false, error: 'اختر من دفع' };
var shares = {};
if (input.shares) {
var sum = 0;
for (var id in input.shares) {
var share = Math.round(Number(input.shares[id]) || 0);
if (share < 0 || !groupMember(group, id)) return { ok: false, error: 'حصة غير صحيحة' };
if (share > 0) { shares[id] = share; sum += share; }
}
if (sum !== total) return { ok: false, error: 'مجموع الحصص لا يساوي المبلغ' };
} else {
var ids = (input.participants || []).filter(function (p) { return groupMember(group, p); });
if (!ids.length) return { ok: false, error: 'اختر من يتشارك المصروف' };
shares = equalShares(total, ids);
}
var label = group.name + ': ' + memo;
var drafts = [];
var dueFor = {};
var mine = shares[GROUP_ME] || 0;
try {
if (input.paidBy === GROUP_ME) {
var pay = input.payAccountId;
if (!getAccount(pay)) return { ok: false, error: 'اختر الحساب الذي دفعت منه' };
if (mine > 0) drafts.push(buildDraft(groupIntent('expense', pay, null, mine, '', label)));
group.members.forEach(function (m) {
if (m.id !== GROUP_ME && shares[m.id] > 0) drafts.push(buildDraft(groupIntent('lend', pay, m.accountId, shares[m.id], m.name, label)));
});
} else if (mine > 0) {
var payer = groupMember(group, input.paidBy);
var draft = buildDraft(groupIntent('expense', payer.accountId || 'payable', null, mine, payer.name, label));
dueFor[draft.id] = payer.name;
drafts.push(draft);
}
} catch (e) {
return { ok: false, error: e.message };
}
if (entryLimitApplies() && entriesThisMonth() + drafts.length > FREE_MONTHLY_ENTRIES) {
return { ok: false, limited: true, reason: 'entryLimit', error: 'هذا المصروف يتجاوز حد ' + FREE_MONTHLY_ENTRIES + ' قيد لهذا الشهر.' };
}
var entryIds = [];
for (var d = 0; d < drafts.length; d++) {
var draftId = drafts[d].id;
var res = postGroupDraft(drafts[d]);
if (!res.ok) return res;
entryIds.push(res.entry.id);
if (dueFor[draftId]) {
state.dueItems.push({
id: uid('due'), kind: 'payable', counterparty: dueFor[draftId], entryId: res.entry.id,
amount: res.entry.totalBase, remaining: res.entry.totalBase, dueDate: addDays(res.entry.date, 30),
defaulted: true, settled: false, createdAt: new Date().toISOString()
});
}
}
var expense = { id: uid('gexp'), memo: memo, amount: total, paidBy: input.paidBy, shares: shares, date: todayISO(), entryIds: entryIds };
group.expenses.push(expense);
saveState();
return { ok: true, expense: expense, entryIds: entryIds };
}
function ownerIssueCodes(input) {
if (!root.RohOwner) return { ok: false, error: 'غير متاح في هذه النسخة' };
var devices = (input && input.devices) || [];
if (!devices.length) return { ok: false, error: 'اكتب رمز الجهاز' };
var codes = [];
var seen = {};
for (var i = 0; i < devices.length; i++) {
var made = ownerActivationCode(devices[i]);
if (!made.ok) return { ok: false, error: 'رمز الجهاز ' + (i + 1) + ' غير صحيح (8 أو 12 حرفاً)' };
if (seen[made.device]) return { ok: false, error: 'رمز الجهاز ' + (i + 1) + ' مكرر' };
seen[made.device] = true;
codes.push(made);
}
return { ok: true, codes: codes };
}
function ownerBuyerAccount(input, currency) {
var account = getAccount(input.accountId);
var newName = String(input.newAccountName || '').trim().slice(0, 40);
var newPhone = String(input.newAccountPhone || '').trim().slice(0, 20);
var newActivity = String(input.newAccountActivity || '').trim().slice(0, 40);
if (!account && newName) {
account = state.accounts.filter(function (a) { return normalizeName(a.name) === normalizeName(newName); })[0] || null;
if (!account) {
var added = addAccount({ name: newName, type: 'asset', subtype: 'العملاء', nature: 'debit', currency: currency, liquid: false, glyph: '◆', hint: newActivity, phone: newPhone || null });
if (!added.ok) return added;
account = added.account;
}
}
return account ? { ok: true, account: account } : { ok: false, error: 'اختر الحساب' };
}
function ownerRecordPayment(input) {
if (!root.RohOwner) return { ok: false, error: 'غير متاح في هذه النسخة' };
input = input || {};
var count = Math.max(1, Math.min(20, Math.round(Number(input.count) || 1)));
var price = Math.round(Number(input.price) || 0);
if (!(price > 0)) return { ok: false, error: 'اكتب سعر النسخة' };
var known = listCurrencies().some(function (c) { return c.code === input.currency; });
if (!known) return { ok: false, error: 'اختر العملة' };
var total = price * count;
var totalBase = toBase(total, input.currency);
if (!(totalBase > 0)) return { ok: false, error: 'اكتب سعراً صحيحاً' };
if (!input.accountId && !String(input.newAccountName || '').trim()) return { ok: false, error: 'اختر العميل' };
var prepaid = input.payWith === 'prepaid';
var into = prepaid ? null : getAccount(input.payWith);
if (!prepaid && !(into && into.liquid)) return { ok: false, error: 'اختر أين استُلم المبلغ' };
if (prepaid) {
var held = getAccount(input.accountId);
var credit = held ? -((computeAnalysis().balances[held.id] || {}).base || 0) : 0;
if (credit < totalBase) return { ok: false, error: 'رصيد العميل المدفوع مسبقاً لا يكفي' };
}
var buyer = ownerBuyerAccount(input, input.currency);
if (!buyer.ok) return buyer;
var draft;
try {
draft = buildDraft({
kind: 'income', amountMinor: total, currency: input.currency,
accountId: prepaid ? buyer.account.id : into.id, contraAccountId: 'revenue',
counterparty: buyer.account.name, memo: String(input.memo || '').trim().slice(0, 200) || ('بيع ' + count + ' نسخة من موني كود، مدفوعة'), date: todayISO()
});
} catch (e) {
return { ok: false, error: e.message };
}
var res = postGroupDraft(draft);
if (!res.ok) return res;
saveState();
return { ok: true, entry: res.entry, account: buyer.account, sale: { id: res.entry.id, count: count, buyer: buyer.account.name } };
}
function ownerSellCodes(input) {
if (!root.RohOwner) return { ok: false, error: 'غير متاح في هذه النسخة' };
var made = ownerIssueCodes(input);
if (!made.ok) return made;
var devices = input.devices;
var codes = made.codes;
var price = Math.round(Number(input.price) || 0);
if (price < 0) return { ok: false, error: 'اكتب سعراً صحيحاً' };
if (!price) return { ok: true, codes: codes, entry: null };
var known = listCurrencies().some(function (c) { return c.code === input.currency; });
if (!known) return { ok: false, error: 'اختر العملة' };
var total = price * devices.length;
if (!(toBase(total, input.currency) > 0)) return { ok: false, error: 'اكتب سعراً صحيحاً' };
var buyer = ownerBuyerAccount(input, input.currency);
if (!buyer.ok) return buyer;
var account = buyer.account;
var today = todayISO();
var draft;
try {
draft = buildDraft({
kind: 'income', amountMinor: total, currency: input.currency, accountId: account.id, contraAccountId: 'revenue',
counterparty: account.name, memo: 'بيع ' + devices.length + ' نسخة من موني كود، الدفع مقدماً', date: today, dueDate: today
});
} catch (e) {
return { ok: false, error: e.message };
}
var res = postGroupDraft(draft);
if (!res.ok) return res;
state.dueItems.push({
id: uid('due'), kind: 'receivable', counterparty: account.name, entryId: res.entry.id,
amount: res.entry.totalBase, remaining: res.entry.totalBase, dueDate: today,
defaulted: false, settled: false, createdAt: new Date().toISOString()
});
saveState();
return { ok: true, codes: codes, entry: res.entry, account: account };
}
function removeGroupExpense(groupId, expenseId) {
var group = findMoneyGroup(groupId);
var expense = group && group.expenses.filter(function (x) { return x.id === expenseId; })[0];
if (!expense) return { ok: false, error: 'المصروف غير موجود' };
var live = expense.entryIds.filter(function (id) { return state.entries.some(function (e) { return e.id === id; }); });
for (var i = 0; i < live.length; i++) {
var can = canDeleteEntry(live[i]);
if (!can.ok) return { ok: false, error: 'لا يمكن حذف هذا المصروف لوجود تسوية مرتبطة به.' };
}
group.expenses = group.expenses.filter(function (x) { return x.id !== expenseId; });
live.forEach(deleteEntry);
saveState();
return { ok: true };
}
function groupBalances(groupId) {
var group = findMoneyGroup(groupId);
if (!group) return null;
var net = {};
group.members.forEach(function (m) { net[m.id] = 0; });
group.expenses.forEach(function (x) {
if (net[x.paidBy] !== undefined) net[x.paidBy] += x.amount;
Object.keys(x.shares).forEach(function (id) { if (net[id] !== undefined) net[id] -= x.shares[id]; });
});
group.settlements.forEach(function (s) {
if (net[s.from] !== undefined) net[s.from] += s.amount;
if (net[s.to] !== undefined) net[s.to] -= s.amount;
});
var pending = group.members.map(function (m) { return { id: m.id, left: net[m.id] }; });
var transfers = [];
for (var guard = 0; guard < pending.length * pending.length; guard++) {
pending.sort(function (a, b) { return a.left - b.left; });
var debtor = pending[0];
var creditor = pending[pending.length - 1];
if (debtor.left >= 0 || creditor.left <= 0) break;
var amount = Math.min(-debtor.left, creditor.left);
transfers.push({ from: debtor.id, to: creditor.id, amount: amount });
debtor.left += amount;
creditor.left -= amount;
}
return { net: net, transfers: transfers };
}
function settleGroup(groupId, input) {
var group = findMoneyGroup(groupId);
if (!group) return { ok: false, error: 'المجموعة غير موجودة' };
var from = groupMember(group, input.from);
var to = groupMember(group, input.to);
var amount = Math.round(Number(input.amount));
if (!from || !to || from.id === to.id) return { ok: false, error: 'اختر طرفي التسوية' };
if (!(amount > 0)) return { ok: false, error: 'اكتب مبلغاً صحيحاً' };
var entryId = null;
if (from.id === GROUP_ME || to.id === GROUP_ME) {
if (!getAccount(input.payAccountId)) return { ok: false, error: 'اختر الحساب' };
var other = from.id === GROUP_ME ? to : from;
var draft;
try {
draft = buildDraft(groupIntent(from.id === GROUP_ME ? 'repay' : 'collect', input.payAccountId, other.accountId, amount, other.name, group.name + ': تسوية'));
} catch (e) {
return { ok: false, error: e.message };
}
var res = postGroupDraft(draft);
if (!res.ok) return res;
entryId = res.entry.id;
}
group.settlements.push({ id: uid('gset'), from: from.id, to: to.id, amount: amount, date: todayISO(), entryId: entryId });
saveState();
return { ok: true, entryId: entryId };
}
var CASH_FLOW_GROUPS = [
{ id: 'operating', kinds: ['income', 'expense'] },
{ id: 'debts', kinds: ['lend', 'collect'] },
{ id: 'financing', kinds: ['capital', 'borrow', 'repay'] }
];
function cashFlowReport(from, to) {
var liquid = {};
state.accounts.forEach(function (a) { if (a.liquid) liquid[a.id] = true; });
var opening = 0;
var byKind = {};
state.entries.forEach(function (e) {
if (e.date > to) return;
var delta = (e.lines || []).reduce(function (sum, l) {
return liquid[l.accountId] ? sum + (Number(l.debitBase) || 0) - (Number(l.creditBase) || 0) : sum;
}, 0);
if (e.date < from) opening += delta;
else if (delta) {
var cfKind = (e.kind === 'compound' && (e.lines || []).some(function (l) { return l.accountId === 'capital'; })) ? 'capital' : e.kind;
byKind[cfKind] = (byKind[cfKind] || 0) + delta;
}
});
var known = {};
var groups = CASH_FLOW_GROUPS.map(function (group) {
group.kinds.forEach(function (k) { known[k] = true; });
return { id: group.id, kinds: group.kinds };
});
var others = Object.keys(byKind).filter(function (k) { return !known[k]; });
if (others.length) groups.push({ id: 'other', kinds: others });
var net = 0;
var result = groups.map(function (group) {
var items = group.kinds.filter(function (k) { return byKind[k]; }).map(function (k) { return { kind: k, amount: byKind[k] }; });
var total = items.reduce(function (sum, item) { return sum + item.amount; }, 0);
net += total;
return { id: group.id, items: items, net: total };
});
return { from: from, to: to, opening: opening, groups: result, net: net, closing: opening + net };
}
function statementEntryMatches(entry, amountBase, filter) {
var f = filter || {};
if (f.from && entry.date < f.from) return false;
if (f.to && entry.date > f.to) return false;
var words = normalizeAr(String(f.words || '')).toLowerCase().split(/\s+/).filter(Boolean);
if (words.length) {
var text = normalizeAr(String(entry.memo || '') + ' ' + String(entry.counterparty || '')).toLowerCase();
if (!words.every(function (w) { return text.indexOf(w) >= 0; })) return false;
}
var amount = fromBase(Math.abs(amountBase), mainCurrency());
if (f.min != null && amount < f.min) return false;
if (f.max != null && amount > f.max) return false;
return true;
}
var REPORT_WORDS = ['تقرير', 'تقارير', 'تقريري', 'كشف', 'كشوف', 'كشوفات', 'ميزانية', 'ميزانيتي', 'تدفق', 'تدفقات', 'قوائم', 'report', 'reports', 'statement', 'statements'];
function wantsReports(text) {
var norm = normalizeAr(String(text || '')).toLowerCase().trim();
if (!norm || /\d/.test(norm)) return false;
var tokens = norm.split(/\s+/);
if (tokens.length > 5) return false;
var words = REPORT_WORDS.map(function (w) { return normalizeAr(w).toLowerCase(); });
return tokens.some(function (t) {
return words.indexOf(t) >= 0 || (t.indexOf('ال') === 0 && words.indexOf(t.slice(2)) >= 0);
});
}
function accountQuestion(text) {
var norm = normalizeAr(String(text || '')).toLowerCase().replace(/[؟?!.،,]/g, ' ').replace(/\s+/g, ' ').trim();
if (!norm) return null;
var word = function (w) { return normalizeAr(w).toLowerCase(); };
var asks = new RegExp('^(' + ['كم', 'رصيد', 'ما رصيد', 'ما هو رصيد', 'حساب', 'وش رصيد', 'ايش رصيد'].map(word).join('|') + ')( |$)');
if (/\d/.test(norm)) {
if (!asks.test(norm)) return null;
var groups = norm.replace(/(\d)[\s\-]+(?=\d)/g, '$1').match(/\d{7,}/g) || [];
var byPhone = null;
state.accounts.forEach(function (acc) {
var phone = normalizeAr(acc.phone || '').replace(/\D/g, '');
if (!byPhone && phone && groups.some(function (g) { return phone.indexOf(g) >= 0 || g.indexOf(phone.slice(-9)) >= 0; })) byPhone = acc;
});
return byPhone ? { type: 'balance', account: byPhone } : null;
}
var listWords = ['الحسابات', 'حساباتي', 'حسابات'].map(word);
var asksForList = norm.split(' ').some(function (t) { return listWords.indexOf(t) >= 0; });
if (asksForList && norm.split(' ').length <= 6) return { type: 'list' };
if (!asks.test(norm)) return null;
var padded = ' ' + norm + ' ';
var best = null;
var bestLength = 0;
state.accounts.forEach(function (acc) {
accountNamesOf(acc).concat([acc.nickname]).forEach(function (name) {
var full = word(String(name || '')).trim();
if (full.length < 2) return;
var bare = full.indexOf('ال') === 0 ? full.slice(2) : full;
var found = [full, bare].some(function (n) { return n.length >= 2 && padded.indexOf(' ' + n + ' ') >= 0; });
if (found && full.length > bestLength) { best = acc; bestLength = full.length; }
});
});
return best ? { type: 'balance', account: best } : null;
}
function undoLast() {
if (!state.entries.length) return { ok: false, error: 'لا توجد قيود للتراجع عنها' };
var last = state.entries[state.entries.length - 1];
return deleteEntry(last.id);
}
function dueStatus(item) {
var today = todayISO();
if (!item.dueDate) return { key: 'none', label: 'غير محدد', days: null };
var diff = daysBetween(today, item.dueDate);
if (diff < 0) return { key: 'overdue', label: 'متأخر ' + Math.abs(diff) + ' يوم', days: diff };
if (diff === 0) return { key: 'soon', label: 'مستحق اليوم', days: 0 };
if (diff <= 7) return { key: 'soon', label: 'بعد ' + diff + ' يوم', days: diff };
return { key: 'ok', label: 'بعد ' + diff + ' يوم', days: diff };
}
function computeAnalysisCore() {
var balances = {};
var debitTotal = 0, creditTotal = 0;
var missingAccounts = { lines: 0, debit: 0, credit: 0, ids: [] };
if (!state) {
return { ok: false, error: 'المحرك غير محمّل' };
}
state.accounts.forEach(function (a) {
balances[a.id] = { native: 0, base: 0, byCurrency: {} };
});
var today = todayISO();
var from30 = addDays(today, -30);
var burn30 = 0;
var income30 = 0;
var dailyNet = {};
var burnDates = {};
state.entries.forEach(function (entry) {
var inWindow = isValidDate(entry.date) && entry.date >= from30 && entry.date <= today;
(entry.lines || []).forEach(function (l) {
var acc = getAccount(l.accountId);
if (!acc) {
missingAccounts.lines++;
missingAccounts.debit += Number(l.debitBase) || 0;
missingAccounts.credit += Number(l.creditBase) || 0;
if (missingAccounts.ids.indexOf(l.accountId) < 0) missingAccounts.ids.push(l.accountId);
return;
}
var sign = acc.nature === 'debit' ? 1 : -1;
debitTotal += Number(l.debitBase) || 0;
creditTotal += Number(l.creditBase) || 0;
balances[acc.id].native += sign * ((Number(l.debit) || 0) - (Number(l.credit) || 0));
balances[acc.id].base += sign * ((Number(l.debitBase) || 0) - (Number(l.creditBase) || 0));
var cur = l.currency || acc.currency;
var part = balances[acc.id].byCurrency[cur] || (balances[acc.id].byCurrency[cur] = { native: 0, base: 0 });
part.native += sign * ((Number(l.debit) || 0) - (Number(l.credit) || 0));
part.base += sign * ((Number(l.debitBase) || 0) - (Number(l.creditBase) || 0));
if (inWindow) {
if (acc.type === 'expense') { burn30 += (Number(l.debitBase) || 0) - (Number(l.creditBase) || 0); burnDates[entry.date] = true; }
if (acc.type === 'revenue') income30 += (Number(l.creditBase) || 0) - (Number(l.debitBase) || 0);
}
if (acc.liquid) {
var net = (Number(l.debitBase) || 0) - (Number(l.creditBase) || 0);
dailyNet[entry.date] = (dailyNet[entry.date] || 0) + net;
}
});
});
state.accounts.forEach(function (a) { if (a.multi) balances[a.id].native = balances[a.id].base; });
var liquidity = 0;
var assets = 0;
var liabilities = 0;
var equity = 0;
var revenue = 0;
var expense = 0;
var overdrafts = [];
var liquidAccounts = [];
state.accounts.forEach(function (a) {
var b = balances[a.id];
if (a.type === 'asset') assets += b.base;
if (a.type === 'liability') {
if (b.base >= 0) liabilities += b.base;
else assets += -b.base;
}
if (a.type === 'equity') equity += b.base;
if (a.type === 'revenue') revenue += b.base;
if (a.type === 'expense') expense += b.base;
if (a.liquid) {
liquidity += b.base;
liquidAccounts.push({ account: a, native: b.native, base: b.base });
if (b.native < 0 || b.base < 0) overdrafts.push(a);
}
});
var spark = [];
for (var i = 13; i >= 0; i--) {
var d = addDays(today, -i);
spark.push({ date: d, net: dailyNet[d] || 0 });
}
var burnDayCount = Object.keys(burnDates).length;
var dailyBurn = burnDayCount > 0 ? burn30 / Math.min(30, burnDayCount) : (burn30 / 30);
var runwayDays;
if (!state.entries.length) runwayDays = null;
else if (liquidity <= 0) runwayDays = 0;
else if (dailyBurn > 0) runwayDays = Math.max(0, Math.floor(liquidity / dailyBurn));
else runwayDays = null;
var crisis;
if (!state.entries.length) crisis = 0;
else if (liquidity <= 0) crisis = 96;
else if (!dailyBurn) crisis = 8;
else {
crisis = Math.round(100 / (1 + Math.exp((Math.min(runwayDays, 365) - 21) / 7)));
crisis = Math.min(95, Math.max(3, crisis));
}
var dueItems = [];
var overduePayables = 0;
var overdueReceivables = 0;
var dueSoon = 0;
state.dueItems.forEach(function (d) {
if (!(d.remaining > 0)) return;
var status = dueStatus(d);
dueItems.push({
id: d.id, kind: d.kind, counterparty: d.counterparty,
remaining: d.remaining, dueDate: d.dueDate, entryId: d.entryId,
currency: d.currency || BASE, remainingNative: d.remainingNative != null ? d.remainingNative : d.remaining,
defaulted: !!d.defaulted, status: status, created: d.createdAt
});
if (status.key === 'overdue' || status.key === 'soon') {
if (d.kind === 'payable') overduePayables += d.remaining;
else overdueReceivables += d.remaining;
} else if (status.key === 'none') {
if (d.kind === 'payable') overduePayables += d.remaining;
}
if (status.key === 'overdue' || status.key === 'soon' || (status.days !== null && status.days <= 7)) {
dueSoon += d.remaining;
}
});
dueItems.sort(function (a, b) {
if (!a.dueDate) return 1;
if (!b.dueDate) return -1;
return a.dueDate < b.dueDate ? -1 : 1;
});
var maturityBuckets = {
overdue: { count: 0, total: 0 },
soon: { count: 0, total: 0 },
month: { count: 0, total: 0 },
later: { count: 0, total: 0 }
};
state.dueItems.forEach(function (d) {
if (!(d.remaining > 0)) return;
var st = dueStatus(d);
var key = 'later';
if (st.key === 'overdue') key = 'overdue';
else if (st.days !== null && st.days <= 7) key = 'soon';
else if (st.days !== null && st.days <= 30) key = 'month';
maturityBuckets[key].count++;
maturityBuckets[key].total += d.remaining;
});
var liquidityByCurrency = {};
state.accounts.forEach(function (a) {
if (!a.liquid) return;
var b = balances[a.id];
var parts = a.multi ? b.byCurrency : {};
if (!a.multi) parts[a.currency] = b;
Object.keys(parts).forEach(function (cur) {
if (!liquidityByCurrency[cur]) liquidityByCurrency[cur] = { native: 0, base: 0 };
liquidityByCurrency[cur].native += parts[cur].native;
liquidityByCurrency[cur].base += parts[cur].base;
});
});
var alerts = [];
var imbalance = debitTotal - creditTotal;
if (imbalance !== 0) {
alerts.push({ type: 'danger', text: 'اختلال محاسبي: مجموع المدين لا يساوي الدائن بفارق ' + fmtMoney(Math.abs(imbalance), BASE, false) });
}
overdrafts.forEach(function (a) {
alerts.push({ type: 'danger', accountId: a.id, fixable: true, text: 'سحب على المكشوف في «' + a.name + '»: الرصيد سالب ' + fmtMoney(Math.abs(balances[a.id].native), a.currency, false) });
});
state.accounts.forEach(function (a) {
var b = balances[a.id];
if (!b) return;
if (isAnomalous(a, b.base)) {
if (a.type === 'liability') {
alerts.push({ type: 'ok', accountId: a.id, text: '«' + a.name + '» رصيده لنا: ' + fmtMoney(Math.abs(b.native), a.currency, false) + ' مستحق لك.' });
} else {
alerts.push({ type: 'gold', accountId: a.id, text: 'حساب شاذ «' + a.name + '»: رصيد ' + fmtMoney(b.native, a.currency, false) + ' (طباعته ' + (a.nature === 'debit' ? 'مدين' : 'دائن') + ').' });
}
}
});
if (missingAccounts.lines > 0) {
alerts.push({ type: 'danger', text: missingAccounts.lines + ' سطراً تشير إلى ' + missingAccounts.ids.length + ' حساب غير موجود — غير محسوبة في الأرصدة.' });
}
if (overduePayables > 0 && overduePayables > liquidity) {
alerts.push({ type: 'danger', text: 'التزامات مستحقة تتجاوز السيولة المتاحة بقيمة ' + fmtMoney(overduePayables - liquidity, BASE, false) });
}
if (crisis >= 65) {
alerts.push({ type: 'gold', text: 'احتمال ضغط سيولة مرتفع (' + crisis + '%). راجع الاستحقاقات القريبة.' });
}
if (!state.entries.length) {
alerts.push({ type: 'gold', text: 'لا توجد قيود بعد. ابدأ بإدخال رصيدك الافتتاحي أو أول مصروف.' });
}
var netWorth = assets - liabilities;
return {
ok: true,
balances: balances,
liquidAccounts: liquidAccounts,
liquidity: liquidity,
assets: assets,
liabilities: liabilities,
equity: equity,
revenue: revenue,
expense: expense,
profit: revenue - expense,
netWorth: netWorth,
burn30: burn30,
income30: income30,
dailyBurn: dailyBurn,
runwayDays: runwayDays,
crisis: crisis,
dueItems: dueItems,
maturityBuckets: maturityBuckets,
liquidityByCurrency: liquidityByCurrency,
overduePayables: overduePayables,
overdueReceivables: overdueReceivables,
dueSoon: dueSoon,
overdrafts: overdrafts,
alerts: alerts,
fraudAlerts: (state.entries || []).slice(0, 60).map(function (e) {
if (!e) return null;
var recomputed = detectFraudRisk(e, { now: e.createdAt ? new Date(e.createdAt).getTime() : Date.now(), excludeId: e.id });
if (!recomputed || !recomputed.risk || recomputed.risk === 'low') return null;
return { entryId: e.id, kind: e.kind, risk: recomputed.risk, reasons: recomputed.reasons, date: e.date };
}).filter(function (x) { return !!x; }),
spark: spark,
totals: { debit: debitTotal, credit: creditTotal, imbalance: imbalance },
missingAccounts: missingAccounts,
entryCount: state.entries.length,
savingsRate: income30 > 0 ? Math.round(((income30 - burn30) / income30) * 100) : null,
asOf: today
};
}
function computeAnalysis() {
if (!state) return computeAnalysisCore();
var key = _stateRev + '|' + (state.updatedAt || '') + '|' + (state.entries ? state.entries.length : 0) + '|' + (state.dueItems ? state.dueItems.length : 0) + '|' + (state.accounts ? state.accounts.length : 0);
if (_analysisCacheKey === key && _analysisCache) return _analysisCache;
_analysisCache = computeAnalysisCore();
_analysisCacheKey = key;
return _analysisCache;
}
var _tradingRadarCache = null;
var _tradingRadarCacheKey = null;
function computeTradingRadar() {
if (!state) return null;
var a = computeAnalysis();
var cur = (state.settings && state.settings.currency) || BASE;
var key = _stateRev + '|' + (state.updatedAt || '') + '|' + (state.entries ? state.entries.length : 0) + '|' + (state.dueItems ? state.dueItems.length : 0);
if (_tradingRadarCacheKey === key && _tradingRadarCache) return _tradingRadarCache;
var out = { cashDrag: 0, concentrationRisk: [], currencyExposure: {}, opportunities: [], warnings: [] };
var monthlyExpense = a.expense || 0;
if (monthlyExpense > 0 && a.liquidity > monthlyExpense * 2) {
out.cashDrag = a.liquidity - monthlyExpense * 2;
out.opportunities.push({
kind: 'cash_drag',
title: 'أموال «سائبة» (Cash Drag) — توظيف recommended',
amount: out.cashDrag,
suggestion: 'السيولة (' + fmtMoney(a.liquidity, cur, false) + ') تتجاوز 60 يوماً من المصروفات (' + fmtMoney(monthlyExpense * 2, cur, false) + '). فكر في توظيف ' + fmtMoney(out.cashDrag, cur, false) + ' في أداة استثمارية (سندات، حساب توفير، أصول ثابتة).'
});
}
var recDue = (a.dueItems || []).filter(function(d) { return !d.settled && d.remaining > 0 && d.kind === 'receivable'; });
var totalRec = recDue.reduce(function(s,d){ return s + (Number(d.remaining) || 0); }, 0);
if (totalRec > 0) {
var byCp = {};
recDue.forEach(function(d){ var k = d.counterparty || '?'; byCp[k] = (byCp[k] || 0) + (Number(d.remaining) || 0); });
Object.keys(byCp).forEach(function(k){
var pct = Math.round((byCp[k] / totalRec) * 100);
if (pct >= 30) {
out.concentrationRisk.push({ party: k, amount: byCp[k], pct: pct });
out.warnings.push({
kind: 'concentration',
level: 'important',
text: '⚠ تركز المخاطر (Concentration Risk): «' + k + '» يمثل ' + pct + '% من ذممك (' + fmtMoney(byCp[k], cur, false) + '). خطر عدم السداد.'
});
}
});
}
var liqByCur = {};
(state.accounts || []).forEach(function(acc){
if (!acc.liquid) return;
var b = a.balances && a.balances[acc.id] ? (a.balances[acc.id].byCurrency || {}) : {};
Object.keys(b).forEach(function(c){
if (!liqByCur[c]) liqByCur[c] = 0;
liqByCur[c] += (Number(b[c]) || 0);
});
});
var totalLiq = Object.keys(liqByCur).reduce(function(s,c){ return s + liqByCur[c]; }, 0);
if (totalLiq > 0) {
Object.keys(liqByCur).forEach(function(c){
var pct = Math.round((liqByCur[c] / totalLiq) * 100);
if (pct >= 70) {
out.currencyExposure[c] = pct;
out.warnings.push({
kind: 'currency_exposure',
level: 'normal',
text: '💱 انكشاف عملة: ' + pct + '% من سيولتك محفوظة بـ ' + c + '. فكر في تنويع currencies (صرف عملة / إعادة تقييم).'
});
}
});
}
var recEntries = (state.settings && state.settings.recurring) || [];
if (recEntries.length) {
var nextMonthProjected = 0;
recEntries.forEach(function(r){
var amt = toBase(r.amountMinor, r.currency || cur);
nextMonthProjected += (r.type === 'income' ? amt : -amt);
});
out.opportunities.push({
kind: 'forecast',
title: 'توقع التدفق النقدي (Cash Flow Forecast)',
amount: nextMonthProjected,
suggestion: 'بناءً على قيودك الدورية، التدفق النقدي المتوقع للشهر القادم: ' + fmtMoney(nextMonthProjected, cur, false) + '.'
});
}
_tradingRadarCache = out;
_tradingRadarCacheKey = key;
return out;
}
function computeCashFlowForecast(days) {
days = days || 30;
var a = computeAnalysis();
var st = state;
if (!st) return [];
var today = todayISO();
var forecast = [];
var running = a.liquidity || 0;
for (var d = 0; d <= days; d++) {
var date = addDays(today, d);
var dayEntries = (st.entries || []).filter(function(e){ return e.date === date; });
var inAmt = 0, outAmt = 0;
dayEntries.forEach(function(e){
if (e.kind === 'income' || e.kind === 'collect') inAmt += (Number(e.totalBase) || 0);
else if (e.kind === 'expense' || e.kind === 'repay' || e.kind === 'lend' || e.kind === 'borrow') outAmt += (Number(e.totalBase) || 0);
});
var rec = (st.settings && st.settings.recurring) || [];
rec.forEach(function(r){
if (r.nextDate === date) {
var amt = toBase(r.amountMinor, r.currency || BASE);
if (r.type === 'income') inAmt += amt; else outAmt += amt;
}
});
running += (inAmt - outAmt);
forecast.push({ date: date, in: inAmt, out: outAmt, balance: running });
}
return forecast;
}
function computeNetWorthTrend() {
var history = (state && state.settings && state.settings.netWorthHistory) || [];
if (history.length < 2) return null;
var last = history[history.length - 1];
var prev = history[history.length - 2];
return {
current: last.netWorth,
previous: prev.netWorth,
change: last.netWorth - prev.netWorth,
pct: prev.netWorth > 0 ? Math.round(((last.netWorth - prev.netWorth) / prev.netWorth) * 100) : 0,
direction: last.netWorth >= prev.netWorth ? 'up' : 'down'
};
}
function computeDebtPayoffPlan(strategy) {
strategy = strategy || 'snowball';
var a = computeAnalysis();
var payDue = (a.dueItems || []).filter(function(d) { return !d.settled && d.remaining > 0 && d.kind === 'payable'; });
var cur = (state && state.settings && state.settings.currency) || BASE;
var sorted = payDue.slice().sort(strategy === 'avalanche'
? function(x, y) { return (y.remaining || 0) - (x.remaining || 0); }
: function(x, y) { return (x.remaining || 0) - (y.remaining || 0); });
var total = payDue.reduce(function(s, d) { return s + (Number(d.remaining) || 0); }, 0);
var monthsToPayoff = total > 0 ? Math.ceil(total / (a.expense || 1)) : 0;
return {
strategy: strategy,
debts: sorted.map(function(d) {
return { counterparty: d.counterparty || 'مورد', amount: d.remaining, dueDate: d.dueDate };
}),
totalOwed: total,
monthsToPayoff: monthsToPayoff,
suggestion: sorted.length
? 'خطة ' + (strategy === 'avalanche' ? 'الانهيار (الأكبر أولاً)' : 'كرة الثلج (الأصغر أولاً)') + ': ' + sorted.length + ' التزامات، إجمالي ' + fmtMoney(total, cur, false) + '، مدة الإغلاق التقديرية: ' + monthsToPayoff + ' شهر.'
: 'لا توجد ديون مستحقة عليك حالياً.'
};
}
function generateMarketingContent(type) {
type = type || 'monthly_report';
var a = computeAnalysis();
var st = state;
var cur = (st && st.settings && st.settings.currency) || BASE;
var today = todayISO();
var totalEntries = (st && st.entries) ? st.entries.length : 0;
var recDue = (a.dueItems || []).filter(function(d) { return !d.settled && d.remaining > 0 && d.kind === 'receivable'; });
var payDue = (a.dueItems || []).filter(function(d) { return !d.settled && d.remaining > 0 && d.kind === 'payable'; });
var recSum = recDue.reduce(function(s,d){ return s + (Number(d.remaining)||0); }, 0);
var paySum = payDue.reduce(function(s,d){ return s + (Number(d.remaining)||0); }, 0);
var watermark = '\n\n— نُظّم بواسطة تطبيق موني كود (محاسبك الذكي بدون إنترنت — متوفر على Google Play: +967770550110 / +96899323110 — moneycodeapp.com)';
if (type === 'referral_message') {
var device = (typeof deviceCode === 'function' ? deviceCode() : '');
return 'حمّل تطبيق «موني كود» (محاسبك الذكي بدون إنترنت) لنطابق الحسابات والديون بيننا مباشرة عبر QR أو NFC.\n' +
'متوفر على متجر Google Play Store، وللتفعيل المباشر تواصل عبر واتساب: +967770550110 / +96899323110\n' +
'رمز جهازي لإضافته في حسابي لديك: ' + device +
'\n💡 كود دعوة صديق (خصم 15%): ' + device.slice(0, 6) + watermark;
}
if (type === 'social_post') {
return '📊 تم تنظيم ' + totalEntries + ' قيد محاسبي this month via موني كود!\n' +
'• صافي الثروة: ' + fmtMoney(a.netWorth || 0, cur, false) + '\n' +
'• السيولة: ' + fmtMoney(a.liquidity || 0, cur, false) + '\n' +
'• الديون لنا: ' + fmtMoney(recSum, cur, false) + ' | الديون علينا: ' + fmtMoney(paySum, cur, false) + '\n' +
'محاسبك الذكي بالصوت وباللهجة العامية وبدون إنترنت — حمّله من Google Play\n' +
'#موني_كود #محاسبة_بدون_إنترنت #دفتر_ديون' + watermark;
}
if (type === 'testimonial') {
var monthsActive = (state.settings && state.settings.activatedAt) ? Math.max(1, Math.ceil((Date.now() - new Date(state.settings.activatedAt).getTime()) / (30 * 24 * 60 * 60 * 1000))) : 1;
return '«أنا مستخدم لتطبيق موني كود منذ ' + monthsActive + ' شهر. سجلت ' + totalEntries + ' قيداً، وأدرت ' + recDue.length + ' ذمة (مبلغ إجمالي ' + fmtMoney(recSum, cur, false) + ')، وأصدرت تقارير PDF احترافية. التطبيق يعمل بالكامل بدون إنترنت وخصوصيتي 100% على جهازي.»\n' +
'— مستخدم مجهول، ' + (state.settings && state.settings.persona ? state.settings.persona : 'تاجر') + watermark;
}
if (type === 'statement_footer') {
return '\n\n— نُظّم بواسطة تطبيق موني كود (محاسبك الذكي بدون إنترنت — متوفر على Google Play: +967770550110 / +96899323110)';
}
var prevYm = (function() {
var curYm = today.slice(0, 7);
var y = Number(curYm.slice(0, 4)), m = Number(curYm.slice(5, 7)) - 1;
if (m <= 0) { m = 12; y--; }
return y + '-' + (m < 10 ? '0' + m : String(m));
})();
var calcMonth = function(ym) {
var inc = 0, exp = 0;
(st.entries || []).forEach(function(e) {
if (!e || String(e.date || '').slice(0, 7) !== ym) return;
if (e.kind === 'income') inc += Number(e.totalBase) || 0;
else if (e.kind === 'expense') exp += Number(e.totalBase) || 0;
});
return { inc: inc, exp: exp, net: inc - exp };
};
var mNow = calcMonth(today.slice(0, 7));
var mPrev = calcMonth(prevYm);
var lines = [];
lines.push('📊 تقرير موني كود الشهري — ' + today.slice(0, 7));
lines.push('• عدد القيود هذا الشهر: ' + totalEntries + ' قيد.');
lines.push('• إجمالي الإيرادات: ' + fmtMoney(mNow.inc, cur, false) + ' | إجمالي المصروفات: ' + fmtMoney(mNow.exp, cur, false) + '.');
lines.push('• صافي الربح: ' + fmtMoney(mNow.net, cur, false) + '.');
if (mPrev.inc > 0 || mPrev.exp > 0) {
var diffPct = mPrev.exp > 0 ? Math.round(((mNow.exp - mPrev.exp) / mPrev.exp) * 100) : 0;
lines.push('• مقارنة بالشهر الماضي (' + prevYm + '): صرفك ' + (diffPct > 0 ? 'أعلى بـ ' + diffPct + '%' : (diffPct < 0 ? 'أقل بـ ' + Math.abs(diffPct) + '% 👏' : 'مطابق')) + '.');
}
if (recSum > 0) lines.push('• الديون لك: ' + fmtMoney(recSum, cur, false) + ' (' + recDue.length + ' استحقاق).');
if (paySum > 0) lines.push('• الديون عليك: ' + fmtMoney(paySum, cur, false) + ' (' + payDue.length + ' استحقاق).');
lines.push('• صافي الثروة: ' + fmtMoney(a.netWorth || 0, cur, false) + '.');
lines.push(watermark);
return lines.join('\n');
}
var DB_SCHEMA_SQL = [
'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)',
'CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, code TEXT, name TEXT, type TEXT, subtype TEXT, nickname TEXT, nature TEXT, currency TEXT, liquid INTEGER, glyph TEXT, hint TEXT, phone TEXT, email TEXT, is_account INTEGER, multi INTEGER, currencies TEXT)',
'CREATE TABLE IF NOT EXISTS counterparties (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, email TEXT, address TEXT, notes TEXT, type TEXT)',
'CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, date TEXT, dueDate TEXT, kind TEXT, currency TEXT, counterparty TEXT, counterparty_id TEXT, memo TEXT, totalBase INTEGER, createdAt TEXT)',
'CREATE TABLE IF NOT EXISTS entry_lines (id INTEGER PRIMARY KEY AUTOINCREMENT, entry_id TEXT, accountId TEXT, currency TEXT, debit REAL, credit REAL, debitBase INTEGER, creditBase INTEGER, rate REAL, note TEXT)',
'CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, kind TEXT, date TEXT, dueDate TEXT, currency TEXT, counterparty TEXT, memo TEXT, totalBase INTEGER, createdAt TEXT)',
'CREATE TABLE IF NOT EXISTS draft_lines (id INTEGER PRIMARY KEY AUTOINCREMENT, draft_id TEXT, accountId TEXT, currency TEXT, debit REAL, credit REAL, debitBase INTEGER, creditBase INTEGER, rate REAL)',
'CREATE TABLE IF NOT EXISTS due_items (id TEXT PRIMARY KEY, kind TEXT, counterparty TEXT, counterparty_id TEXT, entryId TEXT, dueDate TEXT, amount INTEGER, remaining INTEGER, settled INTEGER, createdAt TEXT, updatedAt TEXT, currency TEXT, native INTEGER, remainingNative INTEGER, rate REAL)',
'CREATE TABLE IF NOT EXISTS settlements (id TEXT PRIMARY KEY, entryId TEXT, dueId TEXT, amount INTEGER, createdAt TEXT, native INTEGER)',
'CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, role TEXT, type TEXT, text TEXT, chips INTEGER, draftId TEXT, entryId TEXT, data TEXT, at TEXT)',
'CREATE TABLE IF NOT EXISTS semantic_dictionary (id INTEGER PRIMARY KEY AUTOINCREMENT, keyword TEXT UNIQUE NOT NULL, mapped_action TEXT NOT NULL, account_hint TEXT, account_id TEXT, usage_count INTEGER DEFAULT 0, last_used TEXT, language TEXT DEFAULT \'ar\', source TEXT DEFAULT \'manual\', confidence REAL DEFAULT 1.0)',
'CREATE TABLE IF NOT EXISTS semantic_dictionary_trash (id INTEGER PRIMARY KEY AUTOINCREMENT, keyword TEXT NOT NULL, mapped_action TEXT NOT NULL, account_hint TEXT, usage_count INTEGER DEFAULT 0, last_used TEXT, deleted_at TEXT DEFAULT (datetime(\'now\')))',
'CREATE TABLE IF NOT EXISTS learned_words (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL UNIQUE, suggested_action TEXT, suggested_account_id TEXT, seen_count INTEGER DEFAULT 1, first_seen TEXT, last_seen TEXT, promoted INTEGER DEFAULT 0)',
'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT UNIQUE NOT NULL, pinHash TEXT, salt TEXT, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL, lastLogin TEXT)',
'CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, label TEXT)',
'CREATE TABLE IF NOT EXISTS role_permissions (role TEXT NOT NULL, permission TEXT NOT NULL, PRIMARY KEY (role, permission))',
'CREATE TABLE IF NOT EXISTS user_sessions (id TEXT PRIMARY KEY, userId TEXT NOT NULL, startedAt TEXT NOT NULL, endedAt TEXT, device TEXT)',
'CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, at TEXT NOT NULL, userId TEXT, action TEXT NOT NULL, entityType TEXT NOT NULL, entityId TEXT, beforeJson TEXT, afterJson TEXT, reason TEXT)',
'CREATE TABLE IF NOT EXISTS event_log (id TEXT PRIMARY KEY, at TEXT NOT NULL, userId TEXT, kind TEXT NOT NULL, detail TEXT, metaJson TEXT)',
'CREATE TABLE IF NOT EXISTS license_sales (id TEXT PRIMARY KEY, device TEXT NOT NULL, code TEXT NOT NULL, buyerId TEXT, buyerName TEXT, tier TEXT NOT NULL, price INTEGER NOT NULL, currency TEXT NOT NULL, paidAt TEXT, issuedAt TEXT NOT NULL, revokedAt TEXT, receipt TEXT, gift INTEGER NOT NULL DEFAULT 0)',
'CREATE TABLE IF NOT EXISTS semantic_vectors (id TEXT PRIMARY KEY, kind TEXT, text TEXT, account_id TEXT, vector TEXT, created_at TEXT, usage_count INTEGER DEFAULT 1)'
];
var VOCAB_SEEDS = (typeof window !== 'undefined' && window.ROH_VOCAB_SEEDS) ? window.ROH_VOCAB_SEEDS : [];
var VOCAB_LOAD_WARNING = (!VOCAB_SEEDS || !VOCAB_SEEDS.length) ? 'لم تُحمَّل بذور المفردات (trained.js / vocab-seeds.js). قد يتدهور تحليل النصوص.' : null;
function freshState() {
return {
version: SCHEMA_VERSION,
createdAt: new Date().toISOString(),
updatedAt: new Date().toISOString(),
settings: { hideAmounts: false, simpleMode: false, recurring: [], budgets: [], netWorthHistory: [], currency: BASE, aiEnabled: false, aiAlwaysAllow: false, theme: 'light', rates: null, ratesUpdatedAt: null, vocabVersion: 0, autoLearn: false, vectorMemoryEnabled: true, vectorAutoConfirm: false, remindersEnabled: true },
accounts: ACCOUNT_DEFS.map(function (a) {
return { id: a.id, name: a.name, nickname: '', hint: a.hint, type: a.type, subtype: a.subtype || '', nature: a.nature, currency: a.currency, liquid: a.liquid, glyph: a.glyph, phone: null, email: null, is_account: /^acc_/.test(a.id) };
}),
entries: [],
drafts: [],
dueItems: [],
counterparties: [],
settlements: [],
messages: []
};
}
function ensureState(raw) {
var s = raw && typeof raw === 'object' ? raw : freshState();
if (!s.settings || typeof s.settings !== 'object') s.settings = { hideAmounts: false, currency: BASE };
if (typeof s.settings.hideAmounts !== 'boolean') s.settings.hideAmounts = false;
if (typeof s.settings.simpleMode !== 'boolean') s.settings.simpleMode = false;
if (!Array.isArray(s.settings.recurring)) s.settings.recurring = [];
if (!Array.isArray(s.settings.budgets)) s.settings.budgets = [];
if (!Array.isArray(s.settings.netWorthHistory)) s.settings.netWorthHistory = [];
s.settings.budgets = s.settings.budgets.filter(function (b) { return b && b.accountId; }).map(function (b) { if (!b.id) b.id = uid('bud'); if (!b.currency) b.currency = BASE; return b; });
s.settings.recurring = s.settings.recurring.filter(function (r) { return r && r.memo; }).map(function (r) { if (!r.id) r.id = uid('rec'); if (!r.nextDate) r.nextDate = todayISO(); return r; });
if (typeof s.settings.aiEnabled !== 'boolean') s.settings.aiEnabled = false;
if (typeof s.settings.aiAlwaysAllow !== 'boolean') s.settings.aiAlwaysAllow = false;
if (!s.settings.theme) s.settings.theme = 'light';
if (s.settings.vectorMemoryEnabled === undefined) s.settings.vectorMemoryEnabled = true;
if (s.settings.vectorAutoConfirm === undefined) s.settings.vectorAutoConfirm = true;
if (typeof s.settings.autoConfirmThreshold !== 'number') s.settings.autoConfirmThreshold = 72;
if (typeof s.settings.autoConfirmUsageCount !== 'number') s.settings.autoConfirmUsageCount = 3;
if (s.settings.bypassGovernor === undefined) s.settings.bypassGovernor = false;
if (!s.settings.baseCurrency || !applyBase(s.settings.baseCurrency, s.settings.baseSarRate)) s.settings.baseCurrency = BASE;
if (s.settings.autoMatch === undefined) s.settings.autoMatch = false;
if (typeof s.settings.autoConfirmThreshold !== 'number') s.settings.autoConfirmThreshold = 92;
if (typeof s.settings.autoConfirmUsageCount !== 'number') s.settings.autoConfirmUsageCount = 3;
if (!s.settings.reportSchedule || typeof s.settings.reportSchedule !== 'object') s.settings.reportSchedule = { enabled: false, type: 'cashflow', frequency: 'weekly', nextRun: null };
if (!s.settings.accountNotes || typeof s.settings.accountNotes !== 'object') s.settings.accountNotes = {};
if (!s.settings.accountNotes || typeof s.settings.accountNotes !== 'object') s.settings.accountNotes = {};
if (!s.settings.accountNotes || typeof s.settings.accountNotes !== 'object') s.settings.accountNotes = {};
if (!s.settings.rates || typeof s.settings.rates !== 'object') s.settings.rates = null;
if (s.settings.rates && s.settings.baseCurrency === 'SAR') {
if (s.settings.rates.YER > 10) s.settings.rates.YER = 1 / s.settings.rates.YER;
if (s.settings.rates.YRO > 10) s.settings.rates.YRO = 1 / s.settings.rates.YRO;
}
if (!s.settings.ratesUpdatedAt) s.settings.ratesUpdatedAt = null;
if (typeof s.settings.vocabVersion !== 'number') s.settings.vocabVersion = 0;
if (typeof s.settings.schemaVersion !== 'number') s.settings.schemaVersion = SCHEMA_VERSION;
if (!s.settings.lastAppVersion) s.settings.lastAppVersion = VERSION;
if (typeof s.settings.autoLearn !== 'boolean') s.settings.autoLearn = false;
if (typeof s.settings.vectorMemoryEnabled !== 'boolean') s.settings.vectorMemoryEnabled = true;
if (typeof s.settings.vectorAutoConfirm !== 'boolean') s.settings.vectorAutoConfirm = false;
s.settings.currencyConfig = cleanCurrencyConfig(s.settings.currencyConfig);
s.settings.rateHistory = cleanRateHistory(s.settings.rateHistory);
if (typeof s.settings.remindersEnabled !== 'boolean') s.settings.remindersEnabled = true; else s.settings.remindersEnabled = !!s.settings.remindersEnabled;
if (!s.settings.reminderTime || !/^\d{2}:\d{2}$/.test(s.settings.reminderTime)) s.settings.reminderTime = '09:00';
if (!s.settings.lastBackupAt) s.settings.lastBackupAt = null;
if (typeof s.settings.autoBackup !== 'boolean') s.settings.autoBackup = true;
if (typeof s.settings.defaultDueDays !== 'number' || !(s.settings.defaultDueDays > 0)) s.settings.defaultDueDays = 3;
s.settings.launchCount = Number(s.settings.launchCount) > 0 ? Math.floor(Number(s.settings.launchCount)) : 0;
s.accounts = (s.accounts || []).map(function (a) {
if (!a || !a.type) return a;
var t = String(a.type).toLowerCase();
if (t === 'asset' || t === 'expense') a.nature = 'debit';
else if (t === 'liability' || t === 'equity' || t === 'revenue') a.nature = 'credit';
if (a.email === undefined) a.email = null;
if (a.phone === undefined) a.phone = null;
if (a.is_account === undefined) a.is_account = /^acc_/.test(a.id);
return a;
});
s.accounts.forEach(function (a) {
if (a.id === 'usd_box' && a.name === 'صندوق الدولار') a.name = 'صندوق العملات الأجنبية';
if (a.id === 'sar_box' && (a.name === 'صندوق الريال' || a.name === 'صندوق الرياض')) a.name = 'المدخرات';
});
if (!Array.isArray(s.entries)) s.entries = [];
if (!Array.isArray(s.drafts)) s.drafts = [];
if (!Array.isArray(s.dueItems)) s.dueItems = [];
s.dueItems.forEach(function (d) {
if (d && d.counterparty_id === undefined) d.counterparty_id = null;
});
if (!Array.isArray(s.counterparties)) s.counterparties = [];
if (!Array.isArray(s.settlements)) s.settlements = [];
if (!Array.isArray(s.messages)) s.messages = [];
s.version = SCHEMA_VERSION;
s.dueItems.forEach(function (d) {
if (d.accountId) return;
var n = normalizeAr(d.counterparty || '');
if (!n) return;
var acc = (s.accounts || []).filter(function (a) { return normalizeAr(a.name || '') === n; })[0];
if (acc) d.accountId = acc.id;
});
var linkedEntries = {};
s.dueItems.forEach(function (d) { if (d.entryId) linkedEntries[d.entryId] = true; });
s.dueItems.forEach(function (d) {
if (d.entryId) return;
var loanKind = d.kind === 'receivable' ? 'lend' : 'borrow';
for (var i = 0; i < s.entries.length; i++) {
var e = s.entries[i];
if (!e || linkedEntries[e.id] || e.kind !== loanKind || e.totalBase !== d.amount) continue;
if ((e.counterparty || 'غير محدد') !== (d.counterparty || 'غير محدد')) continue;
d.entryId = e.id;
linkedEntries[e.id] = true;
break;
}
});
ACCOUNT_DEFS.forEach(function (def) {
var found = false;
for (var i = 0; i < s.accounts.length; i++) {
if (s.accounts[i].id === def.id) {
found = true;
if (def.id === 'wallet' || def.id === 'sar_box') {
s.accounts[i].name = def.name;
s.accounts[i].hint = def.hint;
}
if (!s.accounts[i].glyph || s.accounts[i].glyph === 'Wallet') s.accounts[i].glyph = def.glyph;
if (!s.accounts[i].subtype) s.accounts[i].subtype = def.subtype || '';
if (s.accounts[i].nickname === undefined) s.accounts[i].nickname = '';
if (def.id === 'sar_box' && db) {
try { db.run('UPDATE semantic_dictionary SET account_hint = ? WHERE account_id = ?', [def.name, 'sar_box']); } catch (e) {}
}
if (def.id === 'wallet' && db) {
try { db.run('UPDATE semantic_dictionary SET account_hint = ? WHERE account_id = ?', [def.name, 'wallet']); } catch (e) {}
}
}
}
if (!found) s.accounts.push({ id: def.id, name: def.name, nickname: def.nickname || '', hint: def.hint, type: def.type, subtype: def.subtype || '', nature: def.nature, currency: def.currency, liquid: def.liquid, glyph: def.glyph, phone: null, email: null, is_account: /^acc_/.test(def.id) });
});
s.entries = s.entries.filter(function (e) {
return e && typeof e === 'object' && Array.isArray(e.lines);
}).map(function (e) {
if (!isValidDate(e.date)) e.date = todayISO();
if (!e.id) e.id = uid('entry');
if (!Array.isArray(e.lines)) e.lines = [];
(e.lines || []).forEach(function (l) {
if (l && l.note === undefined) l.note = '';
if (l && s.settings && s.settings.baseCurrency === 'SAR' && (l.currency === 'YER' || l.currency === 'YRO') && l.rate > 10) {
var invR = 1 / l.rate;
l.rate = invR;
if (l.debit > 0) l.debitBase = Math.round(l.debit * invR);
if (l.credit > 0) l.creditBase = Math.round(l.credit * invR);
e._rebalanceBase = true;
}
});
if (e._rebalanceBase) {
delete e._rebalanceBase;
var sumD = 0, sumC = 0, capLine = null;
(e.lines || []).forEach(function (l) {
if (l.accountId === 'capital' && l.currency === 'SAR' && l.credit > 0 && l.debit === 0) capLine = l;
else { sumD += (l.debitBase || 0); sumC += (l.creditBase || 0); }
});
if (capLine && sumD > sumC) {
capLine.credit = sumD - sumC;
capLine.creditBase = sumD - sumC;
e.totalBase = sumD;
}
}
if (e.counterparty_id === undefined) e.counterparty_id = null;
return e;
});
var nowMs = Date.now();
s.drafts = s.drafts.filter(function (d) {
if (!d || !Array.isArray(d.lines) || !d.lines.length) return false;
if (d.createdAt) {
var age = nowMs - Date.parse(d.createdAt);
if (isFinite(age) && age > 7 * 24 * 60 * 60 * 1000) return false;
}
(d.lines || []).forEach(function (l) { if (l && l.note === undefined) l.note = ''; });
return true;
});
return s;
}
function bytesToBase64(bytes) {
var bin = '';
for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
return btoa(bin);
}
function base64ToBytes(b64) {
var bin = atob(b64);
var bytes = new Uint8Array(bin.length);
for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
return bytes;
}
var IDB_NAME = 'rohapp-db';
var IDB_STORE = 'files';
var IDB_KEY = 'main';
var SEAL_MAGIC = [77, 67, 69, 78, 67, 49]; // MCENC1
var SEALED_TEXT = 'mcenc:';
var storageKey = null;
async function setStorageKey(base64) {
var c = webCrypto();
if (!c) return { ok: false, error: 'التشفير غير متاح على هذا الجهاز' };
try {
var raw = base64ToBytes(base64);
if (raw.length !== 32) throw new Error('key size');
storageKey = await c.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
return { ok: true };
} catch (e) {
storageKey = null;
return { ok: false, error: 'تعذر فتح مفتاح التشفير' };
}
}
function isStorageSealed() {
return !!storageKey;
}
function isSealedBytes(bytes) {
return !!bytes && bytes.length > SEAL_MAGIC.length && SEAL_MAGIC.every(function (b, i) { return bytes[i] === b; });
}
async function sealBytes(bytes) {
if (!storageKey || isSealedBytes(bytes)) return bytes;
var c = webCrypto();
var iv = c.getRandomValues(new Uint8Array(12));
var sealed = new Uint8Array(await c.subtle.encrypt({ name: 'AES-GCM', iv: iv }, storageKey, bytes));
var out = new Uint8Array(SEAL_MAGIC.length + iv.length + sealed.length);
out.set(SEAL_MAGIC, 0);
out.set(iv, SEAL_MAGIC.length);
out.set(sealed, SEAL_MAGIC.length + iv.length);
return out;
}
async function openSealedBytes(bytes) {
if (!isSealedBytes(bytes)) return bytes;
if (!storageKey) return null;
try {
var start = SEAL_MAGIC.length;
var plain = await webCrypto().subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(start, start + 12) }, storageKey, bytes.subarray(start + 12));
return new Uint8Array(plain);
} catch (e) {
log('error', 'Could not open sealed bytes', e);
return null;
}
}
async function sealText(text) {
if (!storageKey) return text;
return SEALED_TEXT + bytesToBase64(await sealBytes(new TextEncoder().encode(text)));
}
async function openText(text) {
if (String(text).indexOf(SEALED_TEXT) !== 0) return text;
var plain = await openSealedBytes(base64ToBytes(text.slice(SEALED_TEXT.length)));
return plain ? new TextDecoder().decode(plain) : null;
}
function idbAvailable() {
return typeof window !== 'undefined' && !!window.indexedDB;
}
function idbOpen() {
return new Promise(function (resolve, reject) {
if (!idbAvailable()) { reject(new Error('IndexedDB unavailable')); return; }
var req = window.indexedDB.open(IDB_NAME, 1);
req.onupgradeneeded = function (e) {
var d = e.target.result;
if (!d.objectStoreNames.contains(IDB_STORE)) d.createObjectStore(IDB_STORE);
};
req.onsuccess = function (e) { resolve(e.target.result); };
req.onerror = function (e) { reject(e.target.error); };
});
}
async function storedBooksSealed() {
var rec = await idbLoadRecord();
if (rec.bytes) return isSealedBytes(rec.bytes);
try {
var raw = localStorage.getItem(DB_FALLBACK_KEY);
if (raw) return isSealedBytes(base64ToBytes(JSON.parse(raw).b64).slice(0, 16));
} catch (e) {}
return false;
}
async function idbLoadRecord() {
if (!idbAvailable()) return { status: 'unavailable', bytes: null, seq: 0 };
try {
var db = await idbOpen();
var rec = await new Promise(function (resolve, reject) {
var tx = db.transaction(IDB_STORE, 'readonly');
var store = tx.objectStore(IDB_STORE);
var req = store.get(IDB_KEY);
req.onsuccess = function (e) { resolve(e.target.result || null); };
req.onerror = function (e) { reject(e.target.error); };
});
if (rec && rec.bytes) {
return { status: 'ok', bytes: rec.bytes instanceof Uint8Array ? rec.bytes : new Uint8Array(rec.bytes), seq: Number(rec.seq) || 0 };
}
return { status: 'empty', bytes: null, seq: 0 };
} catch (e) {
log('warn', 'IndexedDB load failed', e);
return { status: 'error', bytes: null, seq: 0 };
}
}
async function idbSaveBytes(bytes, seq, key) {
try {
var stored = await sealBytes(bytes);
var db = await idbOpen();
await new Promise(function (resolve, reject) {
var tx = db.transaction(IDB_STORE, 'readwrite');
var store = tx.objectStore(IDB_STORE);
tx.oncomplete = function () { resolve(true); };
tx.onabort = function () { reject(tx.error || new Error('IndexedDB transaction aborted')); };
tx.onerror = function () { reject(tx.error || new Error('IndexedDB transaction failed')); };
var req = store.put({ bytes: stored, seq: seq || 0, updatedAt: new Date().toISOString() }, key || IDB_KEY);
req.onerror = function (e) { reject(e.target.error); };
});
return true;
} catch (e) {
log('warn', 'IndexedDB save failed', e);
storeError = 'IndexedDB: ' + errorText(e);
return false;
}
}
var saveSeq = 0;
var saveStatus = 'ok';        // 'ok' | 'fallback' (localStorage copy only) | 'failed' (not stored)
var storageFault = null;      // { kind: 'damaged' | 'unreadable', bytes } — saves stay blocked
var recoveredFrom = null;     // 'fallback' when this boot used the fallback copy
var saveError = null;         // why the last save wasn't 'ok'; database messages, never row values
var storeError = null;
var storageListeners = [];
function errorText(e) {
return String((e && e.message) || e || 'unknown').slice(0, 160);
}
function setSaveStatus(next, error) {
saveError = next === 'ok' ? null : (error || saveError);
if (next === saveStatus) return;
saveStatus = next;
storageListeners.forEach(function (fn) { try { fn(getStorageStatus()); } catch (e) {} });
}
function getVocabVersion() { return (getState() && getState().settings) ? (getState().settings.vocabVersion || 0) : 0; }
function getStorageStatus() {
return { save: saveStatus, fault: storageFault ? storageFault.kind : null, recovered: recoveredFrom, error: saveError };
}
function onStorageStatus(fn) {
storageListeners.push(fn);
}
function readFallback() {
try {
var raw = localStorage.getItem(DB_FALLBACK_KEY);
if (!raw) return null;
var parsed = JSON.parse(raw);
return { seq: Number(parsed.seq) || 0, bytes: base64ToBytes(parsed.b64) };
} catch (e) {
log('warn', 'Fallback copy unreadable', e);
return null;
}
}
function writeFallback(bytes, seq) {
try {
localStorage.setItem(DB_FALLBACK_KEY, JSON.stringify({ seq: seq, at: new Date().toISOString(), b64: bytesToBase64(bytes) }));
return true;
} catch (e) {
log('error', 'Fallback save failed', e);
storeError += ' / localStorage: ' + errorText(e);
return false;
}
}
function clearFallback() {
try { localStorage.removeItem(DB_FALLBACK_KEY); } catch (e) {}
}
function openValidDb(bytes) {
if (!bytes || !bytes.length) return null;
var candidate = null;
try {
candidate = new SQL.Database(bytes);
var integrity = candidate.exec('PRAGMA integrity_check');
var tables = candidate.exec("SELECT count(*) FROM sqlite_master WHERE type='table'");
if (integrity[0].values[0][0] === 'ok' && tables[0].values[0][0] > 0) return candidate;
} catch (e) {
log('error', 'Database failed its check', e);
}
try { if (candidate) candidate.close(); } catch (e) {}
return null;
}
function archiveDamagedBytes(bytes) {
return idbSaveBytes(bytes, 0, 'damaged-' + Date.now());
}
async function openStoredDb() {
var loaded = await idbLoadRecord();
var fallback = readFallback();
saveSeq = Math.max(loaded.seq, fallback ? fallback.seq : 0);
var mainWasPlain = !!loaded.bytes && !isSealedBytes(loaded.bytes);
loaded.bytes = (await openSealedBytes(loaded.bytes)) || loaded.bytes;
if (fallback) fallback.bytes = (await openSealedBytes(fallback.bytes)) || fallback.bytes;
var main = openValidDb(loaded.bytes);
var mainDamaged = !!loaded.bytes && !main;
var useFallback = fallback && (!main || fallback.seq > loaded.seq) ? openValidDb(fallback.bytes) : null;
if (useFallback) {
if (main) main.close();
if (mainDamaged) await archiveDamagedBytes(loaded.bytes);
recoveredFrom = 'fallback';
log('warn', 'Loaded the fallback copy.');
if (loaded.status !== 'error' && await idbSaveBytes(fallback.bytes, ++saveSeq)) clearFallback();
return useFallback;
}
if (main) {
if (fallback && fallback.seq <= loaded.seq) clearFallback();
if (storageKey && mainWasPlain) await idbSaveBytes(loaded.bytes, loaded.seq);
return main;
}
if (mainDamaged) {
storageFault = { kind: 'damaged', bytes: loaded.bytes };
log('error', 'Stored database is damaged; saving is blocked and its bytes are kept.');
return new SQL.Database();
}
if (loaded.status === 'error') {
storageFault = { kind: 'unreadable', bytes: null };
log('error', 'Stored database could not be read; saving is blocked.');
return new SQL.Database();
}
var legacyBytes = null;
try {
var raw = localStorage.getItem(DB_STORAGE_KEY);
if (raw) legacyBytes = base64ToBytes(raw);
} catch (e) { log('warn', 'Migration from localStorage failed', e); }
if (legacyBytes) {
var legacy = openValidDb(legacyBytes);
if (!legacy) {
storageFault = { kind: 'damaged', bytes: legacyBytes };
log('error', 'Legacy database is damaged; saving is blocked and its bytes are kept.');
return new SQL.Database();
}
if (await idbSaveBytes(legacyBytes, ++saveSeq)) {
try { localStorage.removeItem(DB_STORAGE_KEY); } catch (e) {}
log('info', 'Migrated DB from localStorage to IndexedDB.');
}
return legacy;
}
return new SQL.Database();
}
function schemaFor(table) {
for (var i = 0; i < DB_SCHEMA_SQL.length; i++) {
if (DB_SCHEMA_SQL[i].indexOf('CREATE TABLE IF NOT EXISTS ' + table + ' (') === 0) return DB_SCHEMA_SQL[i];
}
return null;
}
function addMissingColumns() {
DB_SCHEMA_SQL.forEach(function (sql) {
var match = /^CREATE TABLE IF NOT EXISTS (\w+) \((.*)\)$/.exec(sql);
if (!match) return;
try {
var info = db.exec('PRAGMA table_info(' + match[1] + ')');
var have = {};
if (info && info[0]) info[0].values.forEach(function (r) { have[r[1]] = true; });
(function (s) { var out = [], depth = 0, cur = ''; for (var i = 0; i < s.length; i++) { var c = s.charAt(i); if (c === '(') depth++; else if (c === ')') depth--; if (c === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += c; } if (cur.trim()) out.push(cur); return out; })(match[2]).forEach(function (def) {
var parts = def.trim().split(/\s+/);
if (have[parts[0]] || /^(PRIMARY|UNIQUE|FOREIGN|CHECK)$/i.test(parts[0])) return;
if (/PRIMARY KEY|UNIQUE|NOT NULL/i.test(def)) return;
db.run('ALTER TABLE ' + match[1] + ' ADD COLUMN ' + def);
log('info', 'Added column ' + parts[0] + ' to ' + match[1]);
});
} catch (e) { log('warn', 'Could not update table ' + match[1], e); }
});
}
function migrateLearnedWordsToDictionary() {
if (!db) return;
try {
var rows = db.exec('SELECT token, suggested_action, suggested_account_id, seen_count, last_seen FROM learned_words');
if (!rows || !rows[0]) return;
rows[0].values.forEach(function (r) {
var token = r[0], action = r[1], acct = r[2], seen = r[3] || 1, last = r[4];
try {
var exists = db.exec('SELECT 1 FROM semantic_dictionary WHERE keyword = ?', [token]);
if (exists && exists[0] && exists[0].values && exists[0].values.length) return;
db.run('INSERT INTO semantic_dictionary (keyword, mapped_action, account_id, usage_count, last_used, language, source) VALUES (?,?,?,?,?,?,?)',
[token, action || 'unknown', acct || null, seen, last, 'ar', 'learned']);
} catch (e) {}
});
} catch (e) {}
}
var SCHEMA_MIGRATIONS = [
function (fromVer) { /* v1 -> v2: handled by addMissingColumns */ },
function (fromVer) { addMissingColumns(); },   // v2 -> v3
function (fromVer) { addMissingColumns(); seedDefaultRoles(); },   // v3 -> v4
function (fromVer) { addMissingColumns(); }   // v4 -> v5 (license_sales)
];
function runSchemaMigrations() {
if (!db) return;
var stored = 0;
try {
var r = db.exec("SELECT value FROM settings WHERE key='schemaVersion'");
if (r && r[0] && r[0].values && r[0].values[0]) stored = Number(r[0].values[0][0]) || 0;
} catch (e) {}
if (stored >= SCHEMA_VERSION) return;
var from = stored;
for (var v = Math.max(2, stored + 1); v <= SCHEMA_VERSION; v++) {
var fn = SCHEMA_MIGRATIONS[v - 2];
if (typeof fn === 'function') { try { fn(from); } catch (e) { log('warn', 'Migration to v' + v + ' failed', e); } }
from = v;
}
try { db.run("INSERT OR REPLACE INTO settings (key,value) VALUES ('schemaVersion',?)", [String(SCHEMA_VERSION)]); } catch (e) {}
log('info', 'Schema migrated from v' + stored + ' to v' + SCHEMA_VERSION);
}
async function initDb() {
if (dbReady) return;
if (!SQL) {
SQL = await initSqlJs({});
}
db = await openStoredDb();
try { db.run('PRAGMA cache_size = -64000'); db.run('PRAGMA temp_store = MEMORY'); } catch (e) {}
if (storageKey) storageRemove(STORAGE_KEY);
DB_SCHEMA_SQL.forEach(function (s) { try { db.run(s); } catch (e) {} });
addMissingColumns();
try { runSchemaMigrations(); } catch (e) { log('warn', 'Schema migration skipped.', e); }
try { migrateLearnedWordsToDictionary(); } catch (e) { log('warn', 'Learned-words migration skipped.', e); }
try { db.run("UPDATE semantic_dictionary SET account_id = (SELECT a.id FROM accounts a WHERE a.name = semantic_dictionary.account_hint) WHERE account_id IS NULL AND account_hint IS NOT NULL AND EXISTS (SELECT 1 FROM accounts a WHERE a.name = semantic_dictionary.account_hint)"); } catch (e) {}
try {
var oldRaw = localStorage.getItem('rohapp.state.v2');
if (oldRaw && !storageFault) {
var crow = db.exec('SELECT count(*) AS c FROM entries');
var cc = (crow && crow[0] && crow[0].values && crow[0].values[0]) ? crow[0].values[0][0] : 0;
var mrow = db.exec('SELECT count(*) AS c FROM messages');
var mc = (mrow && mrow[0] && mrow[0].values && mrow[0].values[0]) ? mrow[0].values[0][0] : 0;
if (cc === 0 && mc === 0) {
state = ensureState(JSON.parse(oldRaw));
persistStateToDb();
log('info', 'Migrated from v2 localStorage.');
}
}
} catch (e) { log('warn', 'Migration skipped.', e); }
try {
var shippedVer = (typeof window !== 'undefined' && window.ROH_VOCAB_VERSION) ? Number(window.ROH_VOCAB_VERSION) : 1;
var storedVer = 0;
try {
var vr = db.exec("SELECT value FROM settings WHERE key='vocabVersion'");
if (vr && vr[0] && vr[0].values && vr[0].values[0]) storedVer = Number(vr[0].values[0][0]) || 0;
} catch (e) {}
if (shippedVer > storedVer) {
try { db.run("DELETE FROM semantic_dictionary WHERE source = 'vocab'"); } catch (e) {}
trainVocabulary();
try { db.run("INSERT OR REPLACE INTO settings (key,value) VALUES ('vocabVersion',?)", [String(shippedVer)]); } catch (e) {}
} else {
var cnt = db.exec('SELECT COUNT(*) AS c FROM semantic_dictionary');
var cc = (cnt && cnt[0] && cnt[0].values && cnt[0].values[0]) ? cnt[0].values[0][0] : 0;
if (cc === 0) {
trainVocabulary();
try { db.run("INSERT OR REPLACE INTO settings (key,value) VALUES ('vocabVersion',?)", [String(shippedVer)]); } catch (e) {}
}
}
} catch (e) {}
try { loadShippedTraining(); } catch (e) { log('warn', 'Shipped training skipped.', e); }
if (VOCAB_LOAD_WARNING) log('warn', VOCAB_LOAD_WARNING);
ensureMemoryLoaded();
dbReady = true;
}
function loadStateFromDb() {
state = freshState();
var draftSources = {};
try {
var srows = db.exec('SELECT key,value FROM settings');
if (srows && srows[0]) {
srows[0].values.forEach(function (r) {
var k = r[0], v = r[1];
if (k === 'hideAmounts') state.settings.hideAmounts = (v === 'true');
else if (k === 'simpleMode') state.settings.simpleMode = (v === 'true');
else if (k === 'recurring') { try { state.settings.recurring = JSON.parse(v); } catch (e) {} }
else if (k === 'budgets') { try { state.settings.budgets = JSON.parse(v); } catch (e) {} }
else if (k === 'assistantSeen') { try { state.settings.assistantSeen = JSON.parse(v); } catch (e) {} }
else if (k === 'assistantMuted') { try { state.settings.assistantMuted = JSON.parse(v); } catch (e) {} }
else if (k === 'assistantLevel') state.settings.assistantLevel = v;
else if (k === 'notifyDetail') state.settings.notifyDetail = v;
else if (k === 'assistantGoal') { try { state.settings.assistantGoal = JSON.parse(v); } catch (e) {} }
else if (k === 'netWorthHistory') { try { state.settings.netWorthHistory = JSON.parse(v); } catch (e) {} }
else if (k === 'featureUsage') { try { state.settings.featureUsage = JSON.parse(v); } catch (e) {} }
else if (k === 'speedStreak') state.settings.speedStreak = Number(v) || 0;
else if (k === 'speedStreakDate') state.settings.speedStreakDate = v;
else if (k === 'accountUsage') { try { state.settings.accountUsage = JSON.parse(v); } catch (e) {} }
else if (k === 'currency') state.settings.currency = v;
else if (k === 'baseCurrency') state.settings.baseCurrency = v;
else if (k === 'onboarded') state.settings.onboarded = (v === 'true');
else if (k === 'persona') state.settings.persona = v;
else if (k === 'baseSarRate') state.settings.baseSarRate = Number(v) || null;
else if (k === 'profile') { try { state.settings.profile = JSON.parse(v); } catch(e){} }
else if (k === 'aiEnabled') state.settings.aiEnabled = (v === 'true');
else if (k === 'aiAlwaysAllow') state.settings.aiAlwaysAllow = (v === 'true');
else if (k === 'theme') state.settings.theme = v;
else if (k === 'fontStep') state.settings.fontStep = Number(v) || 0;
else if (k === 'autoTts') state.settings.autoTts = (v === 'true');
else if (k === 'trainingOption') state.settings.trainingOption = (v === 'true');
else if (k === 'dictionaryOption') state.settings.dictionaryOption = (v === 'true');
else if (k === 'ownerCodesOption') state.settings.ownerCodesOption = (v === 'true');
else if (k === 'verifyActions') state.settings.verifyActions = (v === 'true');
else if (k === 'appLock') state.settings.appLock = (v === 'true');
else if (k === 'uxProgram') state.settings.uxProgram = (v === 'true');
else if (k === 'uxAskedAt') state.settings.uxAskedAt = v || null;
else if (k === 'activationCodes') { try { state.settings.activationCodes = JSON.parse(v) || []; } catch (e) {} }
else if (k === 'revokedCodes') { try { state.settings.revokedCodes = JSON.parse(v) || []; } catch (e) {} }
else if (k === 'usedPromos') { try { state.settings.usedPromos = JSON.parse(v) || []; } catch (e) {} }
else if (k === 'featureTrials') { try { state.settings.featureTrials = JSON.parse(v) || {}; } catch (e) {} }
else if (k === 'maxSeenDate') state.settings.maxSeenDate = v || null;
else if (k === 'activatedAt') state.settings.activatedAt = v || null;
else if (k === 'entriesAtActivation') state.settings.entriesAtActivation = Number(v) || 0;
else if (k === 'appLockMinutes') state.settings.appLockMinutes = Number(v) || 0;
else if (k === 'ownerGate') state.settings.ownerGate = (v !== 'false');
else if (k === 'language') state.settings.language = v;
else if (k === 'dialectRank') state.settings.dialectRank = Number(v) || 0;
else if (k === 'rates') { try { state.settings.rates = JSON.parse(v); } catch(e){} }
else if (k === 'ratesUpdatedAt') state.settings.ratesUpdatedAt = v;
else if (k === 'vocabVersion') state.settings.vocabVersion = Number(v) || 0;
else if (k === 'schemaVersion') state.settings.schemaVersion = Number(v) || 0;
else if (k === 'autoLearn') state.settings.autoLearn = (v === 'true');
else if (k === 'vectorMemoryEnabled') state.settings.vectorMemoryEnabled = (v === 'true');
else if (k === 'vectorAutoConfirm') state.settings.vectorAutoConfirm = (v === 'true');
else if (k === 'aiConfig') { try { state.settings.aiConfig = JSON.parse(v); } catch(e){} }
else if (k === 'plan') { try { state.settings.plan = JSON.parse(v); } catch(e){} }
else if (k === 'moneyGroups') { try { state.settings.moneyGroups = JSON.parse(v); } catch(e){} }
else if (k === 'favoriteAccounts') { try { state.settings.favoriteAccounts = JSON.parse(v); } catch(e){} }
else if (k === 'favoriteCurrencies') { try { state.settings.favoriteCurrencies = JSON.parse(v); } catch(e){} }
else if (k === 'draftSources') { try { draftSources = JSON.parse(v) || {}; } catch(e){} }
else if (k === 'currencyConfig') { try { state.settings.currencyConfig = JSON.parse(v); } catch(e){} }
else if (k === 'rateHistory') { try { state.settings.rateHistory = JSON.parse(v); } catch(e){} }
else if (k === 'remindersEnabled') state.settings.remindersEnabled = (v === 'true');
else if (k === 'notifyCategories') { try { state.settings.notifyCategories = JSON.parse(v); } catch(e){} }
else if (k === 'lastBackupAt') state.settings.lastBackupAt = v;
else if (k === 'notificationSeen') { try { state.settings.notificationSeen = JSON.parse(v); } catch(e){} }
else if (k === 'quietHours') state.settings.quietHours = (v === 'true');
else if (k === 'quietStart') state.settings.quietStart = v;
else if (k === 'quietEnd') state.settings.quietEnd = v;
else if (k === 'dailyCap') state.settings.dailyCap = Number(v) >= 0 ? Math.round(Number(v)) : 3;
else if (k === 'backupReminderDays') state.settings.backupReminderDays = Number(v) >= 0 ? Math.round(Number(v)) : 30;
else if (k === 'notifyCategories') { try { state.settings.notifyCategories = JSON.parse(v); } catch(e){} }
else if (k === 'defaultDueDays') state.settings.defaultDueDays = Number(v) > 0 ? Math.round(Number(v)) : 3;
else if (k === 'launchCount') state.settings.launchCount = Number(v) || 0;
else if (k === 'exampleStats') { try { state.settings.exampleStats = JSON.parse(v); } catch(e){} }
});
}
} catch (e) {}
if (!applyBase(state.settings.baseCurrency || 'SAR', state.settings.baseSarRate)) applyBase('SAR');
state.settings.baseCurrency = BASE;
if (!state.settings.uxProgram) clearUxData();
try {
var arows = db.exec('SELECT id,name,type,subtype,nickname,nature,currency,liquid,glyph,hint,phone,email,is_account,multi,currencies FROM accounts');
if (arows && arows[0] && arows[0].values.length) {
state.accounts = arows[0].values.map(function (r) {
return { id: r[0], name: r[1], type: r[2], subtype: r[3] || '', nickname: r[4] || '', nature: r[5], currency: r[6], liquid: !!r[7], glyph: r[8], hint: r[9], phone: r[10] || null, email: r[11] || null, is_account: !!r[12], multi: !!r[13], currencies: r[14] ? String(r[14]).split(',') : [] };
});
}
} catch (e) { log('warn', 'Could not load accounts', e); }
try {
var cprows = db.exec('SELECT id,name,phone,email,address,notes,type FROM counterparties');
if (cprows && cprows[0] && cprows[0].values.length) {
state.counterparties = cprows[0].values.map(function (r) {
return { id: r[0], name: r[1], phone: r[2] || null, email: r[3] || null, address: r[4] || null, notes: r[5] || null, type: r[6] || 'other' };
});
}
} catch (e) { log('warn', 'Could not load counterparties', e); }
try {
var dirows = db.exec('SELECT id,kind,counterparty,counterparty_id,dueDate,amount,remaining,settled,createdAt,updatedAt,entryId,currency,native,remainingNative,rate FROM due_items');
if (dirows && dirows[0]) {
state.dueItems = dirows[0].values.map(function (r) {
var d = { id: r[0], kind: r[1], counterparty: r[2], counterparty_id: r[3] || null, dueDate: r[4], amount: r[5], remaining: r[6], settled: !!r[7], createdAt: r[8], updatedAt: r[9], entryId: r[10] || null };
if (r[11]) { d.currency = r[11]; d.native = r[12]; d.remainingNative = r[13]; d.rate = r[14]; }
return d;
});
}
} catch (e) { log('warn', 'Could not load due items', e); }
ACCOUNT_DEFS.forEach(function (def) {
var found = false;
for (var i = 0; i < state.accounts.length; i++) if (state.accounts[i].id === def.id) found = true;
if (!found) state.accounts.push({ id: def.id, name: def.name, hint: def.hint, type: def.type, nature: def.nature, currency: def.currency, liquid: def.liquid, glyph: def.glyph });
});
try {
var erows = db.exec('SELECT id,date,dueDate,kind,currency,counterparty,memo,totalBase,createdAt FROM entries');
if (erows && erows[0]) {
state.entries = erows[0].values.map(function (r) {
return { id: r[0], date: r[1], dueDate: r[2], kind: r[3], currency: r[4], counterparty: r[5], memo: r[6], totalBase: r[7], createdAt: r[8], lines: [] };
});
}
} catch (e) {}
try {
var lrows = db.exec('SELECT entry_id,accountId,currency,debit,credit,debitBase,creditBase,rate FROM entry_lines');
if (lrows && lrows[0]) {
var byEntry = {};
lrows[0].values.forEach(function (r) {
var lid = r[0];
if (!byEntry[lid]) byEntry[lid] = [];
byEntry[lid].push({ accountId: r[1], currency: r[2], debit: r[3], credit: r[4], debitBase: r[5], creditBase: r[6], rate: r[7] || null });
});
state.entries.forEach(function (e) { e.lines = byEntry[e.id] || []; });
}
} catch (e) {}
state.entries = state.entries.filter(function (e) { return e && Array.isArray(e.lines); }).map(function (e) {
if (!isValidDate(e.date)) e.date = todayISO();
if (!e.id) e.id = uid('entry');
if (!Array.isArray(e.lines)) e.lines = [];
return e;
});
try {
var drows = db.exec('SELECT id,kind,date,dueDate,currency,counterparty,memo,totalBase,createdAt FROM drafts');
if (drows && drows[0]) {
state.drafts = drows[0].values.map(function (r) {
return { id: r[0], kind: r[1], date: r[2], dueDate: r[3], currency: r[4], counterparty: r[5], memo: r[6], totalBase: r[7], createdAt: r[8], lines: [] };
});
}
} catch (e) {}
try {
var dlrows = db.exec('SELECT draft_id,accountId,currency,debit,credit,debitBase,creditBase,rate FROM draft_lines');
if (dlrows && dlrows[0]) {
var byDraft = {};
dlrows[0].values.forEach(function (r) {
var did = r[0];
if (!byDraft[did]) byDraft[did] = [];
byDraft[did].push({ accountId: r[1], currency: r[2], debit: r[3], credit: r[4], debitBase: r[5], creditBase: r[6], rate: r[7] || null });
});
state.drafts.forEach(function (d) { d.lines = byDraft[d.id] || []; });
}
} catch (e) {}
state.drafts = state.drafts.filter(function (d) { return d && Array.isArray(d.lines) && d.lines.length; });
state.drafts.forEach(function (d) { if (draftSources[d.id]) d.sourceEntryId = draftSources[d.id]; });
try {
var dirows = db.exec('SELECT id,kind,counterparty,counterparty_id,dueDate,amount,remaining,settled,createdAt,updatedAt,entryId,currency,native,remainingNative,rate FROM due_items');
if (dirows && dirows[0]) {
state.dueItems = dirows[0].values.map(function (r) {
var d = { id: r[0], kind: r[1], counterparty: r[2], counterparty_id: r[3] || null, dueDate: r[4], amount: r[5], remaining: r[6], settled: !!r[7], createdAt: r[8], updatedAt: r[9], entryId: r[10] || null };
if (r[11]) { d.currency = r[11]; d.native = r[12]; d.remainingNative = r[13]; d.rate = r[14]; }
return d;
});
}
} catch (e) {}
(state.dueItems || []).forEach(normalizeDue);
try {
var strows = db.exec('SELECT id,entryId,dueId,amount,createdAt,native FROM settlements');
if (strows && strows[0]) {
state.settlements = strows[0].values.map(function (r) {
var s = { id: r[0], entryId: r[1], dueId: r[2], amount: r[3], createdAt: r[4] };
if (r[5] != null) s.native = r[5];
return s;
});
}
} catch (e) {}
try {
var mrows = db.exec('SELECT id,role,type,text,chips,draftId,entryId,data,at FROM messages');
if (mrows && mrows[0]) {
state.messages = mrows[0].values.map(function (r) {
var m = { id: r[0], role: r[1], type: r[2], text: r[3], chips: !!r[4], at: r[8] };
if (r[5]) m.draftId = r[5];
if (r[6]) m.entryId = r[6];
if (r[7]) { try { m.data = JSON.parse(r[7]); } catch(e){} }
return m;
});
}
} catch (e) {}
}
try {
var vrows = db.exec('SELECT id,kind,text,account_id,vector,created_at,usage_count FROM semantic_vectors');
if (vrows && vrows[0]) {
_vectorMemory = vrows[0].values.map(function (r) {
var v = null;
try { v = JSON.parse(r[4]); } catch (e) { v = null; }
return { id: r[0], kind: r[1], text: r[2], accountId: r[3], vector: v, createdAt: r[5], usageCount: r[6] || 1 };
}).filter(function (x) { return x.vector; });
}
} catch (e) {}
var persistRunning = null;
var persistQueued = false;
var STATE_TABLES = ['settings','accounts','counterparties','entries','entry_lines','drafts','draft_lines','due_items','settlements','messages','users','roles','role_permissions','user_sessions','audit_log','event_log','license_sales','semantic_vectors'];
var ROW_KEYS = { settings: 'key', accounts: 'id', counterparties: 'id', entries: 'id', entry_lines: 'entry_id',
drafts: 'id', draft_lines: 'draft_id', due_items: 'id', settlements: 'id', messages: 'id',
users: 'id', roles: 'id', role_permissions: 'role', user_sessions: 'id', audit_log: 'id', event_log: 'id', license_sales: 'id', semantic_vectors: 'id' };
var writtenRows = {};
var lastSave = null;
var exportedChanges = -1;
function totalChanges() { try { return Number(db.exec('SELECT total_changes()')[0].values[0][0]); } catch (e) { return -2; } }
var saveTimer = null;
var savePromise = null;
var saveResolve = null;
function scheduleSave() {
if (saveTimer) return savePromise;
savePromise = new Promise(function (resolve) {
saveResolve = resolve;
saveTimer = setTimeout(function () {
saveTimer = null;
resolve(persistStateToDb());
}, 0);
});
return savePromise;
}
function flushSaves() {
if (saveTimer) {
clearTimeout(saveTimer);
saveTimer = null;
saveResolve(persistStateToDb());
}
return persistRunning || Promise.resolve(saveStatus);
}
function persistStateToDb() {
if (persistRunning) {
persistQueued = true;
return persistRunning;
}
persistRunning = (async function () {
try {
do {
persistQueued = false;
await writeStateToDb();
} while (persistQueued);
} catch (e) {
log('error', 'DB persist failed', e);
setSaveStatus('failed', errorText(e));
} finally {
persistRunning = null;
}
return saveStatus;
})();
return persistRunning;
}
async function writeStateToDb() {
if (!db || !state) return;
if (storageFault) { setSaveStatus('failed', storageFault.kind); return; }
var failures = 0;
var firstError = null;
var brokenTables = {};
var ops = [];
try {
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['hideAmounts', String(!!state.settings.hideAmounts)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['simpleMode', String(!!state.settings.simpleMode)]]);
if (state.settings.recurring && state.settings.recurring.length) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['recurring', JSON.stringify(state.settings.recurring)]]);
if (state.settings.budgets && state.settings.budgets.length) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['budgets', JSON.stringify(state.settings.budgets)]]);
if (state.settings.assistantSeen && Object.keys(state.settings.assistantSeen).length) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['assistantSeen', JSON.stringify(state.settings.assistantSeen)]]);
if (state.settings.assistantMuted && state.settings.assistantMuted.length) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['assistantMuted', JSON.stringify(state.settings.assistantMuted)]]);
if (state.settings.assistantLevel) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['assistantLevel', state.settings.assistantLevel]]);
if (state.settings.notifyDetail) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['notifyDetail', state.settings.notifyDetail]]);
if (state.settings.assistantGoal) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['assistantGoal', JSON.stringify(state.settings.assistantGoal)]]);
if (state.settings.netWorthHistory && state.settings.netWorthHistory.length) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['netWorthHistory', JSON.stringify(state.settings.netWorthHistory)]]);
if (state.settings.featureUsage) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['featureUsage', JSON.stringify(state.settings.featureUsage)]]);
if (state.settings.speedStreak) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['speedStreak', String(state.settings.speedStreak)]]);
if (state.settings.speedStreakDate) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['speedStreakDate', state.settings.speedStreakDate]]);
if (state.settings.accountUsage) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['accountUsage', JSON.stringify(state.settings.accountUsage)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['currency', state.settings.currency || BASE]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['baseCurrency', BASE]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['onboarded', String(!!state.settings.onboarded)]]);
if (state.settings.persona) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['persona', String(state.settings.persona)]]);
if (state.settings.baseSarRate) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['baseSarRate', String(state.settings.baseSarRate)]]);
if (state.settings.profile) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['profile', JSON.stringify(state.settings.profile)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['aiEnabled', String(!!state.settings.aiEnabled)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['aiAlwaysAllow', String(!!state.settings.aiAlwaysAllow)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['theme', state.settings.theme || 'light']]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['fontStep', String(state.settings.fontStep || 0)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['autoTts', String(!!state.settings.autoTts)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['trainingOption', String(!!state.settings.trainingOption)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['dictionaryOption', String(!!state.settings.dictionaryOption)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['ownerCodesOption', String(!!state.settings.ownerCodesOption)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['verifyActions', String(!!state.settings.verifyActions)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['appLock', String(!!state.settings.appLock)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['uxProgram', String(!!state.settings.uxProgram)]]);
if (state.settings.uxAskedAt) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['uxAskedAt', String(state.settings.uxAskedAt)]]);
if ((state.settings.activationCodes || []).length) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['activationCodes', JSON.stringify(state.settings.activationCodes)]]);
if ((state.settings.revokedCodes || []).length) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['revokedCodes', JSON.stringify(state.settings.revokedCodes)]]);
if ((state.settings.usedPromos || []).length) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['usedPromos', JSON.stringify(state.settings.usedPromos)]]);
if (state.settings.featureTrials && Object.keys(state.settings.featureTrials).length) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['featureTrials', JSON.stringify(state.settings.featureTrials)]]);
if (state.settings.maxSeenDate) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['maxSeenDate', String(state.settings.maxSeenDate)]]);
if (state.settings.activatedAt) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['activatedAt', String(state.settings.activatedAt)]]);
if (state.settings.entriesAtActivation != null) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['entriesAtActivation', String(state.settings.entriesAtActivation)]]);
if (state.settings.appLockMinutes != null) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['appLockMinutes', String(state.settings.appLockMinutes)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['ownerGate', String(state.settings.ownerGate !== false)]]);
if (state.settings.language) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['language', state.settings.language]]);
if (state.settings.dialectRank) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['dialectRank', String(state.settings.dialectRank)]]);
if (state.settings.rates) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['rates', JSON.stringify(state.settings.rates)]]);
if (state.settings.ratesUpdatedAt) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['ratesUpdatedAt', state.settings.ratesUpdatedAt]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['vocabVersion', String(state.settings.vocabVersion || 0)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['schemaVersion', String(SCHEMA_VERSION)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['autoLearn', String(!!state.settings.autoLearn)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['vectorMemoryEnabled', String(!!state.settings.vectorMemoryEnabled)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['vectorAutoConfirm', String(!!state.settings.vectorAutoConfirm)]]);
if (state.settings.aiConfig) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['aiConfig', JSON.stringify(state.settings.aiConfig)]]);
if (state.settings.plan) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['plan', JSON.stringify(state.settings.plan)]]);
if (state.settings.moneyGroups) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['moneyGroups', JSON.stringify(state.settings.moneyGroups)]]);
if (state.settings.favoriteAccounts) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['favoriteAccounts', JSON.stringify(state.settings.favoriteAccounts)]]);
if (state.settings.favoriteCurrencies) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['favoriteCurrencies', JSON.stringify(state.settings.favoriteCurrencies)]]);
if (state.settings.currencyConfig) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['currencyConfig', JSON.stringify(state.settings.currencyConfig)]]);
if (state.settings.rateHistory) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['rateHistory', JSON.stringify(state.settings.rateHistory)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['remindersEnabled', String(!!state.settings.remindersEnabled)]]);
if (state.settings.notifyCategories) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['notifyCategories', JSON.stringify(state.settings.notifyCategories)]]);
if (state.settings.lastBackupAt) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['lastBackupAt', String(state.settings.lastBackupAt)]]);
if (state.settings.notificationSeen) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['notificationSeen', JSON.stringify(state.settings.notificationSeen)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['quietHours', String(!!state.settings.quietHours)]]);
if (state.settings.quietStart) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['quietStart', String(state.settings.quietStart)]]);
if (state.settings.quietEnd) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['quietEnd', String(state.settings.quietEnd)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['dailyCap', String(state.settings.dailyCap == null ? 3 : state.settings.dailyCap)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['backupReminderDays', String(state.settings.backupReminderDays == null ? 30 : state.settings.backupReminderDays)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['defaultDueDays', String(state.settings.defaultDueDays || 3)]]);
ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['launchCount', String(state.settings.launchCount || 0)]]);
if (state.settings.exampleStats) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['exampleStats', JSON.stringify(state.settings.exampleStats)]]);
var draftSources = {};
(state.drafts || []).forEach(function (d) { if (d.sourceEntryId) draftSources[d.id] = d.sourceEntryId; });
if (Object.keys(draftSources).length) ops.push(['INSERT INTO settings (key,value) VALUES (?,?)', ['draftSources', JSON.stringify(draftSources)]]);
} catch (e) {
failures++;
firstError = firstError || ('settings: ' + errorText(e));
log('error', 'Could not prepare settings', e);
}
(state.accounts||[]).forEach(function (a) {
ops.push(['INSERT INTO accounts (id,code,name,type,subtype,nickname,nature,currency,liquid,glyph,hint,phone,email,is_account,multi,currencies) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
[a.id, a.id, a.name, a.type, a.subtype||'', a.nickname||'', a.nature, a.currency, a.liquid?1:0, a.glyph, a.hint||null, a.phone||null, a.email||null, a.is_account?1:0, a.multi?1:0, (a.currencies||[]).join(',')||null]]);
});
(state.counterparties||[]).forEach(function (c) {
ops.push(['INSERT INTO counterparties (id,name,phone,email,address,notes,type) VALUES (?,?,?,?,?,?,?)',
[c.id, c.name, c.phone||null, c.email||null, c.address||null, c.notes||null, c.type||'other']]);
});
(state.entries||[]).forEach(function (e) {
ops.push(['INSERT INTO entries (id,date,dueDate,kind,currency,counterparty,counterparty_id,memo,totalBase,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
[e.id, e.date, e.dueDate||null, e.kind, e.currency, e.counterparty||'', e.counterparty_id||null, e.memo||'', e.totalBase, e.createdAt||new Date().toISOString()]]);
(e.lines||[]).forEach(function (l) {
ops.push(['INSERT INTO entry_lines (entry_id,accountId,currency,debit,credit,debitBase,creditBase,rate,note) VALUES (?,?,?,?,?,?,?,?,?)',
[e.id, l.accountId, l.currency, l.debit||0, l.credit||0, l.debitBase||0, l.creditBase||0, lineRate(l), l.note||'']]);
});
});
(state.drafts||[]).forEach(function (d) {
ops.push(['INSERT INTO drafts (id,kind,date,dueDate,currency,counterparty,memo,totalBase,createdAt) VALUES (?,?,?,?,?,?,?,?,?)',
[d.id, d.kind, d.date, d.dueDate||null, d.currency, d.counterparty||'', d.memo||'', d.totalBase, d.createdAt||new Date().toISOString()]]);
(d.lines||[]).forEach(function (l) {
ops.push(['INSERT INTO draft_lines (draft_id,accountId,currency,debit,credit,debitBase,creditBase,rate) VALUES (?,?,?,?,?,?,?,?)',
[d.id, l.accountId, l.currency, l.debit||0, l.credit||0, l.debitBase||0, l.creditBase||0, lineRate(l)]]);
});
});
(state.dueItems||[]).forEach(function (d) {
ops.push(['INSERT INTO due_items (id,kind,counterparty,counterparty_id,dueDate,amount,remaining,settled,createdAt,updatedAt,entryId,currency,native,remainingNative,rate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
[d.id, d.kind, d.counterparty||'', d.counterparty_id||null, d.dueDate||null, d.amount, d.remaining, d.settled?1:0, d.createdAt||new Date().toISOString(), d.updatedAt||new Date().toISOString(), d.entryId||null,
d.currency||null, d.native == null ? null : d.native, d.remainingNative == null ? null : d.remainingNative, d.rate == null ? null : d.rate]]);
});
(state.settlements||[]).forEach(function (s) {
ops.push(['INSERT INTO settlements (id,entryId,dueId,amount,createdAt,native) VALUES (?,?,?,?,?,?)',
[s.id, s.entryId, s.dueId, s.amount, s.createdAt||new Date().toISOString(), s.native == null ? null : s.native]]);
});
(state.messages||[]).forEach(function (m) {
ops.push(['INSERT INTO messages (id,role,type,text,chips,draftId,entryId,data,at) VALUES (?,?,?,?,?,?,?,?,?)',
[m.id, m.role||'bot', m.type||'text', m.text||'', m.chips?1:0, m.draftId||null, m.entryId||null, m.data?JSON.stringify(m.data):null, m.at||new Date().toISOString()], true]);
});
var groups = {};
STATE_TABLES.forEach(function (t) { groups[t] = {}; });
ops.forEach(function (op) {
var t = opTable(op);
var k = String(op[1][0]);
(groups[t][k] = groups[t][k] || []).push(op);
});
var nextRows = {};
var deletes = [];
var pending = [];
var fullTables = {};
STATE_TABLES.forEach(function (t) {
var next = {};
Object.keys(groups[t]).forEach(function (k) { next[k] = JSON.stringify(groups[t][k]); });
nextRows[t] = next;
var before = writtenRows[t];
if (!before) {
fullTables[t] = true;
deletes.push(['DELETE FROM ' + t, []]);
Object.keys(groups[t]).forEach(function (k) { Array.prototype.push.apply(pending, groups[t][k]); });
return;
}
Object.keys(before).forEach(function (k) {
if (next[k] !== before[k]) deletes.push(['DELETE FROM ' + t + ' WHERE ' + ROW_KEYS[t] + ' = ?', [k]]);
});
Object.keys(next).forEach(function (k) {
if (next[k] !== before[k]) Array.prototype.push.apply(pending, groups[t][k]);
});
});
writtenRows = {};
db.run('BEGIN');
deletes.forEach(function (d) {
var t = /FROM (\w+)/.exec(d[0])[1];
try { db.run(d[0], d[1]); } catch (e) {
brokenTables[t] = true;
firstError = firstError || (t + ': ' + errorText(e));
log('error', 'Could not clear ' + t, e);
}
});
var CHUNK = 200;
for (var i = 0; i < pending.length; i += CHUNK) {
var slice = pending.slice(i, i + CHUNK);
for (var j = 0; j < slice.length; j++) {
try {
db.run(slice[j][0], bindable(slice[j][1]));
} catch (e) {
brokenTables[opTable(slice[j])] = true;
firstError = firstError || (opTable(slice[j]) + ': ' + errorText(e));
log('error', 'Insert failed: ' + slice[j][0].slice(0, 40), e);
}
}
if (i + CHUNK < pending.length) await new Promise(function (res) { setTimeout(res, 0); });
}
lastSave = { statements: deletes.length + pending.length, full: Object.keys(fullTables).length === STATE_TABLES.length, fullTables: Object.keys(fullTables) };
Object.keys(brokenTables).forEach(function (t) {
try {
db.run('DROP TABLE IF EXISTS ' + t);
db.run(schemaFor(t));
log('warn', 'Rebuilt table ' + t);
} catch (e) {
failures++;
log('error', 'Could not rebuild ' + t, e);
return;
}
ops.forEach(function (op) {
if (opTable(op) !== t) return;
try {
db.run(op[0], bindable(op[1]));
} catch (e) {
if (!op[2]) failures++;
log('error', 'Insert failed after rebuild: ' + op[0].slice(0, 40), e);
}
});
});
if (failures) {
log('error', 'Save stopped: ' + failures + ' statements failed.');
try { db.run('ROLLBACK'); } catch (e) { log('error', 'Could not roll back a save', e); }
setSaveStatus('failed', firstError);
return;
}
db.run('COMMIT');
writtenRows = nextRows;
var changesNow = totalChanges();
if (changesNow >= 0 && changesNow === exportedChanges && saveStatus === 'ok') { if (lastSave) lastSave.exported = false; return; }
exportedChanges = changesNow;
if (lastSave) lastSave.exported = true;
try {
try { db.run('PRAGMA optimize'); } catch (e) {}
var bytes = await sealBytes(db.export());
var seq = ++saveSeq;
storeError = null;
var idbOk = false;
for (var idbTry = 0; idbTry < 3 && !idbOk; idbTry++) {
if (idbTry > 0) await new Promise(function (res) { setTimeout(res, 50 * idbTry); });
idbOk = await idbSaveBytes(bytes, seq);
}
if (idbOk) {
clearFallback();
setSaveStatus('ok');
} else if (writeFallback(bytes, seq)) {
log('warn', 'IndexedDB save failed after retries; fell back to localStorage.');
setSaveStatus('fallback', storeError);
} else {
setSaveStatus('failed', storeError);
}
} catch (e) {
log('error', 'DB persist failed', e);
setSaveStatus('failed', errorText(e));
}
}
function opTable(op) {
return /INSERT INTO (\w+)/.exec(op[0])[1];
}
function bindable(params) {
return params.map(function (v) { return v === undefined ? null : v; });
}
async function loadState() {
await initDb();
if (saveTimer) await savePromise;
if (persistRunning) await persistRunning;
loadStateFromDb();
ensureMemoryLoaded();
if (!state) state = freshState();
state = ensureState(state);
_stateRev++;
_analysisCache = null;
_analysisCacheKey = null;
_parseCache.clear();
writtenRows = {};
exportedChanges = -1;
log('info', 'State loaded: ' + state.entries.length + ' entries.');
return state;
}
function saveState() {
if (!state) return;
state.updatedAt = new Date().toISOString();
_stateRev++;
_analysisCache = null;
_analysisCacheKey = null;
_parseCache.clear();
try {
if (dbReady) return scheduleSave();
if (!storageKey) storageSet(STORAGE_KEY, JSON.stringify(state));
} catch (e) {
log('error', 'Failed to persist state.', e);
}
}
var BACKUP_STORE = 'rohapp-backups';
function openBackupDb() {
return new Promise(function (resolve, reject) {
if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
var req = indexedDB.open(BACKUP_STORE, 1);
req.onupgradeneeded = function (e) {
var db = e.target.result;
if (!db.objectStoreNames.contains('backups')) {
db.createObjectStore('backups', { keyPath: 'id' });
}
};
req.onsuccess = function (e) { resolve(e.target.result); };
req.onerror = function (e) { reject(e.target.error); };
});
}
var BACKUP_REASON_LABELS = {
daily: 'نسخة يومية تلقائية',
manual: 'نسخة يدوية فورية',
'pre-restore': 'نسخة أمان قبل الاستعادة',
'pre-reset': 'نسخة أمان قبل مسح البيانات',
'pre-import': 'نسخة أمان قبل استيراد ملف',
upgrade: 'نسخة أمان عند التحديث'
};
var fallbackBackups = [];
var backupSeq = 0;
async function saveBackupRecord(rec) {
try {
var db = await openBackupDb();
var tx = db.transaction('backups', 'readwrite');
var store = tx.objectStore('backups');
store.put(rec);
var all = await new Promise(function (resolve) {
var req = store.getAll();
req.onsuccess = function () { resolve(req.result || []); };
req.onerror = function () { resolve([]); };
});
all.sort(function (a, b) { return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1; });
while (all.length > 7) {
var old = all.shift();
store.delete(old.id);
}
await new Promise(function (resolve) { tx.oncomplete = resolve; tx.onerror = resolve; });
db.close();
return true;
} catch (e) {
fallbackBackups = fallbackBackups.filter(function (x) { return x.id !== rec.id; });
fallbackBackups.push(rec);
fallbackBackups.sort(function (a, b) { return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1; });
while (fallbackBackups.length > 7) fallbackBackups.shift();
return true;
}
}
async function autoBackup(opts) {
opts = opts || {};
if (!state || !state.settings) return { ok: false, reason: 'no state' };
var force = !!opts.force;
var reason = opts.reason || (force ? 'manual' : 'daily');
if (!force && state.settings.autoBackup === false) return { ok: false, reason: 'disabled' };
var now = Date.now();
var last = state.settings.lastBackupAt ? new Date(state.settings.lastBackupAt).getTime() : 0;
if (!force && (now - last < 24 * 60 * 60 * 1000)) return { ok: false, reason: 'too soon' };
try {
backupSeq++;
var id = 'backup_' + now + '_' + backupSeq;
var data = JSON.stringify(state);
var rec = {
id: id,
createdAt: new Date(now).toISOString(),
reason: reason,
label: BACKUP_REASON_LABELS[reason] || BACKUP_REASON_LABELS.daily,
entryCount: (state.entries || []).length,
accountCount: (state.accounts || []).length,
data: data,
size: data.length
};
await saveBackupRecord(rec);
state.settings.lastBackupAt = rec.createdAt;
saveState();
log('info', 'Backup created (' + reason + '): ' + id);
return { ok: true, id: id, reason: reason, label: rec.label, entryCount: rec.entryCount, createdAt: rec.createdAt };
} catch (e) {
log('warn', 'Auto-backup failed', e);
return { ok: false, reason: String(e) };
}
}
async function createSafetySnapshot(reason) {
if (!state || !Array.isArray(state.entries) || state.entries.length === 0) {
return { ok: true, skipped: true };
}
return autoBackup({ force: true, reason: reason || 'pre-restore' });
}
async function listBackups() {
try {
var db = await openBackupDb();
var tx = db.transaction('backups', 'readonly');
var store = tx.objectStore('backups');
var all = await new Promise(function (resolve) {
var req = store.getAll();
req.onsuccess = function () { resolve(req.result || []); };
req.onerror = function () { resolve([]); };
});
db.close();
return all.sort(function (a, b) { return (a.createdAt || '') > (b.createdAt || '') ? -1 : 1; });
} catch (e) {
return fallbackBackups.slice().sort(function (a, b) { return (a.createdAt || '') > (b.createdAt || '') ? -1 : 1; });
}
}
async function deleteBackup(id) {
if (!id) return { ok: false };
try {
var db = await openBackupDb();
var tx = db.transaction('backups', 'readwrite');
tx.objectStore('backups').delete(id);
await new Promise(function (resolve) { tx.oncomplete = resolve; tx.onerror = resolve; });
db.close();
} catch (e) {}
fallbackBackups = fallbackBackups.filter(function (x) { return x.id !== id; });
return { ok: true };
}
function previewBackup(rawInput) {
try {
var raw = (typeof rawInput === 'string') ? JSON.parse(rawInput) : rawInput;
if (!raw || typeof raw !== 'object') return { ok: false, error: 'ملف غير صالح' };
var next = ensureState(JSON.parse(JSON.stringify(raw)));
var check = validateState(next);
if (!check.ok) return { ok: false, error: check.error };
var dates = (next.entries || []).map(function (e) { return e.date; }).filter(Boolean).sort();
return {
ok: true,
entryCount: (next.entries || []).length,
accountCount: (next.accounts || []).length,
dueCount: (next.dueItems || []).filter(function (d) { return !d.settled && d.remaining > 0; }).length,
lastDate: dates.length ? dates[dates.length - 1] : null,
baseCurrency: (next.settings && next.settings.baseCurrency) || BASE,
hasActivation: !!(next.settings && next.settings.activationCodes && next.settings.activationCodes.length),
integrityVerified: true
};
} catch (e) {
return { ok: false, error: 'تعذر قراءة أو فحص الملف' };
}
}
async function restoreBackup(id, opts) {
opts = opts || {};
try {
var rec = null;
try {
var db = await openBackupDb();
var tx = db.transaction('backups', 'readonly');
var store = tx.objectStore('backups');
rec = await new Promise(function (resolve) {
var req = store.get(id);
req.onsuccess = function () { resolve(req.result); };
req.onerror = function () { resolve(null); };
});
db.close();
} catch (e) {
rec = fallbackBackups.filter(function (x) { return x.id === id; })[0] || null;
}
if (!rec || !rec.data) return { ok: false, error: 'النسخة غير موجودة' };
var raw = JSON.parse(rec.data);
var check = validateState(ensureState(raw));
if (!check.ok) return { ok: false, error: check.error };
var safetySnap = null;
if (opts.skipSafetySnapshot !== true && state && (state.entries || []).length > 0 && rec.reason !== 'pre-restore') {
safetySnap = await createSafetySnapshot('pre-restore');
}
var rep = replaceState(raw);
if (!rep.ok) return rep;
return { ok: true, safetySnapshotId: safetySnap && safetySnap.id ? safetySnap.id : null, entryCount: (state.entries || []).length };
} catch (e) {
return { ok: false, error: String(e) };
}
}
async function resolveDamagedDb(raw) {
if (!storageFault || storageFault.kind !== 'damaged') return { ok: false, error: 'لا توجد قاعدة بيانات تالفة' };
if (raw) {
var check = validateState(ensureState(raw));
if (!check.ok) return check;
}
if (!await archiveDamagedBytes(storageFault.bytes)) return { ok: false, error: 'تعذر الاحتفاظ بنسخة من الملف التالف' };
storageFault = null;
writtenRows = {};
exportedChanges = -1;
if (raw) replaceState(raw);
else resetState();
var status = await persistStateToDb();
return status === 'failed' ? { ok: false, error: 'تعذر حفظ البيانات' } : { ok: true };
}
function getState() {
if (!state) {
state = freshState();
}
return state;
}
function replaceState(raw) {
var next = ensureState(raw);
var check = validateState(next);
if (!check.ok) return check;
var plan = storedPlan();
var codesHere = (state && state.settings && state.settings.activationCodes) || [];
var revHere = revokedList();
var promosHere = usedPromosList();
state = next;
state.settings.plan = plan;
state.settings.activationCodes = mergeActivationCodes(state.settings.activationCodes, codesHere);
var revFromBackup = Array.isArray(state.settings.revokedCodes) ? state.settings.revokedCodes : [];
var mergedRev = [];
revHere.concat(revFromBackup).forEach(function (h) { if (h && mergedRev.indexOf(h) < 0) mergedRev.push(h); });
if (mergedRev.length) {
state.settings.revokedCodes = mergedRev;
storageSet(REVOKED_KEY, JSON.stringify(mergedRev));
}
var promosFromBackup = Array.isArray(state.settings.usedPromos) ? state.settings.usedPromos : [];
var mergedPromos = [];
promosHere.concat(promosFromBackup).forEach(function (p) { if (p && mergedPromos.indexOf(p) < 0) mergedPromos.push(p); });
if (mergedPromos.length) {
state.settings.usedPromos = mergedPromos;
storageSet(USED_PROMOS_KEY, JSON.stringify(mergedPromos));
}
saveState();
return { ok: true };
}
function resetState() {
var plan = storedPlan();
var codesHere = (state && state.settings && state.settings.activationCodes) || [];
var revHere = revokedList();
var promosHere = usedPromosList();
state = freshState();
state.settings.plan = plan;
if (codesHere.length) state.settings.activationCodes = codesHere.slice();
if (revHere.length) state.settings.revokedCodes = revHere.slice();
if (promosHere.length) state.settings.usedPromos = promosHere.slice();
saveState();
return state;
}
function validateState(candidate) {
if (!candidate || typeof candidate !== 'object') return { ok: false, error: 'ملف غير صالح' };
if (!Array.isArray(candidate.entries)) return { ok: false, error: 'لا يحتوي على قيود' };
if (!Array.isArray(candidate.accounts)) return { ok: false, error: 'لا يحتوي على حسابات' };
var debit = 0, credit = 0;
var seenIds = {};
for (var i = 0; i < candidate.entries.length; i++) {
var entry = candidate.entries[i];
if (!entry || !Array.isArray(entry.lines)) return { ok: false, error: 'قيد رقم ' + (i + 1) + ' تالف' };
if (seenIds[entry.id]) return { ok: false, error: 'قيد رقم ' + (i + 1) + ' مكرر' };
seenIds[entry.id] = true;
var entryDebit = 0, entryCredit = 0;
for (var j = 0; j < entry.lines.length; j++) {
var dl = Number(entry.lines[j].debitBase) || 0;
var cl = Number(entry.lines[j].creditBase) || 0;
entryDebit += dl;
entryCredit += cl;
debit += dl;
credit += cl;
}
if (entryDebit !== entryCredit) return { ok: false, error: 'قيد رقم ' + (i + 1) + ' غير متوازن محاسبياً' };
}
if (debit !== credit) return { ok: false, error: 'الملف غير متوازن محاسبياً' };
return { ok: true, entries: candidate.entries.length };
}
function exportJSON() {
return JSON.stringify(getState(), null, 2);
}
function _parseCSV(text) {
var rows = [];
var row = [];
var field = '';
var inQuotes = false;
var i = 0;
var n = String(text || '').length;
while (i < n) {
var ch = text.charAt(i);
if (inQuotes) {
if (ch === '"') {
if (i + 1 < n && text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
inQuotes = false; i++; continue;
}
field += ch; i++; continue;
}
if (ch === '"') { inQuotes = true; i++; continue; }
if (ch === ',') { row.push(field); field = ''; i++; continue; }
if (ch === '\n') { row.push(field); field = ''; if (row.some(function (f) { return String(f).trim() !== ''; })) rows.push(row); row = []; i++; continue; }
if (ch === '\r') { i++; continue; }
field += ch; i++;
}
if (field !== '' || row.length > 0) { row.push(field); if (row.some(function (f) { return String(f).trim() !== ''; })) rows.push(row); }
return rows;
}
function _csvHeaderMap(header) {
var map = {};
(header || []).forEach(function (h, idx) {
var key = normalizeAr(String(h || '')).trim().toLowerCase();
var canon = null;
if (/^(date|تاريخ|التاريخ|يوم)$/.test(key)) canon = 'date';
else if (/^(kind|نوع|operation|type|عملية|قيد)$/.test(key)) canon = 'kind';
else if (/^(amount|مبلغ|المبلغ|value|قيمة)$/.test(key)) canon = 'amount';
else if (/^(currency|عملة|العملة|cur)$/.test(key)) canon = 'currency';
else if (/^(counterparty|طرف|اسم|الطرف|name|customer|supplier)$/.test(key)) canon = 'counterparty';
else if (/^(memo|سرد|بيان|وصف|description|note|ملاحظة)$/.test(key)) canon = 'memo';
else if (/^(account|حساب|الحساب|acc)$/.test(key)) canon = 'account';
else if (/^(due|duedate|استحقاق|تاريخ الاستحقاق|due_date)$/.test(key)) canon = 'dueDate';
if (canon && map[canon] === undefined) map[canon] = idx;
});
return map;
}
function _parseCSVAmount(s) {
s = String(s || '').trim();
s = s.replace(/[\u0660-\u0669]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); });
s = s.replace(/[\u06F0-\u06F9]/g, function (c) { return String(c.charCodeAt(0) - 0x06F0); });
if (s.indexOf(',') >= 0 && s.indexOf('.') < 0) {
s = s.replace(/\s/g, '').replace(',', '.');
} else {
s = s.replace(/,/g, '').replace(/\s/g, '');
}
var n = parseFloat(s);
return isNaN(n) ? null : n;
}
function _normalizeCSVKind(v) {
var t = normalizeAr(String(v || '')).trim().toLowerCase();
var map = { 'expense': 'expense', 'مصروف': 'expense', 'صرف': 'expense', 'income': 'income', 'إيراد': 'income', 'قبض': 'income', 'دخل': 'income', 'lend': 'lend', 'دين لنا': 'lend', 'سلفة': 'lend', 'borrow': 'borrow', 'دين علينا': 'borrow', 'استلف': 'borrow', 'collect': 'collect', 'تحصيل': 'collect', 'repay': 'repay', 'سداد': 'repay', 'transfer': 'transfer', 'تحويل': 'transfer', 'capital': 'capital', 'رأس مال': 'capital' };
if (map[t]) return map[t];
for (var k in map) if (t.indexOf(k) >= 0) return map[k];
return null;
}
function importCSV(csvText) {
if (!state) return { ok: false, error: 'المحرك غير محمّل' };
var rows = _parseCSV(csvText);
if (!rows.length) return { ok: false, error: 'الملف فارغ' };
var header = rows[0];
var m = _csvHeaderMap(header);
if (m.amount === undefined) return { ok: false, error: 'العمود amount/مبلغ مطلوب' };
var imported = 0;
var failed = 0;
var errors = [];
var entryIds = [];
for (var ri = 1; ri < rows.length; ri++) {
var r = rows[ri];
if (!r || !r.some(function (f) { return String(f).trim() !== ''; })) continue;
var get = function (canon) { return (m[canon] !== undefined) ? (r[m[canon]] || '') : ''; };
var amount = _parseCSVAmount(get('amount'));
if (!(amount > 0)) { failed++; errors.push('سطر ' + (ri + 1) + ': مبلغ غير صالح'); continue; }
var kind = _normalizeCSVKind(get('kind')) || 'expense';
var currency = String(get('currency') || '').trim().toUpperCase() || BASE;
if (!listCurrencies().some(function (c) { return c.code === currency; })) currency = BASE;
var date = String(get('date') || '').trim();
if (!isValidDate(date)) date = todayISO();
var counterparty = String(get('counterparty') || '').trim();
var memo = String(get('memo') || '').trim();
if (!memo) memo = (KIND_META[kind] ? KIND_META[kind].label : kind) + (counterparty ? ' — ' + counterparty : '');
var dueDate = String(get('dueDate') || '').trim();
if (!isValidDate(dueDate)) dueDate = null;
var accountId = String(get('account') || '').trim();
if (!accountId || !getAccount(accountId)) {
accountId = (currency === 'USD') ? 'usd_box' : 'cash';
}
var contra = null;
if (kind === 'expense') contra = 'expense';
else if (kind === 'income') contra = 'revenue';
else if (kind === 'lend') contra = 'receivable';
else if (kind === 'borrow') contra = 'payable';
else if (kind === 'collect') contra = 'receivable';
else if (kind === 'repay') contra = 'payable';
else if (kind === 'capital') contra = 'capital';
if (kind === 'transfer') { accountId = accountId || 'cash'; contra = null; }
var draftTpl = { kind: kind, amountMinor: Math.round(amount * 100), currency: currency, accountId: accountId, contraAccountId: contra, counterparty: counterparty, openingDirection: (typeof openingDirection !== 'undefined' ? openingDirection : null), date: date, dueDate: dueDate, memo: memo };
var draft;
try { draft = buildDraft(draftTpl); } catch (e) { failed++; errors.push('سطر ' + (ri + 1) + ': ' + (e && e.message ? e.message : 'تعذر بناء القيد')); continue; }
state.drafts.push(draft);
if (state.drafts.length > 20) state.drafts = state.drafts.slice(-20);
var cRes = confirmDraft(draft.id);
if (!cRes.ok) { failed++; errors.push('سطر ' + (ri + 1) + ': ' + (cRes.error || 'تعذر الاعتماد')); continue; }
imported++;
if (cRes.entry && cRes.entry.id) entryIds.push(cRes.entry.id);
}
saveState();
return { ok: true, imported: imported, failed: failed, total: rows.length - 1, errors: errors, entryIds: entryIds };
}
function previewCSV(csvText) {
if (!state) return { ok: false, error: 'المحرك غير محمّل' };
var rows = _parseCSV(csvText);
if (!rows.length) return { ok: false, error: 'الملف فارغ' };
var header = rows[0];
var m = _csvHeaderMap(header);
if (m.amount === undefined) return { ok: false, error: 'العمود amount/مبلغ مطلوب' };
var out = [];
for (var ri = 1; ri < rows.length; ri++) {
var r = rows[ri];
if (!r || !r.some(function (f) { return String(f).trim() !== ''; })) continue;
var get = function (canon) { return (m[canon] !== undefined) ? (r[m[canon]] || '') : ''; };
var amount = _parseCSVAmount(get('amount'));
var kind = _normalizeCSVKind(get('kind')) || 'expense';
var currency = String(get('currency') || '').trim().toUpperCase() || BASE;
if (!listCurrencies().some(function (c) { return c.code === currency; })) currency = BASE;
var date = String(get('date') || '').trim();
if (!isValidDate(date)) date = todayISO();
var counterparty = String(get('counterparty') || '').trim();
var memo = String(get('memo') || '').trim();
if (!memo) memo = (KIND_META[kind] ? KIND_META[kind].label : kind) + (counterparty ? ' — ' + counterparty : '');
var dueDate = String(get('dueDate') || '').trim();
if (!isValidDate(dueDate)) dueDate = null;
var account = String(get('account') || '').trim();
if (!account || !getAccount(account)) account = (currency === 'USD') ? 'usd_box' : 'cash';
var valid = !!(amount > 0);
var error = valid ? '' : 'مبلغ غير صالح';
var dup = false;
if (valid) {
for (var i = 0; i < (state.entries || []).length; i++) {
var e = state.entries[i];
if (e.kind === kind && e.totalBase === Math.round(amount * (getRate(currency) || 1) * 100 / 100 * 100) && e.date === date && (e.counterparty || '') === counterparty) { dup = true; break; }
}
}
out.push({ line: ri + 1, date: date, kind: kind, amount: amount, currency: currency, counterparty: counterparty, memo: memo, account: account, dueDate: dueDate, valid: valid, error: error, duplicate: dup });
}
return { ok: true, headers: header, rows: out, count: out.length };
}
function importOFX(ofxText) {
if (!state) return { ok: false, error: 'المحرك غير محمّل' };
var text = String(ofxText || '');
var trns = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
if (!trns.length) return { ok: false, error: 'لم يُعثر على معاملات OFX' };
var curdef = text.match(/<CURDEF>([A-Z]{3})/i);
var currency = (curdef && curdef[1]) ? curdef[1].toUpperCase() : BASE;
if (!listCurrencies().some(function (c) { return c.code === currency; })) currency = BASE;
var imported = 0, failed = 0, errors = [], entryIds = [];
trns.forEach(function (block, idx) {
var get = function (tag) { var m = block.match(new RegExp('<' + tag + '>([^<\\r\\n]*)', 'i')); return m ? m[1].trim() : ''; };
var amt = parseFloat(get('TRNAMT'));
if (isNaN(amt) || amt === 0) { failed++; errors.push('معاملة ' + (idx + 1) + ': مبلغ غير صالح'); return; }
var kind = amt > 0 ? 'income' : 'expense';
var absAmt = Math.abs(amt);
var dtposted = get('DTPOSTED');
var isoDate = (dtposted.length >= 8) ? (dtposted.slice(0, 4) + '-' + dtposted.slice(4, 6) + '-' + dtposted.slice(6, 8)) : todayISO();
if (!isValidDate(isoDate)) isoDate = todayISO();
var name = get('NAME') || get('PAYEE') || '';
var memo = get('MEMO') || name;
var accountId = (currency === 'USD') ? 'usd_box' : 'cash';
var contra = (kind === 'expense') ? 'expense' : 'revenue';
var draftTpl = { kind: kind, amountMinor: Math.round(absAmt * 100), currency: currency, accountId: accountId, contraAccountId: contra, counterparty: name, date: isoDate, dueDate: null, memo: memo || kindMeta(kind).label };
var draft;
try { draft = buildDraft(draftTpl); } catch (e) { failed++; errors.push('معاملة ' + (idx + 1) + ': ' + (e && e.message ? e.message : 'تعذر بناء القيد')); return; }
state.drafts.push(draft);
if (state.drafts.length > 20) state.drafts = state.drafts.slice(-20);
var cRes = confirmDraft(draft.id);
if (!cRes.ok) { failed++; errors.push('معاملة ' + (idx + 1) + ': ' + (cRes.error || 'تعذر الاعتماد')); return; }
imported++;
if (cRes.entry && cRes.entry.id) entryIds.push(cRes.entry.id);
});
saveState();
return { ok: true, format: 'OFX', imported: imported, failed: failed, total: trns.length, errors: errors, entryIds: entryIds };
}
function _parseQIFDate(s) {
s = String(s || '').trim();
if (isValidDate(s)) return s;
var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
if (m) {
var a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
if (y < 100) y += 2000;
var day, mon;
if (a > 12) { day = a; mon = b; } else { day = b; mon = a; if (b > 12) { day = b; mon = a; } }
if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
return y + '-' + (mon < 10 ? '0' : '') + mon + '-' + (day < 10 ? '0' : '') + day;
}
}
return todayISO();
}
function importQIF(qifText) {
if (!state) return { ok: false, error: 'المحرك غير محمّل' };
var lines = String(qifText || '').split(/\r?\n/);
var entries = [];
var cur = {};
var type = '';
lines.forEach(function (line) {
line = String(line || '').trim();
if (!line) return;
if (line.indexOf('!Type:') === 0) { type = line.slice(6).trim(); return; }
if (line === '^') { if (Object.keys(cur).length) entries.push(cur); cur = {}; return; }
if (line.length < 2) return;
var code = line.charAt(0);
var val = line.slice(1).trim();
if (code === 'D') cur.date = val;
else if (code === 'T' || code === 'U') cur.amount = val;
else if (code === 'P') cur.payee = val;
else if (code === 'M') cur.memo = val;
else if (code === 'L') cur.category = val;
else if (code === 'N') cur.number = val;
else if (code === 'C') cur.cleared = val;
});
if (Object.keys(cur).length) entries.push(cur);
if (!entries.length) return { ok: false, error: 'لم يُعثر على معاملات QIF' };
var imported = 0, failed = 0, errors = [], entryIds = [];
entries.forEach(function (e, idx) {
var amt = _parseCSVAmount(e.amount);
if (!(amt > 0) && amt !== 0) { /* allow negative amounts for expenses */ }
var rawAmt = parseFloat(String(e.amount || '').replace(/,/g, ''));
if (isNaN(rawAmt) || rawAmt === 0) { failed++; errors.push('معاملة ' + (idx + 1) + ': مبلغ غير صالح'); return; }
var kind = rawAmt >= 0 ? 'income' : 'expense';
var absAmt = Math.abs(rawAmt);
var isoDate = _parseQIFDate(e.date);
var name = e.payee || '';
var memo = e.memo || name || kindMeta(kind).label;
var accountId = 'cash';
var contra = (kind === 'expense') ? 'expense' : 'revenue';
var draftTpl = { kind: kind, amountMinor: Math.round(absAmt * 100), currency: BASE, accountId: accountId, contraAccountId: contra, counterparty: name, date: isoDate, dueDate: null, memo: memo };
var draft;
try { draft = buildDraft(draftTpl); } catch (err) { failed++; errors.push('معاملة ' + (idx + 1) + ': ' + (err && err.message ? err.message : 'تعذر بناء القيد')); return; }
state.drafts.push(draft);
if (state.drafts.length > 20) state.drafts = state.drafts.slice(-20);
var cRes = confirmDraft(draft.id);
if (!cRes.ok) { failed++; errors.push('معاملة ' + (idx + 1) + ': ' + (cRes.error || 'تعذر الاعتماد')); return; }
imported++;
if (cRes.entry && cRes.entry.id) entryIds.push(cRes.entry.id);
});
saveState();
return { ok: true, format: 'QIF', imported: imported, failed: failed, total: entries.length, errors: errors, entryIds: entryIds };
}
function importFinancial(text, format) {
format = String(format || '').toLowerCase();
if (format === 'ofx' || /<OFX/i.test(text)) return importOFX(text);
if (format === 'qif' || /^!Type:/m.test(text) || /^\^$/m.test(text)) return importQIF(text);
return importCSV(text);
}
var BACKUP_ITERATIONS = 310000;
var BACKUP_MIN_PASSWORD = 8;
function webCrypto() {
var c = root.crypto || (typeof crypto !== 'undefined' ? crypto : null);
return c && c.subtle ? c : null;
}
function bytesToBase64(bytes) {
var out = '';
for (var i = 0; i < bytes.length; i += 32768) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
return btoa(out);
}
function base64ToBytes(text) {
var raw = atob(text);
var bytes = new Uint8Array(raw.length);
for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
return bytes;
}
function backupKey(c, password, salt, iterations) {
return c.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']).then(function (material) {
return c.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
});
}
function isEncryptedBackup(data) {
return !!data && data.type === 'moneycode-encrypted-backup';
}
function encryptBackup(password, attachments) {
var c = webCrypto();
if (!c) return Promise.resolve({ ok: false, error: 'التشفير غير متاح على هذا الجهاز' });
if (String(password || '').length < BACKUP_MIN_PASSWORD) return Promise.resolve({ ok: false, error: 'كلمة المرور ' + BACKUP_MIN_PASSWORD + ' أحرف على الأقل' });
var salt = c.getRandomValues(new Uint8Array(16));
var iv = c.getRandomValues(new Uint8Array(12));
var payload = JSON.parse(exportJSON());
payload.attachments = attachments || [];
return backupKey(c, password, salt, BACKUP_ITERATIONS).then(function (key) {
return c.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(JSON.stringify(payload)));
}).then(function (sealed) {
return {
ok: true,
text: JSON.stringify({
type: 'moneycode-encrypted-backup', version: 1, cipher: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations: BACKUP_ITERATIONS,
salt: bytesToBase64(salt), iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(sealed))
})
};
}).catch(function () {
return { ok: false, error: 'تعذر تشفير النسخة' };
});
}
function decryptBackup(envelope, password) {
var c = webCrypto();
if (!c) return Promise.resolve({ ok: false, error: 'التشفير غير متاح على هذا الجهاز' });
if (!isEncryptedBackup(envelope) || envelope.version !== 1) return Promise.resolve({ ok: false, error: 'صيغة الملف غير معروفة' });
var iterations = Number(envelope.iterations);
if (!(iterations >= 100000 && iterations <= 10000000)) return Promise.resolve({ ok: false, error: 'صيغة الملف غير معروفة' });
var parts;
try {
parts = { salt: base64ToBytes(envelope.salt), iv: base64ToBytes(envelope.iv), data: base64ToBytes(envelope.data) };
} catch (e) {
return Promise.resolve({ ok: false, error: 'الملف تالف' });
}
return backupKey(c, String(password || ''), parts.salt, iterations).then(function (key) {
return c.subtle.decrypt({ name: 'AES-GCM', iv: parts.iv }, key, parts.data);
}).then(function (plain) {
return { ok: true, data: JSON.parse(new TextDecoder().decode(plain)) };
}).catch(function () {
return { ok: false, error: 'كلمة المرور خاطئة أو الملف تالف' };
});
}
function setLanguage(code, dialectRank) {
getState().settings.language = String(code || '');
getState().settings.dialectRank = Number(dialectRank) || 0;
saveState();
}
function setAutoTts(value) {
getState().settings.autoTts = !!value;
saveState();
}
function setFontStep(step) {
var value = Math.round(Number(step));
getState().settings.fontStep = value >= 1 && value <= 2 ? value : 0;
saveState();
return getState().settings.fontStep;
}
function setHideAmounts(value) {
getState().settings.hideAmounts = !!value;
saveState();
}
function setSimpleMode(value) {
getState().settings.simpleMode = !!value;
saveState();
}
function setAIEnabled(value) {
getState().settings.aiEnabled = !!value;
saveState();
}
function setAiAlwaysAllow(value) {
getState().settings.aiAlwaysAllow = !!value;
if (value) getState().settings.aiEnabled = true;
saveState();
}
function setAutoLearn(value) {
getState().settings.autoLearn = !!value;
saveState();
}
function learnFromConfirmed(text, kind, accountId) {
if (!getState().settings.autoLearn) return { ok: false, skipped: 'disabled' };
var keyword = sentenceKeyword(text);
if (keyword.length < 2) return { ok: false, error: 'too short' };
if (TRAINABLE_KINDS.indexOf(kind) < 0) return { ok: false, error: 'bad kind' };
if (adaptiveMemory[keyword]) return { ok: false, skipped: 'exists' };
var acc = accountId ? getAccount(accountId) : null;
try {
db.run('INSERT OR IGNORE INTO semantic_dictionary (keyword, mapped_action, account_hint, account_id, usage_count, last_used, language, source, confidence) VALUES (?,?,?,?,?,?,?,?,?)',
[keyword, kind, String(text).slice(0, 200), accountId || null, 1, new Date().toISOString(), 'ar', 'learned', 0.8]);
} catch (e) { log('warn', 'learnFromConfirmed failed', e); return { ok: false, error: String(e) }; }
ensureMemoryLoaded();
saveState();
return { ok: true, keyword: keyword };
}
function getVocabStatus() {
return { seedsLoaded: !!(VOCAB_SEEDS && VOCAB_SEEDS.length), count: VOCAB_SEEDS ? VOCAB_SEEDS.length : 0, warning: VOCAB_LOAD_WARNING };
}
function recurringList() { var st = getState(); if (!st.settings.recurring) st.settings.recurring = []; return st.settings.recurring; }
function addRecurring(tpl) { tpl = tpl || {}; var memo = String(tpl.memo || '').trim(); if (!memo) return { ok: false, error: 'اكتب وصف القيد' }; var amount = Number(tpl.amountMinor); if (!(amount > 0)) return { ok: false, error: 'مبلغ غير صالح' }; var item = { id: uid('rec'), memo: memo, kind: tpl.kind || 'expense', amountMinor: amount, currency: tpl.currency || BASE, accountId: tpl.accountId || 'cash', counterAccountId: tpl.counterAccountId || null, freq: tpl.freq || 'monthly', nextDate: tpl.nextDate || todayISO() }; recurringList().push(item); saveState(); return { ok: true, item: item }; }
function removeRecurring(id) { var list = recurringList(); var idx = -1; for (var i = 0; i < list.length; i++) if (list[i].id === id) idx = i; if (idx < 0) return { ok: false, error: 'غير موجود' }; list.splice(idx, 1); saveState(); return { ok: true }; }
function editRecurring(id, tpl) {
tpl = tpl || {};
var item = null;
recurringList().forEach(function (r) { if (r.id === id) item = r; });
if (!item) return { ok: false, error: 'غير موجود' };
if (tpl.memo) { var m = String(tpl.memo).trim(); if (m) item.memo = m; }
if (Number(tpl.amountMinor) > 0) item.amountMinor = Number(tpl.amountMinor);
if (tpl.kind) item.kind = tpl.kind;
if (tpl.freq) item.freq = tpl.freq;
if (tpl.accountId) item.accountId = tpl.accountId;
if (tpl.counterAccountId !== undefined) item.counterAccountId = tpl.counterAccountId || null;
if (tpl.currency) item.currency = tpl.currency;
if (tpl.nextDate) item.nextDate = tpl.nextDate;
saveState();
return { ok: true, item: item };
}
function runAllDueRecurring() {
var due = recurringDue(todayISO());
var done = 0, failed = 0;
due.forEach(function (r) {
var res = runRecurring(r.id);
if (res && res.ok) done++; else failed++;
});
return { ok: true, due: due.length, done: done, failed: failed };
}
function recurringDue(today) { today = today || todayISO(); return recurringList().filter(function (r) { return r.nextDate && r.nextDate <= today; }); }
function advanceRecurring(id) { var item = null; recurringList().forEach(function (r) { if (r.id === id) item = r; }); if (!item) return { ok: false, error: 'غير موجود' }; var d = new Date(item.nextDate + 'T00:00:00'); if (item.freq === 'weekly') d.setDate(d.getDate() + 7); else if (item.freq === 'daily') d.setDate(d.getDate() + 1); else d.setMonth(d.getMonth() + 1); item.nextDate = isoDate(d); saveState(); return { ok: true, nextDate: item.nextDate }; }
function runRecurring(id) {
var item = null;
recurringList().forEach(function (r) { if (r.id === id) item = r; });
if (!item) return { ok: false, error: 'غير موجود' };
var d = createDraft(item.memo);
updateDraft(d.id, {
kind: item.kind || 'expense',
amountMinor: item.amountMinor,
currency: item.currency || BASE,
accountId: item.accountId || 'cash',
contraAccountId: item.counterAccountId || null,
date: item.nextDate || todayISO()
});
var res = confirmDraft(d.id);
if (!res || !res.ok) return res || { ok: false, error: 'تعذر تسجيل القيد' };
var adv = advanceRecurring(id);
return { ok: true, entry: res.entry, nextDate: adv.nextDate };
}
function budgetList() { var st = getState(); if (!Array.isArray(st.settings.budgets)) st.settings.budgets = []; return st.settings.budgets; }
function addBudget(tpl) {
tpl = tpl || {};
if (!tpl.accountId) return { ok: false, error: 'اختر حساباً' };
var limit = Number(tpl.monthlyLimitMinor);
if (!(limit > 0)) return { ok: false, error: 'حد غير صالح' };
var list = budgetList();
for (var i = 0; i < list.length; i++) {
if (list[i].accountId === tpl.accountId) {
list[i].monthlyLimitMinor = limit;
list[i].currency = tpl.currency || list[i].currency || BASE;
saveState();
return { ok: true, item: list[i] };
}
}
var item = { id: uid('bud'), accountId: tpl.accountId, monthlyLimitMinor: limit, currency: tpl.currency || BASE };
list.push(item);
saveState();
return { ok: true, item: item };
}
function removeBudget(id) { var list = budgetList(); var idx = -1; for (var i = 0; i < list.length; i++) if (list[i].id === id) idx = i; if (idx < 0) return { ok: false, error: 'غير موجود' }; list.splice(idx, 1); saveState(); return { ok: true }; }
function budgetStatus(accountId, today) {
today = today || todayISO();
var month = today.slice(0, 7);
var item = budgetList().filter(function (b) { return b.accountId === accountId; })[0];
if (!item) return null;
var spent = 0;
(getState().entries || []).forEach(function (e) {
if (!e.date || e.date.slice(0,7) !== month) return;
(e.lines || []).forEach(function (l) {
if (l.accountId !== accountId) return;
var acc = getAccount(accountId);
var sign = acc && acc.nature === 'debit' ? 1 : -1;
spent += sign * ((Number(l.debitBase) || 0) - (Number(l.creditBase) || 0));
});
});
if (spent < 0) spent = 0;
var limitBase = toBase(item.monthlyLimitMinor, item.currency || BASE);
var pct = limitBase > 0 ? Math.round((spent / limitBase) * 100) : 0;
return { budget: item, limitBase: limitBase, spentMinor: spent, remainingMinor: limitBase - spent, pct: pct, over: spent > limitBase };
}
var ASSISTANT_KINDS = ['overdue', 'due', 'overdraft', 'budget', 'recurring', 'reflection', 'question', 'weekly', 'goal'];
function assistantSettings() {
var st = getState().settings;
if (!st.assistantSeen || typeof st.assistantSeen !== 'object') st.assistantSeen = {};
if (!Array.isArray(st.assistantMuted)) st.assistantMuted = [];
if (st.assistantLevel !== 'quiet') st.assistantLevel = 'normal';
return st;
}
function toParty(who) { return /^ال/.test(who) ? 'لل' + who.slice(2) : 'لـ' + who; }
function shortDate(iso, today) {
var p = String(iso || '').split('-');
if (p.length !== 3) return String(iso || '');
var text = (+p[2]) + ' ' + MONTHS[+p[1] - 1];
return today && today.slice(0, 4) === p[0] ? text : text + ' ' + p[0];
}
function customerReminder(who, d) {
var cur = d.currency || BASE;
var amount = plainAmount(cur === BASE ? d.remaining : d.remainingNative) + ' ' + (cur === 'SAR' ? 'ريال' : (CURRENCY_NAMES[cur] || cur));
var prof = getProfile();
var from = prof.business || prof.name;
return 'السلام عليكم ' + who + '، نذكّركم بمبلغ ' + amount + ' المستحق بتاريخ ' + shortDate(d.dueDate) +
'. نرجو السداد أو إفادتنا بموعد مناسب. مع الشكر' + (from ? '، ' + from : '') + '.';
}
var FREQ_NAMES = { daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري', yearly: 'سنوي' };
function plainAmount(minor) { return String(Number((Number(minor) / 100).toFixed(2))); }
function daysWord(n) {
n = Math.abs(n);
if (n === 1) return 'يوم واحد';
if (n === 2) return 'يومان';
if (n <= 10) return n + ' أيام';
return n + ' يوماً';
}
function dueSentenceAmount(d) {
if (d.currency && d.currency !== BASE) return plainAmount(d.remainingNative) + ' ' + (CURRENCY_NAMES[d.currency] || d.currency);
return plainAmount(fromBase(d.remaining, mainCurrency()));
}
function assistantCandidates(today) {
var a = computeAnalysis();
var out = [];
(a.dueItems || []).forEach(function (d) {
if (!(d.remaining > 0) || !d.dueDate) return;
var who = d.counterparty || 'طرف غير محدد';
var money = fmtMoney(d.remaining, BASE, false);
var days = daysBetween(today, d.dueDate);
var sentence = dueSentenceAmount(d);
if (days < 0) {
var late = -days;
out.push(d.kind === 'receivable' ? {
key: 'overdue:' + d.id, kind: 'overdue', level: 'important',
text: 'تحصيل ' + money + ' من ' + who + ' متأخر ' + daysWord(late) + ' (موعده ' + shortDate(d.dueDate, today) + '). أجهّز رسالة تذكير؟',
actions: [
{ label: 'جهّز التذكير', action: 'assistant-remind', text: customerReminder(who, d) },
{ label: 'سجّل تحصيل', send: 'استلمت من ' + who + ' ' + sentence },
{ label: 'أجّل الموعد', action: 'assistant-due', id: d.id }
]
} : {
key: 'overdue:' + d.id, kind: 'overdue', level: 'important',
text: 'دفعة ' + money + ' ' + toParty(who) + ' متأخرة ' + daysWord(late) + ' (موعدها ' + shortDate(d.dueDate, today) + '). هل سُدّدت؟',
actions: [
{ label: 'نعم، سجّل السداد', send: 'سددت الى ' + who + ' ' + sentence },
{ label: 'أجّل الموعد', action: 'assistant-due', id: d.id }
]
});
} else if (days <= 1) {
var when = days === 0 ? 'اليوم' : 'غداً';
out.push({
key: 'due:' + d.id, kind: 'due', level: 'normal',
text: d.kind === 'receivable' ? 'تحصيل ' + money + ' من ' + who + ' مستحق ' + when + '.' : 'دفعة ' + money + ' ' + toParty(who) + ' مستحقة ' + when + '.',
short: d.kind === 'receivable' ? 'تحصيل ' + money + ' من ' + who + ' ' + when : 'دفعة ' + money + ' ' + toParty(who) + ' ' + when,
actions: d.kind === 'receivable'
? [{ label: 'سجّل تحصيل', send: 'استلمت من ' + who + ' ' + sentence }]
: [{ label: 'سجّل سداد', send: 'سددت الى ' + who + ' ' + sentence }]
});
}
});
state.accounts.forEach(function (acc) {
if (!acc.liquid || acc.multi) return;
var b = a.balances[acc.id];
if (!b || !(b.native < 0)) return;
var need = -b.native;
var from = state.accounts.filter(function (x) {
return x.liquid && !x.multi && x.id !== acc.id && x.currency === acc.currency && a.balances[x.id] && a.balances[x.id].native >= need;
}).sort(function (x, y) { return (y.id === 'cash') - (x.id === 'cash'); })[0];
var shown = fmtMoney(need, acc.currency, false);
out.push({
key: 'overdraft:' + acc.id, kind: 'overdraft', level: 'important',
text: 'رصيد «' + acc.name + '» صار سالب ' + shown + '.' + (from ? ' رصيد «' + from.name + '» يكفي للتغطية.' : ''),
actions: from ? [{ label: 'حوّل من ' + from.name, send: 'حولت ' + plainAmount(need) + ' من ' + from.name + ' الى ' + acc.name }] : [{ label: 'إصلاح', action: 'assistant-fix-overdraft', id: acc.id }]
});
});
var lastBackup = state.settings && state.settings.lastBackupAt ? new Date(state.settings.lastBackupAt).getTime() : 0;
var daysSinceBackup = lastBackup ? Math.floor((new Date(today).getTime() - lastBackup) / (24 * 60 * 60 * 1000)) : ((state.entries || []).length ? 999 : 0);
if (daysSinceBackup >= 7 && (state.entries || []).length > 0) {
out.push({
key: 'backup:' + today,
kind: 'backup',
level: 'normal',
text: 'لم تؤخذ نسخة احتياطية منذ ' + daysSinceBackup + ' يوماً. احفظ نسخة مشفرة (AES-256) الآن.',
actions: [{ label: 'فتح مركز النسخ الاحتياطي', action: 'open-export' }]
});
}
var month = today.slice(0, 7);
var parts = today.split('-');
var lastDay = new Date(+parts[0], +parts[1], 0).getDate();
var left = lastDay - (+parts[2]);
budgetList().forEach(function (bud) {
var stt = budgetStatus(bud.accountId, today);
if (!stt || stt.pct < 80) return;
var acc = getAccount(bud.accountId);
var name = acc ? acc.name : bud.accountId;
var full = stt.pct >= 100;
out.push({
key: 'budget:' + bud.accountId + ':' + month + ':' + (full ? 'full' : '80'), kind: 'budget', level: full ? 'important' : 'normal',
text: full
? (stt.over ? 'تجاوز صرف «' + name + '» ميزانية الشهر بـ ' + fmtMoney(-stt.remainingMinor, BASE, false) + '.' : 'اكتملت ميزانية «' + name + '» لهذا الشهر.') + ' هل تعدّلها؟'
: 'بلغ صرف «' + name + '» ' + stt.pct + '% من ميزانية الشهر، والمتبقي ' + fmtMoney(stt.remainingMinor, BASE, false) + ' وأمام الشهر ' + daysWord(left) + '.',
actions: [{ label: full ? 'عدّل الميزانية' : 'افتح الميزانية', action: 'assistant-budget' }]
});
var _g = (typeof monthlyGoal === 'function') ? monthlyGoal() : null;
if (_g && _g.month === month) {
var _gs = monthStats(month);
var _atRisk = false;
if (_g.kind === 'cap') { var _spent = (_gs.byAccount[_g.accountId] || 0); _atRisk = _spent > _g.target; }
else if (_g.kind === 'save') { _atRisk = _gs.rate != null && _gs.rate < _g.target; }
else if (_g.kind === 'repay') {
var _left = (state.dueItems || []).filter(function (d) { return d.kind === 'payable' && d.remaining > 0 && normalizeName(d.counterparty) === normalizeName(_g.party); })
.reduce(function (t, d) { return t + d.remaining; }, 0);
_atRisk = _left > 0;
}
if (_atRisk) {
var _gtxt = goalProgress(_g, _gs);
if (_gtxt) {
out.push({
key: 'goal:' + month + ':' + _g.kind + ':' + (new Date().getDate()), kind: 'goal', level: _g.kind === 'cap' ? 'important' : 'normal',
text: _gtxt,
actions: [{ label: 'هدف شهري', action: 'assistant-goal-ask' }]
});
}
}
}
});
recurringList().forEach(function (r) {
if (!r.nextDate || r.nextDate > today) return;
var amount = fmtMoney(toBase(r.amountMinor, r.currency || BASE), BASE, false);
out.push({
key: 'recurring:' + r.id + ':' + r.nextDate, kind: 'recurring', level: 'normal',
text: (r.nextDate === today ? 'حان موعد ' : 'فات موعد ') + r.memo + ': ' + amount + (FREQ_NAMES[r.freq] ? ' (' + FREQ_NAMES[r.freq] + ')' : '') + '. أسجّله الآن؟',
actions: [{ label: 'سجّله الآن', action: 'assistant-run-recurring', id: r.id }, { label: 'ليس الآن', action: 'assistant-later' }]
});
});
var pInfo = getPlanInfo();
if (pInfo.expiresAt) {
var dLeft = daysBetween(today, pInfo.expiresAt);
if (dLeft >= 0 && dLeft <= 14) {
out.push({
key: 'license:renew:' + pInfo.expiresAt, kind: 'license', level: 'normal',
text: 'تنتهي رخصتك السنوية بعد ' + daysWord(dLeft) + ' (' + shortDate(pInfo.expiresAt, today) + '). بياناتك محفوظة دائماً، ويمكنك التجديد الآن بخصم الولاء (25%).',
actions: [{ label: 'جدّد الرخصة', action: 'open-activation' }]
});
}
} else if (pInfo.entriesLeft !== null && pInfo.entriesLeft > 0 && pInfo.entriesLeft <= 10) {
out.push({
key: 'license:quota:' + month + ':' + pInfo.entriesLeft, kind: 'license', level: 'normal',
text: 'بقي لك ' + pInfo.entriesLeft + ' قيود مجانية هذا الشهر من أصل ' + FREE_MONTHLY_ENTRIES + '. يمكنك الترقية في أي وقت لفتح القيود بلا حدود.',
actions: [{ label: 'ترقية الحساب', action: 'open-activation' }]
});
}
if (state.settings && state.settings.lastSeenVersion && state.settings.lastSeenVersion !== VERSION) {
out.push({
key: 'update:' + VERSION, kind: 'update', level: 'normal',
text: 'الجديد في تحديث موني كود ' + VERSION + ': أضفنا ميزة إقران الأجهزة ومطابقة الحسابات عبر QR/NFC، وتجربة مجانية لـ 3 مرات لتقارير PDF والعملات الأجنبية.',
actions: [{ label: 'جرّب الميزات الآن', action: 'open-activation' }]
});
}
return out;
}
function assistantNotes(opts) {
opts = opts || {};
if (!state) return [];
var today = opts.today || todayISO();
var st = assistantSettings();
return assistantCandidates(today).filter(function (n) {
if (st.assistantMuted.indexOf(n.kind) >= 0) return false;
if (st.assistantLevel === 'quiet' && n.level !== 'important') return false;
if (!opts.all && st.assistantSeen[n.key] === today) return false;
return true;
}).sort(function (x, y) { return (x.level === 'important' ? 0 : 1) - (y.level === 'important' ? 0 : 1); });
}
function assistantBrief(opts) {
opts = opts || {};
if (!state) return null;
var today = opts.today || todayISO();
var st = assistantSettings();
var key = 'brief:' + today;
if (st.assistantSeen[key] === today) return null;
var notes = assistantNotes({ today: today, all: true });
if (!notes.length) return null;
var hour = (opts.now ? new Date(opts.now) : new Date()).getHours();
var lines = [hour < 12 ? 'صباح الخير.' : 'مساء الخير.'];
var dues = notes.filter(function (n) { return n.kind === 'due'; });
if (dues.length) lines.push(dues.slice(0, 2).map(function (n) { return n.short; }).join('، و') + (dues.length > 2 ? '، وغيرها' : '') + '.');
var late = notes.filter(function (n) { return n.kind === 'overdue'; }).length;
if (late) lines.push(late === 1 ? 'وهناك موعد واحد متأخر.' : 'وهناك ' + late + ' مواعيد متأخرة.');
var a = computeAnalysis();
lines.push('النقد المتاح ' + fmtMoney(a.liquidity, BASE, false) + (a.runwayDays ? '، يغطي المصروفات المعتادة نحو ' + daysWord(a.runwayDays) : '') + '.');
return { key: key, kind: 'brief', level: 'normal', text: lines.join(' '), notes: notes, actions: [{ label: 'لوحة القيادة', action: 'open-dashboard' }] };
}
function rescheduleDue(id, date) {
var d = state.dueItems.filter(function (x) { return x.id === id; })[0];
if (!d) return { ok: false, error: 'الاستحقاق غير موجود' };
if (!isValidDate(date)) return { ok: false, error: 'تاريخ غير صالح' };
d.dueDate = date;
saveState();
return { ok: true, due: d };
}
function shiftMonth(ym, n) {
var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
return y + '-' + (m < 9 ? '0' : '') + (m + 1);
}
function monthName(ym) { return MONTHS[+ym.slice(5, 7) - 1]; }
function monthStats(ym) {
var out = { income: 0, expense: 0, byAccount: {}, entries: 0 };
state.entries.forEach(function (e) {
if (!e.date || e.date.slice(0, 7) !== ym) return;
out.entries++;
(e.lines || []).forEach(function (l) {
var acc = getAccount(l.accountId);
if (!acc) return;
var net = (Number(l.debitBase) || 0) - (Number(l.creditBase) || 0);
if (acc.type === 'revenue') out.income -= net;
else if (acc.type === 'expense') {
out.expense += net;
out.byAccount[acc.id] = (out.byAccount[acc.id] || 0) + net;
}
});
});
out.rate = out.income > 0 ? Math.round(((out.income - out.expense) / out.income) * 100) : null;
var top = Object.keys(out.byAccount).sort(function (a, b) { return out.byAccount[b] - out.byAccount[a]; })[0];
out.top = top && out.byAccount[top] > 0 ? { accountId: top, amount: out.byAccount[top] } : null;
return out;
}
function goalState() {
var st = assistantSettings();
if (!st.assistantGoal || typeof st.assistantGoal !== 'object') st.assistantGoal = { goal: null, askedMonth: null, skips: 0, pausedUntil: null };
return st.assistantGoal;
}
function monthlyGoal() { return goalState().goal; }
function goalPaused(month) {
var g = goalState();
if (g.pausedUntil && month < g.pausedUntil) return true;
var pending = g.askedMonth && g.askedMonth !== month && !(g.goal && g.goal.month === g.askedMonth) ? 1 : 0;
return (g.skips || 0) + pending >= 2;
}
function noteGoalAsked(month) {
var g = goalState();
if (g.askedMonth && g.askedMonth !== month) {
if (g.goal && g.goal.month === g.askedMonth) g.skips = 0; else g.skips = (g.skips || 0) + 1;
}
g.askedMonth = month;
if (g.skips >= 2) { g.pausedUntil = shiftMonth(month, 3); g.skips = 0; }
saveState();
return { ok: true };
}
function goalOptions(month, today) {
today = today || todayISO();
var last = monthStats(shiftMonth(month, -1));
var out = [];
if (last.top) {
var acc = getAccount(last.top.accountId);
var target = Math.floor(last.top.amount * 0.9 / 5000) * 5000;
if (target > 0) out.push({ kind: 'cap', month: month, accountId: last.top.accountId, target: target, label: 'صرف «' + (acc ? acc.name : last.top.accountId) + '» تحت ' + (target / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) });
}
var save = last.rate != null && last.rate > 0 ? Math.min(60, Math.max(5, Math.round((last.rate + 5) / 5) * 5)) : 10;
out.push({ kind: 'save', month: month, target: save, label: 'ادّخار ' + save + '%' });
var owed = state.dueItems.filter(function (d) { return d.kind === 'payable' && d.remaining > 0 && d.counterparty; })
.sort(function (a, b) { return b.remaining - a.remaining; })[0];
if (owed) out.push({ kind: 'repay', month: month, party: owed.counterparty, target: owed.remaining, label: 'سداد ' + owed.counterparty });
return out;
}
function setMonthlyGoal(opt) {
if (!opt || ['cap', 'save', 'repay'].indexOf(opt.kind) < 0 || !/^\d{4}-\d{2}$/.test(String(opt.month || ''))) return { ok: false, error: 'هدف غير صالح' };
var g = goalState();
g.goal = { kind: opt.kind, month: opt.month, accountId: opt.accountId || null, party: opt.party || null, target: Number(opt.target) || 0, label: String(opt.label || '') };
g.skips = 0;
saveState();
return { ok: true, goal: g.goal };
}
function goalProgress(goal, stats) {
var money = function (m) { return fmtMoney(m, BASE, false); };
if (goal.kind === 'cap') {
var acc = getAccount(goal.accountId);
var name = acc ? acc.name : goal.accountId;
var spent = stats.byAccount[goal.accountId] || 0;
return spent <= goal.target
? 'وبقي صرف «' + name + '» تحت ' + money(goal.target) + ' كما أردت (' + money(spent) + ').'
: 'وبلغ صرف «' + name + '» ' + money(spent) + ' من هدف ' + money(goal.target) + '.';
}
if (goal.kind === 'save') {
if (stats.rate == null) return '';
return stats.rate >= goal.target ? 'وادّخرت ' + stats.rate + '%، وهدفك كان ' + goal.target + '%.' : 'وادّخرت ' + stats.rate + '% من هدف ' + goal.target + '%.';
}
if (goal.kind === 'repay') {
var left = state.dueItems.filter(function (d) { return d.kind === 'payable' && d.remaining > 0 && normalizeName(d.counterparty) === normalizeName(goal.party); })
.reduce(function (t, d) { return t + d.remaining; }, 0);
return left ? 'وبقي ' + toParty(goal.party) + ' ' + money(left) + '.' : 'وسُدّد ما عليك ' + toParty(goal.party) + ' كما أردت.';
}
return '';
}
function assistantReflection(opts) {
opts = opts || {};
if (!state) return null;
var today = opts.today || todayISO();
var st = assistantSettings();
if (st.assistantMuted.indexOf('reflection') >= 0 || st.assistantLevel === 'quiet') return null;
var now = today.slice(0, 7), month = shiftMonth(now, -1);
var key = 'reflection:' + month;
if (st.assistantSeen[key]) return null;
if (state.entries.length < 20) return null;
var stats = monthStats(month);
if (!stats.entries || (!stats.income && !stats.expense)) return null;
var money = function (m) { return fmtMoney(m, BASE, false); };
var lines = [];
if (stats.income > 0 && stats.expense < stats.income) {
lines.push('انتهى ' + monthName(month) + '. دخل ' + money(stats.income) + ' وخرج ' + money(stats.expense) + '، فادّخرت ' + stats.rate + '%.');
} else {
var topAcc = stats.top && getAccount(stats.top.accountId);
lines.push('كان ' + monthName(month) + ' شهر مصروفات أكبر من الدخل' + (topAcc ? '، أكبرها «' + topAcc.name + '» ' + money(stats.top.amount) : '') + '.');
var run = computeAnalysis().runwayDays;
if (run) lines.push('النقد المتاح يغطي المصروفات المعتادة نحو ' + daysWord(run) + '.');
}
var hist = (st.netWorthHistory || []).filter(function (h) { return h && h.date && h.date.slice(0, 7) === month; })
.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
if (hist.length >= 2 && hist[hist.length - 1].value > hist[0].value) {
lines.push('صافي ثروتك زاد ' + money(hist[hist.length - 1].value - hist[0].value) + ' منذ أول الشهر.');
}
var goal = monthlyGoal();
if (goal && goal.month === month) { var said = goalProgress(goal, stats); if (said) lines.push(said); }
var actions = [{ label: 'تقرير الشهر', action: 'assistant-month-report' }];
var urgent = assistantNotes({ today: today, all: true }).some(function (n) { return n.level === 'important'; });
if (st.assistantMuted.indexOf('question') < 0 && !goalPaused(now) && !urgent && !(goal && goal.month === now)) {
actions.push({ label: 'حدّد هدف ' + monthName(now), action: 'assistant-goal-ask' });
}
return { key: key, kind: 'reflection', level: 'normal', month: month, text: lines.join(' '), actions: actions };
}
var WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
function isoShift(iso, days) {
var p = iso.split('-');
var d = new Date(+p[0], +p[1] - 1, +p[2] + days, 12);
var m = d.getMonth() + 1, dd = d.getDate();
return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
}
function weekdayOf(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12).getDay(); }
function spendingBetween(from, to) {
var out = { total: 0, byAccount: {} };
state.entries.forEach(function (e) {
if (!e.date || e.date < from || e.date > to) return;
(e.lines || []).forEach(function (l) {
var acc = getAccount(l.accountId);
if (!acc || acc.type !== 'expense') return;
var net = (Number(l.debitBase) || 0) - (Number(l.creditBase) || 0);
out.total += net;
out.byAccount[acc.id] = (out.byAccount[acc.id] || 0) + net;
});
});
return out;
}
function assistantWeekly(opts) {
opts = opts || {};
if (!state) return null;
var today = opts.today || todayISO();
var st = assistantSettings();
if (st.assistantMuted.indexOf('weekly') >= 0 || st.assistantLevel === 'quiet') return null;
var thisSat = isoShift(today, -((weekdayOf(today) + 1) % 7));
var start = isoShift(thisSat, -7), end = isoShift(thisSat, -1);
var key = 'weekly:' + start;
if (st.assistantSeen[key]) return null;
var money = function (m) { return fmtMoney(m, BASE, false); };
var week = spendingBetween(start, end);
var before = spendingBetween(isoShift(start, -7), isoShift(start, -1));
var dueSoon = state.dueItems.filter(function (d) { return d.remaining > 0 && d.dueDate && d.dueDate >= today && d.dueDate <= isoShift(today, 6); })
.sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; });
if (week.total <= 0 && !dueSoon.length) return null;
var lines = [];
if (week.total > 0) {
var line = 'الاسبوع الماضي صرفت ' + money(week.total);
if (before.total > 0) {
var diff = week.total - before.total;
if (diff < 0) line += '، أقل من الذي قبله بـ ' + money(-diff);
else if (diff > before.total * 0.2) line += '، أعلى من الذي قبله بـ ' + money(diff);
}
var top = Object.keys(week.byAccount).sort(function (a, b) { return week.byAccount[b] - week.byAccount[a]; })[0];
var topAcc = top && getAccount(top);
lines.push(line + '.' + (topAcc ? ' أكبر بند «' + topAcc.name + '».' : ''));
} else {
lines.push('أسبوع هادئ: لا مصروفات مسجّلة.');
}
if (dueSoon.length) {
var first = dueSoon[0];
var who = first.counterparty || 'طرف غير محدد';
var what = first.kind === 'receivable' ? 'تحصيل ' + money(first.remaining) + ' من ' + who : 'دفعة ' + money(first.remaining) + ' ' + toParty(who);
var day = first.dueDate === today ? 'اليوم' : 'يوم ' + WEEKDAYS[weekdayOf(first.dueDate)];
lines.push(dueSoon.length === 1 ? 'يستحق هذا الاسبوع ' + what + ' ' + day + '.' : 'يستحق هذا الاسبوع ' + dueSoon.length + ' مواعيد، أقربها ' + what + ' ' + day + '.');
} else if (week.total > 0) {
lines.push('لا مستحقات هذا الاسبوع.');
}
var goal = monthlyGoal();
if (goal && goal.month === today.slice(0, 7) && goal.kind === 'cap') {
var acc = getAccount(goal.accountId);
var spent = spendingBetween(goal.month + '-01', today).byAccount[goal.accountId] || 0;
lines.push('هدف الشهر: صرفت على «' + (acc ? acc.name : goal.accountId) + '» حتى الآن ' + money(spent) + ' من ' + money(goal.target) + '.');
}
return { key: key, kind: 'weekly', level: 'normal', text: lines.join(' '), actions: [{ label: 'قيود الاسبوع', action: 'assistant-ledger' }] };
}
function markAssistantSeen(keys, today) {
var st = assistantSettings();
today = today || todayISO();
(keys || []).forEach(function (k) { if (k) st.assistantSeen[k] = today; });
Object.keys(st.assistantSeen).forEach(function (k) { if (daysBetween(st.assistantSeen[k], today) > 40) delete st.assistantSeen[k]; });
saveState();
}
function muteAssistant(kind) {
var st = assistantSettings();
if (ASSISTANT_KINDS.indexOf(kind) < 0) return { ok: false, error: 'نوع غير معروف' };
if (st.assistantMuted.indexOf(kind) < 0) st.assistantMuted.push(kind);
saveState();
return { ok: true };
}
function unmuteAssistant(kind) {
var st = assistantSettings();
st.assistantMuted = kind ? st.assistantMuted.filter(function (k) { return k !== kind; }) : [];
saveState();
return { ok: true };
}
function setAssistantLevel(level) {
assistantSettings().assistantLevel = level === 'quiet' ? 'quiet' : 'normal';
saveState();
return { ok: true };
}
function _accountUsage() {
var st = getState().settings;
if (!st.accountUsage || typeof st.accountUsage !== 'object') st.accountUsage = {};
return st.accountUsage;
}
function noteAccountUsage(id) {
if (!id) return { ok: false };
var au = _accountUsage();
au[String(id)] = Date.now();
saveState();
return { ok: true };
}
function rankedAccounts() {
var au = _accountUsage();
var now = Date.now();
var cutoff = now - 72 * 60 * 60 * 1000;
var list = (state && state.accounts) ? state.accounts.slice() : [];
list.sort(function (a, b) {
var ta = au[a.id] || 0;
var tb = au[b.id] || 0;
var ra = ta >= cutoff ? ta : 0;
var rb = tb >= cutoff ? tb : 0;
if (ra !== rb) return rb - ra; // recent first
return (tb - ta); // then by last use
});
return list;
}
function _featureUsage() {
var st = getState().settings;
if (!st.featureUsage || typeof st.featureUsage !== 'object') st.featureUsage = {};
return st.featureUsage;
}
function noteFeature(name) {
if (!name) return { ok: false };
var fu = _featureUsage();
fu[String(name)] = true;
saveState();
return { ok: true };
}
function aiIQ() {
var learned = 0;
try {
if (state && state.settings && state.settings.semanticDictionary) {
Object.keys(state.settings.semanticDictionary).forEach(function (k) {
var v = state.settings.semanticDictionary[k];
if (v && (v.source === 'taught' || v.source === 'trained')) learned++;
});
}
} catch (e) {}
var target = 50;
var pct = Math.min(100, Math.round((learned / target) * 100));
return { pct: pct, learned: learned, target: target };
}
function speedStreak() {
var st = getState().settings;
var today = todayISO();
if (st.speedStreakDate !== today) { st.speedStreak = 0; st.speedStreakDate = today; }
return st.speedStreak || 0;
}
function noteEntrySpeed(ms) {
if (!(ms > 0) || ms > 5000) return { ok: false };
var st = getState().settings;
var today = todayISO();
if (st.speedStreakDate !== today) { st.speedStreak = 0; st.speedStreakDate = today; }
st.speedStreak = (st.speedStreak || 0) + 1;
saveState();
return { ok: true, streak: st.speedStreak };
}
function cfoRank() {
var st = getState().settings;
var entries = (state && state.entries) ? state.entries.length : 0;
var fu = st.featureUsage || {};
var features = Object.keys(fu).filter(function (k) { return fu[k]; }).length;
var rank = 1;
var title = 'مدون مالي';
if (entries >= 5 && (fu.voice || fu.multiCurrency)) { rank = 2; title = 'محاسب ذكي'; }
if (entries >= 20 && features >= 3) { rank = 3; title = 'مدير تنفيذي — Pro CFO'; }
return { rank: rank, title: title, entries: entries, features: features };
}
function recordNetWorthSnapshot() {
var st = getState();
if (!st.settings.netWorthHistory) st.settings.netWorthHistory = [];
var today = todayISO();
var a = computeAnalysis();
var val = (a && typeof a.netWorth === 'number') ? a.netWorth : 0;
var hist = st.settings.netWorthHistory;
var found = false;
for (var i = 0; i < hist.length; i++) { if (hist[i].date === today) { hist[i].value = val; found = true; } }
if (!found) hist.push({ date: today, value: val });
if (hist.length > 365) hist.splice(0, hist.length - 365);
saveState();
return { ok: true, date: today, value: val };
}
function netWorthSeries(maxPoints) {
maxPoints = maxPoints || 30;
var st = getState();
var accMap = {};
(st.accounts || []).forEach(function (a) { accMap[a.id] = a; });
var byDate = {};
(st.entries || []).forEach(function (e) {
if (!e.date) return;
var delta = 0;
(e.lines || []).forEach(function (l) {
var acc = accMap[l.accountId];
if (!acc) return;
if (acc.type === 'asset' || acc.type === 'liability') {
delta += (Number(l.debitBase) || 0) - (Number(l.creditBase) || 0);
}
});
byDate[e.date] = (byDate[e.date] || 0) + delta;
});
var dates = Object.keys(byDate).sort();
var running = 0;
var map = {};
dates.forEach(function (d) {
running += byDate[d];
map[d] = running;
});
(st.settings && Array.isArray(st.settings.netWorthHistory) ? st.settings.netWorthHistory : []).forEach(function (pt) {
if (pt && pt.date && typeof pt.value === 'number') map[pt.date] = pt.value;
});
var today = todayISO();
if (dates.length && !(today in map)) {
map[today] = running;
}
var allDates = Object.keys(map).sort();
var points = allDates.slice(-maxPoints).map(function (d) { return { date: d, value: map[d] }; });
var first = points.length ? points[0].value : 0;
var last = points.length ? points[points.length - 1].value : 0;
var deltaBase = last - first;
var deltaPct = (points.length >= 2 && first !== 0) ? Math.round((deltaBase / Math.abs(first)) * 100) : null;
return { points: points, firstValue: first, current: last, deltaBase: deltaBase, deltaPct: deltaPct };
}
function entriesByCounterparty(name) {
var n = normalizeAr(String(name || '')).trim();
if (!n) return [];
var dueEntryIds = {};
((getState().dueItems) || []).forEach(function (d) {
if (d && d.entryId && (normalizeAr(d.counterparty || '') === n || normalizeAr(d.counterparty || '').indexOf(n) >= 0)) {
dueEntryIds[d.entryId] = true;
}
});
return (getState().entries || []).filter(function (e) {
if (dueEntryIds[e.id]) return true;
if (e.counterparty_id) { var cp = (getState().counterparties || []).filter(function (c) { return c.id === e.counterparty_id; })[0]; if (cp && normalizeAr(cp.name || '') === n) return true; }
if (normalizeAr(e.counterparty || '') === n || normalizeAr(e.counterparty || '').indexOf(n) >= 0) return true;
return (e.lines || []).some(function (l) {
var lc = normalizeAr(l.counterparty || '');
return lc && (lc === n || lc.indexOf(n) >= 0);
});
}).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
}
function counterpartyBalance(name) {
var n = normalizeAr(String(name || '')).trim();
var entries = entriesByCounterparty(name);
var total = 0;
entries.forEach(function (e) { total += (e.totalBase || 0) * (e.kind === 'expense' || e.kind === 'repay' ? -1 : 1); });
var dueItems = !n ? [] : (getState().dueItems || []).filter(function (d) {
if (d.counterparty_id) { var _cp = (getState().counterparties || []).filter(function (c) { return c.id === d.counterparty_id; })[0]; if (_cp && normalizeAr(_cp.name || '') === n) return (Number(d.remaining) || 0) > 0; }
var cp = normalizeAr(d.counterparty || '');
return (cp === n || cp.indexOf(n) >= 0) && (Number(d.remaining) || 0) > 0;
});
var receivableBase = 0, payableBase = 0;
dueItems.forEach(function (d) {
if (d.kind === 'payable') payableBase += (Number(d.remaining) || 0);
else receivableBase += (Number(d.remaining) || 0);
});
return {
name: name,
entries: entries,
count: entries.length,
totalBase: total,
dueItems: dueItems,
receivableBase: receivableBase,
payableBase: payableBase,
netDueBase: receivableBase - payableBase
};
}
function userPinHash(text) {
try {
return 'sha256:' + (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(text))).slice(0, 48) : String(text).slice(0, 48));
} catch (e) { return 'sha256:' + String(text).slice(0, 48); }
}
function uidUser() { return uid('usr'); }
function uidRole() { return uid('role'); }
function uidAudit() { return uid('aud'); }
function uidEvent() { return uid('evt'); }
function uidSession() { return uid('ses'); }
var currentUserVar = null;
function seedDefaultRoles() {
if (!db) return;
if (!(root && root.RohOwner)) return;
var defaults = [
{ name: 'owner', label: 'المالك', perms: ['*'] },
{ name: 'accountant', label: 'محاسب', perms: ['entry.create','entry.update','entry.delete','draft.manage','export.run','report.view'] },
{ name: 'auditor', label: 'مراجع', perms: ['export.run','report.view','audit.view','event.view'] },
{ name: 'viewer', label: 'مشاهد', perms: ['report.view'] }
];
defaults.forEach(function (r) {
try { db.run('INSERT OR IGNORE INTO roles (id,name,label) VALUES (?,?,?)', [r.name, r.name, r.label]); } catch (e) {}
r.perms.forEach(function (p) {
try { db.run('INSERT OR IGNORE INTO role_permissions (role,permission) VALUES (?,?)', [r.name, p]); } catch (e) {}
});
});
}
function hasPermissionRole(role, permission) {
if (!role) return false;
if (role === 'owner') return true;
try {
var r = db.exec("SELECT 1 FROM role_permissions WHERE role=? AND (permission=? OR permission='*')", [role, permission]);
return !!(r && r[0] && r[0].values && r[0].values.length);
} catch (e) { return false; }
}
function currentUser() { return currentUserVar; }
function createUser(input) {
if (!(root && root.RohOwner)) return { ok: false, error: 'غير متاح في هذه النسخة' };
input = input || {};
var name = String(input.name || '').trim();
var username = String(input.username || '').trim();
var pin = String(input.pin || '');
var role = String(input.role || 'viewer');
if (!name || !username) return { ok: false, error: 'الاسم واسم المستخدم مطلوبان' };
if (pin.length < 4) return { ok: false, error: 'PIN 4 أحرف على الأقل' };
var id = uidUser();
var salt = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
var pinHash = userPinHash(pin + ':' + salt);
try {
db.run('INSERT INTO users (id,name,username,pinHash,salt,role,active,createdAt) VALUES (?,?,?,?,?,?,1,?)',
[id, name, username, pinHash, salt, role, new Date().toISOString()]);
saveState();
auditLog('create', 'user', id, null, { id: id, name: name, username: username, role: role });
return { ok: true, user: { id: id, name: name, username: username, role: role } };
} catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
function listUsers() {
if (!(root && root.RohOwner)) return [];
var out = [];
try {
var r = db.exec('SELECT id,name,username,role,active,createdAt,lastLogin FROM users');
if (r && r[0]) r[0].values.forEach(function (v) {
out.push({ id: v[0], name: v[1], username: v[2], role: v[3], active: !!v[4], createdAt: v[5], lastLogin: v[6] });
});
} catch (e) {}
return out;
}
function updateUser(id, patch) {
if (!(root && root.RohOwner)) return { ok: false, error: 'غير متاح في هذه النسخة' };
patch = patch || {};
var u = listUsers().filter(function (x) { return x.id === id; })[0];
if (!u) return { ok: false, error: 'المستخدم غير موجود' };
var before = Object.assign({}, u);
var sets = [], params = [];
if (patch.name != null) { sets.push('name=?'); params.push(String(patch.name).trim()); }
if (patch.role != null) { sets.push('role=?'); params.push(String(patch.role)); }
if (patch.active != null) { sets.push('active=?'); params.push(patch.active ? 1 : 0); }
if (patch.pin != null) {
var salt = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
sets.push('pinHash=?'); params.push(userPinHash(String(patch.pin) + ':' + salt));
sets.push('salt=?'); params.push(salt);
}
if (!sets.length) return { ok: true, user: u };
params.push(id);
try {
db.run('UPDATE users SET ' + sets.join(',') + ' WHERE id=?', params);
saveState();
var after = Object.assign({}, u, patch);
delete after.pin;
auditLog('update', 'user', id, before, after);
return { ok: true };
} catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
function deactivateUser(id) { return updateUser(id, { active: false }); }
function login(username, pin) {
if (!(root && root.RohOwner)) return { ok: false, error: 'غير متاح في هذه النسخة' };
username = String(username || '').trim();
var rows = [];
try {
var r = db.exec('SELECT id,name,username,pinHash,salt,role,active FROM users WHERE username=?', [username]);
if (r && r[0]) r[0].values.forEach(function (v) { rows.push(v); });
} catch (e) {}
if (!rows.length) { eventLog('login', 'unknown user: ' + username); return { ok: false, error: 'اسم المستخدم أو PIN غير صحيح' }; }
var v = rows[0];
if (!v[6]) { eventLog('login', 'inactive: ' + username); return { ok: false, error: 'الحساب معطّل' }; }
var salt = v[5], hash = v[3];
if (userPinHash(String(pin) + ':' + salt) !== hash) {
eventLog('login', 'bad pin: ' + username);
return { ok: false, error: 'اسم المستخدم أو PIN غير صحيح' };
}
currentUserVar = { id: v[0], name: v[1], username: v[2], role: v[5] };
try { db.run('UPDATE users SET lastLogin=? WHERE id=?', [new Date().toISOString(), v[0]]); } catch (e) {}
eventLog('login', 'ok: ' + username);
return { ok: true, user: currentUserVar };
}
function logout() {
if (currentUserVar) eventLog('logout', currentUserVar.username);
currentUserVar = null;
return { ok: true };
}
function hasPermissionFn(permission) {
var u = currentUserVar;
if (!u) return true; // backward-compat: no logged-in user => allow (single-user mode)
return hasPermissionRole(u.role, permission);
}
function auditLog(action, entityType, entityId, before, after, reason) {
if (!(root && root.RohOwner)) return;
try {
db.run('INSERT INTO audit_log (id,at,userId,action,entityType,entityId,beforeJson,afterJson,reason) VALUES (?,?,?,?,?,?,?,?,?)',
[uidAudit(), new Date().toISOString(), (currentUserVar ? currentUserVar.id : null), action, entityType, entityId || null,
before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after), reason || null]);
} catch (e) {}
}
function eventLog(kind, detail, meta) {
if (!(root && root.RohOwner)) return;
try {
db.run('INSERT INTO event_log (id,at,userId,kind,detail,metaJson) VALUES (?,?,?,?,?,?)',
[uidEvent(), new Date().toISOString(), (currentUserVar ? currentUserVar.id : null), kind, detail || null, meta ? JSON.stringify(meta) : null]);
} catch (e) {}
}
function auditReport(opts) {
if (!(root && root.RohOwner)) return [];
opts = opts || {};
var where = [], params = [];
if (opts.from) { where.push('at >= ?'); params.push(opts.from); }
if (opts.to) { where.push('at <= ?'); params.push(opts.to); }
if (opts.userId) { where.push('userId = ?'); params.push(opts.userId); }
if (opts.entityType) { where.push('entityType = ?'); params.push(opts.entityType); }
if (opts.action) { where.push('action = ?'); params.push(opts.action); }
var sql = 'SELECT id,at,userId,action,entityType,entityId,beforeJson,afterJson,reason FROM audit_log' + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY at DESC LIMIT ' + Math.max(1, Math.min(5000, opts.limit || 500));
var out = [];
try {
var r = db.exec(sql, params);
if (r && r[0]) r[0].values.forEach(function (v) {
out.push({ id: v[0], at: v[1], userId: v[2], action: v[3], entityType: v[4], entityId: v[5], before: v[6] ? JSON.parse(v[6]) : null, after: v[7] ? JSON.parse(v[7]) : null, reason: v[8] });
});
} catch (e) {}
return out;
}
function eventReport(opts) {
if (!(root && root.RohOwner)) return [];
opts = opts || {};
var where = [], params = [];
if (opts.from) { where.push('at >= ?'); params.push(opts.from); }
if (opts.to) { where.push('at <= ?'); params.push(opts.to); }
if (opts.kind) { where.push('kind = ?'); params.push(opts.kind); }
if (opts.userId) { where.push('userId = ?'); params.push(opts.userId); }
var sql = 'SELECT id,at,userId,kind,detail,metaJson FROM event_log' + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY at DESC LIMIT ' + Math.max(1, Math.min(5000, opts.limit || 500));
var out = [];
try {
var r = db.exec(sql, params);
if (r && r[0]) r[0].values.forEach(function (v) {
out.push({ id: v[0], at: v[1], userId: v[2], kind: v[3], detail: v[4], meta: v[5] ? JSON.parse(v[5]) : null });
});
} catch (e) {}
return out;
}
function rolesList() { if (!(root && root.RohOwner)) return []; return (function(){ var out=[]; try{var r=db.exec('SELECT id,name,label FROM roles'); if(r&&r[0]) r[0].values.forEach(function(v){out.push({id:v[0],name:v[1],label:v[2]});});}catch(e){} return out; })(); }
function rolePermissions(role) {
var out=[]; try { var r=db.exec('SELECT permission FROM role_permissions WHERE role=?',[role]); if(r&&r[0]) r[0].values.forEach(function(v){out.push(v[0]);}); } catch(e){} return out;
}
function setRolePermissions(role, perms) {
try { db.run('DELETE FROM role_permissions WHERE role=?',[role]); } catch(e){}
(perms||[]).forEach(function(p){ try { db.run('INSERT OR IGNORE INTO role_permissions (role,permission) VALUES (?,?)',[role,p]); } catch(e){} });
saveState();
}
function createRole(name, label) {
var id = uidRole();
try { db.run('INSERT INTO roles (id,name,label) VALUES (?,?,?)',[id,name,label||name]); saveState(); return {ok:true,role:{id:id,name:name,label:label||name}}; }
catch(e){ return {ok:false,error:String(e&&e.message||e)}; }
}
function deleteRole(name) {
if (name === 'owner') return {ok:false,error:'لا يمكن حذف دور المالك'};
try { db.run('DELETE FROM role_permissions WHERE role=?',[name]); db.run('DELETE FROM roles WHERE name=?',[name]); saveState(); return {ok:true}; }
catch(e){ return {ok:false,error:String(e&&e.message||e)}; }
}
function recordLicenseSale(input) {
if (!(root && root.RohOwner)) return { ok: false, error: 'غير متاح في هذه النسخة' };
input = input || {};
var id = uid('sale');
var device = String(input.device || '').trim();
var code = String(input.code || '').trim();
var buyerId = input.buyerId || null;
var buyerName = String(input.buyerName || '').trim();
var tier = String(input.tier || 'annual');
var price = Math.round(Number(input.price) || 0);
var currency = String(input.currency || BASE);
var gift = input.gift ? 1 : 0;
if (!device || !code) return { ok: false, error: 'رمز الجهاز والكود مطلوبان' };
try {
db.run('INSERT INTO license_sales (id,device,code,buyerId,buyerName,tier,price,currency,paidAt,issuedAt,gift) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
[id, device, code, buyerId, buyerName, tier, price, currency, input.paidAt || null, new Date().toISOString(), gift]);
saveState();
auditLog('create', 'license_sale', id, null, { id: id, device: device, buyerName: buyerName, tier: tier, price: price });
return { ok: true, sale: { id: id, device: device, code: code, buyerName: buyerName, tier: tier, price: price, currency: currency, gift: !!gift } };
} catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
function listLicenseSales(opts) {
if (!(root && root.RohOwner)) return [];
opts = opts || {};
var out = [];
try {
var r = db.exec('SELECT id,device,code,buyerId,buyerName,tier,price,currency,paidAt,issuedAt,revokedAt,receipt,gift FROM license_sales ORDER BY issuedAt DESC');
if (r && r[0]) r[0].values.forEach(function (v) {
out.push({ id: v[0], device: v[1], code: v[2], buyerId: v[3], buyerName: v[4], tier: v[5], price: v[6], currency: v[7], paidAt: v[8], issuedAt: v[9], revokedAt: v[10], receipt: v[11], gift: !!v[12] });
});
} catch (e) {}
if (opts.buyerId) out = out.filter(function (s) { return s.buyerId === opts.buyerId; });
if (opts.tier) out = out.filter(function (s) { return s.tier === opts.tier; });
if (opts.from) out = out.filter(function (s) { return s.issuedAt >= opts.from; });
if (opts.to) out = out.filter(function (s) { return s.issuedAt <= opts.to; });
return out;
}
function getLicenseSale(id) {
if (!(root && root.RohOwner)) return null;
return listLicenseSales().filter(function (s) { return s.id === id; })[0] || null;
}
function revokeLicenseSale(id, receipt) {
if (!(root && root.RohOwner)) return { ok: false, error: 'غير متاح في هذه النسخة' };
try {
db.run('UPDATE license_sales SET revokedAt=?, receipt=? WHERE id=?', [new Date().toISOString(), receipt || null, id]);
saveState();
auditLog('update', 'license_sale', id, null, { revokedAt: new Date().toISOString(), receipt: receipt });
return { ok: true };
} catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
function licenseSalesReport(opts) {
if (!(root && root.RohOwner)) return null;
opts = opts || {};
var sales = listLicenseSales(opts);
var totalRevenue = 0, byTier = {}, byMonth = {};
sales.forEach(function (s) {
if (!s.gift) totalRevenue += (s.price || 0);
byTier[s.tier] = (byTier[s.tier] || 0) + 1;
var m = (s.issuedAt || '').slice(0, 7);
if (m) byMonth[m] = (byMonth[m] || 0) + 1;
});
return {
count: sales.length,
revenue: totalRevenue,
byTier: byTier,
byMonth: byMonth,
revoked: sales.filter(function (s) { return !!s.revokedAt; }).length,
gifted: sales.filter(function (s) { return s.gift; }).length
};
}
var api = {
STORAGE_KEY: STORAGE_KEY,
SCHEMA_VERSION: SCHEMA_VERSION,
VERSION: VERSION,
get BASE() { return BASE; },
NEW_SIGNS: NEW_SIGNS,
RATES: RATES,
getRate: getRate,
setRate: setRate,
setBaseCurrency: setBaseCurrency,
getProfile: getProfile,
setProfile: setProfile,
setOnboarded: setOnboarded,
PERSONAS: PERSONAS,
getPersona: getPersona,
applyPersona: applyPersona,
PLANS: PLANS,
get FREE_MONTHLY_ENTRIES() { return FREE_MONTHLY_ENTRIES; },
setFreeMonthlyEntries: setFreeMonthlyEntries,
getPlanInfo: getPlanInfo,
planAllows: planAllows,
setPlan: setPlan,
setLimitsEnforced: setLimitsEnforced,
setEntryLimitEnforced: setEntryLimitEnforced,
maxSeenDate: maxSeenDate,
notificationSchedule: notificationSchedule,
setLastBackupAt: setLastBackupAt,
getLastBackupAt: getLastBackupAt,
setQuietHours: setQuietHours,
setQuietStart: setQuietStart,
setQuietEnd: setQuietEnd,
setDailyCap: setDailyCap,
setBackupReminderDays: setBackupReminderDays,
quietHoursOn: quietHoursOn,
quietStart: quietStart,
quietEnd: quietEnd,
dailyCap: dailyCap,
backupReminderDays: backupReminderDays,
recordSeenDate: recordSeenDate,
setMaxSeenDate: setMaxSeenDate,
isClockRolledBack: isClockRolledBack,
exportTraining: exportTraining,
readTrainingFile: readTrainingFile,
checkDraftAllowed: checkDraftAllowed,
deviceCode: deviceCode,
activateApp: activateApp,
checkActivationInput: checkActivationInput,
parseActivationCode: parseActivationCode,
ACTIVATION_CODE_LENGTH: CODE_LENGTH,
TIMED_CODE_LENGTH: TIMED_CODE_LENGTH,
PROMO_CODE_LENGTH: PROMO_CODE_LENGTH,
isActivated: isActivated,
activationCodeHere: activationCodeHere,
activationValidFor: activationValidFor,
ownerActivationCode: ownerActivationCode,
verifyOwnerPublicKeyIntegrity: verifyOwnerPublicKeyIntegrity,
isCodeRevoked: isCodeRevoked,
revokeLicenseForRefund: revokeLicenseForRefund,
verifyRefundReceipt: verifyRefundReceipt,
transferLicense: transferLicense,
verifyTransferCertificate: verifyTransferCertificate,
foreignLicenseInBooks: foreignLicenseInBooks,
featureTrialLeft: featureTrialLeft,
useFeatureTrial: useFeatureTrial,
resetFeatureTrials: resetFeatureTrials,
getPricingOffer: getPricingOffer,
vocabSaltedHash: vocabSaltedHash,
generalAccountOf: generalAccountOf,
generalAccountsFor: generalAccountsFor,
generalAccountGroups: generalAccountGroups,
setStorageKey: setStorageKey,
isStorageSealed: isStorageSealed,
storedBooksSealed: storedBooksSealed,
sealBytes: sealBytes,
openSealedBytes: openSealedBytes,
sealText: sealText,
openText: openText,
ownerSellCodes: ownerSellCodes,
ownerRecordPayment: ownerRecordPayment,
ownerIssueCodes: ownerIssueCodes,
createUser: createUser,
updateUser: updateUser,
deactivateUser: deactivateUser,
listUsers: listUsers,
login: login,
logout: logout,
currentUser: currentUser,
hasPermission: hasPermissionFn,
auditLog: auditLog,
eventLog: eventLog,
auditReport: auditReport,
eventReport: eventReport,
seedDefaultRoles: seedDefaultRoles,
rolesList: rolesList,
rolePermissions: rolePermissions,
setRolePermissions: setRolePermissions,
createRole: createRole,
deleteRole: deleteRole,
hasPermissionRole: hasPermissionRole,
recordLicenseSale: recordLicenseSale,
listLicenseSales: listLicenseSales,
getLicenseSale: getLicenseSale,
revokeLicenseSale: revokeLicenseSale,
licenseSalesReport: licenseSalesReport,
getRates: RATES_LIVE,
getVocabVersion: getVocabVersion,
getVocabStatus: getVocabStatus,
EXAMPLE_PHRASES: EXAMPLE_PHRASES,
searchAll: searchAll,
composerSuggestions: composerSuggestions,
noteExamples: noteExamples,
noteUsage: noteUsage,
integrityCheck: integrityCheck,
resetDictionary: resetDictionary,
setAutoLearn: setAutoLearn,
learnFromConfirmed: learnFromConfirmed,
onAccountRenamed: onAccountRenamed,
onAccountRemoved: onAccountRemoved,
queueLearnedWord: queueLearnedWord,
listLearnedWords: listLearnedWords,
promoteLearnedWord: promoteLearnedWord,
dismissLearnedWord: dismissLearnedWord,
reminderSchedule: reminderSchedule,
notificationCategoryOn: notificationCategoryOn,
setNotificationCategory: setNotificationCategory,
recordBackup: recordBackup,
NOTIFY_CATEGORIES: NOTIFY_CATEGORIES,
setRemindersEnabled: setRemindersEnabled,
setReminderTime: setReminderTime,
setAutoBackup: setAutoBackup,
recordLaunch: recordLaunch,
listCurrencies: listCurrencies,
currencyTypes: CURRENCY_TYPES,
currencyTypeNames: CURRENCY_TYPE_NAMES,
addCurrency: addCurrency,
removeCurrency: removeCurrency,
editCurrency: editCurrency,
currencyHistory: currencyHistory,
isCurrencyUsed: isCurrencyUsed,
currencySymbol: currencySymbol,
currencyFlag: currencyFlag,
currencyCountry: currencyCountry,
SYMBOL: SYMBOL,
MONTHS: MONTHS,
KIND_META: KIND_META,
ACCOUNT_DEFS: ACCOUNT_DEFS,
todayISO: todayISO,
addDays: addDays,
daysBetween: daysBetween,
isValidDate: isValidDate,
fmtDate: fmtDate,
fmtMoney: fmtMoney,
toBase: toBase,
fromBase: fromBase,
normalizeAr: normalizeAr,
normalizeName: normalizeName,
extractParty: extractParty,
extractPartyRaw: extractPartyRaw,
detectAccount: detectAccount,
extractAmount: extractAmount,
extractEntities: extractEntities,
escapeHtml: escapeHtml,
parseIntent: parseIntent,
buildDraft: buildDraft,
buildSplitDraft: buildSplitDraft,
avgCostOf: avgCostOf,
exchangeQuote: exchangeQuote,
buildExchangeDraft: buildExchangeDraft,
exchangeIntent: exchangeIntent,
ensurePeopleAccounts: ensurePeopleAccounts,
kindFromAction: kindFromAction,
UX_EVENTS: UX_EVENTS,
isUxProgram: isUxProgram,
setUxProgram: setUxProgram,
noteError: noteError,
uxReport: uxReport,
uxReportText: uxReportText,
clearUxData: clearUxData,
revaluationPreview: revaluationPreview,
buildRevaluationDraft: buildRevaluationDraft,
resolvePersonAccount: resolvePersonAccount,
moneyPlacesIn: moneyPlacesIn,
validateLines: validateLines,
createDraft: createDraft,
confirmDraft: confirmDraft,
postOpeningBalance: postOpeningBalance,
setOnEntryConfirmed: setOnEntryConfirmed,
settleDueItem: settleDueItem,
allocateSettlement: allocateSettlement,
entryFx: entryFx,
settlementIntent: settlementIntent,
setFontStep: setFontStep,
isTrainingCode: isTrainingCode,
isDictionaryCode: isDictionaryCode,
isOwnerCode: isOwnerCode,
setDictionaryOption: setDictionaryOption,
setVerifyActions: setVerifyActions,
setAppLock: setAppLock,
isAnomalous: isAnomalous,
setDefaultDueDays: setDefaultDueDays,
setOwnerGate: setOwnerGate,
setTrainingOption: setTrainingOption,
setOwnerCodesOption: setOwnerCodesOption,
mainCurrency: mainCurrency,
mainCurrencyLocked: mainCurrencyLocked,
moneyGroups: moneyGroups,
isFavoriteAccount: isFavoriteAccount,
favoriteCurrencies: favoriteCurrencies,
isFavoriteCurrency: isFavoriteCurrency,
toggleFavoriteCurrency: toggleFavoriteCurrency,
accountLedgerBalance: accountLedgerBalance,
closeAccountBalance: closeAccountBalance,
toggleFavoriteAccount: toggleFavoriteAccount,
findMoneyGroup: findMoneyGroup,
createMoneyGroup: createMoneyGroup,
deleteMoneyGroup: deleteMoneyGroup,
addGroupExpense: addGroupExpense,
removeGroupExpense: removeGroupExpense,
groupBalances: groupBalances,
settleGroup: settleGroup,
cashFlowReport: cashFlowReport,
accountQuestion: accountQuestion,
wantsReports: wantsReports,
statementEntryMatches: statementEntryMatches,
GROUP_ME: GROUP_ME,
accountBalanceShown: accountBalanceShown,
accountCurrencies: accountCurrencies,
rateAgainstMain: rateAgainstMain,
fmtRate: fmtRate,
currencyDecimals: currencyDecimals,
setRateDecimals: setRateDecimals,
getRateDecimals: getRateDecimals,
importCSV: importCSV,
previewCSV: previewCSV,
importOFX: importOFX,
importQIF: importQIF,
importFinancial: importFinancial,
rateFromMain: rateFromMain,
setMainCurrency: setMainCurrency,
setDefaultMultiCurrency: setDefaultMultiCurrency,
defaultMultiCurrency: function () { return !!(state && state.settings && state.settings.defaultMultiCurrency); },
topCurrenciesForDialect: topCurrenciesForDialect,
selectSuggestedBaseCurrency: selectSuggestedBaseCurrency,
exampleInMainCurrency: exampleInMainCurrency,
WORLD_CURRENCIES: WORLD_CURRENCIES,
trainSentence: trainSentence,
sentenceKeyword: sentenceKeyword,
listTrained: listTrained,
removeTrained: removeTrained,
setAutoTts: setAutoTts,
setLanguage: setLanguage,
isAccountLocked: isAccountLocked,
accountTakes: accountTakes,
setAccountCurrencies: setAccountCurrencies,
overdraftFix: overdraftFix,
fixOverdraft: fixOverdraft,
dueContraAccount: dueContraAccount,
canDeleteEntry: canDeleteEntry,
cancelDraft: cancelDraft,
duplicateDraft: duplicateDraft,
updateDraft: updateDraft,
draftAmount: draftAmount,
findDraft: findDraft,
addDraft: addDraft,
lineRate: lineRate,
linesExchange: linesExchange,
accountCandidates: accountCandidates,
deleteEntry: deleteEntry,
undoLast: undoLast,
computeAnalysis: computeAnalysis,
computeTradingRadar: computeTradingRadar,
computeCashFlowForecast: computeCashFlowForecast,
computeNetWorthTrend: computeNetWorthTrend,
computeDebtPayoffPlan: computeDebtPayoffPlan,
generateMarketingContent: generateMarketingContent,
getAccount: getAccount,
addAccount: addAccount,
checkAccountName: checkAccountName,
getState: getState,
counterparties: function () { return (getState().counterparties || []).slice(); },
getCounterparty: function (id) { return (getState().counterparties || []).filter(function (c) { return c.id === id; })[0] || null; },
loadState: loadState,
saveState: saveState,
autoBackup: autoBackup,
createSafetySnapshot: createSafetySnapshot,
listBackups: listBackups,
restoreBackup: restoreBackup,
deleteBackup: deleteBackup,
previewBackup: previewBackup,
getStorageStatus: getStorageStatus,
flushSaves: flushSaves,
onStorageStatus: onStorageStatus,
resolveDamagedDb: resolveDamagedDb,
freshState: freshState,
ensureState: ensureState,
resetState: resetState,
replaceState: replaceState,
validateState: validateState,
exportJSON: exportJSON,
encryptBackup: encryptBackup,
decryptBackup: decryptBackup,
isEncryptedBackup: isEncryptedBackup,
setHideAmounts: setHideAmounts,
setSimpleMode: setSimpleMode,
budgetList: budgetList,
addBudget: addBudget,
removeBudget: removeBudget,
budgetStatus: budgetStatus,
assistantNotes: assistantNotes,
setNotifyDetail: setNotifyDetail,
notifyDetail: notifyDetail,
detectFraudRisk: detectFraudRisk,
assistantBrief: assistantBrief,
assistantReflection: assistantReflection,
assistantWeekly: assistantWeekly,
goalOptions: goalOptions,
setMonthlyGoal: setMonthlyGoal,
monthlyGoal: monthlyGoal,
noteGoalAsked: noteGoalAsked,
markAssistantSeen: markAssistantSeen,
rescheduleDue: rescheduleDue,
lastSaveStats: function () { return lastSave; },
dbCount: function (table) {
if (!db || STATE_TABLES.indexOf(table) < 0) return null;
var r = db.exec('SELECT COUNT(*) FROM ' + table);
return r && r[0] ? Number(r[0].values[0][0]) : 0;
},
muteAssistant: muteAssistant,
unmuteAssistant: unmuteAssistant,
setAssistantLevel: setAssistantLevel,
recordNetWorthSnapshot: recordNetWorthSnapshot,
netWorthSeries: netWorthSeries,
entriesByCounterparty: entriesByCounterparty,
counterpartyBalance: counterpartyBalance,
recurringList: recurringList,
addRecurring: addRecurring,
removeRecurring: removeRecurring,
editRecurring: editRecurring,
runAllDueRecurring: runAllDueRecurring,
recurringDue: recurringDue,
advanceRecurring: advanceRecurring,
runRecurring: runRecurring,
setAIEnabled: setAIEnabled,
setAiAlwaysAllow: setAiAlwaysAllow,
uid: uid,
dueStatus: dueStatus,
ensureMemoryLoaded: ensureMemoryLoaded,
reloadMemory: reloadMemory,
adaptiveLookup: adaptiveLookup,
trainVocabulary: trainVocabulary,
getVocabCount: getVocabCount,
listVocab: listVocab,
deleteVocab: deleteVocab,
restoreVocab: restoreVocab,
listVocabTrash: listVocabTrash,
emptyVocabTrash: emptyVocabTrash,
exportVocabJSON: exportVocabJSON,
importVocabJSON: importVocabJSON,
embed: embed,
cosineSimilarity: cosineSimilarity,
trainVectorMemory: trainVectorMemory,
vectorSearch: vectorSearch,
correctClassification: correctClassification,
evaluateAutoConfirm: evaluateAutoConfirm,
buildContextualRepertoire: buildContextualRepertoire,
getContextualRepertoire: getContextualRepertoire,
runChargingOpportunityBuilder: runChargingOpportunityBuilder,
updateBatteryStatus: updateBatteryStatus,
aiGovernorStatus: aiGovernorStatus,
vectorMemoryEnabled: vectorMemoryEnabled,
setVectorMemoryEnabled: setVectorMemoryEnabled,
vectorAutoConfirm: vectorAutoConfirm,
setVectorAutoConfirm: setVectorAutoConfirm,
vectorCount: vectorCount,
noteFeature: noteFeature,
aiIQ: aiIQ,
speedStreak: speedStreak,
noteEntrySpeed: noteEntrySpeed,
cfoRank: cfoRank,
noteAccountUsage: noteAccountUsage,
rankedAccounts: rankedAccounts
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.RohEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
