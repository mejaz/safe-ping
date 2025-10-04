// Simple in-memory signaling server for WebRTC
const sessions = new Map();

export default function handler(req, res) {
  if (req.method === 'POST') {
    const { sessionId, type, data } = req.body;
    
    if (!sessionId || !type || !data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Initialize session if it doesn't exist
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        offer: null,
        answer: null,
        iceCandidates: [],
        createdAt: Date.now()
      });
    }

    const session = sessions.get(sessionId);

    switch (type) {
      case 'offer':
        session.offer = data;
        break;
      case 'answer':
        session.answer = data;
        break;
      case 'ice-candidate':
        session.iceCandidates.push({
          ...data,
          timestamp: Date.now()
        });
        break;
      default:
        return res.status(400).json({ error: 'Invalid type' });
    }

    sessions.set(sessionId, session);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET') {
    const { sessionId, type } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    const session = sessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    switch (type) {
      case 'offer':
        return res.status(200).json({ data: session.offer });
      case 'answer':
        return res.status(200).json({ data: session.answer });
      case 'ice-candidates':
        return res.status(200).json({ data: session.iceCandidates });
      case 'all':
        return res.status(200).json({ 
          offer: session.offer,
          answer: session.answer,
          iceCandidates: session.iceCandidates
        });
      default:
        return res.status(400).json({ error: 'Invalid type' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Cleanup old sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > maxAge) {
      sessions.delete(sessionId);
    }
  }
}, 5 * 60 * 1000);