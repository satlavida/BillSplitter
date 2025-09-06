import React, { memo } from 'react';
import { Button, Card, Dropdown } from '../ui/components';

// TaxManager: Manage taxes for Default (Global) and each labeled section.
// Props:
// - sections: array of sections [{ id, name }]
// - sectionTaxes: map { [sectionId|'default']: [{ id, label, type, value }] }
// - onAddTax(sectionId|null, { label?, type, value })
// - onUpdateTax(sectionId|null, taxId, { label?, type?, value? })
// - onRemoveTax(sectionId|null, taxId)
const TaxManager = memo(({ sections = [], sectionTaxes = {}, onAddTax, onUpdateTax, onRemoveTax }) => {
  const renderTaxRow = (sectionId, tax) => (
    <li key={tax.id} className="py-2">
      {/* Row 1: Label + Type */}
      <div className="grid grid-cols-12 gap-2 items-center mb-2">
        <input
          type="text"
          value={tax.label || ''}
          onChange={(e) => onUpdateTax(sectionId, tax.id, { label: e.target.value })}
          placeholder="Label (optional)"
          className="col-span-12 sm:col-span-8 md:col-span-9 p-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white rounded-md"
        />
        <div className="col-span-12 sm:col-span-4 md:col-span-3">
          <Dropdown
            options={[{ value: 'flat', label: 'Flat' }, { value: 'percentage', label: 'Percentage' }]}
            value={tax.type}
            onChange={(val) => onUpdateTax(sectionId, tax.id, { type: val })}
            buttonClassName="text-sm"
          />
        </div>
      </div>
      {/* Row 2: Value + Remove */}
      <div className="grid grid-cols-12 gap-2 items-center">
        <input
          type="number"
          step="0.01"
          value={tax.value}
          onChange={(e) => onUpdateTax(sectionId, tax.id, { value: e.target.value })}
          placeholder={tax.type === 'percentage' ? '0.00%' : '0.00'}
          className="col-span-12 sm:col-span-8 md:col-span-9 p-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white rounded-md"
        />
        <div className="col-span-12 sm:col-span-4 md:col-span-3 flex sm:justify-end">
          <Button variant="danger" size="sm" onClick={() => onRemoveTax(sectionId, tax.id)} className="w-full sm:w-auto">Remove</Button>
        </div>
      </div>
    </li>
  );

  const defaultTaxes = sectionTaxes['default'] || [];

  return (
    <Card>
      <h3 className="text-lg font-medium mb-2 text-zinc-800 dark:text-zinc-200 transition-colors">Taxes</h3>
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold mb-1 text-zinc-700 dark:text-zinc-300">Default (Global)</h4>
          <ul className="mb-2 divide-y divide-zinc-100 dark:divide-zinc-700">
            {defaultTaxes.map(t => renderTaxRow(null, t))}
          </ul>
          <Button size="sm" onClick={() => onAddTax(null, { label: '', type: 'flat', value: 0 })}>Add Tax</Button>
        </div>
        {sections.length > 0 && (
          <div className="space-y-3">
            {sections.map(sec => (
              <div key={sec.id}>
                <h4 className="text-sm font-semibold mb-1 text-zinc-700 dark:text-zinc-300">{sec.name || 'Section'}</h4>
                <ul className="mb-2 divide-y divide-zinc-100 dark:divide-zinc-700">
                  {(sectionTaxes[sec.id] || []).map(t => renderTaxRow(sec.id, t))}
                </ul>
                <Button size="sm" onClick={() => onAddTax(sec.id, { label: '', type: 'flat', value: 0 })}>Add Tax</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
});

export default TaxManager;
