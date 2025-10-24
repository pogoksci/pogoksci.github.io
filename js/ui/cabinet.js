// ================================================================
// /js/ui/cabinet.js
// 시약장 등록·수정 겸용 + Deno 호환(globalThis 기반)
// ================================================================

(function () {
  const { supabase } = globalThis.App;

  // ---------------------------------------------------------------
  // 시약장 목록 로드
  // ---------------------------------------------------------------
  async function loadCabinetList() {
    console.log("📦 loadCabinetList() 시작");
    const listContainer = document.getElementById("cabinet-list-container");
    const statusMessage = document.getElementById("status-message-list");
    if (!listContainer || !statusMessage) return;

    try {
      // ✅ Supabase에서 Cabinet 데이터 조회
      const { data, error } = await App.supabase
        .from("Cabinet")
        .select("id, name, area_id(id, name), door_vertical_count, door_horizontal_count, shelf_height, storage_columns, photo_url_320, photo_url_160")
        .order("id", { ascending: true });

      if (error) throw error;
      console.log("✅ 시약장 목록:", data);

      if (!data || data.length === 0) {
        statusMessage.textContent = "등록된 시약장이 없습니다.";
        return;
      }

      statusMessage.style.display = "none";
      renderCabinetList(data);
    } catch (err) {
      console.error("❌ 시약장 목록 불러오기 실패:", err);
      statusMessage.textContent = "시약장 목록을 불러오지 못했습니다.";
    }
  }

  function renderCabinetList(cabinets) {
    const container = document.getElementById("cabinet-list-container");
    if (!container) {
      console.warn("⚠️ renderCabinetList: container not found");
      return;
    }

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
              <button class="edit-btn" onclick="editCabinet(${cab.id})">수정</button>
              <button class="delete-btn" onclick="deleteCabinet(${cab.id})">삭제</button>
            </div>
          </div>`;
      })
      .join("");
  }

  // ---------------------------------------------------------------
  // 수정 버튼 클릭 시
  // ---------------------------------------------------------------
  globalThis.editCabinet = async function (cabinetId) {
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

    // ✅ 2️⃣ 버튼 그룹 먼저 초기화
    const groupIds = [
      "area-button-group",
      "cabinet_name_buttons",
      "door_vertical_split_buttons",
      "door_horizontal_split_buttons",
      "shelf_height_buttons",
      "storage_columns_buttons",
    ];
    groupIds.forEach((id) => setupButtonGroup(id));

    // ✅ 3️⃣ 기존 데이터 채우기 (DOM 교체 후 실행해야 active 유지됨)
    if (isEditMode) fillCabinetForm(detail);

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

  function fillCabinetForm(detail) {
    // 버튼을 프로그래밍 방식으로 클릭하여 상태를 미리 설정하는 헬퍼 함수
    const verticalMap = { 3: "상중하도어", 2: "상하도어", 1: "단일도어(상하분리없음)" };
    const horizontalMap = { 2: "좌우분리도어", 1: "단일도어" };

    // --- 데이터 미리 채우기 및 비활성화 ---
    const areaGroup = document.getElementById('area-button-group');
    const cabinetNameGroup = document.getElementById('cabinet_name_buttons');

    // 1. 장소(Area) 버튼 처리
    if (areaGroup) {
        // 모든 버튼을 일단 비활성화
        areaGroup.querySelectorAll('button').forEach(btn => btn.disabled = true);
        // 저장된 값과 일치하는 버튼에만 'active' 클래스 추가
        const activeButton = areaGroup.querySelector(`button[data-value="${detail.area_id?.name}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        } else { // '기타' 항목 처리
            const otherButton = areaGroup.querySelector('button[data-value="기타"]');
            if (otherButton) otherButton.classList.add('active');
            const otherInput = document.getElementById('other_area_input');
            if(otherInput) {
                otherInput.value = detail.area_id?.name || '';
                otherInput.disabled = true;
                document.getElementById('other_area_group').style.display = 'block';
            }
        }
    }
    
    // 2. 시약장 이름 버튼 처리 (동일한 로직 적용)
    if (cabinetNameGroup) {
        cabinetNameGroup.querySelectorAll('button').forEach(btn => btn.disabled = true);
        const activeButton = cabinetNameGroup.querySelector(`button[data-value="${detail.name}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        } else {
            const otherButton = cabinetNameGroup.querySelector('button[data-value="기타"]');
            if (otherButton) otherButton.classList.add('active');
            const otherInput = document.getElementById('other_cabinet_input');
            if(otherInput) {
                otherInput.value = detail.name || '';
                otherInput.disabled = true;
                document.getElementById('other_cabinet_group').style.display = 'block';
            }
        }
    }

    // 3. 나머지 버튼 그룹 처리
    const setButtonActive = (groupId, value) => {
        const group = document.getElementById(groupId);
        if (!group || value == null) return;
        const button = group.querySelector(`button[data-value="${value}"]`);
        if (button) button.classList.add('active');
    };

    setButtonActive('door_vertical_split_buttons', verticalMap[detail.door_vertical_count]);
    setButtonActive('door_horizontal_split_buttons', horizontalMap[detail.door_horizontal_count]);
    setButtonActive('shelf_height_buttons', detail.shelf_height.toString());
    setButtonActive('storage_columns_buttons', detail.storage_columns.toString());

    // 4. 사진 미리보기
    if (detail.photo_url_320) {
        const photoPreview = document.getElementById('cabinet-photo-preview');
        if (photoPreview) {
            photoPreview.innerHTML = `<img src="${detail.photo_url_320}" alt="Cabinet photo preview">`;
        }
    }
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
