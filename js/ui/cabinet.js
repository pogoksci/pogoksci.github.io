// js/ui/cabinet.js
(function () {
  const { supabase } = window.App;

  // 시약장 목록 로드
  async function loadCabinetList() {
    const container = document.getElementById("cabinet-list-container");
    const status = document.getElementById("status-message-list");

    try {
      status.textContent = "시약장 목록 불러오는 중...";

      const { data, error } = await supabase
        .from("Cabinet")
        .select(`id, name, area_id ( id, name ), photo_url_160, photo_url_320, door_vertical_count, door_horizontal_count, shelf_height, storage_columns`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        status.textContent = "등록된 시약장이 없습니다.";
        return;
      }

      container.innerHTML = "";
      data.forEach((cab) => {
        const photo = cab.photo_url_320 || cab.photo_url_160 || null;
        const areaName = cab.area_id?.name || "-";

        const card = document.createElement("div");
        card.className = "cabinet-card";
        card.innerHTML = `
          <div class="card-image-placeholder">
            ${photo ? `<img src="${photo}" alt="${cab.name}" />` : "사진 없음"}
          </div>
          <div class="card-info">
            <h3 style="display:flex; align-items:center; gap:4px;">
              <span style="font-weight:600;">${cab.name}</span>
              <span style="color:#777; font-size:0.9em;">· ${areaName}</span>
            </h3>
          </div>
          <div class="card-actions">
            <button class="edit-btn" data-id="${cab.id}">수정</button>
            <button class="delete-btn" data-id="${cab.id}">삭제</button>
          </div>
        `;

        // 수정 버튼
        card.querySelector(".edit-btn").addEventListener("click", async () => {
          await handleEditCabinet(cab.id);
        });

        // 삭제 버튼
        card.querySelector(".delete-btn").addEventListener("click", async () => {
          if (!confirm(`"${cab.name}"을(를) 삭제하시겠습니까?`)) return;
          await supabase.from("Cabinet").delete().eq("id", cab.id);
          loadCabinetList();
        });

        container.appendChild(card);
      });

      status.textContent = "";
    } catch (err) {
      console.error("시약장 불러오기 오류:", err);
      status.textContent = "오류가 발생했습니다.";
    }
  }

  // ✅ 수정 모드: 폼 로드 및 기존 데이터 채우기
  async function handleEditCabinet(cabinetId) {
    try {
      const { data, error } = await supabase
        .from("Cabinet")
        .select(`id, name, area_id ( id, name ), photo_url_160, photo_url_320, door_vertical_count, door_horizontal_count, shelf_height, storage_columns`)
        .eq("id", cabinetId)
        .maybeSingle();

      if (error || !data) throw error || new Error("시약장 정보를 불러오지 못했습니다.");

      console.log("✅ 시약장 수정 데이터:", data);

      // 📄 수정 폼 HTML 로드
      await includeHTML("pages/cabinet-form.html", "form-container");

      // 제목 변경
      document.querySelector("h2").textContent = "시약장 정보 수정";
      document.getElementById("cabinet-submit-button").textContent = "수정 내용 저장";

      // 입력 필드 채우기 (id들은 실제 폼의 input id에 맞게 수정)
      document.getElementById("cabinet_name").value = data.name || "";
      document.getElementById("door_vertical_count").value = data.door_vertical_count || 1;
      document.getElementById("door_horizontal_count").value = data.door_horizontal_count || 1;
      document.getElementById("shelf_height").value = data.shelf_height || 3;
      document.getElementById("storage_columns").value = data.storage_columns || 1;

      // 사진 표시
      const preview = document.getElementById("cabinet-photo-preview");
      if (preview) {
        if (data.photo_url_320)
          preview.innerHTML = `<img src="${data.photo_url_320}" alt="${data.name}" style="max-width:100%;">`;
        else
          preview.innerHTML = `<span>사진 없음</span>`;
      }

      // 수정 이벤트 연결
      const form = document.getElementById("cabinet-creation-form");
      form.onsubmit = (e) => updateCabinet(e, cabinetId);

      alert(`✅ 시약장 "${data.name}" 정보를 불러왔습니다.`);
    } catch (err) {
      console.error("시약장 수정 오류:", err);
      alert("시약장 정보를 불러오지 못했습니다.");
    }
  }

  // ✅ 수정 저장 함수
  async function updateCabinet(event, cabinetId) {
    event.preventDefault();

    const name = document.getElementById("cabinet_name").value.trim();
    const door_vertical_count = parseInt(document.getElementById("door_vertical_count").value) || 1;
    const door_horizontal_count = parseInt(document.getElementById("door_horizontal_count").value) || 1;
    const shelf_height = parseInt(document.getElementById("shelf_height").value) || 3;
    const storage_columns = parseInt(document.getElementById("storage_columns").value) || 1;

    try {
      const { error } = await supabase
        .from("Cabinet")
        .update({
          name,
          door_vertical_count,
          door_horizontal_count,
          shelf_height,
          storage_columns,
        })
        .eq("id", cabinetId);

      if (error) throw error;

      alert("✅ 수정이 완료되었습니다!");
      loadCabinetList();
    } catch (err) {
      console.error("수정 오류:", err);
      alert("수정에 실패했습니다.");
    }
  }

  window.loadCabinetList = loadCabinetList;
})();
