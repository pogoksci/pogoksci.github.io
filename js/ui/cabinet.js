// js/ui/cabinet.js
(function () {
  const { supabase } = window.App;
  let selectedAreaId = null; // 선택된 장소 ID 저장용 전역 변수

  // -------------------------------------------------------------------
  // ✅ 시약장 목록 불러오기
  // -------------------------------------------------------------------
  async function loadCabinetList() {
    const container = document.getElementById("cabinet-list-container");
    const status = document.getElementById("status-message-list");

    try {
      status.textContent = "시약장 목록 불러오는 중...";

      const { data, error } = await supabase
        .from("Cabinet")
        .select(`
          id,
          name,
          area_id ( id, name ),
          photo_url_160,
          photo_url_320,
          door_vertical_count,
          door_horizontal_count,
          shelf_height,
          storage_columns
        `)
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
            <h3 style="display:inline-block; margin-right:6px;">${cab.name}</h3>
            <span style="color:#666; font-size:14px; vertical-align:middle;">· ${areaName}</span>
          </div>
          <div class="card-actions">
            <button class="edit-btn" data-id="${cab.id}">수정</button>
            <button class="delete-btn" data-id="${cab.id}">삭제</button>
          </div>
        `;

        // ------------------------------
        // ✏️ 수정 버튼
        // ------------------------------
        card.querySelector(".edit-btn").addEventListener("click", async () => {
          try {
            const { data: detail, error } = await supabase
              .from("Cabinet")
              .select(`id, name, area_id ( id, name ), door_vertical_count, door_horizontal_count, shelf_height, storage_columns`)
              .eq("id", cab.id)
              .maybeSingle();

            if (error || !detail) throw error || new Error("데이터 없음");

            await includeHTML("pages/cabinet-form.html", "form-container");
            await sleep(80);
            initializeCabinetForm(detail); // ✅ 수정모드로 자동전환
          } catch (err) {
            console.error("❌ 시약장 수정 오류:", err);
            alert("시약장 정보를 불러오지 못했습니다.");
          }
        });

        // ------------------------------
        // 🗑️ 삭제 버튼
        // ------------------------------
        card.querySelector(".delete-btn").addEventListener("click", async () => {
          if (!confirm(`"${cab.name}"을(를) 삭제하시겠습니까?`)) return;
          const { error: delErr } = await supabase
            .from("Cabinet")
            .delete()
            .eq("id", cab.id);
          if (delErr) {
            alert("❌ 삭제 중 오류 발생");
            return;
          }
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

  // -------------------------------------------------------------------
  // ✅ 시약장 수정 폼 초기화
  // -------------------------------------------------------------------
  async function initializeCabinetForm(detail) {
    console.log("🧭 시약장 수정 초기화", detail);

    // 1️⃣ 기본 폼 데이터 채우기
    fillFormFromData(detail, "cabinet-creation-form");

    // 2️⃣ 버튼 그룹 이벤트 리스너 초기화
    setupButtonGroup("area-button-group");

    // 3️⃣ 기존 area_id 반영 (id 기반으로 자동 선택)
    if (detail.area_id?.id) {
      selectedAreaId = detail.area_id.id; // 전역 상태 반영

      const buttons = document.querySelectorAll("#area-button-group button");
      buttons.forEach((btn) => {
        if (parseInt(btn.dataset.id) === selectedAreaId) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });

      console.log(`✅ 기존 선택된 위치: id=${selectedAreaId}, name=${detail.area_id.name}`);
    }

    // 4️⃣ 저장 버튼 설정
    const saveBtn = document.getElementById("cabinet-save-btn");
    if (saveBtn) {
      saveBtn.textContent = "시약장 정보 수정";
      saveBtn.addEventListener("click", async () => {
        await updateCabinetInfo(detail.id);
      });
    }
  }

  // -------------------------------------------------------------------
  // ✅ 시약장 수정 저장
  // -------------------------------------------------------------------
  async function updateCabinetInfo(cabinetId) {
    try {
      const formData = collectFormData("cabinet-creation-form");

      if (!cabinetId) {
        alert("❌ 시약장 ID가 없습니다.");
        return;
      }

      // ✅ area_id가 선택되지 않은 경우 처리
      if (!selectedAreaId) {
        alert("❗ 시약장이 위치한 장소를 선택해 주세요.");
        return;
      }

      const { error } = await supabase
        .from("Cabinet")
        .update({
          name: formData.name,
          door_vertical_count: formData.door_vertical_count,
          door_horizontal_count: formData.door_horizontal_count,
          shelf_height: formData.shelf_height,
          storage_columns: formData.storage_columns,
          area_id: selectedAreaId, // ✅ 새 위치 반영
        })
        .eq("id", cabinetId);

      if (error) throw error;

      alert("✅ 시약장 정보가 성공적으로 수정되었습니다!");
      includeHTML("pages/location-list.html");
    } catch (err) {
      console.error("시약장 수정 오류:", err);
      alert("❌ 시약장 정보 수정 중 오류가 발생했습니다.");
    }
  }

  // -------------------------------------------------------------------
  // ✅ 전역 등록
  // -------------------------------------------------------------------
  window.loadCabinetList = loadCabinetList;
  window.initializeCabinetForm = initializeCabinetForm;
  window.updateCabinetInfo = updateCabinetInfo;
})();
