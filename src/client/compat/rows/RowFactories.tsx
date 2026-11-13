/** Factory adapters preserve native row presentation for custom browser views. */
import type { FactoryComponentPropsOf } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '../contract/browser.ts'
import { ProjectRowItem, SessionNodeItem } from './Rows.tsx'

/** @param props - native row data and framework-bound dependencies. @returns the native Session row. */
export function SessionRowFactory({ onRenameRequest, requestSessionRename, ...props }: FactoryComponentPropsOf<'betterClassifier.sessionRow'>) {
  return <SessionNodeItem {...props} onRenameRequest={onRenameRequest ?? requestSessionRename} />
}

/** @param props - native group data and framework-bound dependencies. @returns the native Workspace row. */
export function ProjectRowFactory(props: FactoryComponentPropsOf<'betterClassifier.projectRow'>) {
  return <ProjectRowItem {...props} />
}
