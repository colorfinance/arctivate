import Head from 'next/head'

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Service — Arctivate</title>
      </Head>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', color: '#E8F0EF', backgroundColor: '#030808', minHeight: '100vh' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ color: '#5E7D7D', marginBottom: 32 }}>Last updated: March 10, 2026</p>

        <Section title="1. Acceptance">
          <p>By using Arctivate, you agree to these terms. If you do not agree, do not use the app.</p>
        </Section>

        <Section title="2. The Service">
          <p>Arctivate is a fitness tracking application that lets you log workouts, track food, build habits, and earn points. The service includes an AI Coach feature that provides general fitness information.</p>
        </Section>

        <Section title="3. Account">
          <p>You must provide a valid email address to create an account. You are responsible for maintaining the security of your account. One account per person.</p>
        </Section>

        <Section title="4. Acceptable Use">
          <p>You agree not to:</p>
          <ul>
            <li>Use the app for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to other accounts or our systems</li>
            <li>Post offensive, harmful, or misleading content in the social feed or group chats</li>
            <li>Abuse the points system through automated or fraudulent means</li>
            <li>Reverse engineer or attempt to extract the source code of the app</li>
          </ul>
        </Section>

        <Section title="5. Health Disclaimer">
          <p><strong>Arctivate is not a medical service.</strong> The AI Coach provides general fitness information only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider before starting any exercise or nutrition program. Use the app at your own risk.</p>
        </Section>

        <Section title="6. Points & Rewards">
          <p>Points earned in Arctivate have no monetary value and cannot be exchanged for cash. We reserve the right to modify the points system, adjust point values, or reset points at any time.</p>
        </Section>

        <Section title="7. Content">
          <p>You retain ownership of any content you post (workout data, food logs, feed posts). By posting to the social feed, you grant Arctivate a non-exclusive license to display that content to other users of the app.</p>
        </Section>

        <Section title="8. Termination">
          <p>We may suspend or terminate your account if you violate these terms. You may delete your account at any time from the Profile screen.</p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p>Arctivate is provided &ldquo;as is&rdquo; without warranties of any kind. We are not liable for any injuries, health issues, or damages arising from your use of the app or reliance on the AI Coach&apos;s suggestions.</p>
        </Section>

        <Section title="10. Changes">
          <p>We may update these terms from time to time. Continued use of the app after changes constitutes acceptance of the new terms.</p>
        </Section>

        <Section title="11. Contact">
          <p>Questions? Email us at <a href="mailto:support@arctivate.app" style={{ color: '#00D4AA' }}>support@arctivate.app</a></p>
        </Section>
      </div>
    </>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#E8F0EF' }}>{title}</h2>
      <div style={{ color: '#94B3B3', lineHeight: 1.7, fontSize: 15 }}>{children}</div>
      <style jsx>{`
        ul { padding-left: 20px; margin-top: 8px; }
        li { margin-bottom: 4px; }
        p { margin-bottom: 8px; }
      `}</style>
    </div>
  )
}
