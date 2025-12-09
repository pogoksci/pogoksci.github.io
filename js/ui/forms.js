// ================================================================
// /js/ui/forms.js — 폼 상태/UI 관리 (App.Forms)
// ================================================================
(function () {
  console.log("🧾 App.Forms 모듈 로드됨");

  const { setupButtonGroup, makePayload } = App.Utils;
  const { set, reset, dump, get } = App.State;
  const { start: startCamera, setupModalListeners, processImage } = App.Camera;
  const supabase = App.supabase;

  let inventoryStream = null; // Track inventory camera stream globally within module
  let cabinetStream = null; // Track cabinet camera stream globally within module

  // -------------------------------------------------
  // 💾 시약장 저장
  // -------------------------------------------------

  // -------------------------------------------------
  // 🧮 공병 질량 계산 함수
  // -------------------------------------------------
  function calculateBottleMass(volume, type) {
    if (!volume || !type) return null;

    const v = Number(volume);
    const t = String(type).trim().replace(/\s+/g, ""); // 공백 제거

    // 1. 유리 (갈색유리, 투명유리)
    if (t.includes("유리")) {
      if (v === 25) return 65;
      if (v === 100) return 120;
      if (v === 500) return 400;
      if (v === 1000) return 510;
    }

    // 2. 플라스틱
    if (t.includes("플라스틱")) {
      if (v === 500) {
        if (t.includes("반투명")) return 40;
        if (t.includes("갈색")) return 80;
        if (t.includes("흰색")) return 75;
      }
    }

    return null; // 매칭되는 조건 없음
  }
  async function handleSave() {
    try {
      const state = dump();
      const payload = await makePayload(state);
      if (!payload.cabinet_name) return alert("시약장 이름을 입력하거나 선택하세요.");
      if (!payload.area_name) return alert("시약장 위치를 선택하세요.");

      if (state.mode === "create") {
        await App.Cabinet.createCabinet(payload);
        alert("✅ 시약장이 등록되었습니다.");
      } else {
        await App.Cabinet.updateCabinet(state.cabinetId, payload);
        alert("✅ 시약장 정보가 수정되었습니다.");
      }

      await App.includeHTML("pages/location-list.html", "form-container");
      App.Cabinet.loadList?.();
    } catch (err) {
      console.error("❌ handleSave 오류:", err);
      alert("저장 중 오류가 발생했습니다.");
    }
  }

  // -------------------------------------------------
  // 🧪 약품 입고 폼 초기화
  // -------------------------------------------------
  async function initInventoryForm(mode = "create", detail = null) {
    window.scrollTo(0, 0); // Force scroll to top
    await App.includeHTML("pages/inventory-form.html", "form-container");
    reset();
    set("mode", mode);

    // 🏷 타이틀 & 버튼 제어
    const title = document.querySelector("#inventory-form h1");
    const submitBtn = document.getElementById("inventory-submit-button");
    const statusMsg = document.getElementById("statusMessage");

    if (title) {
      title.textContent = mode === "edit" ? "약품 정보 수정" : "약품 입고 정보 입력";
    }

    if (submitBtn) {
      submitBtn.textContent = mode === "edit" ? "수정 완료" : "약품 입고 정보 저장";
    }

    // ✅ State 복원 (Edit 모드)
    if (detail) {
      set("inventoryId", detail.id);
      set("cas_rn", detail.Substance?.cas_rn);
      set("purchase_volume", detail.purchase_volume);
      set("unit", detail.unit);
      set("purchase_volume", detail.purchase_volume);
      set("unit", detail.unit);
      set("bottle_type", detail.bottle_type);
      set("bottle_identifier", detail.bottle_identifier); // ✅ 식별자 복원
      set("classification", detail.classification);
      set("status", detail.status);
      set("concentration_value", detail.concentration_value);
      set("concentration_unit", detail.concentration_unit);
      set("manufacturer", detail.manufacturer);
      set("purchase_date", detail.purchase_date);

      // Location logic needs helper or manual set
      // For now, let's just set the basics. Location restoration is complex and usually requires cascading selects.
      // We can trigger the first select change if we have area_id.

      requestAnimationFrame(() => {
        // 1. Inputs
        const setInput = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.value = val || "";
        };
        if (detail.Substance?.cas_rn) {
          const casEl = document.getElementById("cas_rn");
          if (casEl) {
            casEl.value = detail.Substance.cas_rn;
            casEl.readOnly = true;
            casEl.style.backgroundColor = "#f0f0f0";
            // Remove previous listeners if any (clone node or assume fresh form)
            // Since form is re-injected, listener is fresh.
            casEl.onclick = () => {
              alert("⚠️ CAS 번호는 수정할 수 없습니다.\n약품 종류가 변경되었다면 [새 약품 등록]을 이용해주세요.");
            };
          }
        } else {
          setInput("cas_rn", "");
        }
        setInput("purchase_volume", detail.current_amount); // CHANGED: initial_amount -> current_amount
        setInput("concentration_value", detail.concentration_value);
        setInput("purchase_date", detail.purchase_date);

        // 2. Buttons
        // We need to wait for setupButtonGroup to run? No, DOM is there.
        // But we need to ensure 'active' class is added.
        // The groups array is defined below, let's use a helper or manual loop.

        const setBtnGroup = (groupId, val) => {
          console.log(`[setBtnGroup] Group: ${groupId}, Value to match: "${val}"`);
          const group = document.getElementById(groupId);
          if (!group) {
            console.warn(`[setBtnGroup] Group element not found for ID: ${groupId}`);
            return false;
          }
          let matched = false;
          // Normalize value for comparison (trim)
          const normalize = (s) => String(s || "").trim();
          const targetVal = normalize(val);

          Array.from(group.children).forEach(btn => {
            const btnVal = normalize(btn.dataset.value);
            console.log(`  - Button: "${btn.textContent}" (data-value: "${btnVal}")`);
            if (btnVal === targetVal) {
              btn.classList.add("active");
              matched = true;
              console.log(`    -> Matched! Setting active.`);
            } else {
              btn.classList.remove("active");
            }
          });
          if (!matched) {
            console.log(`[setBtnGroup] No match found for group "${groupId}" with value "${val}"`);
          }
          return matched;
        };

        setBtnGroup("unit_buttons", detail.unit);

        // Bottle Type Restoration (Mass -> Type -> Text)
        let inferredType = null;
        const mass = Number(detail.bottle_mass);
        const vol = Number(detail.current_amount); // saved as current_amount in DB

        if (mass && vol) {
          // Mapping based on calculateBottleMass logic & user input
          // Glass often used masses:
          if ((vol === 25 && mass === 65) ||
            (vol === 100 && mass === 120) ||
            (vol === 500 && mass === 400) ||
            (vol === 1000 && mass === 510)) {
            inferredType = "갈색유리"; // Default to Brown Glass as per user request for 400g
          }
          // Plastic (typically 500ml references in logic)
          else if (vol === 500) {
            if (mass === 40) inferredType = "PE"; // Semi-transparent
            else if (mass === 80) inferredType = "PE"; // Brown Plastic
            else if (mass === 75) inferredType = "PP"; // White Plastic
          }
        }

        const rawBottleVal = inferredType || detail.bottle_identifier || detail.bottle_type;

        const bottleMap = {
          "Brown Glass": "갈색유리", "Clear Glass": "투명유리",
          "Brown": "갈색유리", "Clear": "투명유리",
          "PE": "PE", "PP": "PP", "Metal": "금속", "Stainless": "스텐",
          "Aluminum": "알루미늄", "Others": "기타"
        };

        const finalBottleVal = bottleMap[rawBottleVal] || rawBottleVal;
        console.log(`[BottleRestore] Mass: ${mass}, Vol: ${vol} -> Inferred: ${inferredType}, Final: ${finalBottleVal}`);

        setBtnGroup("bottle_type_buttons", finalBottleVal);

        setBtnGroup("classification_buttons", detail.classification);
        setBtnGroup("state_buttons", detail.state); // CHANGED: status -> state
        setBtnGroup("concentration_unit_buttons", detail.concentration_unit);

        // Manufacturer special handling
        const manVal = detail.manufacturer;
        const manufacturerMatched = setBtnGroup("manufacturer_buttons", manVal);

        if (!manufacturerMatched && manVal) {
          // Assume custom/other
          const otherBtn = document.querySelector("#manufacturer_buttons button[data-value='기타']");
          if (otherBtn) otherBtn.classList.add("active");

          const otherGroup = document.getElementById("other_manufacturer_group");
          if (otherGroup) otherGroup.style.display = "block";
          const manInput = document.getElementById("manufacturer_other");
          if (manInput) manInput.value = manVal;
          // Update state to reflect custom mode?
          set("manufacturer", null); // "기타" -> null so makePayload uses custom value
          set("manufacturer_custom", manVal);
        }

        // 3. Photo
        if (detail.photo_url_320 || detail.photo_url_160) {
          const url = detail.photo_url_320 || detail.photo_url_160;
          const img = document.getElementById("preview-img");
          const placeholder = document.querySelector("#photo-preview .placeholder-text");
          if (img) {
            img.src = url;
            img.style.display = "block";
          }
          if (placeholder) placeholder.style.display = "none";
        }
      });
    }

    // ------------------------------------------------------------
    // 버튼 그룹 설정
    // ------------------------------------------------------------
    const groups = [
      "unit_buttons",
      "bottle_type_buttons",
      "classification_buttons",
      "state_buttons",
      "concentration_unit_buttons",
      "manufacturer_buttons",
      "manufacturer_buttons",
      // Location buttons are handled dynamically in location logic
    ];

    // ------------------------------------------------------------
    // 🧮 공병 질량 자동 계산 리스너 (Auto-Calculate Mass)
    // ------------------------------------------------------------
    const updateMass = () => {
      const vol = document.getElementById("purchase_volume").value;
      const typeContainer = document.getElementById("bottle_type_buttons");
      const activeBtn = typeContainer.querySelector(".active");
      const type = activeBtn ? activeBtn.dataset.value : null;

      const mass = calculateBottleMass(vol, type);
      if (mass) {
        set("bottle_mass", mass);
        console.log(`⚖️ 공병 질량 자동 계산: ${mass}g (Vol: ${vol}, Type: ${type})`);
      } else {
        set("bottle_mass", null);
      }
    };

    const volInput = document.getElementById("purchase_volume");
    if (volInput) {
      volInput.addEventListener("input", updateMass);
    }

    groups.forEach(id => {
      setupButtonGroup(id, (btn) => {
        const val = btn.dataset.value;
        // ID에서 '_buttons' 제거하여 state key 추정 (예: unit_buttons -> unit)
        const key = id.replace("_buttons", "");

        if (key === "manufacturer" && val === "기타") {
          document.getElementById("other_manufacturer_group").style.display = "block";
          set(key, null);
          // focus input
        } else if (key === "manufacturer") {
          document.getElementById("other_manufacturer_group").style.display = "none";
          set(key, val);
        } else if (key === "bottle_type") {
          set(key, val);
          updateMass(); // Trigger mass calc on type change
        } else {
          set(key, val);
        }
      });
    });

    // Manufacturer Other Input
    const manOther = document.getElementById("manufacturer_other");
    if (manOther) {
      manOther.addEventListener("input", (e) => set("manufacturer_custom", e.target.value));
    }

    // ------------------------------------------------------------
    // 📸 카메라/사진 (inventory-form.html IDs)
    // ------------------------------------------------------------
    // ------------------------------------------------------------
    // 📸 카메라/사진 (inventory-form.html IDs)
    // ------------------------------------------------------------
    const photoBtn = document.getElementById("photo-btn");
    const cameraBtn = document.getElementById("camera-btn");
    const cameraCancelBtn = document.getElementById("camera-cancel-btn");
    const cameraConfirmBtn = document.getElementById("camera-confirm-btn");
    const photoInput = document.getElementById("photo-input");
    const cameraInput = document.getElementById("camera-input");
    const previewBox = document.getElementById("photo-preview");
    const previewImg = document.getElementById("preview-img");
    const videoStream = document.getElementById("camera-stream");
    const canvas = document.getElementById("camera-canvas");

    let isCameraActive = false;

    // Helper: Stop Camera
    // Helper: Stop Camera
    const stopCamera = () => {
      if (inventoryStream) {
        inventoryStream.getTracks().forEach(track => track.stop());
        inventoryStream = null;
      }
      if (videoStream && videoStream.srcObject) {
        const tracks = videoStream.srcObject.getTracks();
        if (tracks) tracks.forEach(t => t.stop());
        videoStream.srcObject = null;
      }
      if (videoStream) videoStream.style.display = 'none';

      isCameraActive = false;
      if (cameraBtn) cameraBtn.innerHTML = '<span class="material-symbols-outlined">photo_camera</span> 카메라로 촬영';
      if (cameraConfirmBtn) cameraConfirmBtn.style.display = 'none';
      if (cameraCancelBtn) cameraCancelBtn.style.display = 'none';
      if (photoBtn) photoBtn.style.display = 'inline-flex';

      // Restore preview if exists
      if (previewImg && previewImg.src && previewImg.src !== window.location.href) {
        previewImg.style.display = 'block';
      }
    };

    // Helper: Start Camera
    const startCameraFunc = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        inventoryStream = stream;
        videoStream.srcObject = inventoryStream;
        videoStream.style.display = 'block';
        videoStream.play();

        // UI Updates
        if (previewImg) previewImg.style.display = 'none';
        const placeholder = previewBox.querySelector('.placeholder-text');
        if (placeholder) placeholder.style.display = 'none';

        isCameraActive = true;
        cameraBtn.innerHTML = '<span class="material-symbols-outlined">camera</span> 촬영하기';

        if (photoBtn) photoBtn.style.display = 'none';
        if (cameraCancelBtn) cameraCancelBtn.style.display = 'inline-flex';
        if (cameraConfirmBtn) cameraConfirmBtn.style.display = 'none';

      } catch (err) {
        console.error("Camera access denied:", err);
        cameraInput.click();
      }
    };

    // Helper: Take Photo
    const takePhoto = async () => {
      if (!videoStream || !canvas) return console.error("Video or Canvas missing");
      canvas.width = videoStream.videoWidth;
      canvas.height = videoStream.videoHeight;
      canvas.getContext('2d').drawImage(videoStream, 0, 0);

      const base64 = canvas.toDataURL("image/jpeg");

      if (App.Camera && App.Camera.processImage) {
        const resized = await App.Camera.processImage(base64);
        if (!resized) return;

        set("photo_320_base64", resized.base64_320);
        set("photo_160_base64", resized.base64_160);

        if (previewImg) {
          previewImg.src = resized.base64_320;
          previewImg.style.display = 'block';
        } else {
          // Fallback if element missing
          const img = document.createElement('img');
          img.id = 'preview-img';
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          img.src = resized.base64_320;
          previewBox.insertBefore(img, previewBox.firstChild);
        }
      }

      const placeholder = previewBox.querySelector('.placeholder-text');
      if (placeholder) placeholder.style.display = 'none';

      // Review Mode
      videoStream.pause();
      videoStream.style.display = 'none';

      cameraBtn.innerHTML = '<span class="material-symbols-outlined">replay</span> 다시 촬영';
      if (cameraConfirmBtn) cameraConfirmBtn.style.display = 'inline-flex';
    };

    // Event Listeners
    if (photoBtn && photoInput) {
      photoBtn.onclick = () => {
        if (isCameraActive) stopCamera();
        photoInput.click();
      };

      photoInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
          processImage(ev.target.result, (resized) => {
            set("photo_320_base64", resized.base64_320);
            set("photo_160_base64", resized.base64_160);

            if (previewImg) {
              previewImg.src = resized.base64_320;
              previewImg.style.display = 'block';
              const placeholder = previewBox.querySelector('.placeholder-text');
              if (placeholder) placeholder.style.display = 'none';
            }
          });
        };
        reader.readAsDataURL(file);
      };
    }

    if (cameraBtn) {
      cameraBtn.onclick = () => {
        if (isCameraActive) {
          // If in Review mode, Restart (Retake)
          if (videoStream.style.display === 'none') {
            videoStream.style.display = 'block';
            videoStream.play();
            if (previewImg) previewImg.style.display = 'none';
            cameraBtn.innerHTML = '<span class="material-symbols-outlined">camera</span> 촬영하기';
            if (cameraConfirmBtn) cameraConfirmBtn.style.display = 'none';
          } else {
            takePhoto();
          }
        } else {
          startCameraFunc();
        }
      };
    }

    if (cameraConfirmBtn) {
      cameraConfirmBtn.onclick = () => {
        stopCamera();
      };
    }

    if (cameraCancelBtn) {
      cameraCancelBtn.onclick = () => {
        stopCamera();
      };
    }

    // ------------------------------------------------------------
    // 🗺 보관 위치 로직 (App.StorageSelector)
    // ------------------------------------------------------------
    if (App.StorageSelector && typeof App.StorageSelector.init === 'function') {
      const defaultLoc = {};
      if (mode === "edit" && detail) {
        Object.assign(defaultLoc, {
          area_id: detail.Cabinet?.Area?.id,
          area_name: detail.Cabinet?.Area?.area_name,
          cabinet_id: detail.Cabinet?.id || detail.cabinet_id,
          cabinet_name: detail.Cabinet?.cabinet_name,
          door_vertical: detail.door_vertical,
          door_horizontal: detail.door_horizontal,
          internal_shelf_level: detail.internal_shelf_level,
          storage_column: detail.storage_column
        });
      }
      App.StorageSelector.init("inventory-storage-selector", defaultLoc, "INVENTORY");
    }

    // ------------------------------------------------------------
    // 📝 폼 제출
    // ------------------------------------------------------------
    const form = document.getElementById("inventory-form");
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        // Collect Input Values manually for non-button inputs
        set("cas_rn", document.getElementById("cas_rn").value);
        set("purchase_volume", document.getElementById("purchase_volume").value);
        set("concentration_value", document.getElementById("concentration_value").value);
        set("purchase_date", document.getElementById("purchase_date").value);

        // Get Location
        if (App.StorageSelector) {
          const loc = App.StorageSelector.getSelection();
          // if (!loc.cabinet_id) check removed for optional location
          // Update State with Location
          set("cabinet_id", loc.cabinet_id);
          set("door_vertical", loc.door_vertical);
          set("door_horizontal", loc.door_horizontal);
          set("internal_shelf_level", loc.internal_shelf_level);
          set("storage_column", loc.storage_column);
        }

        try {
          const payload = await makePayload(dump()); // Validate & Transform

          const vol = Number(get("purchase_volume"));
          const conc = get("concentration_value") ? Number(get("concentration_value")) : null;

          // Override makePayload's cabinet logic for Inventory & Add Inventory fields
          Object.assign(payload, {
            cabinet_id: get("cabinet_id") || null, // Ensure null if undefined/empty
            door_vertical: get("door_vertical"),
            door_horizontal: get("door_horizontal"),
            internal_shelf_level: get("internal_shelf_level"),
            storage_column: get("storage_column"),
            // Inventory Specific Fields
            cas_rn: get("cas_rn"),
            initial_amount: vol, // ✅ initial_amount 추가
            current_amount: isNaN(vol) ? 0 : vol,
            unit: get("unit"),
            bottle_type: get("bottle_type"), // ✅ bottle_type 컬럼 추가
            // bottle_identifier logic: Use existing (Edit) or Generate New (Create)
            bottle_identifier: get("bottle_identifier") || `${get("cas_rn")}-${crypto.randomUUID()}`,
            bottle_mass: get("bottle_mass"), // ✅ bottle_mass 추가
            state: get("state"), // ✅ state (성상) 추가 (액체, 고체 등)
            classification: get("classification"),
            // status: get("status"), // ❌ Remove this line to avoid confusion. Handled below.
            status: get("status") || "사용중", // ✅ status (사용상태) 기본값 처리
            msds_pdf_hash: get("msds_pdf_hash") || null,
            concentration_value: conc,
            concentration_unit: get("concentration_unit"),
            manufacturer: get("manufacturer") || get("manufacturer_custom"),
            purchase_date: get("purchase_date") || null
          });

          // Correction: In initInventoryForm (line 100), we set "status" from detail.status.
          // But the buttons ID is "state_buttons". setupButtonGroup (line 260) sets "state".
          // So we should read "state" from App.State and map it to "status" in payload.


          // 📸 UPLOAD PHOTOS to 'reagent-photos' bucket
          if (payload.photo_320_base64) {
            try {
              const ts = Date.now();
              const rnd = Math.random().toString(36).substr(2, 5);

              // Upload 320px
              const blob320 = App.Utils.base64ToBlob(payload.photo_320_base64);
              const path320 = `inventory/${ts}_${rnd}_320.jpg`;

              // Ensure bucket exists or just Assume 'reagent-photos' exists as per user
              const { error: err320 } = await supabase.storage
                .from("reagent-photos")
                .upload(path320, blob320, { upsert: true });

              if (err320) throw err320;

              const { data: data320 } = supabase.storage.from("reagent-photos").getPublicUrl(path320);
              payload.photo_url_320 = data320.publicUrl;

              // Upload 160px (thumbnail) if available
              if (payload.photo_160_base64) {
                const blob160 = App.Utils.base64ToBlob(payload.photo_160_base64);
                const path160 = `inventory/${ts}_${rnd}_160.jpg`;
                const { error: err160 } = await supabase.storage
                  .from("reagent-photos")
                  .upload(path160, blob160, { upsert: true });

                if (!err160) {
                  const { data: data160 } = supabase.storage.from("reagent-photos").getPublicUrl(path160);
                  payload.photo_url_160 = data160.publicUrl;
                }
              } else {
                payload.photo_url_160 = payload.photo_url_320;
              }

              console.log("✅ Photo uploaded:", payload.photo_url_320);

            } catch (uploadErr) {
              console.error("Photo upload failed:", uploadErr);
              if (!confirm("사진 업로드에 실패했습니다. 사진 없이 저장하시겠습니까?")) return;
            }
          }

          // 📄 UPLOAD MSDS PDF to 'msds-pdf' bucket
          const msdsInput = document.getElementById("msds-pdf-input");
          if (msdsInput && msdsInput.files && msdsInput.files[0]) {
            try {
              const file = msdsInput.files[0];

              // 1. Compute Hash
              const fileHash = await App.Utils.computeFileHash(file);
              payload.msds_pdf_hash = fileHash;

              // 2. Check for Duplicates
              const { data: dupData } = await supabase
                .from("Inventory")
                .select("msds_pdf_url")
                .eq("msds_pdf_hash", fileHash)
                .limit(1)
                .maybeSingle();

              if (dupData && dupData.msds_pdf_url) {
                console.log("♻️ Duplicate MSDS found. Reusing URL:", dupData.msds_pdf_url);
                payload.msds_pdf_url = dupData.msds_pdf_url;
              } else {
                // 3. Upload New File
                // Validate size (max 3MB)
                if (file.size > 3 * 1024 * 1024) {
                  alert("MSDS 파일 크기는 3MB를 초과할 수 없습니다.");
                  throw new Error("File too large");
                }

                const ts = Date.now();
                const rnd = Math.random().toString(36).substr(2, 5);
                const path = `msds/${ts}_${rnd}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

                const { error: msdsErr } = await supabase.storage
                  .from("msds-pdf")
                  .upload(path, file, { upsert: true });

                if (msdsErr) throw msdsErr;

                const { data: msdsData } = supabase.storage.from("msds-pdf").getPublicUrl(path);
                payload.msds_pdf_url = msdsData.publicUrl;
                console.log("✅ MSDS PDF uploaded:", payload.msds_pdf_url);
              }

            } catch (msdsErr) {
              console.error("MSDS Upload failed:", msdsErr);
              alert("MSDS 파일 업로드에 실패했습니다. (크기 초과 또는 네트워크 오류)");
              return;
            }
          }

          // Cleanup payload for Inventory Table (remove Cabinet-specific fields)
          delete payload.cabinet_name;
          delete payload.area_name;
          delete payload.door_vertical_count;
          delete payload.door_horizontal_count;
          delete payload.shelf_height;
          delete payload.storage_columns;

          // Remove fields not in Inventory Table schema
          delete payload.cas_rn; // Belongs to Substance? Wait.
          // Inventory table has `substance_id`, not `cas_rn` usually?
          // Inventory.js select: Substance ( ... ).
          // So Inventory likely has `substance_id`.
          // We need to resolve `cas_rn` to `substance_id` via a function or edge function?
          // Or is `makePayload` or `App.Inventory.createInventory` handling it?
          // If `Inventory` has `cas_rn` column, then it's fine.
          // But schema likely links to Substance via FK.
          // If we send `cas_rn` to `Inventory`, does it have a trigger?
          // Or does the user expect `Inventory` table to have `cas_rn`?
          // Looking at the error "Inventory:1", maybe `Inventory` table DOES NOT have `cas_rn` column.
          // And we need to find `substance_id` for that CAS.

          // Let's assume for now we keep cas_rn in payload if the backend handles it (e.g. trigger or view).
          // BUT `forms.js` at line 577 explicitly DELETES it!
          // delete payload.cas_rn; // Belongs to Substance

          // So... where does `substance_id` come from?
          // It's missing in payload!
          // We must lookup substance_id from cas_rn.

          // Let's check if we can fix this.

          // delete payload.bottle_type; // KEEP THIS
          // delete payload.state; // KEEP THIS
          // We should delete 'state' key to avoid error.

          // Remove photo base64 (Inventory table doesn't have these columns)
          delete payload.photo_320_base64;
          delete payload.photo_160_base64;

          // Prevent overwriting existing photos with null if new photo upload isn't handled here
          if (payload.photo_url_320 === null) delete payload.photo_url_320;
          if (payload.photo_url_160 === null) delete payload.photo_url_160;

          // CRITICAL: Resolve substance_id if missing
          let casRn = get("cas_rn");
          if (casRn) casRn = casRn.trim();

          if (!payload.substance_id && casRn) {
            // 1. Try exact match
            let { data: subData } = await supabase.from("Substance").select("id, molecular_mass, Properties(name, property)").eq("cas_rn", casRn).maybeSingle();

            // 2. If not found, try removing dashes (if input had dashes)
            if (!subData && casRn.includes("-")) {
              const stripped = casRn.replace(/-/g, "");
              const { data: subData2 } = await supabase.from("Substance").select("id, molecular_mass, Properties(name, property)").eq("cas_rn", stripped).maybeSingle();
              if (subData2) subData = subData2;
            }

            if (subData) {
              payload.substance_id = subData.id;

              // 🧮 Calculate Conversions (Server-side simulation)
              if (payload.concentration_value && payload.concentration_unit) {
                const densityProp = subData.Properties?.find(p => p.name === "Density");
                const densityVal = densityProp ? parseFloat(densityProp.property) : 1;
                const conversions = App.Utils.computeConversions({
                  value: payload.concentration_value,
                  unit: payload.concentration_unit,
                  molarMass: subData.molecular_mass,
                  density: densityVal
                });

                const annotateUnit = (unit) => {
                  if (!unit) return unit;
                  const stateVal = String(payload.state || "").trim().toLowerCase();
                  const solids = ["파우더", "조각", "비드", "펠렛", "리본", "막대", "벌크", "고체"];
                  const isSolid = solids.some((k) => stateVal.includes(k));
                  const isGas = stateVal.includes("기체") || stateVal.includes("gas");
                  const isLiquid = stateVal === "액체" || stateVal.includes("liquid");
                  if (unit === "M" && (isSolid || isGas)) return `${unit} (의미 없음)`;
                  if (unit === "m" && (isLiquid || isGas)) return `${unit} (정의 불가)`;
                  return unit;
                };

                if (conversions) {
                  if (payload.concentration_unit === "%") {
                    payload.converted_concentration_value_1 = conversions.molarity;
                    payload.converted_concentration_unit_1 = annotateUnit("M");
                    payload.converted_concentration_value_2 = conversions.molality;
                    payload.converted_concentration_unit_2 = annotateUnit("m");
                  } else if (payload.concentration_unit === "M" || payload.concentration_unit === "N") {
                    payload.converted_concentration_value_1 = conversions.percent;
                    payload.converted_concentration_unit_1 = "%";
                    payload.converted_concentration_value_2 = conversions.molality;
                    payload.converted_concentration_unit_2 = annotateUnit("m");
                  }
                }
              }
            } else {
              // ------------------------------------------------------------
              // 🌟 Auto-Import Logic (User's expected behavior)
              // ------------------------------------------------------------
              console.log(`[Inventory] CAS(${casRn}) not found locally. Delegating to casimport...`);

              const fnUrl = App.API?.EDGE?.CASIMPORT || `https://muprmzkvrjacqatqxayf.supabase.co/functions/v1/casimport`;
              const headers = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${App.API?.SUPABASE_ANON_KEY || supabase.supabaseKey}`
              };

              // Send PROPER payload matching backend expectation (cas_rns array + inventoryDetails)
              const impRes = await fetch(fnUrl, {
                method: "POST",
                headers,
                body: JSON.stringify({
                  type: "inventory",
                  cas_rns: [casRn],  // Backend expects 'cas_rns' array
                  inventoryDetails: payload
                })
              });

              if (!impRes.ok) {
                const errMsg = await impRes.text();
                throw new Error(`자동 등록 실패: ${errMsg}`);
              }

              const impData = await impRes.json();
              if (impData.error) throw new Error(impData.error);

              console.log(`✅ Auto-import success. Inventory ID: ${impData.inventoryId}`);

              // Direct success handling - skip local creation
              alert("✅ 물질 자동 생성 및 등록 완료");
              App.Router.go("inventory");
              return; // EXIT FUNCTION HERE
            }
          }
          // Continue to local registration logic only if auto-import wasn't triggered/didn't exit

          // Remove cas_rn as it's not in Inventory usually
          delete payload.cas_rn;

          if (mode === "create") {
            if (typeof App.Inventory.createInventory !== 'function') throw new Error("App.Inventory.createInventory missing");
            await App.Inventory.createInventory(payload);
            const { data: userData } = await supabase.auth.getUser(); // Dummy for now
            alert("✅ 등록 완료");
          } else {
            if (typeof App.Inventory.updateInventory !== 'function') throw new Error("App.Inventory.updateInventory missing");
            await App.Inventory.updateInventory(detail.id, payload);
            alert("✅ 수정 완료");
          }
          App.Router.go("inventory");
        } catch (err) {
          console.error(err);
          if (statusMsg) statusMsg.textContent = "저장 실패: " + err.message;
        }
      };
    }
  }

  // -------------------------------------------------
  // 🧭 시약장 폼 초기화 (create / edit 모드 완전 복원)
  // -------------------------------------------------
  async function initCabinetForm(mode = "create", detail = null) {
    await App.includeHTML("pages/cabinet-form.html", "form-container");
    reset();
    set("mode", mode);

    // ✅ state 세팅
    if (detail) {
      Object.entries(detail).forEach(([k, v]) => set(k, v));
      set("cabinetId", detail.id);
      set("area_id", detail.area_id?.id || null);
      set("area_custom_name", detail.area_id?.area_name || null);
      set("cabinet_name", detail.cabinet_name);
    }

    // ------------------------------------------------------------
    // 제목 & 버튼 제어
    // ------------------------------------------------------------
    const title = document.querySelector("#cabinet-creation-form h2");
    const submitBtn = document.getElementById("cabinet-submit-button");
    const saveBtn = document.getElementById("cabinet-save-btn");
    const cancelBtn = document.getElementById("cancel-form-btn");

    if (title)
      title.textContent =
        mode === "edit"
          ? `${detail?.cabinet_name || "시약장"} 정보 수정`
          : "시약장 등록";

    if (mode === "edit") {
      if (submitBtn) submitBtn.style.display = "none";
      if (saveBtn) {
        saveBtn.style.display = "inline-block";
        saveBtn.onclick = (e) => {
          e.preventDefault();
          if (typeof stopCabinetCamera === 'function') stopCabinetCamera();
          console.log("📌 State before payload:", App.State.dump());
          handleSave();
        };
      }
    } else {
      if (submitBtn) {
        submitBtn.style.display = "inline-block";
        submitBtn.onclick = (e) => {
          e.preventDefault();
          if (typeof stopCabinetCamera === 'function') stopCabinetCamera();
          console.log("📌 State before payload:", App.State.dump());
          handleSave();
        };
      }
      if (saveBtn) saveBtn.style.display = "none";
    }

    if (cancelBtn)
      cancelBtn.onclick = () => App.includeHTML("pages/location-list.html");

    // ------------------------------------------------------------
    // 1️⃣ 장소 버튼 그룹 (기타 처리)
    // ------------------------------------------------------------
    const areaGroup = document.getElementById("area-button-group");
    const areaOtherGroup = document.getElementById("area-other-group");
    const areaOtherInput = document.getElementById("area-other-input");

    if (areaGroup) {
      setupButtonGroup("area-button-group", (btn) => {
        const value = btn.dataset.value?.trim() || btn.textContent.trim();

        if (value === "기타") {
          areaOtherGroup.style.display = "block";
          areaOtherInput.value = "";
          areaOtherInput.focus();
          set("area_custom_name", "");
          set("area_buttons", null);
        } else {
          areaOtherGroup.style.display = "none";
          set("area_buttons", value);
          set("area_custom_name", null);
        }
      });

      // 입력란 직접 타이핑 시 State 동기화
      areaOtherInput.addEventListener("input", (e) => {
        set("area_custom_name", e.target.value.trim());
      });
    }

    // ------------------------------------------------------------
    // 2️⃣ 시약장 이름 버튼 그룹 (기타 처리)
    // ------------------------------------------------------------
    const cabGroup = document.getElementById("cabinet_name_buttons");
    const cabOtherGroup = document.getElementById("cabinet_other-group");
    const cabOtherInput = document.getElementById("cabinet_other_input");

    if (cabGroup) {
      setupButtonGroup("cabinet_name_buttons", (btn) => {
        const value = btn.dataset.value?.trim() || btn.textContent.trim();

        if (value === "기타") {
          cabOtherGroup.style.display = "block";
          cabOtherInput.value = "";
          cabOtherInput.focus();
          set("cabinet_custom_name", "");
          set("cabinet_name_buttons", null);
        } else {
          cabOtherGroup.style.display = "none";
          set("cabinet_name_buttons", value);
          set("cabinet_custom_name", null);
        }
      });

      // 입력란 직접 타이핑 시 State 동기화
      cabOtherInput.addEventListener("input", (e) => {
        set("cabinet_custom_name", e.target.value.trim());
      });
    }

    // ------------------------------------------------------------
    // 3️⃣ 사진 업로드 처리
    // ------------------------------------------------------------
    // ------------------------------------------------------------
    // 3️⃣ 사진 업로드 처리
    // ------------------------------------------------------------
    // 3️⃣ 사진 업로드 처리 (Cabinet)
    // ------------------------------------------------------------
    const photoInput = document.getElementById("cabinet-photo-input");
    const cameraInput = document.getElementById("cabinet-camera-input");
    const previewBox = document.getElementById("cabinet-photo-preview");
    const cameraBtn = document.getElementById("cabinet-camera-btn");
    const photoBtn = document.getElementById("cabinet-photo-btn");
    const cameraCancelBtn = document.getElementById("cabinet-camera-cancel-btn");
    const cameraConfirmBtn = document.getElementById("cabinet-camera-confirm-btn");
    const videoStream = document.getElementById("cabinet-camera-stream");
    const canvas = document.getElementById("cabinet-camera-canvas");
    let isCameraActive = false;

    // Ensure previous stream is stopped
    if (cabinetStream) {
      cabinetStream.getTracks().forEach(track => track.stop());
      cabinetStream = null;
    }

    const stopCabinetCamera = () => {
      if (cabinetStream) {
        cabinetStream.getTracks().forEach(track => track.stop());
        cabinetStream = null;
      }
      if (videoStream && videoStream.srcObject) {
        const tracks = videoStream.srcObject.getTracks();
        if (tracks) tracks.forEach(t => t.stop());
        videoStream.srcObject = null;
      }

      if (videoStream) videoStream.style.display = 'none';

      isCameraActive = false;
      if (cameraBtn) {
        cameraBtn.innerHTML = '<span class="material-symbols-outlined">photo_camera</span> 카메라로 촬영';
      }
      if (photoBtn) photoBtn.style.display = 'inline-flex';
      if (cameraCancelBtn) cameraCancelBtn.style.display = 'none';
      if (cameraConfirmBtn) cameraConfirmBtn.style.display = 'none';

      // Keep preview image visible
      const existingImg = previewBox.querySelector('img');
      if (existingImg && existingImg.src && existingImg.src !== window.location.href) {
        existingImg.style.display = 'block';
      }
    };

    const startCabinetCamera = async () => {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        cabinetStream = newStream;
        videoStream.srcObject = cabinetStream;
        videoStream.style.display = 'block';
        videoStream.play();

        // Hide existing image
        const existingImg = previewBox.querySelector('img');
        if (existingImg) existingImg.style.display = 'none';

        const placeholder = previewBox.querySelector('.placeholder-text');
        if (placeholder) placeholder.style.display = 'none';

        isCameraActive = true;

        cameraBtn.innerHTML = '<span class="material-symbols-outlined">camera</span> 촬영하기';

        if (photoBtn) photoBtn.style.display = 'none';
        if (cameraCancelBtn) cameraCancelBtn.style.display = 'inline-flex';
        if (cameraConfirmBtn) cameraConfirmBtn.style.display = 'none';

      } catch (err) {
        console.error("Camera access denied or error:", err);
        cameraInput.click();
      }
    };

    const takeCabinetPhoto = async () => {
      if (!videoStream || !canvas) return;
      canvas.width = videoStream.videoWidth;
      canvas.height = videoStream.videoHeight;
      canvas.getContext('2d').drawImage(videoStream, 0, 0);

      const base64 = canvas.toDataURL("image/jpeg");

      if (App.Camera && App.Camera.processImage) {
        const resized = await App.Camera.processImage(base64);
        if (resized) {
          set("photo_320_base64", resized.base64_320);
          set("photo_160_base64", resized.base64_160);

          const placeholder = previewBox.querySelector('.placeholder-text');
          if (placeholder) placeholder.style.display = 'none';

          let img = previewBox.querySelector('img');
          if (!img) {
            img = document.createElement('img');
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover";
            previewBox.insertBefore(img, previewBox.firstChild);
          }
          img.src = resized.base64_320;
          img.style.display = 'block';
          img.style.objectFit = 'cover';
        }
      }

      // Review Mode
      videoStream.pause();
      videoStream.style.display = 'none';

      cameraBtn.innerHTML = '<span class="material-symbols-outlined">replay</span> 다시 촬영';
      if (cameraConfirmBtn) cameraConfirmBtn.style.display = 'inline-flex';
    };

    // Listeners
    if (photoBtn && photoInput) {
      photoBtn.onclick = () => {
        if (isCameraActive) stopCabinetCamera();
        photoInput.click();
      };
    }

    if (cameraBtn) {
      cameraBtn.onclick = () => {
        if (isCameraActive) {
          if (videoStream.style.display === 'none') {
            // Retake
            videoStream.style.display = 'block';
            videoStream.play();
            const img = previewBox.querySelector('img');
            if (img) img.style.display = 'none';

            cameraBtn.innerHTML = '<span class="material-symbols-outlined">camera</span> 촬영하기';
            if (cameraConfirmBtn) cameraConfirmBtn.style.display = 'none';
          } else {
            takeCabinetPhoto();
          }
        } else {
          startCabinetCamera();
        }
      };
    }

    if (cameraCancelBtn) {
      cameraCancelBtn.onclick = () => stopCabinetCamera();
    }

    if (cameraConfirmBtn) {
      cameraConfirmBtn.onclick = () => stopCabinetCamera();
    }

    const handleFile = (file) => {
      if (!file) return;
      if (isCameraActive) stopCabinetCamera();

      const reader = new FileReader();
      reader.onload = (e) => {
        processImage(e.target.result, (resized) => {
          set("photo_320_base64", resized.base64_320);
          set("photo_160_base64", resized.base64_160);

          const placeholder = previewBox.querySelector('.placeholder-text');
          if (placeholder) placeholder.style.display = 'none';

          let img = previewBox.querySelector('img');
          if (!img) {
            img = document.createElement('img');
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover";
            previewBox.appendChild(img);
          }
          img.src = resized.base64_320;
          img.style.display = 'block';
        });
      };
      reader.readAsDataURL(file);
    };

    if (photoInput) photoInput.onchange = (e) => handleFile(e.target.files[0]);
    if (cameraInput) cameraInput.onchange = (e) => handleFile(e.target.files[0]);

    // ------------------------------------------------------------
    // 4️⃣ edit 모드 — 기존 값 복원
    // ------------------------------------------------------------
    if (mode === "edit" && detail) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // 🏷 장소 복원
          const areaName = detail.area_id?.area_name;
          const areaBtns = document.querySelectorAll("#area-button-group button");
          let areaMatched = false;
          areaBtns.forEach((btn) => {
            if (btn.textContent.trim() === areaName) {
              btn.classList.add("active");
              areaMatched = true;
            }
          });
          if (!areaMatched && areaOtherGroup) {
            areaOtherGroup.style.display = "block";
            areaOtherInput.value = areaName || "";

            // ✅ 기타 버튼도 눌린 상태로 표시
            const areaOtherBtn = document.querySelector("#area-button-group button[data-value='기타']");
            if (areaOtherBtn) areaOtherBtn.classList.add("active");
          }

          // 🏷 시약장 이름 복원
          const cabBtns = document.querySelectorAll("#cabinet_name_buttons button");
          let cabMatched = false;
          cabBtns.forEach((btn) => {
            if (btn.textContent.trim() === detail.cabinet_name) {
              btn.classList.add("active");
              cabMatched = true;
            }
          });
          if (!cabMatched && cabOtherGroup) {
            cabOtherGroup.style.display = "block";
            cabOtherInput.value = detail.cabinet_name || "";

            // ✅ 시약장 이름의 기타 버튼도 눌린 상태로 표시
            const cabOtherBtn = document.querySelector("#cabinet_name_buttons button[data-value='기타']");
            if (cabOtherBtn) cabOtherBtn.classList.add("active");
          }

          // 🧱 도어/선반/열 복원 (edit 모드)
          const vLabelByNum = { 1: "단일도어(상하분리없음)", 2: "상하도어", 3: "상중하도어" };
          const hLabelByNum = { 1: "단일도어", 2: "좌우분리도어" };

          // 4️⃣ 외부 도어의 상하분리 형태
          document.querySelectorAll("#door_vertical_split_buttons button").forEach((btn) => {
            const label = (btn.dataset.value || btn.textContent).trim();
            const need = vLabelByNum[Number(detail.door_vertical_count)];
            if (label === need) btn.classList.add("active");
          });

          // 5️⃣ 외부 도어의 좌우분리 형태
          document.querySelectorAll("#door_horizontal_split_buttons button").forEach((btn) => {
            const label = (btn.dataset.value || btn.textContent).trim();
            const need = hLabelByNum[Number(detail.door_horizontal_count)];
            if (label === need) btn.classList.add("active");
          });

          // 6️⃣ 선반 층수
          document.querySelectorAll("#shelf_height_buttons button").forEach((btn) => {
            const val = Number(btn.dataset.value);
            if (val === Number(detail.shelf_height)) btn.classList.add("active");
          });

          // 7️⃣ 수납 열 수
          document.querySelectorAll("#storage_columns_buttons button").forEach((btn) => {
            const val = Number(btn.dataset.value);
            if (val === Number(detail.storage_columns)) btn.classList.add("active");
          });

          // 🖼 사진 복원 (비율 유지)
          if (detail.photo_url_320 || detail.photo_url_160) {
            const url = detail.photo_url_320 || detail.photo_url_160;
            previewBox.innerHTML = `<img src="${url}" alt="시약장 사진">`;
          } else {
            previewBox.innerHTML = `<span>사진 없음</span>`;
          }

          // ✅ edit 모드에서도 버튼 클릭이 가능하도록 이벤트 재연결
          [
            "door_vertical_split_buttons",
            "door_horizontal_split_buttons",
            "shelf_height_buttons",
            "storage_columns_buttons"
          ].forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
              setupButtonGroup(id, (btn) => {
                const value = btn.dataset.value || btn.textContent.trim();
                set(id.replace("_buttons", ""), value);
              });
            }
          });
        });
      });
    }

    console.log(`✅ 시약장 폼 초기화 완료 (${mode})`);
  }

  // -------------------------------------------------
  // 🏫 교구·물품장 폼 초기화 (4단계 Wizard + 교구장밖 예외처리)
  // -------------------------------------------------
  async function initEquipmentCabinetForm(mode = "create", detail = null) {
    await App.includeHTML("pages/equipment-cabinet-form.html", "form-container");
    reset();
    set("mode", mode);

    // ✅ State 세팅
    if (detail) {
      Object.entries(detail).forEach(([k, v]) => set(k, v));
      set("cabinetId", detail.id);
      set("area_id", detail.area_id?.id || null);
      set("area_custom_name", detail.area_id?.area_name || null);
      set("cabinet_name", detail.cabinet_name);
      set("door_vertical_count", detail.door_vertical_count);
    }

    // 🏷 타이틀 & 버튼 제어
    const title = document.querySelector("#equipment-cabinet-creation-form h2");
    const submitBtn = document.getElementById("equipment-submit-btn");
    const saveBtn = document.getElementById("equipment-save-btn");
    const cancelBtn = document.getElementById("equipment-cancel-btn");

    if (title)
      title.textContent = mode === "edit"
        ? `${detail?.cabinet_name || "교구·물품장"} 수정`
        : "교구·물품장 등록";

    if (mode === "edit") {
      if (submitBtn) submitBtn.style.display = "none";
      if (saveBtn) {
        saveBtn.style.display = "inline-block";
        saveBtn.onclick = (e) => {
          e.preventDefault();
          handleEquipmentSave();
        };
      }
    } else {
      if (submitBtn) {
        submitBtn.style.display = "inline-block";
        submitBtn.onclick = (e) => {
          e.preventDefault();
          handleEquipmentSave();
        };
      }
      if (saveBtn) saveBtn.style.display = "none";
    }

    if (cancelBtn)
      cancelBtn.onclick = async () => {
        await App.includeHTML("pages/equipment-cabinet-list.html");
        if (App.EquipmentCabinet && typeof App.EquipmentCabinet.loadList === "function") {
          App.EquipmentCabinet.loadList();
        }
      };

    // ------------------------------------------------------------
    // 1️⃣ 장소 버튼
    // ------------------------------------------------------------
    const areaGroup = document.getElementById("equipment-area-button-group");
    const areaOtherGroup = document.getElementById("equipment-area-other-group");
    const areaOtherInput = document.getElementById("equipment-area-other-input");

    if (areaGroup) {
      setupButtonGroup("equipment-area-button-group", (btn) => {
        const value = btn.dataset.value?.trim() || btn.textContent.trim();
        if (value === "기타") {
          areaOtherGroup.style.display = "block";
          areaOtherInput.value = "";
          areaOtherInput.focus();
          set("area_custom_name", "");
          set("area_buttons", null);
        } else {
          areaOtherGroup.style.display = "none";
          set("area_buttons", value);
          set("area_custom_name", null);
        }
      });
      areaOtherInput.addEventListener("input", (e) => set("area_custom_name", e.target.value.trim()));
    }

    // ------------------------------------------------------------
    // 2️⃣ 교구장 이름 (12개 버튼 + 교구장밖 처리)
    // ------------------------------------------------------------
    const nameGroup = document.getElementById("equipment_name_buttons");
    const nameOtherGroup = document.getElementById("equipment_name_other-group");
    const nameOtherInput = document.getElementById("equipment_name_other-input"); // ID 주의: HTML과 일치해야 함
    // HTML ID: equipment_name_other_input (underscore) vs script (dash).
    // Let's check HTML content again? Step 40 created it.
    // HTML: id="equipment_name_other_input"
    const nameOtherInputReal = document.getElementById("equipment_name_other_input");

    // Step 4 Visibility Control
    const doorStep = document.getElementById("equipment-door-step");

    if (nameGroup) {
      setupButtonGroup("equipment_name_buttons", (btn) => {
        const value = btn.dataset.value?.trim() || btn.textContent.trim();

        // 🚨 "교구장밖" 선택 시 4단계 숨김
        if (value === "교구장밖") {
          if (doorStep) doorStep.style.display = "none";
          set("door_vertical_count", null); // 값 초기화? or maintain?
        } else {
          if (doorStep) doorStep.style.display = "block";
        }

        if (value === "기타") {
          if (nameOtherGroup) nameOtherGroup.style.display = "block";
          if (nameOtherInputReal) {
            nameOtherInputReal.value = "";
            nameOtherInputReal.focus();
          }
          set("cabinet_custom_name", "");
          set("cabinet_name_buttons", null);
        } else {
          if (nameOtherGroup) nameOtherGroup.style.display = "none";
          set("cabinet_name_buttons", value);
          set("cabinet_custom_name", null);
        }
      });

      if (nameOtherInputReal) {
        nameOtherInputReal.addEventListener("input", (e) => set("cabinet_custom_name", e.target.value.trim()));
      }
    }

    // ------------------------------------------------------------
    // 3️⃣ 사진 (기존 로직 재사용 - ID만 변경됨)
    // ------------------------------------------------------------
    // NOTE: We need separate event listeners for equipment camera since IDs are different
    // For simplicity, we can duplicate the logic or refactor. Duplicating for safety now.
    // 3️⃣ 사진 (Equipment)
    // ------------------------------------------------------------
    const photoInput = document.getElementById("equipment-photo-input");
    const cameraInput = document.getElementById("equipment-camera-input");
    const previewBox = document.getElementById("equipment-photo-preview");
    const cameraBtn = document.getElementById("equipment-camera-btn");
    const photoBtn = document.getElementById("equipment-photo-btn");
    const cameraCancelBtn = document.getElementById("equipment-camera-cancel-btn");
    const cameraConfirmBtn = document.getElementById("equipment-camera-confirm-btn");
    const videoStream = document.getElementById("equipment-camera-stream");
    const canvas = document.getElementById("equipment-camera-canvas");
    let isCameraActive = false;
    let equipmentStream = null;

    const stopCamera = () => {
      if (equipmentStream) {
        equipmentStream.getTracks().forEach(t => t.stop());
        equipmentStream = null;
      }
      if (videoStream && videoStream.srcObject) {
        const tracks = videoStream.srcObject.getTracks();
        if (tracks) tracks.forEach(t => t.stop());
        videoStream.srcObject = null;
      }

      if (videoStream) videoStream.style.display = "none";
      isCameraActive = false;

      if (cameraBtn) {
        cameraBtn.innerHTML = '<span class="material-symbols-outlined">photo_camera</span> 카메라로 촬영';
      }
      if (photoBtn) photoBtn.style.display = "inline-flex";
      if (cameraCancelBtn) cameraCancelBtn.style.display = "none";
      if (cameraConfirmBtn) cameraConfirmBtn.style.display = "none";

      const existingImg = previewBox.querySelector('img');
      if (existingImg && existingImg.src && existingImg.src !== window.location.href) {
        existingImg.style.display = "block";
      }
    };

    const startCameraFunc = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        equipmentStream = stream;
        videoStream.srcObject = stream;
        videoStream.style.display = "block";
        videoStream.play();

        isCameraActive = true;

        cameraBtn.innerHTML = '<span class="material-symbols-outlined">camera</span> 촬영하기';

        if (photoBtn) photoBtn.style.display = "none";
        if (cameraCancelBtn) cameraCancelBtn.style.display = "inline-flex";
        if (cameraConfirmBtn) cameraConfirmBtn.style.display = "none";

        // Hide placeholder/img
        const placeholder = previewBox.querySelector(".placeholder-text");
        if (placeholder) placeholder.style.display = "none";
        const exist = previewBox.querySelector("img");
        if (exist) exist.style.display = "none";

      } catch (e) {
        console.error(e);
        cameraInput.click();
      }
    };

    const takePhoto = () => {
      if (!videoStream || !canvas) return;
      canvas.width = videoStream.videoWidth;
      canvas.height = videoStream.videoHeight;
      canvas.getContext("2d").drawImage(videoStream, 0, 0);
      const base64 = canvas.toDataURL("image/jpeg");

      App.Camera.processImage(base64, (resized) => {
        set("photo_320_base64", resized.base64_320);
        set("photo_160_base64", resized.base64_160);

        let img = previewBox.querySelector('img');
        if (!img) {
          img = document.createElement("img");
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = "cover";
          previewBox.insertBefore(img, previewBox.firstChild);
        }
        img.src = resized.base64_320;
        img.style.display = 'block';
        img.style.objectFit = 'cover';

        // Remove duplicate images if any (from old logic)
        // Actually best to just rely on one img
      });

      // Review Mode
      videoStream.pause();
      videoStream.style.display = "none";

      cameraBtn.innerHTML = '<span class="material-symbols-outlined">replay</span> 다시 촬영';

      if (cameraConfirmBtn) cameraConfirmBtn.style.display = "inline-flex";
    };

    if (cameraBtn) {
      cameraBtn.onclick = () => {
        if (isCameraActive) {
          if (videoStream.style.display === "none") {
            // Retake
            videoStream.style.display = "block";
            videoStream.play();
            const img = previewBox.querySelector('img');
            if (img) img.style.display = "none";
            cameraBtn.innerHTML = '<span class="material-symbols-outlined">camera</span> 촬영하기';
            if (cameraConfirmBtn) cameraConfirmBtn.style.display = "none";
          } else {
            takePhoto();
          }
        } else {
          startCameraFunc();
        }
      };
    }

    if (cameraCancelBtn) cameraCancelBtn.onclick = stopCamera;
    if (cameraConfirmBtn) cameraConfirmBtn.onclick = stopCamera;

    if (photoBtn) photoBtn.onclick = () => { if (isCameraActive) stopCamera(); photoInput.click(); };

    const handleFile = (f) => {
      if (!f) return;
      if (isCameraActive) stopCamera(); // Stop camera if active

      const reader = new FileReader();
      reader.onload = (e) => {
        App.Camera.processImage(e.target.result, (resized) => {
          set("photo_320_base64", resized.base64_320);
          set("photo_160_base64", resized.base64_160);

          let img = previewBox.querySelector("img");
          if (!img) {
            img = document.createElement("img");
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover";
            previewBox.appendChild(img);
          }
          img.src = resized.base64_320;
          img.style.display = 'block';

          const placeholder = previewBox.querySelector('.placeholder-text');
          if (placeholder) placeholder.style.display = 'none';
        });
      };
      reader.readAsDataURL(f);
    };
    if (photoInput) photoInput.onchange = (e) => handleFile(e.target.files[0]);
    if (cameraInput) cameraInput.onchange = (e) => handleFile(e.target.files[0]);


    // ------------------------------------------------------------
    // 4️⃣ 외부 도어 상하분리
    // ------------------------------------------------------------
    if (document.getElementById("equipment_door_vertical_buttons")) {
      setupButtonGroup("equipment_door_vertical_buttons", (btn) => {
        set("door_vertical_count", btn.dataset.value);
      });
    }

    // ------------------------------------------------------------
    // ♻️ Edit 모드 복원
    // ------------------------------------------------------------
    if (mode === "edit" && detail) {
      // 복원 로직 (간소화)
      // 1. 장소
      const areaVal = detail.area_id?.area_name;
      // set active button... skipping explicit loop for brevity, user can re-select if needed or I should add it.
      // It's better to add it.
      const areaBtns = document.querySelectorAll("#equipment-area-button-group button");
      let areaFound = false;
      areaBtns.forEach(b => {
        if (b.textContent.trim() === areaVal) { b.classList.add("active"); areaFound = true; }
      });
      if (!areaFound && areaOtherGroup) {
        areaOtherGroup.style.display = "block";
        areaOtherInput.value = areaVal || "";
        const other = document.getElementById("equipment-area-other-btn");
        if (other) other.classList.add("active");
      }

      // 2. 이름
      const nameVal = detail.cabinet_name;
      const nameBtns = document.querySelectorAll("#equipment_name_buttons button");
      let nameFound = false;
      nameBtns.forEach(b => {
        if (b.dataset.value === nameVal) { b.classList.add("active"); nameFound = true; }
      });
      if (nameVal === "교구장밖") {
        if (doorStep) doorStep.style.display = "none";
      }
      if (!nameFound && nameOtherGroup) {
        nameOtherGroup.style.display = "block";
        if (nameOtherInputReal) nameOtherInputReal.value = nameVal || "";
        const other = document.querySelector("#equipment_name_buttons button[data-value='기타']");
        if (other) other.classList.add("active");
      }

      // 3. 사진
      if (detail.photo_url_320) {
        previewBox.innerHTML = `<img src="${detail.photo_url_320}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
      }

      // 4. 도어
      const doorVal = detail.door_vertical_count;
      // Map integer to string if necessary?
      // Cabinet table used integer 1,2,3 mapped to labels.
      // My implementation plan said `door_vertical_count` is int.
      // In cabinet.js: 1:"단일도어", 2:"상하도어", 3:"상중하도어"
      // Let's assume we store it as text in the DB or map it.
      // SQL said `door_vertical_count` integer.
      // The HTML buttons have `data-value="상중하도어"`.
      // I need to map these when saving and restoring.
      // OR simply change the buttons to use 1, 2, 3 values in HTML?
      // Let's check `equipment-cabinet-form.html`.
      // It has `data-value="상중하도어"`.
      // I should map this in `handleEquipmentSave`.

      // Restore:
      if (doorVal) {
        const vMap = { 1: "단일도어", 2: "상하도어", 3: "상중하도어" };
        const text = vMap[doorVal]; // "상하도어"
        // Wait, buttons in HTML: "단일도어(상하분리없음)" vs "단일도어"
        // HTML: <button ...>단일도어(상하분리없음)</button> data-value="단일도어"? 
        // Let's check html content I wrote.
        // <button type="button" data-value="단일도어">단일도어(상하분리없음)</button>

        if (text) {
          const dBtns = document.querySelectorAll("#equipment_door_vertical_buttons button");
          dBtns.forEach(b => {
            // Check data-value
            if (b.dataset.value === text) b.classList.add("active");
          });
        }
      }
    }
  }


  async function handleEquipmentSave() {
    const state = App.State.dump();
    const payload = await App.Utils.makePayload(state);

    // Map text buttons to integers for DB
    // door_vertical_count
    const doorText = state.door_vertical_count; // "상중하도어"
    let doorInt = null;
    if (doorText === "단일도어") doorInt = 1;
    if (doorText === "상하도어") doorInt = 2;
    if (doorText === "상중하도어") doorInt = 3;

    const finalPayload = {
      area_name: payload.area_name, // ✅ Edge Function expects area_name to lookup/create Area

      // I need to check `makePayload` in utils.js if I want to be sure, but assuming it works for standard fields.
      // Wait, `makePayload` might rely on specific field names.
      // Let's assume manual construction for safety or rely on what `cabinet.js` did.
      // `cabinet.js` calls `makePayload(state)`.

      cabinet_name: payload.cabinet_name, // handled by makePayload "cabinet_name" logic? 
      // `makePayload` usually combines button + custom.

      photo_url_320: payload.photo_url_320,
      photo_url_160: payload.photo_url_160,
      door_vertical_count: doorInt
    };

    // Special case: Outside Cabinet
    if (state.cabinet_name_buttons === "교구장밖") {
      finalPayload.door_vertical_count = null;
    }

    if (!finalPayload.cabinet_name) return alert("이름을 입력하세요.");

    if (state.mode === "create") {
      await App.EquipmentCabinet.createCabinet(finalPayload);
      alert("✅ 등록되었습니다.");
    } else {
      await App.EquipmentCabinet.updateCabinet(state.cabinetId, finalPayload);
    }

    await App.includeHTML("pages/equipment-cabinet-list.html");
    App.EquipmentCabinet.loadList();
  }


  // -------------------------------------------------
  // 🧩 도어·단·열 버튼 렌더링
  // -------------------------------------------------
  function normalizeChoice(value, type) {
    if (value == null) return null;
    if (typeof value === "number") return String(value);
    const str = String(value).trim();
    if (!str) return null;
    if (/^\d+$/.test(str)) return str;
    const digit = str.match(/\d+/);
    if (digit) return digit[0];
    const maps = {
      horizontal: { 왼쪽: "1", 오른쪽: "2", 좌: "1", 우: "2" },
      vertical: { 상: "1", 중: "2", 하: "3" },
    };
    return maps[type]?.[str] || null;
  }

  async function renderCabinetButtons(cabinetId, detail = null) {
    const vBox = document.getElementById("location_door_vertical_group");
    const hBox = document.getElementById("location_door_horizontal_group");
    const sBox = document.getElementById("location_internal_shelf_group");
    const cBox = document.getElementById("location_storage_column_group");

    const showMessage = (box, msg) => {
      if (box) box.innerHTML = `<span style="color:#888;">${msg}</span>`;
    };

    const resetSteps = () => {
      showMessage(vBox, "수납함 선택 후 표시됩니다.");
      showMessage(hBox, "3번 항목 선택 후 표시됩니다.");
      showMessage(sBox, "4번 항목 선택 후 표시됩니다.");
      showMessage(cBox, "5번 항목 선택 후 표시됩니다.");
    };

    if (!cabinetId) {
      resetSteps();
      return;
    }

    const { data, error } = await supabase.from("Cabinet").select("*").eq("id", cabinetId).maybeSingle();
    if (error || !data) {
      resetSteps();
      return console.warn("⚠️ 캐비닛 정보 없음");
    }

    const verticalCount = Number(data.door_vertical_count || data.door_vertical) || 0;
    const horizontalCount = Number(data.door_horizontal_count || data.door_horizontal) || 0;
    const shelfCount = Number(data.shelf_height || data.internal_shelf_level) || 0;
    const columnCount = Number(data.storage_columns || data.storage_column) || 0;

    const defaults = {
      door_vertical: normalizeChoice(detail?.door_vertical, "vertical"),
      door_horizontal: normalizeChoice(detail?.door_horizontal, "horizontal"),
      internal_shelf_level: detail?.internal_shelf_level || null,
      storage_column: detail?.storage_column || null,
    };

    const renderColumns = () => {
      if (!cBox) return;
      const state = dump();
      if (!state.internal_shelf_level) {
        showMessage(cBox, "5번 항목 선택 후 표시됩니다.");
        return;
      }
      if (!columnCount) {
        showMessage(cBox, "열 정보가 없습니다.");
        return;
      }

      cBox.innerHTML = Array.from({ length: columnCount }, (_, i) => {
        const value = i + 1;
        return `<button type="button" data-value="${value}">${value}열</button>`;
      }).join("");

      // Dynamic Grid Columns
      if (columnCount > 0 && columnCount <= 12) {
        cBox.style.display = "grid";
        cBox.style.gridTemplateColumns = `repeat(${columnCount}, 1fr)`;
        cBox.style.gap = "10px 0";
      }

      setupButtonGroup("location_storage_column_group", (btn) => {
        set("storage_column", btn.dataset.value);
      });

      const selected = defaults.storage_column || state.storage_column;
      if (selected) {
        cBox.querySelector(`button[data-value="${selected}"]`)?.classList.add("active");
        defaults.storage_column = null;
      }
    };

    const renderShelves = () => {
      if (!sBox) return;
      const state = dump();
      if (!state.door_horizontal) {
        showMessage(sBox, "4번 항목 선택 후 표시됩니다.");
        showMessage(cBox, "5번 항목 선택 후 표시됩니다.");
        return;
      }
      if (!shelfCount) {
        showMessage(sBox, "선반 정보가 없습니다.");
        showMessage(cBox, "선반 정보가 없습니다.");
        return;
      }

      sBox.innerHTML = Array.from({ length: shelfCount }, (_, idx) => {
        const labelNum = shelfCount - idx;
        const value = labelNum;
        const label = `${labelNum}단`;
        return `<button type="button" data-value="${value}">${label}</button>`;
      }).join("");

      // Dynamic Grid Columns
      if (shelfCount > 0 && shelfCount <= 12) {
        sBox.style.display = "grid";
        sBox.style.gridTemplateColumns = `repeat(${shelfCount}, 1fr)`;
        sBox.style.gap = "10px 0";
      }

      setupButtonGroup("location_internal_shelf_group", (btn) => {
        set("internal_shelf_level", btn.dataset.value);
        set("storage_column", null);
        renderColumns();
      });

      const selected = defaults.internal_shelf_level || state.internal_shelf_level;
      if (selected) {
        sBox.querySelector(`button[data-value="${selected}"]`)?.classList.add("active");
        set("internal_shelf_level", selected);
        defaults.internal_shelf_level = null;
        renderColumns();
      } else {
        showMessage(cBox, "5번 항목 선택 후 표시됩니다.");
      }
    };

    const renderHorizontal = () => {
      if (!hBox) return;
      const state = dump();
      if (!state.door_vertical) {
        showMessage(hBox, "3번 항목 선택 후 표시됩니다.");
        showMessage(sBox, "4번 항목 선택 후 표시됩니다.");
        showMessage(cBox, "5번 항목 선택 후 표시됩니다.");
        return;
      }
      if (!horizontalCount) {
        showMessage(hBox, "좌우 정보가 없습니다.");
        showMessage(sBox, "좌우 정보가 없습니다.");
        showMessage(cBox, "좌우 정보가 없습니다.");
        return;
      }

      const horizontalLabels =
        horizontalCount === 1 ? ["문"] : ["왼쪽", "오른쪽"];
      hBox.innerHTML = Array.from({ length: horizontalCount }, (_, idx) => {
        const value = idx + 1;
        const label = horizontalLabels[idx] || `${value}구역`;
        return `<button type="button" data-value="${value}">${label}</button>`;
      }).join("");

      // Dynamic Grid Columns
      if (horizontalCount > 0 && horizontalCount <= 12) {
        hBox.style.display = "grid";
        hBox.style.gridTemplateColumns = `repeat(${horizontalCount}, 1fr)`;
        hBox.style.gap = "10px 0";
      }

      setupButtonGroup("location_door_horizontal_group", (btn) => {
        set("door_horizontal", btn.dataset.value);
        set("internal_shelf_level", null);
        set("storage_column", null);
        renderShelves();
      });

      const selected = defaults.door_horizontal || state.door_horizontal;
      if (selected) {
        hBox.querySelector(`button[data-value="${selected}"]`)?.classList.add("active");
        set("door_horizontal", selected);
        defaults.door_horizontal = null;
        renderShelves();
      } else {
        showMessage(sBox, "4번 항목 선택 후 표시됩니다.");
        showMessage(cBox, "5번 항목 선택 후 표시됩니다.");
      }
    };

    const renderVertical = () => {
      if (!vBox) return;
      if (!verticalCount) {
        showMessage(vBox, "문 정보가 없습니다.");
        resetSteps();
        return;
      }

      vBox.innerHTML = Array.from({ length: verticalCount }, (_, idx) => {
        const value = idx + 1;
        const label = `${verticalCount - idx}층`;
        return `<button type="button" data-value="${value}">${label}</button>`;
      }).join("");

      // Dynamic Grid Columns
      if (verticalCount > 0 && verticalCount <= 12) {
        vBox.style.display = "grid";
        vBox.style.gridTemplateColumns = `repeat(${verticalCount}, 1fr)`;
        vBox.style.gap = "10px 0";
      }

      setupButtonGroup("location_door_vertical_group", (btn) => {
        set("door_vertical", btn.dataset.value);
        set("door_horizontal", null);
        set("internal_shelf_level", null);
        set("storage_column", null);
        renderHorizontal();
      });

      const selected = defaults.door_vertical;
      if (selected) {
        vBox.querySelector(`button[data-value="${selected}"]`)?.classList.add("active");
        set("door_vertical", selected);
        defaults.door_vertical = null;
        renderHorizontal();
      } else {
        showMessage(hBox, "3번 항목 선택 후 표시됩니다.");
        showMessage(sBox, "4번 항목 선택 후 표시됩니다.");
        showMessage(cBox, "5번 항목 선택 후 표시됩니다.");
      }
    };

    renderVertical();
  }

  // -------------------------------------------------
  // 전역 등록
  // -------------------------------------------------
  globalThis.App = globalThis.App || {};
  globalThis.App.Forms = {
    initCabinetForm,
    initInventoryForm,
    initEquipmentCabinetForm, // ✅ 교구·물품장 폼 초기화 추가
    handleSave,
  };

  console.log("✅ App.Forms 모듈 초기화 완료 (도어 자동 표시 버전)");

  // -------------------------------------------------
  // 🧮 농도 변환 유틸리티
  // -------------------------------------------------
  function computeConversions({ value, unit, molarMass, density }) {
    const parseDensity = (d) => {
      if (d === null || d === undefined) return null;
      const match = String(d).match(/-?\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : null;
    };

    const v = Number(value);
    const mw = Number(molarMass);
    const rho = parseDensity(density) ?? 1; // g/mL (solute density)
    const waterRho = 1; // g/mL, assumption
    const result = { percent: null, molarity: null, molality: null };

    if (!Number.isFinite(v) || !Number.isFinite(mw) || mw <= 0) return null;

    if (unit === "%") {
      // % w/w -> Molarity, Molality
      // Use separate volumes: solute volume from its density, solvent volume from water density.
      const massSolute = v; // g (in 100 g solution)
      const totalMass = 100; // g
      const solventMass = totalMass - massSolute;

      const soluteVolumeL = massSolute / rho / 1000; // L
      const solventVolumeL = solventMass / waterRho / 1000; // L
      const solutionVolumeL = soluteVolumeL + solventVolumeL;

      const moles = massSolute / mw;
      result.molarity = solutionVolumeL > 0 ? moles / solutionVolumeL : null;

      const solventMassKg = solventMass / 1000;
      result.molality = solventMassKg > 0 ? moles / solventMassKg : null;
      result.percent = v;
    } else if (unit === "M" || unit === "N") {
      // Molarity -> % w/w, Molality
      // Assume M = N for simplicity if not specified, or treat input as M
      const effectiveM = v;
      // Basis: 1 L solution
      const solutionVolumeL = 1;
      const moles = effectiveM * solutionVolumeL;
      const soluteMassG = moles * mw;
      const solutionMassG = solutionVolumeL * 1000 * rho;

      result.percent = solutionMassG > 0 ? (soluteMassG / solutionMassG) * 100 : null;

      const solventMassKg = (solutionMassG - soluteMassG) / 1000;
      result.molality = solventMassKg > 0 ? moles / solventMassKg : null;
      result.molarity = effectiveM;
    }
    return result;
  }
})();
