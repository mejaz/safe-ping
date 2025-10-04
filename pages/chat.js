import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import QrScanner from 'qr-scanner';

export default function Chat() {
  const [step, setStep] = useState('setup');
  const [sessionId, setSessionId] = useState('');
  const [qrDataURL, setQrDataURL] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [connection, setConnection] = useState(null);
  const [dataChannel, setDataChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  const videoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const fileInputRef = useRef(null);

  const generateSessionId = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const createSession = async () => {
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setIsHost(true);
    
    const sessionData = {
      sessionId: newSessionId,
      timestamp: Date.now()
    };
    
    try {
      const qrDataURL = await QRCode.toDataURL(JSON.stringify(sessionData), {
        width: 256,
        margin: 2,
        color: {
          dark: '#059669',
          light: '#FFFFFF'
        }
      });
      setQrDataURL(qrDataURL);
      setStep('qr-display');
      setupWebRTC(true, newSessionId);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const startQRScanner = () => {
    setStep('qr-scan');
    setTimeout(() => {
      if (videoRef.current) {
        qrScannerRef.current = new QrScanner(
          videoRef.current,
          (result) => {
            try {
              const sessionData = JSON.parse(result.data);
              if (sessionData.sessionId) {
                setSessionId(sessionData.sessionId);
                setIsHost(false);
                qrScannerRef.current.stop();
                setStep('connecting');
                setupWebRTC(false, sessionData.sessionId);
              }
            } catch (error) {
              console.error('Invalid QR code:', error);
            }
          },
          {
            preferredCamera: 'environment',
            highlightScanRegion: true,
            highlightCodeOutline: true,
          }
        );
        qrScannerRef.current.start();
      }
    }, 100);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      QrScanner.scanImage(file)
        .then((result) => {
          try {
            const sessionData = JSON.parse(result);
            if (sessionData.sessionId) {
              setSessionId(sessionData.sessionId);
              setIsHost(false);
              setStep('connecting');
              setupWebRTC(false, sessionData.sessionId);
            }
          } catch (error) {
            console.error('Invalid QR code:', error);
          }
        })
        .catch((error) => {
          console.error('Error scanning QR code:', error);
        });
    }
  };

  const setupWebRTC = async (isInitiator, sessionId) => {
    setConnectionStatus('connecting');
    
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Add TURN server - replace with your actual TURN server credentials
        {
          urls: 'turn:your-turn-server.com:3478',
          username: 'your-username',
          credential: 'your-password'
        }
      ]
    };

    const pc = new RTCPeerConnection(configuration);
    setConnection(pc);

    if (isInitiator) {
      const channel = pc.createDataChannel('messages', {
        ordered: true
      });
      setupDataChannel(channel);
      setDataChannel(channel);
    } else {
      pc.ondatachannel = (event) => {
        const channel = event.channel;
        setupDataChannel(channel);
        setDataChannel(channel);
      };
    }

    pc.oniceconnectionstatechange = () => {
      setConnectionStatus(pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setStep('chat');
      }
    };

    // Handle ICE candidates - send to signaling server
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate:', event.candidate);
        try {
          await fetch('/api/signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              type: 'ice-candidate',
              data: {
                candidate: event.candidate,
                from: isInitiator ? 'initiator' : 'joiner'
              }
            })
          });
        } catch (error) {
          console.error('Error sending ICE candidate:', error);
        }
      }
    };

    if (isInitiator) {
      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      try {
        await fetch('/api/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            type: 'offer',
            data: offer
          })
        });
        console.log('Offer sent to signaling server');
        
        // Wait for answer
        waitForAnswer(pc, sessionId);
      } catch (error) {
        console.error('Error sending offer:', error);
      }
    } else {
      // Wait for offer, then create answer
      waitForOffer(pc, sessionId);
    }

    // Start listening for ICE candidates
    listenForICECandidates(pc, sessionId, isInitiator);
  };

  const waitForOffer = async (pc, sessionId) => {
    const checkForOffer = async () => {
      try {
        const response = await fetch(`/api/signal?sessionId=${sessionId}&type=offer`);
        if (response.ok) {
          const { data: offer } = await response.json();
          if (offer) {
            console.log('Received offer:', offer);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            // Send answer back
            await fetch('/api/signal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId,
                type: 'answer',
                data: answer
              })
            });
            
            console.log('Answer sent to signaling server');
            return true;
          }
        }
      } catch (error) {
        console.error('Error checking for offer:', error);
      }
      return false;
    };

    // Poll for offer
    const interval = setInterval(async () => {
      if (await checkForOffer()) {
        clearInterval(interval);
      }
    }, 1000);

    // Cleanup after 30 seconds
    setTimeout(() => clearInterval(interval), 30000);
  };

  const waitForAnswer = async (pc, sessionId) => {
    const checkForAnswer = async () => {
      try {
        const response = await fetch(`/api/signal?sessionId=${sessionId}&type=answer`);
        if (response.ok) {
          const { data: answer } = await response.json();
          if (answer) {
            console.log('Received answer:', answer);
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            return true;
          }
        }
      } catch (error) {
        console.error('Error checking for answer:', error);
      }
      return false;
    };

    // Poll for answer
    const interval = setInterval(async () => {
      if (await checkForAnswer()) {
        clearInterval(interval);
      }
    }, 1000);

    // Cleanup after 30 seconds
    setTimeout(() => clearInterval(interval), 30000);
  };

  const listenForICECandidates = (pc, sessionId, isInitiator) => {
    const processedCandidates = new Set();
    
    const checkForCandidates = async () => {
      try {
        const response = await fetch(`/api/signal?sessionId=${sessionId}&type=ice-candidates`);
        if (response.ok) {
          const { data: candidates } = await response.json();
          
          for (const candidateData of candidates) {
            const candidateId = `${candidateData.timestamp}_${candidateData.from}`;
            
            // Only process candidates from the other peer that we haven't seen before
            if (candidateData.from !== (isInitiator ? 'initiator' : 'joiner') && 
                !processedCandidates.has(candidateId)) {
              
              processedCandidates.add(candidateId);
              
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidateData.candidate));
                console.log('Added ICE candidate from other peer');
              } catch (error) {
                console.error('Error adding ICE candidate:', error);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking for ICE candidates:', error);
      }
    };

    // Poll for ICE candidates
    const interval = setInterval(checkForCandidates, 1000);

    // Cleanup after connection is established or 60 seconds
    setTimeout(() => clearInterval(interval), 60000);
    
    // Also cleanup when connection state changes
    pc.addEventListener('iceconnectionstatechange', () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        clearInterval(interval);
      }
    });
  };

  const setupDataChannel = (channel) => {
    channel.onopen = () => {
      console.log('Data channel opened');
      setConnectionStatus('connected');
      setStep('chat');
    };

    channel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages(prev => [...prev, { ...message, isOwn: false }]);
    };

    channel.onclose = () => {
      console.log('Data channel closed');
      setConnectionStatus('disconnected');
    };
  };

  const sendMessage = () => {
    if (messageInput.trim() && dataChannel && dataChannel.readyState === 'open') {
      const message = {
        text: messageInput.trim(),
        timestamp: Date.now(),
        id: Math.random().toString(36).substring(2, 15)
      };

      dataChannel.send(JSON.stringify(message));
      setMessages(prev => [...prev, { ...message, isOwn: true }]);
      setMessageInput('');
    }
  };

  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
      }
      if (connection) {
        connection.close();
      }
    };
  }, []);

  const renderSetupStep = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
      <div className="max-w-md mx-auto text-center">
        <Link href="/" className="inline-flex items-center text-emerald-600 hover:text-emerald-700 mb-8 transition-colors">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>

        <h1 className="text-3xl font-light text-slate-800 mb-2">
          Safe<span className="font-medium text-emerald-600">Ping</span>
        </h1>
        <p className="text-slate-600 mb-8">Choose how you want to connect</p>

        <div className="space-y-4">
          <button
            onClick={createSession}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-xl font-medium transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Generate QR Code
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-50 text-slate-500">or</span>
            </div>
          </div>

          <button
            onClick={startQRScanner}
            className="w-full bg-slate-600 hover:bg-slate-700 text-white px-6 py-4 rounded-xl font-medium transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Scan QR Code
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-4 rounded-xl font-medium transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload QR Image
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );

  const renderQRDisplay = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
      <div className="max-w-md mx-auto text-center">
        <h2 className="text-2xl font-light text-slate-800 mb-6">Share this QR Code</h2>
        
        <div className="bg-white p-6 rounded-2xl shadow-lg mb-6">
          {qrDataURL && <img src={qrDataURL} alt="Session QR Code" className="mx-auto" />}
        </div>

        <p className="text-slate-600 mb-4">
          Have the other person scan this QR code to connect
        </p>
        
        <div className="flex items-center justify-center text-sm text-slate-500 mb-6">
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-gray-400'}`}></div>
            {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Waiting for connection...' : 'Waiting'}
          </div>
        </div>

        <button
          onClick={() => setStep('setup')}
          className="text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          Back to Setup
        </button>
      </div>
    </div>
  );

  const renderQRScanner = () => (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-md mx-auto text-center">
        <h2 className="text-2xl font-light text-white mb-6">Scan QR Code</h2>
        
        <div className="relative bg-black rounded-2xl overflow-hidden mb-6">
          <video ref={videoRef} className="w-full h-64 object-cover"></video>
          <div className="absolute inset-0 border-2 border-emerald-500 rounded-2xl"></div>
        </div>

        <p className="text-slate-300 mb-4">
          Point your camera at the QR code to connect
        </p>

        <button
          onClick={() => {
            if (qrScannerRef.current) {
              qrScannerRef.current.stop();
            }
            setStep('setup');
          }}
          className="text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Back to Setup
        </button>
      </div>
    </div>
  );

  const renderConnecting = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
      <div className="max-w-md mx-auto text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-6"></div>
        <h2 className="text-2xl font-light text-slate-800 mb-4">Connecting...</h2>
        <p className="text-slate-600">
          Establishing secure connection with the other person
        </p>
      </div>
    </div>
  );

  const renderChat = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            <span className="text-slate-700 font-medium">Secure Chat</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-slate-500 mt-8">
            <p>Your conversation is end-to-end encrypted</p>
            <p className="text-sm mt-1">Start typing to begin chatting</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                message.isOwn 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-white text-slate-800 border border-slate-200'
              }`}>
                <p>{message.text}</p>
                <p className={`text-xs mt-1 ${message.isOwn ? 'text-emerald-100' : 'text-slate-500'}`}>
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-white border-t border-slate-200 p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <button
            onClick={sendMessage}
            disabled={!messageInput.trim() || !dataChannel || dataChannel.readyState !== 'open'}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-full transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );

  if (step === 'setup') return renderSetupStep();
  if (step === 'qr-display') return renderQRDisplay();
  if (step === 'qr-scan') return renderQRScanner();
  if (step === 'connecting') return renderConnecting();
  if (step === 'chat') return renderChat();

  return null;
}