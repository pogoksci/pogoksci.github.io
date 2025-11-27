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
  let allInventoryData = []; // ✅ 전체 데이터 저장용 (검색 필터링)


  // ------------------------------------------------------------
  // 1️⃣ 정렬 함수
  // ------------------------------------------------------------
  // ------------------------------------------------------------
  // 1️⃣ 정렬 함수
  // ------------------------------------------------------------
  function sortData(rows, key) {
    const collateKo = (a, b) => String(a || "").localeCompare(String(b || ""), "ko");
    const collateEn = (a, b) => String(a || "").localeCompare(String(b || ""), "en", { sensitivity: "base" });

    switch (key) {
      case "category_name_kor": // 한글명(분류)
        return rows.sort((a, b) => collateKo(a.classification, b.classification) || collateKo(a.name_kor, b.name_kor));
      case "category_name_eng": // 영문명(분류)
        return rows.sort((a, b) => collateKo(a.classification, b.classification) || collateEn(a.name_eng, b.name_eng));
      case "name_kor": // 한글명(전체)
        return rows.sort((a, b) => collateKo(a.name_kor, b.name_kor));
      case "name_eng": // 영문명(전체)
        return rows.sort((a, b) => collateEn(a.name_eng, b.name_eng));
      case "formula": // 화학식
        return rows.sort((a, b) => collateEn(a.formula, b.formula));
      case "storage_location": // 위치
        return rows.sort((a, b) => {
          // Area -> Cabinet -> Location Text 순 정렬
          const locA = (a.Cabinet?.Area?.area_name || "") + (a.Cabinet?.cabinet_name || "") + (a.location_text || "");
          const locB = (b.Cabinet?.Area?.area_name || "") + (b.Cabinet?.cabinet_name || "") + (b.location_text || "");
          return collateKo(locA, locB);
        });
      case "created_at_desc": // 등록순서 (최신순)
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

    // 그룹화 로직 결정
    let grouped = {};
    const isGroupedSort = ["category_name_kor", "category_name_eng", "storage_location"].includes(currentSort);

    if (isGroupedSort) {
      grouped = mapped.reduce((acc, item) => {
        let key = "기타";
        if (currentSort === "storage_location") {
          const area = item.Cabinet?.Area?.area_name || "미지정 구역";
          const cabinet = item.Cabinet?.cabinet_name ? `『${item.Cabinet.cabinet_name}』` : "";
          key = `${area} ${cabinet}`.trim();
        } else {
          key = item.classification || "미분류";
        }

        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {});
    } else {
      // 그룹화 없음 (전체 목록을 하나의 그룹으로 취급하거나 평면 리스트로 렌더링)
      // 여기서는 기존 구조 유지를 위해 하나의 더미 그룹에 넣음
      grouped = { "": mapped };
    }

    const sections = Object.entries(grouped)
      .sort(([a], [b]) => {
        // "미분류" 또는 "미지정 구역"은 항상 마지막으로 보냄
        const isLast = (str) => str === "미분류" || str.startsWith("미지정 구역");
        const aLast = isLast(a);
        const bLast = isLast(b);

        if (aLast && !bLast) return 1;
        if (!aLast && bLast) return -1;

        // 그 외에는 가나다순 정렬
        return String(a).localeCompare(String(b), "ko");
      })
      .map(([groupTitle, items]) => {
        let header = "";
        // 그룹화된 경우에만 헤더 표시
        if (isGroupedSort && groupTitle) {
          header = `
            <div class="inventory-section-header">
              <span class="section-title">${groupTitle}</span>
              <span class="section-count">${items.length}</span>
            </div>`;
        }

        const cards = items
          .map((item) => {
            const imageSrc = item.photo_url_320 || item.photo_url_160 || "";
            const imageBlock = imageSrc
              ? `<div class="inventory-card__image">
                   <img src="${imageSrc}" alt="Inventory Image" />
                 </div>`
              : `<div class="inventory-card__image inventory-card__image--empty">
                   <span class="inventory-card__placeholder">사진 없음</span>
                 </div>`;
            return `
              <div class="inventory-card" data-id="${item.id}">
                ${imageBlock}
                <div class="inventory-card__body">
                  <div class="inventory-card__left">
                    <div class="inventory-card__line1">
                      <span class="inventory-card__no">No.${item.id}</span>
                      ${item.cas_rn ? `<span class="cas-rn">${item.cas_rn}</span>` : ""}
                    </div>
                    <div class="inventory-card__line2 name-kor">${item.name_kor || '-'}</div>
                    <div class="inventory-card__line3 name-eng">${item.name_eng || '-'}</div>
                    <div class="inventory-card__line4 inventory-card__location">${item.location_text}</div>
                  </div>
                  <div class="inventory-card__meta">
                    <div class="meta-line1">${item.formula || '-'}</div>
                    <div class="meta-line2">
                      <span class="meta-label">화학식량</span>
                      <span class="meta-value">${item.molecular_mass || '-'}</span>
                    </div>
                    <div class="meta-line3">${item.concentration_text || '-'}</div>
                    <div class="meta-line4">${item.current_text}</div>
                  </div>
                </div>
              </div>
            `;
          })
          .join("");

        return `
          <div class="inventory-section-group">
            ${header}
            ${cards}
          </div>
        `;
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

    // ------------------------------------------------------------
    // ⚡ 한 줄 맞춤 (Fit-to-Width) 로직
    // ------------------------------------------------------------
    // ------------------------------------------------------------
    // ⚡ 한 줄 맞춤 (Fit-to-Width) 로직 제거됨 (4줄 레이아웃으로 변경)
    // ------------------------------------------------------------
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
        Substance ( substance_name, cas_rn, molecular_formula, molecular_mass, chem_name_kor, chem_name_kor_mod, substance_name_mod, molecular_formula_mod, Synonyms ( synonyms_name, synonyms_eng ), ReplacedRns:ReplacedRns!ReplacedRns_substance_id_fkey ( replaced_rn ) ),
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
      const doorHVal = String(doorHorizontal || "").trim();
      let doorHLabel = "";
      if (doorHVal === "1") doorHLabel = "왼쪽";
      else if (doorHVal === "2") doorHLabel = "오른쪽";
      else doorHLabel = doorHVal;

      if (doorVertical && doorHLabel) {
        doorPart = `${doorVertical}층 ${doorHLabel}문`;
      } else if (doorVertical) {
        doorPart = `${doorVertical}층문`;
      } else if (doorHLabel) {
        doorPart = `${doorHLabel}문`;
      }

      // 선반/열 정보
      let shelfPart = "";
      if (shelfLevel && column) {
        shelfPart = `${shelfLevel}단 ${column}열`;
      } else {
        if (shelfLevel) shelfPart += `${shelfLevel}단`;
        if (column) shelfPart += (shelfPart ? " " : "") + `${column}열`;
      }

      // 최종 조합 (도어, 선반)
      const detailParts = [doorPart, shelfPart].filter(Boolean).join(", ");
      if (detailParts) locationText += detailParts;

      locationText = locationText.trim() || "위치 정보 없음";

      // ✅ Override Logic
      const substanceName = row.Substance?.substance_name_mod || row.Substance?.substance_name || "";
      const chemNameKor = row.Substance?.chem_name_kor_mod || row.Substance?.chem_name_kor || "";
      const molecularFormula = row.Substance?.molecular_formula_mod || row.Substance?.molecular_formula || "-";

      // HTML 구조로 변경 (JS에서 처리하기 위해)
      let displayLabelHtml = "";
      if (chemNameKor) displayLabelHtml += `<span class="name-kor">${chemNameKor}</span>`;
      if (substanceName) displayLabelHtml += `<span class="name-eng">${substanceName}</span>`;

      if (!displayLabelHtml) {
        displayLabelHtml = `<span class="name-kor">${row.Substance?.cas_rn || `Inventory #${row.id}`}</span>`;
      }

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

      // ✅ Synonyms 처리
      const synonymsList = row.Substance?.Synonyms || [];
      const synonymsName = synonymsList.map((s) => s.synonyms_name).filter(Boolean).join(", ");
      const synonymsEng = synonymsList.map((s) => s.synonyms_eng).filter(Boolean).join(", ");

      // ✅ ReplacedRns 처리
      const replacedRnsList = row.Substance?.ReplacedRns || [];
      const replacedRns = replacedRnsList.map((r) => r.replaced_rn).filter(Boolean).join(", ");

      return {
        id: row.id,
        created_at: row.created_at,
        current_amount: row.current_amount,
        unit: row.unit,
        classification: row.classification || "기타",
        photo_url_320: row.photo_url_320 || null,
        photo_url_160: row.photo_url_160 || null,
        display_label_html: displayLabelHtml, // HTML로 전달
        location_text: locationText,
        formula: molecularFormula,
        current_text: currentText,
        concentration_text: concentrationText,
        Cabinet: row.Cabinet,
        name_kor: chemNameKor,
        name_eng: substanceName,
        cas_rn: row.Substance?.cas_rn || "",
        molecular_mass: row.Substance?.molecular_mass,
        synonyms_name: synonymsName,
        synonyms_eng: synonymsEng,
        replaced_rn: replacedRns,
      };
    });

    allInventoryData = mapped; // ✅ 전체 데이터 저장
    applyFilterAndRender(); // ✅ 필터링 및 렌더링 호출
  }

  // ------------------------------------------------------------
  // 3-1️⃣ 검색 필터링 및 렌더링
  // ------------------------------------------------------------
  function applyFilterAndRender() {
    const container = document.getElementById("inventory-list-container");
    const status = document.getElementById("status-message-inventory-list");
    const searchInput = document.getElementById("inventory-search-input");
    const query = (searchInput?.value || "").trim().toLowerCase();

    // ✅ 검색 필터링
    let filtered = allInventoryData;
    if (query) {
      filtered = allInventoryData.filter((item) => {
        const targetFields = [
          item.cas_rn,
          item.name_eng, // substance_name
          item.formula,
          item.name_kor, // chem_name_kor
          item.synonyms_name,
          item.synonyms_eng,
          item.classification,
          item.replaced_rn, // ✅ Replaced RN 검색 추가
        ];
        return targetFields.some((field) => String(field || "").toLowerCase().includes(query));
      });
    }

    // ✅ 정렬 및 렌더링
    const sorted = sortData(filtered, currentSort);
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
      defaultLabel: "한글명(분류)",
      defaultValue: currentSort,
    });

    await loadList();
    app.Fab?.setVisibility?.(false);
    delete app.Inventory.__manualMount;
  }

  async function _purgeSubstanceIfUnused(substanceId) {
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
  async function ensureInventoryDetailLoaded() {
    if (typeof globalThis.loadInventoryDetail === "function") return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "./js/ui/inventory-detail.js";
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("inventory-detail.js 로드 실패"));
      document.head.appendChild(script);
    });
  }

  async function loadDetail(id) {
    // ✅ inventory-detail.js에 정의된 최신 로직 사용
    if (typeof globalThis.loadInventoryDetail !== "function") {
      try {
        await ensureInventoryDetailLoaded();
      } catch (err) {
        console.error("❌ inventory-detail.js를 동적으로 로드하지 못했습니다.", err);
        alert("상세 페이지 로직을 불러오지 못했습니다.");
        return;
      }
    }

    if (typeof globalThis.loadInventoryDetail === "function") {
      return await globalThis.loadInventoryDetail(id);
    }

    console.error("❌ loadInventoryDetail 함수를 찾을 수 없습니다. inventory-detail.js가 로드되었는지 확인하세요.");
    alert("상세 페이지 로직을 불러오지 못했습니다.");
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

    // ✅ SortDropdown 초기화
    if (App.SortDropdown && App.SortDropdown.init) {
      App.SortDropdown.init({
        onChange: (val) => {
          console.log(`🔽 정렬 변경: ${val}`);
          currentSort = val;
          applyFilterAndRender();
        },
        onRefresh: () => {
          console.log("🔄 목록 새로고침");
          loadList();
        },
        defaultLabel: "한글명(분류)",
        defaultValue: "category_name_kor",
      });
    } else {
      console.error("❌ App.SortDropdown 모듈이 로드되지 않았습니다.");
    }

    // ✅ 검색 입력 이벤트
    const searchInput = document.getElementById("inventory-search-input");
    if (searchInput) {
      // 기존 리스너 제거가 어려우므로, oninput 사용하거나 중복 방지 필요
      // 여기서는 간단히 oninput 사용
      searchInput.oninput = () => {
        applyFilterAndRender();
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
