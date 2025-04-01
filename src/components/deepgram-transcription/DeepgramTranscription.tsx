/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useEffect, useState, useRef } from "react";
import "./deepgram-transcription.scss";

export function DeepgramTranscription() {
  const [transcription, setTranscription] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  const API_KEY = process.env.REACT_APP_DEEPGRAM_API_KEY as string;

  // Handle connecting to Deepgram
  const connectToDeepgram = async () => {
    try {
      // Get user's audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create a WebSocket connection to Deepgram
      const socket = new WebSocket('wss://api.deepgram.com/v1/listen', [
        'token',
        API_KEY
      ]);
      
      socket.onopen = () => {
        setIsConnected(true);
        setTranscription("");
        
        // Configure the connection
        const configMessage = {
          model: 'nova-2',
          encoding: 'linear16',
          sample_rate: 16000,
          channels: 1,
          language: 'vi',
          interim_results: true,
          endpointing: 300,
        };
        
        socket.send(JSON.stringify(configMessage));
        
        // Create a media recorder to capture audio
        const recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm',
        });
        
        recorder.addEventListener('dataavailable', async (event) => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            // Convert audio data to the format Deepgram expects
            const audioData = await event.data.arrayBuffer();
            socket.send(audioData);
          }
        });
        
        recorder.start(250); // Send chunks every 250ms
        mediaRecorderRef.current = recorder;
        setIsProcessing(true);
      };
      
      socket.onmessage = (message) => {
        const data = JSON.parse(message.data);
        if (data.channel && data.channel.alternatives && data.channel.alternatives.length > 0) {
          if (data.is_final) {
            setTranscription(prev => {
              // Extract only the newly transcribed text
              const newText = data.channel.alternatives[0].transcript;
              return prev + (prev ? ' ' : '') + newText;
            });
          } else {
            setIsProcessing(true);
          }
        }
      };
      
      socket.onclose = () => {
        setIsConnected(false);
        setIsProcessing(false);
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
        setIsConnected(false);
        setIsProcessing(false);
      };
      
      socketRef.current = socket;
      
    } catch (error) {
      console.error('Error connecting to Deepgram:', error);
    }
  };
  
  // Disconnect from Deepgram
  const disconnectFromDeepgram = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    
    setIsConnected(false);
    setIsProcessing(false);
  };

  // Auto-scroll to the bottom as new content is added
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [transcription]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      disconnectFromDeepgram();
    };
  }, []);

  return (
    <div className="deepgram-transcription">
      <div className="transcription-header">
        <h2>Deepgram Speech Transcription</h2>
        <div className="controls">
          {!isConnected ? (
            <button 
              className="control-button start" 
              onClick={connectToDeepgram}
            >
              Start Transcribing
            </button>
          ) : (
            <button 
              className="control-button stop" 
              onClick={disconnectFromDeepgram}
            >
              Stop Transcribing
            </button>
          )}
          <span className={`status ${isConnected ? "connected" : ""} ${isProcessing ? "processing" : ""}`}>
            {isProcessing ? "Transcribing..." : isConnected ? "Connected" : "Ready"}
          </span>
        </div>
      </div>
      <div className="transcription-content" ref={contentRef}>
        {transcription ? 
          <p>{transcription}<span className={`cursor ${isProcessing ? "blinking" : ""}`}></span></p> : 
          <p className="placeholder">Click the Start Transcribing button to begin...</p>
        }
      </div>
    </div>
  );
}
