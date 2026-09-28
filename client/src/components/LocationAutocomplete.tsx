import { useEffect, useId, useRef, useState } from 'react';

export interface LocationOption { id: string; label: string; detail?: string }
interface Props {
  label: string; value: string; options: LocationOption[]; open: boolean; hint?: string; disabled?: boolean;
  onChange: (value: string) => void; onSelect: (option: LocationOption) => void; onOpen: (open: boolean) => void;
}
export default function LocationAutocomplete({ label, value, options, open, hint, disabled, onChange, onSelect, onOpen }: Props) {
  const id = useId();
  const [activeId, setActiveId] = useState('');
  const activeIndex = options.findIndex(option => option.id === activeId);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (open && activeIndex >= 0) list.current?.children[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, open]);
  function select(option: LocationOption) { onSelect(option); setActiveId(''); onOpen(false); }
  return <div className="location-autocomplete">
    <label htmlFor={id}>{label}</label>
    <div className="location-autocomplete__input">
    <input id={id} role="combobox" type="text" autoComplete="off" value={value} placeholder={label} disabled={disabled}
      aria-autocomplete="list" aria-expanded={open && options.length > 0} aria-controls={`${id}-list`}
      aria-describedby={hint ? `${id}-hint` : undefined}
      aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeId}` : undefined}
      onFocus={() => onOpen(true)} onBlur={() => { onOpen(false); setActiveId(''); }}
      onChange={event => { setActiveId(''); onChange(event.target.value); onOpen(true); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onOpen(false); setActiveId(''); }
        else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); onOpen(true);
          if (options.length) {
            const next = !open || activeIndex < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1) : (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
            setActiveId(options[next].id);
          }
        } else if (event.key === 'Enter' && open && activeIndex >= 0) { event.preventDefault(); select(options[activeIndex]); }
      }} />
    {open && options.length > 0 && <ul id={`${id}-list`} ref={list} role="listbox" aria-label={label} className="location-options">
      {options.map(option => <li id={`${id}-option-${option.id}`} key={option.id} role="option" aria-label={option.detail ? `${option.label}, ${option.detail}` : option.label} aria-selected={activeId === option.id}
        onPointerDown={event => event.preventDefault()} onClick={() => select(option)} onPointerMove={() => setActiveId(option.id)}>
        <span>{option.label}</span>{option.detail && <small>{option.detail}</small>}
      </li>)}
    </ul>}
    </div>
    {hint && <small id={`${id}-hint`} className="location-hint" aria-live="polite">{hint}</small>}
  </div>;
}
