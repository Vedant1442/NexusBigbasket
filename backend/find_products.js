const data = require('./next_data.json');
let results = [];

function findProducts(obj, path = '') {
    if (!obj || typeof obj !== 'object') return;
    
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            findProducts(obj[i], `${path}[${i}]`);
        }
    } else {
        // Search for string 'condom' in any value
        for (let key in obj) {
            if (typeof obj[key] === 'string' && obj[key].toLowerCase().includes('condom')) {
                results.push({ path: `${path}.${key}`, val: obj[key].substring(0, 50) });
            }
            findProducts(obj[key], `${path}.${key}`);
        }
    }
}

findProducts(data);
console.log(`Found ${results.length} occurrences of 'condom'.`);
console.log(results.slice(0, 10));
