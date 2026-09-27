import { useEffect, useState } from 'react';
import type { Profile, ProfileApi } from '../state/profile';
import { decodeProfile } from '../state/share';

/** Ouverture d'un lien de synchro (#import=…) : propose de remplacer le profil de cet appareil. */
export function ImportBanner({ api }: { api: ProfileApi }) {
  const [incoming, setIncoming] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const m = location.hash.match(/^#import=([\w-]+)/);
    if (!m) return;
    history.replaceState(null, '', location.pathname + '#logis');
    decodeProfile(m[1]).then(setIncoming, () => setError('Ce lien de synchronisation est illisible (incomplet ?).'));
  }, []);

  if (error)
    return (
      <div className="banner banner--bad">
        {error}{' '}
        <button type="button" className="link" onClick={() => setError(null)}>
          OK
        </button>
      </div>
    );
  if (!incoming) return null;
  const cur = api.profile;
  return (
    <div className="banner">
      <p>
        <b>Logis reçu</b> : Camping-car niv. {incoming.rv}, {incoming.workers.length} ouvriers. Il remplacera celui de cet appareil (niv. {cur.rv},{' '}
        {cur.workers.length} ouvriers).
      </p>
      <div className="row">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            api.replace(incoming);
            setIncoming(null);
          }}
        >
          Remplacer
        </button>
        <button type="button" className="btn" onClick={() => setIncoming(null)}>
          Garder le mien
        </button>
      </div>
    </div>
  );
}
