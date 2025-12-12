// /js/core/fab.js
(function () {
    let menuContainer = null;

    function createMenuContainer() {
        if (menuContainer) return;
        menuContainer = document.createElement("div");
        menuContainer.id = "fab-menu-container";
        Object.assign(menuContainer.style, {
            position: "fixed",
            bottom: "80px", // Align above standard FAB position
            right: "20px",  // Align with FAB
            display: "none",
            flexDirection: "column",
            alignItems: "flex-end", // Align items to right
            gap: "10px",
            zIndex: "1100" // Higher than typical overlays
        });
        document.body.appendChild(menuContainer);

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (menuContainer && menuContainer.style.display === 'flex') {
                if (!e.target.closest('#fab-button') && !e.target.closest('#fab-menu-container')) {
                    toggleMenu(false);
                }
            }
        });
    }

    function toggleMenu(force) {
        if (!menuContainer) createMenuContainer();
        const current = menuContainer.style.display === "flex";
        const next = force !== undefined ? force : !current;
        menuContainer.style.display = next ? "flex" : "none";

        // Sync FAB Icon
        const fab = document.getElementById("fab-button");
        if (fab) {
            const icon = fab.querySelector('.material-symbols-outlined');
            if (icon && fab.dataset.mode === 'menu') {
                icon.textContent = next ? "close" : "menu";
            }
        }
    }

    /**
     * FAB 버튼 표시/숨김을 제어하는 함수
     * @param {boolean} visible - true이면 표시, false이면 숨김
     */
    function setVisibility(visible, text = null, onClickAction = null) {
        const fab = document.getElementById("fab-button");
        if (!fab) return;

        fab.style.display = visible ? "flex" : "none"; // Using flex for centering
        // Ensure flex layout defaults if not in css
        fab.style.alignItems = "center";
        fab.style.justifyContent = "center";
        fab.style.gap = "8px";

        if (visible) {
            // mode reset
            fab.dataset.mode = 'action';

            if (text) {
                fab.innerHTML = text;
            }
            if (onClickAction) {
                fab.onclick = onClickAction;
            }

            // If menu was open, close it
            toggleMenu(false);
        } else {
            fab.onclick = null;
            toggleMenu(false);
        }
    }

    function setMenu(items) {
        const fab = document.getElementById("fab-button");
        if (!fab) return;

        createMenuContainer();
        menuContainer.innerHTML = ""; // Clear existing

        items.forEach(item => {
            const btn = document.createElement("button");
            // Basic Styling
            Object.assign(btn.style, {
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                backgroundColor: "white",
                color: "#333",
                border: "1px solid #ddd",
                borderRadius: "20px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontSize: "14px",
                fontWeight: "500"
            });

            btn.innerHTML = `<span class="material-symbols-outlined" style="color:#555;">${item.icon}</span> <span>${item.label}</span>`;
            btn.onclick = (e) => {
                e.stopPropagation();
                toggleMenu(false);
                if (item.onClick) item.onClick();
            };
            menuContainer.appendChild(btn);
        });

        // Configure FAB as Menu Trigger
        fab.dataset.mode = 'menu';
        fab.style.display = 'flex';
        fab.innerHTML = '<span class="material-symbols-outlined">menu</span> <span style="font-weight:bold;">메뉴</span>';
        fab.onclick = (e) => {
            e.stopPropagation();
            toggleMenu();
        };
    }

    function hide() {
        const fab = document.getElementById("fab-button");
        if (fab) fab.style.display = "none";
        toggleMenu(false); // Ensure menu is closed when hiding FAB
    }

    function show() {
        const fab = document.getElementById("fab-button");
        if (fab) fab.style.display = "flex";
    }

    // App 전역 객체가 없으면 생성
    globalThis.App = globalThis.App || {};

    // App.Fab 객체를 생성하고 등록
    globalThis.App.Fab = {
        setVisibility: setVisibility,
        setMenu: setMenu,
        hide: hide,
        show: show
    };
})();