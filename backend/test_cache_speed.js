const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:5000');

ws.on('open', () => {
    const start = Date.now();
    ws.send(JSON.stringify({
        action: 'search',
        searchTerm: 'milk', // This should be cached now
        lat: 19.076,
        lon: 72.877
    }));

    ws.on('message', (msg) => {
        const data = JSON.parse(msg);
        if (data.action === 'streamUpdate' && !data.scanning) {
            const end = Date.now();
            console.log(`Cache Hit Response Time: ${end - start}ms`);
            console.log(`Products Received: ${data.products.length}`);
            ws.close();
        }
    });
});
