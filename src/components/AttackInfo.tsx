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
}

export default function AttackInfo({
    word,
    damage,
    maxDamage,
    bonuses = [],
    ready = false,
    message,
    metric = 'damage',
}: AttackInfoProps) {
    const segments = 12
    const filled = maxDamage > 0 ? Math.min(segments, Math.max(0, Math.round((damage / maxDamage) * segments))) : 0
    const strikeMetric = metric === 'strikes'
    const unit = strikeMetric ? (damage === 1 ? 'STRIKE' : 'STRIKES') : 'DMG'

    return (
        <div className="attack-info" data-metric={metric}>
            <div className="helper">
                <div>WORD</div>
                <div role="status">{message || (ready ? "READY TO ATTACK" : "BUILD YOUR WORD")}</div>
            </div>

            <div className="attack-line">
                <div className="word">{word || "—"}</div>
                <div className="damage">{damage} {unit}</div>
            </div>

            <div
                className="attack-bar"
                role={strikeMetric ? 'meter' : undefined}
                aria-label={strikeMetric ? 'Current strikes relative to maximum immediate strikes available this turn' : undefined}
                aria-valuemin={strikeMetric ? 0 : undefined}
                aria-valuemax={strikeMetric ? Math.max(0, maxDamage) : undefined}
                aria-valuenow={strikeMetric ? Math.max(0, Math.min(damage, maxDamage)) : undefined}
                aria-valuetext={strikeMetric ? `${damage} ${damage === 1 ? 'strike' : 'strikes'}; maximum ${maxDamage} immediate ${maxDamage === 1 ? 'strike' : 'strikes'} available this turn` : undefined}
            >
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
