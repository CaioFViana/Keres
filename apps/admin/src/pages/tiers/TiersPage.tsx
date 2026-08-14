import { useEffect, useState } from 'react';
import type { Tier, TierCreateInput } from '@keres/shared';
import { TierApiService } from '../../api/TierApiService';

const emptyForm: TierCreateInput = {
  name: '',
  isDefault: false,
  maxStories: null,
  maxEntitiesPerStory: null,
  maxEntitiesTotal: null,
  maxStorageBytesPerStory: null,
  maxStorageBytesTotal: null,
};

function toNumberOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function TiersPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TierCreateInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    TierApiService.list(true)
      .then(setTiers)
      .catch((err) => setError(err.message));
  };
  useEffect(load, []);

  const startEdit = (tier: Tier) => {
    setEditingId(tier.id);
    setForm({
      name: tier.name,
      isDefault: tier.isDefault,
      maxStories: tier.maxStories,
      maxEntitiesPerStory: tier.maxEntitiesPerStory,
      maxEntitiesTotal: tier.maxEntitiesTotal,
      maxStorageBytesPerStory: tier.maxStorageBytesPerStory,
      maxStorageBytesTotal: tier.maxStorageBytesTotal,
    });
  };

  const startNew = () => {
    setEditingId('new');
    setForm(emptyForm);
  };

  const cancel = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingId === 'new') {
        await TierApiService.create(form);
      } else if (editingId) {
        await TierApiService.update(editingId, form);
      }
      cancel();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    }
  };

  const remove = async (tier: Tier) => {
    if (!confirm(`Delete tier "${tier.name}"?`)) return;
    try {
      await TierApiService.softDelete(tier.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const limitInput = (label: string, key: keyof TierCreateInput) => (
    <label>
      {label} <span className="hint">(blank = unlimited)</span>
      <input
        type="number"
        value={form[key] === null || form[key] === undefined ? '' : String(form[key])}
        onChange={(e) => setForm((f) => ({ ...f, [key]: toNumberOrNull(e.target.value) }))}
      />
    </label>
  );

  return (
    <div>
      <div className="page-header">
        <h1>Tiers</h1>
        <button onClick={startNew}>New tier</button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {editingId && (
        <form className="form-card" onSubmit={save}>
          <h3>{editingId === 'new' ? 'New tier' : 'Edit tier'}</h3>
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          {limitInput('Max stories', 'maxStories')}
          {limitInput('Max entities per story', 'maxEntitiesPerStory')}
          {limitInput('Max entities total', 'maxEntitiesTotal')}
          {limitInput('Max storage bytes per story', 'maxStorageBytesPerStory')}
          {limitInput('Max storage bytes total', 'maxStorageBytesTotal')}
          <div className="form-actions">
            <button type="submit">Save</button>
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Max stories</th>
            <th>Max entities/story</th>
            <th>Max entities total</th>
            <th>Max storage/story</th>
            <th>Max storage total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t) => (
            <tr key={t.id} className={t.isDeleted ? 'row-deleted' : ''}>
              <td>{t.name}</td>
              <td>{t.maxStories ?? '∞'}</td>
              <td>{t.maxEntitiesPerStory ?? '∞'}</td>
              <td>{t.maxEntitiesTotal ?? '∞'}</td>
              <td>{t.maxStorageBytesPerStory ?? '∞'}</td>
              <td>{t.maxStorageBytesTotal ?? '∞'}</td>
              <td>
                {!t.isDeleted && (
                  <>
                    <button onClick={() => startEdit(t)}>Edit</button>
                    <button onClick={() => remove(t)}>Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
