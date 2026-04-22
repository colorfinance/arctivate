import Head from 'next/head'
import Link from 'next/link'

export default function Support() {
  return (
    <>
      <Head>
        <title>Support — Arctivate</title>
      </Head>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', color: '#E8F0EF', backgroundColor: '#030808', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Arctivate Support</h1>
        <p style={{ color: '#5E7D7D', marginBottom: 32 }}>We're here to help. Find answers below or reach out directly.</p>

        <Section title="Contact Us">
          <p>For any questions, issues, or feedback, email us at:</p>
          <p style={{ marginTop: 12 }}>
            <a href="mailto:support@arcfitness.com.au" style={{ color: '#00D4FF', textDecoration: 'underline', fontSize: 18, fontWeight: 600 }}>
              support@arcfitness.com.au
            </a>
          </p>
          <p style={{ marginTop: 8, color: '#5E7D7D' }}>We aim to respond within 24 hours.</p>
        </Section>

        <Section title="Frequently Asked Questions">
          <FAQ
            q="How do I create an account?"
            a="Open the app and tap Sign Up. Enter your email and a password (minimum 6 characters). You'll be signed in immediately and taken through onboarding."
          />
          <FAQ
            q="How do I log a workout?"
            a="Go to the Train tab, select an exercise from the dropdown (or create a new one), enter your weight/time/reps, and tap Log. You can also use voice input by tapping the microphone icon."
          />
          <FAQ
            q="How do I track habits?"
            a="Go to the Habits tab, tap + to create a new habit (e.g. 'No Sugar', 'Read 30 min'), then check it off each day. Streaks are tracked automatically."
          />
          <FAQ
            q="How do I scan food?"
            a="Go to the Food tab, tap the camera icon, and point your camera at a food item or barcode. The AI will identify the item and estimate calories and macros."
          />
          <FAQ
            q="How does the points system work?"
            a="You earn +10 points per habit completed, +50 per workout logged, +100 bonus for a new personal best, and +150 for partner check-ins. Points accumulate on your profile."
          />
          <FAQ
            q="How do I change my profile name or photo?"
            a="Go to Profile, tap the Edit button (pencil icon), change your name, and tap 'Change photo' to upload a new profile picture. Tap Save when done."
          />
          <FAQ
            q="How do I share workouts to the community feed?"
            a="After logging a workout, a share modal appears. Toggle 'Share to Feed' on and tap 'Post to Feed'. Your workout will appear in the Feed tab for other users to see."
          />
          <FAQ
            q="How do I delete my account and data?"
            a="Go to Profile, scroll to the bottom, and tap 'Delete Account'. Type DELETE to confirm. All your data will be permanently removed."
          />
          <FAQ
            q="The app isn't loading or shows a blank screen."
            a="Make sure you have an internet connection. The app requires a connection to load. Try closing and reopening the app. If the issue persists, contact us at the email above."
          />
        </Section>

        <Section title="Privacy & Terms">
          <p>
            <Link href="/privacy" style={{ color: '#00D4FF', textDecoration: 'underline' }}>Privacy Policy</Link>
            {' — '}
            <Link href="/terms" style={{ color: '#00D4FF', textDecoration: 'underline' }}>Terms of Service</Link>
          </p>
        </Section>

        <Section title="About Arctivate">
          <p>Arctivate is developed by ARC Fitness Australia Pty Ltd. Our mission is to help athletes and disciplined individuals track their progress without distractions.</p>
          <p style={{ marginTop: 8 }}>Version 1.0 — Made in Australia</p>
        </Section>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <Link href="/" style={{ color: '#00D4FF', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Arctivate
          </Link>
        </div>
      </div>
    </>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: '#F4F4F5' }}>{title}</h2>
      <div style={{ color: '#B0C4C4', lineHeight: 1.7, fontSize: 15 }}>{children}</div>
    </div>
  )
}

function FAQ({ q, a }) {
  return (
    <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <p style={{ fontWeight: 600, color: '#F4F4F5', marginBottom: 6 }}>{q}</p>
      <p style={{ color: '#8FA8A8', fontSize: 14 }}>{a}</p>
    </div>
  )
}
