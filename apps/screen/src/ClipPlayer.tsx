import { useEffect, useRef, useState } from 'react';
import { CLIP_MS, type Clip } from './clips.ts';

/** Safety net if a clip never fires `ended`. */
const CLIP_MAX_MS = CLIP_MS + 1500;
/** Margin kept before the phase ends so a clip is never cut. */
const END_MARGIN_MS = 500;
const LEAVE_MS = 600;

/**
 * Full-screen muted clips played one after the other, with the figure written
 * over the footage. Stops early when the next clip would not finish before
 * `endsAt` (null = no deadline, e.g. paused or ended). `onDone` gets the keys
 * of the clips actually shown, so unplayed ones can wait for the next feedback.
 */
export function ClipPlayer({
  clips,
  endsAt,
  onDone,
}: {
  clips: Clip[];
  endsAt: number | null;
  onDone: (played: string[]) => void;
}) {
  const endsAtRef = useRef(endsAt);
  endsAtRef.current = endsAt;
  const hasTime = () =>
    endsAtRef.current === null || endsAtRef.current - Date.now() >= CLIP_MS + END_MARGIN_MS;

  const [list] = useState(clips);
  const [canStart] = useState(hasTime);
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(!canStart);

  // Reported once, also if the host skips the phase while a clip is playing.
  const reported = useRef(false);
  const playedRef = useRef<string[]>([]);
  playedRef.current = list.slice(0, canStart ? index + 1 : 0).map((c) => c.key);
  const report = () => {
    if (reported.current) return;
    reported.current = true;
    onDone(playedRef.current);
  };
  // Deferred so StrictMode's simulated unmount/remount doesn't count as one.
  const unmountTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(unmountTimer.current);
    return () => {
      unmountTimer.current = setTimeout(report);
    };
  }, []);

  useEffect(() => {
    if (leaving) {
      const timer = setTimeout(report, canStart ? LEAVE_MS : 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(next, CLIP_MAX_MS);
    return () => clearTimeout(timer);
  }, [index, leaving]);

  function next() {
    if (index + 1 < list.length && hasTime()) setIndex(index + 1);
    else setLeaving(true);
  }

  const shown = list[index];
  if (!shown || !canStart) return null;
  const { kickerIcon: KickerIcon, icon: Icon } = shown;
  return (
    <div className={`clip-player clip-${shown.kind}${leaving ? ' leaving' : ''}`}>
      <video
        key={shown.key}
        src={`${import.meta.env.BASE_URL}${shown.video}`}
        autoPlay
        muted
        playsInline
        onEnded={next}
        onError={next}
      />
      {shown.stamp && (
        <div key={`stamp-${shown.key}`} className="clip-stamp">
          {shown.stamp}
        </div>
      )}
      <div key={`caption-${shown.key}`} className="clip-caption">
        <div className="clip-kicker">
          <KickerIcon className="icon" /> {shown.kicker}
        </div>
        <h2>
          {Icon && <Icon className="icon" />} {shown.title}
        </h2>
        <p>{shown.text}</p>
      </div>
    </div>
  );
}
