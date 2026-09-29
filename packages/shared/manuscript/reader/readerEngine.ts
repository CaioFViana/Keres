/**
 * The reading rules of a branching story, as the plain JavaScript the published reader page runs.
 *
 * It is a string, not an import: the reader is one self-contained HTML file (no requests, no
 * bundle), so the engine ships inside it. It reads the same shapes `storySimulation.ts` reads
 * (checks, groups, effects) and must answer exactly as `evaluateSimulatedChoice`,
 * `applySimulationEffects` and `enterSimulatedScene` do - `readerEngine.test.ts` runs both over
 * the same states and compares them, so the two cannot drift apart unnoticed.
 *
 * State is plain data (visits by scene id, inventory as a list of item ids, triggers as a list of
 * names), so a save is just JSON. Every function returns a new state; none mutates its input.
 */
export const READER_ENGINE_SOURCE = `
var KeresEngine = (function () {
  function emptyState() {
    return { visits: {}, inventory: [], triggers: [] };
  }
  function copyState(state) {
    var visits = {};
    for (var id in state.visits) visits[id] = state.visits[id];
    return { visits: visits, inventory: state.inventory.slice(), triggers: state.triggers.slice() };
  }
  function has(list, value) {
    return list.indexOf(value) !== -1;
  }
  function without(list, value) {
    return list.filter(function (entry) { return entry !== value; });
  }
  function matches(check, state) {
    if (check.type === 'sceneCount') {
      return Boolean(check.sceneId) &&
        (state.visits[check.sceneId] || 0) >= (check.minVisits == null ? 1 : check.minVisits);
    }
    if (check.type === 'inventory') {
      return Boolean(check.itemId) &&
        (check.itemPresence === 'lacks' ? !has(state.inventory, check.itemId) : has(state.inventory, check.itemId));
    }
    return Boolean(check.triggerName) &&
      (check.triggerState === 'unset' ? !has(state.triggers, check.triggerName) : has(state.triggers, check.triggerName));
  }
  function passes(check, state) {
    return check.mode === 'block' ? !matches(check, state) : matches(check, state);
  }
  // groups: the choice's groups, each { combinator, checks }. No group at all is an open choice.
  function isAvailable(groups, state) {
    return groups.every(function (group) {
      var results = group.checks.map(function (check) { return passes(check, state); });
      return group.combinator === 'OR'
        ? results.some(function (ok) { return ok; })
        : results.every(function (ok) { return ok; });
    });
  }
  function applyEffects(state, effects) {
    var next = copyState(state);
    effects.forEach(function (effect) {
      if (effect.effectType === 'itemGrant' && effect.itemId && !has(next.inventory, effect.itemId)) next.inventory.push(effect.itemId);
      if (effect.effectType === 'itemTake' && effect.itemId) next.inventory = without(next.inventory, effect.itemId);
      if (effect.effectType === 'triggerSet' && effect.triggerName && !has(next.triggers, effect.triggerName)) next.triggers.push(effect.triggerName);
      if (effect.effectType === 'triggerUnset' && effect.triggerName) next.triggers = without(next.triggers, effect.triggerName);
    });
    return next;
  }
  // The scene's own effects first, then the visit is counted.
  function enterScene(state, sceneId, effects) {
    var next = applyEffects(state, effects);
    next.visits[sceneId] = (next.visits[sceneId] || 0) + 1;
    return next;
  }
  return {
    emptyState: emptyState,
    matches: matches,
    isAvailable: isAvailable,
    applyEffects: applyEffects,
    enterScene: enterScene
  };
})();
`;
