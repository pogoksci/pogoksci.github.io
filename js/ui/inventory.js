// /js/ui/inventory.js
(async function () {
  const { supabase } = globalThis.App;

  // ======================================================
  // 1️⃣ 약품 목록 불러오기
  // ======================================================
  async function fetchInventoryAndRender() {
    const container = document.getElementById("inventory-list-container");
    const status = document.getElementById("status-message-inventory-list");
    if (!container || !status) return;

    try {
      status.textContent = "재고 목록을 불러오는 중...";
      container.innerHTML = "";

      const { data, error } = await supabase
        .from("Inventory")
        .select(`
          id,
          current_amount,
          unit,
          classification,
          manufacturer,
          photo_url_160,
          substance_id ( id, name, cas_rn ),
          cabinet_id ( id, name, area_id ( name ) )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data?.length) {
        status.textContent = "등록된 약품이 없습니다.";
        return;
      }

      // ✅ 목록 생성
      container.innerHTML = "";
      data.forEach((item) => {
        const name = item.substance_id?.name || "이름 없음";
        const cas = item.substance_id?.cas_rn || "-";
        const loc = item.cabinet_id?.area_id?.name
          ? `${item.cabinet_id.area_id.name} · ${item.cabinet_id.name}`
          : "위치 정보 없음";

        const card = document.createElement("div");
        card.className = "cabinet-card";
        card.innerHTML = `
          <div class="card-image-placeholder">
            ${item.photo_url_160 ? `<img src="${item.photo_url_160}">` : "사진 없음"}
          </div>
          <div class="card-info">
            <h3>${name}</h3>
            <p class="area-name">${loc}</p>
            <p class="cabinet-specs">CAS: ${cas}</p>
          </div>
        `;
        card.addEventListener("click", async () => {
          localStorage.setItem("selected_inventory_id", item.id);
          await includeHTML("pages/inventory-detail.html", "form-container");
          await loadInventoryDetail(item.id);
        });
        container.appendChild(card);
      });

      status.textContent = "";
    } catch (err) {
      console.error("재고 목록 로드 오류:", err);
      status.textContent = "재고 목록 불러오기 중 오류 발생.";
    }
  }

  globalThis.fetchInventoryAndRender = fetchInventoryAndRender;
})();
