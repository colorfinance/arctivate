import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const MicIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
)

const StopIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

export default function VoiceInput({ exercises, onResult, onClose }) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [parsedData, setParsedData] = useState(null)
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState(null)
  const [isSupported, setIsSupported] = useState(true)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let finalTranscript = ''
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += t
        } else {
          interimTranscript += t
        }
      }
      setTranscript(finalTranscript || interimTranscript)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please enable it in browser settings.')
      } else if (event.error === 'no-speech') {
        setError('No speech detected. Try again.')
      }
    }

    recognitionRef.current = recognition

    return () => {
      recognition.abort()
    }
  }, [])

  const startListening = () => {
    setError(null)
    setTranscript('')
    setParsedData(null)
    setIsListening(true)
    recognitionRef.current?.start()
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  const parseTranscript = async () => {
    if (!transcript.trim()) return
    setIsParsing(true)
    setError(null)

    try {
      const res = await fetch('/api/parse-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcript.trim(),
          exercises: exercises.map(e => ({ name: e.name, metric_type: e.metric_type, id: e.id }))
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setParsedData(data)
    } catch (err) {
      setError(err.message || 'Failed to parse. Try again.')
    } finally {
      setIsParsing(false)
    }
  }

  const confirmResult = () => {
    if (parsedData && onResult) {
      onResult(parsedData)
    }
  }

  // Auto-parse when speech ends with a transcript
  useEffect(() => {
    if (!isListening && transcript.trim() && !parsedData) {
      parseTranscript()
    }
  }, [isListening])

  if (!isSupported) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
        />
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-8 z-50 text-center pb-safe"
        >
          <p className="text-sm text-arc-muted">Voice input is not supported in this browser. Try Chrome or Safari.</p>
          <button onClick={onClose} className="mt-4 text-arc-accent font-bold text-sm">Close</button>
        </motion.div>
      </>
    )
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-8 z-50 space-y-6 pb-safe"
      >
        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
        <h2 className="text-xl font-black italic tracking-tighter text-center">VOICE LOG</h2>

        {/* Mic Button */}
        <div className="flex justify-center">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={isListening ? stopListening : startListening}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              isListening
                ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]'
                : 'bg-accent-gradient shadow-glow-accent'
            }`}
          >
            {isListening ? <StopIcon /> : <MicIcon />}
          </motion.button>
        </div>

        {/* Listening Animation */}
        {isListening && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center gap-1">
            {[0, 1, 2, 3, 4].map(i => (
              <motion.div
                key={i}
                animate={{ height: [8, 24, 8] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                className="w-1 bg-arc-accent rounded-full"
              />
            ))}
          </motion.div>
        )}

        {/* Transcript */}
        {transcript && (
          <div className="bg-arc-surface border border-white/[0.06] rounded-xl p-4">
            <span className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-1 block">Heard</span>
            <p className="text-sm text-white font-medium">&ldquo;{transcript}&rdquo;</p>
          </div>
        )}

        {/* Parsing Indicator */}
        {isParsing && (
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-6 h-6 border-2 border-arc-accent/30 border-t-arc-accent rounded-full mx-auto"
            />
            <span className="text-xs text-arc-muted mt-2 block">Parsing workout data...</span>
          </div>
        )}

        {/* Parsed Result */}
        <AnimatePresence>
          {parsedData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-arc-bg border border-arc-accent/20 rounded-2xl p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-arc-accent uppercase tracking-[0.2em]">Parsed Result</span>
                {!parsedData.matched && (
                  <span className="text-[8px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-bold">NEW EXERCISE</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <span className="text-[8px] text-arc-muted font-bold uppercase">Exercise</span>
                  <p className="text-white font-bold">{parsedData.exercise}</p>
                </div>
                {parsedData.weight !== null && (
                  <div>
                    <span className="text-[8px] text-arc-muted font-bold uppercase">Weight</span>
                    <p className="text-white font-bold font-mono">{parsedData.weight} <span className="text-arc-muted text-xs">kg</span></p>
                  </div>
                )}
                {parsedData.reps !== null && (
                  <div>
                    <span className="text-[8px] text-arc-muted font-bold uppercase">Reps</span>
                    <p className="text-white font-bold font-mono">{parsedData.reps}</p>
                  </div>
                )}
                {parsedData.sets !== null && (
                  <div>
                    <span className="text-[8px] text-arc-muted font-bold uppercase">Sets</span>
                    <p className="text-white font-bold font-mono">{parsedData.sets}</p>
                  </div>
                )}
                {parsedData.rpe !== null && (
                  <div>
                    <span className="text-[8px] text-arc-muted font-bold uppercase">RPE</span>
                    <p className="text-white font-bold font-mono">{parsedData.rpe}/10</p>
                  </div>
                )}
              </div>

              {parsedData.notes && (
                <p className="text-[10px] text-arc-muted italic">{parsedData.notes}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={confirmResult}
                  className="flex-1 bg-accent-gradient text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-glow-accent active:scale-95 transition-transform"
                >
                  <CheckIcon /> Confirm & Log
                </button>
                <button
                  onClick={() => { setParsedData(null); setTranscript('') }}
                  className="bg-arc-surface text-arc-muted font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 border border-white/5"
                >
                  <EditIcon /> Retry
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <p className="text-center text-xs text-red-400">{error}</p>
        )}

        {/* Help Text */}
        <div className="text-center space-y-1">
          <p className="text-[10px] text-arc-muted">Try saying:</p>
          <p className="text-[10px] text-white/50 italic">&ldquo;Bench press, 100kg for 8 reps at RPE 8&rdquo;</p>
          <p className="text-[10px] text-white/50 italic">&ldquo;Incline bench, two plates and a ten&rdquo;</p>
          <p className="text-[10px] text-white/50 italic">&ldquo;225 for 5 sets of 3&rdquo;</p>
        </div>
      </motion.div>
    </>
  )
}
