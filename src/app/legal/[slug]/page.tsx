import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  LEGAL_DOCUMENTS,
  LEGAL_SLUGS,
  getLegalDocument,
} from "@/lib/legal-content";

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata(
  props: PageProps<"/legal/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const doc = getLegalDocument(slug);
  if (!doc) return {};
  return {
    title: `${doc.title} · TKimph`,
    description: doc.summary,
  };
}

const OTHER_LINKS: { slug: string; label: string }[] = LEGAL_SLUGS.map(
  (slug) => ({ slug, label: LEGAL_DOCUMENTS[slug].title }),
);

export default async function LegalPage(props: PageProps<"/legal/[slug]">) {
  const { slug } = await props.params;
  const doc = getLegalDocument(slug);
  if (!doc) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>

      <header className="mt-6 border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {doc.title}
        </h1>
        <p className="mt-3 text-base text-muted-foreground">{doc.summary}</p>
        <p className="mt-2 text-sm text-muted-foreground/80">
          Last updated: {doc.lastUpdated}
        </p>
      </header>

      <article className="mt-8 space-y-8">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-semibold tracking-tight">
              {section.heading}
            </h2>
            <div className="mt-3 space-y-3">
              {section.paragraphs.map((paragraph, index) => (
                <p
                  key={index}
                  className="text-[15px] leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </article>

      <nav className="mt-12 flex flex-wrap gap-3 border-t border-border pt-6">
        {OTHER_LINKS.filter((link) => link.slug !== doc.slug).map((link) => (
          <Link
            key={link.slug}
            href={`/legal/${link.slug}`}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
