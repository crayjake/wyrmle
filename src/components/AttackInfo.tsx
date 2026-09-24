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
    resolveBefore?: number
    resolveAfter?: number
    recoveryText?: string
    grammarNote?: string
}

export default function AttackInfo({
    word,
    damage,
    maxDamage,
    bonuses = [],
    ready = false,
    message,
    metric = 'damage',
    resolveBefore,
    resolveAfter,
    recoveryText,
    grammarNote,
}: AttackInfoProps) {
    const segments = 12
    const filled = maxDamage > 0 ? Math.min(segments, Math.max(0, Math.round((damage / maxDamage) * segments))) : 0
    const strikeMetric = metric === 'strikes'

    if (strikeMetric) {
        return (
            <div className="attack-info" data-metric="strikes">
                <div className="attack-line">
                    <div className="word">{word || '—'}</div>
                </div>
                <div className="bonuses strike-details" role="status">
                    {message ? <span className="strike-status">{message}</span> : bonuses.map((bonus, index) => (
                        <span className="strike-bonus" data-kind={bonus.label.toLowerCase()} key={bonus.label}>
                            {index > 0 && <span className="strike-bonus-divider" aria-hidden="true">·</span>}
                            {bonus.symbol && <span aria-hidden="true">{bonus.symbol}</span>}
                            <span>{bonus.label}</span>
                            {bonus.value !== undefined && <span>{bonus.value > 0 ? '+' : ''}{bonus.value}</span>}
                        </span>
                    ))}
                </div>
                {resolveBefore !== undefined && resolveAfter !== undefined && <div className="strike-consequence">
                    <span>Resolve {resolveBefore} → {resolveAfter}</span>
                    {recoveryText && <span className="regen-warning"> · {recoveryText}</span>}
                    {grammarNote && <span title="Word-type bonuses apply only when shown. Unlisted or ambiguous word types receive no grammar bonus."> · {grammarNote}</span>}
                </div>}
            </div>
        )
    }

    return (
        <div className="attack-info" data-metric={metric}>
            <div className="helper">
                <div>WORD</div>
                <div role="status">{message || (ready ? "READY TO ATTACK" : "BUILD YOUR WORD")}</div>
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
