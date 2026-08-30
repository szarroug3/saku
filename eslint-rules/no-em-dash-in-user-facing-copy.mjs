// SAK-235: SAK-84 removed em dashes from user-facing copy by hand, once. New
// instances kept appearing afterward (see SAK-235's ticket body for the exact
// lines and dates) because nothing enforced the house style automatically.
// This rule is that enforcement: it flags the em dash character (—) inside
// string literals, template literals, and JSX text, wherever this rule is
// wired up in eslint.config.mjs.
//
// It deliberately does NOT look at comments — `//` and `/* */` comments are
// not part of the AST this rule walks, so engineering notes stay unaffected
// with no extra work.
//
// It DOES need one explicit escape hatch: some data modules carry a `note`
// (or similarly named) field that is genuine internal engineering commentary
// stored as a string property rather than a `//` comment — grammar/recipes.ts
// is the reference case (see its SAK-84 commit message: "grammar/recipes.ts's
// `note` field ... are an intentional, separate convention"). Those fields are
// never rendered to a learner, so a string value reached ONLY through an
// allowed key name is not reported. Anything else — including a sibling field
// on the very same object — is real user-facing copy and stays covered.

const EM_DASH = "—"; // —

function messageFor(kind) {
  return (
    `Em dash (—) found in ${kind}. House style (SAK-84, enforced by SAK-235) is ` +
    "no em dashes in user-facing copy — rewrite with a period, comma, or colon."
  );
}

/** True if `node`'s nearest reachable object-literal property has a key in
 * `allowedKeys` AND the path from that property to `node` runs through the
 * property's VALUE (never its key) — so `{ note: "a — b" }` is allowed but
 * `{ ["a — b"]: note }` or a sibling `{ note: 1, label: "a — b" }` is not. */
function isInsideAllowedKey(context, node, allowedKeys) {
  const ancestors = context.sourceCode.getAncestors(node);
  let child = node;
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = ancestors[i];
    if (ancestor.type === "Property" && !ancestor.computed && ancestor.value === child) {
      const key = ancestor.key;
      const keyName = key.type === "Identifier" ? key.name : key.type === "Literal" ? key.value : null;
      if (keyName && allowedKeys.has(keyName)) return true;
    }
    child = ancestor;
  }
  return false;
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow the em dash character in user-facing string/template/JSX content (house style; SAK-84, SAK-235).",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedKeys: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      emDash: "{{message}}",
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const allowedKeys = new Set(options.allowedKeys ?? ["note"]);

    return {
      Literal(node) {
        if (typeof node.value !== "string" || !node.value.includes(EM_DASH)) return;
        if (isInsideAllowedKey(context, node, allowedKeys)) return;
        context.report({ node, messageId: "emDash", data: { message: messageFor("a string literal") } });
      },
      TemplateElement(node) {
        const text = node.value.cooked ?? node.value.raw;
        if (!text || !text.includes(EM_DASH)) return;
        if (isInsideAllowedKey(context, node, allowedKeys)) return;
        context.report({ node, messageId: "emDash", data: { message: messageFor("a template literal") } });
      },
      JSXText(node) {
        if (!node.value.includes(EM_DASH)) return;
        context.report({ node, messageId: "emDash", data: { message: messageFor("JSX text") } });
      },
    };
  },
};

export default rule;
