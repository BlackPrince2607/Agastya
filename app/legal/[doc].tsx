import { useLocalSearchParams } from 'expo-router';

import { LegalDocumentScreen } from '@/components/legal/LegalDocumentScreen';
import { LEGAL_IN_APP, type LegalDocId } from '@/constants/legal';

const DOC_IDS = new Set<string>(Object.keys(LEGAL_IN_APP));

function isLegalDocId(value: string | undefined): value is LegalDocId {
  return Boolean(value && DOC_IDS.has(value));
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function LegalDocScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string | string[] }>();
  const id: LegalDocId = isLegalDocId(firstParam(doc)) ? firstParam(doc)! : 'privacy';
  return <LegalDocumentScreen docId={id} />;
}
