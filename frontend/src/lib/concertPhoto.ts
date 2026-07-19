// Vraies photos de concert (Unsplash, hotlink stable, vérifiées 200 OK).
// Utilisées comme visuel par défaut pour chaque événement / billet afin de garantir
// une vraie photo partout — même quand l'événement n'a pas d'imageUrl renseignée.
const CONCERT_PHOTOS = [
  '1470229722913-7c0e2dbbafd3', // foule + scène
  '1501281668745-f7f57925c3b4', // concert lumières
  '1493225457124-a3eb161ffa5f', // public bras levés
  '1459749411175-04bf5292ceea', // scène live
  '1516450360452-9312f5e86fc7', // projecteurs
  '1533174072545-7a4b6ad7a6c3', // ambiance festival
  '1524368535928-5b5e00ddc76b', // DJ set
  '1540039155733-5bb30b53aa14', // foule néon
  '1506157786151-b8491531f063', // concert nuit
  '1470225620780-dba8ba36b745', // guitariste live
  '1516280440614-37939bbacd81', // salle de concert
  '1508973379184-7517410fb0bc', // festival scène
] as const;

// Hash déterministe simple → un même id renvoie toujours la même photo.
function pick(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return CONCERT_PHOTOS[Math.abs(h) % CONCERT_PHOTOS.length]!;
}

// URL d'une vraie photo de concert pour un identifiant donné (event / ticket).
// `w` : largeur cible (l'image est recadrée et optimisée côté Unsplash).
export function concertPhoto(seed: string, w = 800): string {
  return `https://images.unsplash.com/photo-${pick(seed)}?auto=format&fit=crop&w=${w}&q=80`;
}

// Visuel d'un événement : sa propre imageUrl si elle existe et n'est pas un
// placeholder (picsum), sinon une vraie photo de concert déterministe.
export function eventPhoto(
  event: { id: string; imageUrl?: string | null },
  w = 800,
): string {
  const url = event.imageUrl;
  if (url && !url.includes('picsum.photos')) return url;
  return concertPhoto(event.id, w);
}

// Télécharge une image et la renvoie en data URI base64 (auto-contenue).
// Nécessaire pour embarquer la photo dans un SVG rasterisé en PNG (le SVG en
// tant qu'<img> bloque les ressources externes). Unsplash autorise le CORS.
export async function imageToDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`image ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error('lecture image'));
    fr.readAsDataURL(blob);
  });
}

// Photo d'événement en data URI : tente l'imageUrl réelle, repli sur une photo
// de concert Unsplash (CORS garanti) si le fetch échoue.
export async function eventPhotoDataUrl(
  event: { id: string; imageUrl?: string | null },
  w = 900,
): Promise<string> {
  try {
    return await imageToDataUrl(eventPhoto(event, w));
  } catch {
    return await imageToDataUrl(concertPhoto(event.id, w));
  }
}
