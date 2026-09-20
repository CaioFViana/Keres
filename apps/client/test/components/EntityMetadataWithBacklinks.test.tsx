import { render } from '@testing-library/react-native';
import EntityMetadataWithBacklinks from '../../src/components/features/mentions/EntityMetadataWithBacklinks';

const mockMetadataProps = { current: null as Record<string, unknown> | null };
const mockBacklinksSectionProps = { current: null as Record<string, unknown> | null };
jest.mock('../../src/components/common/display/EntityMetadata/EntityMetadata', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockMetadataProps.current = props;
      return ReactActual.createElement(View, { testID: 'entity-metadata' });
    },
  };
});
jest.mock('../../src/components/features/mentions/MentionBacklinksSection', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    MentionBacklinksSection: (props: Record<string, unknown>) => {
      mockBacklinksSectionProps.current = props;
      return ReactActual.createElement(View, { testID: 'backlinks-section' });
    },
  };
});

beforeEach(() => {
  mockMetadataProps.current = null;
  mockBacklinksSectionProps.current = null;
});

describe('EntityMetadataWithBacklinks', () => {
  const metadata = {
    version: 3,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-02-01'),
  };

  it('renders the metadata it is given, without the backlink props', async () => {
    const screen = await render(
      <EntityMetadataWithBacklinks {...metadata} entityType="Character" entityId="char-1" />,
    );

    expect(screen.getByTestId('entity-metadata')).toBeTruthy();
    expect(mockMetadataProps.current).toMatchObject(metadata);
    expect(mockMetadataProps.current).not.toHaveProperty('entityType');
    expect(mockMetadataProps.current).not.toHaveProperty('entityId');
  });

  it('shows the backlinks when the entity is identified', async () => {
    const screen = await render(
      <EntityMetadataWithBacklinks {...metadata} entityType="Location" entityId="loc-9" />,
    );

    expect(screen.getByTestId('backlinks-section')).toBeTruthy();
    expect(mockBacklinksSectionProps.current).toEqual({
      entityType: 'Location',
      entityId: 'loc-9',
    });
  });

  it('skips the backlinks when the entity is not identified', async () => {
    const screen = await render(<EntityMetadataWithBacklinks {...metadata} />);

    expect(screen.queryByTestId('backlinks-section')).toBeNull();
    expect(screen.getByTestId('entity-metadata')).toBeTruthy();
  });

  it('skips the backlinks when only half of the identity is there', async () => {
    const screen = await render(
      <EntityMetadataWithBacklinks {...metadata} entityType="Character" />,
    );

    expect(screen.queryByTestId('backlinks-section')).toBeNull();
  });
});
