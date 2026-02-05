import { getColorGradient } from '@/utils/colorParser';
import { ThemeIcon } from './ThemeIcon';
import type { BlockRendererProps } from './types';

export function CardsBlock({
  blocks,
  isMobile,
  getLocalizedText,
  getSvgHtml,
  renderBlockButtons,
}: BlockRendererProps) {
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        const gradientStyle = getColorGradient(block.svgIconColor || 'cyan');

        return (
          <div
            key={index}
            className="rounded-2xl border border-dark-700/50 bg-dark-800/50 p-4 sm:p-5"
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <ThemeIcon
                getSvgHtml={getSvgHtml}
                svgIconKey={block.svgIconKey}
                gradientStyle={gradientStyle}
                isMobile={isMobile}
              />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-dark-100">{getLocalizedText(block.title)}</h3>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-dark-400">
                  {getLocalizedText(block.description)}
                </p>
                {renderBlockButtons(block.buttons, 'light')}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
