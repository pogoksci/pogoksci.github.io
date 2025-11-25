// ================================================================
// /js/ui/inventory-detail.js — 약품 상세 보기 로직
// ================================================================
(function () {
  console.log("📦 App.InventoryDetail 모듈 로드됨");

  const getApp = () => globalThis.App || {};
  const getSupabase = () => getApp().supabase;

  // ------------------------------------------------------------
  // 1️⃣ 메인 로드 함수
  // ------------------------------------------------------------
  async function loadInventoryDetail(id) {
    console.log(`🔍 loadInventoryDetail(${id}) 호출됨`);
    const supabase = getSupabase();
    if (!supabase) {
      console.error("❌ App.supabase가 초기화되지 않았습니다.");
      return;
    }

    // 1. 데이터 조회
    const { data, error } = await supabase
      .from("Inventory")
      .select(`
        *,
        Substance (
          *,
          Properties (*),
          Synonyms (*),
          HazardClassifications (*),
          MSDS (*)
        ),
        Cabinet (
          *,
          Area (*)
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("❌ 상세 정보 조회 실패:", error);
      alert("데이터를 불러오지 못했습니다.");
      return;
    }

    if (!data) {
      alert("해당 약품 정보를 찾을 수 없습니다.");
      App.Inventory?.showListPage?.();
      return;
    }

    console.log("✅ 상세 데이터 로드 완료:", data);

    // 2. UI 렌더링
    renderDetail(data);
    bindEvents(data);
  }

  // ------------------------------------------------------------
  // 2️⃣ UI 렌더링
  // ------------------------------------------------------------
  function renderDetail(item) {
    const sub = item.Substance || {};
    const cab = item.Cabinet || {};
    const area = cab.Area || {};

    // --- 기본 정보 ---
    setText("detail-name-kor", sub.chem_name_kor || item.name_kor || "이름 없음");
    setText("detail-name-eng", sub.substance_name || item.name_eng || "");
    setText("detail-substance-id", `ID: ${item.id} / SubID: ${item.substance_id || "-"}`);

    setText("detail-cas", sub.cas_rn || "-");
    setText("detail-formula", sub.molecular_formula || "-");
    setText("detail-class", item.classification || "-");
    setText("detail-state", item.state || "-");
    setText("detail-manufacturer", item.manufacturer || "-");

    // 재고 표시
    const currentAmt = item.current_amount != null ? `${item.current_amount}${item.unit || ""}` : "-";
    setText("detail-quantity", currentAmt);

    // 등록일
    const createdDate = item.created_at ? new Date(item.created_at).toLocaleDateString() : "-";
    setText("detail-created-at", createdDate);

    // --- 사진 ---
    const photoBox = document.getElementById("detail-photo");
    const photoUrl = item.photo_url_320 || item.photo_url_160;
    if (photoUrl) {
      photoBox.innerHTML = `<img src="${photoUrl}" alt="Inventory Photo" style="max-width:100%; max-height:100%; object-fit:contain;">`;
    } else {
      photoBox.innerHTML = `<span>사진 없음</span>`;
    }

    // --- 위치 정보 ---
    // "과학준비실 『시약장1』 1층 왼쪽문, 1층 1열" 형식
    let locText = "";
    if (area.area_name) locText += area.area_name + " ";
    if (cab.cabinet_name) locText += `『${cab.cabinet_name}』 `;

    // 도어 정보
    let doorPart = "";
    const doorHVal = String(item.door_horizontal || "").trim();
    let doorHLabel = "";
    if (doorHVal === "1") doorHLabel = "왼쪽";
    else if (doorHVal === "2") doorHLabel = "오른쪽";
    else doorHLabel = doorHVal;

    const doorV = item.door_vertical;
    if (doorV && doorHLabel) doorPart = `${doorV}층 ${doorHLabel}문`;
    else if (doorV) doorPart = `${doorV}층문`;
    else if (doorHLabel) doorPart = `${doorHLabel}문`;

    // 선반/열 정보
    let shelfPart = "";
    const shelf = item.internal_shelf_level;
    const col = item.storage_column;
    if (shelf && col) shelfPart = `${shelf}단 ${col}열`;
    else {
      if (shelf) shelfPart += `${shelf}단`;
      if (col) shelfPart += (shelfPart ? " " : "") + `${col}열`;
    }

    const detailParts = [doorPart, shelfPart].filter(Boolean).join(", ");
    if (detailParts) locText += detailParts;

    setText("detail-location", locText || "위치 정보 없음");

    // --- 화학적 특성 (Properties) ---
    // Boiling Point, Melting Point, Density 등
    const props = sub.Properties || [];
    const getProp = (name) => props.find(p => p.name === name)?.property || "-";

    setText("detail-boiling", getProp("Boiling Point"));
    setText("detail-melting", getProp("Melting Point"));
    setText("detail-density", getProp("Density"));

    // 농도
    const concVal = item.concentration_value;
    const concUnit = item.concentration_unit;
    const concText = (concVal != null && concVal !== "") ? `${concVal}${concUnit || ""}` : "-";
    setText("detail-concentration", concText);

    // 변환 농도
    const cVal1 = item.converted_concentration_value_1;
    const cUnit1 = item.converted_concentration_unit_1;
    const cVal2 = item.converted_concentration_value_2;
    const cUnit2 = item.converted_concentration_unit_2;

    if (cVal1 != null) {
      setText("conv-label-1", `변환(${cUnit1 || ""}):`);
      setText("conv-value-1", `${parseFloat(cVal1).toFixed(4)} ${cUnit1 || ""}`);
    } else {
      setText("conv-label-1", "변환 농도1:");
      setText("conv-value-1", "-");
    }

    if (cVal2 != null) {
      setText("conv-label-2", `변환(${cUnit2 || ""}):`);
      setText("conv-value-2", `${parseFloat(cVal2).toFixed(4)} ${cUnit2 || ""}`);
    } else {
      setText("conv-label-2", "변환 농도2:");
      setText("conv-value-2", "-");
    }

    // --- 구조 이미지 (2D) ---
    const cid = sub.pubchem_cid; // Substance 테이블에 pubchem_cid가 있다고 가정
    const structureBox = document.getElementById("detail-structure");
    if (cid) {
      structureBox.innerHTML = `<img src="https://pubchem.ncbi.nlm.nih.gov/image/imgsrv.fcgi?cid=${cid}&t=l" alt="Structure" style="width:100%; height:100%; object-fit:contain;">`;
    } else {
      structureBox.innerHTML = `<span class="structure-placeholder">구조 이미지 없음</span>`;
    }

    // --- MSDS ---
    const msdsList = sub.MSDS || [];
    const msdsContainer = document.getElementById("msds-accordion");
    if (msdsList.length > 0) {
      msdsContainer.innerHTML = msdsList.map((m, idx) => `
        <div class="accordion-item">
          <button class="accordion-header" onclick="this.classList.toggle('active'); this.nextElementSibling.classList.toggle('show');">
            ${m.section_name || `Section ${idx + 1}`}
          </button>
          <div class="accordion-body">
            <p>${m.content || "내용 없음"}</p>
          </div>
        </div>
      `).join("");
    } else {
      msdsContainer.innerHTML = "<p>MSDS 정보가 없습니다.</p>";
    }

    // --- 유해화학물질 분류 (Hazard) ---
    const hazardList = sub.HazardClassifications || [];
    const hazardContainer = document.getElementById("hazard-info-container");
    if (hazardList.length > 0) {
      // 중복 제거 및 포맷팅
      const uniqueHazards = [...new Set(hazardList.map(h => h.classification || h.code))];
      hazardContainer.innerHTML = uniqueHazards.map(h => `<span class="hazard-tag">${h}</span>`).join(" ");
      // 이미지 URL이 있다면 이미지도 표시 가능
    } else {
      hazardContainer.innerHTML = `<p class="hazard-placeholder">유해성 정보 없음</p>`;
    }
  }

  // ------------------------------------------------------------
  // 3️⃣ 이벤트 바인딩
  // ------------------------------------------------------------
  function bindEvents(item) {
    // 뒤로가기
    const backBtn = document.getElementById("detail-back-btn");
    if (backBtn) {
      backBtn.onclick = () => {
        App.Inventory?.showListPage?.();
      };
    }

    // 수정
    const editBtn = document.getElementById("edit-inventory-btn");
    if (editBtn) {
      editBtn.onclick = async () => {
        const ok = await App.includeHTML("pages/inventory-form.html", "form-container");
        if (ok) {
          App.Forms?.initInventoryForm?.("edit", item);
        }
      };
    }

    // 삭제
    const delBtn = document.getElementById("delete-inventory-btn");
    if (delBtn) {
      delBtn.onclick = async () => {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        try {
          await App.Inventory.deleteInventory(item.id);
          // Substance 정리 로직 (선택적)
          // await App.Inventory._purgeSubstanceIfUnused(item.substance_id);
          alert("삭제되었습니다.");
          App.Inventory.showListPage();
        } catch (err) {
          console.error(err);
          alert("삭제 실패");
        }
      };
    }

    // 2D/3D 전환
    const btn2d = document.getElementById("btn-view-2d");
    const btn3d = document.getElementById("btn-view-3d");
    const box2d = document.getElementById("detail-structure");
    const box3d = document.getElementById("detail-structure-3d");
    const wrapper = document.querySelector(".structure-wrapper");

    if (btn2d && btn3d) {
      btn2d.onclick = () => {
        wrapper.dataset.viewMode = "2d";
        btn2d.classList.add("active");
        btn3d.classList.remove("active");
        box2d.style.display = "flex";
        box3d.style.display = "none";
      };

      btn3d.onclick = () => {
        wrapper.dataset.viewMode = "3d";
        btn3d.classList.add("active");
        btn2d.classList.remove("active");
        box2d.style.display = "none";
        box3d.style.display = "flex";

        // 3D 뷰어 로드 (최초 1회)
        if (!box3d.hasChildNodes() && item.Substance?.pubchem_cid) {
          const cid = item.Substance.pubchem_cid;
          // PubChem Widget iframe 사용
          box3d.innerHTML = `
             <iframe src="https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=3D-Conformer&embed=true&hide_title=true" 
               style="width:100%; height:100%; border:none;"></iframe>
           `;
        } else if (!item.Substance?.pubchem_cid) {
          box3d.innerHTML = "<span>3D 데이터 없음</span>";
        }
      };
    }

    // Mol 다운로드
    const btnMol = document.getElementById("btn-download-mol-row");
    if (btnMol) {
      btnMol.onclick = async () => {
        if (!item.substance_id) return alert("Substance ID가 없습니다.");

        // Edge Function 호출하여 Mol 파일 다운로드
        // (구현 필요 시 casimport에 handleDownloadMol 추가 필요)
        // 여기서는 임시로 알림만
        alert("Mol 다운로드 기능은 서버 구현이 필요합니다.");
      };
    }

    // MSDS PDF 다운로드
    const btnPdf = document.getElementById("btn-download-msds-row");
    if (btnPdf) {
      if (item.msds_pdf_url) {
        btnPdf.onclick = () => window.open(item.msds_pdf_url, "_blank");
      } else {
        btnPdf.classList.add("disabled");
        btnPdf.style.opacity = "0.5";
        btnPdf.style.cursor = "not-allowed";
      }
    }
  }

  // 헬퍼
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // 전역 등록
  globalThis.loadInventoryDetail = loadInventoryDetail;

})();
