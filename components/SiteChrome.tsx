import type { ReactNode } from "react";

export default function SiteChrome({ children }: { children: ReactNode }) {
  return <>
    <header className="topbar">
      <a className="brand" href="https://surfsyncinfotech.in/" aria-label="SurfSync Infotech website">
        <span className="brand-mark" aria-hidden="true">S</span>
        <span>Surf<span>Sync</span><small>INFOTECH</small></span>
      </a>
      <a className="site-link" href="https://surfsyncinfotech.in/" target="_blank" rel="noreferrer">
        Visit our website <span aria-hidden="true">↗</span>
      </a>
    </header>
    {children}
    <footer className="page-footer">
      <span>SurfSync Infotech Pvt. Ltd. · Sector 73, Noida</span>
      <div className="page-footer-links"><a href="mailto:info@surfsyncinfotech.in">info@surfsyncinfotech.in</a><a href="/">Switch account</a></div>
    </footer>
  </>;
}
