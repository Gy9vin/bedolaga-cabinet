import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { SALES_STATS } from '../../constants/salesStats';
import { CHART_COMMON } from '../../constants/charts';
import { useChartColors } from '../../hooks/useChartColors';

interface ClientAppBarChartProps {
  data: { app: string; count: number }[];
  title: string;
}

const BAR_HEIGHT = 32;
const MIN_HEIGHT = 160;
const CHART_MARGIN = { top: 4, right: 48, left: 0, bottom: 4 };

export function ClientAppBarChart({ data, title }: ClientAppBarChartProps) {
  const { t } = useTranslation();
  const colors = useChartColors();

  const sorted = useMemo(() => [...data].sort((a, b) => b.count - a.count), [data]);

  const chartData = useMemo(() => sorted.map((d) => ({ app: d.app, count: d.count })), [sorted]);

  const height = Math.max(MIN_HEIGHT, chartData.length * BAR_HEIGHT);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-4">
        <h4 className="mb-3 text-sm font-medium text-dark-200">{title}</h4>
        <div
          className="flex items-center justify-center text-sm text-dark-400"
          style={{ height: MIN_HEIGHT }}
        >
          {t('common.noData')}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-4">
      <h4 className="mb-3 text-sm font-medium text-dark-200">{title}</h4>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart layout="vertical" data={chartData} margin={CHART_MARGIN}>
          <XAxis
            type="number"
            tick={{ fill: colors.tick, fontSize: CHART_COMMON.AXIS.TICK_FONT_SIZE }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="app"
            tick={{ fill: colors.tick, fontSize: CHART_COMMON.AXIS.TICK_FONT_SIZE }}
            tickLine={false}
            axisLine={false}
            width={90}
          />
          <Tooltip
            cursor={{ fill: colors.grid, fillOpacity: 0.3 }}
            contentStyle={{
              backgroundColor: colors.tooltipBg,
              border: `1px solid ${colors.tooltipBorder}`,
              borderRadius: CHART_COMMON.TOOLTIP.BORDER_RADIUS,
              fontSize: CHART_COMMON.TOOLTIP.FONT_SIZE,
              color: colors.label,
            }}
            labelStyle={{ color: colors.label }}
            itemStyle={{ color: colors.label }}
            formatter={(value: number | undefined) => [value ?? 0]}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {chartData.map((entry, index) => (
              <Cell
                key={entry.app}
                fill={SALES_STATS.BAR_COLORS[index % SALES_STATS.BAR_COLORS.length]}
              />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              style={{ fill: colors.tick, fontSize: CHART_COMMON.AXIS.TICK_FONT_SIZE }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
