// /js/ui/inventory-detail.js
(function () {
  const getApp = () => globalThis.App || {};
  const getSupabase = () => getApp().supabase;

  const toNumber = (val) => {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  };

  const formatWithUnit = (val, unit = "") => {
    if (val === null || val === undefined || val === "") return "-";
    const n = Number(val);
    if (!Number.isFinite(n)) return String(val);
    return `${n}${unit}`;
  };

  const formatTemp = (val) => formatWithUnit(val, " C");
  const formatDensity = (val) => formatWithUnit(val, " g/mL");

  function computeConversions({ value, unit, molarMass, density }) {
    const v = toNumber(value);
    const mw = toNumber(molarMass);
    const rho = toNumber(density) || 1;
    const result = { percent: null, molarity: null, molality: null };
    if (!v || !mw || mw <= 0) return result;

    if (unit === "%") {
      const massSolute = v;
      const totalMass = 100;
      const solutionVolumeL = (totalMass / rho) / 1000;
      const moles = massSolute / mw;
      result.molarity = solutionVolumeL > 0 ? moles / solutionVolumeL : null;
      const solventMassKg = (totalMass - massSolute) / 1000;
      result.molality = solventMassKg > 0 ? moles / solventMassKg : null;
      result.percent = v;
    } else if (unit === "M" || unit === "N") {
      const effectiveM = v;
      const solutionMassG = rho * 1000;
      const soluteMassG = effectiveM * mw;
      const solventMassKg = (solutionMassG - soluteMassG) / 1000;
      result.percent = solutionMassG > 0 ? (soluteMassG / solutionMassG) * 100 : null;
      result.molality = solventMassKg > 0 ? effectiveM / solventMassKg : null;
      result.molarity = effectiveM;
    }
    return result;
  }

  function renderSvg(structureString, target) {
    if (!target) return;
    if (structureString) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(structureString, "image/svg+xml");
        const svg = doc.querySelector("svg");
        if (svg) {
          target.innerHTML = "";
          target.appendChild(svg);
          return;
        }
      } catch (e) {
        console.warn("SVG parsing failed:", e);
      }
    }
    target.innerHTML = `<span class="structure-placeholder">구조식 이미지 없음</span>`;
  }

  async function loadInventoryDetail(id = null) {
    try {
      const supabase = getSupabase();
      const inventoryId = id || localStorage.getItem("selected_inventory_id");
      if (!inventoryId) {
        alert("선택된 재고가 없습니다.");
        return;
      }

      const { data, error } = await supabase
        .from("Inventory")
        .select(`
          id, state, current_amount, initial_amount, unit, classification, manufacturer, purchase_date, photo_url_320, photo_url_160,
          door_vertical, door_horizontal, internal_shelf_level, storage_column, msds_pdf_url,
          concentration_value, concentration_unit,
          Substance (
            id, substance_name, cas_rn, molecular_formula, molecular_mass, chem_name_kor, svg_image,
            Properties ( name, property ),
            MSDS ( section_number, content ),
            HazardClassifications (*)
          ),
          Cabinet ( id, cabinet_name, area_id, Area ( id, area_name ) )
        `)
        .eq("id", inventoryId)
        .single();

      if (error) throw error;

      const korName = data.Substance?.chem_name_kor || data.Substance?.substance_name || "이름 없음";
      const engName = data.Substance?.substance_name || "";

      document.getElementById("detail-name-kor").textContent = korName;
      document.getElementById("detail-name-eng").textContent = engName !== korName ? engName : "";

      const photoDiv = document.getElementById("detail-photo");
      const photoUrl = data.photo_url_320 || data.photo_url_160 || "";
      photoDiv.innerHTML = photoUrl
        ? `<img src="${photoUrl}" alt="시약 사진">`
        : `<span>사진 없음</span>`;

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

      let locText = "";
      if (area) locText += `${area} `;
      if (cab) locText += `${cab} `;

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

      locText = locText.trim() || "위치: 미확인";
      document.getElementById("detail-location").textContent = locText;

      const dateStr = data.purchase_date || data.created_at;
      let formattedDate = "-";
      if (dateStr) {
        const dateObj = new Date(dateStr);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, "0");
        const day = String(dateObj.getDate()).padStart(2, "0");
        formattedDate = `${year}-${month}-${day}`;
      }
      document.getElementById("detail-created-at").textContent = formattedDate;

      const propsList = data.Substance?.Properties || [];
      const getPropVal = (nameKey) => {
        const found = propsList.find((p) => p.name && p.name.toLowerCase().includes(nameKey.toLowerCase()));
        return found ? found.property : null;
      };

      const boilingPoint = getPropVal("Boiling Point");
      const meltingPoint = getPropVal("Melting Point");
      const density = getPropVal("Density");

      renderSvg(data.Substance?.svg_image, document.getElementById("detail-structure"));

      document.getElementById("detail-boiling").textContent = formatTemp(boilingPoint);
      document.getElementById("detail-melting").textContent = formatTemp(meltingPoint);
      document.getElementById("detail-density").textContent = formatDensity(density);

      const formatConvVal = (num, unitText) => {
        const n = Number(num);
        if (!Number.isFinite(n)) return "-";
        return `${n.toFixed(3)} ${unitText}`;
      };

      const convState = {
        label1: "Conversion 1",
        label2: "Conversion 2",
        value1: "-",
        value2: "-",
      };

      const conversions = computeConversions({
        value: data.concentration_value,
        unit: data.concentration_unit,
        molarMass: data.Substance?.molecular_mass,
        density: density,
      });

      if (data.concentration_unit === "%") {
        convState.label1 = "Molarity (M)";
        convState.value1 = formatConvVal(conversions.molarity, "M");
        convState.label2 = "Molality (m)";
        convState.value2 = formatConvVal(conversions.molality, "m");
      } else if (data.concentration_unit === "M" || data.concentration_unit === "N") {
        convState.label1 = "Mass %";
        convState.value1 = formatConvVal(conversions.percent, "%");
        convState.label2 = "Molarity (M)";
        convState.value2 = formatConvVal(conversions.molarity, "M");
      } else {
        convState.label1 = "Conversion";
        convState.label2 = "Conversion";
      }

      const convLabel1El = document.getElementById("conv-label-1");
      const convLabel2El = document.getElementById("conv-label-2");
      const convValue1El = document.getElementById("conv-value-1");
      const convValue2El = document.getElementById("conv-value-2");

      if (convLabel1El) convLabel1El.textContent = convState.label1;
      if (convLabel2El) convLabel2El.textContent = convState.label2;
      if (convValue1El) convValue1El.textContent = convState.value1;
      if (convValue2El) convValue2El.textContent = convState.value2;

      const msdsTitles = [
        "1. 화학제품과 회사에 관한 정보",
        "2. 유해성·위험성",
        "3. 구성성분의 명칭 및 함유량",
        "4. 응급조치 요령",
        "5. 화재 시 조치방법",
        "6. 누출 시 조치방법",
        "7. 취급 및 저장방법",
        "8. 노출방지 및 개인보호구",
        "9. 물리화학적 특성",
        "10. 안정성 및 반응성",
        "11. 독성에 관한 정보",
        "12. 환경에 미치는 영향",
        "13. 폐기 시 주의사항",
        "14. 운송에 필요한 정보",
        "15. 법적 규제현황",
        "16. 그 밖의 참고사항",
      ];

      const ghsMapping = {
        "01": "Explosive\nUnstable explosive; self-reactive; organic peroxide",
        "02": "Flammable\nFlammable gas/aerosol/liquid/solid; self-reactive; pyrophoric; emits flammable gas; organic peroxide",
        "03": "Oxidizing\nOxidizing gas/liquid/solid",
        "04": "Compressed Gas\nCompressed, liquefied or refrigerated gas",
        "05": "Corrosive\nCorrosive to metals; skin corrosion/irritation; serious eye damage",
        "06": "Toxic\nAcute toxicity",
        "07": "Health Hazard\nIrritation; sensitization; narcotic effects; ozone layer hazard",
        "08": "Serious Health Hazard\nRespiratory sensitizer; germ cell mutagenicity; carcinogenicity; reproductive toxicity; target organ toxicity; aspiration hazard",
        "09": "Environment\nHazardous to the aquatic environment",
      };

      const msdsData = data.Substance?.MSDS || [];
      const accordionContainer = document.getElementById("msds-accordion");

      if (accordionContainer) {
        accordionContainer.innerHTML = msdsTitles
          .map((title, index) => {
            const sectionNum = index + 1;
            const sectionData = msdsData.find((d) => d.section_number === sectionNum);
            let contentHtml = '<p class="text-gray-500 italic p-4">내용 없음 (데이터 동기화 필요)</p>';

            if (sectionData && sectionData.content) {
              if (sectionNum === 2 && sectionData.content.includes("|||그림문자|||")) {
                const rows = sectionData.content.split(";;;");
                const rowsHtml = rows
                  .map((row) => {
                    const parts = row.split("|||");
                    if (parts.length >= 3) {
                      const [no, name, detail] = parts;

                      if (name.trim() === "그림문자") {
                        const ghsCodes = detail.trim().split(/\s+/).filter((s) => s.endsWith(".gif"));
                        if (ghsCodes.length > 0) {
                          const ghsTableRows = ghsCodes
                            .map((code) => {
                              const match = code.match(/GHS(\d+)\.gif/i);
                              if (match) {
                                const num = match[1];
                                const imgUrl = `https://hazmat.nfa.go.kr/design/images/contents/ghs-icon${num}.gif`;
                                const fullDesc = ghsMapping[num] || "분류 정보 없음";
                                const lines = fullDesc.split("\n");
                                const titleLine = lines[0];
                                const detailLines = lines.slice(1).join("<br>");

                                let korName = titleLine;
                                let engName = "";
                                const matchTitle = titleLine.match(/^(.*)\((.*)\)$/);
                                if (matchTitle) {
                                  korName = matchTitle[1].trim();
                                  engName = matchTitle[2].trim();
                                }

                                return `<tr class="ghs-row"><td class="ghs-cell-image"><img src="${imgUrl}" alt="${code}" class="ghs-image"><div class="ghs-name-kor">${korName}</div><div class="ghs-name-eng">${engName}</div></td><td class="ghs-cell-desc">${detailLines}</td></tr>`;
                              }
                              return "";
                            })
                            .join("");

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
                  })
                  .join("");
                contentHtml = `<div class="msds-table-container">${rowsHtml}</div>`;
              } else if (sectionData.content.includes("|||")) {
                const rows = sectionData.content.split(";;;");
                const rowsHtml = rows
                  .map((row) => {
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
                  })
                  .join("");
                contentHtml = `<div class="msds-table-container">${rowsHtml}</div>`;
              } else {
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
          })
          .join("");
      }

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

      const hazardContainer = document.getElementById("hazard-info-container");
      const _hazards = data.Substance?.HazardClassifications || [];
      const substanceId = data.Substance?.id;

      const { data: hazardData, error: hazardError } = await supabase
        .from("HazardClassifications")
        .select("*")
        .eq("substance_id", substanceId);

      if (hazardError) {
        console.error("유해화학물질 정보 조회 오류:", hazardError);
        if (hazardContainer) hazardContainer.innerHTML = `<p class="text-red-500">정보 조회 실패</p>`;
      } else if (hazardData && hazardData.length > 0) {
        if (hazardContainer) {
          const accordion = hazardData
            .map((item, idx) => {
              const title = item.sbstnClsfTypeNm || `분류 ${idx + 1}`;
              const unq = item.unqNo || "-";
              const cont = item.contInfo || "-";
              const info = item.ancmntInfo || "-";
              const ymd = item.ancmntYmd || "-";
              return `
                <div class="hazard-acc-item">
                  <button class="hazard-acc-header" type="button">
                    <span class="hazard-acc-title">${title}</span>
                    <span class="hazard-acc-arrow" aria-hidden="true">▼</span>
                  </button>
                  <div class="hazard-acc-content">
                    <table class="hazard-table">
                      <thead>
                        <tr>
                          <th>고유 번호</th>
                          <th>내용</th>
                          <th>고시 정보</th>
                          <th>고시 일자</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>${unq}</td>
                          <td>${cont}</td>
                          <td>${info}</td>
                          <td>${ymd}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              `;
            })
            .join("");

          hazardContainer.innerHTML = `<div class="hazard-accordion">${accordion}</div>`;

          hazardContainer.querySelectorAll(".hazard-acc-header").forEach((btn) => {
            btn.addEventListener("click", () => {
              btn.parentElement.classList.toggle("open");
            });
          });
        }
      } else {
        if (hazardContainer) {
          hazardContainer.innerHTML = "<p class='text-gray-500'>해당 물질의 유해화학물질 분류 정보가 없습니다.</p>";
        }
      }

      document.getElementById("detail-back-btn")?.addEventListener("click", async () => {
        if (getApp().Inventory?.showListPage) {
          await getApp().Inventory.showListPage();
        }
      });

      document.getElementById("delete-inventory-btn")?.addEventListener("click", async () => {
        if (!confirm("정말 삭제하시겠습니까?")) return;

        if (data.msds_pdf_url) {
          try {
            const url = data.msds_pdf_url;
            const fileName = url.substring(url.lastIndexOf("/") + 1);

            if (fileName) {
              const { error: storageError } = await supabase.storage.from("msds-pdf").remove([fileName]);

              if (storageError) {
                console.warn("PDF 파일 삭제 실패:", storageError);
              }
            }
          } catch (err) {
            console.warn("PDF 삭제 처리 오류:", err);
          }
        }

        const app = getApp();
        const fnBase =
          app.projectFunctionsBaseUrl || (app.supabaseUrl ? `${app.supabaseUrl}/functions/v1` : "");
        if (!fnBase) {
          alert("함수 호출 경로를 찾을 수 없습니다.");
          return;
        }
        const headers = app.supabaseAnonKey
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
        if (getApp().Inventory?.showListPage) {
          await getApp().Inventory.showListPage();
        }
      });

      document.getElementById("edit-inventory-btn")?.addEventListener("click", async () => {
        if (getApp().Router?.go && getApp().Forms?.initInventoryForm) {
          await getApp().Router.go("addInventory", "form-container", () =>
            getApp().Forms.initInventoryForm("edit", data),
          );
        } else {
          alert("편집 모드로 전환 (구현 필요)");
        }
      });

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
              if (result.status === "updated") {
                loadInventoryDetail(inventoryId);
              }
            }
          } catch (e) {
            console.warn("Auto-update check failed:", e);
          }
        };
        checkUpdate();
      }
    } catch (err) {
      console.error("상세 페이지 로드 오류:", err);
      document.getElementById("detail-page-container").innerHTML = `<p>오류: ${err.message}</p>`;
    }
  }

  globalThis.loadInventoryDetail = loadInventoryDetail;
})();
