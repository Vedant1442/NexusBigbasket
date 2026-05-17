# ⚡ NEXUS V2 - Hyperlocal Delivery Aggregator

NEXUS V2 is a premium, high-speed delivery aggregator platform designed to unify the shopping experience across major quick-commerce players like **Blinkit**, **Zepto**, and **Instamart**. 

By leveraging direct internal API flows (inspired by the Atanu-Prasun collection), NEXUS V2 delivers real-time product data with sub-second latency, bypassing traditional DOM-based scraping.

---

## 🚀 Key Features

- **Warp Speed API Integration**: Direct communication with Blinkit/Zepto internal endpoints for instant results.
- **Real-Time Catalog**: Live pricing, stock availability, and 8-minute delivery tracking.
- **Premium User Experience**: 
  - **Glassmorphic UI**: Sleek, modern interface with vibrant HSL-tailored palettes.
  - **Micro-Animations**: Fluid transitions powered by Framer Motion.
  - **Responsive Design**: Seamless experience across mobile and desktop.
- **GroupCart Logic**: Collaborative shopping state management (In-Progress).
- **Warp Pool**: Managed WebSocket connections for persistent, low-latency data streaming.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Zustand (State Management).
- **Backend**: Node.js, Express, WebSocket (WS), Axios.
- **Core Engine**: `BlinkitAPI` service with direct endpoint mapping and header synchronization.

---

## 📦 Project Structure

```text
NEXUS-V2/
├── backend/            # Express & WebSocket Server
│   ├── services/       # Direct API Integration (Blinkit, etc.)
│   ├── extractors/     # Fallback Scrapers
│   └── server.js       # Core Warp Pool Logic
├── frontend/           # React Application
│   ├── src/components/ # Reusable UI Components
│   ├── src/pages/      # Feature Pages (Home, Search, GroupCart)
│   └── src/store/      # Global State Management
└── vercel.json         # Deployment Configuration
```

---

## 🚦 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- npm / pnpm

### 2. Backend Setup
```bash
cd backend
npm install
node server.js
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 📡 API Credits
Direct API logic inspired by the community-contributed [Atanu-Prasun Blinkit Postman Collection](https://www.postman.com/atanu-prasun/blinkit/overview).

---

## 🛡️ License
Proprietary - Developed by Antigravity AI for NEXUS Ecosystem.
