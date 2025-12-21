// Mock globalThis.App
globalThis.App = {};

// Load the script content (Deno style)
const scriptPath = "./js/utils/subject-aliases.js";
const scriptContent = await Deno.readTextFile(scriptPath);

// Execute the script in a function context to simulate the IIFE
(new Function(scriptContent))();

const normalize = globalThis.App.normalizeSubject;

const testCases = [
    { input: '통과1', expected: '통합과학I' },
    { input: '과탐실1', expected: '과학탐구실험I' },
    { input: '실험2', expected: '과학탐구실험II' },
    { input: '물리I', expected: '물리학I' }
];

let passed = 0;
testCases.forEach(tc => {
    const actual = normalize(tc.input);
    if (actual === tc.expected) {
        console.log(`✅ PASS: "${tc.input}" -> "${actual}"`);
        passed++;
    } else {
        console.error(`❌ FAIL: "${tc.input}" -> expected "${tc.expected}", got "${actual}"`);
    }
});

// Negative test for Integrated Social Studies
const social = normalize('통사1');
if (social === '통사1') {
    console.log(`✅ PASS: "통사1" is not aliased (as expected)`);
    passed++;
} else {
    console.error(`❌ FAIL: "통사1" was aliased to "${social}"`);
}

console.log(`\nSummary: ${passed}/${testCases.length + 1} passed.`);
if (passed !== testCases.length + 1) Deno.exit(1);
