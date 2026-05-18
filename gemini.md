# Vercel & Render Integration & Fix Plan

This document details the root causes and outlines the exact steps required to fix the authentication, WebSocket, and Group Cart issues in the deployed environment.

---

## 🔍 Root Cause Analysis

### 1. Hardcoded `localhost:5000` URLs
While `useAuthStore.js` and `blinkitApi.js` correctly use the dynamic `getApiBase()` utility, three key components are hardcoded to `http://localhost:5000`. This causes all checkout, purchase saving, profile loading, and group cart updates to fail in production by requesting the local server.
*   **Group Cart Saves**: `useGroupCartStore.js` hardcodes `http://localhost:5000/api/group-cart/...`
*   **Checkout Purchases**: `CartDrawer.jsx` hardcodes `http://localhost:5000/api/auth/purchase`
*   **Profile History**: `Profile.jsx` hardcodes `http://localhost:5000/api/auth/profile/...`

### 2. Hostname Fallback Ambiguity
When deployed to Vercel, `getApiBase()` and `defaultWsUrl()` fallback to `window.location.host` (the Vercel frontend domain) if environment variables are not set. Vercel is a serverless environment and cannot run the persistent HTTP/WebSocket server or the Playwright scraper. Hence, all API and WS requests to `https://nexus-blinkit.vercel.app` return HTML/404s, crashing the JavaScript store parsing.

---

## 🛠️ Proposed Code Changes

We will systematically replace all remaining hardcoded localhost URLs with dynamic, environment-aware endpoint resolvers.

### `frontend`

#### [MODIFY] [useGroupCartStore.js](file:///d:/CODES/nexus0/nexus0/frontend/src/store/useGroupCartStore.js)
*   **Change**: Update `broadcastUpdate()` to use the dynamically resolved base API URL.
```diff
-  fetch(`http://localhost:5000/api/group-cart/${basket.shareCode}`, {
+  fetch(`${getApiBase()}/api/group-cart/${basket.shareCode}`, {
```

#### [MODIFY] [CartDrawer.jsx](file:///d:/CODES/nexus0/nexus0/frontend/src/components/layout/CartDrawer.jsx)
*   **Change**: Import `getApiBase` and replace the hardcoded purchase url.
```diff
+import { getApiBase } from '../../config/api';
...
-      const res = await fetch('http://localhost:5000/api/auth/purchase', {
+      const res = await fetch(`${getApiBase()}/api/auth/purchase`, {
```

#### [MODIFY] [Profile.jsx](file:///d:/CODES/nexus0/nexus0/frontend/src/pages/Profile.jsx)
*   **Change**: Import `getApiBase` and update the profile fetch URL.
```diff
+import { getApiBase } from '../config/api';
...
-        const res = await fetch(`http://localhost:5000/api/auth/profile/${user.id}`);
+        const res = await fetch(`${getApiBase()}/api/auth/profile/${user.id}`);
```

---

## 🌐 Production Deployment Configuration

To ensure the frontend on Vercel communicates perfectly with the backend on Render, the following configurations must be set:

### 1. Vercel Environment Variables (Frontend)
Ensure these are configured under **Settings > Environment Variables** on your Vercel project dashboard, and trigger a redeploy:

| Variable | Value (Example) | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://nexus-backend.onrender.com` | The HTTP URL of your Render backend |
| `VITE_WS_URL` | `wss://nexus-backend.onrender.com` | The WebSocket (WSS) URL of your Render backend |

> [!NOTE]
> Environment variables prefixed with `VITE_` are statically embedded by Vite during build time. You must trigger a redeploy for these variables to take effect.

### 2. Render Environment Variables (Backend)
Configure these on your Render Web Service dashboard:

| Variable | Value (Example) | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | The port the backend will bind to |
| `DEFAULT_PINCODE` | `110001` | Fallback Indian pincode if location resolving fails |

---

## ⚡ SQLite Persistence Notice on Render
Because SQLite uses a local file (`blinkit_v2.db`), Render's free/standard instances will reset the database whenever the server restarts or spins down due to inactivity. 
*   **Impact**: Saved users, purchases, and active group cart baskets will be lost when the Render service restarts.
*   **Mitigation**: For persistent data, you can attach a **Render Persistent Disk** and configure the DB path in `sqlite.js` to write to the mounted disk directory (e.g., `/data/blinkit_v2.db`).

---

## 🧪 Verification Plan

### Manual Verification
1.  **Production URL test**: Inspect web requests in the browser console to verify `/api/auth/login`, `/api/group-cart`, and WebSocket handshake requests go to the Render backend domain instead of localhost or Vercel.
2.  **Auth Flow**: Verify user signup, login, and profile loading works smoothly.
3.  **Group Cart Multi-User Sync**: Start a group cart, open a second browser window/device, join via share code, and verify additions are synced in real time via WebSockets.
