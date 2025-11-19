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
  function renderList(mapped, container) {
    if (!mapped.length) {
      container.innerHTML = `
        <p id="status-message-inventory-list" style="padding:0 15px; color:#888;">
          📭 등록된 약품이 없습니다.
        </p>
      `;
      return;
    }

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
            const imageSrc = item.photo_url_320 || item.photo_url_160 || "";
            const concentration = item.concentration_text
              ? `<span class="inventory-card__conc">(${item.concentration_text})</span>`
              : "";
            const imageBlock = imageSrc
              ? `<div class="inventory-card__image">
                   <img src="${imageSrc}" alt="${item.display_label}" />
                 </div>`
              : `<div class="inventory-card__image inventory-card__image--empty">
                   <span class="inventory-card__placeholder">사진 없음</span>
                 </div>`;
            return `
              <div class="inventory-card" data-id="${item.id}">
                ${imageBlock}
                <div class="inventory-card__body">
                  <div class="inventory-card__left">
                    <div class="inventory-card__no">No.${item.id}</div>
                    <div class="inventory-card__name">${item.display_label} ${concentration}</div>
                    <div class="inventory-card__location">${item.location_text}</div>
                  </div>
                  <div class="inventory-card__meta">
                    <div>${item.formula || '-'}</div>
                    <div>${item.current_text}</div>
                    <div>${item.classification}</div>
                  </div>
                </div>
              </div>
            `;
          })
          .join("");

        return header + cards;
      })
      .join("");

    container.innerHTML = sections;

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
    if (!container) {
      console.warn("⚠️ inventory-list 요소를 찾을 수 없습니다.");
      return;
    }

    const showStatus = (message) => {
      container.innerHTML = `
        <p id="status-message-inventory-list" style="padding:0 15px; color:#888;">
          ${message}
        </p>
      `;
    };

    showStatus("🔄 약품 목록을 불러오는 중...");

    const { data, error } = await supabase
      .from("Inventory")
      .select(`
        id, bottle_identifier, current_amount, unit, classification, created_at, photo_url_320, photo_url_160,
        concentration_value, concentration_unit,
        door_vertical, door_horizontal, internal_shelf_level, storage_column,
        Substance ( substance_name, cas_rn, molecular_formula ),
        Cabinet ( cabinet_name, Area ( area_name ) )
      `)
      .order("created_at", { ascending: false });

    console.log("Inventory select result", { count: data?.length ?? 0, error });

    if (error) {
      console.error("❌ 목록 조회 오류:", error);
      showStatus("약품 목록을 불러오지 못했습니다.");
      return;
    }

    const mapped = (data || []).map((row) => {
      const area = row.Cabinet?.Area?.area_name || "";
      const cabinetName = row.Cabinet?.cabinet_name || "";
      const doorVertical = row.door_vertical || "";
      const doorHorizontal = row.door_horizontal || "";
      const shelfLevel = row.internal_shelf_level;
      const column = row.storage_column;

      // 📍 위치 텍스트 포맷팅
      let locationText = "";
      if (area) locationText += area + " ";
      if (cabinetName) locationText += `『${cabinetName}』 `;

      // 도어 정보
      let doorPart = "";
      if (doorVertical && doorHorizontal) {
        doorPart = `${doorVertical}층 ${doorHorizontal}문`;
      } else if (doorVertical) {
        doorPart = `${doorVertical}층문`;
      } else if (doorHorizontal) {
        doorPart = `${doorHorizontal}문`;
      }

      // 선반/열 정보
      let shelfPart = "";
      if (shelfLevel && column) {
        shelfPart = `${shelfLevel}층 ${column}열`;
      } else {
        if (shelfLevel) shelfPart += `${shelfLevel}층`;
        if (column) shelfPart += (shelfPart ? " " : "") + `${column}열`;
      }

      // 최종 조합 (도어, 선반)
      const detailParts = [doorPart, shelfPart].filter(Boolean).join(", ");
      if (detailParts) locationText += detailParts;

      locationText = locationText.trim() || "위치 정보 없음";
      const displayLabel =
        row.Substance?.substance_name ||
        row.Substance?.cas_rn ||
        `Inventory #${row.id}`;

      const concentrationValue = row.concentration_value;
      const concentrationUnit = row.concentration_unit || "";
      const concentrationText =
        concentrationValue != null && concentrationValue !== ""
          ? `${concentrationValue}${concentrationUnit}`
          : "";

      const currentText =
        row.current_amount != null
          ? `${row.current_amount}${row.unit || ""}`
          : "-";

      return {
        id: row.id,
        created_at: row.created_at,
        current_amount: row.current_amount,
        unit: row.unit,
        classification: row.classification || "기타",
        photo_url_320: row.photo_url_320 || null,
        photo_url_160: row.photo_url_160 || null,
        display_label: displayLabel,
        location_text: locationText,
        formula: row.Substance?.molecular_formula || "-",
        current_text: currentText,
        concentration_text: concentrationText,
      };
    });

    const sorted = sortData(mapped, currentSort);
    renderList(sorted, container);
  }

  async function showListPage() {
    const app = getApp();
    const inventoryApi = app.Inventory || {};
    inventoryApi.__manualMount = true;
    app.Inventory = inventoryApi;

    const ok = await app.includeHTML?.("pages/inventory-list.html", "form-container");
    if (!ok) return;

    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );

    bindListPage();
    app.SortDropdown?.init?.({
      onChange: (value) => {
        currentSort = value || "category_name_kor";
        loadList();
      },
      onRefresh: () => loadList(),
      defaultLabel: "한글 분류",
      defaultValue: currentSort,
    });

    await loadList();
    app.Fab?.setVisibility?.(false);
    delete app.Inventory.__manualMount;
  }

  async function purgeSubstanceIfUnused(substanceId) {
    const supabase = getSupabase();
    if (!supabase || !substanceId) return;

    const { count, error } = await supabase
      .from("Inventory")
      .select("id", { count: "exact", head: true })
      .eq("substance_id", substanceId);

    if (error) {
      console.error("❌ 재고 수량 확인 실패:", error);
      return;
    }

    if ((count ?? 0) > 0) return;

    const relatedTables = [
      "MSDS",
      "HazardClassifications",
      "Synonyms",
      "Properties",
      "ReplacedRns",
      "Citations",
    ];

    for (const table of relatedTables) {
      const { error: relError } = await supabase
        .from(table)
        .delete()
        .eq("substance_id", substanceId);
      if (relError) {
        console.warn(`⚠️ ${table} 정리 실패:`, relError);
      }
    }

    const { error: subError } = await supabase.from("Substance").delete().eq("id", substanceId);
    if (subError) {
      console.warn("⚠️ Substance 삭제 실패:", subError);
    }
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

    const ok = await App.includeHTML("pages/inventory-detail.html", "form-container");
    if (!ok) return;

    const detailContainer = document.getElementById("detail-page-container");
    if (!detailContainer) {
      console.warn("⚠️ detail-page-container를 찾을 수 없습니다.");
      return;
    }

    const { data, error } = await supabase
      .from("Inventory")
      .select(`
        id, substance_id, cabinet_id, initial_amount, current_amount, unit, classification, concentration_value, concentration_unit,
        purchase_date, created_at, photo_url_320, photo_url_160,
        state, manufacturer,
        door_vertical, door_horizontal, internal_shelf_level, storage_column,
        Substance ( substance_name, cas_rn, molecular_formula ),
        Cabinet ( id, area_id, cabinet_name, Area ( id, area_name ) )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      console.error("❌ 상세 조회 실패:", error);
      detailContainer.innerHTML = `<p>상세 정보를 불러오지 못했습니다.</p>`;
      return;
    }

    const info = data;
    const substanceId = info.substance_id || null;
    const area = info.Cabinet?.Area?.area_name || "";
    const cab = info.Cabinet?.cabinet_name || "";
    const doorV = info.door_vertical ? `${info.door_vertical}층문` : "";
    const doorH = info.door_horizontal ? `${info.door_horizontal}문` : "";
    const shelf = info.internal_shelf_level != null ? `${info.internal_shelf_level}층` : "";
    const column = info.storage_column != null ? `${info.storage_column}열` : "";
    const locationText = [area, cab, doorV, doorH, shelf, column].filter(Boolean).join(" · ") || "위치 정보 없음";

    const photoWrapper = document.getElementById("detail-photo");
    const photoUrl = info.photo_url_320 || info.photo_url_160 || "";
    if (photoWrapper) {
      photoWrapper.innerHTML = photoUrl
        ? `<img src="${photoUrl}" alt="약품 이미지">`
        : `<span>사진 없음</span>`;
    }

    const setText = (elId, text) => {
      const el = document.getElementById(elId);
      if (el) el.textContent = text;
    };

    setText("detail-name", info.Substance?.substance_name || "(이름 없음)");
    setText("detail-cas", `CAS: ${info.Substance?.cas_rn || "-"}`);
    setText("detail-formula", info.Substance?.molecular_formula || "-");
    setText("detail-class", info.classification || "-");
    setText("detail-state", info.state || "-");
    setText("detail-manufacturer", info.manufacturer || "-");
    const quantityText =
      info.current_amount != null ? `${info.current_amount}${info.unit || ""}` : "-";
    setText("detail-quantity", quantityText);
    setText("detail-location", locationText);
    setText(
      "detail-created-at",
      info.created_at ? new Date(info.created_at).toLocaleDateString() : "-"
    );

    const backBtn = document.getElementById("detail-back-btn");
    if (backBtn) {
      backBtn.onclick = () => App.Inventory?.showListPage?.();
    }

    const editBtn = document.getElementById("edit-inventory-btn");
    if (editBtn) {
      editBtn.onclick = async () => {
        const ok = await App.includeHTML("pages/inventory-form.html", "form-container");
        if (ok) {
          App.Forms?.initInventoryForm?.("edit", info);
        }
      };
    }

    const deleteBtn = document.getElementById("delete-inventory-btn");
    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        deleteBtn.disabled = true;
        try {
          const { error: delError } = await supabase.from("Inventory").delete().eq("id", id);
          if (delError) throw delError;

          if (substanceId) {
            await purgeSubstanceIfUnused(substanceId);
          }

          alert("삭제되었습니다.");
          App.Inventory?.showListPage?.();
        } catch (err) {
          console.error("❌ 삭제 실패:", err);
          alert("삭제 중 오류가 발생했습니다.");
          deleteBtn.disabled = false;
        }
      };
    }
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
    showListPage,
    loadList,
    bindListPage,
    loadDetail,
    createInventory,
    updateInventory,
    deleteInventory,
  };
})();
