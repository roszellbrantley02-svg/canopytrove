import { colors } from '../../theme/tokens';

export type PreviewTone = 'default' | 'saved' | 'visited' | 'promotion' | 'neverVisited';
export type PreviewStatusTone = PreviewTone | 'open' | 'closed' | 'checking';

export function getToneStyles(tone: PreviewTone) {
  switch (tone) {
    case 'saved':
      return {
        panelBackgroundColor: '#0F1D17',
        borderColor: 'rgba(0,245,140,0.36)',
        shadowColor: colors.primary,
        primaryGlowColor: 'rgba(0, 245, 140, 0.14)',
        secondaryGlowColor: 'rgba(0, 245, 140, 0.08)',
        blockBorderColor: 'rgba(0,245,140,0.12)',
        blockBackgroundColor: 'rgba(0,245,140,0.06)',
        blockOffsetBackgroundColor: 'rgba(0,245,140,0.04)',
        labelTextColor: colors.primary,
        labelBorderColor: 'rgba(0,245,140,0.22)',
        labelBackgroundColor: 'rgba(0,245,140,0.10)',
      };
    case 'visited':
      return {
        panelBackgroundColor: '#0E1728',
        borderColor: 'rgba(77,156,255,0.34)',
        shadowColor: colors.blue,
        primaryGlowColor: 'rgba(77, 156, 255, 0.14)',
        secondaryGlowColor: 'rgba(0, 215, 255, 0.08)',
        blockBorderColor: 'rgba(77,156,255,0.12)',
        blockBackgroundColor: 'rgba(77,156,255,0.06)',
        blockOffsetBackgroundColor: 'rgba(77,156,255,0.04)',
        labelTextColor: colors.blue,
        labelBorderColor: 'rgba(77,156,255,0.22)',
        labelBackgroundColor: 'rgba(77,156,255,0.10)',
      };
    case 'promotion':
      return {
        panelBackgroundColor: '#261213',
        borderColor: 'rgba(255,122,122,0.38)',
        shadowColor: colors.danger,
        primaryGlowColor: 'rgba(255, 122, 122, 0.16)',
        secondaryGlowColor: 'rgba(255, 122, 122, 0.08)',
        blockBorderColor: 'rgba(255,122,122,0.12)',
        blockBackgroundColor: 'rgba(255,122,122,0.06)',
        blockOffsetBackgroundColor: 'rgba(255,122,122,0.04)',
        labelTextColor: '#FFC0C0',
        labelBorderColor: 'rgba(255,122,122,0.22)',
        labelBackgroundColor: 'rgba(255,122,122,0.10)',
      };
    case 'neverVisited':
      return {
        panelBackgroundColor: '#241D0C',
        borderColor: 'rgba(247,199,101,0.34)',
        shadowColor: colors.warning,
        primaryGlowColor: 'rgba(247, 199, 101, 0.16)',
        secondaryGlowColor: 'rgba(247, 199, 101, 0.08)',
        blockBorderColor: 'rgba(247,199,101,0.14)',
        blockBackgroundColor: 'rgba(247,199,101,0.06)',
        blockOffsetBackgroundColor: 'rgba(247,199,101,0.04)',
        labelTextColor: colors.warning,
        labelBorderColor: 'rgba(247,199,101,0.24)',
        labelBackgroundColor: 'rgba(247,199,101,0.10)',
      };
    case 'default':
    default:
      return {
        panelBackgroundColor: '#151022',
        borderColor: 'rgba(140,59,255,0.34)',
        shadowColor: colors.purple,
        primaryGlowColor: 'rgba(140, 59, 255, 0.14)',
        secondaryGlowColor: 'rgba(0, 215, 255, 0.06)',
        blockBorderColor: 'rgba(140,59,255,0.12)',
        blockBackgroundColor: 'rgba(140,59,255,0.06)',
        blockOffsetBackgroundColor: 'rgba(140,59,255,0.04)',
        labelTextColor: '#C7A8FF',
        labelBorderColor: 'rgba(140,59,255,0.18)',
        labelBackgroundColor: 'rgba(140,59,255,0.08)',
      };
  }
}

export function getStatusToneStyles(tone: PreviewStatusTone) {
  switch (tone) {
    case 'open':
      return {
        backgroundColor: 'rgba(0,245,140,0.12)',
        borderColor: 'rgba(0,245,140,0.24)',
        textColor: colors.primary,
      };
    case 'closed':
      return {
        backgroundColor: 'rgba(255,122,122,0.12)',
        borderColor: 'rgba(255,122,122,0.24)',
        textColor: '#FFC0C0',
      };
    case 'checking':
      return {
        backgroundColor: 'rgba(77,156,255,0.12)',
        borderColor: 'rgba(77,156,255,0.24)',
        textColor: colors.blue,
      };
    case 'saved':
      return {
        backgroundColor: 'rgba(0,245,140,0.12)',
        borderColor: 'rgba(0,245,140,0.24)',
        textColor: colors.primary,
      };
    case 'visited':
      return {
        backgroundColor: 'rgba(77,156,255,0.12)',
        borderColor: 'rgba(77,156,255,0.24)',
        textColor: colors.blue,
      };
    case 'promotion':
      return {
        backgroundColor: 'rgba(255,122,122,0.12)',
        borderColor: 'rgba(255,122,122,0.24)',
        textColor: '#FFC0C0',
      };
    case 'default':
      return {
        backgroundColor: 'rgba(140,59,255,0.12)',
        borderColor: 'rgba(140,59,255,0.24)',
        textColor: '#C7A8FF',
      };
    case 'neverVisited':
    default:
      return {
        backgroundColor: 'rgba(247,199,101,0.14)',
        borderColor: 'rgba(247,199,101,0.26)',
        textColor: colors.warning,
      };
  }
}
