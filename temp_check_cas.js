
const supabaseUrl = 'https://muprmzkvrjacqatqxayf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cHJtemt2cmphY3FhdHF4YXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MjYwNzAsImV4cCI6MjA3NTEwMjA3MH0.K2MO-l6QG5nztCPlT3_zqYOrMt-bqM-O5ZYLQpV1L9Y';

async function checkCas() {
    const casList = ['124-04-9', '124-09-4', '1310-73-2']; // Adipoyl chloride, Hexamethylenediamine, Sodium hydroxide
    console.log("Checking CAS:", casList);

    // Check by CAS
    const casQuery = casList.join(',');
    const urlCas = `${supabaseUrl}/rest/v1/Substance?select=cas_rn,substance_name,chem_name_kor&cas_rn=in.(${casQuery})`;

    try {
        console.log("--- Querying by CAS ---");
        const responseCas = await fetch(urlCas, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        const textCas = await responseCas.text();
        console.log("Raw CAS Response:", textCas);
        const dataCas = JSON.parse(textCas);
        console.log("Found by CAS:", dataCas);

        // Check by Name (Hexamethylenediamine)
        console.log("--- Querying by Name (Hexamethylenediamine) ---");
        const nameQuery = "Hexamethylenediamine";
        const urlName = `${supabaseUrl}/rest/v1/Substance?select=cas_rn,substance_name,chem_name_kor&substance_name=ilike.%${nameQuery}%`;

        const responseName = await fetch(urlName, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        const textName = await responseName.text();
        console.log("Raw Name Response:", textName);
        const dataName = JSON.parse(textName);
        console.log("Found by Name (English):", dataName);

        // Check by Name (Korean)
        console.log("--- Querying by Name (헥사메틸렌디아민) ---");
        const korNameQuery = "헥사메틸렌디아민";
        const urlKorName = `${supabaseUrl}/rest/v1/Substance?select=cas_rn,substance_name,chem_name_kor&chem_name_kor=ilike.%${korNameQuery}%`;

        const responseKorName = await fetch(urlKorName, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        const textKorName = await responseKorName.text();
        console.log("Raw KorName Response:", textKorName);
        const dataKorName = JSON.parse(textKorName);
        console.log("Found by Name (Korean):", dataKorName);

    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

checkCas();
