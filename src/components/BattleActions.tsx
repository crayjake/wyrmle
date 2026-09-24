export type BattlePrimaryLabel = 'ATTACK' | 'CONTINUE' | 'BEGIN' | 'VIEW RESULT'

type BattleActionsProps = {
  damage?: number
  primaryLabel?: BattlePrimaryLabel
  canAttack: boolean
  canClear: boolean
  onClear: () => void
  onAttack: () => void
}

export default function BattleActions({
  damage,
  primaryLabel = 'ATTACK',
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
        {primaryLabel}{primaryLabel === 'ATTACK' && damage !== undefined ? ` ${damage}` : ''}
      </button>
    </div>
  )
}
