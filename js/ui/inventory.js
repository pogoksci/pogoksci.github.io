// ================================================================
// /js/ui/inventory.js — 약품(Inventory) 목록 + 정렬 + 상세 + CRUD
// ================================================================
(function () {
  console.log("📦 App.Inventory 모듈 로드됨");

  // ------------------------------------------------------------
  // 공용 헬퍼
  // ------------------------------------------------------------
  const getApp = () => globalThis.App || {};
  const getSupabase = () => getApp().supabase;
  let currentSort = "category_name_kor"; // 기본 정렬: 분류별 가나다순

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
          </div>`;
      })
      .join("");

    // ✅ 상세 보기
    container.querySelectorAll(".detail-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        console.log(`🔍 상세 보기 클릭: ID=${id}`);
        await App.Inventory.loadDetail(id);
      });
    });

    // ✅ 수정
    container.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        console.log(`✏️ 수정 클릭: ID=${id}`);
        const supabase = getSupabase();
        const { data } = await supabase.from("Inventory").select("*").eq("id", id).maybeSingle();
        const ok = await App.includeHTML("pages/inventory-form.html", "form-container");
        if (ok) App.Forms?.initInventoryForm?.("edit", data);
      });
    });

    // ✅ 삭제
    container.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        if (!confirm("정말 삭제하시겠습니까?")) return;
        try {
          const supabase = getSupabase();
          const { error } = await supabase.from("Inventory").delete().eq("id", id);
          if (error) throw error;
          alert("✅ 삭제되었습니다.");
          loadList();
        } catch (err) {
          console.error("❌ 삭제 오류:", err);
          alert("삭제 중 오류가 발생했습니다.");
        }
      });
    });
  }

  // ------------------------------------------------------------
  // 3️⃣ 목록 불러오기
  // ------------------------------------------------------------
  async function loadList() {
    const supabase = getSupabase();
    if (!supabase) return console.error("❌ App.supabase가 초기화되지 않았습니다.");

    const container = document.getElementById("inventory-list-container");
    const status = document.getElementById("status-message-inventory-list");
    if (!container || !status) return console.warn("⚠️ inventory-list 요소를 찾을 수 없습니다.");

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
      const shelf = row.internal_shelf_level ? `${row.internal_shelf_level}층` : "";
      const col = row.storage_column ? `${row.storage_column}열` : "";
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
  // 4️⃣ 상세 보기 (템플릿 유지형)
  // ------------------------------------------------------------
  async function loadDetail(id) {
    const supabase = getSupabase();
    if (!supabase) return console.error("❌ Supabase 인스턴스 없음");

    const ok = await App.includeHTML("pages/inventory-detail.html", "form-container");
    if (!ok) return;

    const { data, error } = await supabase
      .from("Inventory")
      .select(`
        id, current_amount, unit, classification, created_at, photo_url_320, msds_pdf_url,
        door_vertical, door_horizontal, internal_shelf_level, storage_column,
        Substance ( name, cas_rn, molecular_formula, molecular_weight ),
        Cabinet ( name, Area ( name ) ),
        MSDS ( section_title, section_content ),
        HazardClassifications ( category, description )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      console.error("❌ 상세 정보 로드 실패:", error);
      document.getElementById("form-container").innerHTML = `<p>상세 정보를 불러오지 못했습니다.</p>`;
      return;
    }

    document.getElementById("detail-name").textContent = data.Substance?.name || "이름 없음";
    document.getElementById("detail-cas").textContent = `CAS: ${data.Substance?.cas_rn || "-"}`;
    document.getElementById("detail-location").textContent = `보관 위치: ${data.Cabinet?.Area?.name || "-"} · ${data.Cabinet?.name || "-"}`;

    const photoBox = document.getElementById("detail-photo");
    photoBox.innerHTML = data.photo_url_320
      ? `<img src="${data.photo_url_320}" alt="시약사진">`
      : `<span>사진 없음</span>`;

    const msdsBtn = document.getElementById("msds-pdf-btn");
    const noMsds = document.getElementById("no-msds-pdf");
    if (data.msds_pdf_url) {
      msdsBtn.style.display = "block";
      msdsBtn.onclick = () => globalThis.open(data.msds_pdf_url, "_blank");
    } else {
      noMsds.style.display = "block";
    }

    const msdsAcc = document.getElementById("msds-accordion");
    if (data.MSDS?.length > 0) {
      msdsAcc.innerHTML = data.MSDS.map(
        (m) => `
        <div class="accordion-item">
          <button class="accordion-header">${m.section_title || "무제"}</button>
          <div class="accordion-body">${m.section_content || "내용 없음"}</div>
        </div>`
      ).join("");
    } else {
      msdsAcc.innerHTML = `<p>등록된 MSDS 정보가 없습니다.</p>`;
    }

    const hazardContainer = document.getElementById("hazard-info-container");
    if (data.HazardClassifications?.length) {
      hazardContainer.innerHTML = data.HazardClassifications.map(
        (h) => `<p><strong>${h.category}</strong> - ${h.description}</p>`
      ).join("");
    } else {
      hazardContainer.innerHTML = `<p>등록된 분류 정보가 없습니다.</p>`;
    }

    document.getElementById("edit-inventory-btn").onclick = async () => {
      await App.includeHTML("pages/inventory-form.html", "form-container");
      App.Forms?.initInventoryForm?.("edit", data);
    };

    document.getElementById("delete-inventory-btn").onclick = async () => {
      if (confirm("정말 삭제하시겠습니까?")) {
        await deleteInventory(data.id);
        alert("삭제되었습니다.");
        await App.includeHTML("pages/inventory-list.html", "form-container");
        await loadList();
      }
    };
  }

  // ------------------------------------------------------------
  // 5️⃣ CRUD
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
  // 6️⃣ 목록 페이지 바인딩
  // ------------------------------------------------------------
  function bindListPage() {
    console.log("🧭 bindListPage() 실행됨");

    const refreshBtn = document.getElementById("refresh-btn");
    if (refreshBtn) refreshBtn.onclick = () => loadList();

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
        if (ok) App.Forms?.initInventoryForm?.("create", null);
      };
    }
  }

  // ------------------------------------------------------------
  // 7️⃣ 전역 등록
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

  console.log("✅ App.Inventory 모듈 초기화 완료");
})();
