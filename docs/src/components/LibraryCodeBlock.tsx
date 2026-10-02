import React, {type ReactNode} from 'react';
import CodeBlock from '@theme/CodeBlock';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {resolveLibraryCode, type DocsCustomFields, type LibraryId} from '../utils/libraryVersions';

type Props = {
  library: LibraryId;
  language: string;
  children: string;
};

export default function LibraryCodeBlock({library, language, children}: Props): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  const {libraryVersions} = siteConfig.customFields as DocsCustomFields;
  return <CodeBlock language={language}>{resolveLibraryCode(children, library, libraryVersions)}</CodeBlock>;
}
