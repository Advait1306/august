import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Letters - August",
  description: "Updates, guides, and insights about AI agents for teams",
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default function LettersPage() {
  const posts = getAllPosts();

  return (
    <div className="w-full max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12 py-16 sm:py-24">
      <div className="mb-12">
        <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-foreground mb-3">
          Letters
        </h1>
        <p className="text-muted-foreground">
          Updates, guides, and insights about AI agents for teams
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">
            No letters yet. Check back soon.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/letters/${post.slug}`}
              className="group flex flex-col gap-4"
            >
              {/* Cover Image */}
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-border/50 bg-card">
                {post.coverImage ? (
                  <Image
                    src={post.coverImage}
                    alt={post.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary/20 dark:border-primary/30" />
                  </div>
                )}
              </div>

              {/* Post Info */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {post.author && <span>{post.author}</span>}
                  {post.author && post.date && (
                    <span className="text-border">·</span>
                  )}
                  {post.date && (
                    <time dateTime={post.date}>{formatDate(post.date)}</time>
                  )}
                </div>
                <h2 className="text-xl font-medium text-foreground group-hover:text-primary transition-colors duration-200 tracking-tight leading-snug">
                  {post.title}
                </h2>
                {post.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {post.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
