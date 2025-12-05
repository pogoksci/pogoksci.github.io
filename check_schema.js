
const supabaseUrl = 'https://muprmzkvrjacqatqxayf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cHJtemt2cmphY3FhdHF4YXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MjYwNzAsImV4cCI6MjA3NTEwMjA3MH0.K2MO-l6QG5nztCPlT3_zqYOrMt-bqM-O5ZYLQpV1L9Y';

async function checkSchema() {
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };
    try {
        console.log("Fetching one row from kit_chemicals...");
        const response = await fetch(`${supabaseUrl}/rest/v1/kit_chemicals?limit=1`, { headers });
        const data = await response.json();
        if (data.length > 0) {
            console.log("Columns found:", Object.keys(data[0]));
            console.log("Row data:", data[0]);
        } else {
            console.log("No data found in kit_chemicals.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

checkSchema();
