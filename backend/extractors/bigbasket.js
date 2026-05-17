module.exports = {
  name: "bigbasket",
  url: (q) => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(q)}`,
  match: (url) => url.includes("bigbasket.com") && (url.includes("/ps/") || url.includes("product_list")),
  extract: (json) => {
    const items = json?.products || json?.data?.products || [];
    return items.slice(0, 20).map(p => ({
      id: p.id || p.product_id,
      name: p.desc || p.name,
      price: p.pricing?.discount?.dsc_prc || p.sp || 0,
      originalPrice: p.mrp > (p.sp || 0) ? p.mrp : null,
      quantity: p.w || p.unit || "",
      imageUrl: p.images?.[0]?.s || p.image_url || "",
      deliveryTime: "30m",
      source: "bigbasket"
    }));
  }
};
