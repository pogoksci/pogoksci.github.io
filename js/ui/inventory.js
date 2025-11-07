// /js/ui/inventory.js — 약품(Inventory) 목록 + 정렬 + 삭제(Edge) 리팩토링
(function () {
  const getApp = () => globalThis.App || {};
  const getSupabase = () => getApp().supabase;
  let currentSort = "created_at_desc"; // 기본: 등록순(최신)

  // 정렬 함수
  function sortData(rows, key) {
    const collateKo = (a, b) => String(a || "").localeCompare(String(b || ""), "ko");
    const collateEn = (a, b) => String(a || "").localeCompare(String(b || ""), "en", { sensitivity: "base" });

    switch (key) {
      case "category_name_kor":
        return rows.sort((a, b) => collateKo(a.classification, b.classification) || collateKo(a.name_kor, b.name_kor));
      case "name_kor":
        return rows.sort((a, b) => collateKo(a.name_kor, b.name_kor));
      case "name_eng":
        return rows.sort((a, b) => collateEn(a.name_eng, b.name_eng));
      case "formula":
        return rows.sort((a, b) => collateEn(a.formula, b.formula));
      case "storage_location":
        return rows.sort((a, b) => collateKo(a.storage_location, b.storage_location));
      case "quantity_desc":
        return rows.sort((a, b) => (b.current_amount ?? 0) - (a.current_amount ?? 0));
      case "created_at_desc":
      default:
        return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  }

  function renderList(mapped, container, status) {
    if (!mapped.length) {
      status.textContent = "📭 등록된 약품이 없습니다.";
      container.innerHTML = "";
      return;
    }
    status.textContent = "";
    container.innerHTML = mapped
      .map((it) => {
        const img = it.photo_url_320 || "/img/no-image.png";
        return `
          <div class="inventory-card">
            <div class="card-image-placeholder">
              <img class="card-image" src="${img}" alt="${it.name_kor || it.cas_rn}" />
            </div>
            <div class="card-info">
              <h3>${it.name_kor || "-"}</h3>
              <p class="area-name">${it.storage_location || "위치: 미지정"}</p>
              <p class="cabinet-specs">재고: ${it.current_amount ?? 0}${it.unit || ""} · 등록일 ${new Date(it.created_at).toLocaleDateString()}</p>
            </div>
            <div class="card-actions">
              <button class="edit-btn" data-id="${it.id}">수정</button>
              <button class="delete-btn" data-id="${it.id}">삭제</button>
            </div>
          </div>
        `;
      })
      .join("");

    // 이벤트 바인딩
    container.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        // 상세/수정 화면 라우팅 (앱의 기존 라우터 규약 사용)
        if (getApp().Router?.go && getApp().Forms?.initInventoryForm) {
          await getApp().Router.go("addInventory", "form-container", () =>
            getApp().Forms.initInventoryForm("edit", { id }),
          );
        }
      });
    });

    container.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        if (!confirm("정말 삭제하시겠습니까?")) return;

        // ✅ Edge Function DELETE 호출
        try {
          const supabase = getSupabase();
          const { data, error } = await supabase.functions.invoke("casimport", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            // invoke의 DELETE는 body 없이 querystring을 써야 하므로 아래 방식으로 호출
            // supabase-js v2 invoke는 쿼리스트링 포함 URL 자동 구성 미지원 → fetch 사용
          });
        } catch (_) {
          // invoke(method: "DELETE")는 쿼리스트링 지원이 애매하므로 fetch로 대체:
          const fnUrl = `${getApp().projectFunctionsBaseUrl || "/functions/v1"}/casimport?type=inventory&id=${id}`;
          const res = await fetch(fnUrl, { method: "DELETE" });
          if (!res.ok) {
            const msg = await res.text();
            alert("삭제 실패: " + msg);
            return;
          }
        }

        alert("삭제되었습니다.");
        loadList();
      });
    });
  }

  async function loadList() {
    const supabase = getSupabase();
    const container = document.getElementById("inventory-list-container");
    const status = document.getElementById("status-message-inventory-list");
    if (!container || !status) return;

    status.textContent = "🔄 약품 목록을 불러오는 중...";

    // ✅ 관계형 조회: Inventory + Substance + Cabinet + Area
    const { data, error } = await supabase
      .from("Inventory")
      .select(`
        id, current_amount, unit, classification, created_at, photo_url_320,
        door_vertical, door_horizontal, internal_shelf_level, storage_column,
        Substance ( name, cas_rn, molecular_formula ),
        Cabinet ( name, Area ( name ) )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ 목록 조회 오류:", error);
      status.textContent = "약품 목록을 불러오지 못했습니다.";
      return;
    }

    const mapped = (data || []).map((row) => {
      const area = row.Cabinet?.Area?.name || "";
      const cab = row.Cabinet?.name || "";
      const v = row.door_vertical || "";   // 예: '1층'/'2층' 등 (문자)
      const h = row.door_horizontal || ""; // 예: '문'/'왼쪽문' 등 (문자)
      const shelf = row.internal_shelf_level != null ? `${row.internal_shelf_level}층` : "";
      const col = row.storage_column != null ? `${row.storage_column}열` : "";
      const loc = [area, cab, v, h, shelf, col].filter(Boolean).join(" · ");

      return {
        id: row.id,
        created_at: row.created_at,
        current_amount: row.current_amount,
        unit: row.unit,
        classification: row.classification || "",
        photo_url_320: row.photo_url_320 || null,
        name_kor: row.Substance?.name || "",
        name_eng: "", // (필요 시 동의어/영문명 테이블로 확장)
        cas_rn: row.Substance?.cas_rn || "",
        formula: row.Substance?.molecular_formula || "",
        storage_location: loc,
      };
    });

    // 현재 정렬 적용
    const sorted = sortData(mapped, currentSort);
    renderList(sorted, container, status);
  }

  function setupSortUI() {
    const select = document.getElementById("sort-select");
    if (!select) return;
    select.addEventListener("change", () => {
      currentSort = select.value;
      loadList();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupSortUI();
    loadList();
  });

  // 외부에서 재호출할 수 있게 공개
  globalThis.App = getApp();
  globalThis.App.Inventory = { loadList };
})();
