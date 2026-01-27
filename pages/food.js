import { useState } from 'react'
import Nav from '../components/Nav'

export default function Food() {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)

  const simulateScan = () => {
    setScanning(true)
    setTimeout(() => {
        setScanning(false)
        setResult({
            name: "Quest Bar",
            desc: "Chocolate Chip Cookie Dough",
            cals: 190,
            p: 21,
            c: 22,
            f: 9
        })
    }, 1500)
  }

  const addToLog = () => {
      setResult(null)
      alert("Logged 190 calories!")
  }

  return (
    <div className="min-h-screen flex flex-col pb-20 relative overflow-hidden">
        {/* Header */}
        <header className="p-6 flex justify-between items-center absolute top-0 left-0 right-0 z-20">
            <h1 className="text-xl font-black tracking-tighter italic drop-shadow-md">NUTRITION</h1>
            <div className="glass-panel px-3 py-1 rounded-full text-xs font-mono">
                <span className="text-arc-muted">Daily:</span> 
                <span className="text-white font-bold">1,250 / 2,800</span>
            </div>
        </header>

        {/* Viewport */}
        <main className="flex-1 relative bg-gray-900 flex flex-col items-center justify-center">
            {/* BG Image */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-30"></div>
            
            {/* Scanner Frame */}
            <div className="relative z-10 w-64 h-64 border-2 border-white/20 rounded-3xl flex items-center justify-center overflow-hidden">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-arc-accent rounded-tl-xl"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-arc-accent rounded-tr-xl"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-arc-accent rounded-bl-xl"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-arc-accent rounded-br-xl"></div>
                
                {/* Laser Animation */}
                <div className="absolute left-0 right-0 h-0.5 bg-arc-accent shadow-[0_0_10px_#ff4d00] animate-[scan_2s_infinite_linear]"></div>
                
                <p className="text-xs text-white/70 font-bold mt-32 tracking-widest uppercase">Align Barcode</p>
            </div>

            {/* Controls */}
            <div className="absolute bottom-24 w-full px-8 flex justify-between items-center z-20">
                <button className="bg-white/10 p-3 rounded-full backdrop-blur hover:bg-white/20">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> 
                </button>
                
                <button onClick={simulateScan} className={`bg-arc-accent w-16 h-16 rounded-full border-4 border-white/10 flex items-center justify-center shadow-[0_0_20px_rgba(255,77,0,0.5)] active:scale-95 transition ${scanning ? 'animate-pulse' : ''}`}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
                </button>

                <button className="bg-white/10 p-3 rounded-full backdrop-blur hover:bg-white/20">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
            </div>
        </main>

        {/* Modal */}
        <div className={`fixed inset-x-0 bottom-0 bg-arc-card rounded-t-3xl transform transition-transform duration-300 z-30 border-t border-white/10 ${result ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="p-6 pb-24">
                <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" onClick={() => setResult(null)}></div>
                
                {result && (
                <>
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-xl font-bold">{result.name}</h2>
                            <p className="text-arc-muted text-sm">{result.desc}</p>
                        </div>
                        <div className="bg-green-500/10 text-green-500 text-xs font-bold px-2 py-1 rounded">
                            Verified
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mb-6 text-center">
                        <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                            <div className="text-xs text-arc-muted mb-1">Cals</div>
                            <div className="font-black text-xl">{result.cals}</div>
                        </div>
                        <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                            <div className="text-xs text-arc-muted mb-1">Prot</div>
                            <div className="font-bold text-lg">{result.p}g</div>
                        </div>
                        <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                            <div className="text-xs text-arc-muted mb-1">Carb</div>
                            <div className="font-bold text-lg">{result.c.g}</div>
                        </div>
                        <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                            <div className="text-xs text-arc-muted mb-1">Fat</div>
                            <div className="font-bold text-lg">{result.f}g</div>
                        </div>
                    </div>

                    <button onClick={addToLog} className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-900/20 active:scale-95 transition">
                        ADD TO LOG
                    </button>
                </>
                )}
            </div>
        </div>

        <Nav />

        <style jsx global>{`
            @keyframes scan {
                0% { top: 10%; opacity: 0; }
                5% { opacity: 1; }
                95% { opacity: 1; }
                100% { top: 90%; opacity: 0; }
            }
        `}</style>
    </div>
  )
}
