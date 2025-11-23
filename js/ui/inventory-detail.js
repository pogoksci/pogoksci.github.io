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
      const massSolute = v; // g per 100 g solution
      const totalMass = 100; // g
      const solutionVolumeL = (totalMass / rho) / 1000;
      const moles = massSolute / mw;
      result.molarity = solutionVolumeL > 0 ? moles / solutionVolumeL : null;
      const solventMassKg = (totalMass - massSolute) / 1000;
      result.molality = solventMassKg > 0 ? moles / solventMassKg : null;
      result.percent = v;
    } else if (unit === "M" || unit === "N") {
      const effectiveM = v; // Treat N ~ M (valence unknown)
      const solutionMassG = rho * 1000; // mass of 1 L solution
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
        console.warn("SVG ?뚯떛 ?ㅽ뙣:", e);
      }
    }
    target.innerHTML = `<span class="structure-placeholder">구조 이미지 없음</span>`;
  }

  async function loadInventoryDetail(id = null) {
    try {
      const supabase = getSupabase();
      const inventoryId = id || localStorage.getItem("selected_inventory_id");
      if (!inventoryId) {
        alert("?섎せ???묎렐?낅땲??");
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
            Properties ( boiling_point, melting_point, density ),
            MSDS ( section_number, content ),
            HazardClassifications (*)
          ),
          Cabinet ( id, cabinet_name, area_id, Area ( id, area_name ) )
        `)
        .eq("id", inventoryId)
        .single();

      if (error) throw error;

      // 1. Header Name (Dual)
      const korName = data.Substance?.chem_name_kor || data.Substance?.substance_name || "?대쫫 ?놁쓬";
      const engName = data.Substance?.substance_name || "";

      document.getElementById("detail-name-kor").textContent = korName;
      document.getElementById("detail-name-eng").textContent = engName !== korName ? engName : "";

      // 2. Photo
      const photoDiv = document.getElementById("detail-photo");
      const photoUrl = data.photo_url_320 || data.photo_url_160 || "";
      photoDiv.innerHTML = photoUrl
        ? `<img src="${photoUrl}" alt="?쒖빟蹂??ъ쭊">`
        : `<span>?ъ쭊 ?놁쓬</span>`;

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
      const _shelf = data.internal_shelf_level != null ? `${data.internal_shelf_level}?? : "";
      const _col = data.storage_column != null ? `${data.storage_column}?? : "";

      let locText = "";
      if (area) locText += area + " ";
      if (cab) locText += `??{cab}??`;

      let doorPart = "";
      const doorHVal = String(h || "").trim();
      let doorHLabel = "";
      if (doorHVal === "1") doorHLabel = "?쇱そ";
      else if (doorHVal === "2") doorHLabel = "?ㅻⅨ履?;
      else doorHLabel = doorHVal;

      if (v && doorHLabel) {
        doorPart = `${v}痢?${doorHLabel}臾?;
      } else if (v) {
        doorPart = `${v}痢듬Ц`;
      } else if (doorHLabel) {
        doorPart = `${doorHLabel}臾?;
      }

      let shelfPart = "";
      const shelfVal = data.internal_shelf_level;
      const colVal = data.storage_column;

      if (shelfVal && colVal) {
        shelfPart = `${shelfVal}??${colVal}??;
      } else {
        if (shelfVal) shelfPart += `${shelfVal}??;
        if (colVal) shelfPart += (shelfPart ? " " : "") + `${colVal}??;
      }

      const detailParts = [doorPart, shelfPart].filter(Boolean).join(", ");
      if (detailParts) locText += detailParts;

      locText = locText.trim() || "?꾩튂: 誘몄???;
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

      // Structure & properties + conversions
      const propsRaw = data.Substance?.Properties;
      const props = Array.isArray(propsRaw) ? propsRaw[0] : propsRaw;
      renderSvg(data.Substance?.svg_image, document.getElementById("detail-structure"));

      document.getElementById("detail-boiling").textContent = formatTemp(props?.boiling_point);
      document.getElementById("detail-melting").textContent = formatTemp(props?.melting_point);
      document.getElementById("detail-density").textContent = formatDensity(props?.density);

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
        density: props?.density,
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


      // 4. MSDS Accordion
      const msdsTitles = [
        "1. ?뷀븰?쒗뭹怨??뚯궗??愿???뺣낫",
        "2. ?좏빐?굿룹쐞?섏꽦",
        "3. 援ъ꽦?깅텇??紐낆묶 諛??⑥쑀??,
        "4. ?묎툒議곗튂 ?붾졊",
        "5. ??컻쨌?붿옱???泥섎갑踰?,
        "6. ?꾩텧 ?ш퀬???泥섎갑踰?,
        "7. 痍④툒 諛???λ갑踰?,
        "8. ?몄텧諛⑹? 諛?媛쒖씤蹂댄샇援?,
        "9. 臾쇰━?뷀븰???뱀꽦",
        "10. ?덉젙??諛?諛섏쓳??,
        "11. ?낆꽦??愿???뺣낫",
        "12. ?섍꼍??誘몄튂???곹뼢",
        "13. ?먭린??二쇱쓽?ы빆",
        "14. ?댁넚???꾩슂???뺣낫",
        "15. 踰뺤쟻 洹쒖젣?꾪솴",
        "16. 洹?諛뽰쓽 李멸퀬?ы빆"
      ];

      const ghsMapping = {
        "01": "?띤룺諛쒖꽦(Explosive)\n쨌 遺덉븞?뺥븳 ??컻臾?n쨌 ??컻臾?n쨌 ?먭린諛섏쓳??臾쇱쭏 諛??쇳빀臾?n쨌 ?좉린怨쇱궛?붾Ъ",
        "02": "?띠씤?붿꽦(Flammable)\n쨌 ?명솕??媛??n쨌 媛?곗꽦 ?먯뼱濡쒖「\n쨌 ?명솕???≪껜\n쨌 ?명솕??怨좎껜\n쨌 ?먭린諛섏쓳??臾쇱쭏 諛??쇳빀臾?n쨌 諛쒗솕???≪껜\n쨌 諛쒗솕??怨좎껜\n쨌 媛?곗꽦 怨좎껜\n쨌 媛?곗꽦 ?≪껜\n쨌 ?먯껜 諛쒖뿴 臾쇱쭏 諛??쇳빀臾?n쨌 臾쇨낵 ?묒큺?섏뿬 媛?곗꽦 媛?ㅻ? 諛⑹텧?섎뒗 臾쇱쭏 諛??쇳빀臾?n쨌 ?좉린 怨쇱궛?붾Ъ",
        "03": "?띠궛?붿꽦(Oxidizing)\n쨌 ?고솕 媛??n쨌 ?고솕???≪껜\n쨌 ?고솕??怨좎껜",
        "04": "?띔퀬??媛??Compressed Gas)\n쨌 ?뺤텞 媛??n쨌 ?≫솕 媛??n쨌 ?됱옣 ?≫솕 媛??n쨌 ?⑹〈 媛??,
        "05": "?띕??앹꽦(Corrosive)\n쨌 湲덉냽 遺?앹꽦\n쨌 ??컻臾?n쨌 ?명솕??媛??n쨌 ?먭린 諛섏쓳?깅Ъ吏?諛??쇳빀臾?n쨌 ?좉린 怨쇱궛?붾Ъ\n쨌 ?쇰?遺??n쨌 ?ш컖?????먯긽",
        "06": "?띠쑀?낆꽦(Toxic)\n쨌 湲됱꽦 ?낆꽦",
        "07": "?띔꼍怨?Health Hazard, Hazardous to Ozone Layer)\n쨌 湲됱꽦 ?낆꽦\n쨌 ?쇰? ?먭레??n쨌 ???먭레??n쨌 ?쇰? 怨쇰???n쨌 ?뱀젙 ?쒖쟻 ?κ린 ?낆꽦(?명씉湲??먭레, 留덉빟 ?④낵)",
        "08": "?띔굔媛??좏빐??Serious Health hazard)\n쨌 ?명씉湲?怨쇰???n쨌 ?앹떇?명룷 蹂?댁썝??n쨌 諛쒖븫??n쨌 ?앹떇?낆꽦\n쨌 ?뱀젙?쒖쟻?κ린 ?낆꽦\n쨌 ?≪씤 ?꾪뿕",
        "09": "?띠닔???섍꼍 ?좊룆??Hazardous to the Environment)\n쨌 ?섏깮?섍꼍 ?좏빐??,
      };

      const msdsData = data.Substance?.MSDS || [];
      const accordionContainer = document.getElementById("msds-accordion");

      if (accordionContainer) {
        accordionContainer.innerHTML = msdsTitles.map((title, index) => {
          const sectionNum = index + 1;
          const sectionData = msdsData.find(d => d.section_number === sectionNum);
          let contentHtml = '<p class="text-gray-500 italic p-4">?댁슜 ?놁쓬 (?곗씠???곕룞 ?꾩슂)</p>';

          if (sectionData && sectionData.content) {
            // Special handling for Section 2 (Hazard Info) GHS Pictograms
            if (sectionNum === 2 && sectionData.content.includes("|||洹몃┝臾몄옄|||")) {
              const rows = sectionData.content.split(";;;");
              const rowsHtml = rows.map(row => {
                const parts = row.split("|||");
                if (parts.length >= 3) {
                  const [no, name, detail] = parts;

                  // Check for GHS Pictograms
                  if (name.trim() === "洹몃┝臾몄옄") {
                    const ghsCodes = detail.trim().split(/\s+/).filter(s => s.endsWith(".gif"));
                    if (ghsCodes.length > 0) {
                      const ghsTableRows = ghsCodes.map(code => {
                        // Extract number (e.g., GHS01.gif -> 01)
                        const match = code.match(/GHS(\d+)\.gif/i);
                        if (match) {
                          const num = match[1];
                          const imgUrl = `https://hazmat.nfa.go.kr/design/images/contents/ghs-icon${num}.gif`;
                          const fullDesc = ghsMapping[num] || "?ㅻ챸 ?놁쓬";
                          const lines = fullDesc.split('\n');
                          const titleLine = lines[0];
                          const detailLines = lines.slice(1).join('<br>');

                          let korName = titleLine.replace('??, '').trim();
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

      // 6. Hazard Info
      const hazardContainer = document.getElementById("hazard-info-container");
      const _hazards = data.Substance?.HazardClassifications || [];
      const substanceId = data.Substance?.id;


      // ?뚯씠釉??뺥깭濡??쒖떆
      // 3. ?좏빐?뷀븰臾쇱쭏 遺꾨쪟 ?뺣낫 (HazardClassifications)
      const { data: hazardData, error: hazardError } = await supabase
        .from("HazardClassifications")
        .select("*")
        .eq("substance_id", substanceId);

      if (hazardError) {
        console.error("?좏빐?뷀븰臾쇱쭏 ?뺣낫 議고쉶 ?ㅻ쪟:", hazardError);
        if (hazardContainer) hazardContainer.innerHTML = `<p class="text-red-500">?뺣낫 議고쉶 ?ㅽ뙣</p>`;
      } else if (hazardData && hazardData.length > 0) {
        if (hazardContainer) {
          const accordion = hazardData.map((item, idx) => {
            const title = item.sbstnClsfTypeNm || `遺꾨쪟 ${idx + 1}`;
            const unq = item.unqNo || "-";
            const cont = item.contInfo || "-";
            const info = item.ancmntInfo || "-";
            const ymd = item.ancmntYmd || "-";
            return `
              <div class="hazard-acc-item">
                <button class="hazard-acc-header" type="button">
                  <span class="hazard-acc-title">${title}</span>
                  <span class="hazard-acc-arrow" aria-hidden="true">??/span>
                </button>
                <div class="hazard-acc-content">
                  <table class="hazard-table">
                    <thead>
                      <tr>
                        <th>怨좎쑀 踰덊샇</th>
                        <th>?댁슜</th>
                        <th>怨좎떆 ?뺣낫</th>
                        <th>怨좎떆 ?쇱옄</th>
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
          }).join("");

          hazardContainer.innerHTML = `<div class="hazard-accordion">${accordion}</div>`;

          hazardContainer.querySelectorAll(".hazard-acc-header").forEach((btn) => {
            btn.addEventListener("click", () => {
              btn.parentElement.classList.toggle("open");
            });
          });
        }
      } else {
        if (hazardContainer) {
          hazardContainer.innerHTML = "<p class='text-gray-500'>?대떦 臾쇱쭏??????좏빐?뷀븰臾쇱쭏 遺꾨쪟 ?뺣낫媛 ?놁뒿?덈떎.</p>";
        }
      }
      // 紐⑸줉?쇰줈
      document.getElementById("detail-back-btn")?.addEventListener("click", async () => {
        if (getApp().Inventory?.showListPage) {
          await getApp().Inventory.showListPage();
        }
      });

      // ??젣
      document.getElementById("delete-inventory-btn")?.addEventListener("click", async () => {
        if (!confirm("?뺣쭚 ??젣?섏떆寃좎뒿?덇퉴?")) return;

        // ?뿊截?MSDS PDF ?뚯씪 ??젣
        if (data.msds_pdf_url) {
          try {
            // URL?먯꽌 ?뚯씪紐?異붿텧 (?? .../msds-pdf/filename.pdf)
            const url = data.msds_pdf_url;
            const fileName = url.substring(url.lastIndexOf('/') + 1);

            if (fileName) {
              console.log("?뿊截?MSDS PDF ??젣 ?쒕룄:", fileName);
              const { error: storageError } = await supabase.storage
                .from('msds-pdf')
                .remove([fileName]);

              if (storageError) {
                console.warn("?좑툘 PDF ?뚯씪 ??젣 ?ㅽ뙣:", storageError);
              } else {
                console.log("??PDF ?뚯씪 ??젣 ?꾨즺");
              }
            }
          } catch (err) {
            console.warn("?좑툘 PDF ??젣 泥섎━ 以??ㅻ쪟:", err);
          }
        }

        const app = getApp();
        const fnBase =
          app.projectFunctionsBaseUrl ||
          (app.supabaseUrl ? `${app.supabaseUrl}/functions/v1` : "");
        if (!fnBase) {
          alert("?⑥닔 ?몄텧 寃쎈줈瑜?李얠쓣 ???놁뒿?덈떎.");
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
          alert("??젣 ?ㅽ뙣: " + msg);
          return;
        }
        alert("??젣?섏뿀?듬땲??");
        // 紐⑸줉?쇰줈 蹂듦?
        if (getApp().Inventory?.showListPage) {
          await getApp().Inventory.showListPage();
        }
      });

      // ?섏젙
      document.getElementById("edit-inventory-btn")?.addEventListener("click", async () => {
        if (getApp().Router?.go && getApp().Forms?.initInventoryForm) {
          await getApp().Router.go("addInventory", "form-container", () =>
            getApp().Forms.initInventoryForm("edit", data),
          );
        } else {
          alert("???섏젙 紐⑤뱶濡??꾪솚 (援ы쁽 ?꾩슂)");
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
              console.log("?봽 Auto-update check:", result);
              if (result.status === "updated") {
                console.log("??MSDS updated. Reloading page...");
                // Reload current page to show new data
                loadInventoryDetail(inventoryId);
              }
            }
          } catch (e) {
            console.warn("?좑툘 Auto-update check failed:", e);
          }
        };
        // Run in background
        checkUpdate();
      }

    } catch (err) {
      console.error("?곸꽭 ?섏씠吏 濡쒕뱶 ?ㅻ쪟:", err);
      document.getElementById("detail-page-container").innerHTML = `<p>???ㅻ쪟: ${err.message}</p>`;
    }
  }

  globalThis.loadInventoryDetail = loadInventoryDetail;
})();



