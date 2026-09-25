import type { LetterStrikePreview } from '../game/letterStrike'
import { getStrikeSummary } from './strikeSummary'

type Bonus = {
    label: string
    value?: number
    symbol?: string
}


type AttackInfoProps = {
    word: string
    damage: number
    maxDamage: number
    bonuses?: Bonus[]
    ready?: boolean
    message?: string
    metric?: 'damage' | 'strikes'
    strikePreview?: LetterStrikePreview
    enemyWord?: string
    resolveBefore?: number
}

export default function AttackInfo({
    word,
    damage,
    maxDamage,
    bonuses = [],
    ready = false,
    message,
    metric = 'damage',
    strikePreview,
    enemyWord,
    resolveBefore,
}: AttackInfoProps) {
    const segments = 12
    const filled = maxDamage > 0 ? Math.min(segments, Math.max(0, Math.round((damage / maxDamage) * segments))) : 0
    const strikeMetric = metric === 'strikes'

    if (strikeMetric) {
        const summary = strikePreview && getStrikeSummary(strikePreview, resolveBefore, enemyWord)
        return (
            <div className="attack-info" data-metric="strikes">
                <div className="attack-line">
                    <div className="word">{word || '—'}</div>
                </div>
                <div className="strike-preview" role="status" aria-atomic="true">
                    <div className="bonuses strike-details">
                        {message ? <span className="strike-status">{message}</span> : summary && <>
                            <span className="strike-meaning" data-kind={summary.kind}>{summary.meaning}</span>
                            <span className="strike-bonus-divider" aria-hidden="true">·</span>
                            <span className="strike-total">{summary.hits}</span>
                        </>}
                    </div>
                    {!message && summary && summary.details.length > 0 && <div className="strike-effects">
                        {summary.details.map(detail => <span className="strike-effect" data-kind={detail.kind} key={detail.text}>
                            {detail.text}
                        </span>)}
                    </div>}
                </div>
            </div>
        )
    }

    return (
        <div className="attack-info" data-metric={metric}>
            <div className="helper">
                <div>WORD</div>
                <div role="status">{message || (ready ? "READY TO PLAY" : "BUILD YOUR WORD")}</div>
            </div>

            <div className="attack-line">
                <div className="word">{word || "—"}</div>
                <div className="damage">{damage} DMG</div>
            </div>

            <div className="attack-bar">
                {Array.from({ length: segments }, (_, i) => (
                    <div
                        key={i}
                        className={`attack-segment ${i < filled ? "filled" : ""}`}
                    />
                ))}
            </div>

            <div className="bonuses">
                {bonuses.map((bonus, i) => (
                    <div className="bonus-wrap" key={bonus.label}>
                        {i > 0 && <div className="bonus-divider" />}

                        <div className="bonus">
                            {bonus.symbol && <span className="bonus-symbol">{bonus.symbol}</span>}
                            <span>{bonus.label}</span>
                            {bonus.value !== undefined && (
                                <span className="bonus-value">{bonus.value > 0 ? "+" : ""}{bonus.value}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
