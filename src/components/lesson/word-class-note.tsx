import type { VocabRow } from "@/data/vocab";
import {
  adjectiveKind,
  ruVerbKind,
  wordClassOf,
} from "@/lib/word-forms";

/**
 * The conjugation-class fact spelling does not reliably provide.
 *
 * A る-ending verb can be either a う- or る-verb. Adjectives are likewise a
 * dictionary classification: い is usually a useful clue, but きれい is a
 * な-adjective and a な-adjective such as しずか has no class ending to inspect.
 * This one note is shared by the stepped word lesson and the Library page so the
 * learner gets the same answer in both places.
 */
export function WordClassNote({
  word,
  className = "",
}: {
  word: VocabRow;
  className?: string;
}) {
  const verb = ruVerbKind(word);
  if (verb) {
    return (
      <p className={`${className} text-[13px] leading-relaxed text-text-muted`}>
        It ends in <span className="font-kana">る</span>,
        {verb === "う-verb" ? " but" : " and"} it is a{" "}
        <span className="font-medium text-text">{verb}</span>:{" "}
        {verb === "う-verb"
          ? "the る stays and the ending changes around it."
          : "the る drops to build the other forms."}
      </p>
    );
  }

  const adjective = adjectiveKind(word);
  if (!adjective) return null;

  const endsInI = word.keb.endsWith("い");
  const irregularI = wordClassOf(word) === "adj-ix";
  return (
    <p className={`${className} text-[13px] leading-relaxed text-text-muted`}>
      {endsInI ? (
        <>
          It ends in <span className="font-kana">い</span>,
          {adjective === "な-adjective" ? " but" : " and"} it is{" "}
          {adjective === "い-adjective" ? "an" : "a"}{" "}
        </>
      ) : (
        <>It is a </>
      )}
      <span className="font-medium text-text">{adjective}</span>:{" "}
      {irregularI
        ? "it is irregular and changes through よ in its other forms."
        : adjective === "い-adjective"
          ? "the final い changes to build its other forms."
          : "it adds な before a noun and uses で to connect descriptions."}
    </p>
  );
}
