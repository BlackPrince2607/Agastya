import { useLocalSearchParams, router } from 'expo-router';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { BackButton } from '@/components/layout/BackButton';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { LEGAL_IN_APP, LEGAL_URLS, type LegalDocId } from '@/constants/legal';
import { LEGAL_DOCUMENTS, type LegalBlock } from '@/constants/legalContent';
import { colors } from '@/constants/theme';

const DOC_IDS = new Set<string>(Object.keys(LEGAL_IN_APP));

function isLegalDocId(value: string | undefined): value is LegalDocId {
  return Boolean(value && DOC_IDS.has(value));
}

function BlockView({ block }: { block: LegalBlock }) {
  if (block.type === 'h2') {
    return (
      <Text className="mb-2 mt-7 font-display text-[17px] font-semibold leading-6 text-secondary">
        {block.text}
      </Text>
    );
  }
  if (block.type === 'h3') {
    return (
      <Text className="mb-1.5 mt-4 font-body text-[15px] font-semibold leading-5 text-on-surface">
        {block.text}
      </Text>
    );
  }
  if (block.type === 'bullets') {
    return (
      <View className="mb-3 gap-2 pl-1">
        {block.items.map((item) => (
          <View key={item.slice(0, 48)} className="flex-row gap-2">
            <Text className="font-body text-[14px] leading-5 text-on-surface-variant">•</Text>
            <Text className="flex-1 font-body text-[14px] leading-5 text-on-surface-variant">{item}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <Text className="mb-3 font-body text-[14px] leading-5 text-on-surface-variant">{block.text}</Text>
  );
}

export default function LegalDocScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const id: LegalDocId = isLegalDocId(doc) ? doc : 'privacy';
  const document = LEGAL_DOCUMENTS[id];
  const webUrl = LEGAL_URLS[id];

  return (
    <CosmicScreen>
      <View className="flex-row items-center gap-3 px-5 pb-2 pt-1">
        <BackButton fallback="/(main)/profile" />
        <Text className="flex-1 font-label text-[13px] uppercase tracking-[0.08em] text-on-surface-variant">
          Legal
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}>
        <Text className="font-display text-[28px] font-bold leading-9 text-secondary">{document.title}</Text>
        <Text className="mb-6 mt-1 font-body text-[13px] text-on-surface-variant">{document.meta}</Text>

        {document.blocks.map((block, index) => (
          <BlockView key={`${document.id}-${index}`} block={block} />
        ))}

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open web version"
          onPress={() => {
            void Linking.openURL(webUrl).catch(() => {});
          }}
          className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 active:opacity-80">
          <Text className="font-label text-[12px] uppercase tracking-[0.06em] text-secondary">
            Open on sharvo.online
          </Text>
          <Text className="mt-1 font-body text-[12px] text-on-surface-variant">{webUrl}</Text>
        </Pressable>

        {id !== 'privacy' ? (
          <Pressable onPress={() => router.push('/legal/privacy')} className="mt-4 py-2">
            <Text style={{ color: colors.secondary }} className="font-body text-[13px]">
              View Privacy Policy
            </Text>
          </Pressable>
        ) : null}
        {id !== 'terms' ? (
          <Pressable onPress={() => router.push('/legal/terms')} className="mt-1 py-2">
            <Text style={{ color: colors.secondary }} className="font-body text-[13px]">
              View Terms of Use
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </CosmicScreen>
  );
}
