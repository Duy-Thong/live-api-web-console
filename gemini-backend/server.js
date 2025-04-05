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

wss.on('connection', (ws) => {
    console.log('Client connected');

    let geminiWs = null;
    let messageQueue = [];
    let isConnecting = false;

    const connectToGemini = async () => {
        if (isConnecting) return; // Prevent multiple connection attempts

        isConnecting = true;
        console.log('Connecting to Gemini API...');

        // Connect to Gemini API if not already connected
        const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
        geminiWs = new WebSocket(geminiUrl);

        // Forward Gemini responses to client
        geminiWs.on('message', (data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        });

        // Handle Gemini connection errors
        geminiWs.on('error', (error) => {
            console.error('Error with Gemini WebSocket:', error);
            isConnecting = false;
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ error: 'Gemini API connection error' }));
            }
        });

        // Wait for connection to be established
        try {
            await new Promise((resolve, reject) => {
                geminiWs.on('open', () => {
                    console.log('Connected to Gemini API');
                    resolve();
                });
                geminiWs.on('error', reject);

                // Add a timeout for the connection
                setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000);
            });

            // Process any queued messages
            while (messageQueue.length > 0) {
                const queuedMessage = messageQueue.shift();
                if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
                    geminiWs.send(queuedMessage);
                }
            }

            isConnecting = false;
            return true;
        } catch (error) {
            console.error('Failed to connect to Gemini API:', error);
            isConnecting = false;
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ error: 'Failed to connect to Gemini API' }));
            }
            return false;
        }
    };

    // Handle messages from client
    ws.on('message', async (message) => {
        try {
            // If no connection exists or connection is not open
            if (!geminiWs || geminiWs.readyState !== WebSocket.OPEN) {
                // Queue the message
                messageQueue.push(message);

                // Start connection process if not already connecting
                if (!isConnecting) {
                    await connectToGemini();
                }
            } else {
                // Connection is already open, send the message directly
                geminiWs.send(message);
            }
        } catch (error) {
            console.error('Error handling message:', error);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ error: 'Failed to process request' }));
            }
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.close();
        }
    });
});

server.listen(PORT, () => {
    console.log(`WebSocket server is running on port ${PORT}`);
});