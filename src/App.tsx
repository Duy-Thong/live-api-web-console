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

import { useRef, useState } from "react";
import "./App.scss";
import { LiveAPIProvider } from "./contexts/LiveAPIContext";
import SidePanel from "./components/side-panel/SidePanel";
import { SpeechTranscription } from "./components/speech-transcription/SpeechTranscription";
import { DeepgramTranscription } from "./components/deepgram-transcription/DeepgramTranscription";
import { KeywordExtraction } from "./components/keyword-extraction/KeywordExtraction";
import ControlTray from "./components/control-tray/ControlTray";
import cn from "classnames";

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY as string;
if (typeof API_KEY !== "string") {
  throw new Error("set REACT_APP_GEMINI_API_KEY in .env");
}

const host = "generativelanguage.googleapis.com";
const uri = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;

// Enum for page types
enum PageType {
  GEMINI = "gemini",
  DEEPGRAM = "deepgram",
  KEYWORD = "keyword",
}

function App() {
  // this video reference is used for displaying the active stream, whether that is the webcam or screen capture
  // feel free to style as you see fit
  const videoRef = useRef<HTMLVideoElement>(null);
  // either the screen capture, the video or null, if null we hide it
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  // Track current page/view
  const [currentPage, setCurrentPage] = useState<PageType>(PageType.GEMINI);

  return (
    <div className="App">
      <LiveAPIProvider url={uri} apiKey={API_KEY}>
        <div className="streaming-console">
          <SidePanel />
          <main>
            {/* Page Switcher */}
            <div className="page-switcher">
              <button 
                className={cn("page-button", { active: currentPage === PageType.GEMINI })}
                onClick={() => setCurrentPage(PageType.GEMINI)}
              >
                Gemini Transcription
              </button>
              <button 
                className={cn("page-button", { active: currentPage === PageType.DEEPGRAM })}
                onClick={() => setCurrentPage(PageType.DEEPGRAM)}
              >
                Deepgram Transcription
              </button>
              <button
                className={cn("page-button", { active: currentPage === PageType.KEYWORD })}
                onClick={() => setCurrentPage(PageType.KEYWORD)}
              >
                Keyword Extraction
              </button>
            </div>

            <div className="main-app-area">
              {currentPage === PageType.GEMINI ? (
                <SpeechTranscription />
              ) : currentPage === PageType.DEEPGRAM ? (
                <DeepgramTranscription />
              ) : (
                <KeywordExtraction />
              )}
              <video
                className={cn("stream", {
                  hidden: !videoRef.current || !videoStream,
                })}
                ref={videoRef}
                autoPlay
                playsInline
              />
            </div>

            {/* Only show the ControlTray for Gemini transcription and Keyword extraction */}
            {(currentPage === PageType.GEMINI || currentPage === PageType.KEYWORD) && (
              <ControlTray
                videoRef={videoRef}
                supportsVideo={false}
                onVideoStreamChange={setVideoStream}
              />
            )}
          </main>
        </div>
      </LiveAPIProvider>
    </div>
  );
}

export default App;
