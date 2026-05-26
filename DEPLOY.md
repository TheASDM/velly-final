# VPS Deployment

This app expects HTTPS at the public edge. Caddy terminates TLS and
reverse-proxies to the PWA's nginx container on the VPS.

## Runtime Shape

- PWA/codex: `http://127.0.0.1:8080` on the VPS
- Flask API: internal Docker network only, proxied at `/api/*`
- PWA runtime state: `app-data/vallombrosa.sqlite3`
- Shared art gallery: `generated-art/`

Point Caddy at port `8080` for the PWA. Do not point it at the chatbot
container directly; nginx serves the built Eleventy site and proxies `/api/*`
on the same origin.

## First VPS Setup

```bash
ssh ubuntu@OVH_VPS_IP
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
docker compose version
```

Clone the repo:

```bash
git clone REPO_URL vallombrosa
cd vallombrosa
cp .env.example .env
chmod 600 .env
mkdir -p app-data generated-art logs
chmod 700 app-data generated-art logs
```

Edit `.env` and set:

```bash
ADMIN_TOKEN=<long random value>
AUTH_TOKEN_SECRET=<long random value>
PLAYER_LOGIN_CODES=Car=<code>,Kryton=<code>,Lotan=<code>,Noname=<code>,Orabella=<code>,Roxy=<code>,Valen=<code>,Dustin=<code>
ANTHROPIC_API_KEY=<key>
OLLAMA_API_KEY=<key>
OPENAI_KEY=<key>
VAPID_PRIVATE_KEY=<private key from app-data/vapid-private-key.txt>
VAPID_SUBJECT=mailto:dm@valleyofshadows.wiki
```

`VAPID_PUBLIC_KEY` is already in `.env.example`. Keep the private key only in
`.env` on the server.

Start it:

```bash
docker compose up -d --build --remove-orphans
docker compose logs -f chatbot nginx
```

Local checks on the VPS:

```bash
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/manifest.webmanifest
curl -I http://127.0.0.1:8080/sw.js
curl http://127.0.0.1:8080/health
```

## Caddy

For the obscure PWA URL:

```caddyfile
pwa-obscure.example.com {
  reverse_proxy 127.0.0.1:8080
}
```

Reload Caddy after editing its Caddyfile.

## Firewall

On the OVH VPS, only expose the app ports to the Caddy machine if possible:

```bash
sudo ufw allow OpenSSH
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

Also mirror those rules in OVH's network firewall if you enabled it there.

## Phone Acceptance Checks

1. Open the Caddy HTTPS URL in mobile Safari/Chrome.
2. Confirm `/manifest.webmanifest` and `/sw.js` both load over HTTPS.
3. Install to the home screen.
4. Launch from the home screen, choose your player identity, then enable push.
5. Visit `/dm/`, enter `ADMIN_TOKEN`, send a test push.
6. Post a DM message from `/dm/`; it should show on Home and push subscribers.
7. RSVP from `/calendar/`; refresh the RSVP summary on `/dm/`.

## Updates

```bash
cd ~/vallombrosa
git pull --ff-only
docker compose up -d --build --remove-orphans
```

The chatbot container rebuilds `_site` at startup. nginx serves that static
build and proxies API calls.

## Backups

PWA state and push subscriptions:

```bash
cp app-data/vallombrosa.sqlite3 "app-data/vallombrosa-$(date +%F).sqlite3"
```

Art gallery:

```bash
tar -czf "generated-art-$(date +%F).tgz" generated-art/
```
