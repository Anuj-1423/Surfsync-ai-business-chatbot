import ChatWidget from "@/components/ChatWidget";

export default function HomePage() {
  return (
    <>
      <header className="topbar">
        <a className="brand" href="https://surfsyncinfotech.in/" aria-label="SurfSync Infotech website">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>Surf<span>Sync</span><small>INFOTECH</small></span>
        </a>
        <a className="site-link" href="https://surfsyncinfotech.in/" target="_blank" rel="noreferrer">
          Visit our website <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main className="page-shell">
        <section className="intro" aria-labelledby="page-title">
          <div className="eyebrow"><span className="status-dot" /> LET'S BUILD SOMETHING</div>
          <h1 id="page-title">A smarter way<br />to <span>get started.</span></h1>
          <p>Explore SurfSync's services, products, and published work. Tell us what you're building and we'll help you find a next step.</p>
          <div className="intro-badges">
            <span>AI &amp; automation</span><span>Web &amp; mobile</span><span>Cloud &amp; enterprise</span>
          </div>
          <div className="intro-note">
            <span className="note-icon" aria-hidden="true">✳</span>
            <span><strong>Grounded in SurfSync's website</strong><br />If something isn't listed, we'll be clear about it.</span>
          </div>
          <div className="company-facts">
            <span><b>ISO</b> 9001:2015 certified</span>
            <span><b>4+</b> countries served</span>
          </div>
        </section>
        <ChatWidget />
      </main>

      <footer className="page-footer">
        <span>SurfSync Infotech Pvt. Ltd. · Sector 73, Noida</span>
        <a href="mailto:info@surfsyncinfotech.in">info@surfsyncinfotech.in</a>
      </footer>
    </>
  );
}
