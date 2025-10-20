// js/ui/cabinet.js
(function () {
  const { supabase } = window.App;
  const { callEdge, EDGE } = window.App.API;

  // ====================================================================
  // 시약장 목록 불러오기
  // ====================================================================
  async function loadCabinetList() {
    const container = document.getElementById("cabinet-list-container");
    const status = document.getElementById("status-message-list");
    if (!container || !status) return;

    try {
      status.textContent = "시약장 목록 불러오는 중...";

      const { data, error } = await supabase
        .from("Cabinet")
        .select(`
          id,
          name,
          area_id (
            id,
            name
          ),
          photo_url_160
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        status.textContent = "등록된 시약장이 없습니다.";
        return;
      }

      // 목록 초기화 후 카드 생성
      container.innerHTML = "";
      data.forEach((cab) => {
        const card = document.createElement("div");
        card.className = "cabinet-card";

        const imgUrl = cab.photo_url_160 || "css/logo.png";
        const areaName = cab.area_id?.name || "위치 미상";

        card.innerHTML = `
          <div class="card-image-placeholder">
            <img src="${imgUrl}" alt="${cab.name}" style="width:100%; height:100%; object-fit:cover;">
          </div>
          <div class="card-info">
            <h3>${cab.name}</h3>
            <p class="area-name">${areaName}</p>
          </div>
          <div class="card-actions">
            <button class="edit-btn" onclick="editCabinet(${cab.id})">수정</button>
            <button class="delete-btn" onclick="deleteCabinet(${cab.id})">삭제</button>
          </div>
        `;

        container.appendChild(card);
      });

      status.textContent = "";
    } catch (err) {
      console.error("시약장 불러오기 오류:", err);
      status.textContent = "시약장 정보를 불러오는 중 오류가 발생했습니다.";
    }
  }

  // ====================================================================
  // 수정 및 삭제 함수 (자리만 마련)
  // ====================================================================
  function editCabinet(id) {
    alert(`✏️ 시약장 수정 기능 (ID: ${id}) - 구현 예정`);
  }

  async function deleteCabinet(id) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      const { error } = await supabase.from("Cabinet").delete().eq("id", id);
      if (error) throw error;
      alert("🗑️ 시약장이 삭제되었습니다.");
      loadCabinetList(); // 갱신
    } catch (err) {
      console.error("시약장 삭제 오류:", err);
      alert("❌ 삭제 중 오류가 발생했습니다.");
    }
  }

  // 전역에 연결
  window.loadCabinetList = loadCabinetList;
  window.editCabinet = editCabinet;
  window.deleteCabinet = deleteCabinet;
})();
