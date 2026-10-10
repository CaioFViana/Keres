const mockRef = jest.fn();
const mockUseGuideAnchor = jest.fn((_id: string) => mockRef);

jest.mock('../../src/guides/useGuideAnchor', () => ({
  useGuideAnchor: (id: string) => mockUseGuideAnchor(id),
}));

import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import GuideAnchor from '../../src/guides/GuideAnchor';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GuideAnchor', () => {
  it('registers a screen region under screen:<Screen>:<part>', async () => {
    await render(
      <GuideAnchor screen="Notes" part="list">
        <Text>inside</Text>
      </GuideAnchor>,
    );

    expect(mockUseGuideAnchor).toHaveBeenCalledWith('screen:Notes:list');
  });

  it('registers under a given id as it is', async () => {
    await render(<GuideAnchor id="drawer:main-system:CharactersStack" />);

    expect(mockUseGuideAnchor).toHaveBeenCalledWith('drawer:main-system:CharactersStack');
  });

  it('hands the registering ref to the view it draws', async () => {
    await render(<GuideAnchor screen="Notes" part="list" />);

    expect(mockRef).toHaveBeenCalledWith(expect.anything());
  });

  it('keeps the view from being flattened away, whatever the caller says', async () => {
    const view = await render(
      <GuideAnchor
        screen="Notes"
        part="list"
        testID="anchor"
        {...({ collapsable: true } as object)}
      />,
    );

    expect(view.getByTestId('anchor').props.collapsable).toBe(false);
  });

  it('passes the style, the test id and the children through', async () => {
    const view = await render(
      <GuideAnchor screen="Notes" part="list" testID="anchor" style={{ flexGrow: 1 }}>
        <Text>inside</Text>
      </GuideAnchor>,
    );

    expect(view.getByTestId('anchor').props.style).toEqual({ flexGrow: 1 });
    expect(view.getByText('inside')).toBeTruthy();
  });

  it('lets go of the anchor when it leaves the screen', async () => {
    const view = await render(<GuideAnchor screen="Notes" part="list" />);

    await view.unmount();

    expect(mockRef.mock.calls.at(-1)?.[0]).toBeNull();
  });
});
