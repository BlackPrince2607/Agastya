import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui';
import { colors } from '@/constants/theme';

type PartnerPalmAddSheetProps = {
  visible: boolean;
  partnerLabel: string;
  busy?: boolean;
  onClose: () => void;
  onScan: () => void;
  onUpload: () => void;
};

export function PartnerPalmAddSheet({
  visible,
  partnerLabel,
  busy,
  onClose,
  onScan,
  onUpload,
}: PartnerPalmAddSheetProps) {
  const showScan = Platform.OS !== 'web';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 items-center justify-center bg-black/80 px-6"
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close">
        <Pressable onPress={(e) => e.stopPropagation?.()} className="w-full max-w-[360px]">
          <View
            className="overflow-hidden rounded-glass border border-white/20 bg-surface-container p-5"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.5,
              shadowRadius: 28,
              elevation: 16,
            }}>
            <LinearGradient
              colors={['rgba(168,85,247,0.14)', 'rgba(15,14,16,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 120 }}
            />

            <View className="gap-5">
              <View className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="font-label text-[11px] uppercase tracking-[0.12em] text-primary">
                    Add palm
                  </Text>
                  <Text className="font-headline text-[22px] leading-7 text-on-surface">
                    {partnerLabel}&apos;s palm
                  </Text>
                  <Text className="font-body text-[14px] leading-5 text-on-surface-variant">
                    Scan live or upload a clear photo of their open palm.
                  </Text>
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  className="h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-surface-high active:opacity-80">
                  <Icon name="close" size={18} color={colors.onSurface} />
                </Pressable>
              </View>

              <View className="gap-3">
                {showScan ? (
                  <PalmAddOption
                    icon="photo_camera"
                    title="Scan palm"
                    subtitle="Use your camera with a live guide"
                    tint="violet"
                    disabled={busy}
                    onPress={onScan}
                  />
                ) : null}
                <PalmAddOption
                  icon="image"
                  title="Upload photo"
                  subtitle={busy ? 'Opening gallery…' : 'Choose from your photo library'}
                  tint="cyan"
                  disabled={busy}
                  onPress={onUpload}
                />
              </View>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PalmAddOption({
  icon,
  title,
  subtitle,
  tint,
  disabled,
  onPress,
}: {
  icon: 'photo_camera' | 'image';
  title: string;
  subtitle: string;
  tint: 'cyan' | 'violet';
  disabled?: boolean;
  onPress: () => void;
}) {
  const accent = tint === 'cyan' ? colors.cyan : colors.purple;
  const border = tint === 'cyan' ? 'border-primary/30' : 'border-purple/35';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      className={`overflow-hidden rounded-glass border ${border} bg-surface-high active:opacity-90`}
      style={{ opacity: disabled ? 0.55 : 1 }}>
      <View className="flex-row items-center gap-4 px-4 py-3.5">
        <View
          className="h-11 w-11 items-center justify-center rounded-full border border-white/15"
          style={{ backgroundColor: `${accent}22` }}>
          <Icon name={icon} size={22} color={accent} />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="font-body-medium text-[16px] text-on-surface">{title}</Text>
          <Text className="font-body text-[13px] leading-5 text-on-surface-variant">{subtitle}</Text>
        </View>
        <Icon name="chevron_right" size={22} color={colors.onSurfaceVariant} />
      </View>
    </Pressable>
  );
}
