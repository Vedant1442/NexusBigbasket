# Use the official Playwright image which includes all system dependencies for Chromium
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

# Set working directory
WORKDIR /app

# Explicitly set the path for Playwright browsers to be inside the app folder
# This ensures they are included in the image and accessible
ENV PLAYWRIGHT_BROWSERS_PATH=/app/ms-playwright

# Install build-essential and python3 (required for better-sqlite3 compilation)
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
# Note: better-sqlite3 will compile during this step
RUN npm ci

# Install only the Chromium browser inside the specified path
RUN npx playwright install chromium

# Copy the rest of the application code
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV RENDER=true

# Render provides the PORT environment variable
EXPOSE 5000

# Start the server
CMD ["node", "server.js"]
