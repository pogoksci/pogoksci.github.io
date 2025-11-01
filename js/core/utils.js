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

  // 2️⃣ 장소 이름 기반 area_id 처리
  let finalAreaId = state.area_id; // '수정' 모드의 초기 ID
  const selectedAreaName = state.area;

  if (selectedAreaName && selectedAreaName !== "기타") {
    // 🔍 먼저 기존 Area 테이블에서 해당 이름을 찾기
    const { data: area, error: findErr } = await App.supabase
      .from("Area")
      .select("id")
      .eq("name", selectedAreaName)
      .maybeSingle();

    if (findErr) console.warn("⚠️ Area 조회 중 오류:", findErr.message);

    if (area && area.id) {
      // ✅ 이미 존재 → 그 ID 사용
      finalAreaId = area.id;
    } else {
      // ❌ 없으면 새로 추가
      console.log("🆕 Area 신규 추가:", selectedAreaName);
      const { data: newArea, error: insertErr } = await App.supabase
        .from("Area")
        .insert({ name: selectedAreaName })
        .select("id")
        .single();

      if (insertErr) {
        console.error("❌ Area 신규 추가 실패:", insertErr.message);
        throw new Error("장소 추가 중 오류 발생: " + insertErr.message);
      }

      finalAreaId = newArea.id;
            //state.area_custom_name = selectedAreaName;

        }
    } else if (selectedAreaName === "기타") {
        finalAreaId = null; // '기타' 버튼을 누르면 ID는 null
    }

    // ⬆️ [수정 완료]
    console.log("💾 makePayload 결과:", {
      cabinetName,
      nameInState: state.name,
      cabinet_name: state.cabinet_name,
      area: state.area,
      finalAreaId
    });

    return {
        name: cabinetName,
        area_id: finalAreaId, // ⬅️ [수정됨] DB에서 조회한 ID
        area_custom_name: state.area_custom_name, 

        // 텍스트 값을 숫자로 변환
        door_vertical_count: verticalMap[state.door_vertical_split_buttons] || null,
        door_horizontal_count: horizontalMap[state.door_horizontal_split_buttons] || null,
        shelf_height: state.shelf_height ? parseInt(state.shelf_height) : null,
        storage_columns: state.storage_columns ? parseInt(state.storage_columns) : null,

        // 사진 데이터
        photo_320_base64: state.photo_320_base64 || null,
        photo_160_base64: state.photo_160_base64 || null,
        photo_url_320: state.mode === 'edit' && !state.photo_320_base64 ? state.photo_url_320 : null,
        photo_url_160: state.mode === 'edit' && !state.photo_160_base64 ? state.photo_url_160 : null,
    };
}

  globalThis.App = globalThis.App || {};
  globalThis.App.Utils = { sleep, collectFormData, setupButtonGroup, makePayload };
})();
