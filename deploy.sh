#!/bin/bash

# ============================================
# D&D Campaign Site Deployment Script
# ============================================

set -e  # Exit on any error

echo "🎲 Deploying The Crimson Tavern Chronicles..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.example to .env and add your Anthropic API key"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running!"
    echo "Please start Docker and try again"
    exit 1
fi

# Pull latest images
echo "📥 Pulling Docker images..."
docker-compose pull

# Build custom images (chatbot)
echo "🔨 Building chatbot service..."
docker-compose build

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Start all services
echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to initialize..."
sleep 10

# Check if services are running
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Access your campaign site at: http://localhost:8080"
echo "📚 Access Wiki.js setup at: http://localhost:8080/wiki"
echo ""
echo "📝 Next steps:"
echo "  1. Complete Wiki.js initial setup (first-time only)"
echo "  2. Create wiki pages for your campaign"
echo "  3. Update campaign-data/*.json files with your content"
echo "  4. Edit static-site/data/updates.json to add announcements"
echo ""
echo "🔍 View logs: docker-compose logs -f"
echo "🛑 Stop services: docker-compose down"
echo ""
