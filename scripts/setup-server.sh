#!/bin/bash
# First-time server setup script
# Run on server: curl -sSL <raw_github_url> | bash

set -e

echo "🚀 Setting up News Aggregator Bot..."

# Update system
apt update && apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2
npm install -g pm2

# Create app directory
mkdir -p /opt/news-aggregator
cd /opt/news-aggregator

# Clone repo (will be replaced by CI/CD later)
# git clone <your-repo-url> .

echo "📦 Node.js version: $(node -v)"
echo "📦 NPM version: $(npm -v)"
echo "📦 PM2 version: $(pm2 -v)"

echo ""
echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "1. Clone your repo to /opt/news-aggregator"
echo "2. Create .env file with your secrets"
echo "3. Run: npm install"
echo "4. Run: pm2 start ecosystem.config.js"
echo "5. Run: pm2 startup && pm2 save"
