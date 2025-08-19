
// send-report.v74b.js
// Adds a Send Report button to v7.4b that emails the CSV through your Vercel relay

const RELAY_URL     = 'https://hvac-email-relay.vercel.app/api/sendCsv';
const REPORT_TO     = 'brianphister@gmail.com';   // change to your email
const SHARED_SECRET = 'Axpquvxp';                      // optional shared secret

function addSendReportButton() {
  const exportBtn = document.querySelector('button#exportCsv') ||
                    document.querySelector('button.export-csv') ||
                    null;

  const btn = document.createElement('button');
  btn.textContent = 'Send Report';
  btn.style.marginLeft = '10px';
  btn.onclick = async () => {
    try {
      let csv = '';
      if (typeof buildHistoryCsv === 'function') {
        csv = buildHistoryCsv();
      } else {
        const rows = window.hvacHistory || [];
        csv = rows.map(r => Object.values(r).join(',')).join('\n');
      }

      const res = await fetch(RELAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: REPORT_TO,
          secret: SHARED_SECRET,
          csv
        })
      });

      if (!res.ok) throw new Error('Relay returned ' + res.status);
      alert('Report sent successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to send report: ' + err.message);
    }
  };

  if (exportBtn && exportBtn.parentNode) {
    exportBtn.parentNode.appendChild(btn);
  } else {
    document.body.appendChild(btn);
  }
}

window.addEventListener('DOMContentLoaded', addSendReportButton);
