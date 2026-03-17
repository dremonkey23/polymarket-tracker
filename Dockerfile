FROM node:20-slim

# Install Python for scraper integration
RUN apt-get update && apt-get install -y python3 python3-pip && \
    pip3 install requests && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Create data directory
RUN mkdir -p data

# Setup database
RUN node server/db/migrate.js

EXPOSE 3000

ENV NODE_ENV=production
CMD ["node", "server/index.js"]
