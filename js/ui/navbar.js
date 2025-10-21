// js/ui/navbar.js
(function () {
  function setupNavbar() {
    const startMenu = document.getElementById("start-menu");
    const menuBtn = document.getElementById("menu-toggle-btn");
    const closeMenu = () => startMenu?.classList.remove("visible");

    if (menuBtn && startMenu) {
      menuBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        startMenu.classList.toggle("visible");
      });
    }

    document.addEventListener("click", (e) => {
      if (!startMenu) return;
      const inside = startMenu.contains(e.target) || (menuBtn && menuBtn.contains(e.target));
      if (!inside) startMenu.classList.remove("visible");
    });

    // ✅ async로 변경
    async function go(file, after) {
      await includeHTML(file, "form-container");
      if (after) await after();
      closeMenu();
    }

    document.getElementById("nav-inventory")?.addEventListener("click", async (e) => {
      e.preventDefault();
      await go("pages/inventory-list.html", globalThis.fetchInventoryAndRender);
    });

    document.getElementById("menu-location")?.addEventListener("click", async (e) => {
      e.preventDefault();
      await go("pages/location-list.html", globalThis.loadCabinetList);
    });

    document.getElementById("menu-home")?.addEventListener("click", async (e) => {
      e.preventDefault();
      await go("pages/main.html");
    });
  }

  globalThis.setupNavbar = setupNavbar;
})();
