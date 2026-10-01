import type { RichBodyEditorProps } from '../RichBodyEditor/RichBodyEditor';
import { RichBodyEditor } from '../RichBodyEditor/RichBodyEditor';

export type SceneBodyEditorProps = RichBodyEditorProps;

/**
 * The manuscript prose input. A host alias over `RichBodyEditor`: same props,
 * same testIDs, the rich overlay included.
 */
export function SceneBodyEditor(props: SceneBodyEditorProps) {
  return <RichBodyEditor {...props} />;
}
