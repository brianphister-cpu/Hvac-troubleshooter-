<!-- send-report.v74b.js -->
<script>
/*! Send Report — v7.4e-safe, smarter history detection */
(() => {
  'use strict';

  // EDIT THESE
  const RELAY_URL     = 'https://hvac-email-relay.vercel.app/api/sendCsv';
  const REPORT_TO     = 'Brianphister@gmail.com.com';   // <- your email
  const SHARED_SECRET = 'Axpquvxp';                      // <- your secret if you use one

  function onReady(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, {once:true});
    else fn();
  }

  function findExportButton(){
    const ids = document.querySelector('#exportCsv, #exportCSV');
    if (ids) return ids;
    const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
    // prefer exact-ish text: Export CSV
    return btns.find(b => /\bexport\s*csv\b/i.test((b.textContent||'').trim())) || null;
  }

  function hostNode(){
    return document.querySelector('#historyActions, #actionsRow, header, .panel, .app, body') || document.body;
  }

  // Try to pick up history no matter where v7.4e saved it
  function getAnyHistoryRecords(){
    // 1) If the app exposes a builder, trust it (it usually knows correct columns/order)
    if (typeof window.buildHistoryCsv === 'function') {
      const csv = String(window.buildHistoryCsv() || '');
      if (csv.trim()) return { csv, via: 'buildHistoryCsv' };
    }

    // 2) Probe localStorage for any hvac_history* keys (array of objects)
    try {
      const candidates = [];
      for (let i=0; i<localStorage.length; i++){
        const k = localStorage.key(i) || '';
        if (!/^hvac[_-]?history/i.test(k)) continue;
        try {
          const v = JSON.parse(localStorage.getItem(k));
          if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
            candidates.push({ key: k, data: v });
          } else if (typeof v === 'string' && v.includes(',')) {
            // Already CSV
            candidates.push({ key: k, csv: v });
          }
        } catch {}
      }
      if (candidates.length) {
        // Prefer the most recent-looking one (by key length or name)
        const best = candidates.sort((a,b)=> (b.key.length - a.key.length))[0];
        if (best.csv) return { csv: best.csv, via: `localStorage:${best.key}` };
        // Build CSV from objects
        const cols = getColumnUnion(best.data);
        const csv = toCsv(best.data, cols);
        return { csv, via: `localStorage:${best.key}` };
      }
    } catch {}

    // 3) Common globals
    if (Array.isArray(window.hvacHistory) && window.hvacHistory.length) {
      const cols = getColumnUnion(window.hvacHistory);
      const csv = toCsv(window.hvacHistory, cols);
      return { csv, via: 'window.hvacHistory' };
    }
    if (Array.isArray(window.historyLog) && window.historyLog.length) {
      const cols = getColumnUnion(window.historyLog);
      const csv = toCsv(window.historyLog, cols);
      return { csv, via: 'window.historyLog' };
    }

    // 4) Some apps cache last CSV as a string
    if (typeof window.__lastCsv === 'string' && window.__lastCsv.trim()) {
      return { csv: window.__lastCsv, via: '__lastCsv' };
    }

    return { csv: '', via: 'none' };
  }

  function getColumnUnion(rows){
    // Make a stable column order – prefer common fields first if present
    const preferred = [
      'timestamp','refrigerant','systemType',
      'indoorDbF','indoorWbF','outdoorDbF',
      'suctionPsig','liquidPsig','suctionLineTempF','liquidLineTempF',
      'targetSuperheatF','targetSubcoolF','superheatF','subcoolF',
      'evapSatF','condSatF','deltaTF','satF','ratF',
      'diagnosis','confidence'
    ];
    const have = new Set();
    rows.forEach(r => Object.keys(r||{}).forEach(k => have.add(k)));
    const tail = Array.from(have).filter(k => !preferred.includes(k)).sort();
    return preferred.filter(k => have.has(k)).concat(tail);
  }

  function toCsv(rows, cols){
    const head = cols.join(',');
    const body = rows.map(r => cols.map(k => sanitizeCsv(r?.[k])).join(',')).join('\n');
    return head + '\n' + body;
  }

  function sanitizeCsv(v){
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }

  async function sendReport(csvString){
    if (!csvString || !csvString.trim()) {
      alert('No report data found. Try Export CSV once, then Send Report.');
      return;
    }
    try{
      const resp = await fetch(RELAY_URL, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          to: REPORT_TO,
          subject: 'HVAC History CSV',
          text: 'CSV attached from HVAC Troubleshooter.',
          csvContent: csvString, // plain CSV; relay base64s it
          secret: SHARED_SECRET
        })
      });
      const data = await resp.json().catch(()=> ({}));
      if (!resp.ok) throw new Error(data.error || ('HTTP '+resp.status));
      alert('Report emailed ✔');
    } catch (err) {
      console.error('Send report failed:', err);
      alert('Send failed: ' + (err?.message || err));
    }
  }

  function createButton(){
    const btn = document.createElement('button');
    btn.id = 'sendReportBtn';
    btn.type = 'button';
    btn.textContent = 'Send Report';
    btn.className = 'btn primary';
    btn.style.marginLeft = '8px';
    btn.addEventListener('click', () => {
      const { csv } = getAnyHistoryRecords();
      sendReport(csv);
    });
    return btn;
  }

  function insertButton(){
    if (document.getElementById('sendReportBtn')) return;
    const exportBtn = findExportButton();
    const host = hostNode();
    const btn = createButton();
    if (exportBtn && exportBtn.parentElement) {
      exportBtn.parentElement.insertBefore(btn, exportBtn.nextSibling);
    } else {
      host.appendChild(btn);
    }
  }

  onReady(insertButton);
})();
</script>
