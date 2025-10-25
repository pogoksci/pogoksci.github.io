// ================================================================
// /js/ui/cabinet.js
// 시약장 등록·수정·삭제·목록 (Deno 호환 App.Cabinet 구조)
// ================================================================
(function () {
  const { supabase, includeHTML } = globalThis.App;

  // ---------------------------------------------------------------
  // 1️⃣ 시약장 목록 불러오기
  // ---------------------------------------------------------------
  async function loadList() {
    console.log("📦 App.Cabinet.loadList() 시작");
    const listContainer = document.getElementById("cabinet-list-container");
    const statusMessage = document.getElementById("status-message-list");
    if (!listContainer || !statusMessage) return;

    try {
      const { data, error } = await supabase
        .from("Cabinet")
        .select(`
          id, name,
          area_id(id, name),
          door_vertical_count, door_horizontal_count,
          shelf_height, storage_columns,
          photo_url_320, photo_url_160
        `)
        .order("id", { ascending: true });

      if (error) throw error;
      console.log("✅ 시약장 목록:", data);

      if (!data || data.length === 0) {
        statusMessage.textContent = "등록된 시약장이 없습니다.";
        return;
      }

      statusMessage.style.display = "none";
      renderList(data);
    } catch (err) {
      console.error("❌ 시약장 목록 불러오기 실패:", err);
      statusMessage.textContent = "시약장 목록을 불러오지 못했습니다.";
    }
  }

  // 목록 렌더링
  function renderList(cabinets) {
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
                상하: ${cab.door_vertical_count || "-"},
                좌우: ${cab.door_horizontal_count || "-"},
                층: ${cab.shelf_height || "-"},
                열: ${cab.storage_columns || "-"}
              </p>
            </div>
            <div class="card-actions">
              <button class="edit-btn" onclick="App.Cabinet.edit(${cab.id})">수정</button>
              <button class="delete-btn" onclick="App.Cabinet.delete(${cab.id})">삭제</button>
            </div>
          </div>`;
      })
      .join("");
  }

  // ---------------------------------------------------------------
  // 2️⃣ 시약장 수정 진입
  // ---------------------------------------------------------------
  async function edit(cabinetId) {
    try {
      const { data: detail, error } = await supabase
        .from("Cabinet")
        .select(`
          id, name,
          area_id ( id, name ),
          photo_url_320, photo_url_160,
          door_vertical_count, door_horizontal_count,
          shelf_height, storage_columns
        `)
        .eq("id", cabinetId)
        .maybeSingle();

      if (error || !detail) throw error || new Error("시약장 정보 없음");

      await includeHTML("pages/cabinet-form.html", "form-container");
      await sleep(50);

      // ✅ forms.js의 통합 폼 초기화 사용
      App.Forms.initCabinetForm("edit", detail);
    } catch (err) {
      console.error("❌ 시약장 불러오기 오류:", err);
      alert("시약장 정보를 불러올 수 없습니다.");
    }
  }

  // ---------------------------------------------------------------
  // 3️⃣ 새 시약장 등록
  // ---------------------------------------------------------------
  async function createForm() {
    await includeHTML("pages/cabinet-form.html", "form-container");
    await sleep(50);
    App.Forms.initCabinetForm("create");
  }

  // ---------------------------------------------------------------
  // 4️⃣ DB 직접 조작 함수 (App.Forms에서 호출)
  // ---------------------------------------------------------------
  async function createCabinet(payload) {
    const { error } = await supabase.from("Cabinet").insert([payload]);
    if (error) throw error;
  }

  async function updateCabinet(cabinetId, payload) {
    const { error } = await supabase.from("Cabinet").update(payload).eq("id", cabinetId);
    if (error) throw error;
  }

  // ---------------------------------------------------------------
  // 5️⃣ 시약장 삭제
  // ---------------------------------------------------------------
  async function remove(id) {
    if (!confirm("정말로 삭제하시겠습니까?")) return;
    try {
      const { error } = await supabase.from("Cabinet").delete().eq("id", id);
      if (error) throw error;
      alert("✅ 삭제되었습니다.");
      loadList();
    } catch (err) {
      console.error("❌ 삭제 실패:", err);
      alert("시약장 삭제 중 오류가 발생했습니다.");
    }
  }

  // ---------------------------------------------------------------
  // 6️⃣ 기존 데이터 채우기 (호환용)
  // ---------------------------------------------------------------
  function fillForm(detail) {
    App.Forms?.applyExistingSelection?.(detail);
  }

  // ---------------------------------------------------------------
  // 7️⃣ 전역 바인딩
  // ---------------------------------------------------------------
  globalThis.App = globalThis.App || {};
  globalThis.App.Cabinet = {
    load: loadList,
    edit,
    createForm,
    createCabinet,
    updateCabinet,
    delete: remove,
    fillForm,
  };
})();
