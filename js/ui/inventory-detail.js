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
    target.innerHTML = `<span class="structure-placeholder">Íµ¨Ï°∞???¥Î?ÏßÄ ?ÜÏùå</span>`;
  }

  async function loadInventoryDetail(id = null) {
    try {
      const supabase = getSupabase();
      const inventoryId = id || localStorage.getItem("selected_inventory_id");
      if (!inventoryId) {
        alert("?†ÌÉù???¨Í≥†Í∞Ä ?ÜÏäµ?àÎã§.");
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

      const korName = data.Substance?.chem_name_kor || data.Substance?.substance_name || "?¥Î¶Ñ ?ÜÏùå";
      const engName = data.Substance?.substance_name || "";

      document.getElementById("detail-name-kor").textContent = korName;
      document.getElementById("detail-name-eng").textContent = engName !== korName ? engName : "";

      const photoDiv = document.getElementById("detail-photo");
      const photoUrl = data.photo_url_320 || data.photo_url_160 || "";
      photoDiv.innerHTML = photoUrl
        ? `<img src="${photoUrl}" alt="?úÏïΩ ?¨ÏßÑ">`
        : `<span>?¨ÏßÑ ?ÜÏùå</span>`;

      document.getElementById("detail-name-kor").textContent = data.Substance?.chem_name_kor || "?¥Î¶Ñ ?ÜÏùå";
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
        if (doorHVal === "1") doorHLabel = "\uC67C\uCABD";
        else if (doorHVal === "2") doorHLabel = "\uC624\uB978\uCABD";
        else doorHLabel = doorHVal;
      }

      if (v && doorHLabel) {
        doorPart = `${v}\uCE35 ${doorHLabel}\uBB38`;
      } else if (v) {
        doorPart = `${v}\uCE35\uBB38`;
      } else if (doorHLabel) {
        doorPart = `${doorHLabel}\uBB38`;
      }

      let shelfPart = "";
      const shelfVal = data.internal_shelf_level;
      const colVal = data.storage_column;

      if (shelfVal && colVal) {
        shelfPart = `${shelfVal}\uCE35 ${colVal}\uC5F4`;
      } else {
        if (shelfVal) shelfPart += `${shelfVal}\uCE35`;
        if (colVal) shelfPart += (shelfPart ? " " : "") + `${colVal}\uC5F4`;
      }

      const detailParts = [doorPart, shelfPart].filter(Boolean).join(", ");
      if (detailParts) locText += detailParts;

      locText = locText.trim() || "\uC704\uCE58: \uBBF8\uD655\uC778";
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
            structureBox.innerHTML = '<span class="structure-placeholder">?¥Î?ÏßÄ ?ÜÏùå</span>';
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
        label1: "Î≥Ä?òÎÜç??",
        label2: "Î≥Ä?òÎÜç??",
        value1: "-",
        value2: "-",
      };

      if (data.converted_concentration_value_1) {
        const unit1 = data.converted_concentration_unit_1;
        const unit1Norm = (unit1 || "").trim();
        if (unit1Norm.toUpperCase().startsWith("M")) convState.label1 = "Î™∞ÎÜç??";
        else if (unit1Norm.includes("%")) convState.label1 = "?ºÏÑº?∏ÎÜç??";
        else convState.label1 = "Conversion";
        convState.value1 = formatConvVal(data.converted_concentration_value_1, unit1);
      }

      if (data.converted_concentration_value_2) {
        const unit2 = data.converted_concentration_unit_2;
        const unit2Norm = (unit2 || "").trim();
        if (unit2Norm.toLowerCase().startsWith("m")) convState.label2 = "Î™∞ÎûÑ?çÎèÑ:";
        else if (unit2Norm.includes("%")) convState.label2 = "?ºÏÑº?∏ÎÜç??";
        else convState.label2 = "Conversion";
        convState.value2 = formatConvVal(data.converted_concentration_value_2, unit2);
      }

      const convLabel1El = document.getElementById("conv-label-1");
      const convLabel2El = document.getElementById("conv-label-2");
      const convValue1El = document.getElementById("conv-value-1");
      const convValue2El = document.getElementById("conv-value-2");
                  const renderConvValue = (el, rawVal) => {
        if (!el) return;
        const str = rawVal == null ? "-" : String(rawVal);
        const statusKey = str.includes("\uC758\uBBF8 \uC5C6\uC74C")
          ? "\uC758\uBBF8 \uC5C6\uC74C"
          : str.includes("\uC815\uC758 \uBD88\uAC00")
            ? "\uC815\uC758 \uBD88\uAC00"
            : null;
        el.classList.remove("text-muted-small");
        el.textContent = "";

        if (statusKey) {
          const statusToken = `(${statusKey})`;
          const baseText = str.replace(statusToken, "").trimEnd() || "-";
          const statusSpan = document.createElement("span");
          statusSpan.textContent = statusToken;
          statusSpan.className =
            statusKey === "\uC758\uBBF8 \uC5C6\uC74C" ? "text-conversion-na-text" : "text-conversion-undefined-text";
          statusSpan.style.whiteSpace = "nowrap";

          el.textContent = baseText;
          if (baseText && !baseText.endsWith(" ")) {
            el.appendChild(document.createTextNode(" "));
          }
          el.appendChild(statusSpan);
        } else {
          el.textContent = str;
        }
      };

      if (convLabel1El) convLabel1El.textContent = convState.label1;
      if (convLabel2El) convLabel2El.textContent = convState.label2;
      if (convValue1El) renderConvValue(convValue1El, convState.value1);
      if (convValue2El) renderConvValue(convValue2El, convState.value2);


            const msdsTitles = [
        "1. \uD654\uD559\uC81C\uD488\uACFC \uD68C\uC0AC\uC5D0 \uB300\uD55C \uC815\uBCF4",
        "2. \uC720\uD574\uC131\u00B7\uC704\uD5D8\uC131",
        "3. \uAD6C\uC131\uC131\uBD84\uC758 \uBA85\uCE6D \uBC0F \uD568\uC720\uB7C9",
        "4. \uC751\uAE09\uC870\uCE58 \uC694\uB839",
        "5. \uD654\uC7A5 \uC2DC \uC870\uCE58\uBC29\uBC95",
        "6. \uB204\uCD9C \uC2DC \uC870\uCE58\uBC29\uBC95",
        "7. \uCDE8\uAE09 \uBC0F \uC800\uC7A5\uBC29\uBC95",
        "8. \uB178\uCD9C\uBC29\uC9C0 \uBC0F \uAC1C\uC778\uBCF4\uD638\uAD6C",
        "9. \uBB3C\uB9AC\uD654\uD559\uC801 \uD2B9\uC131",
        "10. \uC548\uC815\uC131 \uBC0F \uBC18\uC751\uC131",
        "11. \uB3C5\uC131\uC5D0 \uAD00\uD55C \uC815\uBCF4",
        "12. \uD658\uACBD\uC5D0 \uBBF8\uCE5C\uB294 \uC601\uD5A5",
        "13. \uD3D0\uAE30 \uC2DC \uC8FC\uC758\uC0AC\uD56D",
        "14. \uC6B4\uC1A1\uC5D0 \uD544\uC694\uD55C \uC815\uBCF4",
        "15. \uBC95\uC801 \uADDC\uC81C\uD604\uD669",
        "16. \uADF8 \uBC16\uC758 \uCC38\uACE0\uC0AC\uD56D",
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
            let contentHtml = '<p class="text-gray-500 italic p-4">?¥Ïö© ?ÜÏùå (?∞Ïù¥???ôÍ∏∞???ÑÏöî)</p>';

            if (sectionData && sectionData.content) {
              if (sectionNum === 2 && sectionData.content.includes("|||Í∑∏Î¶ºÎ¨∏Ïûê|||")) {
                const rows = sectionData.content.split(";;;");
                const rowsHtml = rows
                  .map((row) => {
                    const parts = row.split("|||");
                    if (parts.length >= 3) {
                      const [no, name, detail] = parts;

                      if (name.trim() === "Í∑∏Î¶ºÎ¨∏Ïûê") {
                        const ghsCodes = detail.trim().split(/\s+/).filter((s) => s.endsWith(".gif"));
                        if (ghsCodes.length > 0) {
                          const ghsTableRows = ghsCodes
                            .map((code) => {
                              const match = code.match(/GHS(\d+)\.gif/i);
                              if (match) {
                                const num = match[1];
                                const imgUrl = `https://hazmat.nfa.go.kr/design/images/contents/ghs-icon${num}.gif`;
                                const fullDesc = ghsMapping[num] || "Î∂ÑÎ•ò ?ïÎ≥¥ ?ÜÏùå";
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
          if (text) text.textContent = "MSDS PDF ?ÜÏùå";
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
        console.error("?†Ìï¥?îÌïôÎ¨ºÏßà ?ïÎ≥¥ Ï°∞Ìöå ?§Î•ò:", hazardError);
        if (hazardContainer) hazardContainer.innerHTML = `<p class="text-red-500">?ïÎ≥¥ Ï°∞Ìöå ?§Ìå®</p>`;
      } else if (hazardData && hazardData.length > 0) {
        if (hazardContainer) {
          const accordion = hazardData
            .map((item, idx) => {
              const baseTitle = (item.sbstnClsfTypeNm || "").trim() || `Î∂ÑÎ•ò ${idx + 1}`;
              const displayTitle = `${idx + 1}. ${baseTitle}`;
              const unq = item.unqNo || "-";
              const cont = item.contInfo || "-";
              const info = item.ancmntInfo || "-";
              const ymd = item.ancmntYmd || "-";
              return `
                <div class="hazard-acc-item">
                  <button class="hazard-acc-header" type="button">
                    <span class="hazard-acc-title">${displayTitle}</span>
                    <span class="hazard-acc-arrow" aria-hidden="true">??/span>
                  </button>
                  <div class="hazard-acc-content">
                    <table class="hazard-table">
                      <thead>
                        <tr>
                          <th>Í≥†Ïú† Î≤àÌò∏</th>
                          <th>?¥Ïö©</th>
                          <th>Í≥†Ïãú ?ïÎ≥¥</th>
                          <th>Í≥†Ïãú ?ºÏûê</th>
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
          hazardContainer.innerHTML = "<p class='text-gray-500'>?¥Îãπ Î¨ºÏßà???†Ìï¥?îÌïôÎ¨ºÏßà Î∂ÑÎ•ò ?ïÎ≥¥Í∞Ä ?ÜÏäµ?àÎã§.</p>";
        }
      }

      document.getElementById("detail-back-btn")?.addEventListener("click", async () => {
        if (getApp().Inventory?.showListPage) {
          await getApp().Inventory.showListPage();
        }
      });

      document.getElementById("delete-inventory-btn")?.addEventListener("click", async () => {
        if (!confirm("?ïÎßê ??†ú?òÏãúÍ≤†Ïäµ?àÍπå?")) return;

        if (data.msds_pdf_url) {
          try {
            const url = data.msds_pdf_url;
            const fileName = url.substring(url.lastIndexOf("/") + 1);

            if (fileName) {
              const { error: storageError } = await supabase.storage.from("msds-pdf").remove([fileName]);

              if (storageError) {
                console.warn("PDF ?åÏùº ??†ú ?§Ìå®:", storageError);
              }
            }
          } catch (err) {
            console.warn("PDF ??†ú Ï≤òÎ¶¨ ?§Î•ò:", err);
          }
        }

        const app = getApp();
        const fnBase =
          app.projectFunctionsBaseUrl || (app.supabaseUrl ? `${app.supabaseUrl}/functions/v1` : "");
        if (!fnBase) {
          alert("?®Ïàò ?∏Ï∂ú Í≤ΩÎ°úÎ•?Ï∞æÏùÑ ???ÜÏäµ?àÎã§.");
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
          alert("??†ú ?§Ìå®: " + msg);
          return;
        }
        alert("??†ú?òÏóà?µÎãà??");
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
          alert("?∏Ïßë Î™®ÎìúÎ°??ÑÌôò (Íµ¨ÌòÑ ?ÑÏöî)");
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
                  alert("?®Ïàò ?∏Ï∂ú Í≤ΩÎ°úÎ•?Ï∞æÏùÑ ???ÜÏäµ?àÎã§.");
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
                alert("?§Ïö¥Î°úÎìú ?îÏ≤≠ Ï§??§Î•òÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§.");
              }
            };
          } else {
            btnDownloadMol.disabled = true;
            if (icon) icon.textContent = "block";
            if (text) text.textContent = "Mol ?åÏùº ?ÜÏùå";
            btnDownloadMol.onclick = null;
          }
        }

        btn3d.onclick = async () => {
          setViewMode("3d");

          const show3dFallback = () => {
            box3d.style.backgroundColor = "#f9f9f9";
            box3d.innerHTML =
              '<div class="structure-error" style="display:flex;align-items:center;justify-content:center;height:100%;">??Î¨ºÏßà?Ä PubChem?êÏÑú 3D Íµ¨Ï°∞ ?∞Ïù¥?∞Î? ?úÍ≥µ?òÏ? ?äÏäµ?àÎã§.</div>';
          };

          // ?? iframe? ??? ?? ???? ??
          if (box3d.querySelector("iframe")) return;

          const casRn = data.Substance?.cas_rn;
          if (!casRn) {
            show3dFallback();
            return;
          }

          try {
            box3d.innerHTML = '<div class="structure-error" style="display:flex; align-items:center; justify-content:center; height:100%; color:#666;">PubChem 3D Íµ¨Ï°∞Î•??ΩÎäî Ï§?..</div>';

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
      console.error("?ÅÏÑ∏ ?òÏù¥ÏßÄ Î°úÎìú ?§Î•ò:", err);
      document.getElementById("detail-page-container").innerHTML = `<p>?§Î•ò: ${err.message}</p>`;
    }
  }

  globalThis.loadInventoryDetail = loadInventoryDetail;
})();

