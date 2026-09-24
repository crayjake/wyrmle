type BattleActionsProps = {
  damage: number
  canAttack: boolean
  onClear: () => void
  onAttack: () => void
}

export default function BattleActions({
  damage,
  canAttack,
  onClear,
  onAttack,
}: BattleActionsProps) {
  return (
    <div className="battle-actions">
      <button
        type="button"
        className="clear-button"
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