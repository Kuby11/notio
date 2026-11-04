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
  gray: { hex: '#787772', name: 'Серый' },
  brown: { hex: '#9F6B53', name: 'Коричневый' },
  orange: { hex: '#D9730D', name: 'Оранжевый' },
  yellow: { hex: '#CB912F', name: 'Жёлтый' },
  green: { hex: '#448361', name: 'Зелёный' },
  blue: { hex: '#337EA9', name: 'Синий' },
  purple: { hex: '#9065B0', name: 'Фиолетовый' },
  pink: { hex: '#C14C8A', name: 'Розовый' },
  red: { hex: '#D44C47', name: 'Красный' },
};

export const COLOR_PRESETS = Object.keys(COLOR_SWATCHES) as BlockColorPreset[];
