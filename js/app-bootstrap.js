// /js/app-bootstrap.js

(function () {
    // -----------------------------------------------------
    // 1. 페이지 로더 함수 정의
    // -----------------------------------------------------
    async function includeHTML(file, targetId = "form-container") {
        const container = document.getElementById(targetId);
        if (!container) return;

        try {
            const res = await fetch(file);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            container.innerHTML = await res.text();

            // 페이지 로드 후, 해당 페이지에 맞는 초기화 함수를 호출
            if (file.includes("inventory-list.html")) App.Inventory.load?.();
            if (file.includes("inventory-detail.html")) App.Inventory.loadDetail?.();
            if (file.includes("location-list.html")) App.Cabinet.load?.();
            if (file.includes("inventory-form.html")) App.Forms.initInventoryForm?.();
            if (file.includes("cabinet-form.html")) App.Forms.initCabinetForm?.();

        } catch (err) {
            console.error(`❌ ${file} 로드 실패:`, err);
            container.innerHTML = `<p style="color:red; text-align:center;">페이지를 불러오는 데 실패했습니다.</p>`;
        }
    }

    // -----------------------------------------------------
    // 2. 앱 시작점
    // -----------------------------------------------------
    function bootstrap() {
        console.log("🚀 App bootstrap 시작");

        // 초기 화면 로드
        includeHTML("pages/main.html", "form-container");
        
        // 네비게이션 바 로드 및 기능 연결
        includeHTML("pages/navbar.html", "navbar-container")
            .then(() => {
                if (typeof App.Navbar.setup === "function") {
                    App.Navbar.setup();
                    console.log("✅ Navbar setup complete");
                }
            });
        
        // FAB 버튼 초기화 (기본 숨김)
        App.Fab.setVisibility(false);
    }

    // -----------------------------------------------------
    // 3. 전역 등록 및 실행
    // -----------------------------------------------------
    globalThis.App = globalThis.App || {};
    globalThis.App.includeHTML = includeHTML;

    // ✅ 모든 스크립트가 로드된 후 bootstrap 함수를 실행합니다.
    globalThis.addEventListener("DOMContentLoaded", bootstrap);

})();