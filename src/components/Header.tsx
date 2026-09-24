import { CircleHelp, History, Settings } from 'lucide-react'
import type { Ref } from 'react'
import WyrmCharacter from './WyrmCharacter'
import './Header.css'

type HeaderProps = {
    wyrmDockRef: Ref<HTMLSpanElement>
    titleRef: Ref<HTMLDivElement>
    showWyrm: boolean
    onHelp: () => void
    onHistory: () => void
    onSettings?: () => void
}

export default function Header({ wyrmDockRef, titleRef, showWyrm, onHelp, onHistory, onSettings }: HeaderProps) {
    return (
        <header className="header">
            <div className="title" ref={titleRef}>
                WYRMLE
                <span ref={wyrmDockRef} className="wyrm-dock" aria-hidden="true">
                    {showWyrm && <WyrmCharacter idle />}
                </span>
            </div>

            <nav className="header-actions">
            <button className="icon-button" aria-label="Help" onClick={onHelp}>
                <CircleHelp size={20} />
            </button>

            <button className="icon-button" aria-label="History and statistics" onClick={onHistory}>
                <History size={20} />
            </button>

            {onSettings && <button className="icon-button" aria-label="Development tools" onClick={onSettings}>
                <Settings size={20} />
            </button>}
            </nav>
        </header>
    )
}
