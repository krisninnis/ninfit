import { useCallback, useEffect, useRef, useState } from 'react';
import wordmark from '../../assets/brand/ninfit-wordmark-dark.svg';
import {
  INTRO_SAFETY_TIMEOUT_MS,
  INTRO_STILL_HOLD_MS,
  INTRO_VIDEO_URL,
  introVoiceover,
} from '../startup/introMedia';

/**
 * The NinFit opening.
 *
 * Five and a half seconds of atmosphere, the real wordmark over the top, and a way
 * out at every moment. It runs once per install and never again.
 *
 * THE RULE THIS COMPONENT IS BUILT AROUND: nobody may ever be stuck here. A splash
 * screen is the worst possible place for a hang, because it is the first thing a new
 * user sees and there is nothing else on screen to explain it. So the exit is wired
 * five separate ways - the video ending, Skip, Escape, a decode/network error, and a
 * hard timeout - and any one of them is enough. The video is treated as decoration
 * that might not arrive, not as a step that must succeed.
 *
 * AUDIO IS NEVER LOAD-BEARING. Browsers block audible autoplay, and the voiceover
 * does not exist yet in any case. Both are handled the same way: try, and if it does
 * not happen, carry on silently and offer a button. The cinematic never waits for
 * sound, and the line is always on screen as text regardless.
 *
 * REDUCED MOTION gets a still card rather than a suppressed video, because the point
 * of the moment is to be welcomed, and that survives without camera movement.
 */

interface StartupCinematicProps {
  onComplete: () => void;
}

const STRAPLINE = 'Move • Grow • Evolve';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function StartupCinematic({ onComplete }: StartupCinematicProps) {
  const reducedMotion = prefersReducedMotion();
  const voiceover = introVoiceover();

  const audioRef = useRef<HTMLAudioElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const finished = useRef(false);
  // Only shown if the browser refused to start the audio. Never shown when there is
  // no recording to play in the first place.
  const [soundBlocked, setSoundBlocked] = useState(false);

  /** Idempotent: whichever exit fires first wins, the rest become no-ops. */
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onComplete();
  }, [onComplete]);

  // The backstop. Covers every failure that produces no event at all - a stalled
  // download, a codec the device will not decode, an autoplay refusal that never
  // fires `ended`. Runs for the still card too, so even that cannot linger.
  useEffect(() => {
    const timer = window.setTimeout(finish, INTRO_SAFETY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [finish]);

  // The still card has no `ended` event to move it along, so it holds for its own
  // beat and then continues. Without this it would sit until the safety timeout.
  useEffect(() => {
    if (!reducedMotion) return;
    const timer = window.setTimeout(finish, INTRO_STILL_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, finish]);

  // Escape leaves, as it does from any overlay.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finish]);

  // Put focus on the only control, so a keyboard or screen-reader user is never
  // hunting for the way out of a full-screen thing that appeared on its own.
  useEffect(() => {
    skipRef.current?.focus();
  }, []);

  // Try the voiceover once. A rejected promise means the browser blocked audible
  // autoplay, which is normal and expected - offer a button rather than insisting.
  useEffect(() => {
    if (!voiceover.available) return;
    const element = audioRef.current;
    if (element === null) return;

    let cancelled = false;
    void element
      .play()
      .then(() => {
        if (!cancelled) setSoundBlocked(false);
      })
      .catch(() => {
        if (!cancelled) setSoundBlocked(true);
      });

    return () => {
      cancelled = true;
      element.pause();
    };
  }, [voiceover.available]);

  const playSound = () => {
    void audioRef.current?.play().then(
      () => setSoundBlocked(false),
      () => setSoundBlocked(false), // Asked twice and refused: stop offering.
    );
  };

  return (
    <div className="startup" data-reduced-motion={reducedMotion ? 'true' : 'false'}>
      <div className="startup__stage">
        {reducedMotion ? (
          // A still, warm panel. No video is requested at all, so this also spares
          // the download for anyone who has asked for less movement.
          <div className="startup__still" aria-hidden="true" />
        ) : (
          <video
            className="startup__video"
            src={INTRO_VIDEO_URL}
            autoPlay
            muted
            playsInline
            preload="auto"
            // Decorative: the branding and the line below carry the meaning.
            aria-hidden="true"
            onEnded={finish}
            // A missing or undecodable file must not hold the door shut.
            onError={finish}
          />
        )}

        {/*
          Branding during the cinematic: none.

          The MP4 carries its own logo end card over its final ~2.4 seconds, so an
          overlaid wordmark meant the logo was on screen from the first frame AND
          again at the end. The clip is left to play exactly as authored - mascot
          reveal, then its own logo - and the app adds nothing on top of it.

          The reduced-motion branch is the exception below: no video plays there, so
          the app has to supply the branding itself or there is nothing to see.
        */}
        {reducedMotion ? (
          <div className="startup__brand">
            {/* The real asset, imported so a rename breaks the build rather than the
                screen. Never redrawn in CSS or set as live text. */}
            <img className="startup__wordmark" src={wordmark} alt="NinFit" />
            <p className="startup__strapline">{STRAPLINE}</p>
          </div>
        ) : null}

        {/*
          The spoken line, shown only when there is speech to caption.

          Not decoration: with audio enabled this is what a deaf or hard-of-hearing
          user reads instead of hearing it. With audio absent - which is the state
          today - there is nothing to caption, so no text appears and the cinematic
          runs clean, which is what the presentation calls for.
        */}
        {voiceover.available ? <p className="startup__line">{voiceover.line}</p> : null}

        <div className="startup__controls">
          {voiceover.available && soundBlocked ? (
            <button type="button" className="btn btn--quiet startup__sound" onClick={playSound}>
              Play sound
            </button>
          ) : null}

          <button
            ref={skipRef}
            type="button"
            className="btn btn--quiet startup__skip"
            onClick={finish}
          >
            Skip
          </button>
        </div>
      </div>

      {voiceover.available ? (
        <audio ref={audioRef} src={voiceover.url} preload="auto" onError={() => setSoundBlocked(true)} />
      ) : null}
    </div>
  );
}
