import type { ReactNode } from "react";

export default function SiteChrome({ children }: { children: ReactNode }) {
  return <>
    <header className="topbar">
      <a className="brand" href="https://surfsyncinfotech.in/" aria-label="SurfSync Infotech website">
        <span className="brand-mark" aria-hidden="true">S</span>
        <span>Surf<span>Sync</span><small>INFOTECH</small></span>
      </a>
      <div className="chrome-context"><span>Digital products &amp; business technology</span><small>SECTOR 73 · NOIDA</small></div>
      <a className="site-link" href="https://surfsyncinfotech.in/" target="_blank" rel="noreferrer">
        Explore SurfSync <span aria-hidden="true">→</span>
      </a>
    </header>
    {children}
    <footer className="page-footer">
      <span>SurfSync Infotech Pvt. Ltd. · Sector 73, Noida</span>
      <div className="page-footer-links"><a href="mailto:info@surfsyncinfotech.in">Contact the team</a><a href="/">Change workspace</a></div>
    </footer>
  </>;
}
