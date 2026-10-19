import CustomAttributeFields, {
  type CustomAttributeValues,
} from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { ComponentProps, Dispatch, SetStateAction } from 'react';

interface EntityCustomAttributeFieldsProps {
  storyId: string;
  fields: ComponentProps<typeof CustomAttributeFields>['fields'];
  values: CustomAttributeValues;
  setValues: Dispatch<SetStateAction<CustomAttributeValues>>;
}

/** The story's custom attributes of an entity form, writing each change into the form's values. */
export default function EntityCustomAttributeFields({
  storyId,
  fields,
  values,
  setValues,
}: EntityCustomAttributeFieldsProps) {
  return (
    <CustomAttributeFields
      storyId={storyId}
      fields={fields}
      values={values}
      onChange={(fieldId, value) => setValues((prev) => ({ ...prev, [fieldId]: value }))}
    />
  );
}
