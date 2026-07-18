// Resources — where to go next. A reading list, not a credits page.
//
// The attributions the licences require live at /about/data and stay there;
// nothing on this page repeats them. Everything here is rendered from
// src/data/resources.ts so the links can be swept by date rather than grepped
// out of JSX. See that file's header for why each one carries `lastVerified`.
//
// A Server Component: it renders constants and has no state.

import { RESOURCE_SECTIONS, type Resource } from "@/data/resources";
import { Card, Hint, Lbl, PageTitle } from "@/components/ui";

export const metadata = { title: "Resources · Kana quiz" };

/** One entry. target=_blank + rel is spelled here, once, so no caller gets it wrong. */
function Entry({ item }: { item: Resource }) {
  return (
    <li className="border-b border-border py-2.5 last:border-0 first:pt-0 last:pb-0">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[13px] font-medium text-accent no-underline"
      >
        {item.name} ↗
      </a>
      <p className="mt-0.5 text-[13px] leading-relaxed text-text-muted">
        {item.blurb}
      </p>
    </li>
  );
}

export default function ResourcesPage() {
  return (
    <>
      <PageTitle
        title="Resources"
        sub="Other people's tools, for the Japanese this app doesn't cover."
      />

      {RESOURCE_SECTIONS.map((section) => (
        <div key={section.id}>
          <Lbl>{section.title}</Lbl>
          <Card>
            <ul className="list-none">
              {section.items.map((item) => (
                <Entry key={item.url} item={item} />
              ))}
            </ul>
          </Card>
        </div>
      ))}

      <Card>
        <Hint>
          Tofugu is where this app&rsquo;s author learned kana, and its
          story-per-shape approach is the one taught here.
        </Hint>
      </Card>
    </>
  );
}
