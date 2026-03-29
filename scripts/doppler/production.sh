#!/bin/bash
# Production environment script
echo "🚀 Starting BioPoint in PRODUCTION mode..."
echo "📡 Using Doppler for secrets management"
echo "⚠️  WARNING: This will start the production server!"
echo ""

# Verify Doppler is configured
if ! doppler auth &> /dev/null; then
    echo "❌ Doppler CLI not authenticated. Please run: doppler login"
    exit 1
fi

# Check if project is configured
if ! doppler configs get production --project biopoint &> /dev/null; then
    echo "❌ Doppler production environment not configured."
    echo "Please set up the production environment in Doppler first."
    exit 1
fi

# Additional confirmation for production
echo "🚨 PRODUCTION ENVIRONMENT CONFIRMATION 🚨"
echo "You are about to start the production server."
echo "This should typically be done through your deployment pipeline."
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r

if [[ ! "$REPLY" =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "❌ Production deployment cancelled."
    exit 0
fi

echo "✅ Doppler production configuration verified"
echo "🔨 Building for production environment..."

# Build the application with production secrets
doppler run --config production -- npm run build:api

if [ $? -eq 0 ]; then
    echo "✅ Production build completed successfully"
    echo "🔄 Starting API server with production secrets..."
    echo ""
    
    # Start the application with production secrets
    doppler run --config production -- npm start
else
    echo "❌ Production build failed. Please check the logs above."
    exit 1
fi