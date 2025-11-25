// /js/ui/inventory-detail.js
(function () {
  const getApp = () => globalThis.App || {};
  const getSupabase = () => getApp().supabase;

  const _toNumber = (val) => {
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

  const formatDensity = (val) => {
    if (val === null || val === undefined || val === "") return "-";
    const raw = String(val).trim();
    if (!raw) return "-";

    if (raw.includes("@")) {
      const [valuePart, ...rest] = raw.split("@");
      const value = valuePart.trim();
      const temp = rest.join("@").trim();
      return temp ? `${value} <span style="font-size: 10px;">@ ${temp}</span>` : value || "-";
    }

    const n = Number(raw);
    if (Number.isFinite(n)) return `${n} g/mL`;
    return raw;
  };

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
        converted_concentration_value_1, converted_concentration_unit_1,
        converted_concentration_value_2, converted_concentration_unit_2,
        school_hazardous_chemical, special_health_checkup_hazardous_factor,
        toxic_substance, permitted_substance, restricted_substance, prohibited_substance,
        Substance (
          id, substance_name, cas_rn, molecular_formula, molecular_mass, chem_name_kor, svg_image, has_molfile,
          Properties ( name, property ),
          MSDS ( section_number, content ),
          HazardClassifications (*)
        ),
        Cabinet ( id, cabinet_name, area_id, door_horizontal_count, Area ( id, area_name ) )
        `)
        .eq("id", inventoryId)
        .single();

      if (error) throw error;

      // Populate Hazard Summary Table
      const setHazardVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || "-";
      };
      setHazardVal("val-school-hazard", data.school_hazardous_chemical);
      setHazardVal("val-special-health", data.special_health_checkup_hazardous_factor);
      setHazardVal("val-toxic", data.toxic_substance);
      setHazardVal("val-permitted", data.permitted_substance);
      setHazardVal("val-restricted", data.restricted_substance);
      setHazardVal("val-prohibited", data.prohibited_substance);

      const korName = data.Substance?.chem_name_kor || data.Substance?.substance_name || "이름 없음";
      const engName = data.Substance?.substance_name || "";

      document.getElementById("detail-name-kor").textContent = korName;
      document.getElementById("detail-name-eng").textContent = engName !== korName ? engName : "";

      const photoDiv = document.getElementById("detail-photo");
      const photoUrl = data.photo_url_320 || data.photo_url_160 || "";
      photoDiv.innerHTML = photoUrl
        ? `<img src="${photoUrl}" alt="시약 사진">`
        : `<span>사진 없음</span>`;

      document.getElementById("detail-name-kor").textContent = data.Substance?.chem_name_kor || "이름 없음";
      document.getElementById("detail-name-eng").textContent = data.Substance?.substance_name || "";
      if (data.Substance?.id) {
        document.getElementById("detail-substance-id").textContent = `No.${data.Substance.id}`;
      }
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
      const hCount = Number(data.Cabinet?.door_horizontal_count || data.door_horizontal_count || 0);

      let locText = "";
      if (area) locText += `${area} `;
      if (cab) locText += `『${cab}』 `;

      let doorPart = "";
      const doorHVal = String(h || "").trim();
      let doorHLabel = "";
      if (hCount > 1) {
        if (doorHVal === "1") doorHLabel = "왼쪽";
        else if (doorHVal === "2") doorHLabel = "오른쪽";
        else doorHLabel = doorHVal;
      }

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

      // PubChem CID Helper
      let cachedCid = null;
      const loadPubChemCid = async () => {
        if (cachedCid) return cachedCid;
        const casRn = data.Substance?.cas_rn;
        if (!casRn) return null;
        try {
          const res = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${casRn}/cids/JSON`);
          if (!res.ok) return null;
          const json = await res.json();
          cachedCid = json.IdentifierList?.CID?.[0];
          return cachedCid;
        } catch (e) {
          console.warn("CID Fetch Error:", e);
          return null;
        }
      };

      // Load 2D Image
      const structureBox = document.getElementById("detail-structure");
      (async () => {
        structureBox.innerHTML = '<span class="structure-placeholder" style="font-size:12px; color:#999;">Loading...</span>';
        const cid = await loadPubChemCid();
        if (cid) {
          const imgUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?record_type=2d&image_size=300x300`;
          structureBox.innerHTML = `<img src="${imgUrl}" alt="Structure" style="width:100%; height:100%; object-fit:contain;">`;
        } else {
          if (data.Substance?.svg_image) {
            renderSvg(data.Substance.svg_image, structureBox);
          } else {
            structureBox.innerHTML = '<span class="structure-placeholder">이미지 없음</span>';
          }
        }
      })();

      document.getElementById("detail-boiling").textContent = formatTemp(boilingPoint);
      document.getElementById("detail-melting").textContent = formatTemp(meltingPoint);

      const densityEl = document.getElementById("detail-density");
      if (densityEl) {
        densityEl.innerHTML = formatDensity(density);
      }

      // Original Concentration
      const concVal = data.concentration_value ? `${data.concentration_value} ${data.concentration_unit || ""}` : "-";
      document.getElementById("detail-concentration").textContent = concVal;

      const formatConvVal = (num, unitText) => {
        const n = Number(num);
        if (!Number.isFinite(n)) return "-";
        return `${n.toFixed(3)} ${unitText}`;
      };

      const convState = {
        label1: "변환농도1",
        label2: "변환농도2",
        value1: "-",
        value2: "-",
      };

      if (data.converted_concentration_value_1) {
        const unit1 = data.converted_concentration_unit_1;
        const unit1Norm = (unit1 || "").trim();
        if (unit1Norm.toUpperCase().startsWith("M")) convState.label1 = "몰농도:";
        else if (unit1Norm.includes("%")) convState.label1 = "퍼센트농도:";
        else convState.label1 = "Conversion";
        convState.value1 = formatConvVal(data.converted_concentration_value_1, unit1);
      }

      if (data.converted_concentration_value_2) {
        const unit2 = data.converted_concentration_unit_2;
        const unit2Norm = (unit2 || "").trim();
        if (unit2Norm.toLowerCase().startsWith("m")) convState.label2 = "몰랄농도:";
        else if (unit2Norm.includes("%")) convState.label2 = "퍼센트농도:";
        else convState.label2 = "Conversion";
        convState.value2 = formatConvVal(data.converted_concentration_value_2, unit2);
      }

      const convLabel1El = document.getElementById("conv-label-1");
      const convLabel2El = document.getElementById("conv-label-2");
      const convValue1El = document.getElementById("conv-value-1");
      const convValue2El = document.getElementById("conv-value-2");

      const formatWithParenSmall = (val) => {
        if (!val) return "-";
        const str = String(val);
        const idx = str.indexOf("(");
        if (idx !== -1) {
          const main = str.substring(0, idx);
          const sub = str.substring(idx);
          return `${main}<span style="font-size: 10px;">${sub}</span>`;
        }
        return str;
      };

      if (convLabel1El) convLabel1El.textContent = convState.label1;
      if (convLabel2El) convLabel2El.textContent = convState.label2;
      if (convValue1El) {
        // Check plain text for logic
        if (convState.value1.includes("(의미 없음)") || convState.value1.includes("(정의 불가)")) {
          convValue1El.classList.add("text-muted-small");
        } else {
          convValue1El.classList.remove("text-muted-small");
        }
        // Render with formatting
        convValue1El.innerHTML = formatWithParenSmall(convState.value1);
      }
      if (convValue2El) {
        if (convState.value2.includes("(의미 없음)") || convState.value2.includes("(정의 불가)")) {
          convValue2El.classList.add("text-muted-small");
        } else {
          convValue2El.classList.remove("text-muted-small");
        }
        convValue2El.innerHTML = formatWithParenSmall(convState.value2);
      }

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
        "01": "폭발성(Explosive)\n· 불안정한 폭발물\n· 폭발물\n· 자기반응성 물질 및 혼합물\n· 유기과산화물",
        "02": "인화성(Flammable)\n· 인화성 가스\n· 가연성 에어로졸\n· 인화성 액체\n· 인화성 고체\n· 자기반응성 물질 및 혼합물\n· 발화성 액체\n· 발화성 고체\n· 가연성 고체\n· 가연성 액체\n· 자체 발열 물질 및 혼합물\n· 물과 접촉하여 가연성 가스를 방출하는 물질 및 혼합물\n· 유기 과산화물",
        "03": "산화성(Oxidizing)\n· 산화 가스\n· 산화성 액체\n· 산화성 고체",
        "04": "고압 가스(Compressed Gas)\n· 압축 가스\n· 액화 가스\n· 냉장 액화 가스\n· 용존 가스",
        "05": "부식성(Corrosive)\n· 금속 부식성\n· 폭발물\n· 인화성 가스\n· 자기 반응성물질 및 혼합물\n· 유기 과산화물\n· 피부부식\n· 심각한 눈 손상",
        "06": "유독성(Toxic)\n· 급성 독성",
        "07": "경고(Health Hazard, Hazardous to Ozone Layer)\n· 급성 독성\n· 피부 자극성\n· 눈 자극성\n· 피부 과민성\n· 특정 표적 장기 독성(호흡기 자극, 마약 효과)",
        "08": "건강 유해성(Serious Health hazard)\n· 호흡기 과민성\n· 생식세포 변이원성\n· 발암성\n· 생식독성\n· 특정표적장기 독성\n· 흡인 위험",
        "09": "수생 환경 유독성(Hazardous to the Environment)\n· 수생환경 유해성",
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

      // ---------------------------------------------------------
      // MSDS PDF Button Logic (Redesigned)
      // ---------------------------------------------------------
      const btnDownloadMsds = document.getElementById("btn-download-msds-row");
      if (btnDownloadMsds) {
        const icon = btnDownloadMsds.querySelector(".icon");
        const text = btnDownloadMsds.querySelector(".btn-text");

        if (data.msds_pdf_url) {
          btnDownloadMsds.disabled = false;
          if (icon) icon.textContent = "picture_as_pdf";
          if (text) text.textContent = "MSDS PDF";

          btnDownloadMsds.onclick = () => {
            globalThis.open(data.msds_pdf_url, "_blank");
          };
        } else {
          btnDownloadMsds.disabled = true;
          if (icon) icon.textContent = "block";
          if (text) text.textContent = "MSDS PDF 없음";
          btnDownloadMsds.onclick = null;
        }
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
              const baseTitle = (item.sbstnClsfTypeNm || "").trim() || `분류 ${idx + 1}`;
              const displayTitle = `${idx + 1}. ${baseTitle}`;
              const unq = item.unqNo || "-";
              const cont = item.contInfo || "-";
              const info = item.ancmntInfo || "-";
              const ymd = item.ancmntYmd || "-";
              return `
                <div class="hazard-acc-item">
                  <button class="hazard-acc-header" type="button">
                    <span class="hazard-acc-title">${displayTitle}</span>
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

      // ---------------------------------------------------------
      // 3D Viewer Logic
      // ---------------------------------------------------------
      const btn2d = document.getElementById("btn-view-2d");
      const btn3d = document.getElementById("btn-view-3d");
      const btnZoomIn = document.getElementById("btn-zoom-in");
      const btnZoomOut = document.getElementById("btn-zoom-out");
      const box2d = document.getElementById("detail-structure");
      const box3d = document.getElementById("detail-structure-3d");
      const structureWrapper = document.querySelector(".structure-wrapper");
      const _viewer3d = null;
      let currentZoom = 1.0;

      const applyZoom = () => {
        const target = box2d.style.display !== "none" ? box2d.querySelector("img, svg") : box3d.querySelector("iframe, canvas");
        if (target) {
          target.style.transform = `scale(${currentZoom})`;
        }
      };

      const setViewMode = (mode) => {
        const is2d = mode === "2d";
        if (structureWrapper) {
          structureWrapper.dataset.viewMode = mode;
        }
        btn2d.classList.toggle("active", is2d);
        btn3d.classList.toggle("active", !is2d);
        box2d.style.display = is2d ? "block" : "none";
        box3d.style.display = is2d ? "none" : "block";
        currentZoom = 1.0; // Reset zoom on switch
        applyZoom();
      };

      if (btn2d && btn3d && box2d && box3d) {
        if (structureWrapper) {
          structureWrapper.dataset.viewMode = "2d";
        }

        if (btnZoomIn && btnZoomOut) {
          btnZoomIn.onclick = () => {
            currentZoom += 0.2;
            applyZoom();
          };
          btnZoomOut.onclick = () => {
            currentZoom = Math.max(0.2, currentZoom - 0.2);
            applyZoom();
          };
        }

        btn2d.onclick = () => {
          setViewMode("2d");
        };

        // ---------------------------------------------------------
        // MOL Download Logic (Redesigned)
        // ---------------------------------------------------------
        const btnDownloadMol = document.getElementById("btn-download-mol-row");
        if (btnDownloadMol) {
          const icon = btnDownloadMol.querySelector(".icon");
          const text = btnDownloadMol.querySelector(".btn-text");

          if (data.Substance?.has_molfile) {
            btnDownloadMol.disabled = false;
            if (icon) icon.textContent = "download";
            if (text) text.textContent = "Mol";

            btnDownloadMol.onclick = () => {
              const substanceId = data.Substance.id;
              const casRn = data.Substance.cas_rn;
              if (!substanceId) return;

              try {
                const app = getApp();
                const fnBase = app.projectFunctionsBaseUrl || (app.supabaseUrl ? `${app.supabaseUrl}/functions/v1` : "");
                if (!fnBase) {
                  alert("함수 호출 경로를 찾을 수 없습니다.");
                  return;
                }

                const downloadUrl = `${fnBase}/casimport?type=download_mol&substance_id=${substanceId}`;

                const link = document.createElement('a');
                link.href = downloadUrl;
                link.setAttribute('download', `${casRn || 'structure'}.mol`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

              } catch (e) {
                console.error("Download failed:", e);
                alert("다운로드 요청 중 오류가 발생했습니다.");
              }
            };
          } else {
            btnDownloadMol.disabled = true;
            if (icon) icon.textContent = "block";
            if (text) text.textContent = "Mol 파일 없음";
            btnDownloadMol.onclick = null;
          }
        }

        btn3d.onclick = async () => {
          setViewMode("3d");

          const show3dFallback = () => {
            box3d.style.backgroundColor = "#f9f9f9";
            box3d.innerHTML =
              '<div class="structure-error" style="display:flex;align-items:center;justify-content:center;height:100%;">이 물질은 PubChem에서 3D 구조 데이터를 제공하지 않습니다.</div>';
          };

          // ?? iframe? ??? ?? ???? ??
          if (box3d.querySelector("iframe")) return;

          const casRn = data.Substance?.cas_rn;
          if (!casRn) {
            show3dFallback();
            return;
          }

          try {
            box3d.innerHTML = '<div class="structure-error" style="display:flex; align-items:center; justify-content:center; height:100%; color:#666;">PubChem 3D 구조를 읽는 중...</div>';

            // 1. Get CID
            const cid = await loadPubChemCid();
            if (!cid) {
              show3dFallback();
              return;
            }

            // 2. Check 3D availability via JSON; ??? iframe ????
            let has3d = false;
            try {
              const resp = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/JSON`);
              if (resp.ok) {
                const dataJson = await resp.json();
                const coords = dataJson?.PC_Compounds?.[0]?.coords || [];
                has3d = coords.some((c) => c?.type?.dimension === 3);
              }
            } catch (_) {
              has3d = false;
            }
            if (!has3d) {
              show3dFallback();
              return;
            }

            // 3. Embed Iframe directly
            const embedUrl = `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=3D-Conformer&embed=true`;
            box3d.style.backgroundColor = "#f9f9f9";
            box3d.innerHTML = `
              <iframe 
                src="${embedUrl}" 
                style="width: 100%; height: 100%; border: none;" 
                title="PubChem 3D Viewer"
                loading="lazy">
              </iframe>
            `;

            // 4. Fallback if iframe never loads or errors
            const iframeEl = box3d.querySelector("iframe");
            let loaded = false;
            const timeoutId = setTimeout(() => {
              if (!loaded) show3dFallback();
            }, 4000);

            if (iframeEl) {
              iframeEl.onload = () => {
                loaded = true;
                clearTimeout(timeoutId);
              };
              iframeEl.onerror = () => {
                loaded = true;
                clearTimeout(timeoutId);
                show3dFallback();
              };
            }

          } catch (_e) {
            show3dFallback();
          }
        };
      }

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
