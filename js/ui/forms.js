// ====================================================================
// 약품 등록 폼 관련
// ====================================================================
(function () {
  const { callEdge, EDGE } = window.App.API;

  let selectedClassification = null, selectedState = null, selectedUnit = null;

  function initializeFormListeners() {
    console.log("폼 초기화 중...");
    setFabVisibility(false);
  }

  function setupButtonGroup(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      group.querySelectorAll(".active").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  }

  async function importData(event) {
    event.preventDefault();

    const statusMessage = document.getElementById("statusMessage");
    const submitButton = document.getElementById("inventory-submit-button");
    if (!statusMessage || !submitButton) return;

    const casRn = document.getElementById("cas_rn")?.value?.trim();
    if (!casRn) {
      statusMessage.textContent = "CAS 번호를 입력해 주세요.";
      statusMessage.style.color = "red";
      return;
    }

    const purchaseVolumeStr = document.getElementById("purchase_volume")?.value;
    const concentrationValueStr = document.getElementById("concentration_value")?.value;
    const manufacturerOtherInput = document.getElementById("manufacturer_other");
    const manufacturerOther = manufacturerOtherInput ? manufacturerOtherInput.value.trim() : "";
    const purchaseDate = document.getElementById("purchase_date")?.value;

    const purchaseVolume = parseFloat(purchaseVolumeStr);
    const concentrationValue = parseFloat(concentrationValueStr);

    const finalManufacturer =
      selectedManufacturer === "기타" ? (manufacturerOther || null) : selectedManufacturer;
    const finalClassification = selectedClassification || "미분류";

    const payload = {
      casRns: [casRn],
      inventoryDetails: {
        concentration_value: isNaN(concentrationValue) ? null : concentrationValue,
        concentration_unit: selectedConcentrationUnit || null,
        purchase_volume: isNaN(purchaseVolume) ? null : purchaseVolume,
        current_amount: isNaN(purchaseVolume) ? null : purchaseVolume,
        unit: selectedUnit || null,
        state: selectedState || null,
        manufacturer: finalManufacturer,
        purchase_date: purchaseDate || null,
        classification: finalClassification,
        cabinet_id: locationSelections?.cabinet_id || null,
        location_area: locationSelections?.location_area || null,
        door_vertical: locationSelections?.door_vertical || null,
        door_horizontal: locationSelections?.door_horizontal || null,
        internal_shelf_level: locationSelections?.internal_shelf_level || null,
        storage_columns: locationSelections?.storage_columns || null,
        photo_320_base64: selectedPhoto_320_Base64,
        photo_160_base64: selectedPhoto_160_Base64,
        location: "Initial Check-in",
      },
    };

    try {
      submitButton.disabled = true;
      submitButton.textContent = "저장 중...";
      statusMessage.textContent = "데이터를 처리 중입니다...";
      statusMessage.style.color = "blue";

      // ✅ api.js의 공통 callEdge 사용
      const data = await callEdge(EDGE.CASIMPORT, { method: "POST", body: payload });

      if (!Array.isArray(data) || data.length === 0)
        throw new Error("서버에서 유효한 응답을 받지 못했습니다.");

      const result = data[0];
      const msg = result.isNewSubstance
        ? `✅ 신규 물질(${casRn}) 정보 및 시약병 등록 완료!`
        : `✅ 기존 물질(${casRn})에 새 시약병 등록 완료!`;
      alert(msg);

      if (typeof loadInventoryListPage === "function") {
        loadInventoryListPage();
      }
    } catch (error) {
      console.error("데이터 전송 중 오류 발생:", error);
      alert(`❌ 오류: 데이터 처리 실패.\n\n(${error.message})`);
      statusMessage.textContent = "";
    } finally {
      if (document.getElementById("inventory-form")) {
        submitButton.disabled = false;
        submitButton.textContent = "입고 약품 정보 저장";
      }
    }
  }

  // 전역 등록
  window.initializeFormListeners = initializeFormListeners;
  window.setupButtonGroup = setupButtonGroup;
  window.importData = importData;
})();
