module.exports = {
  name: "zepto",
  url: (q, lat, lon) => `https://www.zepto.com/search?query=${encodeURIComponent(q)}&latitude=${lat}&longitude=${lon}`,
  match: (url) => url.includes("bff-gateway.zepto.com") && url.includes("/search"),
  extract: (json) => {
    const prods = [];
    const walk = (obj) => {
      if (!obj || typeof obj !== "object" || prods.length >= 25) return;
      const name = obj.name || obj.product_name || obj.productName;
      const priceRaw = obj.offerPrice || obj.finalPrice || obj.sellingPrice || obj.discountedSellingPrice || obj.price || obj.pricing?.sale_price;
      
      if (name && priceRaw && typeof name === "string") {
        const price = priceRaw > 800 ? Math.round(priceRaw / 100) : priceRaw;
        const mrpRaw = obj.mrp || obj.markedPrice || priceRaw;
        const mrp = mrpRaw > 800 ? Math.round(mrpRaw / 100) : mrpRaw;
        prods.push({
          id: obj.id || obj.itemId || obj.productId || `z-${prods.length}`,
          name: name,
          price: price,
          originalPrice: mrp > price ? mrp : null,
          quantity: obj.packSize || obj.quantity || obj.unit || "",
          imageUrl: obj.imageUrl || obj.image_url || obj.imgUrl || (obj.image?.url) || "",
          deliveryTime: "10m",
          source: "zepto"
        });
        return;
      }
      if (Array.isArray(obj)) obj.forEach(walk);
      else Object.values(obj).forEach(walk);
    };
    walk(json);
    return prods;
  }
};
