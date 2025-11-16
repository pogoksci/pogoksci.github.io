// /js/ui/inventory-register.js
(function () {
  const getApp = () => globalThis.App || {};
  const getSupabase = () => getApp().supabase;

  // Base64 변환
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 사진 업로드 핸들러
  function setupPhotoUpload() {
    const uploadBtn = document.getElementById("photo-upload-btn");
    const input = document.getElementById("photo-input");
    const preview = document.getElementById("photo-preview");

    uploadBtn.addEventListener("click", () => input.click());
    input.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const base64 = await fileToBase64(file);
      preview.innerHTML = `<img src="${base64}" alt="미리보기">`;
      preview.dataset.base64 = base64;
    });
  }

  async function initForm() {
    setupPhotoUpload();
    await App.StorageSelector.init("storage-selector");

    const form = document.getElementById("inventory-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleSubmit();
    });

    document.getElementById("cancel-form-btn").addEventListener("click", async () => {
      if (getApp().Inventory?.showListPage)
        await getApp().Inventory.showListPage();
      else location.reload();
    });
  }

  // Edge Function 호출
  async function handleSubmit() {
    const supabase = getSupabase();
    const cas = document.getElementById("cas-input").value.trim();
    const volume = parseFloat(document.getElementById("purchase-volume-input").value);
    const unit = document.getElementById("unit-select").value;
    if (!cas || !volume || !unit) {
      alert("CAS, 구입용량, 단위를 입력해 주세요.");
      return;
    }

    const inventoryDetails = {
      purchase_volume: volume,
      unit,
      state: document.getElementById("state-input").value.trim() || null,
      classification: document.getElementById("classification-input").value.trim() || null,
      manufacturer: document.getElementById("manufacturer-input").value.trim() || null,
      purchase_date: document.getElementById("purchase-date-input").value || null,
      ...App.StorageSelector.getSelection(),
    };

    const preview = document.getElementById("photo-preview");
    if (preview.dataset.base64) {
      inventoryDetails.photo_320_base64 = preview.dataset.base64;
      inventoryDetails.photo_160_base64 = preview.dataset.base64;
    }

    try {
      const { data, error } = await supabase.functions.invoke("casimport", {
        method: "POST",
        body: {
          casRns: [cas],
          inventoryDetails,
        },
      });

      if (error) throw error;
      alert("등록 완료!");
      console.log("📦 등록 결과:", data);
      if (getApp().Inventory?.showListPage)
        await getApp().Inventory.showListPage();
    } catch (err) {
      console.error("등록 실패:", err);
      alert("등록 중 오류가 발생했습니다.");
    }
  }

  document.addEventListener("DOMContentLoaded", initForm);

  globalThis.App = getApp();
  globalThis.App.Forms = globalThis.App.Forms || {};
  globalThis.App.Forms.initInventoryForm = initForm;
})();
