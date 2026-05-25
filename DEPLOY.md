# VPS Deployment

This app expects HTTPS at the public edge. In this setup, Caddy runs on a
different machine and terminates TLS there, then reverse-proxies to the OVH VPS.

## Runtime Shape

- PWA/codex: `http://OVH_VPS_IP:8080`
- Wiki.js, if you keep it on this VPS: `http://OVH_VPS_IP:3000`
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
POSTGRES_PASSWORD=<long random value>
ADMIN_TOKEN=<long random value>
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
docker compose up -d --build
docker compose logs -f chatbot nginx
```

Local checks on the VPS:

```bash
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/manifest.webmanifest
curl -I http://127.0.0.1:8080/sw.js
curl http://127.0.0.1:8080/health
```

## Caddy Machine

For the obscure PWA URL:

```caddyfile
pwa-obscure.example.com {
  reverse_proxy OVH_VPS_IP:8080
}
```

If Wiki.js also lives on the OVH VPS:

```caddyfile
wiki.example.com {
  reverse_proxy OVH_VPS_IP:3000
}
```

Reload Caddy after editing its Caddyfile.

## Firewall

On the OVH VPS, only expose the app ports to the Caddy machine if possible:

```bash
sudo ufw allow OpenSSH
sudo ufw allow from CADDY_PUBLIC_IP to any port 8080 proto tcp
sudo ufw allow from CADDY_PUBLIC_IP to any port 3000 proto tcp
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
git pull
docker compose up -d --build chatbot nginx
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

Wiki.js Postgres, if used:

```bash
docker exec dnd_postgres pg_dump -U wikijs wiki > "wiki-$(date +%F).sql"
```
