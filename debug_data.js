
const supabaseUrl = 'https://muprmzkvrjacqatqxayf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cHJtemt2cmphY3FhdHF4YXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MjYwNzAsImV4cCI6MjA3NTEwMjA3MH0.K2MO-l6QG5nztCPlT3_zqYOrMt-bqM-O5ZYLQpV1L9Y';

async function inspectData() {
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };

    try {
        // 1. Check kit_chemicals schema (by fetching one row)
        console.log("--- Checking kit_chemicals Schema ---");
        const resKC = await fetch(`${supabaseUrl}/rest/v1/kit_chemicals?limit=1`, { headers });
        const dataKC = await resKC.json();
        console.log("kit_chemicals sample:", dataKC);

        // 2. Find Kit ID for "나일론 합성"
        console.log("--- Finding Kit ID for '나일론 합성' ---");
        // Try user_kits first
        const resKit = await fetch(`${supabaseUrl}/rest/v1/user_kits?kit_name=eq.나일론 합성&select=id,kit_name`, { headers });
        const dataKit = await resKit.json();
        console.log("User Kits found:", dataKit);

        if (dataKit.length > 0) {
            const kitId = dataKit[0].id;
            console.log(`Using Kit ID: ${kitId}`);

            // 3. Get chemicals for this kit
            const resChems = await fetch(`${supabaseUrl}/rest/v1/kit_chemicals?user_kit_id=eq.${kitId}&select=*`, { headers });
            const dataChems = await resChems.json();
            console.log("Chemicals in Kit:", dataChems);
        }

        // 4. Search Substance by Name
        console.log("--- Searching Substance by Name 'Hexamethylenediamine' ---");
        const resName = await fetch(`${supabaseUrl}/rest/v1/Substance?substance_name=ilike.%Hexamethylenediamine%&select=cas_rn,substance_name,chem_name_kor`, { headers });
        const dataName = await resName.json();
        console.log("Found by English Name:", dataName);

        console.log("--- Searching Substance by Name '헥사메틸렌디아민' ---");
        const resKor = await fetch(`${supabaseUrl}/rest/v1/Substance?chem_name_kor=ilike.%헥사메틸렌디아민%&select=cas_rn,substance_name,chem_name_kor`, { headers });
        const dataKor = await resKor.json();
        console.log("Found by Korean Name:", dataKor);

    } catch (e) {
        console.error("Error:", e);
    }
}

inspectData();
