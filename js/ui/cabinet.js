// ================================================================
// /js/ui/cabinet.js — DB CRUD / 목록 관리 (재시도 포함 안정 버전)
// ================================================================
(function () {
  // ✅ 전역 App 안전하게 가져오기
  const getApp = () => globalThis.App || window.App || {};

  // ✅ supabase, utils 접근용 헬퍼
  const getSupabase = () => getApp().supabase;
  const getUtils = () => getApp().Utils || {};

  // ------------------------------------------------------------
  // 📦 1️⃣ 시약장 목록 로드 (자동 재시도 포함)
  // ------------------------------------------------------------
  async function loadList(retryCount = 0) {
    const container = document.getElementById("cabinet-list-container");
    const status = document.getElementById("status-message-list");

    if (!container || !status) {
      if (retryCount < 3) {
        console.warn(
          `⚠️ loadList(): DOM 요소를 찾지 못했습니다. ${retryCount + 1}/3 재시도 중...`
        );
        setTimeout(() => loadList(retryCount + 1), 100);
        return;
      }
      console.error("❌ loadList(): DOM 탐색 실패 — 포기");
      return;
    }

    console.log("✅ loadList(): DOM 탐색 성공 — 시약장 목록 불러오기 시작");
    status.textContent = "등록된 시약장을 불러오는 중...";

    try {
      const { data, error } = await supabase
        .from("Cabinet")
        .select(
          "id,name,area_id(id,name),door_vertical_count,door_horizontal_count,shelf_height,storage_columns,photo_url_320,photo_url_160"
        )
        .order("id", { ascending: true });

      if (error) throw error;
      if (!data?.length) {
        status.textContent = "등록된 시약장이 없습니다.";
        return;
      }

      status.style.display = "none";

      renderCabinetCards(data);

    } catch (err) {
      status.textContent = "시약장 목록을 불러올 수 없습니다.";
      console.error("❌ loadList() 오류:", err);
    }
  }

  // ------------------------------------------------------------
  // 🎨 2️⃣ 목록 렌더링
  // ------------------------------------------------------------
  function renderCabinetCards(cabinets) {
      const container = document.getElementById("cabinet-list-container");
      if (!container) return;

      container.innerHTML = cabinets.map((cab) => {
          const photo = cab.photo_url_320 || cab.photo_url_160 || null;
          const areaName = cab.area_id?.name || "위치 없음";
          return `
          <div class="cabinet-card">
            <div class="card-info">
              <h3>${cab.name} <small class="area-name">${areaName}</small></h3>
            </div>
            <div class="card-image-placeholder">
              ${photo ? `<img src="${photo}" alt="${cab.name}" style="width:100%;height:100%;object-fit:cover;">` : "사진 없음"}
            </div>
            <div class="card-actions">
              <button class="edit-btn" data-id="${cab.id}">수정</button>
              <button class="delete-btn" data-id="${cab.id}">삭제</button>
            </div>
          </div>`;
      }).join("");

    container
        .querySelectorAll(".edit-btn")
        .forEach((btn) =>
          btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            editCabinet(id); // editCabinet 함수 호출
          })
      );

    container
        .querySelectorAll(".delete-btn")
        .forEach((btn) =>
          btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            deleteCabinet(id); // deleteCabinet 함수 호출
          })
      );
  }

  // ------------------------------------------------------------
  // ✏️ 2️⃣ 시약장 수정
  // ------------------------------------------------------------
  async function editCabinet(id) {
      try {
        const { data: detail, error } = await supabase
        .from("Cabinet")
        .select(
          "id,name,area_id(id,name),photo_url_320,photo_url_160,door_vertical_count,door_horizontal_count,shelf_height,storage_columns"
        )
        .eq("id", id)
        .maybeSingle();

      if (error || !detail) throw error || new Error("시약장 없음");

      // ⬇️ [수정됨] HTML 로드 코드를 제거하고 initCabinetForm만 호출합니다.
      if (App.Forms && typeof App.Forms.initCabinetForm === "function") {
        App.Forms.initCabinetForm("edit", detail);
      }
    } catch (err) {
      console.error("❌ 시약장 불러오기 오류:", err);
      alert("시약장 정보를 불러올 수 없습니다.");
    }
  }

  // ------------------------------------------------------------
  // ➕ 3️⃣ 시약장 등록 / 수정 / 삭제
  // ------------------------------------------------------------
  async function createCabinet(payload) {
    const { error } = await supabase.from("Cabinet").insert([payload]);
    if (error) throw error;
  }

  async function updateCabinet(id, payload) {
    console.log("🧩 updateCabinet() payload:", payload);

    const clean = { ...payload };
    if (typeof clean.area_id === "string") clean.area_id = null;

    if (!clean.area_id && clean.area_custom_name) {
      const { data: area } = await supabase
        .from("Area")
        .select("id")
        .eq("name", clean.area_custom_name)
        .maybeSingle();

      if (area) {
        clean.area_id = area.id;
      } else {
        const { data: newArea, error: areaErr } = await supabase
          .from("Area")
          .insert({ name: clean.area_custom_name })
          .select()
          .single();
        if (!areaErr && newArea) clean.area_id = newArea.id;
      }
    }

    const { data, error } = await supabase
      .from("Cabinet")
      .update({
        name: clean.name,
        area_id: clean.area_id,
        door_vertical_count: clean.door_vertical_count,
        door_horizontal_count: clean.door_horizontal_count,
        shelf_height: clean.shelf_height,
        storage_columns: clean.storage_columns,
        photo_url_320: clean.photo_url_320,
        photo_url_160: clean.photo_url_160,
      })
      .eq("id", id)
      .select();

    if (error) {
      console.error("❌ updateCabinet 오류:", error);
      alert("수정 중 오류가 발생했습니다.");
      return null;
    }

    console.log("✅ updateCabinet 완료:", data);
    return data;
  }

  async function remove(id) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("Cabinet").delete().eq("id", id);
    if (error) {
      alert("삭제 실패: " + error.message);
    } else {
      alert("삭제되었습니다.");
      loadList(); // 삭제 후 목록 새로고침
    }
  }

  // ------------------------------------------------------------
  // 🆕 5️⃣ 신규 등록 폼 표시 (기존 showNewCabinetForm)
  // ------------------------------------------------------------
  function showNewCabinetForm() {
    // ⬇️ [수정됨] edit 함수와 동일하게 initCabinetForm만 호출합니다.
    if (App.Forms && typeof App.Forms.initCabinetForm === "function") {
     App.Forms.initCabinetForm("create", null);
    }
  }

  // ------------------------------------------------------------
  // 🌍 4️⃣ 전역 등록
  // ------------------------------------------------------------
  globalThis.App = globalThis.App || {};
  globalThis.App.Cabinet = {
    loadList,
    editCabinet,
    createCabinet,
    updateCabinet,
    delete: remove,
    showNewCabinetForm, // ⬅️ '새 시약장 등록' 버튼이 호출할 함수
  };

  console.log("✅ App.Cabinet 모듈 로드 완료");
})();
