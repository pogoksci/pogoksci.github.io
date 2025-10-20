// js/ui/inventory.js
(function () {
  const { supabase } = window.App;

  async function fetchInventoryAndRender() {
    const container = document.getElementById("inventory-list-container");
    const statusMessage = document.getElementById("status-message-inventory-list");

    try {
      statusMessage.textContent = "재고 목록을 불러오는 중...";
      container.innerHTML = "";

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
        .order("created_at", { ascending: false });
      if (error) throw error;

      if (!data || data.length === 0) {
        statusMessage.textContent = "등록된 재고가 없습니다.";
        return;
      }

      data.forEach((item) => {
        const div = document.createElement("div");
        div.className = "cabinet-card";
        div.style.marginBottom = "10px";

        const imgUrl = item.photo_url_160 || "css/logo.png";
        const substanceName = item.substance_id?.name || "이름 없음";
        const cas = item.substance_id?.cas_rn || "-";
        const location = item.cabinet_id?.area_id?.name
          ? `${item.cabinet_id.area_id.name} > ${item.cabinet_id.name}`
          : "위치 정보 없음";

        div.innerHTML = `
          <div class="card-image-placeholder">
            <img src="${imgUrl}" alt="${substanceName}" style="width:100%;height:100%;object-fit:cover;">
          </div>
          <div class="card-info">
            <h3>${substanceName}</h3>
            <p class="area-name">${location}</p>
            <p class="cabinet-specs">CAS: ${cas}</p>
            <p class="cabinet-specs">${item.current_amount ?? "-"} ${item.unit ?? ""}</p>
          </div>
        `;

        div.addEventListener("click", () => {
          localStorage.setItem("selected_inventory_id", item.id);
          includeHTML("pages/inventory-detail.html");
        });

        container.appendChild(div);
      });

      statusMessage.textContent = "";
    } catch (err) {
      console.error("재고 목록 로드 오류:", err);
      statusMessage.textContent = "재고 목록을 불러오는 중 오류가 발생했습니다.";
    }
  }

  window.fetchInventoryAndRender = fetchInventoryAndRender;
})();
