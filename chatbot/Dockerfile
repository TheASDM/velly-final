FROM python:3.11-slim

WORKDIR /app

# Node.js 20 for the Eleventy static codex site running alongside the API
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

COPY chatbot/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Eleventy lives in /site. At runtime docker-compose bind-mounts the repo on
# top of /site, and an anonymous volume on /site/node_modules preserves the
# image's installed deps under that bind mount.
COPY package.json package-lock.json /site/
RUN cd /site && npm install

COPY chatbot/server.py .

EXPOSE 3001 8080

# Run the chatbot API (gunicorn:3001) and Eleventy --serve (:8080) together.
# The npm run dev script does an initial build, runs pagefind to generate the
# /pagefind search index, then starts eleventy --serve.
CMD ["sh", "-c", "gunicorn -b 0.0.0.0:3001 -w 2 --timeout 120 --preload server:app & cd /site && npm run dev"]
