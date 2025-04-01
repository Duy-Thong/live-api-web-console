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
import "./keyword-extraction.scss";

export function KeywordExtraction() {
  const [keywords, setKeywords] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [latestText, setLatestText] = useState<string>("");
  const { client, setConfig, connected } = useLiveAPIContext();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: "text",
        temperature: 0.2,
      },
      systemInstruction: {
        parts: [
          {
            text: "You are a real-time keyword extraction service. Listen to the speech input and extract the most important keywords, entities, and key phrases. Format your output as a comma-separated list. Only output the keywords and nothing else. Update the list as new speech input arrives. Keywords can be in any language matching the input language."
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
          
          // Process the new keywords
          setKeywords(prevKeywords => {
            // Check if the response is completely new or contains existing keywords
            if (prevKeywords && textParts.includes(prevKeywords)) {
              // Find new keywords that aren't in the previous response
              const newPortion = textParts.replace(prevKeywords, '').trim();
              
              // If there's new content, add it to existing keywords
              if (newPortion) {
                // Check if we need to add a comma between old and new content
                const separator = newPortion.startsWith(',') ? '' : 
                                 (prevKeywords.endsWith(',') ? '' : ', ');
                const updatedKeywords = prevKeywords + separator + newPortion;
                setLatestText(newPortion);
                return updatedKeywords;
              }
              return prevKeywords;
            } else {
              // If it's a completely new response or first response
              if (prevKeywords) {
                // Merge previous keywords with new ones, avoiding duplicates
                const prevKeywordList = prevKeywords.split(',').map((k: string) => k.trim());
                const newKeywordList = textParts.split(',').map((k: string) => k.trim());
                
                // Filter out duplicates
                const uniqueNewKeywords = newKeywordList.filter(
                  (newKeyword: string) => !prevKeywordList.some(prevKeyword => 
                    prevKeyword.toLowerCase() === newKeyword.toLowerCase()
                  )
                );
                
                if (uniqueNewKeywords.length > 0) {
                  const newContent = uniqueNewKeywords.join(', ');
                  setLatestText(newContent);
                  return prevKeywords + (prevKeywords.endsWith(',') ? ' ' : ', ') + newContent;
                }
                return prevKeywords;
              } else {
                // First keywords
                setLatestText(textParts);
                return textParts;
              }
            }
          });
          
          // After a brief delay, merge the latest text with previous text
          setTimeout(() => {
            setLatestText("");
          }, 800);
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
  }, [keywords]);

  // Reset keywords when starting a new recording session
  useEffect(() => {
    if (connected) {
      setKeywords("");
      setIsProcessing(false);
    }
  }, [connected]);

  return (
    <div className="keyword-extraction">
      <div className="extraction-header">
        <h2>Keyword Extraction</h2>
        {connected ? 
          <span className={`status connected ${isProcessing ? "processing" : ""}`}>
            {isProcessing ? "Extracting..." : "Recording"}
          </span> : 
          <span className="status">Ready</span>
        }
      </div>
      <div className="extraction-content" ref={contentRef}>
        {keywords ? (
          <p className="keyword-list">
            {keywords.split(latestText).length > 1 ? 
              <>
                {keywords.split(latestText)[0]}
                <span className="latest-text">{latestText}</span>
                {keywords.split(latestText).slice(1).join(latestText)}
              </> : 
              keywords
            }
            <span className={`cursor ${isProcessing ? "blinking" : ""}`}></span>
          </p>
        ) : (
          <p className="placeholder">Press the play button below to start extracting keywords...</p>
        )}
      </div>
    </div>
  );
}
