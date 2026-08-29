import { generateSplitSummaryText } from './splitSummary';

const people = [
  { id: 'p1', name: 'Lisa', upiId: '' },
  { id: 'p2', name: 'John', upiId: '' },
];

describe('generateSplitSummaryText', () => {
  test('no allocations yet', () => {
    expect(generateSplitSummaryText({ consumedBy: [], splitType: 'equal' }, people)).toBe('Not yet split');
  });

  test('single person gets it all', () => {
    expect(generateSplitSummaryText({ consumedBy: [{ personId: 'p1', value: 1 }], splitType: 'equal' }, people)).toBe('All to Lisa');
  });

  test('fraction split reads "N by Name"', () => {
    expect(
      generateSplitSummaryText(
        {
          consumedBy: [
            { personId: 'p1', value: 3 },
            { personId: 'p2', value: 2 },
          ],
          splitType: 'fraction',
        },
        people
      )
    ).toBe('3 by Lisa and 2 by John');
  });

  test('percentage split reads "N% by Name"', () => {
    expect(
      generateSplitSummaryText(
        {
          consumedBy: [
            { personId: 'p1', value: 60 },
            { personId: 'p2', value: 40 },
          ],
          splitType: 'percentage',
        },
        people
      )
    ).toBe('60% by Lisa and 40% by John');
  });

  test('equal split lists names with "and"', () => {
    expect(
      generateSplitSummaryText(
        {
          consumedBy: [
            { personId: 'p1', value: 1 },
            { personId: 'p2', value: 1 },
          ],
          splitType: 'equal',
        },
        people
      )
    ).toBe('Split equally between Lisa and John');
  });

  test('unknown personId falls back to "Someone"', () => {
    expect(generateSplitSummaryText({ consumedBy: [{ personId: 'ghost', value: 1 }], splitType: 'equal' }, people)).toBe('All to Someone');
  });
});
