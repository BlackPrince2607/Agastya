import {
  Image,
  type ImageStyle,
  StyleSheet,
  View,
  type ImageResizeMode,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const CORRECTED_PALM_ART = require('../../assets/images/agastya-palm-five-fingers.png') as ImageSourcePropType;

type DecorativePalmArtProps = {
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  opacity?: number;
  resizeMode?: ImageResizeMode;
};

/** Corrected Stitch-style palm art with all five fingers integrated in the image. */
export function DecorativePalmArt({
  style,
  imageStyle,
  opacity = 1,
  resizeMode = 'contain',
}: DecorativePalmArtProps) {
  return (
    <View pointerEvents="none" style={[styles.root, style]}>
      <Image
        accessibilityIgnoresInvertColors
        source={CORRECTED_PALM_ART}
        resizeMode={resizeMode}
        style={[styles.image, { opacity }, imageStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});
