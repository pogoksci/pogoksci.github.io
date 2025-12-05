
const supabaseUrl = 'https://muprmzkvrjacqatqxayf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cHJtemt2cmphY3FhdHF4YXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MjYwNzAsImV4cCI6MjA3NTEwMjA3MH0.K2MO-l6QG5nztCPlT3_zqYOrMt-bqM-O5ZYLQpV1L9Y';

async function checkCas() {
    const casList = ['124-04-9', '124-09-4', '1310-73-2']; // Adipoyl chloride, Hexamethylenediamine, Sodium hydroxide
    console.log("Checking CAS:", casList);

    const casQuery = casList.join(',');
    const url = `${supabaseUrl}/rest/v1/Substance?select=cas_rn,substance_name,chem_name_kor&cas_rn=in.(${casQuery})`;

    try {
        const response = await fetch(url, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!response.ok) {
            console.error("Error:", response.status, response.statusText);
            const text = await response.text();
            console.error(text);
            return;
        }

        const data = await response.json();
        console.log("Found Data:", data);
        casList.forEach(cas => {
            const found = data.find(d => d.cas_rn === cas);
            if (!found) console.log(`MISSING: ${cas}`);
        });

    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

checkCas();
