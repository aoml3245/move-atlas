export function matchesExercise(exercise, state) {
  if (state.withImages && !exercise.hasIllustration) return false;
  if (state.region !== 'all' && !exercise.regions.includes(state.region)) return false;
  const muscles = state.includeSecondary ? [...exercise.primaryMuscles, ...exercise.secondaryMuscles] : exercise.primaryMuscles;
  if (state.muscles.length && !state.muscles.some(id => muscles.includes(id))) return false;
  if (state.availableOnly) {
    // Empty equipment means no apparatus. All required items must be available.
    if (exercise.equipment.includes('unknown')) return false;
    if (!exercise.equipment.every(id => state.tools.includes(id))) return false;
  }
  if (state.activity !== 'all' && exercise.activity !== state.activity) return false;
  if (state.onlyFavorites && !state.favorites.includes(exercise.id)) return false;
  if (state.query.trim()) {
    const haystack = [exercise.name, exercise.nameKo, ...exercise.aliases, ...exercise.equipment.map(x => state.labels?.equipment[x] || x), ...exercise.primaryMuscles.map(x => state.labels?.muscles[x] || x)].join(' ').toLocaleLowerCase().normalize('NFKC').replace(/[-_]/g, ' ');
    const terms = state.query.toLocaleLowerCase().normalize('NFKC').replace(/[-_]/g, ' ').trim().split(/\s+/);
    if (!terms.every(term => haystack.includes(term))) return false;
  }
  return true;
}

const CLASSIC = /^(barbell (squat|deadlift|curl)|bench press|dumbbell bench press|pushups|push-up|pullups|pull-up|lat pulldown|plank|bodyweight squat|romanian deadlift)$/i;
export function sortExercises(exercises, sort) {
  const copy = [...exercises];
  copy.sort((a,b) => {
    if (sort === 'sources') return new Set(b.sources.map(s => s.source)).size - new Set(a.sources.map(s => s.source)).size || a.nameKo.localeCompare(b.nameKo, 'ko');
    if (sort === 'classic') return Number(CLASSIC.test(b.name)) - Number(CLASSIC.test(a.name)) || Number(a.needsReview) - Number(b.needsReview) || a.nameKo.localeCompare(b.nameKo, 'ko');
    if (sort === 'english') return a.name.localeCompare(b.name, 'en');
    return a.nameKo.localeCompare(b.nameKo, 'ko');
  });
  return copy;
}
