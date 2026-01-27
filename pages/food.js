import Nav from '../components/Nav'

export default function Food() {
  return (
    <div className="min-h-screen flex flex-col pb-20">
        <header className="p-6 flex justify-between items-center border-b border-white/5 bg-arc-bg/90 backdrop-blur sticky top-0 z-10">
            <h1 className="text-xl font-black tracking-tighter italic">NUTRITION</h1>
        </header>
        <main className="p-6 text-center text-arc-muted">
            <p>Coming Soon: Scanner</p>
        </main>
        <Nav />
    </div>
  )
}
