(function () {
    const TimetableImporter = {};

    // --- Configuration ---
    // Subject Aliases: Map from Excel Name -> DB Subject Name (Exact or Base)
    // --- Configuration ---
    // Subject Aliases: Map from Excel Name -> DB Subject Name (Exact or Base)
    // Now loaded from js/utils/subject-aliases.js
    const getSubjectAliases = () => globalThis.App?.SubjectAliases || {};

    // --- Main Import Function ---
    TimetableImporter.processFile = async function (file, semesterId, existingTeachers, existingSubjects) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Array of Arrays

                    const result = analyzeTimetableData(json, existingTeachers, existingSubjects);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    };

    function analyzeTimetableData(rows, dbTeachers, dbSubjects) {
        const teacherScheduleMap = {};
        const report = {
            foundTeachers: [],
            missingTeachers: [],
            totalCells: 0,
            skippedCells: 0,
            unknownSubjects: new Set() // Track unknown subject names
        };

        const teacherNameMap = {};
        dbTeachers.forEach(t => teacherNameMap[t.name] = t.id);

        for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
                const cellVal = (rows[r][c] || '').toString().trim();

                if (cellVal in teacherNameMap) {
                    const teacherName = cellVal;
                    const teacherId = teacherNameMap[teacherName];

                    if (report.foundTeachers.includes(teacherName)) continue;
                    report.foundTeachers.push(teacherName);

                    parseTeacherBlock(rows, r, c, teacherId, teacherScheduleMap, report, dbSubjects);
                }
            }
        }

        // Convert Set to Array for easier display
        report.unknownSubjects = Array.from(report.unknownSubjects);
        return { map: teacherScheduleMap, report: report };
    }

    function parseTeacherBlock(rows, startRow, startCol, teacherId, scheduleMap, report, dbSubjects) {
        const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

        for (let i = 0; i < 7; i++) { // 1 to 7 periods
            const currentRow = startRow + 1 + i;
            if (currentRow >= rows.length) break;

            for (let d = 0; d < 5; d++) {
                const col = startCol + 1 + d;
                const cellContent = (rows[currentRow][col] || '').toString().trim();

                if (cellContent) {
                    report.totalCells++;
                    const { parsed, errorReason, rawSubject } = parseCellContent(cellContent, dbSubjects);

                    if (parsed) {
                        if (!scheduleMap[teacherId]) scheduleMap[teacherId] = [];

                        scheduleMap[teacherId].push({
                            day: DAYS[d],
                            period: i + 1,
                            grade: parsed.grade,
                            class_group: parsed.class_group,
                            subject_id: parsed.subject_id
                        });
                    } else {
                        report.skippedCells++;
                        if (errorReason === 'unknown_subject' && rawSubject) {
                            report.unknownSubjects.add(rawSubject);
                        }
                    }
                }
            }
        }
    }

    function parseCellContent(text, dbSubjects) {
        // Regex: Start with Digit (Grade) -> Digit(s) (Class) -> Rest
        const match = text.match(/^(\d)(\d{2})(.+)$/);

        if (!match) {
            return { parsed: null, errorReason: 'format_mismatch' };
        }

        const grade = parseInt(match[1]);
        const classNum = parseInt(match[2]);
        let rawSubject = match[3].trim();

        const hasKorean = /[가-힣]/.test(rawSubject);

        let subjectName = null;
        if (hasKorean) {
            subjectName = rawSubject.replace(/^[A-Za-z_]+/, '').trim();
        } else {
            // No Korean found, treat as suffix/empty
            return { parsed: null, errorReason: 'no_korean_subject', rawSubject };
        }

        const subjectId = findSubjectId(subjectName, dbSubjects);

        if (!subjectId) {
            return { parsed: null, errorReason: 'unknown_subject', rawSubject: subjectName };
        }

        const classGroup = classNum.toString();

        return {
            parsed: {
                grade,
                class_group: classGroup,
                subject_id: subjectId
            },
            errorReason: null
        };
    }

    function findSubjectId(rawName, dbSubjects) {
        if (!rawName) return null;

        // 1. Normalize
        const norm = rawName.replace(/\s+/g, ''); // Remove spaces

        // 2. Alias Check
        const aliases = getSubjectAliases();
        if (aliases[norm]) {
            const aliasTarget = aliases[norm];
            const found = dbSubjects.find(s => s.name.replace(/\s+/g, '') === aliasTarget.replace(/\s+/g, ''));
            if (found) return found.id;
        }

        // 3. Exact/Contains Match in DB
        // Search DB for name that contains rawName or vice versa?
        // "통합사회" vs "통합사회1"
        // Prefer Exact first.
        const exact = dbSubjects.find(s => s.name.replace(/\s+/g, '') === norm);
        if (exact) return exact.id;

        // 4. StartsWith (e.g. "물리학I" matches "물리학")
        const starts = dbSubjects.find(s => s.name.replace(/\s+/g, '').startsWith(norm));
        if (starts) return starts.id;

        // 5. Reverse StartsWith (raw "물리학I", db "물리학") -> unlikely in this school context, usually DB is fuller.

        return null;
    }

    globalThis.App = globalThis.App || {};
    globalThis.App.TimetableImporter = TimetableImporter;
})();
