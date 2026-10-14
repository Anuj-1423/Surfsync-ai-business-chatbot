import Link from "next/link";
import SiteChrome from "@/components/SiteChrome";
import knowledge from "@/data/company.json";

export default function ProjectsPage() {
  return <SiteChrome><main className="portfolio-page">
    <div className="eyebrow">SELECTED WORK</div>
    <h1>Project stories</h1>
    <p className="portfolio-intro">A few examples published by SurfSync. Each story page summarizes the details available from the client testimonial.</p>
    <div className="project-grid">
      {knowledge.portfolio.publishedClientStories.map((project) => <Link className="project-card" href={project.url} key={project.name}>
        <span className="project-card-label">CLIENT STORY</span><h2>{project.name}</h2><p>{project.description}</p><span className="project-card-link">Read project story <span aria-hidden="true">→</span></span>
      </Link>)}
    </div>
    <p className="portfolio-source">See the full portfolio on <a href={knowledge.portfolio.url} target="_blank" rel="noreferrer">SurfSync’s official projects page</a>.</p>
  </main></SiteChrome>;
}
