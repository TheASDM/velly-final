FROM node:18-alpine

WORKDIR /app

# Copy package files first (Docker caching optimization)
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy application code
COPY . .

EXPOSE 3001

CMD ["node", "index.js"]
