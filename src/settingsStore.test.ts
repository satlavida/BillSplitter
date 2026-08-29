import useSettingsStore from './settingsStore';

describe('settingsStore — useDetailedQuantitySplit', () => {
  it('defaults to false', () => {
    expect(useSettingsStore.getState().useDetailedQuantitySplit).toBe(false);
  });

  it('can be toggled on and off', () => {
    useSettingsStore.getState().setUseDetailedQuantitySplit(true);
    expect(useSettingsStore.getState().useDetailedQuantitySplit).toBe(true);

    useSettingsStore.getState().setUseDetailedQuantitySplit(false);
    expect(useSettingsStore.getState().useDetailedQuantitySplit).toBe(false);
  });
});
