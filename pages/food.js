import { useState, useRef } from 'react'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'

export default function Food() {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setScanning(true)
    setResult(null)

    // Convert to Base64
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64Image = reader.result
      // Resize before sending to avoid 4.5MB Vercel limit
      resizeImage(base64Image, 800, async (resizedImage) => {
        await analyzeImage(resizedImage)
      })
    }
    reader.readAsDataURL(file)
  }

  // Helper to resize image
  const resizeImage = (base64Str, maxWidth = 800, callback) => {
    const img = new Image()
    img.src = base64Str
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      let width = img.width
      let height = img.height
      
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width
          width = maxWidth
        }
      } else {
        if (height > maxWidth) {
          width *= maxWidth / height
          height = maxWidth
        }
      }
      
      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)
      
      // Compress to JPEG 0.7 quality
      callback(canvas.toDataURL('image/jpeg', 0.7))
    }
  }

  const analyzeImage = async (base64Image) => {
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
      })

      if (!res.ok) throw new Error('Analysis failed')

      const data = await res.json()
      setResult(data)
    } catch (error) {
      console.error(error)
      alert("Failed to identify food. Check your API Key.")
    } finally {
      setScanning(false)
    }
  }

  const addToLog = async () => {
    if(!result) return
    const { data: { user } } = await supabase.auth.getUser()
    
    if(user) {
        await supabase.from('food_logs').insert({
            user_id: user.id,
            item_name: result.name,
            calories: result.cals,
            macros: { p: result.p, c: result.c, f: result.f }
        })
        
        alert(`Logged ${result.cals} calories!`)
        setResult(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col pb-20 relative overflow-hidden">
        {/* Header */}
        <header className="p-6 flex justify-between items-center absolute top-0 left-0 right-0 z-20">
            <h1 className="text-xl font-black tracking-tighter italic drop-shadow-md">NUTRITION</h1>
            <div className="glass-panel px-3 py-1 rounded-full text-xs font-mono">
                <span className="text-arc-muted">Daily:</span> 
                <span className="text-white font-bold">-- / 2,800</span>
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
                
                {scanning && (
                    <div className="absolute left-0 right-0 h-0.5 bg-arc-accent shadow-[0_0_10px_#ff4d00] animate-[scan_2s_infinite_linear]"></div>
                )}
                
                {!scanning && !result && (
                    <p className="text-xs text-white/70 font-bold mt-32 tracking-widest uppercase">Tap to Snap</p>
                )}
            </div>

            {/* Hidden File Input */}
            <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileSelect}
            />

            {/* Controls */}
            <div className="absolute bottom-24 w-full px-8 flex justify-between items-center z-20">
                <div className="w-12"></div> {/* Spacer */}
                
                <button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={scanning}
                    className={`bg-arc-accent w-20 h-20 rounded-full border-4 border-white/10 flex items-center justify-center shadow-[0_0_20px_rgba(255,77,0,0.5)] active:scale-95 transition ${scanning ? 'animate-pulse opacity-50' : ''}`}
                >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </button>

                <div className="w-12"></div> {/* Spacer */}
            </div>
        </main>

        {/* Result Modal */}
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
                        <div className="bg-blue-500/10 text-blue-500 text-xs font-bold px-2 py-1 rounded">
                            AI Analyzed
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
                            <div className="font-bold text-lg">{result.c}g</div>
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
