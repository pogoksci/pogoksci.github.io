// js/ui/navbar.js
(function () {
  function setupNavbar() {
    const menuBtn = document.getElementById("menu-toggle-btn");
    const startMenu = document.getElementById("start-menu");
    if (menuBtn && startMenu) {
      menuBtn.addEventListener("click", () => {
        startMenu.classList.toggle("visible");
      });
    }

    const navInventory = document.getElementById("nav-inventory");
    if (navInventory) {
      navInventory.addEventListener("click", () => {
        includeHTML("pages/inventory-list.html");
      });
    }

    const navHome = document.getElementById("menu-home");
    if (navHome) {
      navHome.addEventListener("click", () => {
        includeHTML("pages/main.html");
      });
    }

    const navCabinet = document.getElementById("menu-location");
    if (navCabinet) {
      navCabinet.addEventListener("click", () => {
        includeHTML("pages/location-list.html");
      });
    }
  }

  window.setupNavbar = setupNavbar;
})();
