import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { PalmLineOverlay, palmLineLegend } from '@/components/report/PalmLineOverlay';
import { GlassCard } from '@/components/ui';
import { hasPalmLineOverlay } from '@/types/palmAnalysis';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { resolveLineGeometry } from '@/utils/palmLandmarks';
import { isLockedPalmLine, palmLineMotifChip } from '@/utils/palmInsights';

type Props = {
  palm: PalmAnalysisDto;
  imageUri: string | null;
  selectedName: string | null;
  onSelectLine: (name: string) => void;
};

const MAJOR_KEYS = ['life_line', 'heart_line', 'head_line'] as const;
const SECONDARY_KEYS = ['fate_line', 'sun_line', 'marriage_line'] as const;

export function PalmLineMap({ palm, imageUri, selectedName, onSelectLine }: Props) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const geometry = useMemo(() => resolveLineGeometry(palm), [palm]);
  const live = hasPalmLineOverlay(palm) && geometry.length >= 2;

  // Data URIs often omit onLoad source size — resolve explicitly so contain letterboxing maps correctly.
  useEffect(() => {
    if (!imageUri) {
      setNatural({ width: 0, height: 0 });
      return;
    }
    let alive = true;
    Image.getSize(
      imageUri,
      (width, height) => {
        if (alive && width > 0 && height > 0) setNatural({ width, height });
      },
      () => {
        /* keep prior / onLoad fallback */
      },
    );
    return () => {
      alive = false;
    };
  }, [imageUri]);

  const legendItems = useMemo(() => {
    const present = new Set(geometry.map((g) => g.name));
    const keys = [...MAJOR_KEYS, ...SECONDARY_KEYS].filter(
      (key) => present.has(key) || isLockedPalmLine(palm, key),
    );
    const all = palmLineLegend();
    return keys.map((key) => all.find((item) => item.key === key)!).filter(Boolean);
  }, [geometry, palm]);

  const aspect =
    natural.width > 0 && natural.height > 0 ? natural.width / natural.height : 3 / 4;
  const sized = natural.width > 0 && natural.height > 0;
  const canDraw = live && box.width > 0 && sized;

  if (!imageUri) {
    return (
      <GlassCard muted className="w-full p-4" innerClassName="gap-2">
        <Text className="font-headline-md text-[16px] text-on-surface">Your palm lines</Text>
        <Text className="font-body text-[13px] leading-5 text-on-surface-variant">
          The scan photo isn’t on this device anymore — line insights below still follow your reading.
        </Text>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="w-full overflow-hidden p-0">
      <View
        className="w-full bg-black/40"
        style={{ aspectRatio: aspect, maxHeight: 420 }}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setBox({ width, height });
        }}>
        <Image
          source={{ uri: imageUri }}
          resizeMode="contain"
          style={{ width: '100%', height: '100%' }}
          onLoad={(e) => {
            const src = e.nativeEvent.source;
            if (src?.width && src?.height && (!natural.width || !natural.height)) {
              setNatural({ width: src.width, height: src.height });
            }
          }}
          accessibilityLabel="Your palm scan with detected lines"
        />
        {canDraw ? (
          <PalmLineOverlay
            geometry={geometry}
            width={box.width}
            height={box.height}
            imageWidth={natural.width}
            imageHeight={natural.height}
            resizeMode="contain"
            selectedName={selectedName}
            selectedMotif={selectedName ? palmLineMotifChip(palm, selectedName) : null}
            onSelectLine={onSelectLine}
          />
        ) : null}
        {!live ? (
          <View className="absolute bottom-3 left-3 right-3 rounded-2xl border border-white/12 bg-black/55 px-3 py-2">
            <Text className="font-body text-[12px] leading-4 text-on-surface/90">
              Line traces weren’t clear enough to overlay — open a card below to read each Rekha.
            </Text>
          </View>
        ) : null}
      </View>
      <View className="flex-row flex-wrap gap-2 px-4 py-3">
        {legendItems.map((item) => {
          const drawn = geometry.some((g) => g.name === item.key);
          return (
            <Pressable
              key={item.key}
              onPress={() => onSelectLine(item.key)}
              accessibilityRole="button"
              accessibilityLabel={item.label}>
              <Text
                className="font-label text-[10px] uppercase tracking-[0.1em]"
                style={{
                  color: item.color,
                  opacity: !drawn ? 0.4 : selectedName && selectedName !== item.key ? 0.45 : 1,
                }}>
                {item.label}
                {!drawn ? ' · insight' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </GlassCard>
  );
}
