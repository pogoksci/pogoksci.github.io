// ================================================================
// /js/ui/inventory.js — 약품(Inventory) 목록 + 정렬 + 버튼 바인딩
// ================================================================
(function () {
  console.log("📦 App.Inventory 모듈 로드됨");

  // ------------------------------------------------------------
  // 공용 헬퍼
  // ------------------------------------------------------------
  const getApp = () => globalThis.App || {};
  const getSupabase = () => getApp().supabase; // ✅ App.supabase 인스턴스 사용
  let currentSort = "category_name_kor"; // 기본 정렬: 한글순(분류)

  // ------------------------------------------------------------
  // 1️⃣ 정렬 함수
  // ------------------------------------------------------------
  function sortData(rows, key) {
    const collateKo = (a, b) => String(a || "").localeCompare(String(b || ""), "ko");
    const collateEn = (a, b) => String(a || "").localeCompare(String(b || ""), "en", { sensitivity: "base" });

    switch (key) {
      case "category_name_kor":
        return rows.sort((a, b) => collateKo(a.classification, b.classification) || collateKo(a.name_kor, b.name_kor));
      case "name_kor":
        return rows.sort((a, b) => collateKo(a.name_kor, b.name_kor));
      case "name_eng":
        return rows.sort((a, b) => collateEn(a.name_eng, b.name_eng));
      case "formula":
        return rows.sort((a, b) => collateEn(a.formula, b.formula));
      case "storage_location":
        return rows.sort((a, b) => collateKo(a.storage_location, b.storage_location));
      case "quantity_desc":
        return rows.sort((a, b) => (b.current_amount ?? 0) - (a.current_amount ?? 0));
      case "created_at_desc":
      default:
        return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  }

  // ------------------------------------------------------------
  // 2️⃣ 목록 렌더링
  // ------------------------------------------------------------
  function renderList(mapped, container, status) {
    if (!mapped.length) {
      status.textContent = "📭 등록된 약품이 없습니다.";
      container.innerHTML = "";
      return;
    }
    status.textContent = "";
    container.innerHTML = mapped
      .map((it) => {
        const img = it.photo_url_320 || "/img/no-image.png";
        return `
          <div class="inventory-card" data-id="${it.id}">
            <div class="card-image-placeholder">
              <img class="card-image" src="${img}" alt="${it.name_kor || it.cas_rn}" />
            </div>
            <div class="card-info">
              <h3>${it.name_kor || "-"}</h3>
              <p class="area-name">${it.storage_location || "위치: 미지정"}</p>
              <p class="cabinet-specs">
                재고: ${it.current_amount ?? 0}${it.unit || ""} · ${new Date(it.created_at).toLocaleDateString()}
              </p>
            </div>
            <div class="card-actions">
              <button class="detail-btn" data-id="${it.id}">상세</button>
              <button class="edit-btn" data-id="${it.id}">수정</button>
              <button class="delete-btn" data-id="${it.id}">삭제</button>
            </div>
          </div>
        `;
      })
      .join("");

    // ✅ 각 카드 버튼 이벤트
    container.querySelectorAll(".detail-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        console.log(`🔍 상세 보기 클릭: ID=${id}`);
        const ok = await App.includeHTML("pages/inventory-detail.html", "form-container");
        if (ok) App.Inventory?.loadDetail?.(id);
      });
    });

    container.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        console.log(`✏️ 수정 클릭: ID=${id}`);
        const ok = await App.includeHTML("pages/inventory-form.html", "form-container");
        if (ok) App.Forms?.initInventoryForm?.("edit", { id });
      });
    });

    container.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        if (!confirm("정말 삭제하시겠습니까?")) return;
        try {
          const supabase = getSupabase();
          if (!supabase) throw new Error("Supabase 인스턴스 없음");
          const { error } = await supabase.from("Inventory").delete().eq("id", id);
          if (error) throw error;
          alert("✅ 삭제되었습니다.");
          loadList();
        } catch (err) {
          console.error("❌ 삭제 오류:", err);
          alert("삭제 중 오류 발생");
        }
      });
    });
  }

  // ------------------------------------------------------------
  // 3️⃣ 목록 불러오기
  // ------------------------------------------------------------
  async function loadList() {
    const supabase = getSupabase();
    if (!supabase) {
      console.error("❌ App.supabase가 초기화되지 않았습니다.");
      return;
    }

    const container = document.getElementById("inventory-list-container");
    const status = document.getElementById("status-message-inventory-list");

    if (!container || !status) {
      console.warn("⚠️ inventory-list 요소를 찾을 수 없습니다.");
      return;
    }

    status.textContent = "🔄 약품 목록을 불러오는 중...";

    const { data, error } = await supabase
      .from("Inventory")
      .select(`
        id, current_amount, unit, classification, created_at, photo_url_320,
        door_vertical, door_horizontal, internal_shelf_level, storage_column,
        Substance ( name, cas_rn, molecular_formula ),
        Cabinet ( name, Area ( name ) )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ 목록 조회 오류:", error);
      status.textContent = "약품 목록을 불러오지 못했습니다.";
      return;
    }

    const mapped = (data || []).map((row) => {
      const area = row.Cabinet?.Area?.name || "";
      const cab = row.Cabinet?.name || "";
      const v = row.door_vertical || "";
      const h = row.door_horizontal || "";
      const shelf =
        row.internal_shelf_level != null ? `${row.internal_shelf_level}층` : "";
      const col =
        row.storage_column != null ? `${row.storage_column}열` : "";
      const loc = [area, cab, v, h, shelf, col].filter(Boolean).join(" · ");

      return {
        id: row.id,
        created_at: row.created_at,
        current_amount: row.current_amount,
        unit: row.unit,
        classification: row.classification || "",
        photo_url_320: row.photo_url_320 || null,
        name_kor: row.Substance?.name || "",
        name_eng: "",
        cas_rn: row.Substance?.cas_rn || "",
        formula: row.Substance?.molecular_formula || "",
        storage_location: loc,
      };
    });

    const sorted = sortData(mapped, currentSort);
    renderList(sorted, container, status);
  }

  // ------------------------------------------------------------
  // 4️⃣ 상세 보기
  // ------------------------------------------------------------
  async function loadDetail(id) {
    const supabase = getSupabase();
    if (!supabase) {
      console.error("❌ Supabase 인스턴스가 없습니다.");
      return;
    }

    const container = document.getElementById("form-container");
    const ok = await App.includeHTML("pages/inventory-detail.html", "form-container");
    if (!ok) return;

    const { data, error } = await supabase
      .from("Inventory")
      .select(`
        id, current_amount, unit, classification, created_at, photo_url_320,
        door_vertical, door_horizontal, internal_shelf_level, storage_column,
        Substance ( name, cas_rn, molecular_formula, molecular_weight ),
        Cabinet ( name, Area ( name ) )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      console.error("❌ 상세 조회 실패:", error);
      container.innerHTML = `<p>상세 정보를 불러오지 못했습니다.</p>`;
      return;
    }

    const info = data;
    const area = info.Cabinet?.Area?.name || "-";
    const cab = info.Cabinet?.name || "-";
    const photo = info.photo_url_320 || "/img/no-image.png";

    container.innerHTML = `
      <div class="inventory-detail">
        <div class="detail-header">
          <h2>${info.Substance?.name || "(이름 없음)"}</h2>
          <p>CAS: ${info.Substance?.cas_rn || "-"}</p>
        </div>
        <div class="detail-body">
          <img src="${photo}" alt="약품 이미지" class="detail-photo">
          <ul>
            <li><strong>화학식:</strong> ${info.Substance?.molecular_formula || "-"}</li>
            <li><strong>분자량:</strong> ${info.Substance?.molecular_weight || "-"}</li>
            <li><strong>분류:</strong> ${info.classification || "-"}</li>
            <li><strong>재고:</strong> ${info.current_amount ?? 0}${info.unit || ""}</li>
            <li><strong>보관 위치:</strong> ${area} · ${cab}</li>
            <li><strong>등록일:</strong> ${new Date(info.created_at).toLocaleDateString()}</li>
          </ul>
        </div>
        <div class="detail-actions">
          <button id="detail-edit-btn">수정</button>
          <button id="detail-back-btn">목록으로</button>
        </div>
      </div>
    `;
  }

  // ------------------------------------------------------------
  // 5️⃣ CRUD 기본 함수
  // ------------------------------------------------------------
  async function createInventory(payload) {
    const supabase = getSupabase();
    const { error } = await supabase.from("Inventory").insert(payload);
    if (error) throw error;
  }

  async function updateInventory(id, payload) {
    const supabase = getSupabase();
    const { error } = await supabase.from("Inventory").update(payload).eq("id", id);
    if (error) throw error;
  }

  async function deleteInventory(id) {
    const supabase = getSupabase();
    const { error } = await supabase.from("Inventory").delete().eq("id", id);
    if (error) alert("삭제 중 오류가 발생했습니다.");
  }

  // ------------------------------------------------------------
  // 6️⃣ 정렬 & 버튼 UI
  // ------------------------------------------------------------
  function setupSortUI() {
    const select = document.getElementById("sort-select");
    if (!select) return;
    select.addEventListener("change", () => {
      currentSort = select.value;
      loadList();
    });
  }

  function bindListPage() {
    console.log("🧭 bindListPage() 실행됨");

    const refreshBtn = document.getElementById("refresh-btn");
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        console.log("🔄 목록 새로고침");
        loadList();
      };
    }

    const sortSelect = document.getElementById("sort-select");
    if (sortSelect) {
      sortSelect.onchange = () => {
        currentSort = sortSelect.value;
        loadList();
      };
    }

    const newBtn = document.getElementById("new-inventory-btn");
    if (newBtn) {
      newBtn.onclick = async () => {
        console.log("🧾 새 약품 등록 버튼 클릭됨");
        const ok = await App.includeHTML("pages/inventory-form.html", "form-container");
        if (ok) {
          console.log("📄 inventory-form.html 로드 완료 → 폼 초기화 시작");
          App.Forms?.initInventoryForm?.("create", null);
        } else {
          console.error("❌ inventory-form.html 로드 실패");
        }
      };
    }
  }

  // ------------------------------------------------------------
  // 8️⃣ 전역 등록
  // ------------------------------------------------------------
  globalThis.App = getApp();
  globalThis.App.Inventory = {
    loadList,
    bindListPage,
    loadDetail,
    createInventory,
    updateInventory,
    deleteInventory,
  };
})();
