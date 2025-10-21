// js/ui/inventory-detail.js
(async function () {
  const { supabase } = globalThis.App;

  // ======================================================
  // 2️⃣ 상세 정보 로드
  // ======================================================
  async function loadInventoryDetail(id = null) {
    try {
      const inventoryId =
        id || localStorage.getItem("selected_inventory_id");
      if (!inventoryId) {
        alert("잘못된 접근입니다.");
        return;
      }

      const { data, error } = await supabase
        .from("Inventory")
        .select(`
          id,
          state,
          current_amount,
          unit,
          classification,
          manufacturer,
          purchase_date,
          photo_url_320,
          substance_id ( id, name, cas_rn ),
          cabinet_id ( id, name, area_id ( name ) )
        `)
        .eq("id", inventoryId)
        .single();
      if (error) throw error;

      // ✅ DOM 요소 반영
      const photoDiv = document.getElementById("detail-photo");
      photoDiv.innerHTML = data.photo_url_320
        ? `<img src="${data.photo_url_320}" alt="시약병 사진">`
        : `<span>사진 없음</span>`;

      document.getElementById("detail-name").textContent =
        data.substance_id?.name || "이름 없음";
      document.getElementById("detail-cas").textContent =
        `CAS: ${data.substance_id?.cas_rn || "-"}`;

      const locText = data.cabinet_id?.area_id?.name
        ? `위치: ${data.cabinet_id.area_id.name} · ${data.cabinet_id.name}`
        : "위치: 미지정";
      document.getElementById("detail-location").textContent = locText;

      document.getElementById("detail-class").textContent =
        data.classification || "-";
      document.getElementById("detail-state").textContent =
        data.state || "-";
      document.getElementById("detail-manufacturer").textContent =
        data.manufacturer || "-";

      // 삭제 및 수정 버튼 이벤트
      document.getElementById("delete-inventory-btn")?.addEventListener("click", async () => {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        await supabase.from("Inventory").delete().eq("id", inventoryId);
        alert("삭제되었습니다.");
        await includeHTML("pages/inventory-list.html", "form-container");
        await fetchInventoryAndRender();
      });

      document.getElementById("edit-inventory-btn")?.addEventListener("click", async () => {
        await includeHTML("pages/form-input.html", "form-container");
        await initializeFormListeners();
        alert("폼 수정 모드로 전환 (추후 구현)");
      });
    } catch (err) {
      console.error("상세 페이지 로드 오류:", err);
      document.getElementById("detail-page-container").innerHTML =
        `<p>❌ 오류: ${err.message}</p>`;
    }
  }

  globalThis.loadInventoryDetail = loadInventoryDetail;
})();
