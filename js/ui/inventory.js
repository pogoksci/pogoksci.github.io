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
  let currentFilteredData = []; // ✅ 현재 화면에 보이는 데이터 (출력용)


  // ------------------------------------------------------------
  // 1️⃣ 정렬 함수
  // ------------------------------------------------------------
  // ------------------------------------------------------------
  // 1️⃣ 정렬 함수
  // ------------------------------------------------------------
  const CLASSIFICATION_PRIORITY = {
    '강산': 1, '약산': 2, '강염기': 3, '약염기': 4,
    '알코올': 5, '유기화합물': 6, '산화염': 7, '수산화염': 8,
    '염화염': 9, '질산염': 10, '탄산염': 11, '황산염': 12,
    '황화염': 13, '무기화합물': 14, '금속': 15, '지시약': 16,
    '생명과학': 17, '식품류': 18, '오일류': 19, '화장품재료': 20,
    '세제류': 21, '기타': 22
  };

  function getPriority(classification) {
    // Exact match or default to 999
    return CLASSIFICATION_PRIORITY[classification] || 999;
  }

  function sortData(rows, key) {
    const collateKo = (a, b) => String(a || "").localeCompare(String(b || ""), "ko");
    const collateEn = (a, b) => String(a || "").localeCompare(String(b || ""), "en", { sensitivity: "base" });

    switch (key) {
      case "category_name_kor": // 한글명(분류)
        return rows.sort((a, b) => {
          const pA = getPriority(a.classification);
          const pB = getPriority(b.classification);
          if (pA !== pB) return pA - pB;
          // Same priority? Sort by classification name (if not covered) or skip
          // Then sort by Name
          return collateKo(a.classification, b.classification) || collateKo(a.name_kor, b.name_kor) || (a.id - b.id);
        });
      case "category_name_eng": // 영문명(분류)
        return rows.sort((a, b) => {
          const pA = getPriority(a.classification);
          const pB = getPriority(b.classification);
          if (pA !== pB) return pA - pB;
          return collateKo(a.classification, b.classification) || collateEn(a.name_eng, b.name_eng) || (a.id - b.id);
        });
      case "name_kor": // 한글명(전체)
        return rows.sort((a, b) => collateKo(a.name_kor, b.name_kor) || (a.id - b.id)); // Optional: added ID sort for consistency
      case "name_eng": // 영문명(전체)
        return rows.sort((a, b) => collateEn(a.name_eng, b.name_eng) || (a.id - b.id)); // Optional: added ID sort for consistency
      case "formula": // 화학식
        return rows.sort((a, b) => collateEn(a.formula, b.formula));
      case "id_asc": // 전체(번호순)
        return rows.sort((a, b) => a.id - b.id);
      case "storage_location": // 위치
        return rows.sort((a, b) => {
          // Area -> Cabinet -> Location Text 순 정렬
          // ✅ [수정됨] Area.area_name -> area_id.room_name
          const locA = (a.Cabinet?.area_id?.room_name || "") + (a.Cabinet?.cabinet_name || "") + (a.location_text || "");
          const locB = (b.Cabinet?.area_id?.room_name || "") + (b.Cabinet?.cabinet_name || "") + (b.location_text || "");
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
  // ------------------------------------------------------------
  // 2️⃣ 목록 렌더링
  // ------------------------------------------------------------
  function renderList(mapped, container) {
    if (!mapped.length) {
      container.innerHTML = `
        <div class="empty-state">
            <span class="material-symbols-outlined">science</span>
            <p>등록된 약품이 없습니다.</p>
        </div>
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
          // ✅ Area.area_name -> area_id.room_name
          const area = item.Cabinet?.area_id?.room_name || "미지정 구역";
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
      grouped = { "": mapped };
    }

    const sections = Object.entries(grouped)
      .sort(([a], [b]) => {
        const isLast = (str) => str === "미분류" || str.startsWith("미지정 구역");
        const aLast = isLast(a);
        const bLast = isLast(b);

        if (aLast && !bLast) return 1;
        if (!aLast && bLast) return -1;

        // Custom Priority Check
        if (typeof getPriority === 'function') {
          const pA = getPriority(a);
          const pB = getPriority(b);
          if (pA !== 999 || pB !== 999) {
            // If both are 999 (unknown), fall back to string compare
            // If one is known and other is 999, known comes first (smaller number)
            if (pA !== pB) return pA - pB;
          }
        }

        return String(a).localeCompare(String(b), "ko");
      })
      .map(([groupTitle, items]) => {
        let header = "";
        if (isGroupedSort && groupTitle) {
          header = `
            <div class="section-header-wrapper">
              <div class="inventory-section-header">
                <span class="section-title">${groupTitle}</span>
                <span class="section-count">${items.length}</span>
              </div>
            </div>`;
        }

        const cards = items
          .map((item) => {
            const imageSrc = item.photo_url_320 || item.photo_url_160 || "";
            const imageBlock = imageSrc
              ? `<div class="inventory-card__image">
                   <img src="${imageSrc}" alt="Inventory Image" style="width: 75px; height: 100px; object-fit: cover; object-position: center;" />
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
                      <span class="meta-label">F.W.</span>
                      <span class="meta-value">${item.molecular_mass || '-'}</span>
                    </div>
                    <div class="meta-line3">${item.concentration_text || '-'}</div>
                    <div class="meta-line4">
                      ${item.current_text}
                      ${item.is_low_stock ? `<span style="background-color: #ffcccc; color: #d63031; border: 1px solid #d63031; border-radius: 4px; padding: 0px 3px; font-size: 0.7rem; font-weight: bold; margin-left: 5px; vertical-align: middle;">구입요청</span>` : ""}
                    </div>
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

    if (!container) return;
    container.innerHTML = sections;
    container.querySelectorAll(".inventory-card").forEach((card) => {
      const id = Number(card.dataset.id);
      card.addEventListener("click", async () => {
        await App.Router.go("inventoryDetail", { id });
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
        <div class="empty-state">
            <span class="material-symbols-outlined">hourglass_empty</span>
            <p>${message}</p>
        </div>
      `;
    };

    showStatus('약품 목록을 불러오는 중...');

    const { data, error } = await supabase
      .from("Inventory")
      .select(`
        id, bottle_identifier, current_amount, initial_amount, unit, classification, created_at, photo_url_320, photo_url_160,
        concentration_value, concentration_unit, status, edited_name_kor,
        door_vertical, door_horizontal, internal_shelf_level, storage_column,
        Substance ( substance_name, cas_rn, molecular_formula, molecular_mass, chem_name_kor, chem_name_kor_mod, substance_name_mod, molecular_formula_mod, Synonyms ( synonyms_name, synonyms_eng ), ReplacedRns!ReplacedRns_substance_id_fkey ( replaced_rn ) ),
        Cabinet ( cabinet_name, door_horizontal_count, area_id:lab_rooms!fk_cabinet_lab_rooms ( id, room_name ) )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ 목록 조회 오류:", error);
      showStatus("약품 목록을 불러오지 못했습니다.");
      return;
    }

    const mapped = (data || []).map((row, index) => {
      // ✅ Area -> lab_rooms
      const area = row.Cabinet?.area_id?.room_name || "";
      const cabinetName = row.Cabinet?.cabinet_name || "";
      const doorVertical = row.door_vertical || "";
      const doorHorizontal = row.door_horizontal || "";
      const hCount = Number(row.Cabinet?.door_horizontal_count || 0); // ✅ 도어 개수 확인
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

      // ✅ Detail View Logic: Only show Left/Right if multiple doors exist
      if (hCount > 1) {
        if (doorHVal === "1") doorHLabel = "왼쪽";
        else if (doorHVal === "2") doorHLabel = "오른쪽";
        else doorHLabel = doorHVal;
      }

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

      // ✅ 보고서용 분리 데이터 (Portrait 모드 2줄 처리용)
      const locationMain = (area + " " + (cabinetName ? `『${cabinetName}』` : "")).trim();
      const locationSub = detailParts;

      // ✅ CAS Validation
      const rawCas = row.Substance?.cas_rn || "";
      const isValidCas = /^\d+-\d+-\d$/.test(rawCas.trim());
      const displayCas = isValidCas ? rawCas : (rawCas ? "CAS없음" : "");

      // ✅ Override Logic
      const substanceName = row.Substance?.substance_name_mod || row.Substance?.substance_name || "";
      const chemNameKor = row.edited_name_kor || row.Substance?.chem_name_kor_mod || row.Substance?.chem_name_kor || "";
      const molecularFormula = row.Substance?.molecular_formula_mod || row.Substance?.molecular_formula || "-";

      // HTML 구조로 변경 (JS에서 처리하기 위해)
      let displayLabelHtml = "";
      if (chemNameKor) displayLabelHtml += `<span class="name-kor">${chemNameKor}</span>`;
      if (substanceName) displayLabelHtml += `<span class="name-eng">${substanceName}</span>`;

      if (!displayLabelHtml) {
        displayLabelHtml = `<span class="name-kor">${displayCas || `Inventory #${row.id}`}</span>`;
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

      // ⚠️ Low Stock Badge (List View)
      if (Number(row.initial_amount) > 0 && Number(row.current_amount) <= (Number(row.initial_amount) * 0.2)) {
        // Add badge to currentText (Note: renderList handles HTML if we modify where it is used, 
        // but currently currentText is just text in template string. We need to inject HTML in template.)
        // Let's modify renderList logic below instead, or just return a flag.
        // Better: Return it as a new property.
        row.is_low_stock = true;
      }

      // ✅ Synonyms 처리
      const synonymsList = row.Substance?.Synonyms || [];
      const synonymsName = synonymsList.map((s) => s.synonyms_name).filter(Boolean).join(", ");
      const synonymsEng = synonymsList.map((s) => s.synonyms_eng).filter(Boolean).join(", ");

      // ✅ ReplacedRns 처리
      // Note: Query uses 'ReplacedRns' alias (or table name)
      const replacedRnsList = row.Substance?.ReplacedRns || [];
      const replacedRns = replacedRnsList.map((r) => r.replaced_rn).filter(Boolean).join(", ");



      return {
        id: row.id,
        created_at: row.created_at,
        current_amount: row.current_amount,
        unit: row.unit,
        classification: row.classification || "기타",
        status: row.status,
        photo_url_320: row.photo_url_320 || null,
        photo_url_160: row.photo_url_160 || null,
        display_label_html: displayLabelHtml, // HTML로 전달
        location_text: locationText,
        location_main: locationMain,
        location_sub: locationSub,
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
        is_low_stock: row.is_low_stock,
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
    const query = (searchInput?.value || "").trim().toLowerCase().replace(/\s+/g, "");

    // ✅ 검색 필터링
    let filtered = allInventoryData;

    // 1) 상태 필터링 (소모완료약품 vs 일반)
    // "전량소진" 문자열에 공백이 있을 수 있으므로 제거하고 비교
    if (currentSort === "exhausted") {
      // 소모완료약품 모드: '전량소진'인 것만 표시
      filtered = filtered.filter((item) => String(item.status || "").replace(/\s+/g, "") === "전량소진");
    } else {
      // 일반 모드: '전량소진' 제외
      filtered = filtered.filter((item) => String(item.status || "").replace(/\s+/g, "") !== "전량소진");
    }

    // 2) 검색어 필터링
    if (query) {
      filtered = filtered.filter((item) => {
        const targetFields = [
          item.cas_rn,
          item.name_eng, // substance_name
          item.formula,
          item.name_kor, // edited_name_kor OR sub.chem_name_kor_mod OR sub.chem_name_kor
          item.synonyms_name,
          item.synonyms_eng,
          item.classification,
          item.replaced_rn,
        ];
        return targetFields.some((field) =>
          String(field || "").toLowerCase().replace(/\s+/g, "").includes(query)
        );
      });
    }

    // ✅ 정렬 및 렌더링
    // If search produced no results
    if (query && filtered.length === 0 && allInventoryData.length > 0) {
      container.innerHTML = `
        <div class="empty-state">
            <span class="material-symbols-outlined">search_off</span>
            <p>검색 결과가 없습니다.</p>
        </div>
      `;
      return;
    }

    const sorted = sortData(filtered, currentSort);
    currentFilteredData = sorted; // ✅ 출력용 데이터 업데이트
    renderList(sorted, container);
  }

  async function showListPage() {
    const app = getApp(); // Define app locally or use globalThis.App

    // ✅ Fix: Clear FAB immediately to prevent "FOUC" (Flash of Wrong Content)
    if (app.Fab && app.Fab.setVisibility) {
      app.Fab.setVisibility(false);
    }

    const inventoryApi = app.Inventory || {};
    inventoryApi.__manualMount = true;
    app.Inventory = inventoryApi;

    // ✅ 페이지 진입 시 정렬 상태 초기화
    currentSort = "category_name_kor";

    const ok = await app.includeHTML?.("pages/inventory-list.html", "form-container");
    if (!ok) return;

    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );

    bindListPage();
    // 중복 호출 제거: bindListPage 내부에서 이미 init 호출함
    // app.SortDropdown?.init?.({ ... });

    await loadList();

    // ✅ Fix: Use Global FAB explicit registration to prevent "Ghost" FABs
    // Instead of hiding it (which might fail due to CSS overrides), we overwrite it.
    if (app.Fab && app.Fab.setVisibility) {
      const canWrite = App.Auth?.canWrite ? App.Auth.canWrite() : true; // Default to true if check missing, or handle strictly

      // Check Auth similar to bindListPage (lines 1392)
      // If reusing the exact logic is hard, just call the shared create function or define inline.
      // We will define specific handler here to match new-inventory-btn behavior.

      if (canWrite) {
        app.Fab.setVisibility(true, '<span class="material-symbols-outlined">add</span> 새 약품 등록', async () => {
          console.log("🧾 새 약품 등록(FAB) 클릭됨");
          const ok = await app.includeHTML("pages/inventory-form.html", "form-container");
          if (ok) {
            console.log("📄 inventory-form.html 로드 완료 → 폼 초기화 시작");
            App.Forms?.initInventoryForm?.("create", null);
          } else {
            console.error("❌ inventory-form.html 로드 실패");
          }
        });
      } else {
        app.Fab.setVisibility(false);
      }
    }

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
    const fnUrl = App.API?.EDGE?.CASIMPORT || `https://muprmzkvrjacqatqxayf.supabase.co/functions/v1/casimport`;

    try {
      const response = await fetch(`${fnUrl}?type=inventory&id=${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${App.API?.SUPABASE_ANON_KEY || supabase.supabaseKey}`,
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      console.log(`✅ Inventory(${id}) deleted via Edge Function.`);
    } catch (err) {
      console.error("Delete error:", err);
      alert(`삭제 중 오류가 발생했습니다: ${err.message}`);
      throw err;
    }
  }

  // ------------------------------------------------------------
  // 7️⃣ 보고서 출력 (Print)
  // ------------------------------------------------------------
  function printReport() {
    if (!currentFilteredData || currentFilteredData.length === 0) {
      alert("출력할 데이터가 없습니다.");
      return;
    }

    // 1. 새 창 열기
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("팝업 차단을 해제해주세요.");
      return;
    }

    // 2. HTML 작성
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    let rowsHtml = "";
    currentFilteredData.forEach((item, index) => {
      // null 체크 및 안전한 문자열 변환
      const nameKor = item.name_kor || "-";
      const nameEng = item.name_eng || "";
      const casRn = item.cas_rn || "-";
      const formula = item.formula || "-";
      const locMain = item.location_main || "";
      const locSub = item.location_sub || "";
      const amount = item.current_text || "-";
      const classification = item.classification || "-";
      const concentration = item.concentration_text || "-";

      rowsHtml += `
        <tr>
            <td style="text-align: center;">${item.id}</td>
            <td>
                <div class="name-kor">${nameKor}</div>
                ${nameEng ? `<div class="name-eng">${nameEng}</div>` : ""}
            </td>
            <td style="text-align: center;">${concentration}</td>
            <td style="text-align: center;">${casRn}</td>
            <td style="text-align: center;">${formula}</td>
            <td class="col-location">
                <span class="loc-main">${locMain}</span>
                <span class="loc-sub">${locSub}</span>
            </td>
            <td style="text-align: center;">${amount}</td>
            <td style="text-align: center;">${classification}</td>
        </tr>
        `;
    });

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <title>약품 목록</title>
        <style>
            body { font-family: "Noto Sans KR", sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 10px; font-size: 24px; }
            .meta { text-align: right; margin-bottom: 20px; font-size: 14px; color: #555; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 8px; vertical-align: middle; }
            th { background-color: #f2f2f2; text-align: center; font-weight: bold; }
            .name-kor { font-weight: bold; font-size: 12px; }
            .name-eng { font-size: 10px; color: #666; margin-top: 2px; }
            @media print {
                @page { margin: 15mm; }
                body { padding: 0; }
                th { background-color: #eee !important; -webkit-print-color-adjust: exact; }
            }
            /* Portrait Optimization */
            @media print and (orientation: portrait) {
                .loc-main { display: block; white-space: nowrap; }
                .col-location { font-size: 10px; }
            }
        </style>
    </head>
    <body>
        <h1>약품 목록</h1>
        <div class="meta">
            출력일: ${dateStr} | 총 ${currentFilteredData.length}건
        </div>
        <table>
            <thead>
                <tr>
                    <th width="5%">No.</th>
                    <th width="18%">약품명</th>
                    <th width="10%">농도</th>
                    <th width="15%">CAS No.</th>
                    <th width="13%">화학식</th>
                    <th width="19%" class="col-location">위치</th>
                    <th width="10%">보유량</th>
                    <th width="10%">분류</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
        <script>
            window.onload = function() {
                window.print();
            };
        </script>
    </body>
    </html>
    `;

    // 3. 쓰기 및 출력
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }



  // ------------------------------------------------------------
  // 8️⃣ 수불부 보고서 (Stock Transaction Report)
  // ------------------------------------------------------------

  function openStockReportModal() {
    const modal = document.getElementById("modal-stock-report");
    const form = document.getElementById("form-stock-report");
    if (!modal || !form) return;

    // Disable all FABs (Dimmed) while modal is open
    const fabs = document.querySelectorAll(".fab");
    fabs.forEach(fab => {
      fab.style.opacity = "0.3";
      fab.style.pointerEvents = "none";
      fab.style.filter = "grayscale(100%)";
      fab.style.zIndex = "1000";
    });

    if (App.Fab && typeof App.Fab.setDisabled === 'function') {
      App.Fab.setDisabled(true);
    }

    // Portal Strategy: Move modal to body to break stacking context constraints
    const originalParent = modal.parentNode;
    const placeholder = document.createComment("modal-portal-placeholder");
    if (originalParent) {
      originalParent.replaceChild(placeholder, modal);
    }
    document.body.appendChild(modal);

    modal.style.display = "flex";

    const cleanup = () => {
      modal.style.display = "none";

      // Restore Modal to original location
      if (placeholder && placeholder.isConnected) {
        placeholder.replaceWith(modal);
      } else {
        modal.remove(); // If placeholder is gone (navigation), remove zombie modal
      }

      // Re-enable all FABs
      const fabs = document.querySelectorAll(".fab");
      fabs.forEach(fab => {
        fab.style.opacity = "";
        fab.style.pointerEvents = "";
        fab.style.filter = "";
        fab.style.zIndex = "";
      });
      if (App.Fab && typeof App.Fab.setDisabled === 'function') {
        App.Fab.setDisabled(false);
      }
    };

    // Form Submit
    form.onsubmit = async (e) => {
      e.preventDefault();
      const startDate = document.getElementById("report-start-date").value;
      const endDate = document.getElementById("report-end-date").value;
      const target = form.elements["report-target"].value;
      const layout = form.elements["report-layout"].value;

      if (!startDate || !endDate) return alert("기간을 입력해주세요.");

      cleanup(); // Close and restore
      await generateStockReport({ startDate, endDate, target, layout });
    };

    // Close Button
    const closeBtn = document.getElementById("btn-close-report-modal");
    if (closeBtn) {
      closeBtn.onclick = cleanup;
    }
  }

  function setReportPeriod(type) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    const startDateEl = document.getElementById("report-start-date");
    const endDateEl = document.getElementById("report-end-date");
    if (!startDateEl || !endDateEl) return;

    let start, end;

    // School Year Logic: Mar 1 ~ Next Feb 28
    // If currently Jan or Feb, we are in the previous academic year.
    const academicYear = (currentMonth < 2) ? currentYear - 1 : currentYear;

    if (type === 'cur_year') {
      start = `${academicYear}-03-01`;
      end = `${academicYear + 1}-02-28`;
    } else if (type === 'last_year') {
      start = `${academicYear - 1}-03-01`;
      end = `${academicYear}-02-28`;
    } else if (type === '1st_sem') {
      start = `${academicYear}-03-01`;
      end = `${academicYear}-08-31`; // Approx
    } else if (type === '2nd_sem') {
      start = `${academicYear}-09-01`;
      end = `${academicYear + 1}-02-28`;
    }

    startDateEl.value = start;
    endDateEl.value = end;
  }

  async function generateStockReport({ startDate, endDate, target, layout }) {
    // 1. Fetch Data
    let itemsToProcess = (currentFilteredData && currentFilteredData.length > 0)
      ? currentFilteredData
      : allInventoryData;

    if (itemsToProcess.length === 0) return alert("출력할 약품 데이터가 없습니다.");

    const supabase = getSupabase();

    // 2. Fetch All Usage Logs for these items
    const ids = itemsToProcess.map(i => i.id);

    const { data: logs, error } = await supabase
      .from("UsageLog")
      .select("*")
      .in("inventory_id", ids)
      .order("usage_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return alert("기록을 불러오는데 실패했습니다.");
    }

    // 3. Process Per Item
    const reportItems = [];

    itemsToProcess.forEach(item => {
      const itemLogs = logs.filter(l => l.inventory_id === item.id);

      // Split Logs based on usage_date
      const beforeLogs = itemLogs.filter(l => {
        const d = l.usage_date;
        return d < startDate; // startDate is "YYYY-MM-DD"
      });
      const periodLogs = itemLogs.filter(l => {
        const d = l.usage_date;
        return d >= startDate && d <= endDate;
      });

      // Calculate Brought Forward (기초 재고)
      let broughtForward = 0;
      // Additive subjects: 최초 등록, 구입, 수량 조정(증가)
      // All others are subtractive usages
      const additive = ["최초 등록", "구입", "수량 조정(증가)", "이월", "잔량 조정(증가)"];

      beforeLogs.forEach(l => {
        const amt = l.amount || 0;
        if (additive.includes(l.subject)) {
          broughtForward += amt;
        } else {
          broughtForward -= amt;
        }
      });

      // Balance Check for Printing
      const hasTransaction = periodLogs.length > 0;
      // broughtForward might be 0 if it's a new item or if it was fully consumed before period.
      // But we also check item.current_amount for "all" target.
      const hasBalance = Math.abs(broughtForward) > 0.001 || item.current_amount > 0;

      let shouldPrint = false;
      if (target === 'usage_only') {
        shouldPrint = hasTransaction;
      } else { // 'all'
        shouldPrint = hasTransaction || hasBalance;
      }

      if (shouldPrint) {
        reportItems.push({
          info: item,
          broughtForward,
          logs: periodLogs
        });
      }
    });

    if (reportItems.length === 0) return alert("해당 조건에 맞는 데이터가 없습니다.");

    // 4. Generate HTML
    renderStockReportHtml(reportItems, { startDate, endDate, layout });
  }

  function renderStockReportHtml(items, { startDate, endDate, layout }) {
    const printWindow = window.open("", "_blank");

    const styles = `
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap');
          body { font-family: "Noto Sans KR", sans-serif; padding: 10mm; font-size: 11px; background: white; }
          .page-break { page-break-after: always; display: block; clear: both; }
          .item-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #000; }
          .item-table th, .item-table td { border: 1px solid #000; padding: 4px; text-align: center; }
          .item-table th { background: #f0f0f0; }
          .header { text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 10px; margin-top: 0; }
          .item-header { background: #e0e0e0; padding: 5px; font-weight: bold; border: 1px solid #000; border-bottom: none; display: flex; justify-content: space-between; }
          
          @media print {
              body { padding: 5mm; }
              .page-break { page-break-after: always; }
              /* Ensure the grid fits on one page */
              .report-grid { height: 92vh !important; }
          }
      `;

    let bodyContent = "";

    if (layout === '1_per_page') {
      items.forEach(item => {
        bodyContent += '<div class="page-break">';
        bodyContent += buildSingleItemTable(item);
        bodyContent += '</div>';
      });
    } else if (layout === '4_per_page') {
      // Chunk into 4
      for (let i = 0; i < items.length; i += 4) {
        const slice = items.slice(i, i + 4);
        const isFirstPage = (i === 0);
        const gridHeight = "88vh";

        // If not first page, add a spacer to match the header height
        if (!isFirstPage) {
          bodyContent += `<div class="header" style="visibility: hidden; margin-bottom: 10px;">수불대장</div>`;
        }

        bodyContent += `<div class="page-break report-grid" style="display:grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; height: ${gridHeight}; gap: 10px; padding: 5px; box-sizing: border-box;">`;
        slice.forEach(item => {
          bodyContent += '<div style="overflow: hidden; display: flex; flex-direction: column;">';
          bodyContent += buildSingleItemTable(item);
          bodyContent += '</div>';
        });
        bodyContent += '</div>';
      }
    } else { // continuous (feed)
      items.forEach(item => {
        bodyContent += buildSingleItemTable(item);
        bodyContent += '<br>';
      });
    }

    const html = `
          <!DOCTYPE html>
          <html>
          <head>
              <title>수불대장</title>
              <style>${styles}</style>
          </head>
          <body>
              <h1 class="header">수불대장 (${startDate} ~ ${endDate})</h1>
              ${bodyContent}
              <script>
                  window.onload = function(){ 
                      setTimeout(() => { window.print(); }, 500);
                  }
              </script>
          </body>
          </html>
      `;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  function buildSingleItemTable(data) {
    const { info, broughtForward, logs } = data;
    const unit = info.unit || "";
    const nameKor = info.name_kor || "이름 없음";

    let rows = "";

    // 1. Brought Forward Row - Only show if non-zero
    let currentBalance = broughtForward;
    if (Math.abs(currentBalance) > 0.001) {
      rows += `
              <tr style="background: #fafafa; color: #555;">
                  <td colspan="2">전기 이월 (Brought Forward)</td>
                  <td>-</td>
                  <td>-</td>
                  <td>${currentBalance.toFixed(2)}</td>
                  <td>-</td>
              </tr>
          `;
    }

    // 2. Logs
    const additive = ["최초 등록", "구입", "수량 조정(증가)", "이월", "잔량 조정(증가)"];

    logs.forEach(log => {
      const amt = log.amount || 0;
      const isIncome = additive.includes(log.subject);

      if (isIncome) currentBalance += amt;
      else currentBalance -= amt;

      const date = log.usage_date || "-";
      // If subject is '최초 등록' or period is '기타', simplify the text
      let subjectStr = log.subject;
      if (log.subject !== "최초 등록" && log.period && log.period !== '-' && log.period !== '기타') {
        subjectStr = `${log.subject} (${log.period})`;
      }

      rows += `
              <tr>
                  <td>${date}</td>
                  <td style="text-align:left;">${subjectStr}</td>
                  <td>${isIncome ? amt : ""}</td>
                  <td>${!isIncome ? amt : ""}</td>
                  <td>${currentBalance.toFixed(2)}</td>
                  <td></td>
              </tr>
          `;
    });

    return `
          <div style="border: 2px solid #000; padding: 5px; height: 100%; box-sizing: border-box; overflow: hidden;">
              <div class="item-header" style="border:none; background:none; border-bottom:1px solid #000; margin-bottom:5px;">
                  <span style="font-size: 1.1em;">(No.${info.id}) ${nameKor}</span>
                  <span style="white-space: nowrap; margin-left: 10px;">CAS: ${info.cas_rn || '-'} / 단위: ${unit}</span>
              </div>
              <table class="item-table" style="margin:0; border:none;">
                  <thead>
                      <tr>
                          <th width="23%">날짜</th>
                          <th width="32%">내용</th>
                          <th width="10%">입고</th>
                          <th width="10%">출고</th>
                          <th width="15%">잔고</th>
                          <th width="10%">확인</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${rows}
                  </tbody>
              </table>
          </div>
      `;
  }

  // ------------------------------------------------------------
  // 5️⃣ 라벨 출력 ("시약장 라벨")
  // ------------------------------------------------------------
  async function openLabelPrintModal() {
    const supabase = getSupabase();
    // 1. Fetch Cabinets
    const { data: cabinets, error } = await supabase
      .from("Cabinet")
      .select("id, cabinet_name, area_id:lab_rooms!fk_cabinet_lab_rooms (room_name)")
      .order("cabinet_name");

    if (error) {
      alert("시약장 목록을 불러오지 못했습니다.");
      return;
    }

    // 2. Simple UI for Selection
    const modalHtml = `
      <div id="label-print-modal" class="modal-overlay" style="z-index: 9999; display: flex;">
        <div class="modal-content" style="max-width: 400px; width: 90%;">
          <h3>시약장 라벨 출력</h3>
          <p style="margin-bottom: 10px; font-size: 14px; color: #666;">
            출력할 시약장을 선택하세요.<br>
            (A4 용지에 상/하, 좌/우 구역별로 인쇄됩니다.)
          </p>
          <select id="label-cabinet-select" class="form-input" style="margin-bottom: 20px;">
            <option value="all">전체 시약장 (데이터 많음 주의)</option>
            ${cabinets.map(c => {
      const area = c.area_id?.room_name || "미지정";
      return `<option value="${c.id}">[${area}] ${c.cabinet_name}</option>`;
    }).join('')}
          </select>
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
             <button id="btn-cancel-label" class="btn-cancel">취소</button>
             <button id="btn-confirm-label" class="btn-primary">출력하기</button>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById("label-print-modal");
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById("label-print-modal");
    document.getElementById("btn-cancel-label").onclick = () => modal.remove();
    document.getElementById("btn-confirm-label").onclick = () => {
      const val = document.getElementById("label-cabinet-select").value;
      modal.remove();
      printShelfLabels(val === 'all' ? null : Number(val));
    };
  }

  async function printShelfLabels(targetCabinetId) {
    const supabase = getSupabase();

    // 1. Fetch Inventory Data
    let query = supabase
      .from("Inventory")
      .select(`
        id, edited_name_kor,
        door_vertical, door_horizontal, internal_shelf_level, storage_column,
        Cabinet!inner ( id, cabinet_name, door_horizontal_count, area_id:lab_rooms!fk_cabinet_lab_rooms(room_name) ),
        Substance ( chem_name_kor, chem_name_kor_mod, substance_name, substance_name_mod )
      `);

    if (targetCabinetId) {
      query = query.eq("cabinet_id", targetCabinetId);
    }

    // Sort: Cabinet -> Unit(Vert) -> Floor(Horiz) -> Row(Shelf) -> Col
    query = query.order("cabinet_id")
      .order("door_vertical")
      .order("door_horizontal")
      .order("internal_shelf_level")
      .order("storage_column");

    const { data, error } = await query;
    if (error) {
      console.error(error);
      alert("데이터 조회 실패: " + (error.message || JSON.stringify(error)));
      return;
    }

    if (!data || data.length === 0) {
      alert("출력할 데이터가 없습니다.");
      return;
    }

    // 2. Grouping
    const pages = {};

    data.forEach(item => {
      const cabId = item.Cabinet.id;
      const unit = item.door_vertical || '?'; // 단 (Unit) -> Header: 층
      const floor = item.door_horizontal || '?'; // 층 (Floor) -> Header: 문
      const row = item.internal_shelf_level || 1; // 행 (Shelf) -> Header: 단
      const col = item.storage_column || 1; // 열 (Col) -> Header: 열

      // Group by Cabinet + Unit + Floor + Shelf (Row)
      const key = `${cabId}_${unit}_${floor}_${row}`;
      if (!pages[key]) {
        pages[key] = {
          cabinetName: item.Cabinet.cabinet_name,
          areaName: item.Cabinet.area_id?.room_name,
          cabinetDoorCount: item.Cabinet.door_horizontal_count || 1,
          unit: unit,
          floor: floor,
          row: row,
          cols: {} // Key: col number (1~6), Value: Array of items
        };
      }
      if (!pages[key].cols[col]) pages[key].cols[col] = [];
      pages[key].cols[col].push(item);
    });

    // 3. Generate HTML
    const pageKeys = Object.keys(pages).sort();

    const htmlContent = pageKeys.map(key => {
      const pageData = pages[key];

      const renderBlock = (colNum) => {
        const colItems = pageData.cols[colNum] || [];

        // Sort by ID (or name if preferred)
        colItems.sort((a, b) => a.id - b.id);

        let trs = '';
        const MAX_ROWS = 9;

        // 1. Render Actual Items
        colItems.forEach(item => {
          let kor = "";
          let eng = "";
          if (item) {
            kor = item.Substance?.chem_name_kor_mod || item.Substance?.chem_name_kor || "";
            eng = item.Substance?.substance_name_mod || item.Substance?.substance_name || "";
          }

          const idVal = item.id;

          trs += `
                    <tr>
                        <td class="col-id">${idVal}</td>
                        <td class="col-name fit-content kor-name">${kor}</td>
                        <td class="col-name fit-content eng-name">${eng}</td>
                    </tr>
                 `;
        });

        // 2. Pad to MAX_ROWS
        for (let i = colItems.length; i < MAX_ROWS; i++) {
          trs += `
                    <tr>
                        <td class="col-id"></td>
                        <td class="col-name fit-content kor-name"></td>
                        <td class="col-name fit-content eng-name"></td>
                    </tr>
                 `;
        }

        // Header Info
        const uVal = pageData.unit;
        const fVal = pageData.floor;
        const rVal = pageData.row;
        const cVal = colNum;
        const doorCount = pageData.cabinetDoorCount || 1;

        let locationText = "";
        if (doorCount === 1) {
          locationText = `${uVal}층문, ${rVal}단 ${cVal}열`;
        } else {
          const doorDir = (fVal == 1) ? "왼쪽문" : "오른쪽문";
          locationText = `${uVal}층 ${doorDir}, ${rVal}단 ${cVal}열`;
        }

        return `
                <div class="label-block">
                    <div class="block-header">${locationText}</div>
                    <table class="label-table">
                        <colgroup>
                            <col class="col-id" style="width: 9mm;">
                            <col class="col-name" style="width: 50%;">
                            <col class="col-name" style="width: 50%;">
                        </colgroup>
                        <thead>
                            <tr>
                                <th>No</th><th>한글</th><th>영문</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${trs}
                        </tbody>
                    </table>
                </div>
            `;
      };

      const leftBlocks = [1, 3, 5].map(c => renderBlock(c)).join('');
      const rightBlocks = [2, 4, 6].map(c => renderBlock(c)).join('');

      return `
            <div class="print-page">
                <div class="column left-column">
                    ${leftBlocks}
                </div>
                <div class="column right-column">
                    ${rightBlocks}
                </div>
            </div>
        `;
    }).join('');

    // 4. Open Print Window
    const win = window.open('', '_blank', 'width=1000,height=800');
    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>시약장 라벨 출력</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { font-family: "Noto Sans KR", sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
                .print-page { 
                    width: 190mm; 
                    height: 277mm; 
                    page-break-after: always; 
                    position: relative;
                    display: flex;
                    justify-content: space-between;
                }
                .page-header { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 5mm; }
                /* .grid-container removed */
                /* 2 Columns: ~90mm each width with gap */
                .column { width: 48%; margin-right: 0; vertical-align: top; }
                .column:last-child { margin-right: 0; }
                
                .label-block { margin-bottom: 5mm; border: none; break-inside: avoid; }
                .block-header { 
                    text-align: center; 
                    font-weight: bold; 
                    font-size: 10pt; 
                    padding: 2px 0; 
                    border-bottom: 1px solid #000; 
                    background-color: #f8f8f8;
                    -webkit-print-color-adjust: exact;
                }
                table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                th, td { border: 1px solid #000; text-align: center; padding: 2px; height: 7mm; font-size: 9pt; overflow: hidden; vertical-align: middle; box-sizing: border-box; }
                
                /* Header Background */
                th { background-color: #ffeb3b !important; font-weight: bold; font-size: 8pt; }

                /* Column Widths handled by colgroup, but explicit helpers here too */
                .col-id { width: 9mm; font-size: 8pt; }
                .col-name { width: auto; } 

                .kor-name { font-weight: bold; }
                .eng-name { font-size: 8pt; }
                
                /* Utility for JS resizing */
                .fit-content {
                    white-space: nowrap;
                }
            </style>
        </head>
        <body>
            ${htmlContent}
            <script>
                function fitText() {
                    const cells = document.querySelectorAll('.fit-content');
                    cells.forEach(el => {
                        let size = 9; // Start size (matches CSS)
                        if (el.classList.contains('eng-name')) size = 8;
                        
                        // Reset to ensure we start clean
                        el.style.fontSize = size + 'pt';
                        el.style.whiteSpace = 'nowrap'; // Ensure no wrapping for calculation
                        
                        // Shrink if overflowing
                        // Min size 5pt to be readable
                        while (el.scrollWidth > el.clientWidth && size > 5) {
                            size -= 0.5;
                            el.style.fontSize = size + 'pt';
                        }
                    });
                }
                
                window.onload = function() {
                    fitText();
                    // Small delay to ensure render before print
                    setTimeout(() => {
                        window.print();
                        // window.close(); // Optional: keep open for debug if needed, but user prefers auto
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);
    win.document.close();
  }

  // ------------------------------------------------------------
  // 6️⃣ 정렬 & 버튼 UI
  // ------------------------------------------------------------
  function bindListPage() {
    // ✅ 페이지 진입 시 정렬 상태 초기화 (메뉴 이동 후 복귀 시 초기화 보장)
    currentSort = "category_name_kor";

    // 수불부 버튼 바인딩
    const stockBtn = document.getElementById("stock-report-btn");
    if (stockBtn) {
      if (App.Auth && typeof App.Auth.canWrite === 'function' && !App.Auth.canWrite()) {
        stockBtn.style.display = "none";
      } else {
        stockBtn.style.display = "";
        stockBtn.onclick = () => openStockReportModal();
      }
    }

    // 보고서 버튼 바인딩 (기존)
    const printBtn = document.getElementById("print-report-btn");
    if (printBtn) {
      if (App.Auth && typeof App.Auth.canWrite === 'function' && !App.Auth.canWrite()) {
        printBtn.style.display = "none";
      } else {
        printBtn.style.display = "";
        printBtn.onclick = () => printReport();
      }
    }

    // 라벨 출력 버튼 바인딩
    const labelBtn = document.getElementById("btn-print-labels");
    if (labelBtn) {
      if (App.Auth && typeof App.Auth.canWrite === 'function' && !App.Auth.canWrite()) {
        labelBtn.style.display = "none";
      } else {
        labelBtn.style.display = "";
        labelBtn.onclick = () => openLabelPrintModal();
      }
    }

    // ✅ SortDropdown 초기화
    if (App.SortDropdown && App.SortDropdown.init) {
      const sortLabelMap = {
        category_name_kor: "한글명(분류)",
        category_name_eng: "영문명(분류)",
        name_kor: "한글명(전체)",
        name_eng: "영문명(전체)",
        id_asc: "전체(번호순)",
        formula: "화학식",
        storage_location: "위치",
        created_at_desc: "등록순서",
        exhausted: "소모완료약품",
      };
      const currentLabel = sortLabelMap[currentSort] || "한글명(분류)";

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
        defaultLabel: currentLabel,
        defaultValue: currentSort,
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
      // ✅ 권한 체크: 쓰기 권한 없으면 숨김
      if (App.Auth && typeof App.Auth.canWrite === 'function' && !App.Auth.canWrite()) {
        newBtn.style.display = "none";
      } else {
        newBtn.style.display = ""; // 초기화 (재진입 시)
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
    create: createInventory, // Alias for forms.js
    update: updateInventory, // Alias for forms.js
    createInventory,
    updateInventory,
    deleteInventory,
    printReport,
    openStockReportModal,
    setReportPeriod,
  };
})();
