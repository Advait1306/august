import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllPostSlugs, getPostBySlug } from "@/lib/blog";
import { ArrowLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: "Post Not Found - August",
    };
  }

  return {
    title: `${post.title} - August Letters`,
    description: post.description,
  };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function LetterPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="w-full max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12 py-16 sm:py-24">
      <div className="max-w-[700px]">
        {/* Back link */}
        <Link
          href="/letters"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          All letters
        </Link>

        <article>
          {/* Cover Image */}
          {post.coverImage && (
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-border/50 mb-10">
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                priority
                className="object-cover"
              />
            </div>
          )}

          <header className="mb-10">
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              {post.author && (
                <>
                  <span className="text-border">·</span>
                  <span>{post.author}</span>
                </>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-foreground leading-tight">
              {post.title}
            </h1>
            {post.description && (
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                {post.description}
              </p>
            )}
          </header>

          <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-medium prose-headings:tracking-tight prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-code:before:content-none prose-code:after:content-none prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm">
            <MDXRemote source={post.content} />
          </div>
        </article>

        <footer className="mt-16 pt-8 border-t border-border/50">
          <Link
            href="/letters"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to all letters
          </Link>
        </footer>
      </div>
    </div>
  );
}
