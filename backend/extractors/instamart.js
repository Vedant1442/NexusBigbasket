module.exports = {
  name: "instamart",
  url: (q) => `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(q)}`,
  match: (url) => url.includes("swiggy.com/api/instamart") && (url.includes("search") || url.includes("SEARCH")),
  extract: (json) => {
    const prods = [];
    const walk = (obj) => {
      if (!obj || typeof obj !== "object" || prods.length >= 25) return;
      if (obj.name && (obj.price || obj.offerPrice)) {
        const price = obj.offerPrice || obj.price || 0;
        const mrp = obj.mrp || obj.markedPrice || price;
        const finalPrice = price > 500 ? Math.round(price / 100) : price;
        const finalMrp = mrp > 500 ? Math.round(mrp / 100) : mrp;
        const imgId = obj.imageId || obj.image?.url || "";
        prods.push({
          id: obj.id || obj.itemId || `im-${prods.length}`,
          name: obj.name,
          price: finalPrice,
          originalPrice: finalMrp > finalPrice ? finalMrp : null,
          quantity: obj.packSize || obj.quantity || "",
          imageUrl: imgId.startsWith("http") ? imgId : `https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,h_300/${imgId}`,
          deliveryTime: "15m",
          source: "instamart"
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
