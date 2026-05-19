const fs = require('fs');
const html = fs.readFileSync('test_bb_prod.html', 'utf8');
const regex = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/;
const match = html.match(regex);
if (match) {
    const data = JSON.parse(match[1]);
    fs.writeFileSync('next_data_prod.json', JSON.stringify(data, null, 2));
    console.log('Saved next_data_prod.json');
} else {
    console.log('No NEXT_DATA');
}