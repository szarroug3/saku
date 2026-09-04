// Landing page for the Sky gallery: what this area is, and the rules that keep
// it clean. Route: /dev/sky

export default function SkyOverviewPage() {
  return (
    <div className="max-w-[72ch]">
      <Block title="Why it is separate">
        <p>
          The redesign replaces the Home, Planetarium, Lesson, Quiz, Practice and Atlas
          surfaces. Building it inside the current component tree would mean
          picking the new work back out of the old at cutover, so it lives in its
          own tree instead: <Code>src/sky/</Code>.
        </p>
      </Block>

      <Block title="The boundary, enforced by lint">
        <p>
          Sky code may not import from <Code>@/components</Code>,{" "}
          <Code>@/lib</Code> or <Code>@/data</Code>, and the existing app may not
          import from <Code>@/sky</Code>. Both directions are{" "}
          <strong className="text-text">no-restricted-imports</strong> rules in{" "}
          <Code>eslint.config.mjs</Code>, so the boundary cannot rot quietly.
        </p>
        <p>
          If the Sky redesign needs something the app already has, it gets its own copy.
          A three-line helper duplicated is cheaper than a dependency to untangle
          later.
        </p>
      </Block>

      <Block title="The one thing that is shared: colour">
        <p>
          Sky components use the app&apos;s existing CSS tokens (
          <Code>bg-card</Code>, <Code>text-text</Code>, <Code>text-accent</Code>
          …), never raw hex. Those tokens are exactly what we are keeping: they
          carry four themes, the accent variants, and light and dark from one
          semantic set.
        </p>
        <p>
          So the concept palettes from the design artifacts are not used. Layout
          and behaviour are new; colour is Saku&apos;s. Switch themes in settings
          and every page in here should follow.
        </p>
      </Block>

      <Block title="Cutover">
        <p>
          Point the real routes at Sky components, delete the old surface
          trees, drop the lint boundary. No untangling step, because nothing is
          tangled.
        </p>
      </Block>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 first:mt-0">
      <h2 className="text-[15px] font-semibold text-text">{title}</h2>
      <div className="mt-1.5 flex flex-col gap-2 text-sm leading-relaxed text-text-muted">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-panel px-1 py-0.5 text-[12.5px] text-text">
      {children}
    </code>
  );
}
