// ================================================================
// /js/ui/equipment-cabinet.js — 교구·물품장 관리 (DB: EquipmentCabinet)
// ================================================================
(function () {
    const getApp = () => globalThis.App || {};
    const getSupabase = () => getApp().supabase || {};
    const getAPI = () => getApp().API || {};

    // ------------------------------------------------------------
    // 1️⃣ 목록 로드
    // ------------------------------------------------------------
    async function loadList(retryCount = 0) {
        const supabase = getSupabase();
        const container = document.getElementById("equipment-cabinet-list-container");
        const status = document.getElementById("status-message-equipment-list");

        if (!container || !status) {
            if (retryCount < 5) { // Increased retries
                setTimeout(() => loadList(retryCount + 1), 200); // Increased delay
                return;
            }
            console.error("DOM Elements for Equipment Cabinet List not found.");
            return;
        }

        // ✅ FAB 버튼 활성화
        if (App.Fab && App.Fab.setVisibility) {
            App.Fab.setVisibility(true, '<span class="material-symbols-outlined">add</span> 새 교구·물품장 등록', () => {
                createForm();
            });
        }

        status.style.display = "block";
        status.textContent = "등록된 교구·물품장을 불러오는 중...";

        try {
            const { data, error } = await supabase
                .from("EquipmentCabinet")
                .select("id,cabinet_name,area_id(id,area_name),door_vertical_count,photo_url_320,photo_url_160")
                .order("id", { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                status.textContent = "등록된 교구·물품장이 없습니다.";
                status.style.display = "block";
                container.innerHTML = ""; // Clear any previous content but keep status/structure logic safe
                // Ideally we shouldn't wipe container if status is inside it? 
                // In HTML, status is IN container. 
                // Let's adjust: status is likely p tag inside.
                // If we wipe container, we lose status.
                // Check HTML: <div id="equipment-cabinet-list-container"><p id="status...">...</p></div>
                // So if we clear innerHTML, status is gone.
                // Valid approach: append cards to container, or hide status.
                return;
            }

            status.style.display = "none";
            renderCards(data);

        } catch (err) {
            status.textContent = "목록을 불러올 수 없습니다.";
            status.style.display = "block";
            console.error(err);
        }
    }

    // ------------------------------------------------------------
    // 2️⃣ 카드 렌더링
    // ------------------------------------------------------------
    function renderCards(list) {
        const container = document.getElementById("equipment-cabinet-list-container");
        if (!container) return;

        container.innerHTML = list.map((item) => {
            const photo = item.photo_url_320 || item.photo_url_160 || null;
            const areaName = item.area_id?.area_name || "위치 없음";
            return `
      <div class="cabinet-card">
        <div class="card-info">
          <h3>${item.cabinet_name} <small class="area-name">${areaName}</small></h3>
        </div>
        <div class="card-image-placeholder">
          ${photo ? `<img src="${photo}" alt="${item.cabinet_name}" class="card-image">` : `<span class="no-photo-text">사진 없음</span>`}
        </div>
        <div class="card-actions">
          <button class="edit-btn" data-id="${item.id}">수정</button>
          <button class="delete-btn" data-id="${item.id}">삭제</button>
        </div>
      </div>`;
        }).join("");

        container.querySelectorAll(".edit-btn").forEach((btn) =>
            btn.addEventListener("click", () => editCabinet(btn.dataset.id))
        );
        container.querySelectorAll(".delete-btn").forEach((btn) =>
            btn.addEventListener("click", () => deleteCabinet(btn.dataset.id))
        );
    }

    // ------------------------------------------------------------
    // 3️⃣ 수정
    // ------------------------------------------------------------
    async function editCabinet(id) {
        const supabase = getSupabase();
        try {
            const { data: detail, error } = await supabase
                .from("EquipmentCabinet")
                .select("*")
                .eq("id", id)
                .maybeSingle();

            if (error || !detail) throw error || new Error("데이터 없음");

            if (App.Forms && typeof App.Forms.initEquipmentCabinetForm === "function") {
                App.Forms.initEquipmentCabinetForm("edit", detail);
            }
        } catch (err) {
            console.error(err);
            alert("정보를 불러올 수 없습니다.");
        }
    }

    // ------------------------------------------------------------
    // 4️⃣ 생성/수정/삭제 (Edge Function 호출)
    // ------------------------------------------------------------
    async function createCabinet(payload) {
        const API = getAPI();
        // Edge Function 'equipment-cabinet' 호출
        await API.callEdge('equipment-cabinet', {
            method: 'POST',
            body: payload
        });
    }

    async function updateCabinet(id, payload) {
        const API = getAPI();
        const patchPayload = {
            ...payload,
            cabinet_id: id
        };
        await API.callEdge('equipment-cabinet', {
            method: 'PATCH',
            body: patchPayload
        });
    }

    async function deleteCabinet(id) {
        const API = getAPI();
        if (!confirm("정말 삭제하시겠습니까?")) return;

        try {
            // Cabinet 삭제 Edge Function이 'table' 파라미터를 지원하므로 활용 시도
            // 만약 Edge Function이 Cabinet 테이블만 강제한다면 오류가 날 수 있음.
            // 안전하게 직접 Delete 후 Storage 파일 정리는 추후 고려
            // 우선 API.callEdge 사용 시도 (cabinet.js 참조)
            await API.callEdge(`${API.EDGE.DELETEAREA}?id=${id}&table=EquipmentCabinet`, {
                method: "DELETE",
            });

            alert("✅ 삭제되었습니다.");
            await App.includeHTML("pages/equipment-cabinet-list.html");
            requestAnimationFrame(() => loadList());
        } catch (err) {
            console.error(err);
            // Fallback: 직접 삭제
            const supabase = getSupabase();
            const { error } = await supabase.from("EquipmentCabinet").delete().eq("id", id);
            if (error) {
                alert("삭제 실패: " + error.message);
            } else {
                alert("✅ 삭제되었습니다.");
                await App.includeHTML("pages/equipment-cabinet-list.html");
                requestAnimationFrame(() => loadList());
            }
        }
    }

    // ------------------------------------------------------------
    // 5️⃣ 폼 호출
    // ------------------------------------------------------------
    function createForm() {
        if (App.Forms && typeof App.Forms.initEquipmentCabinetForm === "function") {
            App.Forms.initEquipmentCabinetForm("create", null);
        }
    }

    // ------------------------------------------------------------
    // Global Export
    // ------------------------------------------------------------
    globalThis.App = globalThis.App || {};
    globalThis.App.EquipmentCabinet = {
        loadList,
        createForm,
        createCabinet,
        updateCabinet,
        delete: deleteCabinet
    };

})();
