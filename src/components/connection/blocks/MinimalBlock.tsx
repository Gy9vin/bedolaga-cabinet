import { getColorGradient } from '@/utils/colorParser';
import { ThemeIcon } from './ThemeIcon';
import type { BlockRendererProps } from './types';

export function MinimalBlock({
  blocks,
  isMobile,
  getLocalizedText,
  getSvgHtml,
  renderBlockButtons,
}: BlockRendererProps) {
  return (
    <div className="space-y-0">
      {blocks.map((block, index) => {
        const gradientStyle = getColorGradient(block.svgIconColor || 'cyan');
        const isLast = index === blocks.length - 1;

        return (
          <div key={index} className={isLast ? '' : 'mb-4 border-b border-dark-700/50 pb-4'}>
            <div className="mb-2 flex items-center gap-3">
              <ThemeIcon
                getSvgHtml={getSvgHtml}
                svgIconKey={block.svgIconKey}
                gradientStyle={gradientStyle}
                isMobile={isMobile}
              />
              <span className="font-medium text-dark-100">{getLocalizedText(block.title)}</span>
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-dark-400">
              {getLocalizedText(block.description)}
            </p>
            {renderBlockButtons(block.buttons, 'subtle')}
          </div>
        );
      })}
    </div>
  );
}
