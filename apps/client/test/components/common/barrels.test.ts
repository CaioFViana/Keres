import * as components from '../../../src/components';
import * as common from '../../../src/components/common';
import * as controls from '../../../src/components/common/controls';
import * as display from '../../../src/components/common/display';
import * as feedback from '../../../src/components/common/feedback';
import * as forms from '../../../src/components/common/forms';
import * as inputs from '../../../src/components/common/inputs';
import * as lists from '../../../src/components/common/lists';
import * as modals from '../../../src/components/common/modals';
import * as navigation from '../../../src/components/common/navigation';
import * as layout from '../../../src/components/layout';

describe('component barrels', () => {
  it('keeps the stable screen import surface', () => {
    expect(components.Button).toBeDefined();
    expect(components.TagList).toBeDefined();
    expect(components.FormField).toBeDefined();
    expect(components.ReorderModal).toBeDefined();
    expect(components.HeaderActions).toBeDefined();
    expect(components.ScreenTitle).toBeDefined();
    expect(components.DetailContainer).toBeDefined();
  });

  it('re-exports every common group', () => {
    expect(common.Button).toBe(controls.Button);
    expect(common.TagList).toBe(display.TagList);
    expect(common.ScreenLoading).toBe(feedback.ScreenLoading);
    expect(common.FormField).toBe(forms.FormField);
    expect(common.TextInput).toBe(inputs.TextInput);
    expect(common.GenericListItem).toBe(lists.GenericListItem);
    expect(common.ReorderModal).toBe(modals.ReorderModal);
    expect(common.HeaderActions).toBe(navigation.HeaderActions);
  });

  it('exposes the controls group', () => {
    expect(controls.Button).toBeDefined();
    expect(controls.TriStateToggleButton).toBeDefined();
    expect(controls.ThemedSwitch).toBeDefined();
    expect(controls.LanguageInstallRow).toBeDefined();
    expect(controls.LANGUAGE_INSTALL_CONTROL_SIZE).toBe(50);
  });

  it('exposes the display group', () => {
    expect(display.Avatar).toBeDefined();
    expect(display.CollapsibleCard).toBeDefined();
    expect(display.DetailField).toBeDefined();
    expect(display.EntityMetadata).toBeDefined();
    expect(display.SummaryCard).toBeDefined();
    expect(display.TagList).toBeDefined();
  });

  it('exposes the feedback group', () => {
    expect(feedback.AppAlertHost).toBeDefined();
    expect(feedback.NotificationItem).toBeDefined();
    expect(feedback.NotificationPopup).toBeDefined();
    expect(feedback.ScreenError).toBeDefined();
    expect(feedback.ScreenLoading).toBeDefined();
  });

  it('exposes the forms group', () => {
    expect(forms.CustomAttributeFields).toBeDefined();
    expect(forms.getDefaultCustomAttributeValues).toBeDefined();
    expect(forms.validateRequiredCustomAttributes).toBeDefined();
    expect(forms.CustomAttributeDetailFields).toBeDefined();
    expect(forms.AttributeValueInput).toBeDefined();
    expect(forms.FormContainer).toBeDefined();
    expect(forms.EntityFormContainer).toBeDefined();
    expect(forms.FormField).toBeDefined();
    expect(forms.FormSwitchField).toBeDefined();
  });

  it('exposes the inputs group', () => {
    expect(inputs.ColorPickerInput).toBeDefined();
    expect(inputs.ColorPickerModal).toBeDefined();
    expect(inputs.IconPickerInput).toBeDefined();
    expect(inputs.IconPickerModal).toBeDefined();
    expect(inputs.AVATAR_ICON_OPTIONS.length).toBeGreaterThan(0);
    expect(inputs.MultiSelectPill).toBeDefined();
    expect(inputs.SingleSelectPill).toBeDefined();
    expect(inputs.SuggestionListInput).toBeDefined();
    expect(inputs.SuggestionTextInput).toBeDefined();
    expect(inputs.ThemePickerModal).toBeDefined();
    expect(inputs.TextInput).toBeDefined();
  });

  it('exposes the lists group', () => {
    expect(lists.GenericExpandedListItemWithActions).toBeDefined();
    expect(lists.FavoriteButton).toBeDefined();
    expect(lists.ViewDetailsButton).toBeDefined();
    expect(lists.GenericFilterSortList).toBeDefined();
    expect(lists.GenericListItem).toBeDefined();
    expect(lists.RelatedEntitiesList).toBeDefined();
  });

  it('exposes the modals group', () => {
    expect(modals.AdvancedSearchModal).toBeDefined();
    expect(modals.ReorderModal).toBeDefined();
  });

  it('exposes the navigation group', () => {
    expect(navigation.NavigationBackButton).toBeDefined();
    expect(navigation.NavigationDrawerButton).toBeDefined();
    expect(navigation.HeaderActions).toBeDefined();
  });

  it('exposes the layout group', () => {
    expect(layout.KeyboardAwareScreen).toBeDefined();
    expect(layout.ResponsiveGrid).toBeDefined();
    expect(layout.ResponsiveModal).toBeDefined();
    expect(layout.ScreenContainer).toBeDefined();
    expect(layout.ScreenTitle).toBeDefined();
    expect(layout.DetailContainer).toBeDefined();
    expect(layout.ScreenSection).toBeDefined();
  });
});
