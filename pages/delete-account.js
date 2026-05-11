import Head from 'next/head'

export default function DeleteAccount() {
  return (
    <>
      <Head>
        <title>Delete Your Account — Arctivate</title>
      </Head>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', color: '#E8F0EF', backgroundColor: '#030808', minHeight: '100vh' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Delete Your Arctivate Account</h1>
        <p style={{ color: '#5E7D7D', marginBottom: 32 }}>Last updated: May 11, 2026</p>

        <Section title="In-app deletion">
          <p>You can delete your Arctivate account and all associated data directly from the app:</p>
          <ol>
            <li>Open Arctivate and sign in</li>
            <li>Go to the <strong>Profile</strong> tab</li>
            <li>Tap <strong>Settings → Delete account</strong></li>
            <li>Confirm the deletion</li>
          </ol>
          <p>Your account and personal data are removed immediately.</p>
        </Section>

        <Section title="Request deletion by email">
          <p>If you can't access the in-app option, email <a href="mailto:privacy@arctivate.app?subject=Delete%20my%20Arctivate%20account" style={{ color: '#00D4AA' }}>privacy@arctivate.app</a> from the email address on your Arctivate account with the subject line <strong>"Delete my Arctivate account"</strong>. We will confirm and complete the deletion within 7 days.</p>
        </Section>

        <Section title="What gets deleted">
          <p>The following are permanently deleted when you delete your account:</p>
          <ul>
            <li>Your account, email, and password credentials</li>
            <li>Profile information (username, age, weight, gender, fitness goal, fitness level)</li>
            <li>Workout logs, personal bests, and training history</li>
            <li>Habit completions, streaks, and progress photos</li>
            <li>Food logs and nutrition history</li>
            <li>AI Coach conversation history</li>
            <li>Social feed posts, likes, and comments you created</li>
            <li>Push notification tokens and reminder settings</li>
            <li>Points balances and reward redemption history</li>
          </ul>
        </Section>

        <Section title="What is retained (and for how long)">
          <p>For legal, fraud-prevention, and operational reasons, the following may be retained briefly:</p>
          <ul>
            <li><strong>Anonymized analytics events</strong> with no personal identifiers — retained up to 90 days, then permanently deleted.</li>
            <li><strong>Backup snapshots</strong> of our database — overwritten on a rolling 30-day cycle, after which your data is no longer recoverable.</li>
            <li><strong>Email correspondence</strong> related to your deletion request — retained up to 30 days to confirm the request was completed, then deleted.</li>
          </ul>
          <p>We do not retain any personally identifiable account data beyond these windows.</p>
        </Section>

        <Section title="Questions">
          <p>If you have questions about account deletion or need help, contact us at <a href="mailto:privacy@arctivate.app" style={{ color: '#00D4AA' }}>privacy@arctivate.app</a>.</p>
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
        ul, ol { padding-left: 20px; margin-top: 8px; }
        li { margin-bottom: 4px; }
        p { margin-bottom: 8px; }
      `}</style>
    </div>
  )
}
