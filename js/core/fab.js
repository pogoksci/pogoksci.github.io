// js/core/fab.js
(function () {
  function setFabVisibility(visible, text = null, onClick = null) {
    const fab = document.getElementById("fab-button");
    if (!fab) return;
    fab.style.display = visible ? "block" : "none";
    if (text) fab.textContent = text;
    if (onClick) fab.onclick = onClick;
  }

  function initFab() {
    const fab = document.getElementById("fab-button");
    if (fab) fab.style.display = "none";
  }

  globalThis.App = globalThis.App || {};
  App.FAB = { setFabVisibility, initFab };
  globalThis.setFabVisibility = setFabVisibility; // 기존 호환성 유지
})();
