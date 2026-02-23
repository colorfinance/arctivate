import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabaseClient'

const MicIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
)

const StopIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="3"/>
  </svg>
)

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)

const PauseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
  </svg>
)

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
)

const SaveIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
  </svg>
)

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function VoiceMemo({ exercises, selectedExercise, onSaved, onClose }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [memoLabel, setMemoLabel] = useState('')
  const [visualizerData, setVisualizerData] = useState(new Array(24).fill(4))

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)
  const audioPlayerRef = useRef(null)
  const analyserRef = useRef(null)
  const animationFrameRef = useRef(null)
  const streamRef = useRef(null)

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopRecording()
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      if (timerRef.current) clearInterval(timerRef.current)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  // Set default label based on selected exercise
  useEffect(() => {
    if (selectedExercise) {
      setMemoLabel(`${selectedExercise.name} notes`)
    }
  }, [selectedExercise])

  const startRecording = async () => {
    setError(null)
    audioChunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })
      streamRef.current = stream

      // Set up audio analyser for visualizer
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)
      analyserRef.current = analyser

      // Start visualizer
      updateVisualizer()

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)

        // Stop stream tracks
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null

        // Reset visualizer
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        setVisualizerData(new Array(24).fill(4))
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(100) // Collect data every 100ms
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Microphone error:', err)
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please enable it in browser settings.')
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found on this device.')
      } else {
        setError('Could not access microphone. Please try again.')
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsRecording(false)
    setIsPaused(false)
  }

  const updateVisualizer = () => {
    if (!analyserRef.current) return

    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyserRef.current.getByteFrequencyData(dataArray)

    // Map to visualizer bars
    const bars = 24
    const step = Math.floor(bufferLength / bars)
    const newData = []
    for (let i = 0; i < bars; i++) {
      const value = dataArray[i * step] || 0
      newData.push(Math.max(4, (value / 255) * 40))
    }
    setVisualizerData(newData)

    animationFrameRef.current = requestAnimationFrame(updateVisualizer)
  }

  const playAudio = () => {
    if (!audioUrl) return

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
      audioPlayerRef.current = null
    }

    const audio = new Audio(audioUrl)
    audioPlayerRef.current = audio

    audio.onended = () => setIsPlaying(false)
    audio.onpause = () => setIsPlaying(false)
    audio.play()
    setIsPlaying(true)
  }

  const pauseAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
    }
    setIsPlaying(false)
  }

  const discardRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)
    setRecordingTime(0)
    setIsPlaying(false)
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
      audioPlayerRef.current = null
    }
  }

  const saveMemo = async () => {
    if (!audioBlob) return
    setIsSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Please log in to save voice memos')
        setIsSaving(false)
        return
      }

      const timestamp = Date.now()
      const filePath = `${user.id}/voice-memos/${timestamp}.webm`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('voice-memos')
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        })

      if (uploadError) {
        // If bucket doesn't exist, save memo data locally
        console.error('Upload error:', uploadError)
        // Still call onSaved with local data
        if (onSaved) {
          onSaved({
            label: memoLabel || 'Workout memo',
            duration: recordingTime,
            timestamp: new Date().toISOString(),
            localBlob: audioBlob
          })
        }
        return
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('voice-memos')
        .getPublicUrl(filePath)

      if (onSaved) {
        onSaved({
          label: memoLabel || 'Workout memo',
          duration: recordingTime,
          url: urlData?.publicUrl || null,
          timestamp: new Date().toISOString()
        })
      }
    } catch (err) {
      console.error('Save memo error:', err)
      // Still trigger saved callback with local data
      if (onSaved) {
        onSaved({
          label: memoLabel || 'Workout memo',
          duration: recordingTime,
          timestamp: new Date().toISOString(),
          localBlob: audioBlob
        })
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
      />

      {/* Bottom Sheet */}
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-6 z-50 space-y-5 pb-safe"
      >
        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />

        {/* Header */}
        <div className="text-center">
          <h2 className="text-xl font-black italic tracking-tighter">VOICE MEMO</h2>
          <p className="text-[10px] text-arc-muted mt-1 uppercase tracking-[0.15em]">
            Record notes about your workout
          </p>
        </div>

        {/* Memo Label Input */}
        <div>
          <label className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-1.5 block">Label</label>
          <input
            type="text"
            value={memoLabel}
            onChange={(e) => setMemoLabel(e.target.value)}
            placeholder="e.g. Form notes, how I felt..."
            className="w-full bg-arc-surface border border-white/[0.06] p-3 rounded-xl text-white text-sm outline-none focus:border-arc-accent/40 transition-colors font-medium"
          />
        </div>

        {/* Visualizer / Timer */}
        <div className="bg-arc-bg/60 border border-white/[0.04] rounded-2xl p-5">
          {/* Waveform Visualizer */}
          <div className="flex items-center justify-center gap-[3px] h-12 mb-3">
            {visualizerData.map((height, i) => (
              <motion.div
                key={i}
                animate={{ height: isRecording ? height : audioBlob ? 8 : 4 }}
                transition={{ duration: 0.1 }}
                className={`w-[3px] rounded-full ${
                  isRecording ? 'bg-arc-accent' : audioBlob ? 'bg-arc-cyan/50' : 'bg-white/10'
                }`}
                style={{ minHeight: '3px' }}
              />
            ))}
          </div>

          {/* Timer */}
          <div className="text-center">
            <span className={`font-mono text-3xl font-black tracking-tight ${isRecording ? 'text-arc-accent' : 'text-white/60'}`}>
              {formatTime(recordingTime)}
            </span>
            {isRecording && (
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="flex items-center justify-center gap-1.5 mt-1"
              >
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Recording</span>
              </motion.div>
            )}
            {!isRecording && audioBlob && (
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <div className="w-2 h-2 rounded-full bg-arc-accent" />
                <span className="text-[10px] font-bold text-arc-accent uppercase tracking-wider">Ready to save</span>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center items-center gap-4">
          {!audioBlob ? (
            <>
              {/* Record / Stop Button */}
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  isRecording
                    ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]'
                    : 'bg-accent-gradient shadow-glow-accent'
                }`}
              >
                {isRecording ? <StopIcon /> : <MicIcon />}
              </motion.button>
            </>
          ) : (
            <>
              {/* Discard */}
              <button
                onClick={discardRecording}
                className="w-14 h-14 rounded-full bg-arc-surface border border-white/[0.06] flex items-center justify-center text-arc-muted hover:text-red-400 transition-colors"
              >
                <TrashIcon />
              </button>

              {/* Play / Pause */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={isPlaying ? pauseAudio : playAudio}
                className="w-16 h-16 rounded-full bg-arc-surface border border-arc-accent/20 flex items-center justify-center text-arc-accent"
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </motion.button>

              {/* Save */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={saveMemo}
                disabled={isSaving}
                className="w-14 h-14 rounded-full bg-accent-gradient flex items-center justify-center text-white shadow-glow-accent disabled:opacity-50"
              >
                {isSaving ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : (
                  <SaveIcon />
                )}
              </motion.button>
            </>
          )}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center text-xs text-red-400"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Help Text */}
        {!isRecording && !audioBlob && (
          <div className="text-center space-y-1 pb-2">
            <p className="text-[10px] text-arc-muted">Record voice memos for your workout:</p>
            <p className="text-[10px] text-white/40 italic">"Felt strong today, grip gave out on last set"</p>
            <p className="text-[10px] text-white/40 italic">"Left shoulder twinge on overhead press"</p>
            <p className="text-[10px] text-white/40 italic">"Need to deload next week"</p>
          </div>
        )}
      </motion.div>
    </>
  )
}
