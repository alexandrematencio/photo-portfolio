import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'About',
  description:
    "A. Matencio’s approach — author photography between street, landscape and portrait.",
  path: '/about',
});

export const revalidate = 300;

const BIO = `I’m 🇫🇷🇪🇸🇻🇳, I grew up in the 🇳🇱, and worked in 🇹🇳 🇻🇳 and now in 🇫🇷.

Art Director for 8 years, photographer by way of cinema. When the sun’s up: AD at aaxlo, a digital agency enhanced by AI co-founded with my brother, following a few years running my own design studio (Zalem Industries).

The rest of the time: the streets, the camera, and that drive to capture the exact frame a director would have chosen.

Street photography is my favorite format because it’s the only one where the backdrop refuses to cooperate. You don’t direct anything: you watch, you frame, you shoot.`;

const GEAR_SETS = [
  {
    body: 'Olympus OM-D EM-10 mkIII',
    lenses: `+ Mr.Zuiko 17mm f1.8
+ Mr. Zuiko 45mm f1.8
+ Retropia “Oreo” 25mm locked at f11`,
  },
  {
    body: 'Fujifilm X-PRO 2',
    lenses: `+ Meike MF 35mm f1.4
+ Viltrox “Air” 25mm f1.7`,
  },
];

export default function AboutPage() {
  return (
    <article
      className="max-w-[1107px]"
      style={{ paddingLeft: 32, paddingRight: 32 }}
    >
      <div className="flex flex-col gap-10 md:gap-14">
        <h1 className="text-[48px] md:text-[64px] font-black uppercase tracking-[-0.04em] leading-none pb-2 md:pb-4 text-[var(--color-fg)]">
          ABOUT
        </h1>

        <div className="flex flex-col gap-8">
          <p className="text-[22px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.34] text-[var(--color-fg)] whitespace-pre-line">
            {BIO}
          </p>

          <h2 className="text-[36px] md:text-[48px] font-bold uppercase tracking-[-0.02em] leading-[0.9] text-[var(--color-fg)]">
            GEAR
          </h2>

          <div className="flex flex-col gap-8 pb-4 md:pb-8">
            {GEAR_SETS.map((set) => (
              <div key={set.body} className="flex flex-col">
                <h3 className="text-[22px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.375] text-[var(--color-fg)]">
                  {set.body}
                </h3>
                <p className="text-[17px] md:text-[24px] font-bold tracking-[-0.02em] leading-[1.46] text-[var(--color-fg)] whitespace-pre-line">
                  {set.lenses}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
