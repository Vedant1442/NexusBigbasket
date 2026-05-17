module.exports = {
  name: "blinkit",
  url: (q) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}`,
  match: (url) => url.includes("blinkit.com/v") && url.includes("/search"),
  extract: (json) => {
    const products = [];
    
    // Strategy 1: Standard search snippets
    const snippets = json?.response?.snippets || [];
    snippets.forEach(s => {
      if (s.data?.name?.text) {
        const p = s.data;
        const price = p.price || (p.normal_price?.text ? parseInt(p.normal_price.text.replace(/[^0-9]/g, '')) : 0);
        const mrp = p.mrp?.text ? parseInt(p.mrp.text.replace(/[^0-9]/g, '')) : price;
        
        products.push({
          id: p.identity?.id || `b-${Math.random()}`,
          name: p.name.text,
          price: price,
          mrp: mrp > price ? mrp : price,
          discount: p.discount_percentage || (mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0),
          quantity: p.variant?.text || p.unit || "",
          image: p.image?.url || "",
          deliveryTime: p.eta_tag?.title?.text || "8m",
          productUrl: `https://blinkit.com/prn/${p.name.text.toLowerCase().replace(/ /g, '-')}/prid/${p.identity?.id}`,
          source: 'blinkit'
        });
      }
    });

    // Strategy 2: Widget-based items (sometimes used in hybrid layouts)
    const widgets = json?.response?.widgets || [];
    widgets.forEach(w => {
      if (w.data?.items) {
        w.data.items.forEach(p => {
          if (p.name && !products.find(existing => existing.id === p.id)) {
             products.push({
               id: p.id || `bw-${Math.random()}`,
               name: p.name,
               price: p.price || 0,
               mrp: p.mrp || p.price || 0,
               discount: p.discount_percentage || 0,
               quantity: p.unit || "",
               image: p.image_url || "",
               deliveryTime: "8m",
               source: 'blinkit'
             });
          }
        });
      }
    });

    return products;
  }
};
