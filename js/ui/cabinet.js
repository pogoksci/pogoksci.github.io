// /js/ui/cabinet.js
// 시약장 목록 / 수정 / 삭제 (데이터 처리 전담)

(function () {
  const { supabase } = globalThis.App;

  // -------------------------------------------------
  // 목록 화면 진입 시 호출
  // -------------------------------------------------
  async function loadList() {
    console.log("📦 App.Cabinet.loadList() 시작");

    const listContainer = document.getElementById("cabinet-list-container");
    const statusMessage = document.getElementById("status-message-list");
    if (!listContainer || !statusMessage) {
      console.warn("⚠️ loadList: container/status not found");
      return;
    }

    statusMessage.style.display = "block";
    statusMessage.textContent = "시약장 목록을 불러오는 중...";

    try {
      const { data, error } = await supabase
        .from("Cabinet")
        .select(`
          id,
          name,
          area_id (
            id,
            name
          ),
          door_vertical_count,
          door_horizontal_count,
          shelf_height,
          storage_columns,
          photo_url_320,
          photo_url_160
        `)
        .order("id", { ascending: true });

      if (error) throw error;

      console.log("✅ 시약장 목록:", data);

      if (!data || data.length === 0) {
        statusMessage.textContent = "등록된 시약장이 없습니다.";
        return;
      }

      statusMessage.style.display = "none";
      renderCabinetCards(data);
    } catch (err) {
      console.error("❌ 시약장 목록 불러오기 실패:", err);
      statusMessage.textContent = "시약장 목록을 불러오지 못했습니다.";
    }
  }

  // -------------------------------------------------
  // 목록 렌더링
  // -------------------------------------------------
  function renderCabinetCards(cabinets) {
    const container = document.getElementById("cabinet-list-container");
    if (!container) return;

    container.innerHTML = cabinets
      .map((cab) => {
        const photo = cab.photo_url_320 || cab.photo_url_160 || null;
        const areaName = cab.area_id?.name || "위치 없음";

        return `
        <div class="cabinet-card">
          <div class="card-image-placeholder">
            ${
              photo
                ? `<img src="${photo}" alt="${cab.name}" style="width:100%;height:100%;object-fit:cover;">`
                : "사진 없음"
            }
          </div>

          <div class="card-info">
            <h3>${cab.name}</h3>
            <span class="area-name">${areaName}</span>
            <p class="cabinet-specs">
              상하: ${cab.door_vertical_count ?? "-"},
              좌우: ${cab.door_horizontal_count ?? "-"},
              층: ${cab.shelf_height ?? "-"},
              열: ${cab.storage_columns ?? "-"}
            </p>
          </div>

          <div class="card-actions">
            <button class="edit-btn" data-id="${cab.id}">수정</button>
            <button class="delete-btn" data-id="${cab.id}">삭제</button>
          </div>
        </div>`;
      })
      .join("");

    // 버튼 클릭 이벤트 바인딩 (동적 HTML이라 다시 연결 필요)
    container
      .querySelectorAll(".edit-btn")
      .forEach((btn) =>
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          editCabinet(id);
        })
      );

    container
      .querySelectorAll(".delete-btn")
      .forEach((btn) =>
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          deleteCabinet(id);
        })
      );
  }

  // -------------------------------------------------
  // 수정 버튼 클릭 → 해당 시약장 로드 후 폼 화면으로 이동
  // -------------------------------------------------
  async function editCabinet(cabinetId) {
    try {
      const { data: detail, error } = await supabase
        .from("Cabinet")
        .select(`
          id,
          name,
          area_id (
            id,
            name
          ),
          photo_url_320,
          photo_url_160,
          door_vertical_count,
          door_horizontal_count,
          shelf_height,
          storage_columns
        `)
        .eq("id", cabinetId)
        .maybeSingle();

      if (error || !detail) throw error || new Error("시약장 없음");

      // 폼 화면 로드
      const ok = await App.includeHTML("pages/cabinet-form.html", "form-container");
      if (!ok) return;

      // 폼 초기화 호출 (forms.js 담당)
      if (App.Forms && typeof App.Forms.initCabinetForm === "function") {
        App.Forms.initCabinetForm("edit", detail);
      }
    } catch (err) {
      console.error("❌ 시약장 불러오기 오류:", err);
      alert("시약장 정보를 불러올 수 없습니다.");
    }
  }

  // -------------------------------------------------
  // 신규 등록 버튼(FAB 등에서 호출)
  // -------------------------------------------------
  async function showNewCabinetForm() {
    const ok = await App.includeHTML("pages/cabinet-form.html", "form-container");
    if (!ok) return;

    if (App.Forms && typeof App.Forms.initCabinetForm === "function") {
      App.Forms.initCabinetForm("create", null);
    }
  }

  // -------------------------------------------------
  // 실제 DB Insert (등록)
  // -------------------------------------------------
  async function createCabinet(payload) {
    const { error } = await supabase.from("Cabinet").insert([payload]);
    if (error) throw error;
  }

  // -------------------------------------------------
  // 실제 DB Update (수정)
  // -------------------------------------------------
  async function updateCabinet(cabinetId, payload) {
    const { error } = await supabase
      .from("Cabinet")
      .update(payload)
      .eq("id", cabinetId);
    if (error) throw error;
  }

  // -------------------------------------------------
  // 삭제
  // -------------------------------------------------
  async function deleteCabinet(cabinetId) {
    if (!confirm("정말 삭제할까요?")) return;
    const { error } = await supabase
      .from("Cabinet")
      .delete()
      .eq("id", cabinetId);
    if (error) {
      console.error("삭제 실패:", error);
      alert("삭제 중 오류가 발생했습니다.");
      return;
    }
    alert("삭제 완료");
    loadList();
  }

  // -------------------------------------------------
  // 전역 등록
  // -------------------------------------------------
  globalThis.App = globalThis.App || {};
  globalThis.App.Cabinet = {
    loadList,
    showNewCabinetForm,
    editCabinet,
    createCabinet,
    updateCabinet,
    deleteCabinet,
  };
})();
