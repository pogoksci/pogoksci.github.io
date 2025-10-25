// /js/ui/navbar.js
(function () {
    function setup() {
        const menuBtn = document.getElementById("menu-toggle-btn");
        const startMenu = document.getElementById("start-menu");
        const inventoryNav = document.getElementById("nav-inventory");

        if (!menuBtn || !startMenu || !inventoryNav) {
            console.warn("⚠️ Navbar elements not found, retrying...");
            setTimeout(setup, 200); // 0.2초 후 재시도
            return;
        }

        // '약품 관리' 탭 이벤트
        inventoryNav.addEventListener("click", (e) => {
            e.preventDefault();
            if (typeof App.Inventory.load === "function") {
                App.Inventory.load();
            }
        });

        // 메뉴(☰) 버튼 이벤트
        menuBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            startMenu.classList.toggle("visible");
        });

        // 팝업 메뉴 아이템 이벤트
        startMenu.querySelectorAll(".menu-item").forEach((item) => {
            item.addEventListener("click", (e) => {
                e.preventDefault();
                startMenu.classList.remove("visible");

                const id = item.id;
                // App.includeHTML을 사용하여 페이지 로드
                if (id === "menu-home") App.includeHTML("pages/main.html");
                if (id === "menu-location") App.includeHTML("pages/location-list.html");
                if (id === "menu-inventory") App.Inventory.load?.();
                if (id === "menu-equipment") alert("교구/물품 설정 준비 중입니다.");
                if (id === "menu-lablog") alert("과학실 기록/예약 기능 준비 중입니다.");
            });
        });
        
        // 팝업 외부 클릭 시 닫기
        document.addEventListener('click', (event) => {
            if (startMenu.classList.contains('visible') && !startMenu.contains(event.target) && !menuBtn.contains(event.target)) {
                startMenu.classList.remove('visible');
            }
        });

        console.log("✅ Navbar setup complete");
    }

    // ⬇️ [수정됨] App 전역 객체에 함수 등록
    globalThis.App = globalThis.App || {};
    globalThis.App.Navbar = {
        setup,
    };
})();