// /js/ui/inventory-detail.js
(function () {
  const getApp = () => globalThis.App || {};
  const getSupabase = () => getApp().supabase;

  async function loadInventoryDetail(id = null) {
    try {
      const supabase = getSupabase();
      const inventoryId = id || localStorage.getItem("selected_inventory_id");
      if (!inventoryId) {
        alert("잘못된 접근입니다.");
        return;
      }

      const { data, error } = await supabase
        .from("Inventory")
        .select(`
          id, state, current_amount, unit, classification, manufacturer, purchase_date, photo_url_320, photo_url_160,
          door_vertical, door_horizontal, internal_shelf_level, storage_column,
          Substance ( id, substance_name, cas_rn, molecular_formula ),
          Cabinet ( id, cabinet_name, Area ( area_name ) )
        `)
        .eq("id", inventoryId)
        .single();

      if (error) throw error;

      // 사진
      const photoDiv = document.getElementById("detail-photo");
      const photoUrl = data.photo_url_320 || data.photo_url_160 || "";
      photoDiv.innerHTML = photoUrl
        ? `<img src="${photoUrl}" alt="시약병 사진">`
        : `<span>사진 없음</span>`;

      // 이름/CAS
      document.getElementById("detail-name").textContent = data.Substance?.substance_name || "이름 없음";
      document.getElementById("detail-cas").textContent = `CAS: ${data.Substance?.cas_rn || "-"}`;

      // 위치 요약
      const area = data.Cabinet?.Area?.area_name || "";
      const cab = data.Cabinet?.cabinet_name || "";
      const v = data.door_vertical || "";
      const h = data.door_horizontal || "";
      const shelf = data.internal_shelf_level != null ? `${data.internal_shelf_level}층` : "";
      const col = data.storage_column != null ? `${data.storage_column}열` : "";
      const locText = [area, cab, v, h, shelf, col].filter(Boolean).join(" · ") || "위치: 미지정";
      document.getElementById("detail-location").textContent = locText;

      document.getElementById("detail-class").textContent = data.classification || "-";
      document.getElementById("detail-state").textContent = data.state || "-";
      document.getElementById("detail-manufacturer").textContent = data.manufacturer || "-";

      // 삭제
      document.getElementById("delete-inventory-btn")?.addEventListener("click", async () => {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        const app = getApp();
        const fnBase =
          app.projectFunctionsBaseUrl ||
          (app.supabaseUrl ? `${app.supabaseUrl}/functions/v1` : "");
        if (!fnBase) {
          alert("함수 호출 경로를 찾을 수 없습니다.");
          return;
        }
        const headers =
          app.supabaseAnonKey
            ? {
                apikey: app.supabaseAnonKey,
                Authorization: `Bearer ${app.supabaseAnonKey}`,
              }
            : undefined;
        const fnUrl = `${fnBase}/casimport?type=inventory&id=${inventoryId}`;
        const res = await fetch(fnUrl, { method: "DELETE", headers });
        if (!res.ok) {
          const msg = await res.text();
          alert("삭제 실패: " + msg);
          return;
        }
        alert("삭제되었습니다.");
        // 목록으로 복귀
        if (getApp().Inventory?.showListPage) {
          await getApp().Inventory.showListPage();
        }
      });

      // 수정
      document.getElementById("edit-inventory-btn")?.addEventListener("click", async () => {
        if (getApp().Router?.go && getApp().Forms?.initInventoryForm) {
          await getApp().Router.go("addInventory", "form-container", () =>
            getApp().Forms.initInventoryForm("edit", data),
          );
        } else {
          alert("폼 수정 모드로 전환 (구현 필요)");
        }
      });
    } catch (err) {
      console.error("상세 페이지 로드 오류:", err);
      document.getElementById("detail-page-container").innerHTML = `<p>❌ 오류: ${err.message}</p>`;
    }
  }

  globalThis.loadInventoryDetail = loadInventoryDetail;
})();
