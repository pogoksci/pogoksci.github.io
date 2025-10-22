// ================================================================
// js/ui/cabinet.js
// 시약장 등록·수정 겸용 + Deno 호환(globalThis 기반)
// ================================================================

(function () {
  const { supabase } = globalThis.App;

  // ---------------------------------------------------------------
  // 시약장 목록 로드
  // ---------------------------------------------------------------
  async function loadCabinetList() {
    try {
      const { data, error } = await supabase
        .from("Cabinet")
        .select(`
          id, name, photo_url,
          area_id (id, name),
          door_vertical_count, door_horizontal_count,
          shelf_height, storage_columns
        `)
        .order("id", { ascending: true });

      if (error) throw error;
      renderCabinetList(data || []);
    } catch (err) {
      console.error("❌ 시약장 목록 로드 오류:", err);
      alert("시약장 목록을 불러오지 못했습니다.");
    }
  }

  function renderCabinetList(cabinets) {
    const container = document.getElementById("cabinet-list");
    if (!container) return;

    container.innerHTML = cabinets
      .map(
        (cab) => `
      <div class="cabinet-card">
        <div class="card-image-placeholder">
          ${cab.photo_url
            ? `<img src="${cab.photo_url}" alt="${cab.name}" style="width:100%;height:100%;object-fit:cover;">`
            : "사진 없음"}
        </div>
        <div class="card-info">
          <div class="card-info">
            <h3>${cab.name}</h3>
            <span class="area-name">${cab.area_id?.name || "위치 없음"}</span>
          </div>
          <p class="cabinet-specs">
            상하: ${cab.door_vertical_count || "-"}, 좌우: ${
          cab.door_horizontal_count || "-"
        }, 층: ${cab.shelf_height || "-"}, 열: ${cab.storage_columns || "-"}
          </p>
        </div>
        <div class="card-actions">
          <button class="edit-btn" onclick="editCabinet(${cab.id})">수정</button>
          <button class="delete-btn" onclick="deleteCabinet(${cab.id})">삭제</button>
        </div>
      </div>`
      )
      .join("");
  }

  // ---------------------------------------------------------------
  // 수정 버튼 클릭 시
  // ---------------------------------------------------------------
  globalThis.editCabinet = async function (cabinetId) {
    try {
      const { data: detail, error } = await supabase
        .from("Cabinet")
        .select(
          `id, name, area_id (id, name), photo_url,
           door_vertical_count, door_horizontal_count,
           shelf_height, storage_columns`
        )
        .eq("id", cabinetId)
        .maybeSingle();

      if (error || !detail) throw error || new Error("시약장 없음");

      await includeHTML("pages/cabinet-form.html", "form-container");
      await sleep(50); // 렌더 대기
      initializeCabinetForm(detail);
    } catch (err) {
      console.error("시약장 불러오기 오류:", err);
      alert("시약장 정보를 불러올 수 없습니다.");
    }
  };

  // ---------------------------------------------------------------
  // 시약장 등록/수정 폼 초기화
  // ---------------------------------------------------------------
  function initializeCabinetForm(detail = null) {
    console.log("🧩 initializeCabinetForm 실행", detail);

    const form = document.getElementById("cabinet-creation-form");
    const title = form?.querySelector("h2");
    const submitBtn = document.getElementById("cabinet-submit-button");

    const isEditMode = !!detail;

    // 1️⃣ 제목/버튼 텍스트
    if (isEditMode) {
      title.textContent = `${detail.name} 정보 수정`;
      submitBtn.textContent = "시약장 정보 수정";
      submitBtn.id = "cabinet-save-btn";
    } else {
      title.textContent = "시약장 등록";
      submitBtn.textContent = "시약장 등록";
    }

    // 2️⃣ 데이터 채우기
    if (isEditMode) fillFormFromData(detail, "cabinet-creation-form");

    // 3️⃣ 버튼 그룹 초기화
    const groupIds = [
      "area-button-group",
      "cabinet_name_buttons",
      "door_vertical_split_buttons",
      "door_horizontal_split_buttons",
      "shelf_height_buttons",
      "storage_columns_buttons",
    ];
    groupIds.forEach((id) => setupButtonGroup(id));

    // 4️⃣ 기존 선택값 반영
    if (isEditMode) {
      if (detail.area_id?.id) {
        globalThis.selectedAreaId = detail.area_id.id;
        const btn = document.querySelector(
          `#area-button-group button[data-id="${detail.area_id.id}"]`
        );
        if (btn) btn.classList.add("active");
      }

      if (detail.name) {
        const nameBtn = document.querySelector(
          `#cabinet_name_buttons button[data-value="${detail.name}"]`
        );
        if (nameBtn) {
          nameBtn.classList.add("active");
          document
            .querySelectorAll("#cabinet_name_buttons button")
            .forEach((b) => (b.disabled = true));
        }
      }

      if (detail.door_vertical_count) {
        activateButton(
          "door_vertical_split_buttons",
          detail.door_vertical_count
        );
      }
      if (detail.door_horizontal_count) {
        activateButton(
          "door_horizontal_split_buttons",
          detail.door_horizontal_count
        );
      }
      if (detail.shelf_height) {
        activateButton("shelf_height_buttons", detail.shelf_height);
      }
      if (detail.storage_columns) {
        activateButton("storage_columns_buttons", detail.storage_columns);
      }
    }

    // 5️⃣ 기타 입력칸 표시 안정화
    document
      .querySelectorAll(".button-group button")
      .forEach((btn) =>
        btn.addEventListener("click", () => {
          const isOther = btn.textContent.includes("기타");
          const group = btn.closest(".form-group");
          const next = group?.nextElementSibling;
          if (next && next.classList.contains("other-input-group")) {
            next.style.display = isOther ? "block" : "none";
          }
        })
      );

    // 6️⃣ 저장/등록 버튼
    submitBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (isEditMode) await updateCabinetInfo(detail.id);
      else await createCabinet();
    });
  }

  // ---------------------------------------------------------------
  // 새 시약장 등록
  // ---------------------------------------------------------------
  async function createCabinet() {
    try {
      const formData = collectFormData("cabinet-creation-form");

      if (!globalThis.selectedAreaId) {
        alert("❗ 시약장이 위치한 장소를 선택해 주세요.");
        return;
      }

      const { error } = await supabase.from("Cabinet").insert([
        {
          name: formData.name,
          area_id: globalThis.selectedAreaId,
          door_vertical_count: formData.door_vertical_count,
          door_horizontal_count: formData.door_horizontal_count,
          shelf_height: formData.shelf_height,
          storage_columns: formData.storage_columns,
        },
      ]);

      if (error) throw error;
      alert("✅ 시약장이 성공적으로 등록되었습니다!");
      includeHTML("pages/location-list.html");
    } catch (err) {
      console.error("❌ 등록 오류:", err);
      alert("시약장 등록 중 오류가 발생했습니다.");
    }
  }

  // ---------------------------------------------------------------
  // 시약장 수정
  // ---------------------------------------------------------------
  async function updateCabinetInfo(cabinetId) {
    try {
      const formData = collectFormData("cabinet-creation-form");
      if (!cabinetId) return alert("❌ 시약장 ID가 없습니다.");

      if (!globalThis.selectedAreaId)
        return alert("❗ 시약장이 위치한 장소를 선택해 주세요.");

      const { error } = await supabase
        .from("Cabinet")
        .update({
          name: formData.name,
          area_id: globalThis.selectedAreaId,
          door_vertical_count: formData.door_vertical_count,
          door_horizontal_count: formData.door_horizontal_count,
          shelf_height: formData.shelf_height,
          storage_columns: formData.storage_columns,
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

  // ---------------------------------------------------------------
  // 버튼 활성화 유틸
  // ---------------------------------------------------------------
  function activateButton(groupId, value) {
    const buttons = document.querySelectorAll(`#${groupId} button`);
    buttons.forEach((btn) => {
      if (btn.dataset.value == value) btn.classList.add("active");
    });
  }

  // ---------------------------------------------------------------
  // 전역 등록
  // ---------------------------------------------------------------
  globalThis.loadCabinetList = loadCabinetList;
  globalThis.initializeCabinetForm = initializeCabinetForm;
  globalThis.updateCabinetInfo = updateCabinetInfo;
  globalThis.createCabinet = createCabinet;
})();
