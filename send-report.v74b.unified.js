/*! send-report.v74b.unified.js — DIAG build: step-toasts so we see exactly where it fails */
(() => {
  'use strict';

  // ==== YOUR SETTINGS ====
  const RELAY_URL     = 'https://hvac-email-relay.vercel.app/api/sendCsv';
  const REPORT_TO     = 'Brianphister@gmail.com';
  const SHARED_SECRET = 'Axpquvxp';
  // =======================

  const DEBUG = true; // shows step toasts

  function showToast(msg, isError=false) {
    try {
      const el = document.createElement('div');
      el.textContent = msg;
      el.style.position = 'fixed';
      el.style.right = '12px';
      el.style.bottom = '12px';
      el.style.padding = '10px 14px';
      el.style.borderRadius = '8px';
      el.style.fontWeight = '700';
      el.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial';
      el.style.color = '#fff';
      el.style.background = isError ? '#d32f2f' : '#2e7d32';
      el.style.boxShadow = '0 8px 20px rgba(0,0,0,.18)';
      el.style.zIndex = 2147483647; // max
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3200);
    } catch {
      // absolute fallback if DOM APIs are blocked
      try { alert(msg); } catch {}
    }
  }
  const step = (m) => { if (DEBUG) showToast(m); };

  function pickKeys(rows){
    if (!rows || !rows.length) return [];
    const pref = ['timestamp','refrigerant','systemType','indoorDbF','indoorWbF','outdoorDbF','suctionPsig','liquidPsig','suctionLineTempF','liquidLineTempF','targetSuperheatF','targetSubcoolF','superheatF','subcoolF','evapSatF','condSatF','deltaTF','satF','ratF','diagnosis','confidence'];
    const keys = Object.keys(rows[0]);
    const out = pref.filter(k => keys.includes(k));
    for (const k of keys) if (!out.includes(k)) out.push(k);
    return out;
  }
  function toCsv(rows){
    if (!rows || !rows.length) return '';
    const keys = pickKeys(rows);
    const esc = v => (v==null) ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g,'""')}"` : String(v);
    const head = keys.join(',');
    const body = rows.map(r => keys.map(k => esc(r[k])).join(',')).join('\n');
    return head + '\n' + body + '\n';
  }

  function getCsv() {
    try {
      if (typeof window.buildHistoryCsv === 'function') {
        step('CSV: buildHistoryCsv()');
        const s = window.buildHistoryCsv();
        if (s && /,/.test(String(s))) return String(s);
      }
    } catch(e){ step('CSV err: buildHistoryCsv'); }

    try {
      if (typeof window.exportHistoryToCsv === 'function') {
        step('CSV: exportHistoryToCsv()');
        const s = window.exportHistoryToCsv({ returnString: true });
        if (s && /,/.test(String(s))) return String(s);
      }
    } catch(e){ step('CSV err: exportHistoryToCsv'); }

    try {
      if (typeof window.__lastCsv === 'string' && /,/.test(window.__lastCsv)) {
        step('CSV: __lastCsv');
        return window.__lastCsv;
      }
    } catch {}

    try {
      const direct = localStorage.getItem('hvac_history_csv');
      if (direct && /,/.test(direct)) {
        step('CSV: localStorage hvac_history_csv');
        return direct;
      }
      let best = null, bestLen = 0, bestKey = '';
      for (let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i)||'';
        if (!/history/i.test(k)) continue;
        try {
          const parsed = JSON.parse(localStorage.getItem(k));
          if (Array.isArray(parsed) && parsed.length > bestLen) { best=parsed; bestLen=parsed.length; bestKey=k; }
        } catch {}
      }
      if (best && best.length) {
        step('CSV: localStorage ' + bestKey + ' (' + bestLen + ')');
        return toCsv(best);
      }
    } catch(e){ step('CSV err: localStorage'); }

    try {
      const items = Array.from(document.querySelectorAll('.history .hist, #history .hist, [data-history-item]'));
      if (items.length) {
        step('CSV: DOM fallback (' + items.length + ')');
        const rows = items.map((el,i)=>({ index:i+1, text:(el.textContent||'').trim().replace(/\s+/g,' ') }));
        return toCsv(rows);
      }
    } catch(e){ step('CSV err: DOM'); }

    return '';
  }

  async function postCsv(csv){
    step('Relay: POST start');
    const resp = await fetch(RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        to: REPORT_TO,
        subject: 'HVAC Report Export',
        text: 'CSV attached from HVAC Troubleshooter.',
        csvContent: csv,
        secret: SHARED_SECRET
      })
    });
    step('Relay: HTTP ' + resp.status);
    const data = await resp.json().catch(()=>({}));
    if (!resp.ok) throw new Error(data.error || ('HTTP ' + resp.status));
    return data;
  }

  async function sendReportNow(evt){
    try {
      if (evt) { evt.preventDefault?.(); evt.stopPropagation?.(); }
      step('Send: pressed');

      let csv = getCsv();
      if (!csv) {
        step('CSV: empty, try auto-export');
        const exportBtn = findExportButton();
        if (exportBtn) {
          exportBtn.click();
          setTimeout(async () => {
            const csv2 = getCsv();
            if (!csv2) { showToast('No report data found after export.', true); return; }
            try { await postCsv(csv2); showToast('Report sent ✔'); }
            catch (e) { showToast('Failed: ' + (e?.message || e), true); }
          }, 400);
          return;
        }
        showToast('No report data found.', true);
        return;
      }

      step('CSV: ' + (csv.length) + ' chars');
      await postCsv(csv);
      showToast('Report sent ✔');
    } catch (e) {
      showToast('Failed: ' + (e?.message || e), true);
    }
  }

  function findExportButton(){
    const id = document.querySelector('#exportCsv, #exportCSV, #exportCsvBtn');
    if (id) return id;
    const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
    return btns.find(b => /export\s*csv/i.test((b.textContent||'').trim())) || null;
  }

  function ensureButton(){
    let btn = document.getElementById('sendReportBtn') || document.getElementById('send-report-btn');
    const exportBtn = findExportButton();
    const parent = exportBtn?.parentElement || document.querySelector('#history-controls, .history-controls, .history .actions') || null;

    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'sendReportBtn';
      btn.type = 'button';
      btn.textContent = 'Send Report';
      btn.className = exportBtn?.className || 'btn secondary';
      if (parent) parent.insertBefore(btn, exportBtn ? exportBtn.nextSibling : null);
      else document.body.appendChild(btn);
    } else {
      if (exportBtn && btn.parentElement !== exportBtn.parentElement) {
        exportBtn.parentElement.insertBefore(btn, exportBtn.nextSibling);
      }
      if (exportBtn) btn.className = exportBtn.className || btn.className;
    }

    if (!btn.__wired) {
      btn.addEventListener('click', sendReportNow, { passive:false });
      btn.addEventListener('touchend', sendReportNow, { passive:false });
      btn.__wired = true;
    }
  }

  function start(){
    ensureButton();
    const obs = new MutationObserver(() => ensureButton());
    obs.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();
