import { useState } from 'react';
import { t, usePreferences } from '../i18n/preferences';
import './ScenicBackground.css';

export default function ScenicBackground() {
    usePreferences();
    const [paused, setPaused] = useState(false);
    return <>
        <div className={`scenic-background${paused ? ' scenic-background--paused' : ''}`} aria-hidden="true">
            <div className="scenic-background__image" />
            <div className="scenic-background__wash" />
        </div>
        <button className="background-motion" onClick={() => setPaused(value => !value)} aria-label={t(paused ? 'Resume background motion' : 'Pause background motion')}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">{paused ? <path d="M3 1.5 10 6 3 10.5Z" /> : <path d="M2 2h3v8H2zM7 2h3v8H7z" />}</svg>
            <span>{t(paused ? 'Resume scenery' : 'Pause scenery')}</span>
        </button>
    </>;
}
