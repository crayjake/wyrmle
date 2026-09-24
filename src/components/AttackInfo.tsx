type Bonus = {
    label: string
    value: number
    symbol?: string
}


type AttackInfoProps = {
    word: string
    damage: number
    maxDamage: number
    bonuses?: Bonus[]
    ready?: boolean
}

export default function AttackInfo({
    word,
    damage,
    maxDamage,
    bonuses = [],
    ready = false,
}: AttackInfoProps) {
    const segments = 12
    const filled = Math.round((damage / maxDamage) * segments)

    return (
        <div className="attack-info">
            <div className="helper">
                <div>WORD</div>
                <div>{ready ? "READY TO ATTACK" : "BUILD YOUR WORD"}</div>
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
                            <span className="bonus-value">+{bonus.value}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}