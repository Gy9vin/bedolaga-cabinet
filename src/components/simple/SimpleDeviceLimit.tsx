import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import SimpleScreen from './SimpleScreen';
import SimpleGroup from './SimpleGroup';
import { Button } from '@/components/primitives/Button/Button';
import { BentoCard } from '@/components/ui/BentoCard';
import { CheckIcon } from '@/components/icons';
import { subscriptionApi } from '../../api/subscription';
import { formatPrice, formatLongDate } from '../../utils/format';

/**
 * Экран «Лимит устройств» простого режима. Степпер меняет device_limit,
 * а не количество отключаемых устройств — это разные величины (см. бриф
 * задачи 4): освобождается «старый лимит − новый», а отключить нужно
 * «подключено − новый лимит», и это бывает 0, если подключённых устройств
 * меньше нового лимита. Экран сам считает и то, и другое — человек выбирает
 * только КАКИЕ устройства отключить, когда выбор вообще нужен.
 *
 * При device_limit === 0 (безлимит) экран недоступен: докупать и уменьшать
 * нечего. На пробной подписке лимит менять нельзя вовсе.
 */
export default function SimpleDeviceLimit() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newLimit, setNewLimit] = useState<number | null>(null);
  const [selectedHwids, setSelectedHwids] = useState<Set<string>>(new Set());

  const { data: subscriptionResponse, isLoading: subLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.getSubscription(),
    retry: false,
  });
  const subscription = subscriptionResponse?.subscription ?? null;
  const oldLimit = subscription?.device_limit ?? 0;
  const isUnlimited = oldLimit === 0;
  const isTrial = subscription?.is_trial === true;

  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => subscriptionApi.getDevices(),
  });
  const devices = devicesData?.devices ?? [];

  const { data: reductionInfo, isLoading: reductionLoading } = useQuery({
    queryKey: ['device-reduction-info'],
    queryFn: () => subscriptionApi.getDeviceReductionInfo(),
    enabled: !isUnlimited,
  });

  const { data: devicePriceForMax } = useQuery({
    queryKey: ['device-price', 1],
    queryFn: () => subscriptionApi.getDevicePrice(1),
    enabled: !isUnlimited,
  });

  const effectiveLimit = newLimit ?? oldLimit;
  const tariffMin = reductionInfo?.min_device_limit ?? oldLimit;
  const maxLimit = devicePriceForMax?.max_device_limit ?? Math.max(oldLimit, 20);
  const purchasedAboveTariff = Math.max(oldLimit - tariffMin, 0);
  const freedSlots = Math.max(oldLimit - effectiveLimit, 0);
  const addedSlots = Math.max(effectiveLimit - oldLimit, 0);
  const connectedCount = reductionInfo?.connected_devices_count ?? devicesData?.total ?? 0;
  const devicesToDisconnect = freedSlots > 0 ? Math.max(connectedCount - effectiveLimit, 0) : 0;
  const refundPerSlot = reductionInfo?.refund_kopeks_per_slot ?? 0;
  const refundTotal = refundPerSlot * freedSlots;

  const { data: increasePrice } = useQuery({
    queryKey: ['device-price', addedSlots],
    queryFn: () => subscriptionApi.getDevicePrice(addedSlots),
    enabled: addedSlots > 0,
  });

  // Отмеченные устройства теряют смысл при каждом изменении степпера — иначе
  // человек мог бы отключить 2, а лимит успел вернуться к прежнему значению.
  useEffect(() => {
    setSelectedHwids(new Set());
  }, [effectiveLimit]);

  const reduceMutation = useMutation({
    mutationFn: () =>
      subscriptionApi.reduceDevices(
        effectiveLimit,
        undefined,
        selectedHwids.size > 0 ? Array.from(selectedHwids) : undefined,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      navigate('/subscription/devices');
    },
  });

  const increaseMutation = useMutation({
    mutationFn: () => subscriptionApi.purchaseDevices(addedSlots),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      navigate('/subscription/devices');
    },
  });

  const toggleSelected = (hwid: string) => {
    setSelectedHwids((prev) => {
      const next = new Set(prev);
      if (next.has(hwid)) {
        next.delete(hwid);
      } else if (next.size < devicesToDisconnect) {
        next.add(hwid);
      }
      return next;
    });
  };

  if (subLoading || devicesLoading || (!isUnlimited && reductionLoading)) {
    return (
      <SimpleScreen title={t('simple.deviceLimit.title')}>
        <div className="skeleton h-40 w-full rounded-2xl" />
      </SimpleScreen>
    );
  }

  if (isUnlimited) {
    return (
      <SimpleScreen title={t('simple.deviceLimit.title')}>
        <p className="text-sm text-dark-400">{t('simple.deviceLimit.unavailable')}</p>
        <Button variant="secondary" fullWidth onClick={() => navigate('/subscription/devices')}>
          {t('simple.deviceLimit.goBack')}
        </Button>
      </SimpleScreen>
    );
  }

  const controlsDisabled = isTrial || reduceMutation.isPending || increaseMutation.isPending;
  const canConfirmDecrease =
    freedSlots > 0 && (devicesToDisconnect === 0 || selectedHwids.size === devicesToDisconnect);

  return (
    <SimpleScreen title={t('simple.deviceLimit.title')}>
      <BentoCard>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-dark-100">{t('simple.deviceLimit.stepperTitle')}</p>
            <p className="mt-0.5 text-sm text-dark-400">
              {t('simple.deviceLimit.stepperSub', {
                limit: oldLimit,
                connected: connectedCount,
                date: formatLongDate(subscription?.end_date ?? null),
              })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              aria-label={t('simple.deviceLimit.decrease')}
              disabled={controlsDisabled || effectiveLimit <= tariffMin}
              onClick={() => setNewLimit(Math.max(tariffMin, effectiveLimit - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-dark-700/50 text-lg text-dark-200 disabled:opacity-30"
            >
              −
            </button>
            <span className="w-6 text-center font-semibold tabular-nums text-dark-50">
              {effectiveLimit}
            </span>
            <button
              type="button"
              aria-label={t('simple.deviceLimit.increase')}
              disabled={controlsDisabled || effectiveLimit >= maxLimit}
              onClick={() => setNewLimit(Math.min(maxLimit, effectiveLimit + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-dark-700/50 text-lg text-dark-200 disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>
      </BentoCard>

      <BentoCard>
        <SumRow
          title={t('simple.deviceLimit.givesByTariff')}
          sub={t('simple.deviceLimit.givesByTariffSub')}
          value={t('simple.deviceLimit.slotsValue', { count: tariffMin })}
        />
        <SumRow
          title={t('simple.deviceLimit.purchasedAboveTariff')}
          value={t('simple.deviceLimit.slotsValue', { count: purchasedAboveTariff })}
        />
        {freedSlots > 0 && (
          <SumRow
            title={t('simple.deviceLimit.freeingSlots')}
            value={t('simple.deviceLimit.slotsValue', { count: freedSlots })}
          />
        )}
      </BentoCard>

      {freedSlots > 0 && (
        <BentoCard className="border-success-500/30 bg-success-500/10">
          <SumRow
            title={t('simple.deviceLimit.refundPerSlot')}
            sub={t('simple.deviceLimit.refundPerSlotSub', {
              // Базовая цена места за 30 дней — та же devicePriceForMax, что
              // уже используется на этом экране для maxLimit (см. бриф
              // задачи 1): без неё было видно только «за сколько дней»,
              // а откуда взялась сумма возврата — нет.
              basePrice: formatPrice(devicePriceForMax?.base_device_price_kopeks ?? 0),
              days: subscription?.days_left ?? 0,
            })}
            value={formatPrice(refundPerSlot)}
          />
          <SumRow title={t('simple.deviceLimit.refundSlotsCount')} value={`× ${freedSlots}`} />
          <SumRow
            title={t('simple.deviceLimit.refundTotal')}
            value={formatPrice(refundTotal)}
            emphasize
          />
        </BentoCard>
      )}

      {devicesToDisconnect > 0 && (
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
            {t('simple.deviceLimit.selectDevicesTitle', {
              selected: selectedHwids.size,
              needed: devicesToDisconnect,
            })}
          </span>
          <SimpleGroup className="mt-2">
            {devices.map((device) => {
              const displayName = device.local_name?.trim()
                ? device.local_name
                : device.device_model;
              const isSelected = selectedHwids.has(device.hwid);
              const subtitleParts = [
                device.client || null,
                device.platform || null,
                device.created_at
                  ? t('simple.devices.requestOn', { date: formatLongDate(device.created_at) })
                  : null,
              ].filter(Boolean);
              return (
                <button
                  key={device.hwid}
                  type="button"
                  onClick={() => toggleSelected(device.hwid)}
                  aria-pressed={isSelected}
                  className="flex w-full items-center gap-3 py-3 text-left"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      isSelected ? 'border-accent-500 bg-accent-500' : 'border-dark-600'
                    }`}
                  >
                    {isSelected && <CheckIcon className="h-3.5 w-3.5 text-white" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-dark-100">{displayName}</p>
                    {subtitleParts.length > 0 && (
                      <p className="mt-0.5 text-sm text-dark-400">{subtitleParts.join(' · ')}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </SimpleGroup>
          <p className="mt-2 text-xs text-dark-500">
            {t('simple.deviceLimit.selectDevicesHint', {
              connected: connectedCount,
              limit: effectiveLimit,
              needed: devicesToDisconnect,
              count: devicesToDisconnect,
            })}
          </p>
        </div>
      )}

      {freedSlots > 0 && (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canConfirmDecrease}
          loading={reduceMutation.isPending}
          onClick={() => reduceMutation.mutate()}
        >
          {devicesToDisconnect > 0
            ? t('simple.deviceLimit.confirmDisconnectAndRefund', {
                count: devicesToDisconnect,
                amount: formatPrice(refundTotal),
              })
            : t('simple.deviceLimit.confirmFreeAndRefund', {
                count: freedSlots,
                amount: formatPrice(refundTotal),
              })}
        </Button>
      )}

      {addedSlots > 0 && (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={increaseMutation.isPending}
          onClick={() => increaseMutation.mutate()}
        >
          {t('simple.deviceLimit.confirmIncrease', {
            count: addedSlots,
            amount: formatPrice(increasePrice?.total_price_kopeks ?? 0),
          })}
        </Button>
      )}

      <button
        type="button"
        onClick={() => navigate('/subscription/devices')}
        className="text-center text-sm font-medium text-accent-400"
      >
        {t('simple.deviceLimit.cancel')}
      </button>

      {isTrial && <p className="text-xs text-dark-500">{t('simple.deviceLimit.trialHint')}</p>}
    </SimpleScreen>
  );
}

function SumRow({
  title,
  sub,
  value,
  emphasize,
}: {
  title: string;
  sub?: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className={`font-medium text-dark-100 ${emphasize ? 'font-semibold' : ''}`}>{title}</p>
        {sub && <p className="mt-0.5 text-xs text-dark-400">{sub}</p>}
      </div>
      <span
        className={`shrink-0 tabular-nums text-dark-50 ${
          emphasize ? 'text-lg font-bold text-success-400' : 'font-semibold'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
