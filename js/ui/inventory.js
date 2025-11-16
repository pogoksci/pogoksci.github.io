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
  let awaitingListDom = false;


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



    const grouped = mapped.reduce((acc, item) => {

      const key = item.classification || "기타";

      if (!acc[key]) acc[key] = [];

      acc[key].push(item);

      return acc;

    }, {});



    const sections = Object.entries(grouped)

      .sort(([a], [b]) => a.localeCompare(b, "ko"))

      .map(([classification, items]) => {

        const header = `

          <div class="inventory-section-header">

            <span class="section-title">${classification}</span>

            <span class="section-count">${items.length}</span>

          </div>`;



        const cards = items

          .map((item) => {

            const img = item.photo_url_320 || "/img/no-image.png";

            return `

              <div class="inventory-card" data-id="${item.id}">

                <div class="inventory-card__image">

                  <img src="${img}" alt="${item.display_label}" />

                </div>

                <div class="inventory-card__body">

                  <div class="inventory-card__title-row">

                    <span class="material-symbols-outlined tag-icon">sell</span>
                    <div class="inventory-card__title-text">&#12304; ${item.display_label} &#12305; ${item.display_code}</div>
                  </div>

                  <div class="inventory-card__location">${item.location_text}</div>

                </div>

                <div class="inventory-card__class">${classification}</div>

              </div>

            `;

          })

          .join("");



        return header + cards;

      })

      .join("");



    container.innerHTML = sections;



    container.querySelectorAll(".inventory-card").forEach((card) => {

      const id = Number(card.dataset.id);

      card.addEventListener("click", async () => {

        const ok = await App.includeHTML("pages/inventory-detail.html", "form-container");

        if (ok) App.Inventory?.loadDetail?.(id);

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
      if (!awaitingListDom) {
        awaitingListDom = true;
        await new Promise((resolve) => setTimeout(resolve, 60));
        awaitingListDom = false;
        return loadList();
      }
      return;
    }

    status.textContent = "🔄 약품 목록을 불러오는 중...";

    const { data, error } = await supabase
      .from("Inventory")
      .select(`
        id, bottle_identifier, current_amount, unit, classification, created_at, photo_url_320,
        door_vertical, door_horizontal, internal_shelf_level, storage_column,
        Substance ( substance_name, cas_rn, molecular_formula ),
        Cabinet ( cabinet_name, Area ( area_name ) )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ 목록 조회 오류:", error);
      status.textContent = "약품 목록을 불러오지 못했습니다.";
      return;
    }

    const mapped = (data || []).map((row) => {
      const area = row.Cabinet?.Area?.area_name || "";
      const cabinetName = row.Cabinet?.cabinet_name || "";
      const doorVertical = row.door_vertical || "";
      const doorHorizontal = row.door_horizontal || "";
      const shelfLevel = row.internal_shelf_level;
      const column = row.storage_column;

      const locationPieces = [];
      if (cabinetName) locationPieces.push(`『${cabinetName}』`);

      const detailParts = [];
      if (doorVertical) detailParts.push(`${doorVertical}층문`);
      if (doorHorizontal) detailParts.push(`${doorHorizontal}문`);
      if (shelfLevel) detailParts.push(`${shelfLevel}층`);
      if (column) detailParts.push(`${column}열`);

      if (detailParts.length) {
        locationPieces.push(detailParts.join(", "));
      } else if (area) {
        locationPieces.push(area);
      }

      const locationText = locationPieces.join(" ") || "위치 정보 없음";
      const displayLabel =
        row.Substance?.substance_name ||
        row.Substance?.cas_rn ||
        `Inventory #${row.id}`;
      const displayCode = row.bottle_identifier
        ? `No.${row.bottle_identifier}`
        : `ID ${row.id}`;

      return {
        id: row.id,
        created_at: row.created_at,
        current_amount: row.current_amount,
        unit: row.unit,
        classification: row.classification || "기타",
        photo_url_320: row.photo_url_320 || null,
        display_label: displayLabel,
        display_code: displayCode,
        location_text: locationText,
        name_kor: displayLabel,
        name_eng: row.Substance?.cas_rn || "",
        formula: row.Substance?.molecular_formula || "",
        storage_location: locationText,
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
        Substance ( substance_name, cas_rn, molecular_formula, molecular_weight ),
        Cabinet ( cabinet_name, Area ( area_name ) )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      console.error("❌ 상세 조회 실패:", error);
      container.innerHTML = `<p>상세 정보를 불러오지 못했습니다.</p>`;
      return;
    }

    const info = data;
    const area = info.Cabinet?.Area?.area_name || "-";
    const cab = info.Cabinet?.cabinet_name || "-";
    const photo = info.photo_url_320 || "/img/no-image.png";

    container.innerHTML = `
      <div class="inventory-detail">
        <div class="detail-header">
          <h2>${info.Substance?.substance_name || "(이름 없음)"}</h2>
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
