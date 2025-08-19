// send-report.v74b.js
document.addEventListener('DOMContentLoaded', () => {
  const RELAY_URL     = 'https://hvac-email-relay.vercel.app/api/sendCsv';
  const REPORT_TO     = 'brianphister@gmail.com'; // replace with your email
  const SHARED_SECRET = 'Axpquvxp'; // optional secret

  function addSendButton() {
    const csvBtn = document.querySelector('button#exportCsv') || document.querySelector('button');
    if (!csvBtn) return;

    const sendBtn = document.createElement('button');
    sendBtn.id = 'sendReport';
    sendBtn.textContent = 'Send Report';
    sendBtn.style.marginLeft = '10px';
    csvBtn.parentNode.insertBefore(sendBtn, csvBtn.nextSibling);

    sendBtn.addEventListener('click', async () => {
      try {
        const csvData = localStorage.getItem('hvac_history_csv') || '';
        if (!csvData) {
          alert('No report data found.');
          return;
        }
        const res = await fetch(RELAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: REPORT_TO,
            secret: SHARED_SECRET,
            csv: csvData
          })
        });
        if (res.ok) {
          alert('Report sent successfully!');
        } else {
          alert('Failed to send report.');
        }
      } catch (err) {
        console.error(err);
        alert('Error sending report.');
      }
    });
  }
  addSendButton();
});
