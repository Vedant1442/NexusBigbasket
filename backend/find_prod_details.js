const data = require('./next_data_prod.json');

function findProductDetails(obj, path = '') {
    if (!obj || typeof obj !== 'object') return;
    
    if (obj.desc || obj.name) {
        if (obj.pricing || obj.price) {
            console.log(`Potential product details found at: ${path}`);
            console.log(`Name: ${obj.desc || obj.name}`);
            if (obj.pricing) console.log(`Price: ${JSON.stringify(obj.pricing)}`);
            else console.log(`Price: ${obj.price}`);
            return;
        }
    }
    
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            findProductDetails(obj[i], `${path}[${i}]`);
        }
    } else {
        for (let key in obj) {
            findProductDetails(obj[key], `${path}.${key}`);
        }
    }
}

findProductDetails(data);