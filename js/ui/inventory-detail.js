// /js/ui/inventory-detail.js
(function () {
  const getApp = () => globalThis.App || {};
  const getSupabase = () => getApp().supabase;

  async function loadInventoryDetail(id = null) {
    try {
      const supabase = getSupabase();
      const inventoryId = id || localStorage.getItem("selected_inventory_id");
      if (!inventoryId) {
        alert("잘못된 접근입니다.");
        return;
      }

      const { data, error } = await supabase
        .from("Inventory")
        .select(`
          id, state, current_amount, unit, classification, manufacturer, purchase_date, photo_url_320, photo_url_160,
          door_vertical, door_horizontal, internal_shelf_level, storage_column, msds_pdf_url,
          Substance ( id, substance_name, cas_rn, molecular_formula, chem_name_kor ),
          Cabinet ( id, cabinet_name, Area ( area_name ) )
        `)
        .eq("id", inventoryId)
        .single();

      if (error) throw error;

      // 1. Header Name (Dual)
      const korName = data.Substance?.chem_name_kor || data.Substance?.substance_name || "이름 없음";
      const engName = data.Substance?.substance_name || "";

      document.getElementById("detail-name-kor").textContent = korName;
      document.getElementById("detail-name-eng").textContent = engName !== korName ? engName : "";

      // 2. Photo
      const photoDiv = document.getElementById("detail-photo");
      const photoUrl = data.photo_url_320 || data.photo_url_160 || "";
      photoDiv.innerHTML = photoUrl
        ? `<img src="${photoUrl}" alt="시약병 사진">`
        : `<span>사진 없음</span>`;

      // 3. Info List
      document.getElementById("detail-cas").textContent = data.Substance?.cas_rn || "-";
      document.getElementById("detail-formula").textContent = data.Substance?.molecular_formula || "-";
      document.getElementById("detail-class").textContent = data.classification || "-";
      document.getElementById("detail-state").textContent = data.state || "-";
      document.getElementById("detail-manufacturer").textContent = data.manufacturer || "-";

      const amount = data.current_amount != null ? data.current_amount : "-";
      const unit = data.unit || "";
      document.getElementById("detail-quantity").textContent = `${amount}${unit}`;

      // Location Formatting
      const area = data.Cabinet?.Area?.area_name || "";
      const cab = data.Cabinet?.cabinet_name || "";
      const v = data.door_vertical || "";
      const h = data.door_horizontal || "";
      const shelf = data.internal_shelf_level != null ? `${data.internal_shelf_level}층` : "";
      const col = data.storage_column != null ? `${data.storage_column}열` : "";

      let locText = "";
      if (area) locText += area + " ";
      if (cab) locText += `『${cab}』 `;

      let doorPart = "";
      const doorHVal = String(h || "").trim();
      let doorHLabel = "";
      if (doorHVal === "1") doorHLabel = "왼쪽";
      else if (doorHVal === "2") doorHLabel = "오른쪽";
      else doorHLabel = doorHVal;

      if (v && doorHLabel) {
        doorPart = `${v}층 ${doorHLabel}문`;
      } else if (v) {
        doorPart = `${v}층문`;
      } else if (doorHLabel) {
        doorPart = `${doorHLabel}문`;
      }

      let shelfPart = "";
      const shelfVal = data.internal_shelf_level;
      const colVal = data.storage_column;

      if (shelfVal && colVal) {
        shelfPart = `${shelfVal}층 ${colVal}열`;
      } else {
        if (shelfVal) shelfPart += `${shelfVal}층`;
        if (colVal) shelfPart += (shelfPart ? " " : "") + `${colVal}열`;
      }

      const detailParts = [doorPart, shelfPart].filter(Boolean).join(", ");
      if (detailParts) locText += detailParts;

      locText = locText.trim() || "위치: 미지정";
      document.getElementById("detail-location").textContent = locText;

      const dateStr = data.purchase_date || data.created_at; // purchase_date가 없으면 created_at 사용? (created_at은 select에 없으므로 추가 필요할수도)
      // select에 created_at이 없으므로 purchase_date만 사용
      document.getElementById("detail-created-at").textContent = data.purchase_date || "-";


      // 4. MSDS Accordion
      const msdsTitles = [
        "1. 화학제품과 회사에 관한 정보",
        "2. 유해성·위험성",
        "3. 구성성분의 명칭 및 함유량",
        "4. 응급조치 요령",
        "5. 폭발·화재시 대처방법",
        "6. 누출 사고시 대처방법",
        "7. 취급 및 저장방법",
        "8. 노출방지 및 개인보호구",
        "9. 물리화학적 특성",
        "10. 안정성 및 반응성",
        "11. 독성에 관한 정보",
        "12. 환경에 미치는 영향",
        "13. 폐기시 주의사항",
        "14. 운송에 필요한 정보",
        "15. 법적 규제현황",
        "16. 그 밖의 참고사항"
      ];

      const accordionContainer = document.getElementById("msds-accordion");
      if (accordionContainer) {
        accordionContainer.innerHTML = msdsTitles.map((title, index) => `
            <div class="accordion-item">
                <button class="accordion-header" onclick="this.parentElement.classList.toggle('active')">
                    ${title}
                </button>
                <div class="accordion-content">
                    <p class="text-gray-500 italic">내용 없음 (데이터 연동 필요)</p>
                </div>
            </div>
          `).join("");
      }

      // 5. MSDS PDF Link
      const pdfContainer = document.getElementById("msds-pdf-container");
      const noPdfMsg = document.getElementById("no-msds-pdf");
      const pdfLink = document.getElementById("msds-pdf-link");

      if (data.msds_pdf_url) {
        if (pdfContainer) pdfContainer.style.display = "block";
        if (noPdfMsg) noPdfMsg.style.display = "none";
        if (pdfLink) pdfLink.href = data.msds_pdf_url;
      } else {
        if (pdfContainer) pdfContainer.style.display = "none";
        if (noPdfMsg) noPdfMsg.style.display = "block";
      }

      // 6. Hazard Info (Placeholder)
      // TODO: Fetch hazard info from Substance or API
      document.getElementById("hazard-info-container").innerHTML = "<p>데이터 없음</p>";


      // 삭제
      document.getElementById("delete-inventory-btn")?.addEventListener("click", async () => {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        const app = getApp();
        const fnBase =
          app.projectFunctionsBaseUrl ||
          (app.supabaseUrl ? `${app.supabaseUrl}/functions/v1` : "");
        if (!fnBase) {
          alert("함수 호출 경로를 찾을 수 없습니다.");
          return;
        }
        const headers =
          app.supabaseAnonKey
            ? {
              apikey: app.supabaseAnonKey,
              Authorization: `Bearer ${app.supabaseAnonKey}`,
            }
            : undefined;
        const fnUrl = `${fnBase}/casimport?type=inventory&id=${inventoryId}`;
        const res = await fetch(fnUrl, { method: "DELETE", headers });
        if (!res.ok) {
          const msg = await res.text();
          alert("삭제 실패: " + msg);
          return;
        }
        alert("삭제되었습니다.");
        // 목록으로 복귀
        if (getApp().Inventory?.showListPage) {
          await getApp().Inventory.showListPage();
        }
      });

      // 수정
      document.getElementById("edit-inventory-btn")?.addEventListener("click", async () => {
        if (getApp().Router?.go && getApp().Forms?.initInventoryForm) {
          await getApp().Router.go("addInventory", "form-container", () =>
            getApp().Forms.initInventoryForm("edit", data),
          );
        } else {
          alert("폼 수정 모드로 전환 (구현 필요)");
        }
      });
    } catch (err) {
      console.error("상세 페이지 로드 오류:", err);
      document.getElementById("detail-page-container").innerHTML = `<p>❌ 오류: ${err.message}</p>`;
    }
  }

  globalThis.loadInventoryDetail = loadInventoryDetail;
})();
