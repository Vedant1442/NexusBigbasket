const axios = require("axios");

const BASE =
  process.env.QUICKCOMMERCE_API_BASE || "https://api.quickcommerceapi.com";

/** Comma-separated platforms for `GET /v1/groupsearch` when no override is passed. */
const DEFAULT_GROUP_PLATFORMS =
  process.env.QUICKCOMMERCE_GROUP_PLATFORMS ||
  process.env.QUICKCOMMERCE_PLATFORMS ||
  "Zepto,Swiggy,BigBasket";

function qcKeyPlatformToSource(key) {
  const k = String(key || "").toLowerCase();
  if (k.includes("blink")) return "blinkit";
  if (k.includes("zepto")) return "zepto";
  if (k.includes("swiggy")) return "instamart";
  if (k.includes("big")) return "bigbasket";
  return null;
}

function normalizeProduct(p, source) {
  const mrp =
    typeof p.mrp === "number"
      ? p.mrp
      : p.mrp != null
        ? parseFloat(String(p.mrp).replace(/[^0-9.]/g, ""))
        : null;
  const offerRaw = p.offer_price ?? p.price;
  const offer =
    typeof offerRaw === "number"
      ? offerRaw
      : offerRaw != null
        ? parseFloat(String(offerRaw).replace(/[^0-9.]/g, ""))
        : 0;

  let discount = 0;
  if (mrp != null && !Number.isNaN(mrp) && mrp > offer) {
    discount = Math.round(((mrp - offer) / mrp) * 100);
  }

  const imgs = Array.isArray(p.images) ? p.images : [];
  const imageUrl =
    imgs[0] ||
    (p.gallery && Array.isArray(p.gallery) && p.gallery[0]?.url) ||
    "";

  const plat = p.platform || {};
  const sla = plat.sla || plat.SLA || "";

  const deeplink = p.deeplink || "#";

  const rating =
    typeof p.rating === "number" ? p.rating : p.rating != null ? Number(p.rating) : null;
  const ratingCount =
    typeof p.rating_count === "number"
      ? p.rating_count
      : p.ratingCount != null
        ? Number(p.ratingCount)
        : null;

  return {
    id: String(p.id ?? p.item_id ?? ""),
    name: String(p.name || "Product"),
    brand: p.brand != null ? String(p.brand) : "",
    price: Number.isFinite(offer) ? offer : 0,
    originalPrice: mrp != null && mrp > offer ? mrp : null,
    quantity: p.quantity || "",
    imageUrl,
    deliveryTime: sla || "",
    discount,
    source,
    productUrl: deeplink,
    available: p.available !== false,
    inventory: typeof p.inventory === "number" ? p.inventory : null,
    rating: Number.isFinite(rating) ? rating : null,
    ratingCount: Number.isFinite(ratingCount) ? ratingCount : null,
  };
}

function assertApiKey() {
  const key = process.env.QUICKCOMMERCE_API_KEY;
  if (!key) {
    const err = new Error("QUICKCOMMERCE_API_KEY not set");
    err.code = "NO_API_KEY";
    throw err;
  }
  return key;
}

async function searchSinglePlatform(searchTerm, lat, lon, platform, pincode) {
  const key = assertApiKey();

  const url = `${BASE}/v1/search`;
  const params = {
    q: searchTerm,
    lat,
    lon,
    platform: String(platform || "BlinkIt"),
  };
  if (pincode) params.pincode = pincode;

  const res = await axios.get(url, {
    params,
    headers: { "X-API-Key": key },
    timeout: 25000,
    validateStatus: () => true,
  });

  if (res.status === 401 || res.status === 402) {
    const err = new Error(res.data?.message || `QuickCommerce API ${res.status}`);
    err.code = "QC_AUTH";
    err.status = res.status;
    throw err;
  }

  if (res.status >= 400) {
    const err = new Error(res.data?.message || `QuickCommerce API ${res.status}`);
    err.code = "QC_HTTP";
    err.status = res.status;
    throw err;
  }

  const body = res.data || {};
  if (body.status !== "success") {
    const err = new Error(body.message || "QuickCommerce unsuccessful response");
    err.code = "QC_BODY";
    throw err;
  }

  const list = body.data?.products || [];
  const source = qcKeyPlatformToSource(platform) || "blinkit";
  return list.map((p) => normalizeProduct(p, source)).filter((x) => x.id);
}

