import { useEffect, useState } from 'react';
import { infoService } from '../services/infoService';
import { isLoopbackOrigin, joinOrigin, voterJoinUrl } from '../utils/sessionRoute';

/**
 * The link a participant's phone should open. `reachable` is false when even
 * the best guess is a loopback address, so the presenter can be warned before
 * a room full of people scans a QR that cannot work.
 */
export function useJoinUrl({ code, pollId }) {
  const [publicUrl, setPublicUrl] = useState(null);

  useEffect(() => {
    let active = true;
    infoService.get()
      .then((info) => { if (active) setPublicUrl(info?.publicUrl || ''); })
      .catch(() => { if (active) setPublicUrl(''); });
    return () => { active = false; };
  }, []);

  const origin = joinOrigin(window.location.origin, publicUrl || '');
  return {
    joinUrl: voterJoinUrl(origin, { code, pollId }),
    host: new URL(origin).host,
    reachable: publicUrl === null || !isLoopbackOrigin(origin),
  };
}
