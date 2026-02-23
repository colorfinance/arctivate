import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Watch, Share2, Zap, Handshake, ChevronRight, Check, Star } from 'lucide-react'

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 }
}

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } }
}

// Feature Card Component
const FeatureCard = ({ icon: Icon, title, feature, benefit, quote, delay = 0 }) => (
  <motion.div
    variants={fadeUp}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.5, delay }}
    className="glass-panel rounded-2xl p-6 md:p-8 hover:border-arc-accent/30 transition-all duration-300 group"
  >
    <div className="w-12 h-12 rounded-xl bg-arc-accent/10 flex items-center justify-center mb-4 group-hover:bg-arc-accent/20 transition">
      <Icon className="w-6 h-6 text-arc-accent" />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-arc-muted text-sm mb-3">{feature}</p>
    <p className="text-arc-white text-base mb-4">{benefit}</p>
    <p className="text-arc-accent text-sm italic font-medium">"{quote}"</p>
  </motion.div>
)

// Partner Tier Row
const TierRow = ({ progress, reward }) => (
  <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
    <span className="text-arc-muted">{progress}</span>
    <span className="text-arc-accent font-bold">{reward}</span>
  </div>
)

// Step Component
const Step = ({ number, title, description }) => (
  <motion.div
    variants={fadeUp}
    className="text-center"
  >
    <div className="w-16 h-16 rounded-full bg-accent-gradient text-white text-2xl font-black flex items-center justify-center mx-auto mb-4 shadow-glow-accent">
      {number}
    </div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-arc-muted">{description}</p>
  </motion.div>
)

