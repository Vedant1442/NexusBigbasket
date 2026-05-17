const axios = require('axios');

async function testBlinkit() {
    const headers = {
        'accept': 'application/json, text/plain, */*',
        'app_client': '1',
        'app_instance_id': '8665f97b-4d44-4860-9567-c6b753a99252',
        'device_id': '8665f97b-4d44-4860-9567-c6b753a99252',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    };

    try {
        console.log('Testing Home Layout API...');
        const response = await axios.get('https://blinkit.com/v1/layout/home/', {
            params: { lat: 19.076, lon: 72.877 },
            headers: headers
        });
        console.log('✅ Success! Found widgets:', response.data.response?.widgets?.length);
    } catch (error) {
        console.error('❌ Home API Failed:', error.response?.status, error.response?.data || error.message);
    }

    try {
        console.log('\nTesting Search API for "milk"...');
        const response = await axios.get('https://blinkit.com/v1/search/search_product/', {
            params: { q: 'milk', size: 10, lat: 19.076, lon: 72.877 },
            headers: headers
        });
        console.log('✅ Success! Found products:', response.data.response?.snippets?.length);
    } catch (error) {
        console.error('❌ Search API Failed:', error.response?.status, error.response?.data || error.message);
    }
}

testBlinkit();
