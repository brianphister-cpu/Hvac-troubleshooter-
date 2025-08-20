/*! send-report.v74b.unified.js — v7.4e-safe Send Report (matches Export button style + robust CSV) */
(() => {
  'use strict';

  // ===== CONFIG (pre-filled for you) =====
  const RELAY_URL     = 'https://hvac-email-relay.vercel.app/api/sendCsv';
  const REPORT_TO     = 'Brianphister@gmail.com';   // always send to you
  const SHARED_SECRET = 'Axpquvxp';                 // relay shared secret
  // ======================================

  // Toast feedback (non-blocking)
  function showToast(msg, isError=false) {
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
    el.style.zIndex = 99999;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function pickKeys(rows){
    if (!rows || !rows.length) return [];
    const pref = [
      'timestamp','refrigerant','systemType',
      'indoorDbF','indoorWbF','outdoorDbF',
      'suctionPsig','liquidPsig','suctionLineTempF','liquidLineTempF',
      'targetSuperheatF','targetSubcoolF','superheatF','subcoolF',
      'evapSatF','condSatF','deltaTF','satF','ratF',
      'diagnosis','confidence'
    ];
    const keys = Object.keys(rows[0]);
    const out = pref.filter(k => keys.includes(k));
    for (const k of keys) if (!out.includes(k)) out.push(k);
    return out;
  }
  function toCsv(rows){
    if (!rows || !rows.length) return '';
    const keys = pickKeys(rows);
    const esc = v => {
      if (v == null) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
    };
    const head = keys.join(',');
    const body = rows.map(r => keys.map(k => esc(r[k])).join(',')).join('\n');
    return head + '\n' + body + '\n';
  }

  // Get the same CSV your Export uses; fallbacks included
  function getCsv() {
    try { if (typeof window.buildHistoryCsv === 'function') {
      const s = window.buildHistoryCsv();
      if (s && /,/.test(String(s))) return String(s);
    }} catch {}
    try { if (typeof window.exportHistoryToCsv === 'function') {
      const s = window.exportHistoryToCsv({ returnString: true });
      if (s && /,/.test(String(s))) return String(s);
    }} catch {}

    if (typeof window.__lastCsv === 'string' && /,/.test(window.__lastCsv)) return window.__lastCsv;

    // localStorage fallbacks
    try {
      const direct = localStorage.getItem('hvac_history_csv');
      if (direct && /,/.test(direct)) return direct;

      let best = null, bestLen = 0;
      for (let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i) || '';
        if (!/history/i.test(k)) continue;
        try {
          const parsed = JSON.parse(localStorage.getItem(k));
          if (Array.isArray(parsed) && parsed.length > bestLen) {
            best = parsed; bestLen = parsed.length;
          }
        } catch {}
      }
      if (best && best.length) return toCsv(best);
    } catch {}

    // DOM fallback (light)
    const items = Array.from(document.querySelectorAll('.history .hist, #history .hist, [data-history-item]'));
    if (items.length) {
      const rows = items.map((el,i)=>({ index:i+1, text:(el.textContent||'').trim().replace(/\s+/g,' ') }));
      return toCsv(rows);
    }
    return '';
  }

  async function postCsv(csv){
    const resp = await fetch(RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        to: REPORT_TO,
        subject: 'HVAC Report Export',
        text: 'CSV attached from HVAC Troubleshooter.',
        csvContent: csv,          // relay will base64 + attach
        secret: SHARED_SECRET
      })
    });
    const data = await resp.json().catch(()=>({}));
    if (!resp.ok) throw new Error(data.error || ('HTTP ' + resp.status));
  }

  async function sendReportNow(){
    let csv = getCsv();
    if (!csv) {
      // Nudge Export CSV once to populate caches, then retry
      const exportBtn = findExportButton();
      if (exportBtn) {
        exportBtn.click();
        setTimeout(async () => {
          csv = getCsv();
          if (!csv) { showToast('No report data found after export.', true); return; }
          try { await postCsv(csv); showToast('Report sent ✔'); }
          catch (e) { console.error(e); showToast('Failed: ' + (e?.message || e), true); }
        }, 350);
        return;
      }
      showToast('No report data found.', true);
      return;
    }
    try { await postCsv(csv); showToast('Report sent ✔'); }
    catch (e) { console.error(e); showToast('Failed: ' + (e?.message || e), true); }
  }

  function findExportButton(){
    const id = document.querySelector('#exportCsv, #exportCSV, #exportCsvBtn');
    if (id) return id;
    const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
    return btns.find(b => /export\s*csv/i.test((b.textContent||'').trim())) || null;
  }

  function matchStyle(sourceBtn, targetBtn){
    if (!sourceBtn || !targetBtn) return;
    // Copy classes
    targetBtn.className = sourceBtn.className || targetBtn.className;
    // Copy key inline/computed styles to blend in
    const s = window.getComputedStyle(sourceBtn);
    ['padding','borderRadius','fontWeight','fontSize','lineHeight','height','background','color','border','boxShadow','letterSpacing'].forEach(k => {
      targetBtn.style[k] = s[k];
    });
    targetBtn.style.marginLeft = (parseFloat(targetBtn.style.marginLeft)||6) + 'px';
  }

  function ensureButton(){
    // Use existing if present; else create
    let btn = document.getElementById('sendReportBtn') || document.getElementById('send-report-btn');
    const exportBtn = findExportButton();
    const parent = exportBtn?.parentElement || document.querySelector('#history-controls, .history-controls, .history .actions') || null;

    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'sendReportBtn';
      btn.type = 'button';
      btn.textContent = 'Send Report';
      btn.className = 'btn secondary'; // will be overridden to match Export
      if (parent) parent.insertBefore(btn, exportBtn ? exportBtn.nextSibling : null);
      else document.body.appendChild(btn);
    } else {
      // Move beside Export if needed
      if (exportBtn && btn.parentElement !== exportBtn.parentElement) {
        exportBtn.parentElement.insertBefore(btn, exportBtn.nextSibling);
      }
    }

    // Style-match to Export
    if (exportBtn) matchStyle(exportBtn, btn);

    // Wire once
    if (!btn.__wired) {
      btn.addEventListener('click', sendReportNow);
      btn.__wired = true;
    }
  }

  // Observe DOM so placement stays correct even if controls render later
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
```0
