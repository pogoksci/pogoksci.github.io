// ================================================================
// /js/ui/navbar.js — 네비게이션 & Start 메뉴 제어 (ID 정확 매칭, 단일 바인딩)
// ================================================================
(function () {
  console.log("🧭 App.Navbar 모듈 로드됨");

  // ---- 공통: 페이지 로드 헬퍼 ----
  async function loadPage(htmlPath, after) {
    if (typeof includeHTML === "function") {
      await includeHTML(htmlPath, "form-container");
    } else if (typeof App?.includeHTML === "function") {
      await App.includeHTML(htmlPath, "form-container");
    } else {
      console.warn("⚠️ includeHTML 함수가 없습니다.");
    }
    if (typeof after === "function") after();
  }

  // ---- Start 메뉴 열기/닫기 ----
  function setupStartMenuToggle() {
    const toggleBtn = document.getElementById("menu-toggle-btn");
    const startMenu = document.getElementById("start-menu");
    if (!toggleBtn || !startMenu) {
      console.warn("⚠️ Navbar: 메뉴 토글 요소를 찾을 수 없습니다.");
      return;
    }
    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      startMenu.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
      if (!startMenu.contains(e.target) && !toggleBtn.contains(e.target)) {
        startMenu.classList.remove("open");
      }
    });
  }

  function closeStartMenu() {
    const startMenu = document.getElementById("start-menu");
    if (startMenu) startMenu.classList.remove("open");
  }

  function setActive(id) {
    document.querySelectorAll(".nav-item, .menu-item").forEach((el) => {
      el.classList.toggle("active", el.id === id);
    });
  }

  // ---- 단일 바인딩: 정확한 ID들만 연결 ----
  function setupExactIdLinks() {
    // 0) 설정 토글 (Settings Toggle)
    const settingsToggle = document.getElementById("menu-settings-toggle");
    const submenuSettings = document.getElementById("submenu-settings");
    if (settingsToggle && submenuSettings) {
      settingsToggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation(); // 메뉴 닫힘 방지
        const isHidden = submenuSettings.style.display === "none";
        submenuSettings.style.display = isHidden ? "block" : "none";
        settingsToggle.classList.toggle("expanded", isHidden);
      });
    }

    // 1-1) Navbar 모드 전환 (Merged Mode)
    function switchMode(mode) {
      // Toggle Navbar Items
      const managementItems = document.querySelectorAll('.mode-management');

      if (mode === 'MANAGEMENT') {
        managementItems.forEach(el => el.style.display = 'flex');
      } else {
        // If other modes existed, we would toggle them here.
        // For now, if not management, maybe hide?
        // But currently we only have this main mode active when clicking the menu.
        managementItems.forEach(el => el.style.display = 'none');
      }
    }

    // 1) Start 메뉴 안의 버튼들
    const menuManagement = document.getElementById("menu-management-btn");
    if (menuManagement) {
      menuManagement.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        switchMode('MANAGEMENT'); // Switch Navbar
        await App.Router.go("inventory"); // Default to inventory
        closeStartMenu();
        setActive("nav-inventory");
      });
    }

    const menuLablog = document.getElementById("menu-lablog-btn");
    if (menuLablog) {
      menuLablog.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("labUsageLog");
        closeStartMenu();
      });
    }

    // New Lab Settings Menu
    const menuLabSettings = document.getElementById("menu-lab-settings");
    if (menuLabSettings) {
      menuLabSettings.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("labSettings");
        closeStartMenu();
      });
    }

    const menuLabTimetable = document.getElementById("menu-lab-timetable");
    if (menuLabTimetable) {
      menuLabTimetable.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("labTimetable");
        closeStartMenu();
      });
    }

    // --- 설정 서브메뉴 항목들 ---
    const menuLocation = document.getElementById("menu-location");
    if (menuLocation) {
      menuLocation.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("cabinets");
        closeStartMenu();
        setActive("menu-location");
      });
    }

    const menuEquipCabinet = document.getElementById("menu-equipment-cabinet");
    if (menuEquipCabinet) {
      menuEquipCabinet.addEventListener("click", async (e) => {
        e.preventDefault();
        // ✅ 교구·물품장 설정 페이지 연결 (Router 사용)
        document.body.classList.remove("home-active");

        await App.Router.go("equipmentCabinets");

        closeStartMenu();
        setActive("menu-equipment-cabinet");
      });
    }

    const menuDataSync = document.getElementById("menu-datasync");
    if (menuDataSync) {
      menuDataSync.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("dataSync");
        closeStartMenu();
        setActive("menu-datasync");
      });
    }

    const menuDbReset = document.getElementById("menu-dbreset");
    if (menuDbReset) {
      menuDbReset.addEventListener("click", async (e) => {
        e.preventDefault();

        // 🚨 3-Step Confirmation
        if (!confirm("⚠️ 경고 (1/3)\n\n정말로 모든 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;
        if (!confirm("⚠️ 경고 (2/3)\n\n확실합니까?\n모든 재고, MSDS 파일, 설정된 시약장 정보가 영구적으로 삭제됩니다.")) return;
        if (!confirm("⚠️ 마지막 경고 (3/3)\n\n정말로 초기화하시겠습니까?\n삭제 후에는 절대 복구할 수 없습니다.\n\n진행하려면 [확인]을 누르세요.")) return;

        // 🗑️ Execute Reset
        try {
          const supabase = globalThis.App?.supabase;
          if (!supabase) throw new Error("Supabase client not found");

          console.log("🔥 DB Reset Started (Server-side)...");

          // 🔥 RPC 호출 (관리자 권한 함수 실행)
          const { error } = await supabase.rpc('reset_all_data');

          if (error) throw error;

          console.log(`🗑️ Reset Complete.`);
          alert("✅ DB 초기화가 완료되었습니다.");
          location.reload();

        } catch (err) {
          console.error("❌ DB Reset Failed:", err);
          alert(`초기화 중 오류가 발생했습니다:\n${err.message}`);
        }

      });
    }

    const menuExport = document.getElementById("menu-export");
    if (menuExport) {
      menuExport.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("export");
        closeStartMenu();
      });
    }

    const menuLablogViewer = document.getElementById("menu-lablog-viewer-btn");
    if (menuLablogViewer) {
      menuLablogViewer.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("labUsageView");
        closeStartMenu();
      });
    }

    const menuHome = document.getElementById("menu-home");
    if (menuHome) {
      menuHome.addEventListener("click", (e) => {
        e.preventDefault();
        // 홈으로 갈 때도 history push
        App.Router.go("main");

        document.body.classList.add("home-active"); // 로고 화면
        document.body.classList.remove("loaded");

        // 2️⃣ form-container 비우기
        const container = document.getElementById("form-container");
        if (container) container.innerHTML = "";

        App.Fab?.setVisibility(false);
        closeStartMenu();
        setActive("menu-home");

        // 🔥 school-name, app-title, version 갱신
        const { APPNAME, VERSION, SCHOOL } = globalThis.APP_CONFIG || {};
        const titleEl = document.getElementById("app-title");
        const verEl = document.getElementById("app-version");
        const schoolEl = document.getElementById("school-name");

        if (titleEl) titleEl.textContent = APPNAME;
        if (verEl) verEl.textContent = VERSION;
        if (schoolEl) schoolEl.textContent = SCHOOL;
      });
    }

    // 2) 상단 Navbar 영역(정확 ID) - 기존 유지
    const navInventory = document.getElementById("nav-inventory");
    if (navInventory) {
      navInventory.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("inventory");
        closeStartMenu();
        setActive("nav-inventory");
      });
    }

    const navUsage = document.getElementById("nav-usage");
    if (navUsage) {
      navUsage.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("usageRegister"); // ✅ 사용량 등록 페이지 연결
        closeStartMenu();
        setActive("nav-usage");
      });
    }

    const navWaste = document.getElementById("nav-waste");
    if (navWaste) {
      navWaste.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("wasteList");
        closeStartMenu();
        setActive("nav-waste");
      });
    }

    const navKit = document.getElementById("nav-kit");
    if (navKit) {
      navKit.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("kits"); // ✅ 키트 페이지 연결
        closeStartMenu();
        setActive("nav-kit");
      });
    }

    const navTeachingTools = document.getElementById("nav-teaching-tools");
    if (navTeachingTools) {
      navTeachingTools.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("teachingTools");
        closeStartMenu();
        setActive("nav-teaching-tools");
      });
    }



    const navFacilities = document.getElementById("nav-facilities");
    if (navFacilities) {
      navFacilities.addEventListener("click", (e) => {
        e.preventDefault();
        alert("설비 관리 페이지는 준비 중입니다.");
        setActive("nav-facilities");
      });
    }
  }

  // ---- 인증 상태에 따른 UI 업데이트 ----
  function updateAuthUI(user) {
    const role = user?.role || 'guest';

    // 디버그: 실제 권한 확인
    // alert(`현재 권한: ${role}`); 

    const startMenu = document.getElementById("start-menu");
    if (!startMenu) return;

    // 1. 설정 메뉴 (Settings Toggle): Admin, Teacher만 보임
    const settingsToggle = document.getElementById("menu-settings-toggle");
    const settingsSubmenu = document.getElementById("submenu-settings");

    if (settingsToggle) {
      // Teacher or Admin
      if (['admin', 'teacher'].includes(role)) {
        settingsToggle.style.display = 'flex'; // block -> flex for alignment
        // 서브메뉴 상태는 유지하거나 닫음 (여기서는 유지, 사용자가 닫아야 함)
      } else {
        settingsToggle.style.display = 'none';
        // 권한 없으면 서브메뉴도 강제로 닫기
        if (settingsSubmenu) settingsSubmenu.style.display = 'none';
      }
    }

    // 2. DB 초기화 (Reset) & 데이터 동기화 (Data Sync): Admin만 보임
    const dbResetBtn = document.getElementById("menu-dbreset");
    const menuDataSync = document.getElementById("menu-datasync");

    if (dbResetBtn) {
      dbResetBtn.style.display = (role === 'admin') ? 'flex' : 'none'; // flex for correct alignment
    }
    if (menuDataSync) {
      menuDataSync.style.display = (role === 'admin') ? 'flex' : 'none'; // flex for correct alignment
    }

    // 3. 기록 및 예약 (Lablog): Admin, Teacher만 보임
    const menuLablog = document.getElementById("menu-lablog-btn");
    if (menuLablog) {
      if (['admin', 'teacher'].includes(role)) {
        menuLablog.style.display = 'flex';
      } else {
        menuLablog.style.display = 'none';
      }
    }

    // 3-1. 기록 조회 (Lablog Viewer): 모두에게 보임
    const menuLablogViewer = document.getElementById("menu-lablog-viewer-btn");
    if (menuLablogViewer) {
      menuLablogViewer.style.display = 'flex';
    }

    // 4. 유저 ID 및 Auth Footer 표시 업데이트
    // 기존 버튼 방식 제거하고 Footer 영역 자체를 활용
    const footer = document.getElementById("menu-footer-container");
    const userIdEl = footer?.querySelector(".user-id");
    const actionIcon = document.getElementById("auth-action-icon");

    // 이전에 생성된 버튼이 있다면 삭제 (구버전 호환)
    const oldBtn = document.getElementById("menu-auth-btn");
    if (oldBtn) oldBtn.remove();

    if (footer && userIdEl && actionIcon) {
      if (user) {
        // 로그인 상태
        const name = user.email ? user.email.split('@')[0] : 'User';
        userIdEl.textContent = name;
        userIdEl.style.fontWeight = 'bold';

        // 아이콘: 로그아웃
        actionIcon.textContent = "logout"; // Material Symbol 'logout'

        // 클릭 동작: 로그아웃 (아이콘 클릭 시에만)
        actionIcon.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation(); // 버블링 방지
          if (confirm(`${name}님, 로그아웃 하시겠습니까?`)) {
            App.Auth.logout();
            closeStartMenu();
          }
        };
        // Footer 전체 클릭 방지
        footer.onclick = null;
        footer.style.cursor = 'default';
      } else {
        // 게스트 상태
        userIdEl.textContent = "Guest";
        userIdEl.style.fontWeight = 'normal';

        // 아이콘: 로그인 (login 아이콘)
        actionIcon.textContent = "login";

        // 클릭 동작: 로그인 페이지 이동 (아이콘 클릭 시에만)
        actionIcon.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();

          // ✅ 현재 페이지 정보 저장 (로그인 후 복귀를 위해)
          const current = App.Router.getCurrentState ? App.Router.getCurrentState() : null;
          if (current && current.pageKey !== 'login') {
            sessionStorage.setItem("login_return_route", JSON.stringify(current));
          }

          // ✅ Splash 화면(Home Active) 해제
          document.body.classList.remove("home-active");

          if (App.Router && App.Router.go) {
            App.Router.go("login");
          } else {
            alert("오류: 페이지 이동 기능(Router)이 로드되지 않았습니다.");
          }
          closeStartMenu();
        };
        // Footer 전체 클릭 방지
        footer.onclick = null;
        footer.style.cursor = 'default';
      }
    }

  }

  // ---- 초기화 ----
  function setup() {
    setupStartMenuToggle();
    setupExactIdLinks(); // ✅ 단일 바인딩 (정확 ID)
    console.log("✅ Navbar.setup() 완료 — 정확 ID 바인딩/Start 메뉴 토글");

    // ✅ Navbar 로드 시점에 UI 초기화 (User가 없으면 Guest 모드로 적용됨)
    // 기존에는 user가 있을 때만 호출해서 Guest일 때 기본 Visible 상태가 유지되는 버그가 있었음.
    if (App.Auth && typeof App.Auth === 'object') {
      updateAuthUI(App.Auth.user);
    } else {
      // Auth 모듈이 아직 로드 안 됐을 수도 있지만, 일단 Guest로 초기화 시도
      updateAuthUI(null);
    }
  }

  // ---- 전역 등록 ----
  globalThis.App = globalThis.App || {};
  globalThis.App.Navbar = { setup, setActive, closeStartMenu, updateAuthUI };

  document.addEventListener("DOMContentLoaded", setup);
})();
