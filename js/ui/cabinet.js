// ================================================================
// /js/ui/cabinet.js — DB CRUD / 목록 관리 (재시도 포함 안정 버전)
// ================================================================
(function () {
  const { supabase, includeHTML } = App;
  const { sleep } = App.Utils;

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
      container.innerHTML = data
        .map(
          (cab) => `
        <div class="cabinet-card">
          <div class="card-image-placeholder">
            ${
              cab.photo_url_320
                ? `<img src="${cab.photo_url_320}" alt="${cab.name}" style="width:100%;height:100%;object-fit:cover;">`
                : "사진 없음"
            }
          </div>
          <div class="card-info">
            <h3>${cab.name}</h3>
            <span>${cab.area_id?.name || "위치 없음"}</span>
            <p>
              상하:${cab.door_vertical_count || "-"},
              좌우:${cab.door_horizontal_count || "-"},
              층:${cab.shelf_height || "-"},
              열:${cab.storage_columns || "-"}
            </p>
          </div>
          <div class="card-actions">
            <button onclick="App.Cabinet.edit(${cab.id})">수정</button>
            <button onclick="App.Cabinet.delete(${cab.id})">삭제</button>
          </div>
        </div>`
        )
        .join("");

      console.log(`✅ 시약장 목록 불러오기 완료 (${data.length}개)`);
    } catch (err) {
      status.textContent = "시약장 목록을 불러올 수 없습니다.";
      console.error("❌ loadList() 오류:", err);
    }
  }

  // ------------------------------------------------------------
  // ✏️ 2️⃣ 시약장 수정
  // ------------------------------------------------------------
  async function edit(id) {
    const { supabase } = globalThis.App;
      try {
        const { data: detail, error } = await supabase
        .from("Cabinet")
        .select(
          "id,name,area_id(id,name),photo_url_320,photo_url_160,door_vertical_count,door_horizontal_count,shelf_height,storage_columns"
        )
        .eq("id", id)
        .maybeSingle();

      if (error || !data) throw error || new Error("시약장 없음");

      // ⬇️ [수정됨] HTML 로드 코드를 제거하고 initCabinetForm만 호출합니다.
      if (App.Forms && typeof App.Forms.initCabinetForm === "function") {
        App.Forms.initCabinetForm("edit", data);
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
    const { error } = await supabase
      .from("Cabinet")
      .update(payload)
      .eq("id", id);
    if (error) throw error;
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
  async function showNewCabinetForm() {
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
    edit,
    createCabinet,
    updateCabinet,
    delete: remove,
    showNewCabinetForm, // ⬅️ '새 시약장 등록' 버튼이 호출할 함수
  };

  console.log("✅ App.Cabinet 모듈 로드 완료");
})();
