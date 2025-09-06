Title: Multi-tax per Section schema and behavior
Date: 2025-09-06

Summary
- Introduces multi-tax support per section (including Default) with Flat and Percentage types.
- Removes per-section tax input from Sections manager UI; taxes are now managed in a central Taxes manager on the Items step.
- Maintains backward compatibility with legacy single-value `taxAmount` on sections and `taxAmount` (global) at root.

JSON Schema Changes

Previous (legacy):
```
{
  sections: [
    { id, name, taxAmount, paidByPersonId }
  ],
  taxAmount: number // global default section tax
}
```

New (additions):
```
{
  // Map of taxes per section; key is section id or 'default' for unlabeled section
  sectionTaxes: {
    [sectionIdOrDefault: string]: [
      {
        id: string,
        label: string,              // optional display label
        type: 'flat' | 'percentage',
        value: number               // flat currency amount or percentage (0-100)
      }
    ]
  }
}
```

Notes
- For backward compatibility, `sections[].taxAmount` and root `taxAmount` remain in the store. When `sectionTaxes` entries exist for a section, they take precedence. Otherwise, legacy single-value taxes are used.
- Default (global) taxes are stored under key `'default'` in `sectionTaxes`.

Computation Rules
- Section subtotal = sum of item subtotals within that section (after discounts).
- Section tax total = sum of:
  - flat taxes (direct amount), and
  - percentage taxes computed as `sectionSubtotal * (value/100)`.
- Tax distribution to people is proportional to each person's share of the section subtotal.
- Default (global) taxes apply only when the default section has items.

UI / API Implications
- Items Input now shows a Taxes manager listing taxes for Default and for each labeled section. Users can add multiple taxes per section and choose Flat or Percentage modes.
- Sections manager manages only section names and deletion.
- BillTotalsSummary on the Items step shows a Taxes Applied breakdown with Global (Default) tax listed last.

Migration
- Store persistence version bumped to 4. Existing persisted data is migrated to include an empty `sectionTaxes` map. Legacy fields remain to preserve behavior for older bills.

