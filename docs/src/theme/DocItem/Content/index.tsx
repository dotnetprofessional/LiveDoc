import React, {type ReactNode} from 'react';
import DocItemContent from '@theme-original/DocItem/Content';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import type {Props} from '@theme/DocItem/Content';
import {LibraryVersionContext} from '../../../components/LibraryVersionContext';
import {getLibraryVersion, type DocsCustomFields} from '../../../utils/libraryVersions';

export default function VersionedDocItemContent(props: Props): ReactNode {
  const {metadata} = useDoc();
  const {siteConfig} = useDocusaurusContext();
  const {libraryVersions} = siteConfig.customFields as DocsCustomFields;
  const version = getLibraryVersion(metadata.id, libraryVersions);

  return (
    <LibraryVersionContext.Provider value={version}>
      <DocItemContent {...props} />
    </LibraryVersionContext.Provider>
  );
}
