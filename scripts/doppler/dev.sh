#!/bin/bash
# Development environment script
echo "🚀 Starting BioPoint in DEVELOPMENT mode..."
echo "📡 Using Doppler for secrets management"
echo ""

# Verify Doppler is configured
if ! doppler auth &> /dev/null; then
    echo "❌ Doppler CLI not authenticated. Please run: doppler login"
    exit 1
fi

# Check if project is configured
if ! doppler configs get dev --project biopoint &> /dev/null; then
    echo "❌ Doppler project not configured. Please run: doppler setup"
    exit 1
fi

echo "✅ Doppler configuration verified"
echo "🔄 Starting API server with development secrets..."
echo ""

# Start the API with Doppler-injected secrets
doppler run --config dev -- npm run dev:api