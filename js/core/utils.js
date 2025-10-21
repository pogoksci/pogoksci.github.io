// js/core/utils.js
(function () {
  console.log("✅ utils.js 로드됨");

  /** 간단한 지연 (await delay(500)) */
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  /** 날짜 YYYY-MM-DD 포맷 */
  const formatDate = (date = new Date()) =>
    date.toISOString().split("T")[0];

  /** 간단한 토스트 메시지 */
  function toast(msg, color = "black", duration = 2000) {
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
      position: "fixed",
      bottom: "30px",
      left: "50%",
      transform: "translateX(-50%)",
      background: color,
      color: "white",
      padding: "8px 20px",
      borderRadius: "20px",
      fontSize: "14px",
      zIndex: 9999,
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  globalThis.App = globalThis.App || {};
  App.Utils = { delay, formatDate, toast };
})();
