// js/ui/cabinet.js
(function () {
  const { supabase } = window.App;
  const { callEdge, EDGE } = window.App.API;

  async function loadCabinetList() {
    const container = document.getElementById("cabinet-list-container");
    const status = document.getElementById("status-message-list");

    try {
      status.textContent = "시약장 목록 불러오는 중...";
      const { data, error } = await supabase
        .from("Cabinet")
        .select(`id, name, area_id ( name ), photo_url`)
        .order("created_at", { ascending: false });
      if (error) throw error;

      if (!data.length) {
        status.textContent = "등록된 시약장이 없습니다.";
        return;
      }

      container.innerHTML = "";
      data.forEach((cab) => {
        const card = document.createElement("div");
        card.className = "cabinet-card";
        card.innerHTML = `
          <div class="card-image-placeholder">
            ${cab.photo_url ? `<img src="${cab.photo_url}"/>` : "사진 없음"}
          </div>
          <div class="card-info">
            <h3>${cab.name}</h3>
            <p class="area-name">${cab.area_id?.name || "-"}</p>
          </div>
        `;
        container.appendChild(card);
      });

      status.textContent = "";
    } catch (err) {
      console.error("시약장 불러오기 오류:", err);
      status.textContent = "오류가 발생했습니다.";
    }
  }

  window.loadCabinetList = loadCabinetList;
})();
