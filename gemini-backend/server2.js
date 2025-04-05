const WebSocket = require('ws');
const http = require('http');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

// Load environment variables
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = 3001;

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Track all client connections
const clients = new Map();

wss.on('connection', (ws) => {
    const clientId = `Date.now().toString()-${Math.random().toString(36).substring(2, 15)}`; // Unique client ID
    console.log(`Client connected: ${clientId}`);
    

    // Initialize client state
    clients.set(clientId, {
        ws: ws,
        geminiWs: null,
        messageQueue: [],
        isConnecting: false
    });

    const connectToGemini = async () => {
        const client = clients.get(clientId);
        if (!client || client.isConnecting) return;

        client.isConnecting = true;
        console.log(`Connecting to Gemini API for client: ${clientId}...`);

        // Connect to Gemini API if not already connected
        const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
        const geminiWs = new WebSocket(geminiUrl);
        client.geminiWs = geminiWs;

        // Forward Gemini responses to client
        geminiWs.on('message', (data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        });

        // Handle Gemini connection errors
        geminiWs.on('error', (error) => {
            console.error(`Error with Gemini WebSocket for client ${clientId}:`, error);
            const client = clients.get(clientId);
            if (client) {
                client.isConnecting = false;
            }
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ error: 'Gemini API connection error' }));
            }
        });

        // Wait for connection to be established
        try {
            await new Promise((resolve, reject) => {
                geminiWs.on('open', () => {
                    console.log(`Connected to Gemini API for client: ${clientId}`);
                    resolve();
                });
                geminiWs.on('error', reject);

                // Add a timeout for the connection
                setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000);
            });

            // Process any queued messages
            const client = clients.get(clientId);
            if (client) {
                while (client.messageQueue.length > 0) {
                    const queuedMessage = client.messageQueue.shift();
                    if (client.geminiWs && client.geminiWs.readyState === WebSocket.OPEN) {
                        client.geminiWs.send(queuedMessage);
                    }
                }
                client.isConnecting = false;
            }
            return true;
        } catch (error) {
            console.error(`Failed to connect to Gemini API for client ${clientId}:`, error);
            const client = clients.get(clientId);
            if (client) {
                client.isConnecting = false;
            }
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ error: 'Failed to connect to Gemini API' }));
            }
            return false;
        }
    };

    // Handle messages from client
    ws.on('message', async (message) => {
        try {
            const client = clients.get(clientId);
            if (!client) return;

            // If no connection exists or connection is not open
            if (!client.geminiWs || client.geminiWs.readyState !== WebSocket.OPEN) {
                // Queue the message
                client.messageQueue.push(message);

                // Start connection process if not already connecting
                if (!client.isConnecting) {
                    await connectToGemini();
                }
            } else {
                // Connection is already open, send the message directly
                client.geminiWs.send(message);
            }
        } catch (error) {
            console.error(`Error handling message for client ${clientId}:`, error);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ error: 'Failed to process request' }));
            }
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        const client = clients.get(clientId);
        if (client && client.geminiWs && client.geminiWs.readyState === WebSocket.OPEN) {
            client.geminiWs.close();
        }
        // Clean up client resources
        clients.delete(clientId);
    });
});

server.listen(PORT, () => {
    console.log(`WebSocket server is running on port ${PORT}`);
});