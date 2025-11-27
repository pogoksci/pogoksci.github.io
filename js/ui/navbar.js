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

    // 1) Start 메뉴 안의 버튼들
    const menuInventory = document.getElementById("menu-inventory-btn");
    if (menuInventory) {
      menuInventory.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("inventory");
        closeStartMenu();
        setActive("menu-inventory-btn");
      });
    }

    const menuEquipment = document.getElementById("menu-equipment-btn");
    if (menuEquipment) {
      menuEquipment.addEventListener("click", async (e) => {
        e.preventDefault();
        // TODO: 교구/물품 페이지 연결
        alert("교구·물품·설비 페이지는 준비 중입니다.");
        closeStartMenu();
      });
    }

    const menuLablog = document.getElementById("menu-lablog-btn");
    if (menuLablog) {
      menuLablog.addEventListener("click", async (e) => {
        e.preventDefault();
        // TODO: 과학실 기록 페이지 연결
        alert("과학실 사용기록·예약 페이지는 준비 중입니다.");
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
        alert("교구·물품장 설정은 준비 중입니다.");
        closeStartMenu();
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

          console.log("🔥 DB Reset Started...");

          // 1. Delete Storage Files (msds-pdf)
          const { data: files, error: listError } = await supabase.storage.from("msds-pdf").list();
          if (listError) throw listError;

          if (files && files.length > 0) {
            const filesToRemove = files.map((f) => f.name);
            const { error: removeError } = await supabase.storage.from("msds-pdf").remove(filesToRemove);
            if (removeError) throw removeError;
            console.log(`🗑️ Deleted ${files.length} files from msds-pdf`);
          }

          // 2. Delete Table Data (Order matters for FK constraints)
          // Inventory -> Cabinet -> Area
          const { error: invError } = await supabase.from("Inventory").delete().neq("id", 0); // Delete all
          if (invError) throw invError;
          console.log("🗑️ Deleted all Inventory data");

          const { error: cabError } = await supabase.from("Cabinet").delete().neq("id", 0);
          if (cabError) throw cabError;
          console.log("🗑️ Deleted all Cabinet data");

          const { error: areaError } = await supabase.from("Area").delete().neq("id", 0);
          if (areaError) throw areaError;
          console.log("🗑️ Deleted all Area data");

          // 3. Delete Substance Data (Master Data)
          // Children first: Properties, MSDS, HazardClassifications
          const { error: propError } = await supabase.from("Properties").delete().neq("id", 0);
          if (propError) throw propError;
          console.log("🗑️ Deleted all Properties data");

          const { error: msdsError } = await supabase.from("MSDS").delete().neq("id", 0);
          if (msdsError) throw msdsError;
          console.log("🗑️ Deleted all MSDS data");

          const { error: hazardError } = await supabase.from("HazardClassifications").delete().neq("id", 0);
          if (hazardError) throw hazardError;
          console.log("🗑️ Deleted all HazardClassifications data");

          // New tables to delete before Substance
          const { error: synError } = await supabase.from("Synonyms").delete().neq("id", 0);
          if (synError) throw synError;
          console.log("🗑️ Deleted all Synonyms data");

          const { error: repError } = await supabase.from("ReplacedRns").delete().neq("id", 0);
          if (repError) throw repError;
          console.log("🗑️ Deleted all ReplacedRns data");

          const { error: citError } = await supabase.from("Citations").delete().neq("id", 0);
          if (citError) throw citError;
          console.log("🗑️ Deleted all Citations data");

          const { error: subError } = await supabase.from("Substance").delete().neq("id", 0);
          if (subError) throw subError;
          console.log("🗑️ Deleted all Substance data");

          // 4. Delete Sync/Reference Data
          const { error: hazardListError } = await supabase.from("HazardList").delete().neq("id", 0);
          if (hazardListError) throw hazardListError;
          console.log("🗑️ Deleted all HazardList data");

          const { error: subRefError } = await supabase.from("SubstanceRef").delete().neq("id", 0);
          if (subRefError) throw subRefError;
          console.log("🗑️ Deleted all SubstanceRef data");

          alert("✅ DB 초기화가 완료되었습니다.");
          location.reload(); // Refresh to clear UI

        } catch (err) {
          console.error("❌ DB Reset Failed:", err);
          alert(`초기화 중 오류가 발생했습니다:\n${err.message}`);
        }

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
        await App.Router.go("inventory"); // 임시 동일 페이지
        closeStartMenu();
        setActive("nav-usage");
      });
    }

    const navWaste = document.getElementById("nav-waste");
    if (navWaste) {
      navWaste.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("inventory"); // 임시 동일 페이지
        closeStartMenu();
        setActive("nav-waste");
      });
    }

    const navKit = document.getElementById("nav-kit");
    if (navKit) {
      navKit.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await App.Router.go("inventory"); // 임시 동일 페이지
        closeStartMenu();
        setActive("nav-kit");
      });
    }
  }

  // ---- 초기화 ----
  function setup() {
    setupStartMenuToggle();
    setupExactIdLinks(); // ✅ 단일 바인딩 (정확 ID)
    console.log("✅ Navbar.setup() 완료 — 정확 ID 바인딩/Start 메뉴 토글");
  }

  // ---- 전역 등록 ----
  globalThis.App = globalThis.App || {};
  globalThis.App.Navbar = { setup, setActive, closeStartMenu };

  document.addEventListener("DOMContentLoaded", setup);
})();
