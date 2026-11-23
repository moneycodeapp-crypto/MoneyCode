(function () {
  'use strict';
  if (navigator.storage && typeof navigator.storage.persist === 'function') {
    navigator.storage.persist().catch(function () {});
  }
  if ('serviceWorker' in navigator && /^https?:$/i.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
  var isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  var isStandalone = window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (isIos && !isStandalone && !localStorage.getItem('rohapp.iosInstallDismissed')) {
    window.addEventListener('DOMContentLoaded', function () {
      var bar = document.createElement('div');
      bar.style.cssText = 'position:fixed;bottom:64px;left:10px;right:10px;z-index:80;background:#064e3b;color:#fff;border:1px solid #f59e0b;border-radius:14px;padding:10px 12px;font-size:12.5px;display:flex;align-items:center;justify-content:space-between;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,0.22);direction:rtl';
      bar.innerHTML = '<span>📲 <b>لتثبيت موني كود على الآيفون بدون إنترنت:</b> اضغط زر المشاركة <b>⬆</b> في سفاري ثم اختر <b>«إضافة إلى الشاشة الرئيسية»</b>.</span>' +
        '<button type="button" style="background:rgba(255,255,255,0.18);color:#fff;border:0;border-radius:8px;padding:4px 8px;cursor:pointer;flex:none">✕</button>';
      bar.querySelector('button').addEventListener('click', function () {
        localStorage.setItem('rohapp.iosInstallDismissed', '1');
        bar.remove();
      });
      document.body.appendChild(bar);
    });
  }
})();
