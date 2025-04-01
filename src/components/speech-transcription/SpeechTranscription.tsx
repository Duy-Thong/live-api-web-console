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
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import "./speech-transcription.scss";

export function SpeechTranscription() {
  const [transcription, setTranscription] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [latestText, setLatestText] = useState<string>("");
  const { client, setConfig, connected } = useLiveAPIContext();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: "text",
        temperature: 0,
        // Lower temperature for more accurate transcription
      },
      systemInstruction: {
        parts: [
          {
            text: "You are a real-time speech-to-text transcription service. Transcribe the audio input exactly as heard without adding anything extra. Format sentences properly but don't add commentary. Update the transcript incrementally with each new audio segment. Always respond in English regardless of the input language."
          },
        ],
      },
    });
  }, [setConfig]);

  useEffect(() => {
    const onContent = (serverContent: any) => {
      if (serverContent.modelTurn?.parts) {
        const textParts = serverContent.modelTurn.parts
          .filter((part: any) => part.text)
          .map((part: any) => part.text)
          .join("");
        
        if (textParts) {
          setIsProcessing(true);
          
          // Immediately show the new text
          setTranscription(prev => {
            // Check for duplications and overlaps
            if (prev.endsWith(textParts)) {
              return prev;
            }
            
            // Find the largest overlap between current text and new text
            let overlapSize = 0;
            for (let i = 1; i < Math.min(prev.length, textParts.length); i++) {
              const overlap = prev.slice(-i);
              if (textParts.startsWith(overlap)) {
                overlapSize = i;
                break;
              }
            }
            
            // Extract only the new content
            const newContent = textParts.slice(overlapSize);
            setLatestText(newContent); // Store the latest addition for highlighting
            
            // After a brief delay, merge the latest text with previous text
            setTimeout(() => {
              setLatestText("");
            }, 800);
            
            return prev + newContent;
          });
        }
      }
    };

    const onTurnComplete = () => {
      setIsProcessing(false);
    };

    client.on("content", onContent);
    client.on("turncomplete", onTurnComplete);
    
    return () => {
      client.off("content", onContent);
      client.off("turncomplete", onTurnComplete);
    };
  }, [client]);

  // Auto-scroll to the bottom as new content is added
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [transcription]);

  // Reset transcription when starting a new recording session
  useEffect(() => {
    if (connected) {
      setTranscription("");
      setIsProcessing(false);
    }
  }, [connected]);

  return (
    <div className="speech-transcription">
      <div className="transcription-header">
        <h2>Real-time Speech Transcription</h2>
        {connected ? 
          <span className={`status connected ${isProcessing ? "processing" : ""}`}>
            {isProcessing ? "Transcribing..." : "Recording"}
          </span> : 
          <span className="status">Ready</span>
        }
      </div>
      <div className="transcription-content" ref={contentRef}>
        {transcription ? (
          <p>
            {transcription.slice(0, transcription.length - latestText.length)}
            <span className="latest-text">{latestText}</span>
            <span className={`cursor ${isProcessing ? "blinking" : ""}`}></span>
          </p>
        ) : (
          <p className="placeholder">Press the play button below to start transcribing...</p>
        )}
      </div>
    </div>
  );
}
