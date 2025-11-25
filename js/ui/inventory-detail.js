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
    target.innerHTML = `<span class="structure-placeholder">援ъ“???대?吏 ?놁쓬</span>`;
  }

  async function loadInventoryDetail(id = null) {
    try {
      const supabase = getSupabase();
      const inventoryId = id || localStorage.getItem("selected_inventory_id");
      if (!inventoryId) {
        alert("?좏깮???ш퀬媛 ?놁뒿?덈떎.");
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

      const korName = data.Substance?.chem_name_kor || data.Substance?.substance_name || "?대쫫 ?놁쓬";
      const engName = data.Substance?.substance_name || "";

      document.getElementById("detail-name-kor").textContent = korName;
      document.getElementById("detail-name-eng").textContent = engName !== korName ? engName : "";

      const photoDiv = document.getElementById("detail-photo");
      const photoUrl = data.photo_url_320 || data.photo_url_160 || "";
      photoDiv.innerHTML = photoUrl
        ? `<img src="${photoUrl}" alt="?쒖빟 ?ъ쭊">`
        : `<span>?ъ쭊 ?놁쓬</span>`;

      document.getElementById("detail-name-kor").textContent = data.Substance?.chem_name_kor || "?대쫫 ?놁쓬";
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
      if (cab) locText += `${cab} `;

      let doorPart = "";
      const doorHVal = String(h || "").trim();
      let doorHLabel = "";
      if (hCount > 1) {
        if (doorHVal === "1") doorHLabel = "left";
        else if (doorHVal === "2") doorHLabel = "right";
        else doorHLabel = doorHVal;
      }

      if (v && doorHLabel) {
        doorPart = `${v}F ${doorHLabel}`;
      } else if (v) {
        doorPart = `${v}F`;
      } else if (doorHLabel) {
        doorPart = doorHLabel;
      }

      let shelfPart = "";
      const shelfVal = data.internal_shelf_level;
      const colVal = data.storage_column;

      if (shelfVal && colVal) {
        shelfPart = `${shelfVal} shelf ${colVal} col`;
      } else {
        if (shelfVal) shelfPart += `${shelfVal} shelf`;
        if (colVal) shelfPart += (shelfPart ? " " : "") + `${colVal} col`;
      }

      const detailParts = [doorPart, shelfPart].filter(Boolean).join(", ");
      if (detailParts) locText += detailParts;

      locText = locText.trim() || "Location: N/A";
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
            structureBox.innerHTML = '<span class="structure-placeholder">?대?吏 ?놁쓬</span>';
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
        label1: "蹂?섎냽??",
        label2: "蹂?섎냽??",
        value1: "-",
        value2: "-",
      };

      if (data.converted_concentration_value_1) {
        const unit1 = data.converted_concentration_unit_1;
        const unit1Norm = (unit1 || "").trim();
        if (unit1Norm.toUpperCase().startsWith("M")) convState.label1 = "紐곕냽??";
        else if (unit1Norm.includes("%")) convState.label1 = "?쇱꽱?몃냽??";
        else convState.label1 = "Conversion";
        convState.value1 = formatConvVal(data.converted_concentration_value_1, unit1);
      }

      if (data.converted_concentration_value_2) {
        const unit2 = data.converted_concentration_unit_2;
        const unit2Norm = (unit2 || "").trim();
        if (unit2Norm.toLowerCase().startsWith("m")) convState.label2 = "紐곕엫?띾룄:";
        else if (unit2Norm.includes("%")) convState.label2 = "?쇱꽱?몃냽??";
        else convState.label2 = "Conversion";
        convState.value2 = formatConvVal(data.converted_concentration_value_2, unit2);
      }

      const convLabel1El = document.getElementById("conv-label-1");
      const convLabel2El = document.getElementById("conv-label-2");
      const convValue1El = document.getElementById("conv-value-1");
      const convValue2El = document.getElementById("conv-value-2");

      const applyConvStyle = (el, value) => {
        if (!el) return;
        const undef = "정의 불가";
        const na = "의미 없음";
        el.classList.remove("text-muted-small", "text-conversion-undefined", "text-conversion-na");
        if (value && value.includes(`(${undef})`)) {
          el.innerHTML = `<span class="text-conversion-paren">(</span><span class="text-conversion-undefined-text">${undef}</span><span class="text-conversion-paren">)</span>`;
        } else if (value && value.includes(`(${na})`)) {
          el.innerHTML = `<span class="text-conversion-paren">(</span><span class="text-conversion-na-text">${na}</span><span class="text-conversion-paren">)</span>`;
        } else {
          el.textContent = value;
        }
      };
 
      applyConvStyle(convValue1El, convState.value1);
      applyConvStyle(convValue2El, convState.value2);

      const msdsTitles = [
        "1. ?뷀븰?쒗뭹怨??뚯궗??愿???뺣낫",
        "2. ?좏빐?굿룹쐞?섏꽦",
        "3. 援ъ꽦?깅텇??紐낆묶 諛??⑥쑀??,
        "4. ?묎툒議곗튂 ?붾졊",
        "5. ?붿옱 ??議곗튂諛⑸쾿",
        "6. ?꾩텧 ??議곗튂諛⑸쾿",
        "7. 痍④툒 諛???λ갑踰?,
        "8. ?몄텧諛⑹? 諛?媛쒖씤蹂댄샇援?,
        "9. 臾쇰━?뷀븰???뱀꽦",
        "10. ?덉젙??諛?諛섏쓳??,
        "11. ?낆꽦??愿???뺣낫",
        "12. ?섍꼍??誘몄튂???곹뼢",
        "13. ?먭린 ??二쇱쓽?ы빆",
        "14. ?댁넚???꾩슂???뺣낫",
        "15. 踰뺤쟻 洹쒖젣?꾪솴",
        "16. 洹?諛뽰쓽 李멸퀬?ы빆",
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
            let contentHtml = '<p class="text-gray-500 italic p-4">?댁슜 ?놁쓬 (?곗씠???숆린???꾩슂)</p>';

            if (sectionData && sectionData.content) {
              if (sectionNum === 2 && sectionData.content.includes("|||洹몃┝臾몄옄|||")) {
                const rows = sectionData.content.split(";;;");
                const rowsHtml = rows
                  .map((row) => {
                    const parts = row.split("|||");
                    if (parts.length >= 3) {
                      const [no, name, detail] = parts;

                      if (name.trim() === "洹몃┝臾몄옄") {
                        const ghsCodes = detail.trim().split(/\s+/).filter((s) => s.endsWith(".gif"));
                        if (ghsCodes.length > 0) {
                          const ghsTableRows = ghsCodes
                            .map((code) => {
                              const match = code.match(/GHS(\d+)\.gif/i);
                              if (match) {
                                const num = match[1];
                                const imgUrl = `https://hazmat.nfa.go.kr/design/images/contents/ghs-icon${num}.gif`;
                                const fullDesc = ghsMapping[num] || "遺꾨쪟 ?뺣낫 ?놁쓬";
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
            window.open(data.msds_pdf_url, "_blank");
          };
        } else {
          btnDownloadMsds.disabled = true;
          if (icon) icon.textContent = "block";
          if (text) text.textContent = "MSDS PDF ?놁쓬";
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
        console.error("?좏빐?뷀븰臾쇱쭏 ?뺣낫 議고쉶 ?ㅻ쪟:", hazardError);
        if (hazardContainer) hazardContainer.innerHTML = `<p class="text-red-500">?뺣낫 議고쉶 ?ㅽ뙣</p>`;
      } else if (hazardData && hazardData.length > 0) {
        if (hazardContainer) {
          const accordion = hazardData
            .map((item, idx) => {
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
          hazardContainer.innerHTML = "<p class='text-gray-500'>?대떦 臾쇱쭏???좏빐?뷀븰臾쇱쭏 遺꾨쪟 ?뺣낫媛 ?놁뒿?덈떎.</p>";
        }
      }

      document.getElementById("detail-back-btn")?.addEventListener("click", async () => {
        if (getApp().Inventory?.showListPage) {
          await getApp().Inventory.showListPage();
        }
      });

      document.getElementById("delete-inventory-btn")?.addEventListener("click", async () => {
        if (!confirm("?뺣쭚 ??젣?섏떆寃좎뒿?덇퉴?")) return;

        if (data.msds_pdf_url) {
          try {
            const url = data.msds_pdf_url;
            const fileName = url.substring(url.lastIndexOf("/") + 1);

            if (fileName) {
              const { error: storageError } = await supabase.storage.from("msds-pdf").remove([fileName]);

              if (storageError) {
                console.warn("PDF ?뚯씪 ??젣 ?ㅽ뙣:", storageError);
              }
            }
          } catch (err) {
            console.warn("PDF ??젣 泥섎━ ?ㅻ쪟:", err);
          }
        }

        const app = getApp();
        const fnBase =
          app.projectFunctionsBaseUrl || (app.supabaseUrl ? `${app.supabaseUrl}/functions/v1` : "");
        if (!fnBase) {
          alert("?⑥닔 ?몄텧 寃쎈줈瑜?李얠쓣 ???놁뒿?덈떎.");
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
          alert("??젣 ?ㅽ뙣: " + msg);
          return;
        }
        alert("??젣?섏뿀?듬땲??");
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
          alert("?몄쭛 紐⑤뱶濡??꾪솚 (援ы쁽 ?꾩슂)");
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

            btnDownloadMol.onclick = async () => {
              const substanceId = data.Substance.id;
              const casRn = data.Substance.cas_rn;
              if (!substanceId) return;

              try {
                const app = getApp();
                const fnBase = app.projectFunctionsBaseUrl || (app.supabaseUrl ? `${app.supabaseUrl}/functions/v1` : "");
                if (!fnBase) {
                  alert("?⑥닔 ?몄텧 寃쎈줈瑜?李얠쓣 ???놁뒿?덈떎.");
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
                alert("?ㅼ슫濡쒕뱶 ?붿껌 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.");
              }
            };
          } else {
            btnDownloadMol.disabled = true;
            if (icon) icon.textContent = "block";
            if (text) text.textContent = "Mol ?뚯씪 ?놁쓬";
            btnDownloadMol.onclick = null;
          }
        }

        btn3d.onclick = async () => {
          setViewMode("3d");

          const show3dFallback = () => {
            box3d.style.backgroundColor = "#f9f9f9";
            box3d.innerHTML =
              '<div class="structure-error" style="display:flex;align-items:center;justify-content:center;height:100%;">??臾쇱쭏? PubChem?먯꽌 3D 援ъ“ ?곗씠?곕? ?쒓났?섏? ?딆뒿?덈떎.</div>';
          };

          // ?? iframe? ??? ?? ???? ??
          if (box3d.querySelector("iframe")) return;

          const casRn = data.Substance?.cas_rn;
          if (!casRn) {
            show3dFallback();
            return;
          }

          try {
            box3d.innerHTML = '<div class="structure-error" style="display:flex; align-items:center; justify-content:center; height:100%; color:#666;">PubChem 3D 援ъ“瑜??쎈뒗 以?..</div>';

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
      console.error("?곸꽭 ?섏씠吏 濡쒕뱶 ?ㅻ쪟:", err);
      document.getElementById("detail-page-container").innerHTML = `<p>?ㅻ쪟: ${err.message}</p>`;
    }
  }

  globalThis.loadInventoryDetail = loadInventoryDetail;
})();