export default function Landing() {
  return (
    <div className="min-h-screen bg-arc-bg">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-arc-bg/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-black italic tracking-tighter text-white">
            ARCTIVATE
          </Link>
          <Link
            href="/"
            className="bg-accent-gradient text-white px-5 py-2 rounded-full font-bold text-sm hover:opacity-90 transition shadow-glow-accent"
          >
            Start Free
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 pb-32 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-radial from-arc-accent/10 via-transparent to-transparent opacity-50" />
        
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-block mb-6 px-4 py-2 rounded-full bg-arc-accent/10 border border-arc-accent/20"
          >
            <span className="text-arc-accent text-sm font-bold">🚀 Now with Garmin Integration</span>
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
            Your Discipline.<br />
            <span className="text-gradient-accent">Verified.</span>
          </h1>

          <p className="text-xl md:text-2xl text-arc-muted mb-10 max-w-2xl mx-auto">
            Arctivate isn't just another fitness app. It's proof. Sync your wearables, earn real rewards, and let your consistency speak for itself.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="bg-accent-gradient text-white px-8 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition shadow-glow-accent flex items-center justify-center gap-2"
            >
              Start Your Challenge
              <ChevronRight className="w-5 h-5" />
            </Link>
            <a
              href="#features"
              className="bg-arc-surface text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-arc-card transition border border-white/10 flex items-center justify-center"
            >
              See Features
            </a>
          </div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-16 flex flex-wrap justify-center gap-8 md:gap-16"
          >
            {[
              { value: "75", label: "Day Challenge" },
              { value: "10+", label: "Partner Brands" },
              { value: "∞", label: "Excuses Eliminated" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-black text-white">{stat.value}</div>
                <div className="text-arc-muted text-sm">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Problem Section */}
      <section className="py-24 px-6 bg-arc-card">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <h2 className="text-3xl md:text-4xl font-black text-white mb-8">
              The Old Way is <span className="text-arc-accent">Broken</span>
            </h2>
            <p className="text-xl text-arc-muted mb-8">
              You've tried the apps. You've set the goals. But motivation fades because no one's watching—not even you.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-3 gap-6 mt-12"
          >
            {[
              { problem: "Workouts logged manually?", result: "Forgotten." },
              { problem: "Progress tracked in your head?", result: "Lost." },
              { problem: "Accountability?", result: "Non-existent." },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="glass-panel rounded-xl p-6 text-left"
              >
                <p className="text-arc-muted mb-2">{item.problem}</p>
                <p className="text-2xl font-bold text-arc-accent italic">{item.result}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-2xl font-bold text-white mt-12"
          >
            Arctivate changes the game.
          </motion.p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Four Pillars of <span className="text-arc-accent">Proven Discipline</span>
            </h2>
            <p className="text-arc-muted text-lg">Every feature designed to make your effort count.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            <FeatureCard
              icon={Watch}
              title="Smartwatch Ecosystem"
              feature="Full Garmin integration syncs your workouts, heart rate, steps, and recovery metrics automatically."
              benefit="Don't just work out—prove it. Every rep, every run, every recovery session flows straight into your profile. No manual logging. No excuses."
              quote="Turn sweat into data. Turn data into points."
              delay={0}
            />
            <FeatureCard
              icon={Zap}
              title="Automated Consistency Tracking"
              feature="Zero-touch progress monitoring that tracks your streaks and milestones via synced wearable data."
              benefit="Wake up. Train. That's it. Arctivate handles the rest—detecting workouts, logging habits, and keeping your streak alive without you lifting a finger."
              quote="Your discipline runs on autopilot."
              delay={0.1}
            />
            <FeatureCard
              icon={Share2}
              title="In-App Sharing"
              feature="Share daily trackers, progress snapshots, and milestone achievements directly to your social circles or coaches."
              benefit="Accountability amplified. Post your wins, share your streaks, and let your progress do the talking. Your network becomes your team."
              quote="Every share is a commitment. Every view is an accountability partner."
              delay={0.2}
            />
            <FeatureCard
              icon={Handshake}
              title="B2B Collaborations & Rewards"
              feature="An exclusive partner ecosystem that unlocks real-world discounts and perks from fitness, wellness, and recovery brands."
              benefit="Your consistency pays—literally. Hit milestones, earn points, and redeem them for discounts at partner businesses."
              quote="Discipline should be rewarded. Now it is."
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* Partner Spotlight Section */}
      <section className="py-24 px-6 bg-arc-card">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-12"
          >
            <span className="text-arc-accent text-sm font-bold uppercase tracking-wider">Partner Spotlight</span>
            <h2 className="text-3xl md:text-4xl font-black text-white mt-4 mb-4">
              Meet <span className="text-arc-accent">Record Recovery</span>
            </h2>
            <p className="text-arc-muted text-lg">
              Darwin's premier recovery studio—infrared saunas, ice baths, compression therapy, and more.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="glass-panel rounded-2xl p-8 mb-8"
          >
            <h3 className="text-xl font-bold text-white mb-6">Your Progress = Your Reward</h3>
            <TierRow progress="7-Day Streak" reward="10% off recovery session" />
            <TierRow progress="30-Day Streak" reward="Free infrared sauna session" />
            <TierRow progress="75 Hard Complete" reward="VIP Recovery Package" />
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center"
          >
            <p className="text-arc-muted mb-6">
              This isn't a gimmick. It's a value exchange: <span className="text-white font-bold">You bring the discipline. We bring the discounts.</span>
            </p>
            <p className="text-2xl font-bold text-arc-accent italic mb-8">
              "Train hard. Recover smart. Pay less."
            </p>
            <button className="bg-arc-surface text-white px-6 py-3 rounded-xl font-bold hover:bg-arc-bg transition border border-white/10">
              View All Partners →
            </button>
          </motion.div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Built for the <span className="text-arc-accent">5AM Club</span>
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-2 gap-6"
          >
            {[
              {
                quote: "I've tried every tracker. Arctivate is the first one that made me feel like my effort actually counts.",
                author: "Early Access User"
              },
              {
                quote: "The Garmin sync is seamless. I don't think about logging anymore—it just happens.",
                author: "Beta Tester"
              }
            ].map((testimonial, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="glass-panel rounded-2xl p-6"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-arc-accent fill-arc-accent" />
                  ))}
                </div>
                <p className="text-arc-white text-lg mb-4">"{testimonial.quote}"</p>
                <p className="text-arc-muted text-sm">— {testimonial.author}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-6 bg-arc-card">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Three Steps to <span className="text-arc-accent">Verified Discipline</span>
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-3 gap-8"
          >
            <Step
              number="1"
              title="SYNC"
              description="Connect your Garmin or wearable. Arctivate pulls your data automatically."
            />
            <Step
              number="2"
              title="TRAIN"
              description="Complete workouts, maintain habits, hit your daily targets. Points stack automatically."
            />
            <Step
              number="3"
              title="EARN"
              description="Redeem points for real discounts at partner businesses. Share your progress. Build your legacy."
            />
          </motion.div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-32 px-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-radial from-arc-accent/20 via-transparent to-transparent opacity-50" />
        
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="relative z-10 max-w-3xl mx-auto text-center"
        >
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            Your Challenge Starts <span className="text-arc-accent">Now</span>
          </h2>
          <p className="text-xl text-arc-muted mb-4">
            75 days. Zero excuses. Real rewards.
          </p>
          <p className="text-arc-muted mb-10">
            Whether you're chasing a personal best, building unbreakable habits, or just trying to show up every day—Arctivate tracks it all and makes it count.
          </p>

          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-accent-gradient text-white px-10 py-5 rounded-xl font-bold text-xl hover:opacity-90 transition shadow-glow-accent"
          >
            Start Your 75-Day Challenge
            <ChevronRight className="w-6 h-6" />
          </Link>

          <p className="text-arc-muted text-sm mt-6">
            Free to start. No credit card required.
          </p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="text-2xl font-black italic tracking-tighter text-white">ARCTIVATE</span>
            <p className="text-arc-muted text-sm mt-1">Gamify Your Discipline.</p>
          </div>
          <div className="flex gap-6 text-arc-muted text-sm">
            <a href="#" className="hover:text-white transition">Privacy</a>
            <a href="#" className="hover:text-white transition">Terms</a>
            <a href="#" className="hover:text-white transition">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
