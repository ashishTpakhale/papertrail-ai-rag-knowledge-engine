import React, { useState, useRef } from 'react';
import { Upload, MessageSquare, ShieldCheck, FileText, Send, Sparkles, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';

export default function App() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  
  const [messages, setMessages] = useState([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [activeCitations, setActiveCitations] = useState([]);

  const fileInputRef = useRef(null);
  const API_BASE = import.meta.env.VITE_API_BASE_URL;;

  // Handle Binary PDF Selection & API Upload Request
  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setUploading(true);
    setUploadStatus('Processing PDF nodes...');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setUploadStatus(`Success! Synchronized ${data.chunks_created} vector chunks.`);
      } else {
        setUploadStatus(`Upload failed: ${data.error}`);
      }
    } catch (err) {
      setUploadStatus(`Connection error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Handle RAG Context Query Form Execution
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!inputQuestion.trim()) return;

    const userMessage = { text: inputQuestion, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInputQuestion('');
    setLoadingChat(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: inputQuestion,
          currentFilename: file ? file.name : null // <-- Send the currently loaded filename
        }),
      });
      const data = await res.json();

      const aiMessage = {
        text: data.answer,
        sender: 'ai',
        citations: data.citations || []
      };
      
      setMessages(prev => [...prev, aiMessage]);
      if (data.citations?.length > 0) {
        setActiveCitations(data.citations);
      }
    } catch (err) {
      setMessages(prev => [...prev, { text: `API Layer Error: ${err.message}`, sender: 'ai', error: true }]);
    } finally {
      setLoadingChat(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Upper Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="text-indigo-400 w-6 h-6 animate-pulse" />
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-red from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            PaperTrail AI – RAG Knowledge Engine
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">
          <ShieldCheck className="text-emerald-400 w-4 h-4" />
          Supabase Vector Tier Live
        </div>
      </header>

      {/* Main Split Interface Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Side: Document Control Panel */}
        <div className="w-full md:w-80 border-r border-slate-800 bg-slate-900/20 p-6 flex flex-col gap-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">Knowledge Core</h2>
            <p className="text-xs text-slate-400">Upload technical PDFs to parse, slice, and persist semantic weights inside our vector schemas.</p>
          </div>

          <div 
            onClick={() => fileInputRef.current.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
              file ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30'
            }`}
          >
            <input type="file" accept=".pdf" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            <Upload className="mx-auto text-slate-400 w-8 h-8 mb-2" />
            <span className="text-sm font-medium block text-slate-200">
              {file ? file.name : "Select Document PDF"}
            </span>
            <span className="text-xs text-slate-500 mt-1 block">Max specification size 10MB</span>
          </div>

          {uploadStatus && (
            <div className="text-xs p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-slate-300">
              {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
              <span>{uploadStatus}</span>
            </div>
          )}

          {/* Citation References Card Stack */}
          <div className="flex-1 flex flex-col min-h-[200px]">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Source Fact Citations
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px] pr-1">
              {activeCitations.length === 0 ? (
                <div className="text-xs text-slate-600 italic p-4 text-center border border-slate-900 rounded-lg">
                  No vectors loaded yet. Ask a question to trigger retrieval matching traces.
                </div>
              ) : (
                activeCitations.map((cite, idx) => (
                  <div key={idx} className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-[11px] leading-relaxed text-slate-400 hover:border-slate-700 transition-colors">
                    <span className="font-semibold text-indigo-400 block mb-1">Snippet #{idx + 1} ({cite.source})</span>
                    "{cite.snippet}"
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Interactive AI Response Console */}
        <div className="flex-1 flex flex-col bg-slate-950">
          {/* Chat Container Stream */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[calc(100vh-180px)]">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto mt-12">
                <MessageSquare className="w-12 h-12 text-slate-700 mb-3" />
                <h3 className="text-base font-medium text-slate-300">Semantic Chat Interface</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Once your document mapping indicators confirm initialization, input custom questions to pull contextual context matrices out of the engine.
                </p>
              </div>
            )}

            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-2xl px-4 py-3 rounded-xl text-sm shadow-sm leading-relaxed ${
                  msg.sender === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                }`}>
                  {msg.sender === 'ai' ? (
                    <div className="text-slate-200 text-sm max-w-none space-y-2 
                      [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:my-2 
                      [&_li]:my-1 [&_strong]:text-indigo-300 [&_strong]:font-semibold">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  )}
                </div>
              </div>
            ))}

            {loadingChat && (
              <div className="flex justify-start">
                <div className="bg-slate-900 border border-slate-800 px-4 py-3 rounded-xl rounded-bl-none flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  Running vector scanning lookup sequences...
                </div>
              </div>
            )}
          </div>

          {/* Form Action Query Entry Area */}
          <form onSubmit={handleChatSubmit} className="p-4 border-t border-slate-800 bg-slate-900/30 flex gap-2">
            <input
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder="Ask a technical context verification question..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            <button
              type="submit"
              disabled={loadingChat || !inputQuestion.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors"
            >
              <Send className="w-4 h-4" />
              Query
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}