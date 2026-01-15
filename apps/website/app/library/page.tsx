import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "August's Library",
  description:
    "A collection of experiments and improvements in software development by August and other companies.",
};

const articles = [
  {
    title: "Scaling Long-Running Autonomous Coding",
    source: "Cursor",
    date: "Jan 14, 2026",
    url: "https://cursor.com/blog/scaling-agents",
    summary:
      "Cursor ran hundreds of AI agents in parallel for weeks, completing projects like a 1M+ line web browser and a Solid-to-React migration.",
  },
  {
    title: "Why We Built Our Background Agent",
    source: "Ramp",
    date: "Jan 12, 2026",
    url: "https://builders.ramp.com/post/why-we-built-our-background-agent",
    summary:
      "Ramp built Inspect, an internal coding agent that writes code and verifies its work through integrated tools. ~30% of their PRs are now written by it.",
  },
];

export default function Library() {
  return (
    <div className="flex flex-col">
      <section className="w-full max-w-[840px] mx-auto px-10 sm:px-8 lg:px-12 py-16 sm:py-24">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-foreground">
              Library
            </h1>
            <p className="text-muted-foreground">
              A small space where we collect experiments and improvements made
              in software development by us and other talented companies in the
              space.
            </p>
          </div>
          <div className="flex flex-col gap-6">
            {articles.map((article) => (
              <Link
                key={article.url}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col gap-2 p-4 -mx-4 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
                  <span className="text-foreground font-medium flex items-start justify-between sm:justify-start gap-2 w-full sm:w-auto">
                    <span>{article.title}</span>
                    <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </span>
                  <span className="text-sm text-muted-foreground shrink-0">
                    {article.date}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {article.source}
                </span>
                <p className="text-muted-foreground">{article.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
