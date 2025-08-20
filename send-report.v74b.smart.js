<!-- send-report.v74b.js -->
<script>
/*! v7.4e safe patch: Send Report integration */
(() => {
  'use strict';

  // 🔧 CONFIG — CHANGE THESE
  const REPORT_EMAIL = "brianphister@gmail.com";   // <-- replace with YOUR email
  const SHARED_SECRET = "Axpquvxp"; // <-- replace with secret you set in relay

  const RELAY_URL = "https://hvac-email-relay.vercel.app/api/sendCsv";

  // Small toast popup instead of alerts
  function showToast(msg, isError=false) {
    const toast = document.createElement("div");
    toast.textContent = msg;
    toast.style.position = "fixed";
    toast.style.bottom = "10px";
    toast.style.right = "10px";
    toast.style.background = isError ? "#b00020" : "#4caf50";
    toast.style.color = "white";
    toast.style.padding = "8px 12px";
    toast.style.borderRadius = "6px";
    toast.style.zIndex = 10000;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // Add button into History box beside Export
  function addSendButton() {
    const historyControls = document.querySelector("#history-controls");
    if (!historyControls) return;

    if (document.querySelector("#send-report-btn")) return; // prevent duplicates

    const btn = document.createElement("button");
    btn.id = "send-report-btn";
    btn.textContent = "Send Report";
    btn.className = "btn btn-secondary";
    btn.style.marginLeft = "6px";

    btn.addEventListener("click", sendReport);
    history
