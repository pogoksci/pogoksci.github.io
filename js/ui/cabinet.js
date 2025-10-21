// js/ui/cabinet.js
(async function () {
  const { supabase } = globalThis.App;

  async function loadCabinetList() {
    const container = document.getElementById("cabinet-list-container");
    const status = document.getElementById("status-message-list");
    try {
      status.textContent = "시약장 목록 불러오는 중...";
      const { data, error } = await supabase
        .from("Cabinet")
        .select(`
          id,
          name,
          area_id ( id, name ),
          door_vertical_count,
          door_horizontal_count,
          shelf_height,
          storage_columns,
          photo_url_320,
          photo_url_160
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;

      globalThis._cabinetCache = data || [];

      if (!data.length) {
        status.textContent = "등록된 시약장이 없습니다.";
        return;
      }

      container.innerHTML = "";
      data.forEach((cab) => {
        const areaName = cab.area_id?.name || "-";
        const imgUrl = cab.photo_url_320 || "";

        const card = document.createElement("div");
        card.className = "cabinet-card";
        card.setAttribute("data-cabinet-id", cab.id);
        card.innerHTML = `
          <div class="card-image-placeholder">
            ${imgUrl ? `<img src="${imgUrl}" alt="${cab.name}">` : "사진 없음"}
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
        container.appendChild(card);
      });

      container.onclick = (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const id = Number(btn.dataset.id);
        if (btn.classList.contains("edit-btn")) editCabinet(id);
        if (btn.classList.contains("delete-btn")) deleteCabinet(id);
      };

      status.textContent = "";
    } catch (err) {
      console.error("시약장 불러오기 오류:", err);
      status.textContent = "오류가 발생했습니다.";
    }
  }

  // ✅ Promise 기반 수정
  async function editCabinet(id) {
    try {
      let cab =
        (globalThis._cabinetCache || []).find((c) => c.id === id) || null;

      if (!cab) {
        const { data, error } = await supabase
          .from("Cabinet")
          .select(`*, area_id (id, name)`)
          .eq("id", id)
          .single();
        if (error) throw error;
        cab = data;
      }

      // ✅ 폼 완전히 로드될 때까지 기다림
      await includeHTML("pages/cabinet-form.html", "form-container");

      setupCabinetRegisterForm?.();

      // ✅ 이후 DOM 조작 안전
      const preview = document.getElementById("cabinet-photo-preview");
      preview.innerHTML = cab.photo_url_320
        ? `<img src="${cab.photo_url_320}" alt="Cabinet photo">`
        : `<span>사진 없음</span>`;

      document.querySelector("#cabinet-creation-form h2").textContent =
        "시약장 정보 수정";
      document.getElementById("cabinet-submit-button").textContent = "수정 내용 저장";

    } catch (err) {
      console.error(err);
      alert(err.message || "시약장 정보를 불러오지 못했습니다.");
    }
  }

  async function deleteCabinet(id) {
    if (!confirm("정말로 삭제하시겠어요?")) return;
    try {
      await App.API.callEdge(`${App.API.EDGE.CABINET}?id=${id}`, { method: "DELETE" });
      await loadCabinetList();
    } catch (e) {
      alert(e.message || "삭제 실패");
    }
  }

  globalThis.loadCabinetList = loadCabinetList;
  globalThis.editCabinet = editCabinet;
  globalThis.deleteCabinet = deleteCabinet;
})();
