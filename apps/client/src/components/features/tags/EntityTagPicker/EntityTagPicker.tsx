import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';

interface EntityTagPickerProps {
  tags: readonly { id: string; name: string; color?: string | null }[];
  selectedTagIds: string[];
  onSelectionChange: (tagIds: string[]) => void;
  placeholder: string;
  label: string;
  /** The colour of a tag that has none of its own. */
  defaultColor: string;
}

/** The tags of an entity form: a pill picker over the story's tags, each shown in its own colour. */
export default function EntityTagPicker({
  tags,
  selectedTagIds,
  onSelectionChange,
  placeholder,
  label,
  defaultColor,
}: EntityTagPickerProps) {
  return (
    <MultiSelectPill
      options={tags.map((tag) => ({
        label: tag.name,
        value: tag.id,
        color: tag.color || defaultColor,
      }))}
      selectedValues={selectedTagIds}
      onSelectionChange={onSelectionChange}
      placeholder={placeholder}
      label={label}
    />
  );
}
