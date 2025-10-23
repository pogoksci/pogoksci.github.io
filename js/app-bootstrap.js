// /js/app-bootstrap.js
(async function () {
  window.addEventListener("DOMContentLoaded", async () => {
    console.log("🚀 App bootstrap 시작");

    await includeHTML("pages/main.html", "form-container");
    await includeHTML("pages/navbar.html", "navbar-container");

    console.log("✅ Navbar HTML 로드 완료 — setupNavbar() 실행");
    if (typeof setupNavbar === "function") setupNavbar();

    setFabVisibility(false);
  });

  async function includeHTML(file, targetId = "form-container") {
    const container = document.getElementById(targetId);
    if (!container) return;
    const res = await fetch(file);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    container.innerHTML = await res.text();

    if (file.includes("inventory-list")) fetchInventoryAndRender?.();
    if (file.includes("inventory-detail")) loadInventoryDetail?.();
    if (file.includes("location-list")) loadCabinetList?.();
    if (file.includes("inventory-form")) initializeFormListeners?.();

    return true; // ✅ Promise 기반
  }

  window.includeHTML = includeHTML;
})();