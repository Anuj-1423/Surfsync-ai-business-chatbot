import Link from "next/link";
import { notFound } from "next/navigation";
import SiteChrome from "@/components/SiteChrome";
import knowledge from "@/data/company.json";

export function generateStaticParams() {
  return knowledge.portfolio.publishedClientStories.map((project) => ({ slug: project.url.split("/").at(-1) ?? "" }));
}

export default async function ProjectStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = knowledge.portfolio.publishedClientStories.find((item) => item.url.endsWith(`/${slug}`));
  if (!project) notFound();

  return <SiteChrome><main className="portfolio-page project-story-page">
    <Link className="portfolio-back" href="/projects">← All project stories</Link>
    <div className="eyebrow">SURFSYNC CLIENT STORY</div>
    <h1>{project.name}</h1>
    <p className="project-story-copy">{project.description}</p>
    <aside className="project-story-note">This summary uses the details SurfSync has published. Ask the team for a walkthrough or further project information.</aside>
    <a className="official-project-link" href={knowledge.portfolio.url} target="_blank" rel="noreferrer">View SurfSync’s official project portfolio <span aria-hidden="true">↗</span></a>
    <p className="project-source-note">Source: <a href={knowledge.source.url} target="_blank" rel="noreferrer">SurfSync Infotech</a></p>
  </main></SiteChrome>;
}
