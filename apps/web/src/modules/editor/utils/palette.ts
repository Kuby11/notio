import type { BlockColorPreset } from '@notio/contracts';

/**
 * The colour palette is the single source of names and swatches for the UI
 * (block menu and text bubble menu). The CSS mapping lives in
 * globals.css through data attributes (light and dark themes).
 */
export interface ColorSwatch {
  hex: string;
  name: string;
}

export const COLOR_SWATCHES: Record<BlockColorPreset, ColorSwatch> = {
  gray: { hex: '#787772', name: 'Gray' },
  brown: { hex: '#9F6B53', name: 'Brown' },
  orange: { hex: '#D9730D', name: 'Orange' },
  yellow: { hex: '#CB912F', name: 'Yellow' },
  green: { hex: '#448361', name: 'Green' },
  blue: { hex: '#337EA9', name: 'Blue' },
  purple: { hex: '#9065B0', name: 'Purple' },
  pink: { hex: '#C14C8A', name: 'Pink' },
  red: { hex: '#D44C47', name: 'Red' },
};

export const COLOR_PRESETS = Object.keys(COLOR_SWATCHES) as BlockColorPreset[];
