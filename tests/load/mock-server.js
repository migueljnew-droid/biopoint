// Mock BioPoint API server for load testing validation
import http from 'http';
import url from 'url';

const PORT = process.env.MOCK_PORT || 3001;

// Mock data
const mockUsers = [
    { id: 1, email: 'test@biopoint.com', name: 'Test User' }
];

const mockDashboardData = {
    bioPointScore: { score: 85, date: new Date().toISOString() },
    todayLog: { entries: 5, mood: 'good' },
    recentLogs: [
        { date: new Date().toISOString(), entries: 5, mood: 'good' },
        { date: new Date(Date.now() - 86400000).toISOString(), entries: 4, mood: 'neutral' }
    ]
};

const mockLabReports = [
    {
        id: 1,
        filename: 'lab_report_2024.pdf',
        uploadedAt: new Date().toISOString(),
        markers: [
            { name: 'Cholesterol', value: 180, unit: 'mg/dL', refRangeLow: 0, refRangeHigh: 200 }
        ]
    }
];

const mockPhotos = [
    {
        id: 1,
        filename: 'progress_photo.jpg',
        capturedAt: new Date().toISOString(),
        category: 'progress'
    }
];

// Simulate processing delay
function simulateDelay() {
    const delay = Math.random() * 200 + 50; // 50-250ms
    return new Promise(resolve => setTimeout(resolve, delay));
}

// Response helper
function sendResponse(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// Request handler
async function handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;
    
    console.log(`[${new Date().toISOString()}] ${method} ${path}`);
    
    await simulateDelay();
    
    try {
        // Health check
        if (path === '/health' && method === 'GET') {
            return sendResponse(res, 200, {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                database: { status: 'connected', poolUtilization: Math.floor(Math.random() * 30) + 10 },
                responseTime: Math.floor(Math.random() * 100) + 20
            });
        }
        
        // Database health
        if (path === '/health/db' && method === 'GET') {
            return sendResponse(res, 200, {
                status: 'ok',
                database: { status: 'connected', poolUtilization: Math.floor(Math.random() * 40) + 20 }
            });
        }
        
        // Authentication (mock)
        if (path === '/auth/login' && method === 'POST') {
            return sendResponse(res, 200, {
                token: 'mock-jwt-token-' + Date.now(),
                refreshToken: 'mock-refresh-token-' + Date.now(),
                expiresIn: 3600,
                user: mockUsers[0]
            });
        }
        
        // Dashboard (requires auth)
        if (path === '/dashboard' && method === 'GET') {
            return sendResponse(res, 200, mockDashboardData);
        }
        
        // Labs endpoints
        if (path === '/labs' && method === 'GET') {
            return sendResponse(res, 200, mockLabReports);
        }
        
        if (path === '/labs/presign' && method === 'POST') {
            return sendResponse(res, 200, {
                uploadUrl: 'https://mock-s3.amazonaws.com/upload',
                s3Key: 'labs/test-file-' + Date.now() + '.pdf',
                expiresIn: 3600
            });
        }
        
        // Photos endpoints
        if (path === '/photos' && method === 'GET') {
            return sendResponse(res, 200, mockPhotos);
        }
        
        if (path === '/photos/presign' && method === 'POST') {
            return sendResponse(res, 200, {
                uploadUrl: 'https://mock-s3.amazonaws.com/upload',
                s3Key: 'photos/test-photo-' + Date.now() + '.jpg',
                expiresIn: 3600
            });
        }
        
        // BioPoint history
        if (path === '/biopoint/history' && method === 'GET') {
            return sendResponse(res, 200, [
                { score: 85, date: new Date().toISOString() },
                { score: 82, date: new Date(Date.now() - 86400000).toISOString() }
            ]);
        }
        
        // Markers endpoints
        if (path === '/markers' && method === 'GET') {
            return sendResponse(res, 200, [
                { name: 'Cholesterol', value: 180, unit: 'mg/dL', refRangeLow: 0, refRangeHigh: 200, recordedAt: new Date().toISOString() }
            ]);
        }
        
        if (path === '/markers/trends' && method === 'GET') {
            return sendResponse(res, 200, [
                {
                    markerName: 'Cholesterol',
                    unit: 'mg/dL',
                    dataPoints: [
                        { date: new Date().toISOString(), value: 180, refRangeLow: 0, refRangeHigh: 200 },
                        { date: new Date(Date.now() - 86400000).toISOString(), value: 185, refRangeLow: 0, refRangeHigh: 200 }
                    ]
                }
            ]);
        }
        
        // Community endpoint
        if (path === '/community' && method === 'GET') {
            return sendResponse(res, 200, [
                { id: 1, title: 'Test Post', content: 'Test content', createdAt: new Date().toISOString() }
            ]);
        }
        
        // Reminders endpoint
        if (path === '/reminders' && method === 'GET') {
            return sendResponse(res, 200, [
                { id: 1, title: 'Take medication', dueDate: new Date().toISOString(), completed: false }
            ]);
        }
        
        // Research endpoint
        if (path === '/research' && method === 'GET') {
            return sendResponse(res, 200, [
                { id: 1, title: 'Health Study', summary: 'Research summary', publishedAt: new Date().toISOString() }
            ]);
        }
        
        // 404 for unknown endpoints
        return sendResponse(res, 404, { error: 'Endpoint not found' });
        
    } catch (error) {
        console.error('Error handling request:', error);
        return sendResponse(res, 500, { error: 'Internal server error' });
    }
}

// Create server
const server = http.createServer(handleRequest);

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Mock BioPoint API server running at http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log('  GET  /health - Health check');
    console.log('  GET  /health/db - Database health');
    console.log('  POST /auth/login - User authentication');
    console.log('  GET  /dashboard - Dashboard data');
    console.log('  GET  /labs - Lab reports');
    console.log('  POST /labs/presign - Presign upload URL');
    console.log('  GET  /photos - Photos');
    console.log('  POST /photos/presign - Presign photo upload');
    console.log('  GET  /biopoint/history - BioPoint history');
    console.log('  GET  /markers - Lab markers');
    console.log('  GET  /markers/trends - Marker trends');
    console.log('  GET  /community - Community posts');
    console.log('  GET  /reminders - Reminders');
    console.log('  GET  /research - Research articles');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down mock server...');
    server.close(() => {
        console.log('✅ Mock server stopped');
        process.exit(0);
    });
});

export default server;