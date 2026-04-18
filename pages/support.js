import Head from 'next/head'
import Link from 'next/link'

export default function Support() {
  return (
    <>
      <Head>
        <title>Support — Arctivate</title>
        <meta name="description" content="Help, contact, and community safety for the Arctivate app." />
      </Head>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', color: '#E8F0EF', backgroundColor: '#030808', minHeight: '100vh' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Support</h1>
        <p style={{ color: '#5E7D7D', marginBottom: 32 }}>
          We&apos;re a small team and we read every message. Most replies go out within one business day.
        </p>

        <Section title="Contact us">
          <p>
            <strong>General support:</strong>{' '}
            <a href="mailto:support@arctivate.app" style={{ color: '#00D4AA' }}>support@arctivate.app</a>
          </p>
          <p>
            <strong>Privacy &amp; data requests:</strong>{' '}
            <a href="mailto:privacy@arctivate.app" style={{ color: '#00D4AA' }}>privacy@arctivate.app</a>
          </p>
          <p>
            <strong>Report abuse or objectionable content:</strong>{' '}
            <a href="mailto:safety@arctivate.app" style={{ color: '#00D4AA' }}>safety@arctivate.app</a>{' '}
            &mdash; we review all reports within 24 hours.
          </p>
        </Section>

        <Section title="Report objectionable content or abusive users">
          <p>
            In the app, open the Community feed, tap the <strong>&hellip;</strong> menu on any post or message, then choose:
          </p>
          <ul>
            <li><strong>Report</strong> &mdash; hides the content from you immediately and sends it to our moderation queue.</li>
            <li><strong>Block user</strong> &mdash; permanently hides that user&apos;s posts and prevents them from messaging you.</li>
          </ul>
          <p>
            You can also email{' '}
            <a href="mailto:safety@arctivate.app" style={{ color: '#00D4AA' }}>safety@arctivate.app</a>{' '}
            with a screenshot. We act on every valid report within 24 hours by removing the content and, for repeat or serious violations, banning the account.
          </p>
        </Section>

        <Section title="Delete your own posts">
          <p>
            Open the post in the Community feed, tap the <strong>&hellip;</strong> menu, and choose <strong>Delete post</strong>. Deletion is immediate and permanent.
          </p>
        </Section>

        <Section title="Delete your account">
          <p>
            Open the app, go to <strong>Profile</strong>, scroll to the bottom, and tap <strong>Delete Account</strong>. Type <code style={{ background: '#0A1414', padding: '1px 6px', borderRadius: 4 }}>DELETE</code> to confirm. This removes your account and all associated data.
          </p>
          <p>
            If you cannot sign in, email us at{' '}
            <a href="mailto:privacy@arctivate.app" style={{ color: '#00D4AA' }}>privacy@arctivate.app</a>{' '}
            from your account email and we&apos;ll process the deletion manually within 7 days.
          </p>
        </Section>

        <Section title="Frequently asked questions">
          <Question q="I forgot my password.">
            Tap <em>Sign in</em>, then use the same email and a new password combination via <em>Sign up</em> recovery flow &mdash; or email{' '}
            <a href="mailto:support@arctivate.app" style={{ color: '#00D4AA' }}>support@arctivate.app</a>{' '}
            and we&apos;ll send you a reset link.
          </Question>
          <Question q="The voice memo button doesn&apos;t record anything.">
            Arctivate needs microphone access to record voice memos. If you declined the prompt, you can re-enable microphone access for Arctivate from the iOS <em>Settings</em> app under <em>Arctivate &gt; Microphone</em>. The app will continue to work normally without it &mdash; voice memos are optional.
          </Question>
          <Question q="I uploaded a workout but it&apos;s not showing on the feed.">
            Make sure the workout is marked as a personal best or tagged as shareable. Pull down to refresh the feed. If it still doesn&apos;t appear, email us with your username.
          </Question>
          <Question q="How do I cancel a subscription?">
            Arctivate has no paid subscription at this time. If that changes, it will be managed via Apple&apos;s standard <em>Settings &gt; Apple ID &gt; Subscriptions</em> flow.
          </Question>
          <Question q="How do I change my calorie goal or profile photo?">
            Go to <strong>Profile</strong>, tap <strong>Edit</strong> in the top right, and update the fields. Tap <em>Save Changes</em>.
          </Question>
          <Question q="The AI Coach gave me advice that seems wrong.">
            The AI Coach provides general fitness information and is not a substitute for a doctor or qualified trainer. Please consult a healthcare professional for any medical concerns. If a response was offensive or clearly incorrect, email us a screenshot.
          </Question>
        </Section>

        <Section title="Community rules">
          <p>
            Arctivate has <strong>zero tolerance</strong> for hate speech, threats, harassment, sexual content involving minors, or other objectionable content. Violations result in immediate content removal and may result in a permanent ban.
          </p>
          <p>
            See the{' '}
            <Link href="/terms" style={{ color: '#00D4AA' }}>Terms of Service</Link>{' '}
            for the full list of prohibited content.
          </p>
        </Section>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #1a2828', color: '#5E7D7D', fontSize: 13 }}>
          <p>
            Arctivate &middot;{' '}
            <Link href="/privacy" style={{ color: '#94B3B3' }}>Privacy</Link>{' '}
            &middot;{' '}
            <Link href="/terms" style={{ color: '#94B3B3' }}>Terms</Link>
          </p>
        </div>
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
        ul { padding-left: 20px; margin-top: 8px; margin-bottom: 8px; }
        li { margin-bottom: 4px; }
        p { margin-bottom: 10px; }
      `}</style>
    </div>
  )
}

function Question({ q, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ color: '#E8F0EF', fontWeight: 600, marginBottom: 4 }}>{q}</p>
      <p style={{ marginTop: 0 }}>{children}</p>
    </div>
  )
}
