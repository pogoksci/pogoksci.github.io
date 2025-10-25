// ================================================================
// /js/ui/cabinet.js — DB CRUD / 목록 관리
// ================================================================
(function () {
  const { supabase, includeHTML } = App;
  const { sleep } = App.Utils;

  async function loadList() {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const container = document.getElementById("cabinet-list-container");
    const status = document.getElementById("status-message-list");

    if (!container || !status) {
      if (retryCount < 3) {
        setTimeout(() => loadList(retryCount + 1), 100);
        return;
      }
    }

    try {
      const { data, error } = await supabase
        .from("Cabinet")
        .select("id,name,area_id(id,name),door_vertical_count,door_horizontal_count,shelf_height,storage_columns,photo_url_320,photo_url_160")
        .order("id", { ascending: true });

      if (error) throw error;
      if (!data.length) return (status.textContent = "등록된 시약장이 없습니다.");
      status.style.display = "none";
      container.innerHTML = data
        .map(
          (cab) => `
        <div class="cabinet-card">
          <div class="card-image-placeholder">
            ${
              cab.photo_url_320
                ? `<img src="${cab.photo_url_320}" alt="${cab.name}" style="width:100%;height:100%;object-fit:cover;">`
                : "사진 없음"
            }
          </div>
          <div class="card-info">
            <h3>${cab.name}</h3>
            <span>${cab.area_id?.name || "위치 없음"}</span>
            <p>상하:${cab.door_vertical_count||"-"}, 좌우:${cab.door_horizontal_count||"-"}, 층:${cab.shelf_height||"-"}, 열:${cab.storage_columns||"-"}</p>
          </div>
          <div class="card-actions">
            <button onclick="App.Cabinet.edit(${cab.id})">수정</button>
            <button onclick="App.Cabinet.delete(${cab.id})">삭제</button>
          </div>
        </div>`
        )
        .join("");
    } catch (err) {
      status.textContent = "시약장 목록을 불러올 수 없습니다.";
      console.error(err);
    }
  }

  async function edit(id) {
    const { data, error } = await supabase
      .from("Cabinet")
      .select("id,name,area_id(id,name),photo_url_320,photo_url_160,door_vertical_count,door_horizontal_count,shelf_height,storage_columns")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return alert("불러오기 실패");

    await includeHTML("pages/cabinet-form.html", "form-container");
    await sleep(50);
    App.Forms.initCabinetForm("edit", data);
  }

  async function createCabinet(payload) {
    const { error } = await supabase.from("Cabinet").insert([payload]);
    if (error) throw error;
  }

  async function updateCabinet(id, payload) {
    const { error } = await supabase.from("Cabinet").update(payload).eq("id", id);
    if (error) throw error;
  }

  async function remove(id) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("Cabinet").delete().eq("id", id);
    if (error) alert("삭제 실패: " + error.message);
    else {
      alert("삭제되었습니다.");
      load();
    }
  }

  globalThis.App = globalThis.App || {};
  globalThis.App.Cabinet = { loadList, edit, createCabinet, updateCabinet, delete: remove };
})();
