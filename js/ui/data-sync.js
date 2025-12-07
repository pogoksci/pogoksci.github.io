(function () {
    const DataSync = {
        // CSV 헤더와 DB 컬럼 매핑
        columnMapping: {
            "cas_nos": ["CAS No", "CAS번호", "cas_nos", "CAS"],
            "chem_name": ["물질명", "화학물질명", "chem_name", "Name"],
            "school_hazardous_standard": ["학교사용 유해물질 기준", "학교사용유해물질", "school_hazardous_standard"],
            "school_accident_precaution_standard": ["학교사용 사고대비물질 기준", "학교사용사고대비물질", "school_accident_precaution_standard"],
            "special_health_standard": ["특수건강진단 유해인자 기준", "특수건강진단", "special_health_standard"],
            "toxic_standard": ["유독물질 기준", "유독물질", "toxic_standard"],
            "permitted_standard": ["허가물질 기준", "허가물질", "permitted_standard"],
            "restricted_standard": ["제한물질 기준", "제한물질", "restricted_standard"],
            "prohibited_standard": ["금지물질 기준", "금지물질", "prohibited_standard"]
        },

        init: function () {
            console.log("🔄 DataSync init");

            const btnHazard = document.getElementById("btn-sync-hazard");
            if (btnHazard) btnHazard.addEventListener("click", () => this.syncHazardList(btnHazard));

            const btnCas = document.getElementById("btn-sync-cas");
            if (btnCas) btnCas.addEventListener("click", () => this.syncSubstanceRef(btnCas));

            const btnKit = document.getElementById("btn-sync-kit");
            if (btnKit) btnKit.addEventListener("click", () => this.syncExperimentKits(btnKit));
        },

        log: function (msg, type = "info") {
            const logEl = document.getElementById("sync-log");
            if (!logEl) return;

            const div = document.createElement("div");
            div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            if (type === "error") div.style.color = "#ff4444";
            if (type === "success") div.style.color = "#00ccff";

            logEl.appendChild(div);
            logEl.scrollTop = logEl.scrollHeight;
            console.log(`[Sync] ${msg}`);
        },

        loadPapaParse: function () {
            return new Promise((resolve, reject) => {
                if (window.Papa) return resolve();

                const script = document.createElement("script");
                script.src = "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js";
                script.onload = resolve;
                script.onerror = () => reject("PapaParse 로드 실패");
                document.head.appendChild(script);
            });
        },

        clean: function (val) {
            if (!val) return null;
            let s = String(val).trim();
            if (s === "" || s === "EMPTY") return null;
            if (s.startsWith("'")) {
                s = s.substring(1);
            }
            return s;
        },

        // 1. HazardList Sync
        syncHazardList: async function (btn) {
            if (btn) btn.disabled = true;
            try {
                this.log("🚀 유해화학물질 동기화 시작 (Server-side)...");

                this.log("📂 data/HazardList.csv 파일 읽는 중...");
                const response = await fetch("data/HazardList.csv");
                if (!response.ok) throw new Error(`파일을 찾을 수 없습니다. (Status: ${response.status})`);

                const csvText = await response.text();
                this.log(`✅ 파일 읽기 성공 (${csvText.length} bytes). 서버로 전송합니다...`);

                const { data, error } = await App.supabase.functions.invoke('system-admin', {
                    body: {
                        action: 'sync_hazard_data',
                        csv_content: csvText
                    }
                });

                if (error) throw error;
                if (data?.error) throw new Error(data.error);

                this.log(`🎉 동기화 완료! (처리: ${data.data.processed}, 저장: ${data.data.upserted})`, "success");

            } catch (err) {
                this.log(`❌ 오류 발생: ${err.message}`, "error");
            } finally {
                if (btn) btn.disabled = false;
            }
        },

        // Helper not needed anymore on client but keeping empty or removing if strict
        processHazardData: async function (rows) { },

        // 2. SubstanceRef Sync
        syncSubstanceRef: async function (btn) {
            if (btn) btn.disabled = true;
            try {
                this.log("🚀 물질 참조 데이터 동기화 시작 (Server-side)...");

                this.log("📂 data/casimport-correct.csv 파일 읽는 중...");
                const response = await fetch("data/casimport-correct.csv");
                if (!response.ok) throw new Error(`파일을 찾을 수 없습니다. (Status: ${response.status})`);

                const csvText = await response.text();
                this.log(`✅ 파일 읽기 성공 (${csvText.length} bytes). 서버로 전송합니다...`);

                const { data, error } = await App.supabase.functions.invoke('system-admin', {
                    body: {
                        action: 'sync_substance_ref',
                        csv_content: csvText
                    }
                });

                if (error) throw error;
                if (data?.error) throw new Error(data.error);

                this.log(`🎉 동기화 완료! (데이터: ${data.data.count}개)`, "success");

            } catch (err) {
                this.log(`❌ 오류 발생: ${err.message}`, "error");
            } finally {
                if (btn) btn.disabled = false;
            }
        },

        // 3. Kit Sync
        syncExperimentKits: async function (btn) {
            if (btn) btn.disabled = true;
            this.log("🚀 실험 키트 데이터 동기화 시작...");

            if (App.Utils?.syncExperimentKits) {
                // Override alert/log of kit-sync.js if possible, or just let it run
                // kit-sync.js uses alert() and document.getElementById('sync-status')
                // We can try to hook into it or just call it.
                // Since kit-sync.js is simple, we can just call it.
                // But we want logs here.

                // Let's manually invoke it and catch errors
                try {
                    await App.Utils.syncExperimentKits();
                    this.log("🎉 실험 키트 동기화 완료!", "success");
                } catch (e) {
                    this.log(`❌ 키트 동기화 실패: ${e.message}`, "error");
                }
            } else {
                this.log("❌ 키트 동기화 모듈(kit-sync.js)이 로드되지 않았습니다.", "error");
            }

            if (btn) btn.disabled = false;
        }
    };

    globalThis.App = globalThis.App || {};
    globalThis.App.DataSync = DataSync;
})();
