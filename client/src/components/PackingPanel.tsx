import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { PackingItem, PackingItemRequest } from "../models/PackingItem";
import { addPackingItem, applyPackingTemplate, deletePackingItem, getPackingItems, updatePackingItem } from "../services/packingServices";

const templates = [
    { key: "essentials", label: "Essentials", icon: "✦" },
    { key: "beach", label: "Beach", icon: "☀" },
    { key: "business", label: "Business", icon: "▣" },
    { key: "hiking", label: "Hiking", icon: "△" }
];

const emptyItem: PackingItemRequest = { name: "", category: "Essentials", quantity: 1, isPacked: false };

function PackingPanel({ tripId, canEdit }: { tripId: number; canEdit: boolean }) {
    const [items, setItems] = useState<PackingItem[]>([]);
    const [draft, setDraft] = useState<PackingItemRequest>(emptyItem);
    const [showForm, setShowForm] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        getPackingItems(tripId)
            .then(data => { if (active) setItems(data); })
            .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : "Failed to load packing list."); })
            .finally(() => { if (active) setIsLoading(false); });
        return () => { active = false; };
    }, [tripId]);

    const groups = useMemo(() => {
        const result = new Map<string, PackingItem[]>();
        for (const item of items) result.set(item.category, [...(result.get(item.category) ?? []), item]);
        return [...result.entries()].sort(([first], [second]) => first.localeCompare(second));
    }, [items]);
    const packedCount = items.filter(item => item.isPacked).length;
    const progress = items.length ? Math.round((packedCount / items.length) * 100) : 0;

    async function addItem(event: FormEvent) {
        event.preventDefault();
        setIsSaving(true);
        setError("");
        try {
            const created = await addPackingItem(tripId, draft);
            setItems(current => [...current, created]);
            setDraft(emptyItem);
            setShowForm(false);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Failed to add packing item.");
        } finally {
            setIsSaving(false);
        }
    }

    async function toggleItem(item: PackingItem) {
        setBusyId(item.id);
        setError("");
        try {
            const updated = await updatePackingItem(tripId, { ...item, isPacked: !item.isPacked });
            setItems(current => current.map(currentItem => currentItem.id === item.id ? updated : currentItem));
        } catch (updateError) {
            setError(updateError instanceof Error ? updateError.message : "Failed to update packing item.");
        } finally {
            setBusyId(null);
        }
    }

    async function removeItem(itemId: number) {
        setBusyId(itemId);
        setError("");
        try {
            await deletePackingItem(tripId, itemId);
            setItems(current => current.filter(item => item.id !== itemId));
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : "Failed to delete packing item.");
        } finally {
            setBusyId(null);
        }
    }

    async function handleTemplate(templateKey: string) {
        setIsSaving(true);
        setError("");
        try {
            setItems(await applyPackingTemplate(tripId, templateKey));
            setShowTemplates(false);
        } catch (templateError) {
            setError(templateError instanceof Error ? templateError.message : "Failed to apply template.");
        } finally {
            setIsSaving(false);
        }
    }

    return <section className="packing-panel">
        <div className="packing-heading">
            <div><span className="eyebrow">Packing checklist</span><h3>Pack with confidence</h3></div>
            {canEdit && <div className="packing-heading__actions"><button className="text-action" onClick={() => setShowTemplates(value => !value)}>Use template</button><button className="text-action" onClick={() => setShowForm(value => !value)}>+ Add item</button></div>}
        </div>

        {items.length > 0 && <div className="packing-progress"><div><span>{packedCount} of {items.length} packed</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>}

        {showTemplates && <div className="template-picker"><span>Start with a list</span><div>{templates.map(template => <button key={template.key} disabled={isSaving} onClick={() => handleTemplate(template.key)}><b>{template.icon}</b>{template.label}</button>)}</div><small>Templates add missing items without removing your existing list.</small></div>}

        {showForm && <form className="packing-form" onSubmit={addItem}><label>Item<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="What do you need?" maxLength={150} required /></label><label>Category<input value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} placeholder="Clothing, documents…" maxLength={80} required /></label><label>Quantity<input type="number" min="1" max="99" value={draft.quantity} onChange={event => setDraft({ ...draft, quantity: Number(event.target.value) })} required /></label><div className="card-actions"><button type="submit" disabled={isSaving}>{isSaving ? "Adding…" : "Add item"}</button><button type="button" className="secondary-action" onClick={() => setShowForm(false)}>Cancel</button></div></form>}

        {error && <p className="alert" role="alert">{error}</p>}
        {isLoading ? <p className="packing-status">Loading your checklist…</p> : items.length === 0 && !showForm && !showTemplates ? <div className="packing-empty"><span>✓</span><p>Your packing list is empty. Add an item or start from a template.</p></div> :
            <div className="packing-groups">{groups.map(([category, categoryItems]) => <section className="packing-group" key={category}><h4>{category}<span>{categoryItems.filter(item => item.isPacked).length}/{categoryItems.length}</span></h4><div>{categoryItems.map(item => <article className={item.isPacked ? "packing-item packing-item--done" : "packing-item"} key={item.id}><label><input type="checkbox" checked={item.isPacked} disabled={!canEdit || busyId === item.id} onChange={() => toggleItem(item)} /><span className="custom-check" aria-hidden="true">✓</span><span>{item.name}</span>{item.quantity > 1 && <small>×{item.quantity}</small>}</label>{canEdit && <button aria-label={`Delete ${item.name}`} disabled={busyId === item.id} onClick={() => removeItem(item.id)}>×</button>}</article>)}</div></section>)}</div>}
    </section>;
}

export default PackingPanel;