/**
 * Multi-platform search. `platformsCsv` e.g. "Zepto,Swiggy,BigBasket".
 */
async function groupSearch(searchTerm, lat, lon, pincode, platformsCsv = null) {
  const key = assertApiKey();

  const platforms = String(platformsCsv ?? DEFAULT_GROUP_PLATFORMS).trim();
  if (!platforms) {
    return {
      products: { blinkit: [], zepto: [], instamart: [], bigbasket: [] },
      creditCost: 0,
    };
  }

  const url = `${BASE}/v1/groupsearch`;
  const params = {
    q: searchTerm,
    lat,
    lon,
    platforms,
  };
  if (pincode) params.pincode = pincode;

  const res = await axios.get(url, {
    params,
    headers: { "X-API-Key": key },
    timeout: 25000,
    validateStatus: () => true,
  });

  if (res.status === 401 || res.status === 402) {
    const err = new Error(res.data?.message || `QuickCommerce API ${res.status}`);
    err.code = "QC_AUTH";
    err.status = res.status;
    throw err;
  }

  if (res.status >= 400) {
    const err = new Error(res.data?.message || `QuickCommerce API ${res.status}`);
    err.code = "QC_HTTP";
    err.status = res.status;
    throw err;
  }

  const body = res.data || {};
  if (body.status !== "success") {
    const err = new Error(body.message || "QuickCommerce unsuccessful response");
    err.code = "QC_BODY";
    throw err;
  }

  const buckets = body.data?.results || {};
  const out = {
    blinkit: [],
    zepto: [],
    instamart: [],
    bigbasket: [],
  };

  for (const [qcKey, list] of Object.entries(buckets)) {
    const source = qcKeyPlatformToSource(qcKey);
    if (!source || !Array.isArray(list)) continue;
    out[source] = list.map((p) => normalizeProduct(p, source)).filter((x) => x.id);
  }

  return { products: out, creditCost: body.data?.credit_cost };
}

async function fetchItem(platformQcName, itemId, lat, lon, pincode) {
  const key = assertApiKey();

  const url = `${BASE}/v1/item`;
  const params = {
    item_id: String(itemId),
    platform: platformQcName,
    lat,
    lon,
  };
  if (pincode) params.pincode = pincode;

  const res = await axios.get(url, {
    params,
    headers: { "X-API-Key": key },
    timeout: 20000,
    validateStatus: () => true,
  });

  if (res.status >= 400) {
    const err = new Error(res.data?.message || `QuickCommerce item ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const body = res.data || {};
  if (body.status !== "success") {
    const err = new Error(body.message || "Item lookup failed");
    throw err;
  }

  const items = body.data?.items || [];
  return items.map((p) =>
    normalizeProduct(
      {
        ...p,
        id: p.item_id ?? p.id,
      },
      qcPlatformToProductSource(platformQcName),
    ),
  );
}

function qcPlatformToProductSource(name) {
  return qcKeyPlatformToSource(name) || "blinkit";
}

const SOURCE_TO_QC = {
  blinkit: "BlinkIt",
  zepto: "Zepto",
  instamart: "Swiggy",
  bigbasket: "BigBasket",
};

function qcNameForSource(sourceKey) {
  return SOURCE_TO_QC[String(sourceKey || "").toLowerCase()] || null;
}

module.exports = {
  searchSinglePlatform,
  groupSearch,
  fetchItem,
  qcNameForSource,
};
