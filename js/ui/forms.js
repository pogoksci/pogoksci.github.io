// js/ui/forms.js
(async function () {
  const { supabase } = globalThis.App;
  const { EDGE, callEdge } = globalThis.App.API;

  let selectedClassification = null;
  let selectedState = null;
  let selectedUnit = null;

  // ======================================================
  // 3️⃣ 폼 초기화
  // ======================================================
  async function initializeFormListeners() {
    console.log("폼 초기화 중...");
    setFabVisibility?.(false);

    document
      .getElementById("inventory-form")
      ?.addEventListener("submit", importData);
  }

  // ======================================================
  // 4️⃣ 약품 입고 등록
  // ======================================================
  async function importData(event) {
    event.preventDefault();
    const submitButton = document.getElementById("inventory-submit-button");
    const statusMessage = document.getElementById("statusMessage");

    try {
      const casRn = document.getElementById("cas_rn")?.value?.trim();
      if (!casRn) throw new Error("CAS 번호를 입력해 주세요.");

      const purchaseVolumeStr = document.getElementById("purchase_volume")?.value;
      const concentrationValueStr = document.getElementById("concentration_value")?.value;
      const purchaseVolume = parseFloat(purchaseVolumeStr);
      const concentrationValue = parseFloat(concentrationValueStr);

      const payload = {
        casRns: [casRn],
        inventoryDetails: {
          concentration_value: isNaN(concentrationValue) ? null : concentrationValue,
          purchase_volume: isNaN(purchaseVolume) ? null : purchaseVolume,
          current_amount: isNaN(purchaseVolume) ? null : purchaseVolume,
          unit: selectedUnit || null,
          state: selectedState || null,
          classification: selectedClassification || "미분류",
        },
      };

      submitButton.disabled = true;
      submitButton.textContent = "저장 중...";
      statusMessage.textContent = "입고 처리 중...";

      const res = await callEdge(EDGE.CASIMPORT, {
        method: "POST",
        body: payload,
      });

      alert(`✅ ${casRn} 등록 완료`);
      await includeHTML("pages/inventory-list.html", "form-container");
      await fetchInventoryAndRender();
    } catch (err) {
      console.error(err);
      alert(`❌ 오류: ${err.message}`);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "입고 약품 정보 저장";
      statusMessage.textContent = "";
    }
  }

  globalThis.initializeFormListeners = initializeFormListeners;
})();
