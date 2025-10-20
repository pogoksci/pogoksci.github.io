// js/app-bootstrap.js
(function () {
  window.addEventListener("DOMContentLoaded", () => {
    includeHTML("pages/main.html");
  });

  async function includeHTML(file) {
    const container = document.getElementById("form-container");
    if (!container) return;
    const response = await fetch(file);
    const html = await response.text();
    container.innerHTML = html;

    if (file.includes("inventory-list")) fetchInventoryAndRender();
    if (file.includes("inventory-detail")) loadInventoryDetail();
    if (file.includes("location-list")) loadCabinetList();

    if (file.includes("inventory-form")) initializeFormListeners();
    if (file.includes("navbar")) setupNavbar();
  }

  window.includeHTML = includeHTML;
})();
