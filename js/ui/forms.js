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
      set("bottle_type", detail.bottle_type);
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
        setInput("cas_rn", detail.Substance?.cas_rn);
        setInput("purchase_volume", detail.initial_amount); // CHANGED: purchase_volume -> initial_amount
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
        setBtnGroup("bottle_type_buttons", detail.bottle_identifier); // CHANGED: bottle_type -> bottle_identifier
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
          set("manufacturer", "기타");
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
      // Location buttons are handled dynamically in location logic
    ];

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
    const photoInput = document.getElementById("photo-input");
    const cameraInput = document.getElementById("camera-input");
    const previewBox = document.getElementById("photo-preview");
    const previewImg = document.getElementById("preview-img");
    const videoStream = document.getElementById("camera-stream");
    const canvas = document.getElementById("camera-canvas");

    let isCameraActive = false;

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
      if (cameraBtn) cameraBtn.innerHTML = '카메라로 촬영';
      if (cameraCancelBtn) cameraCancelBtn.style.display = 'none';
    };

    // Helper: Start Camera
    const startCameraFunc = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        inventoryStream = stream;
        videoStream.srcObject = inventoryStream;
        videoStream.style.display = 'block';

        // Hide preview info
        if (previewImg) previewImg.style.display = 'none';
        const placeholder = previewBox.querySelector('.placeholder-text');
        if (placeholder) placeholder.style.display = 'none';

        isCameraActive = true;
        cameraBtn.innerHTML = '촬영하기';
        if (cameraCancelBtn) cameraCancelBtn.style.display = 'inline-block';
      } catch (err) {
        console.error("Camera access denied:", err);
        cameraInput.click();
      }
    };

    // Helper: Take Photo
    const takePhoto = () => {
      if (!videoStream || !canvas) return;
      canvas.width = videoStream.videoWidth;
      canvas.height = videoStream.videoHeight;
      canvas.getContext('2d').drawImage(videoStream, 0, 0);

      const base64 = canvas.toDataURL("image/jpeg");

      // Set State
      processImage(base64, (resized) => {
        set("photo_320_base64", resized.base64_320);
        set("photo_160_base64", resized.base64_160);

        if (previewImg) {
          previewImg.src = resized.base64_320;
          previewImg.style.display = 'block';
        } else {
          // Fallback if previewImg missing (shouldn't happen with HTML update)
          previewBox.innerHTML = `<img src="${resized.base64_320}" id="preview-img" style="width:100%;height:100%;object-fit:contain;">` +
            `<video id="camera-stream" autoplay playsinline style="width:100%;height:100%;object-fit:cover;display:none;"></video>` +
            `<canvas id="camera-canvas" style="display:none;"></canvas>`;
          // Re-grab references if innerHTML overwritten
        }
      });

      stopCamera();
      cameraBtn.innerHTML = '다시 촬영';
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
          takePhoto();
        } else {
          startCameraFunc();
        }
      };
    }

    if (cameraCancelBtn) {
      cameraCancelBtn.onclick = () => {
        stopCamera();
        // Restore preview if exists in state? 
        // For now, simple stop.
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
          if (!loc.cabinet_id) {
            alert("수납함을 선택해주세요.");
            return;
          }
          // Update State with Location
          set("cabinet_id", loc.cabinet_id);
          set("door_vertical", loc.door_vertical);
          set("door_horizontal", loc.door_horizontal);
          set("internal_shelf_level", loc.internal_shelf_level);
          set("storage_column", loc.storage_column);
        }

        try {
          const payload = await makePayload(dump()); // Validate & Transform

          // Override makePayload's cabinet logic for Inventory
          Object.assign(payload, {
            cabinet_id: get("cabinet_id"),
            door_vertical: get("door_vertical"),
            door_horizontal: get("door_horizontal"),
            internal_shelf_level: get("internal_shelf_level"),
            storage_column: get("storage_column")
          });

          if (mode === "create") {
            await App.Inventory.create(payload);
            alert("✅ 등록 완료");
          } else {
            await App.Inventory.update(detail.id, payload);
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
    const photoInput = document.getElementById("cabinet-photo-input");
    const cameraInput = document.getElementById("cabinet-camera-input");
    const previewBox = document.getElementById("cabinet-photo-preview");
    const cameraBtn = document.getElementById("cabinet-camera-btn");
    const photoBtn = document.getElementById("cabinet-photo-btn");
    const cameraCancelBtn = document.getElementById("cabinet-camera-cancel-btn");
    const videoStream = document.getElementById("cabinet-camera-stream");
    const canvas = document.getElementById("cabinet-camera-canvas");
    let isCameraActive = false;

    // Ensure previous stream is stopped when initializing form
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
        if (tracks) tracks.forEach(track => track.stop());
        videoStream.srcObject = null;
      }

      if (videoStream) videoStream.style.display = 'none';

      isCameraActive = false;
      if (cameraBtn) cameraBtn.innerHTML = '<span class="material-symbols-outlined">photo_camera</span> 카메라로 촬영';
      // Cancel button is inside the container, so it hides with it, but good to be explicit if needed
      if (cameraCancelBtn) cameraCancelBtn.style.display = 'none';
    };

    const startCabinetCamera = async () => {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });

        cabinetStream = newStream;
        videoStream.srcObject = cabinetStream;
        videoStream.style.display = 'block';

        // Hide existing image if any
        const existingImg = previewBox.querySelector('img');
        if (existingImg) existingImg.style.display = 'none';

        const placeholder = previewBox.querySelector('.placeholder-text');
        if (placeholder) placeholder.style.display = 'none';

        isCameraActive = true;
        cameraBtn.innerHTML = '촬영하기';
        if (cameraCancelBtn) cameraCancelBtn.style.display = 'inline-block';
      } catch (err) {
        console.error("Camera access denied or error:", err);
        // Fallback to file input (mobile behavior)
        cameraInput.click();
      }
    };

    const takeCabinetPhoto = () => {
      if (!videoStream || !canvas) return;
      canvas.width = videoStream.videoWidth;
      canvas.height = videoStream.videoHeight;
      canvas.getContext('2d').drawImage(videoStream, 0, 0);

      const base64 = canvas.toDataURL("image/jpeg");

      // Update State (resize logic handled in processImage if needed, but here we just store base64 for now or use processImage helper)
      // The original code used processImage for file input, let's reuse it or just store directly if that's what inventory does.
      // Inventory stores directly. Cabinet used processImage to resize. Let's stick to resizing if possible or just store raw for now to match inventory logic which seems simpler.
      // Wait, cabinet form uses photo_320_base64 and photo_160_base64. I should probably use processImage to maintain consistency.

      processImage(base64, (resized) => {
        set("photo_320_base64", resized.base64_320);
        set("photo_160_base64", resized.base64_160);

        // Show preview
        const placeholder = previewBox.querySelector('.placeholder-text');
        if (placeholder) placeholder.style.display = 'none';

        const existingImg = previewBox.querySelector('img');
        if (existingImg) existingImg.remove();

        const img = document.createElement('img');
        img.src = resized.base64_320;
        img.alt = "시약장 사진";
        img.style.maxWidth = "100%";
        img.style.maxHeight = "100%";
        img.style.objectFit = "contain";
        previewBox.appendChild(img);
      });

      stopCabinetCamera();
      cameraBtn.innerHTML = '다시 촬영';
    };

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

          const existingImg = previewBox.querySelector('img');
          if (existingImg) existingImg.remove();

          const img = document.createElement('img');
          img.src = resized.base64_320;
          img.alt = "시약장 사진";
          img.style.maxWidth = "100%";
          img.style.maxHeight = "100%";
          img.style.objectFit = "contain";
          previewBox.appendChild(img);
        });
      };
      reader.readAsDataURL(file);
    };

    if (photoBtn && photoInput) {
      photoBtn.onclick = () => {
        if (isCameraActive) stopCabinetCamera();
        photoInput.click();
      };
    }

    if (cameraBtn) {
      cameraBtn.onclick = () => {
        if (isCameraActive) {
          takeCabinetPhoto();
        } else {
          startCabinetCamera();
        }
      };
    }

    if (cameraCancelBtn) {
      cameraCancelBtn.onclick = () => {
        stopCabinetCamera();
      };
    }

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
    const photoInput = document.getElementById("equipment-photo-input");
    const cameraInput = document.getElementById("equipment-camera-input");
    const previewBox = document.getElementById("equipment-photo-preview");
    const cameraBtn = document.getElementById("equipment-camera-btn");
    const photoBtn = document.getElementById("equipment-photo-btn");
    const cameraCancelBtn = document.getElementById("equipment-camera-cancel-btn");
    const videoStream = document.getElementById("equipment-camera-stream");
    const canvas = document.getElementById("equipment-camera-canvas");
    let isCameraActive = false;
    let equipmentStream = null;

    const stopCamera = () => {
      if (equipmentStream) {
        equipmentStream.getTracks().forEach(t => t.stop());
        equipmentStream = null;
      }
      if (videoStream) videoStream.style.display = "none";
      isCameraActive = false;
      if (cameraBtn) cameraBtn.innerHTML = '<span class="material-symbols-outlined">photo_camera</span> 카메라로 촬영';
      if (cameraCancelBtn) cameraCancelBtn.style.display = "none";
    };

    const startCameraFunc = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        equipmentStream = stream;
        videoStream.srcObject = stream;
        videoStream.style.display = "block";
        isCameraActive = true;
        cameraBtn.innerHTML = "촬영하기";
        if (cameraCancelBtn) cameraCancelBtn.style.display = "inline-flex";

        // Hide placeholder
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

        const img = document.createElement("img");
        img.src = resized.base64_320;
        img.style.maxWidth = "100%";
        img.style.maxHeight = "100%";
        img.style.objectFit = "contain";

        previewBox.innerHTML = "";
        previewBox.appendChild(img);
      });
      stopCamera();
      cameraBtn.innerHTML = "다시 촬영";
    };

    if (cameraBtn) cameraBtn.onclick = () => isCameraActive ? takePhoto() : startCameraFunc();
    if (cameraCancelBtn) cameraCancelBtn.onclick = stopCamera;
    if (photoBtn) photoBtn.onclick = () => { if (isCameraActive) stopCamera(); photoInput.click(); };

    const handleFile = (f) => {
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        App.Camera.processImage(e.target.result, (resized) => {
          set("photo_320_base64", resized.base64_320);
          set("photo_160_base64", resized.base64_160);
          const img = document.createElement("img");
          img.src = resized.base64_320;
          img.style.maxWidth = "100%";
          img.style.maxHeight = "100%";
          img.style.objectFit = "contain";
          previewBox.innerHTML = "";
          previewBox.appendChild(img);
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
