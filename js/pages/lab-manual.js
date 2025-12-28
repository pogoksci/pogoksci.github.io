(function () {
    const LabManual = {};

    let MANUAL_DATA = [];

    LabManual.init = async function () {
        try {
            console.log("📖 Lab Manual Init");
            const mainContent = document.getElementById('lab-manual-container');
            if (!mainContent) {
                console.error("❌ lab-manual-container not found!");
                return;
            }

            // 1. Force Body Scroll Unlock
            document.body.style.overflowY = "auto";
            document.body.style.height = "auto";
            document.body.style.overscrollBehaviorY = "auto";

            // Show Loading State
            mainContent.innerHTML = '<div style="padding:40px; text-align:center;">데이터를 불러오는 중입니다...</div>';

            if (!App.supabase) {
                throw new Error("Supabase Client is not initialized.");
            }

            // 2. Fetch Data from DB
            await fetchContentFromDB();

            mainContent.innerHTML = `
                <div style="
                    height: 100vh; 
                    overflow-y: auto; 
                    -webkit-overflow-scrolling: touch; 
                    padding: 20px; 
                    box-sizing: border-box; 
                    padding-bottom: 120px;
                ">
                    <div style="max-width: 1000px; margin: 0 auto;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
                            <h1 style="margin:0; font-weight: 700; color: #333;">🧪 과학실 사용 설명서</h1>
                            <button id="btn-sync-manual" style="display:none; padding:8px 16px; background:#f44336; color:white; border:none; border-radius:4px; cursor:pointer;">
                                🔄 최신 콘텐츠 동기화
                            </button>
                        </div>
                        <p style="color:#666; margin-bottom:30px;">과학실 시설 현황과 안전 장비 위치를 확인하세요.</p>
                        <div style="display:flex; flex-direction:column; gap:40px;">
                            ${renderManuals()}
                        </div>
                    </div>
                </div>
            `;

            checkAdminRole();
        } catch (err) {
            console.error("LabManual Init Error:", err);
            const mainContent = document.getElementById('lab-manual-container');
            if (mainContent) mainContent.innerHTML = `<div style="padding:20px; color:red;">오류가 발생했습니다: ${err.message}</div>`;
            alert("오류 발생: " + err.message);
        }
    };

    function checkAdminRole() {
        if (App.Auth && App.Auth.isAdmin && App.Auth.isAdmin()) {
            const btn = document.getElementById('btn-sync-manual');
            if (btn) {
                btn.style.display = 'block';
                btn.onclick = triggerContentSync;
            }
        }
    }

    async function triggerContentSync() {
        if (!confirm("구글 사이트(원본)의 최신 내용으로 동기화하시겠습니까?")) return;
        const btn = document.getElementById('btn-sync-manual');
        btn.disabled = true;
        btn.textContent = "동기화 중...";

        const { data, error } = await App.supabase.functions.invoke('sync-content', {
            body: { target: 'manual' }
        });

        if (error) {
            alert("동기화 실패: " + error.message);
            btn.textContent = "🔄 최신 콘텐츠 동기화";
            btn.disabled = false;
        } else {
            alert(data.message || "동기화 완료!");
            location.reload();
        }
    }

    async function fetchContentFromDB() {
        const { data, error } = await App.supabase
            .from('lab_manual_content')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) {
            console.error("DB Fetch Error:", error);
            alert("콘텐츠를 불러오는데 실패했습니다.");
            return;
        }

        // Group by section_title
        const groups = {};
        data.forEach(item => {
            if (!groups[item.section_title]) groups[item.section_title] = [];
            groups[item.section_title].push({
                caption: item.caption,
                src: item.image_url
            });
        });

        // Convert to array
        // Order keys manually if needed, or rely on insert order if seeded correctly.
        // Or specific logic to sort keys. For now, rely on seeded order implicitly or basic object iteration
        // Better: Find unique Titles in valid order from data.
        const uniqueTitles = [...new Set(data.map(d => d.section_title))];

        MANUAL_DATA = uniqueTitles.map(title => ({
            title: title,
            items: groups[title]
        }));
    }

    function renderManuals() {
        return MANUAL_DATA.map(group => `
            <div>
                <h2 style="font-size: 1.4rem; color: #1976d2; border-bottom: 2px solid #eee; padding-bottom: 8px; margin-bottom: 16px;">
                    ${group.title}
                </h2>
                <div class="manual-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px;">
                    ${group.items.map(item => `
                        <div style="border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); background: white; transition: transform 0.2s;">
                            <div style="width: 100%; height: 200px; background: #f0f0f0; overflow:hidden;">
                                <img src="${item.src}" alt="${item.caption}" loading="lazy" 
                                    style="width: 100%; height: 100%; object-fit: cover; cursor:pointer;"
                                    onclick="window.open('${item.src}', '_blank')">
                            </div>
                            <div style="padding: 12px;">
                                <h3 style="margin: 0; font-size: 1rem; color: #444; text-align: center;">${item.caption}</h3>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    globalThis.App = globalThis.App || {};
    globalThis.App.LabManual = LabManual;
})();
