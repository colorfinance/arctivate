import Head from 'next/head'

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — Arctivate</title>
      </Head>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', color: '#E8F0EF', backgroundColor: '#030808', minHeight: '100vh' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ color: '#5E7D7D', marginBottom: 32 }}>Last updated: March 10, 2026</p>

        <Section title="1. Information We Collect">
          <p><strong>Account Data:</strong> Email address for authentication via magic link (passwordless sign-in).</p>
          <p><strong>Profile Data:</strong> Username, age, weight, gender, fitness goal, and fitness level — provided during onboarding.</p>
          <p><strong>Fitness Data:</strong> Workout logs (exercises, sets, reps, weight), personal bests, habit completions, and streaks.</p>
          <p><strong>Nutrition Data:</strong> Food logs including item names, calories, and macronutrients (protein, carbs, fat).</p>
          <p><strong>Photos:</strong> Images captured via camera for food analysis are sent to our server for processing and are not stored permanently.</p>
          <p><strong>Device Data:</strong> Push notification tokens for sending reminders. We do not collect device identifiers for tracking.</p>
        </Section>

        <Section title="2. How We Use Your Data">
          <p>We use your data exclusively to provide the Arctivate service:</p>
          <ul>
            <li>Authenticate your account</li>
            <li>Display your workout, food, and habit history</li>
            <li>Calculate personal bests and award points</li>
            <li>Power the AI Coach with conversation context</li>
            <li>Show your activity in the social feed (username only)</li>
            <li>Send push notification reminders you opt into</li>
          </ul>
        </Section>

        <Section title="3. Data Sharing">
          <p>We do not sell, rent, or share your personal data with third parties for advertising or marketing.</p>
          <p>We use the following services to operate the app:</p>
          <ul>
            <li><strong>Supabase</strong> — database and authentication (hosted in the US/EU)</li>
            <li><strong>Google Gemini</strong> — AI Coach responses (conversation text only, no personal identifiers)</li>
            <li><strong>Vercel</strong> — API hosting</li>
            <li><strong>Expo</strong> — push notifications and OTA updates</li>
          </ul>
        </Section>

        <Section title="4. Data Retention">
          <p>Your data is retained as long as your account is active. You can delete your account and all associated data at any time from the Profile screen in the app, or by emailing us.</p>
        </Section>

        <Section title="5. Security">
          <p>Authentication tokens are stored using device-level secure storage (iOS Keychain / Android Keystore). All data is transmitted over HTTPS. Database access is controlled by row-level security policies.</p>
        </Section>

        <Section title="6. Your Rights">
          <p>You have the right to access, correct, export, or delete your personal data. Contact us at the email below to exercise these rights.</p>
        </Section>

        <Section title="7. Children">
          <p>Arctivate is not intended for children under 13. We do not knowingly collect data from children under 13.</p>
        </Section>

        <Section title="8. Changes">
          <p>We may update this policy from time to time. We will notify you of significant changes via the app or email.</p>
        </Section>

        <Section title="9. Contact">
          <p>Questions about this policy? Email us at <a href="mailto:privacy@arctivate.app" style={{ color: '#00D4AA' }}>privacy@arctivate.app</a></p>
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
