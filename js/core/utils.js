// ================================================================
// /js/core/utils.js — 공용 유틸리티 (Deno/브라우저 호환)
// ================================================================
(function () {
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function collectFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    const data = {};
    new FormData(form).forEach((v, k) => (data[k] = v));
    return data;
  }

  function setupButtonGroup(groupId, onSelect) {
    const group = document.getElementById(groupId);
    if (!group) return;

    // ✅ [수정됨] newGroup.addEventListener -> group.addEventListener
    group.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        // '수정' 모드에서 비활성화된 버튼은 클릭되지 않도록 방지
        if (btn.disabled) return;

        // ✅ [수정됨] newGroup.querySelectorAll -> group.querySelectorAll
        group.querySelectorAll(".active").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        if (typeof onSelect === "function") {
            onSelect(btn);
        }
    });
  }

async function makePayload(state) {
  const verticalMap = { "상중하도어": 3, "상하도어": 2, "단일도어": 1, "단일도어(상하분리없음)": 1 };
  const horizontalMap = { "좌우분리도어": 2, "단일도어": 1 };

  // 1️⃣ 시약장 이름 결정
  const cabinetName = state.name || state.cabinet_custom_name || state.cabinet_name_buttons || state.cabinet_name || null;

  // 2️⃣ 장소 이름 확인
  let finalAreaId = state.area_id;
  let selectedAreaName = state.area;
  let areaCustomName = state.area_custom_name;

  // ✅ state.area가 비어있거나 null인 경우 → 기본 장소 이름 부여
  if (!selectedAreaName && !areaCustomName) {
    selectedAreaName = "미지정 장소"; // ← 새 기본 장소명
    areaCustomName = "미지정 장소";
  }

  // 3️⃣ Area 테이블 확인 / 신규 추가
  if (selectedAreaName && selectedAreaName !== "기타") {
    const { data: existingArea, error: findErr } = await App.supabase
      .from("Area")
      .select("id")
      .eq("name", selectedAreaName)
      .maybeSingle();

    if (findErr) console.warn("⚠️ Area 조회 오류:", findErr.message);

    if (existingArea && existingArea.id) {
      finalAreaId = existingArea.id;
    } else {
      console.log("🆕 Area 신규 추가:", selectedAreaName);
      const { data: newArea, error: insertErr } = await App.supabase
        .from("Area")
        .insert({ name: selectedAreaName })
        .select("id")
        .single();

      if (insertErr) throw new Error("장소 생성 오류: " + insertErr.message);
      finalAreaId = newArea.id;
    }
  } else if (selectedAreaName === "기타" && areaCustomName) {
    // 기타 입력 시 직접 생성
    const { data: newArea, error: insertErr } = await App.supabase
      .from("Area")
      .insert({ name: areaCustomName })
      .select("id")
      .single();

    if (insertErr) throw new Error("기타 장소 생성 오류: " + insertErr.message);
    finalAreaId = newArea.id;
  }

  console.log("💾 makePayload 결과:", {
    cabinetName,
    nameInState: state.name,
    area: selectedAreaName,
    finalAreaId,
  });

  // 4️⃣ 최종 반환
  return {
    name: cabinetName,
    area_id: finalAreaId,
    area_custom_name: areaCustomName || null,
    door_vertical_count: verticalMap[state.door_vertical_split_buttons] || null,
    door_horizontal_count: horizontalMap[state.door_horizontal_split_buttons] || null,
    shelf_height: state.shelf_height ? parseInt(state.shelf_height) : null,
    storage_columns: state.storage_columns ? parseInt(state.storage_columns) : null,
    photo_320_base64: state.photo_320_base64 || null,
    photo_160_base64: state.photo_160_base64 || null,
    photo_url_320: state.mode === "edit" && !state.photo_320_base64 ? state.photo_url_320 : null,
    photo_url_160: state.mode === "edit" && !state.photo_160_base64 ? state.photo_url_160 : null,
  };
}

globalThis.App = globalThis.App || {};
globalThis.App.Utils = { sleep, collectFormData, setupButtonGroup, makePayload };
})();
