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

# Eleventy + Pagefind installed under /opt/eleventy so they live OUTSIDE the
# /site bind mount. NODE_PATH + PATH let scripts in the bind-mounted /site
# resolve to these deps, without needing an anonymous-volume shadow hack
# (which previously held stale node_modules across rebuilds).
WORKDIR /opt/eleventy
COPY package.json package-lock.json /opt/eleventy/
RUN npm install
ENV NODE_PATH=/opt/eleventy/node_modules
ENV PATH=/opt/eleventy/node_modules/.bin:$PATH

WORKDIR /app
COPY chatbot/server.py .
COPY chatbot/vos ./vos

EXPOSE 3001

# Build the Eleventy codex into /site/_site, then run the Flask API.
# nginx serves the static build and proxies /api/* back to this container.
CMD ["sh", "-c", "cd /site && npm run build && cd /app && exec gunicorn -b 0.0.0.0:3001 -w 2 --timeout 300 --preload server:app"]
