import { PortableBody } from '@/components/site/PortableBody';
import { frenchSpaces } from '@/lib/journal/french';
import type { JournalAbout } from '@/lib/journal/articles';
import { EDITORIAL_H2, EDITORIAL_H3 } from '@/lib/site/typography';

/**
 * Les deux étages de « À propos de ce journal » qui suivent le texte
 * principal (2026-11-08) :
 *
 * - l'ENCART de questions, toujours ouvert et cadré : ce qu'un lecteur méfiant
 *   veut savoir avant de lire (pourquoi le russe, ce que fait l'IA). Il ne se
 *   replie pas : une réponse qu'il faut aller chercher n'en est plus une.
 * - les COMPLÉMENTS, repliés : `<details>` natif, comme la liste de la Concept
 *   Map (`MapList`) — clavier, « réduit / développé » annoncé, lisible sans
 *   JavaScript, et le texte replié reste dans le HTML (donc indexé).
 *
 * Marges en style inline : le reset `* { padding: 0 }` écrase les utilities
 * (CLAUDE.md §7.5–7.8). L'écart au-dessus de chaque étage reprend celui d'un
 * H2 du corps (64) pour que l'encart se lise comme une section de plus.
 */
const STAGE_TOP = 64;

export function AboutExtras({ about }: { about: JournalAbout }) {
  const questions = about.questions?.filter((q) => q.question) ?? [];
  const sections = about.sections?.filter((s) => s.title) ?? [];
  return (
    <>
      {about.questionsTitle && questions.length > 0 && (
        <section
          aria-labelledby="about-questions"
          className="max-w-[var(--editorial-measure)] border border-[var(--color-fg)]"
          // Le dernier paragraphe garde sa marge de 24 (inline, imbattable) : le pied du cadre la décompte.
          style={{ marginTop: STAGE_TOP, padding: 'clamp(20px, 4vw, 32px)', paddingBottom: 'max(0px, calc(clamp(20px, 4vw, 32px) - 24px))' }}
        >
          <h2 id="about-questions" className={EDITORIAL_H2} style={{ marginBottom: 24 }}>
            {frenchSpaces(about.questionsTitle)}
          </h2>
          <div className="flex flex-col" style={{ gap: 8 }}>
            {questions.map((q) => (
              <div key={q._key}>
                <h3 className={EDITORIAL_H3} style={{ marginBottom: 8 }}>
                  {frenchSpaces(q.question)}
                </h3>
                <PortableBody value={q.answer ?? undefined} variant="editorial" lead={false} />
              </div>
            ))}
          </div>
        </section>
      )}

      {sections.length > 0 && (
        <section aria-labelledby={about.sectionsTitle ? 'about-sections' : undefined} style={{ marginTop: STAGE_TOP }}>
          {about.sectionsTitle && (
            <h2 id="about-sections" className={EDITORIAL_H2} style={{ marginBottom: 24 }}>
              {frenchSpaces(about.sectionsTitle)}
            </h2>
          )}
          <div className="max-w-[var(--editorial-measure)] border-t border-[var(--color-line)]">
            {sections.map((s) => (
              <details key={s._key} className="group border-b border-[var(--color-line)]">
                <summary
                  className={`${EDITORIAL_H3} flex cursor-pointer list-none items-baseline gap-3 [&::-webkit-details-marker]:hidden`}
                  style={{ paddingBlock: 18 }}
                >
                  <svg
                    aria-hidden
                    width={12}
                    height={12}
                    viewBox="0 0 10 10"
                    className="flex-none self-center transition-[rotate] duration-200 ease-out group-open:rotate-90 motion-reduce:transition-none"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path d="M3 1.5L6.5 5 3 8.5" />
                  </svg>
                  <span className="min-w-0 flex-1">{frenchSpaces(s.title)}</span>
                </summary>
                <div style={{ paddingBottom: 8, paddingLeft: 24 }}>
                  <PortableBody value={s.body ?? undefined} variant="editorial" lead={false} />
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
