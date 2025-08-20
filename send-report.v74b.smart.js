/*! send-report.v74b.js
 * Safe add-only patch for v7.4e
 * Adds a "Send Report" button inside the History controls
 */

(() => {
  'use strict';

  // Function to gather CSV data from local history
  function buildCsvFromHistory() {
    const history = JSON.parse(localStorage.getItem('hvac_history') || '[]');
    if (!history.length) return null;

    // Build CSV header from object keys
    const headers = Object.keys(history[0]);
    const rows = history.map(entry => headers.map(h => entry[h] ?? "").join(","));
    return [headers.join(","), ...rows].join("\n");
  }

  // Function to send CSV to relay
  async function sendCsvToRelay() {
    const csv = buildCsvFromHistory();
    if (!csv) {
      alert("No report data found.");
      return;
    }

    try {
      const resp = await fetch("https://hvac-email-relay.vercel.app/api/sendCsv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv, 
          // always send to you – relay backend handles actual email send
          to: "brianphister@gmail.com",  
          subject: "HVAC Report Export",
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || "Relay error");
      }

      alert("Report sent successfully!");
    } catch (err) {
      console.error("Send report failed
