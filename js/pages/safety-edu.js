(function () {
    let VIDEO_LIST = [];
    let MANUAL_LIST_GROUPED = [];

    const SafetyEdu = {};

    SafetyEdu.init = async function () {
        try {
            console.log("🛡️ Safety Education Init - Logic Executing");
            const mainContent = document.getElementById('safety-edu-container');
            if (!mainContent) {
                console.error("❌ safety-edu-container not found!");
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

            // 3. Render Content with explicit scrolling container
            mainContent.innerHTML = `
                <div class="safety-main-container">
                    <div class="safety-content-wrapper">
                        <div class="safety-header-row">
                            <h1 class="safety-section-title">🧯 과학실 안전 교육</h1>
                            <button id="btn-sync-content" class="safety-sync-btn">
                                🔄 최신 콘텐츠 동기화
                            </button>
                        </div>
                        
                        <div class="tabs safety-tabs-container">
                            <button class="nav-tab active" data-target="video-section">안전교육 동영상 (${VIDEO_LIST.length})</button>
                            <button class="nav-tab" data-target="manual-section">안전 메뉴얼 / 서식 (${countManualItems()})</button>
                        </div>

                        <div id="video-section" class="tab-content">
                            <div class="safety-video-grid">
                                ${renderVideos()}
                            </div>
                        </div>

                        <div id="manual-section" class="tab-content" style="display:none;">
                            ${renderManuals()}
                        </div>
                    </div>
                </div>
            `;

            // Bind Tabs
            const tabs = mainContent.querySelectorAll('.nav-tab');
            tabs.forEach(tab => {
                tab.onclick = () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');

                    const target = tab.dataset.target;
                    mainContent.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

                    const targetEl = document.getElementById(target);
                    if (targetEl) targetEl.style.display = 'block';
                };
            });

            // Trigger default tab
            const defaultTab = mainContent.querySelector('.nav-tab.active');
            if (defaultTab) {
                const target = defaultTab.dataset.target;
                mainContent.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
                const targetEl = document.getElementById(target);
                if (targetEl) targetEl.style.display = 'block';
            }

            // Removed inline style injection. Styles moved to styles.css

            // Bind Manual Buttons
            bindManualButtons();

            // Check Admin/Teacher for Sync Button
            checkAdminRole();

        } catch (err) {
            console.error("SafetyEdu Init Error:", err);
            const mainContent = document.getElementById('safety-edu-container');
            if (mainContent) mainContent.innerHTML = `<div style="padding:20px; color:red;">오류가 발생했습니다: ${err.message}</div>`;
            alert("오류 발생: " + err.message);
        }
    };

    async function fetchContentFromDB() {
        const { data, error } = await App.supabase
            .from('safety_content')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) {
            console.error("DB Fetch Error:", error);
            alert("콘텐츠를 불러오는데 실패했습니다.");
            return;
        }

        // Separate Videos and Manuals
        VIDEO_LIST = data.filter(item => item.content_type === 'video').map(item => ({
            category: item.category,
            title: item.title,
            id: item.external_id
        }));

        const manuals = data.filter(item => item.content_type === 'pdf');

        // Group Manuals by category
        const groups = {};
        manuals.forEach(m => {
            if (!groups[m.category]) groups[m.category] = [];
            groups[m.category].push({
                title: m.title,
                fileId: m.external_id
            });
        });

        MANUAL_LIST_GROUPED = Object.keys(groups).map(key => ({
            category: key,
            items: groups[key]
        }));
    }

    function countManualItems() {
        return MANUAL_LIST_GROUPED.reduce((acc, cur) => acc + cur.items.length, 0);
    }

    function renderVideos() {
        return VIDEO_LIST.map(v => `
            <div class="video-card">
                <div class="safety-video-wrapper">
                    <iframe 
                        class="safety-video-iframe"
                        src="https://www.youtube.com/embed/${v.id}" 
                        title="${v.title}" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                    </iframe>
                </div>
                <div class="safety-video-info">
                    <div class="safety-video-category">${v.category}</div>
                    <h3 class="safety-video-title">${v.title}</h3>
                </div>
            </div>
        `).join('');
    }

    function renderManuals() {
        return MANUAL_LIST_GROUPED.map((cat, idx) => `
            <div class="safety-manual-section">
                <h3 class="safety-manual-category">${cat.category}</h3>
                <div class="manual-pdf-container">
                    ${cat.items.map(item => `
                        <button class="manual-btn" data-file="${item.fileId}">
                            <span class="material-symbols-outlined" style="font-size:18px;">picture_as_pdf</span>
                            ${item.title}
                        </button>
                    `).join('')}
                </div>
                <!-- Viewer Area for this Category -->
                <div id="viewer-cat-${idx}" class="pdf-viewer-box safety-pdf-viewer">
                </div>
            </div>
        `).join('');
    }

    function bindManualButtons() {
        document.querySelectorAll('.manual-btn').forEach(btn => {
            btn.onclick = (e) => {
                const viewerBox = btn.closest('div').nextElementSibling; // The viewer area sibling
                const fileId = btn.dataset.file;

                // Toggle Logic
                if (btn.classList.contains('active')) {
                    btn.classList.remove('active');
                    viewerBox.style.height = '0';
                    viewerBox.innerHTML = '';
                    return;
                }

                // Deactivate others in same container
                const container = btn.parentElement;
                container.querySelectorAll('.manual-btn').forEach(b => b.classList.remove('active'));

                // Activate this
                btn.classList.add('active');

                // Render iframe
                viewerBox.innerHTML = `
                    <iframe src="https://drive.google.com/file/d/${fileId}/preview" width="100%" height="600" style="border:none;"></iframe>
                `;
                viewerBox.style.height = '600px';
                viewerBox.style.marginTop = '10px';
                viewerBox.style.border = '1px solid #ddd';
            };
        });
    }

    function checkAdminRole() {
        // App.Auth should have been initialized by index.js
        if (App.Auth && App.Auth.isAdmin && App.Auth.isAdmin()) {
            const btn = document.getElementById('btn-sync-content');
            if (btn) {
                btn.style.display = 'block';
                btn.onclick = triggerContentSync;
            }
        }
    }

    async function triggerContentSync() {
        if (!confirm("구글 사이트(원본)의 최신 내용으로 동기화하시겠습니까?")) return;
        const btn = document.getElementById('btn-sync-content');
        btn.disabled = true;
        btn.textContent = "동기화 중...";

        const { data, error } = await App.supabase.functions.invoke('sync-content', {
            body: { target: 'safety' }
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

    globalThis.App = globalThis.App || {};
    globalThis.App.SafetyEdu = SafetyEdu;
})();
