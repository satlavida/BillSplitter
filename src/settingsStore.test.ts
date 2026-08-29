import useSettingsStore from './settingsStore';

describe('settingsStore — showDetailedQuantitySplit', () => {
  it('defaults to false', () => {
    expect(useSettingsStore.getState().showDetailedQuantitySplit).toBe(false);
  });

  it('can be toggled on and off', () => {
    useSettingsStore.getState().setShowDetailedQuantitySplit(true);
    expect(useSettingsStore.getState().showDetailedQuantitySplit).toBe(true);

    useSettingsStore.getState().setShowDetailedQuantitySplit(false);
    expect(useSettingsStore.getState().showDetailedQuantitySplit).toBe(false);
  });
});
