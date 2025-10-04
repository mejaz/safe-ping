
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-8">
          <h1 className="text-5xl md:text-7xl font-light text-slate-800 mb-6 tracking-tight">
            Safe<span className="font-medium text-emerald-600">Ping</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 font-light leading-relaxed max-w-2xl mx-auto">
            Private, secure messaging with complete privacy. 
            Connect directly with others through encrypted WebRTC channels.
          </p>
        </div>

        <div className="mb-12">
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-medium text-slate-700 mb-1">End-to-End Encrypted</h3>
              <p className="text-sm text-slate-500">Your messages are encrypted and never stored on our servers</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-medium text-slate-700 mb-1">Lightning Fast</h3>
              <p className="text-sm text-slate-500">Direct peer-to-peer connection for instant messaging</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="font-medium text-slate-700 mb-1">No Registration</h3>
              <p className="text-sm text-slate-500">Start chatting immediately without creating an account</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Link href="/chat" className="inline-block">
            <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-full text-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl">
              Start Secure Chat
            </button>
          </Link>
          <p className="text-sm text-slate-500">
            No downloads required • Works in any modern browser
          </p>
        </div>
      </div>
    </div>
  );
}
