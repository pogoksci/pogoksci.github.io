// ================================================================
// /js/ui/inventory.js — 약품(Inventory) 관리 모듈
// ================================================================
(function () {
  const { supabase } = App;

  // 목록
  async function loadList() {
    console.log("📦 App.Inventory.loadList()");
    const container = document.getElementById("inventory-list-container");
    const status = document.getElementById("status-message-inventory");

    try {
      const { data, error } = await supabase
        .from("Inventory")
        .select("id, name, cas_number, quantity, storage_location, created_at")
        .order("id", { ascending: false });

      if (error) throw error;
      if (!data.length) return (status.textContent = "등록된 약품이 없습니다.");

      status.style.display = "none";
      container.innerHTML = data
        .map(
          (item) => `
          <div class="inventory-card">
            <h3>${item.name}</h3>
            <p>CAS: ${item.cas_number || "-"}</p>
            <p>수량: ${item.quantity || 0}</p>
            <p>보관: ${item.storage_location || "-"}</p>
            <div class="card-actions">
              <button onclick="App.Inventory.edit(${item.id})">수정</button>
              <button onclick="App.Inventory.delete(${item.id})">삭제</button>
            </div>
          </div>`
        )
        .join("");
    } catch (err) {
      console.error("❌ Inventory 목록 불러오기 실패:", err);
      status.textContent = "약품 목록을 불러오지 못했습니다.";
    }
  }

  // 수정
  async function edit(id) {
    try {
      const { data, error } = await supabase
        .from("Inventory")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) throw error;

      await App.Router.go("addInventory", "form-container", () =>
        App.Forms.initInventoryForm("edit", data)
      );
    } catch (err) {
      console.error("❌ Inventory 수정 로드 실패:", err);
      alert("약품 정보를 불러오지 못했습니다.");
    }
  }

  // 등록
  async function create(payload) {
    const { error } = await supabase.from("Inventory").insert([payload]);
    if (error) throw error;
  }

  // 수정
  async function update(id, payload) {
    const { error } = await supabase.from("Inventory").update(payload).eq("id", id);
    if (error) throw error;
  }

  // 삭제
  async function remove(id) {
    if (!confirm("삭제하시겠습니까?")) return;
    const { error } = await supabase.from("Inventory").delete().eq("id", id);
    if (error) alert("삭제 실패");
    else {
      alert("삭제되었습니다.");
      loadList();
    }
  }

  globalThis.App = globalThis.App || {};
  globalThis.App.Inventory = { loadList, edit, create, update, delete: remove };
})();
