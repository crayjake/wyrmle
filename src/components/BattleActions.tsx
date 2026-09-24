type BattleActionsProps = {
  damage: number
  canAttack: boolean
  canClear: boolean
  onClear: () => void
  onAttack: () => void
}

export default function BattleActions({
  damage,
  canAttack,
  canClear,
  onClear,
  onAttack,
}: BattleActionsProps) {
  return (
    <div className="battle-actions">
      <button
        type="button"
        className="clear-button"
        disabled={!canClear}
        onClick={onClear}
      >
        CLEAR
      </button>

      <button
        type="button"
        className="attack-button"
        disabled={!canAttack}
        onClick={onAttack}
      >
        ATTACK {damage}
      </button>
    </div>
  )
}
