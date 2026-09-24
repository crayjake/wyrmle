import { CircleHelp, History, Settings } from 'lucide-react'


export default function Header() {
    return (
        <header className="header">
            <div className="title">WYRMLE</div>

            <nav className="header-actions">
            <button className="icon-button" aria-label="Help">
                <CircleHelp size={20} />
            </button>

            <button className="icon-button" aria-label="History">
                <History size={20} />
            </button>

            <button className="icon-button" aria-label="Settings">
                <Settings size={20} />
            </button>
            </nav>
        </header>
    )
}