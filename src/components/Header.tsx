import { CircleHelp, History, Settings } from 'lucide-react'
import type { Ref } from 'react'
import WyrmCharacter from './WyrmCharacter'
import StarRating from './StarRating'
import './Header.css'

type HeaderProps = {
    wyrmDockRef: Ref<HTMLSpanElement>
    titleRef: Ref<HTMLDivElement>
    showWyrm: boolean
    onHelp: () => void
    onHistory: () => void
    onSettings?: () => void
    bestStars?: number
    puzzleDate?: string
}

export default function Header({ wyrmDockRef, titleRef, showWyrm, onHelp, onHistory, onSettings, bestStars, puzzleDate }: HeaderProps) {
    return (
        <header className="header">
            <div className="header-brand">
            <div className="title" ref={titleRef}>
                WYRMLE
                <span ref={wyrmDockRef} className="wyrm-dock" aria-hidden="true">
                    {showWyrm && <WyrmCharacter idle />}
                </span>
            </div>
            {puzzleDate && <time className="header-date" dateTime={puzzleDate}>
                {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
                    .format(new Date(`${puzzleDate}T00:00:00Z`))}
            </time>}
            </div>

            {bestStars !== undefined && <div className="header-best">
                <span aria-hidden="true">Best</span>
                <StarRating stars={bestStars} label={bestStars ? `Best: ${bestStars} of 3 stars` : 'Best: not solved yet'} />
            </div>}

            <nav className="header-actions">
            <button className="icon-button" aria-label="Help" onClick={onHelp}>
                <CircleHelp size={20} />
            </button>

            <button className="icon-button" aria-label="Log" title="Turn log" onClick={onHistory}>
                <History size={20} />
            </button>

            {onSettings && <button className="icon-button" aria-label="Settings" onClick={onSettings}>
                <Settings size={20} />
            </button>}
            </nav>
        </header>
    )
}
