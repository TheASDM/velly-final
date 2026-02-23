# Setup Instructions

## Prerequisites

- Docker and Docker Compose installed
- Anthropic API key (get one at https://console.anthropic.com/)
- At least 4GB RAM available for Docker
- Ports 8080 and 8443 available

## Initial Setup

### 1. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your Anthropic API key
nano .env  # or use your preferred editor
```

### 2. Deploy the Services

```bash
# Make deployment script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

### 3. Configure Wiki.js (First Time Only)

1. Navigate to http://localhost:8080/wiki
2. Complete the initial setup wizard:
   - Set administrator email and password
   - Choose "PostgreSQL" as the database (pre-configured)
   - Configure site settings (name, description, etc.)
3. Create your first pages!

### 4. Customize Your Campaign Data

Edit these files with your campaign information:

```bash
campaign-data/npcs.json          # Your NPCs
campaign-data/locations.json     # Locations in your world
campaign-data/factions.json      # Factions and organizations
campaign-data/sessions.json      # Session recaps
campaign-data/items.json         # Magic items
campaign-data/lore.txt          # Campaign lore
campaign-data/house-rules.txt   # Your house rules
```

### 5. Add Updates

Edit `static-site/data/updates.json` to add session recaps, announcements, etc.

### 6. Set Next Session Date

Edit `static-site/js/countdown.js` line 13 to set your next session date:

```javascript
this.nextSessionDate = new Date('2026-01-20T19:00:00');
```

## Ongoing Maintenance

### Adding New Updates

Edit `static-site/data/updates.json` and add new entries to the "updates" array.

### Updating Campaign Data

Edit files in `campaign-data/` directory. The chatbot reads these files on each request, so changes are immediate (no restart needed).

### Creating Wiki Pages

Log in to Wiki.js at http://localhost:8080/wiki and use the built-in editor.

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f chatbot
docker-compose logs -f wikijs
```

### Stopping Services

```bash
docker-compose down
```

### Restarting After Changes

```bash
docker-compose restart chatbot  # If you changed campaign data
docker-compose restart nginx    # If you changed static files
```

## Troubleshooting

### Chatbot Not Responding

1. Check API key is correct in `.env`
2. View chatbot logs: `docker-compose logs chatbot`
3. Ensure campaign data files exist and are valid JSON

### Wiki.js Not Loading

1. Check if PostgreSQL is running: `docker-compose ps`
2. View logs: `docker-compose logs wikijs`
3. Ensure port 3000 is not blocked

### Can't Access Site

1. Check if containers are running: `docker-compose ps`
2. Ensure ports 8080/8443 are not used by other services
3. Check firewall settings

### Database Issues

```bash
# Reset database (WARNING: deletes all wiki content)
docker-compose down -v
docker-compose up -d
```

## Network Configuration

By default, the site runs on:
- HTTP: http://localhost:8080
- HTTPS: https://localhost:8443 (requires SSL setup)

To access from other devices on your network, replace `localhost` with your server's IP address.

## Backing Up

### Backup Wiki Data

```bash
docker-compose exec postgres pg_dump -U wikijs wiki > backup.sql
```

### Backup Campaign Data

```bash
tar -czf campaign-backup.tar.gz campaign-data/ static-site/data/
```

### Restore Wiki Data

```bash
docker-compose exec -T postgres psql -U wikijs wiki < backup.sql
```
