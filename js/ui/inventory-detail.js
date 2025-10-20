// js/ui/inventory-detail.js
(function () {
  const { supabase } = window.App;
  const { callEdge, EDGE } = window.App.API;

  async function loadInventoryDetail() {
    const id = localStorage.getItem("selected_inventory_id");
    if (!id) return alert("선택된 시약 정보가 없습니다.");

    const photoBox = document.getElementById("detail-photo");
    const nameEl = document.getElementById("detail-name");
    const casEl = document.getElementById("detail-cas");
    const locationEl = document.getElementById("detail-location");

    try {
      const { data, error } = await supabase
        .from("Inventory")
        .select(`
          id,
          current_amount,
          unit,
          photo_url_160,
          substance_id ( name, cas_rn ),
          cabinet_id ( name, area_id ( name ) )
        `)
        .eq("id", id)
        .single();
      if (error) throw error;

      nameEl.textContent = data.substance_id?.name || "이름 없음";
      casEl.textContent = `CAS: ${data.substance_id?.cas_rn || "-"}`;
      locationEl.textContent =
        data.cabinet_id?.area_id?.name && data.cabinet_id?.name
          ? `${data.cabinet_id.area_id.name} > ${data.cabinet_id.name}`
          : "위치 정보 없음";

      if (data.photo_url_160) {
        photoBox.innerHTML = `<img src="${data.photo_url_160}" alt="${data.substance_id?.name}" />`;
      } else {
        photoBox.innerHTML = `<span>사진 없음</span>`;
      }
    } catch (err) {
      console.error("상세 정보 로드 오류:", err);
      nameEl.textContent = "정보를 불러오지 못했습니다.";
    }
  }

  async function deleteInventory() {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const id = localStorage.getItem("selected_inventory_id");
    if (!id) return alert("삭제할 항목이 없습니다.");

    try {
      const { error } = await supabase.from("Inventory").delete().eq("id", id);
      if (error) throw error;

      alert("삭제되었습니다.");
      includeHTML("pages/inventory-list.html");
    } catch (err) {
      console.error("삭제 오류:", err);
      alert("삭제 중 오류가 발생했습니다.");
    }
  }

  // 초기화
  window.loadInventoryDetail = loadInventoryDetail;
  window.deleteInventory = deleteInventory;
})();
