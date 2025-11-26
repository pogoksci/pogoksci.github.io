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
            "prohibited_standard": ["금지물질 기준", "금지물질", "prohibited_standard"],
            "accident_precaution_standard": ["사고대비물질 기준", "사고대비물질", "accident_precaution_standard"]
        },

        init: function () {
            console.log("🔄 DataSync init");
            const btn = document.getElementById("btn-start-sync");
            if (btn) {
                btn.addEventListener("click", this.syncData.bind(this));
            }
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

        syncData: async function () {
            const btn = document.getElementById("btn-start-sync");
            if (btn) btn.disabled = true;

            try {
                this.log("🚀 동기화 시작...");

                // 1. PapaParse 로드
                await this.loadPapaParse();
                this.log("✅ CSV 파서 로드 완료");

                // 2. CSV 파일 가져오기
                this.log("📂 data/HazardList.csv 파일 읽는 중...");
                const response = await fetch("data/HazardList.csv");

                if (!response.ok) {
                    throw new Error(`파일을 찾을 수 없습니다. (Status: ${response.status})`);
                }

                const csvText = await response.text();
                this.log(`✅ 파일 읽기 성공 (${csvText.length} bytes)`);

                // 3. 파싱
                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: async (results) => {
                        if (results.errors.length > 0) {
                            this.log(`⚠️ 파싱 중 경고 발생: ${results.errors[0].message}`, "error");
                        }

                        await this.processData(results.data);
                        if (btn) btn.disabled = false;
                    },
                    error: (err) => {
                        throw err;
                    }
                });

            } catch (err) {
                this.log(`❌ 오류 발생: ${err.message}`, "error");
                if (btn) btn.disabled = false;
            }
        },

        processData: async function (rows) {
            this.log(`📊 총 ${rows.length}개 데이터 발견. 처리 준비 중...`);

            const upsertData = [];
            const headers = Object.keys(rows[0]);
            this.log(`ℹ️ CSV 헤더: ${headers.join(", ")}`);

            // 컬럼 매핑 확인
            const map = {};
            for (const [dbCol, csvCandidates] of Object.entries(this.columnMapping)) {
                const found = headers.find(h => csvCandidates.includes(h.trim()));
                if (found) {
                    map[dbCol] = found;
                }
            }

            // 데이터 변환
            for (const row of rows) {
                const item = {};

                // 매핑된 컬럼 데이터 추출
                for (const [dbCol, csvHeader] of Object.entries(map)) {
                    let val = row[csvHeader];

                    // CAS 번호 변환 (||| -> , )
                    if (dbCol === "cas_nos" && val) {
                        val = val.replace(/\|\|\|/g, ", ");
                    }

                    item[dbCol] = val;
                }
                upsertData.push(item);
            }

            // 4. 기존 데이터 삭제 (전체 삭제 후 재입력 방식)
            if (!confirm("기존 데이터를 모두 삭제하고 CSV 데이터로 덮어쓰시겠습니까?")) {
                this.log("🚫 작업이 취소되었습니다.", "error");
                return;
            }

            this.log("🗑️ 기존 데이터 삭제 중...");
            const { error: deleteError } = await supabase
                .from("HazardList")
                .delete()
                .neq("id", 0); // 모든 데이터 삭제 (id가 0이 아닌 것)

            if (deleteError) {
                this.log(`❌ 삭제 실패: ${deleteError.message}`, "error");
                return;
            }
            this.log("✅ 기존 데이터 삭제 완료");

            // 5. Supabase 업로드 (배치 처리)
            const BATCH_SIZE = 100;
            const totalBatches = Math.ceil(upsertData.length / BATCH_SIZE);

            this.log(`💾 DB 저장 시작 (총 ${totalBatches} 배치)`);

            for (let i = 0; i < totalBatches; i++) {
                const start = i * BATCH_SIZE;
                const end = start + BATCH_SIZE;
                const batch = upsertData.slice(start, end);

                const { error } = await supabase
                    .from("HazardList")
                    .insert(batch);

                if (error) {
                    this.log(`❌ 배치 ${i + 1} 실패: ${error.message}`, "error");
                } else {
                    this.log(`✅ 배치 ${i + 1}/${totalBatches} 완료 (${batch.length}건)`);
                }
            }

            this.log("🎉 모든 동기화 작업이 완료되었습니다!", "success");
        }
    };

    globalThis.App = globalThis.App || {};
    globalThis.App.DataSync = DataSync;
})();
