import { useEffect, useState } from 'react';
import { renderSVG } from 'uqr';
import type { Profile } from '../state/profile';
import { encodeProfile, shareUrl } from '../state/share';

/** Passer le profil d'un appareil à l'autre : lien ou QR code, sans compte ni serveur. */
export function SyncCard({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    encodeProfile(profile).then((code) => alive && setUrl(shareUrl(code)));
    return () => {
      alive = false;
    };
  }, [open, profile]);

  const copy = async () => {
    if (!url) return;
    try {
      if (navigator.share) await navigator.share({ title: 'Mon logis AniiGuide', url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // Partage annulé.
    }
  };

  if (!open)
    return (
      <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>
        📱 Synchroniser un autre appareil
      </button>
    );

  return (
    <div className="sync">
      <p className="hint">
        Scanne ce QR code avec l'autre appareil (appareil photo de l'iPhone), ou envoie-toi le lien. En l'ouvrant, AniiGuide propose de
        remplacer le logis de cet appareil par celui-ci. Refais-le après chaque changement : rien n'est synchronisé automatiquement.
      </p>
      {url ? (
        <>
          <div className="sync__qr" dangerouslySetInnerHTML={{ __html: renderSVG(url, { border: 2, ecc: 'L' }) }} />
          <div className="row">
            <button type="button" className="btn" onClick={copy}>
              {copied ? 'Lien copié ✓' : 'Partager le lien'}
            </button>
            <button type="button" className="link" onClick={() => setOpen(false)}>
              Fermer
            </button>
          </div>
        </>
      ) : (
        <p className="muted">Préparation…</p>
      )}
    </div>
  );
}
