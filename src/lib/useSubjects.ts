import { useEffect, useMemo, useState } from 'react';
import { useSubjectName } from './i18n';
import { getSubjects } from './data';
import type { Subject } from './types';

let cache: Subject[] = [];
export function useSubjects(): Subject[] {
  const [subjects, setSubjects] = useState<Subject[]>(cache);
  useEffect(() => {
    if (cache.length) return;
    getSubjects().then((s) => { cache = s; setSubjects(s); }).catch(() => {});
  }, []);
  const name = useSubjectName();
  return useMemo(() => subjects.map((s) => ({ ...s, name: name(s.id, s.name) })), [subjects, name]);
}

// One accent per subject, used for small chips and dots.
export const SUBJECT_COLORS: Record<number, string> = {
  1: '#7DD3FC', 2: '#C6F432', 3: '#F9A8D4', 4: '#FDBA74', 5: '#FCD34D', 6: '#86EFAC',
  7: '#C4B5FD', 8: '#5EEAD4', 9: '#FCA5A5', 10: '#A3E635', 11: '#F0ABFC', 12: '#93C5FD',
};
