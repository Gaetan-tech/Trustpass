import { Equalizer } from './AnimatedBackground';
import { concertPhoto } from '../lib/concertPhoto';

interface Props {
  seed: string;
  title: string;
  className?: string;
  compact?: boolean;
  imageUrl?: string | null;
}

// Affiche de concert : vraie photo (imageUrl fournie, sinon photo de concert
// déterministe) + voile encre pour la lisibilité du texte en surimpression.
export function Poster({ seed, title, className = '', compact = false, imageUrl }: Props) {
  const src = imageUrl && !imageUrl.includes('picsum.photos') ? imageUrl : concertPhoto(seed, 1200);
  return (
    <div className={`relative overflow-hidden bg-carbon ${className}`}>
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        onError={(e) => {
          e.currentTarget.src = concertPhoto(seed, 1200);
        }}
      />
      {/* Voile encre : sombre en bas pour le texte, transparent en haut. */}
      <div className="absolute inset-0 bg-gradient-to-t from-carbon/85 via-carbon/25 to-transparent" />
      {!compact && (
        <>
          <Equalizer bars={9} className="absolute bottom-4 left-4 h-10 opacity-90 [&_span]:!bg-white" />
          <p className="absolute bottom-4 right-4 max-w-[60%] text-right text-sm font-bold uppercase tracking-wide text-white/90">
            {title}
          </p>
        </>
      )}
    </div>
  );
}
