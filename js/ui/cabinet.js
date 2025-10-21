// js/ui/cabinet.js
(function () {
  const { supabase } = window.App;

  async function loadCabinetList() {
    const container = document.getElementById("cabinet-list-container");
    const status = document.getElementById("status-message-list");

    try {
      status.textContent = "시약장 목록 불러오는 중...";

      // 🔧 photo_url 컬럼 제거 또는 안전한 선택문으로 교체
      const { data, error } = await supabase
        .from("Cabinet")
        .select(`id, name, area_id ( name ), photo_url_160, photo_url_320`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        status.textContent = "등록된 시약장이 없습니다.";
        return;
      }

      container.innerHTML = "";
      data.forEach((cab) => {
        const photo = cab.photo_url_320 || cab.photo_url_160 || null;
        const areaName = cab.area_id?.name || "-";

        const card = document.createElement("div");
        card.className = "cabinet-card";
        card.innerHTML = `
          <div class="card-image-placeholder">
            ${photo ? `<img src="${photo}" alt="${cab.name}" />` : "사진 없음"}
          </div>
          <div class="card-info">
            <h3>${cab.name}</h3>
            <p class="area-name">${areaName}</p>
          </div>
          <div class="card-actions">
            <button class="edit-btn" data-id="${cab.id}">수정</button>
            <button class="delete-btn" data-id="${cab.id}">삭제</button>
          </div>
        `;

        // 수정 버튼
        card.querySelector(".edit-btn").addEventListener("click", async () => {
          try {
            const { data: detail, error } = await supabase
              .from("Cabinet")
              .select(`id, name, area_id ( id, name ), photo_url_160, photo_url_320`)
              .eq("id", cab.id)
              .maybeSingle(); // ✅ 안전한 단일 행 조회
            if (error || !detail) throw error || new Error("데이터 없음");

            alert(`시약장 "${detail.name}" 정보를 불러왔습니다.`);
            // includeHTML("pages/cabinet-form.html"); // 필요 시 폼 이동
          } catch (err) {
            console.error(err);
            alert("시약장 정보를 불러오지 못했습니다.");
          }
        });

        // 삭제 버튼
        card.querySelector(".delete-btn").addEventListener("click", async () => {
          if (!confirm(`"${cab.name}"을(를) 삭제하시겠습니까?`)) return;
          await supabase.from("Cabinet").delete().eq("id", cab.id);
          loadCabinetList();
        });

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
