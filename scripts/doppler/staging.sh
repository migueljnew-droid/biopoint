#!/bin/bash
# Staging environment script
echo "🚀 Starting BioPoint in STAGING mode..."
echo "📡 Using Doppler for secrets management"
echo ""

# Verify Doppler is configured
if ! doppler auth &> /dev/null; then
    echo "❌ Doppler CLI not authenticated. Please run: doppler login"
    exit 1
fi

# Check if project is configured
if ! doppler configs get staging --project biopoint &> /dev/null; then
    echo "❌ Doppler staging environment not configured."
    echo "Please set up the staging environment in Doppler first."
    exit 1
fi

echo "✅ Doppler staging configuration verified"
echo "🔨 Building for staging environment..."

# Build the application with staging secrets
doppler run --config staging -- npm run build:api

if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully"
    echo "🔄 Starting API server with staging secrets..."
    echo ""
    
    # Start the application with staging secrets
    doppler run --config staging -- npm start
else
    echo "❌ Build failed. Please check the logs above."
    exit 1
fi