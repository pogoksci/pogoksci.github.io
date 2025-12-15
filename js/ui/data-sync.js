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

            this.initMigration();
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
            try {
                this.log("🚀 실험 키트 데이터 동기화 시작 (Server-side)...");

                this.log("📂 data/experiment_kit.csv 파일 읽는 중...");
                const response = await fetch("data/experiment_kit.csv");
                if (!response.ok) throw new Error(`파일을 찾을 수 없습니다. (Status: ${response.status})`);

                const csvText = await response.text();
                this.log(`✅ 파일 읽기 성공 (${csvText.length} bytes). 서버로 전송합니다...`);

                const { data, error } = await App.supabase.functions.invoke('system-admin', {
                    body: {
                        action: 'sync_experiment_kit',
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

        // 4. Migration Tool (Client-Side Logic)
        initMigration: function () {
            const btnMigrate = document.getElementById("btn-migration-start");
            if (btnMigrate) btnMigrate.addEventListener("click", () => this.handleMigration(btnMigrate));
        },

        handleMigration: async function (btn) {
            const fileInput = document.getElementById("migration-file-input");
            const startIdInput = document.getElementById("migration-start-id");
            const endIdInput = document.getElementById("migration-end-id");

            if (!fileInput || !fileInput.files[0]) return alert("CSV 파일을 선택해주세요.");
            const startId = parseInt(startIdInput.value);
            if (isNaN(startId)) return alert("시작 ID를 입력해주세요.");
            const endId = endIdInput.value ? parseInt(endIdInput.value) : startId;

            if (startId > endId) return alert("시작 ID가 끝 ID보다 클 수 없습니다.");

            const file = fileInput.files[0];
            if (btn) btn.disabled = true;

            try {
                this.log(`🚀 마이그레이션 시작 (ID: ${startId} ~ ${endId})`);
                await this.loadPapaParse();

                // 1. Parse CSV
                this.log("📂 CSV 파일 파싱 중...");
                Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    complete: async (results) => {
                        try {
                            const rows = results.data;
                            this.log(`✅ CSV 파싱 완료 (총 ${rows.length}개 행)`);

                            // 2. Filter by ID Range
                            const targets = rows.filter(r => {
                                const id = parseInt(r.id);
                                return !isNaN(id) && id >= startId && id <= endId;
                            });

                            if (targets.length === 0) {
                                throw new Error(`해당 범위(ID ${startId}~${endId})의 데이터가 없습니다.`);
                            }

                            this.log(`🎯 대상 데이터: ${targets.length}개. 순차 처리 시작...`);

                            // 3. Process each item sequentially
                            let successCount = 0;
                            let failCount = 0;

                            for (const row of targets) {
                                try {
                                    await this.processMigrationItem(row);
                                    successCount++;
                                } catch (itemErr) {
                                    console.error(itemErr);
                                    this.log(`❌ [ID: ${row.id}] 실패: ${itemErr.message}`, "error");
                                    failCount++;
                                }
                            }

                            this.log(`✨ 마이그레이션 종료. 성공: ${successCount}, 실패: ${failCount}`, "success");

                        } catch (parseErr) {
                            this.log(`❌ 처리 중 오류: ${parseErr.message}`, "error");
                        } finally {
                            if (btn) btn.disabled = false;
                        }
                    },
                    error: (err) => {
                        this.log(`❌ CSV 파싱 오류: ${err.message}`, "error");
                        if (btn) btn.disabled = false;
                    }
                });

            } catch (err) {
                this.log(`❌ 초기화 오류: ${err.message}`, "error");
                if (btn) btn.disabled = false;
            }
        },

        processMigrationItem: async function (row) {
            this.log(`🔄 [ID: ${row.id}] 처리 중...`);
            const supabase = App.supabase;

            // 1. Clean Data
            let casRn = this.clean(row.cas_rn); 
            // Note: Already handled by clean(), but ensure strict check logic if needed.
            // row.cas_rn might be "'7647-01-0". clean() removes leading quote.
            
            if (!casRn) throw new Error("CAS 번호가 없습니다.");

            // 2. Photo Processing
            let photoUrl320 = null;
            let photoUrl160 = null;
            const photoName = this.clean(row.photo);

            if (photoName) {
                const oldPhotoUrl = `https://muprmzkvrjacqatqxayf.supabase.co/storage/v1/object/public/reagent-photos/inventory/old_photos/${photoName}`;
                try {
                    // Fetch Blob
                    const blob = await this.fetchBlob(oldPhotoUrl);
                    if (blob) {
                         // Resize
                        const base64_320 = await this.resizeImage(blob, 320);
                        const base64_160 = await this.resizeImage(blob, 160);

                        // Upload 320
                        const ts = Date.now();
                        const rnd = Math.random().toString(36).substr(2, 5);
                        const path320 = `inventory/${ts}_${rnd}_320.jpg`;
                        const blob320 = App.Utils.base64ToBlob(base64_320);
                        
                        const { error: err320 } = await supabase.storage.from("reagent-photos").upload(path320, blob320);
                        if(err320) throw err320;
                        const { data: data320 } = supabase.storage.from("reagent-photos").getPublicUrl(path320);
                        photoUrl320 = data320.publicUrl;

                        // Upload 160
                        const path160 = `inventory/${ts}_${rnd}_160.jpg`;
                        const blob160 = App.Utils.base64ToBlob(base64_160);
                        const { error: err160 } = await supabase.storage.from("reagent-photos").upload(path160, blob160);
                        if (!err160) {
                             const { data: data160 } = supabase.storage.from("reagent-photos").getPublicUrl(path160);
                             photoUrl160 = data160.publicUrl;
                        }
                        this.log(`   📸 사진 마이그레이션 완료`);
                    }
                } catch(e) {
                    this.log(`   ⚠️ 사진 처리 실패 (${photoName}): ${e.message}`);
                }
            }

            // 3. PDF Processing
            let msdsUrl = null;
            let msdsHash = null;
            const pdfName = this.clean(row.pdf);

            if (pdfName) {
                const oldPdfUrl = `https://muprmzkvrjacqatqxayf.supabase.co/storage/v1/object/public/msds-pdf/old_msds-pdf/${pdfName}`;
                try {
                     const blob = await this.fetchBlob(oldPdfUrl);
                     if (blob) {
                         // Hash
                         msdsHash = await App.Utils.computeFileHash(blob);
                         
                         // Check Duplicate
                         // Check Duplicate
                         const { data: dupData } = await supabase.from("Inventory").select("msds_pdf_url").eq("msds_pdf_hash", msdsHash).limit(1);

                         if (dupData && dupData.length > 0 && dupData[0].msds_pdf_url) {
                            msdsUrl = dupData[0].msds_pdf_url;
                            this.log("   ♻️ 기존 PDF 재사용");
                         } else {
                            // Upload
                            const ts = Date.now();
                            const cleanName = pdfName.replace(/[^a-zA-Z0-9.-]/g, "_");
                            const path = `msds/${ts}_${cleanName}`;
                            
                            const { error: pdfErr } = await supabase.storage.from("msds-pdf").upload(path, blob);
                            if(pdfErr) throw pdfErr;
                            
                            const { data: pdfData } = supabase.storage.from("msds-pdf").getPublicUrl(path);
                            msdsUrl = pdfData.publicUrl;
                            this.log("   📄 PDF 업로드 완료");
                         }
                     }
                } catch (e) {
                     this.log(`   ⚠️ PDF 처리 실패 (${pdfName}): ${e.message}`);
                }
            }

            // 4. Construct Payload
            const payload = {
                cas_rns: [casRn],
                inventoryDetails: {
                    purchase_volume: row.initial_amount ? Number(row.initial_amount) : null,
                    current_amount: row.initial_amount ? Number(row.initial_amount) : 0, // 초기값과 동일하게 설정
                    unit: this.clean(row.unit),
                    cabinet_id: row.cabinet_id ? Number(row.cabinet_id) : null,
                    door_vertical: this.clean(row.door_vertical),
                    door_horizontal: this.clean(row.door_horizontal),
                    internal_shelf_level: this.clean(row.internal_shelf_level),
                    storage_column: this.clean(row.storage_column),
                    state: this.clean(row.state),
                    bottle_type: this.clean(row.bottle_type),
                    classification: this.clean(row.classification),
                    manufacturer: this.clean(row.manufacturer),
                    status: this.clean(row.status) || "사용중",
                    purchase_date: this.clean(row.purchase_date), // YYYY-MM-DD
                    bottle_mass: this.calculateBottleMass(row.initial_amount, row.bottle_type),  // Auto-calculated logic
                    
                    // Concentrations
                    concentration_value: row.concentration_value ? Number(row.concentration_value) : null,
                    concentration_unit: this.clean(row.concentration_unit),
                    valence: row.valence ? Number(row.valence) : null,

                    // Migrated Files
                    photo_url_320: photoUrl320,
                    photo_url_160: photoUrl160,
                    msds_pdf_url: msdsUrl,
                    msds_pdf_hash: msdsHash
                }
            };

            // 5. Invoke Edge Function
            // 5. Invoke Edge Function
            const result = await fetch("https://muprmzkvrjacqatqxayf.supabase.co/functions/v1/casimport", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${App.API?.SUPABASE_ANON_KEY || supabase.supabaseKey}`
                },
                body: JSON.stringify({
                    type: "inventory",
                    ...payload
                })
            }).then(r => r.json());

            if (result.error) throw new Error(result.error);

            this.log(`✅ [ID: ${row.id}] 등록 성공 (New ID: ${result.inventoryId})`);
        },

        // Helper: Fetch Blob
        fetchBlob: async function(url) {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
            return await res.blob();
        },

        // Helper: Resize Image
        resizeImage: function(blob, width) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const scale = width / img.width;
                    canvas.width = width;
                    canvas.height = img.height * scale;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL("image/jpeg", 0.8));
                };
                img.onerror = () => reject(new Error("Image load failed"));
                img.src = URL.createObjectURL(blob);
            });
        },

        // Helper: Bottle Mass Calculation (from forms.js)
        calculateBottleMass: function(volume, type) {
            if (!volume || !type) return null;
            const v = Number(volume);
            const t = String(type).trim().replace(/\s+/g, ""); // 공백 제거

            if (t === "기타") return 0;
            if (t.includes("유리")) {
                if (v === 25) return 65;
                if (v === 100) return 120;
                if (v === 500) return 400;
                if (v === 1000) return 510;
            }
            if (t.includes("플라스틱")) {
                if (v === 500) {
                    if (t.includes("반투명")) return 40;
                    if (t.includes("갈색")) return 80;
                    if (t.includes("흰색")) return 75;
                }
            }
            return null;
        }
    };

    globalThis.App = globalThis.App || {};
    globalThis.App.DataSync = DataSync;
})();

