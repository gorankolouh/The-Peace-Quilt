import { SUBJECT_COLORS, useSubjects } from '../lib/useSubjects';

export function InterestsPicker({ value, onChange }: { value: number[]; onChange: (ids: number[]) => void }) {
  const subjects = useSubjects();
  return (
    <div className="interest-grid">
      {subjects.map((s) => {
        const on = value.includes(s.id);
        const c = SUBJECT_COLORS[s.id];
        return (
          <button type="button" key={s.id} aria-pressed={on} className={'interest' + (on ? ' on' : '')}
            style={on ? { borderColor: c, background: c + '1a' } : undefined}
            onClick={() => onChange(on ? value.filter((x) => x !== s.id) : [...value, s.id])}>
            <span className="row"><i style={{ background: c }} /><b>{s.name}</b></span>
            <span className="note">{s.description}</span>
          </button>
        );
      })}
    </div>
  );
}
