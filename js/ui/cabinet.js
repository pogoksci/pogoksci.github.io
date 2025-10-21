// js/ui/cabinet.js
(function () {
  const { supabase } = globalThis.App;
  // callEdge, EDGE는 아직 사용 안 하므로 _ 접두사로 무시 처리
  const { callEdge: _callEdge, EDGE: _EDGE } = globalThis.App.API;

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
          area_id ( id, name ),
          photo_url_160
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        status.textContent = "등록된 시약장이 없습니다.";
        return;
      }

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
  // 시약장 수정 기능
  // ====================================================================
  async function editCabinet(id) {
    try {
      const { data, error } = await supabase
        .from("Cabinet")
        .select(`
          id,
          name,
          area_id ( id, name ),
          door_vertical_split,
          door_horizontal_split,
          shelf_height,
          storage_columns,
          photo_url_160
        `)
        .eq("id", id)
        .single();

      if (error || !data) throw error || new Error("시약장 정보를 찾을 수 없습니다.");

      await includeHTML("pages/cabinet-form.html");

      document.querySelector("h2").textContent = "시약장 수정";
      const submitBtn = document.getElementById("cabinet-submit-button");
      submitBtn.textContent = "수정 저장";

      setActiveButton("location_type_buttons", data.area_id?.name);
      setActiveButton("cabinet_name_buttons", data.name);
      setActiveButton("door_vertical_split_buttons", data.door_vertical_split);
      setActiveButton("door_horizontal_split_buttons", data.door_horizontal_split);
      setActiveButton("shelf_height_buttons", String(data.shelf_height));
      setActiveButton("storage_columns_buttons", String(data.storage_columns));

      const preview = document.getElementById("cabinet-photo-preview");
      if (data.photo_url_160 && preview) {
        preview.innerHTML = `<img src="${data.photo_url_160}" style="width:100%;height:100%;object-fit:cover;">`;
      }

      submitBtn.onclick = async (event) => {
        event.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = "수정 중...";

        try {
          const updated = {
            name: getActiveButtonValue("cabinet_name_buttons"),
            door_vertical_split: getActiveButtonValue("door_vertical_split_buttons"),
            door_horizontal_split: getActiveButtonValue("door_horizontal_split_buttons"),
            shelf_height: parseInt(getActiveButtonValue("shelf_height_buttons")),
            storage_columns: parseInt(getActiveButtonValue("storage_columns_buttons")),
          };

          const { error: updateError } = await supabase
            .from("Cabinet")
            .update(updated)
            .eq("id", id);

          if (updateError) throw updateError;

          alert("✅ 시약장 정보가 수정되었습니다!");
          loadCabinetList();
        } catch (err) {
          console.error("수정 중 오류:", err);
          alert("❌ 수정 중 오류가 발생했습니다.");
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "시약장 수정";
        }
      };
    } catch (err) {
      console.error("시약장 수정 로드 오류:", err);
      alert("시약장 정보를 불러오지 못했습니다.");
    }
  }

  // ====================================================================
  // 삭제 기능
  // ====================================================================
  async function deleteCabinet(id) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      const { error } = await supabase.from("Cabinet").delete().eq("id", id);
      if (error) throw error;
      alert("🗑️ 시약장이 삭제되었습니다.");
      loadCabinetList();
    } catch (err) {
      console.error("시약장 삭제 오류:", err);
      alert("❌ 삭제 중 오류가 발생했습니다.");
    }
  }

  // ====================================================================
  // 내부 유틸
  // ====================================================================
  function setActiveButton(groupId, value) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll("button").forEach((b) => {
      if (b.dataset.value === value) b.classList.add("active");
    });
  }

  function getActiveButtonValue(groupId) {
    const group = document.getElementById(groupId);
    const active = group?.querySelector("button.active");
    return active ? active.dataset.value : null;
  }

  // 🔄 Deno 호환: window 대신 globalThis
  globalThis.loadCabinetList = loadCabinetList;
  globalThis.editCabinet = editCabinet;
  globalThis.deleteCabinet = deleteCabinet;
})();
