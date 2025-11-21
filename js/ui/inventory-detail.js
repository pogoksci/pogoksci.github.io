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
          id, state, current_amount, initial_amount, unit, classification, manufacturer, purchase_date, photo_url_320, photo_url_160,
          door_vertical, door_horizontal, internal_shelf_level, storage_column, msds_pdf_url,
          concentration_value, concentration_unit,
          Substance (
            id, substance_name, cas_rn, molecular_formula, chem_name_kor,
            MSDS ( section_number, content )
          ),
          Cabinet ( id, cabinet_name, area_id, Area ( id, area_name ) )
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
      const shelf = data.internal_shelf_level != null ? `${data.internal_shelf_level}단` : "";
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
        shelfPart = `${shelfVal}단 ${colVal}열`;
      } else {
        if (shelfVal) shelfPart += `${shelfVal}단`;
        if (colVal) shelfPart += (shelfPart ? " " : "") + `${colVal}열`;
      }

      const detailParts = [doorPart, shelfPart].filter(Boolean).join(", ");
      if (detailParts) locText += detailParts;

      locText = locText.trim() || "위치: 미지정";
      document.getElementById("detail-location").textContent = locText;

      const dateStr = data.purchase_date || data.created_at;
      // Format date to YYYY-MM-DD
      let formattedDate = "-";
      if (dateStr) {
        const dateObj = new Date(dateStr);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        formattedDate = `${year}-${month}-${day}`;
      }
      document.getElementById("detail-created-at").textContent = formattedDate;


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

      const ghsMapping = {
        "01": "▶폭발성(Explosive)\n· 불안정한 폭발물\n· 폭발물\n· 자기반응성 물질 및 혼합물\n· 유기과산화물",
        "02": "▶인화성(Flammable)\n· 인화성 가스\n· 가연성 에어로졸\n· 인화성 액체\n· 인화성 고체\n· 자기반응성 물질 및 혼합물\n· 발화성 액체\n· 발화성 고체\n· 가연성 고체\n· 가연성 액체\n· 자체 발열 물질 및 혼합물\n· 물과 접촉하여 가연성 가스를 방출하는 물질 및 혼합물\n· 유기 과산화물",
        "03": "▶산화성(Oxidizing)\n· 산화 가스\n· 산화성 액체\n· 산화성 고체",
        "04": "▶고압 가스(Compressed Gas)\n· 압축 가스\n· 액화 가스\n· 냉장 액화 가스\n· 용존 가스",
        "05": "▶부식성(Corrosive)\n· 금속 부식성\n· 폭발물\n· 인화성 가스\n· 자기 반응성물질 및 혼합물\n· 유기 과산화물\n· 피부부식\n· 심각한 눈 손상",
        "06": "▶유독성(Toxic)\n· 급성 독성",
        "07": "▶경고(Health Hazard, Hazardous to Ozone Layer)\n· 급성 독성\n· 피부 자극성\n· 눈 자극성\n· 피부 과민성\n· 특정 표적 장기 독성(호흡기 자극, 마약 효과)",
        "08": "▶건강 유해성(Serious Health hazard)\n· 호흡기 과민성\n· 생식세포 변이원성\n· 발암성\n· 생식독성\n· 특정표적장기 독성\n· 흡인 위험",
        "09": "▶수생 환경 유독성(Hazardous to the Environment)\n· 수생환경 유해성",
      };

      const msdsData = data.Substance?.MSDS || [];
      const accordionContainer = document.getElementById("msds-accordion");

      if (accordionContainer) {
        accordionContainer.innerHTML = msdsTitles.map((title, index) => {
          const sectionNum = index + 1;
          const sectionData = msdsData.find(d => d.section_number === sectionNum);
          let contentHtml = '<p class="text-gray-500 italic p-4">내용 없음 (데이터 연동 필요)</p>';

          if (sectionData && sectionData.content) {
            // Special handling for Section 2 (Hazard Info) GHS Pictograms
            if (sectionNum === 2 && sectionData.content.includes("|||그림문자|||")) {
              const rows = sectionData.content.split(";;;");
              const rowsHtml = rows.map(row => {
                const parts = row.split("|||");
                if (parts.length >= 3) {
                  const [no, name, detail] = parts;

                  // Check for GHS Pictograms
                  if (name.trim() === "그림문자") {
                    const ghsCodes = detail.trim().split(/\s+/).filter(s => s.endsWith(".gif"));
                    if (ghsCodes.length > 0) {
                      const ghsTableRows = ghsCodes.map(code => {
                        // Extract number (e.g., GHS01.gif -> 01)
                        const match = code.match(/GHS(\d+)\.gif/i);
                        if (match) {
                          const num = match[1];
                          const imgUrl = `https://hazmat.nfa.go.kr/design/images/contents/ghs-icon${num}.gif`;
                          const fullDesc = ghsMapping[num] || "설명 없음";
                          const lines = fullDesc.split('\n');
                          const titleLine = lines[0];
                          const detailLines = lines.slice(1).join('<br>');

                          let korName = titleLine.replace('▶', '').trim();
                          let engName = "";
                          const matchTitle = korName.match(/^(.*)\((.*)\)$/);
                          if (matchTitle) {
                            korName = matchTitle[1];
                            engName = matchTitle[2];
                          }

                          return `<tr class="ghs-row"><td class="ghs-cell-image"><img src="${imgUrl}" alt="${code}" class="ghs-image"><div class="ghs-name-kor">${korName}</div><div class="ghs-name-eng">${engName}</div></td><td class="ghs-cell-desc">${detailLines}</td></tr>`;
                        }
                        return "";
                      }).join("");

                      return `
                        <div class="msds-row">
                          <div class="msds-header">${no} ${name}</div>
                          <div class="msds-content msds-no-padding"><table class="ghs-table">${ghsTableRows}</table></div>
                        </div>
                      `;
                    }
                  }

                  return `
                    <div class="msds-row">
                      <div class="msds-header">${no} ${name}</div>
                      <div class="msds-content">${detail}</div>
                    </div>
                  `;
                } else {
                  return `<div class="msds-simple-content">${row}</div>`;
                }
              }).join("");
              contentHtml = `<div class="msds-table-container">${rowsHtml}</div>`;
            }
            // Standard structured data handling
            else if (sectionData.content.includes("|||")) {
              const rows = sectionData.content.split(";;;");
              const rowsHtml = rows.map(row => {
                const parts = row.split("|||");
                if (parts.length >= 3) {
                  const [no, name, detail] = parts;
                  return `
                    <div class="msds-row">
                      <div class="msds-header">${no} ${name}</div>
                      <div class="msds-content">${detail}</div>
                    </div>
                  `;
                } else {
                  return `<div class="msds-simple-content">${row}</div>`;
                }
              }).join("");
              contentHtml = `<div class="msds-table-container">${rowsHtml}</div>`;
            } else {
              // Fallback for old data or simple text
              contentHtml = `<div class="msds-simple-content">${sectionData.content.replace(/\n/g, "<br>")}</div>`;
            }
          }

          return `
            <div class="accordion-item">
                <button class="accordion-header" onclick="this.parentElement.classList.toggle('active')">
                    ${title}
                </button>
                <div class="accordion-content">
                    ${contentHtml}
                </div>
            </div>
          `;
        }).join("");
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
      // 삭제
      document.getElementById("delete-inventory-btn")?.addEventListener("click", async () => {
        if (!confirm("정말 삭제하시겠습니까?")) return;

        // 🗑️ MSDS PDF 파일 삭제
        if (data.msds_pdf_url) {
          try {
            // URL에서 파일명 추출 (예: .../msds-pdf/filename.pdf)
            const url = data.msds_pdf_url;
            const fileName = url.substring(url.lastIndexOf('/') + 1);

            if (fileName) {
              console.log("🗑️ MSDS PDF 삭제 시도:", fileName);
              const { error: storageError } = await supabase.storage
                .from('msds-pdf')
                .remove([fileName]);

              if (storageError) {
                console.warn("⚠️ PDF 파일 삭제 실패:", storageError);
              } else {
                console.log("✅ PDF 파일 삭제 완료");
              }
            }
          } catch (err) {
            console.warn("⚠️ PDF 삭제 처리 중 오류:", err);
          }
        }

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
      // 7. Auto-update Check (Background)
      if (data.Substance?.cas_rn) {
        const checkUpdate = async () => {
          try {
            const app = getApp();
            const fnBase = app.projectFunctionsBaseUrl || (app.supabaseUrl ? `${app.supabaseUrl}/functions/v1` : "");
            if (!fnBase) return;

            const headers = app.supabaseAnonKey
              ? { apikey: app.supabaseAnonKey, Authorization: `Bearer ${app.supabaseAnonKey}`, "Content-Type": "application/json" }
              : { "Content-Type": "application/json" };

            const res = await fetch(`${fnBase}/casimport?type=check_update`, {
              method: "POST",
              headers,
              body: JSON.stringify({ cas_rn: data.Substance.cas_rn }),
            });

            if (res.ok) {
              const result = await res.json();
              console.log("🔄 Auto-update check:", result);
              if (result.status === "updated") {
                console.log("✅ MSDS updated. Reloading page...");
                // Reload current page to show new data
                loadInventoryDetail(inventoryId);
              }
            }
          } catch (e) {
            console.warn("⚠️ Auto-update check failed:", e);
          }
        };
        // Run in background
        checkUpdate();
      }

    } catch (err) {
      console.error("상세 페이지 로드 오류:", err);
      document.getElementById("detail-page-container").innerHTML = `<p>❌ 오류: ${err.message}</p>`;
    }
  }

  globalThis.loadInventoryDetail = loadInventoryDetail;
})();
