# Use the official Playwright image which includes all system dependencies for Chromium
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

# Set working directory
WORKDIR /app

# Explicitly set the path for Playwright browsers to be inside the app folder
# This ensures they are included in the image and accessible
ENV PLAYWRIGHT_BROWSERS_PATH=/app/ms-playwright

# Install build-essential, python3, and pip
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy requirements.txt and install Python dependencies
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

# Install only the Chromium browser
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
