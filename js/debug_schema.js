
(async () => {
    const { data, error } = await App.supabase.from('user_kits').select('*').limit(1);
    if (error) console.error(error);
    else console.log('User Kits Columns:', Object.keys(data[0] || {}));
})();
