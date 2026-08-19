import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import SimpleScreen from './SimpleScreen';
import SimpleGroup from './SimpleGroup';
import { Button } from '@/components/primitives/Button/Button';
import { BentoCard } from '@/components/ui/BentoCard';
import { ChevronRightIcon, CheckIcon } from '@/components/icons';
import { subscriptionApi } from '../../api/subscription';
import { formatLongDate } from '../../utils/format';

interface DeviceItem {
  hwid: string;
  platform: string;
  device_model: string;
  created_at: string | null;
  local_name?: string | null;
  client?: string | null;
}

/**
 * Устройство — это программа, а не телефон: каждая установка (Happ, INCY, ...)
 * держит своё место. Заглушку «Без названия» показывать нельзя никогда —
 * пока алиас не задан, показываем модель из панели (device_model приходит
 * всегда, в отличие от local_name).
 */
function deviceDisplayName(device: DeviceItem): string {
  const alias = device.local_name?.trim();
  return alias ? alias : device.device_model;
}

/**
 * Экран «Устройства» простого режима: занятость мест, объяснение «одно
 * приложение — одно место», список устройств с переименованием и режим
 * выбора для массового отключения. При device_limit === 0 (безлимит) —
 * «∞» без полосы заполнения, докупка и уменьшение лимита недоступны, поэтому
 * строка «Лимит устройств» не ведёт никуда.
 */
export default function SimpleDevices() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedHwids, setSelectedHwids] = useState<Set<string>>(new Set());
  const [editingHwid, setEditingHwid] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [batchError, setBatchError] = useState<string | null>(null);

  const { data: subscriptionResponse, isLoading: subLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.getSubscription(),
    retry: false,
  });
  const subscription = subscriptionResponse?.subscription ?? null;

  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => subscriptionApi.getDevices(),
  });

  const devices: DeviceItem[] = devicesData?.devices ?? [];
  const total = devicesData?.total ?? devices.length;
  const deviceLimit = devicesData?.device_limit ?? subscription?.device_limit ?? 0;
  const isUnlimited = deviceLimit === 0;

  // Цена докупки одного места и дата, до которой она действует (находка 6):
  // цена пропорциональна остатку подписки, поэтому без даты подпись врёт.
  // При безлимите докупать нечего — запрос не шлём вовсе.
  const { data: devicePriceInfo } = useQuery({
    queryKey: ['device-price', 1],
    queryFn: () => subscriptionApi.getDevicePrice(1),
    enabled: !isUnlimited,
  });

  const renameMutation = useMutation({
    mutationFn: ({ hwid, name }: { hwid: string; name: string | null }) =>
      subscriptionApi.renameDevice(hwid, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setEditingHwid(null);
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (hwids: string[]) => subscriptionApi.deleteDevicesBatch(hwids),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      setBatchError(
        result.failed_hwids.length > 0
          ? t('simple.devices.batchDeletePartialError', { count: result.failed_hwids.length })
          : null,
      );
      setSelectionMode(false);
      setSelectedHwids(new Set());
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => subscriptionApi.deleteAllDevices(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });

  const toggleSelected = (hwid: string) => {
    setSelectedHwids((prev) => {
      const next = new Set(prev);
      if (next.has(hwid)) {
        next.delete(hwid);
      } else {
        next.add(hwid);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedHwids(new Set(devices.map((d) => d.hwid)));

  const startEdit = (device: DeviceItem) => {
    setEditingHwid(device.hwid);
    setEditingName(device.local_name?.trim() ?? '');
  };

  const submitEdit = () => {
    if (!editingHwid) return;
    const trimmed = editingName.trim();
    renameMutation.mutate({ hwid: editingHwid, name: trimmed.length > 0 ? trimmed : null });
  };

  if (subLoading || devicesLoading) {
    return (
      <SimpleScreen title={t('simple.devices.title')}>
        <div className="skeleton h-40 w-full rounded-2xl" />
      </SimpleScreen>
    );
  }

  const occupancyPercent = isUnlimited
    ? null
    : Math.min(100, (total / Math.max(deviceLimit, 1)) * 100);
  const isFull = !isUnlimited && total >= deviceLimit;

  const addSlotPriceLabel = devicePriceInfo?.available
    ? devicePriceInfo.price_per_device_label
    : null;
  const limitRowSub =
    !isUnlimited && addSlotPriceLabel && subscription?.end_date
      ? t('simple.devices.limitRowSub', {
          price: addSlotPriceLabel,
          date: formatLongDate(subscription.end_date),
        })
      : null;

  return (
    <SimpleScreen>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-dark-50">
          {selectionMode
            ? t('simple.devices.selectedCount', { count: selectedHwids.size })
            : t('simple.devices.title')}
        </h1>
        <button
          type="button"
          onClick={() => {
            setSelectionMode((v) => !v);
            setSelectedHwids(new Set());
            setBatchError(null);
          }}
          className="shrink-0 rounded-xl border border-dark-700/50 px-3 py-1.5 text-sm font-semibold text-dark-200"
        >
          {selectionMode ? t('common.cancel') : t('simple.devices.selectButton')}
        </button>
      </div>

      {!selectionMode && (
        <BentoCard size="xl" className="text-center">
          <p className="text-2xl font-bold tracking-tight text-dark-50">
            {isUnlimited ? '∞' : t('simple.devices.occupancy', { total, limit: deviceLimit })}
          </p>
          <p className="mt-1 text-sm text-dark-400">
            {isUnlimited
              ? t('simple.devices.occupancyUnlimited')
              : isFull
                ? t('simple.devices.occupancyFull')
                : t('simple.devices.occupancyFree', { count: deviceLimit - total })}
          </p>
          {occupancyPercent !== null && (
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-dark-700/40"
              data-testid="devices-occupancy-bar"
            >
              <div
                className={`h-full rounded-full ${isFull ? 'bg-warning-400' : 'bg-accent-500'}`}
                style={{ width: `${occupancyPercent}%` }}
                aria-hidden="true"
              />
            </div>
          )}
        </BentoCard>
      )}

      {!selectionMode && (
        <BentoCard className="border-accent-500/30 bg-accent-500/10">
          <p className="font-medium text-dark-100">{t('simple.devices.explainTitle')}</p>
          <p className="mt-1.5 text-sm text-dark-300">{t('simple.devices.explainBody')}</p>
        </BentoCard>
      )}

      {!selectionMode && (
        <SimpleGroup>
          <button
            type="button"
            onClick={() => {
              if (deviceLimit > 0) navigate('/subscription/devices/limit');
            }}
            disabled={isUnlimited}
            className="flex w-full items-center gap-3 py-3 text-left disabled:cursor-default"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-dark-100">{t('simple.devices.limitRowTitle')}</p>
              {limitRowSub && <p className="mt-0.5 text-sm text-dark-400">{limitRowSub}</p>}
            </div>
            <span className="shrink-0 font-semibold tabular-nums text-dark-50">
              {isUnlimited ? '∞' : deviceLimit}
            </span>
            {!isUnlimited && <ChevronRightIcon className="size-4 shrink-0 text-dark-50/30" />}
          </button>
        </SimpleGroup>
      )}

      {!selectionMode && !isUnlimited && (
        <p className="-mt-2 text-xs text-dark-500">{t('simple.devices.freeUpHint')}</p>
      )}

      {batchError && <p className="text-sm text-error-400">{batchError}</p>}

      {devices.length > 0 && (
        <SimpleGroup>
          {devices.map((device) => {
            const displayName = deviceDisplayName(device);
            const isEditing = editingHwid === device.hwid;
            const isSelected = selectedHwids.has(device.hwid);
            const subtitleParts = [
              device.client || null,
              device.platform || null,
              device.created_at
                ? t('simple.devices.requestOn', { date: formatLongDate(device.created_at) })
                : null,
            ].filter(Boolean);

            return (
              <div key={device.hwid} className="flex items-center gap-3 py-3">
                {selectionMode && (
                  <button
                    type="button"
                    onClick={() => toggleSelected(device.hwid)}
                    aria-pressed={isSelected}
                    aria-label={displayName}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      isSelected ? 'border-accent-500 bg-accent-500' : 'border-dark-600'
                    }`}
                  >
                    {isSelected && <CheckIcon className="h-3.5 w-3.5 text-white" />}
                  </button>
                )}

                {isEditing ? (
                  <>
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      placeholder={displayName}
                      autoFocus
                      className="min-w-0 flex-1 rounded-xl border border-accent-500 bg-dark-900 px-3 py-2 text-sm text-dark-100 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={submitEdit}
                      disabled={renameMutation.isPending}
                      className="shrink-0 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-semibold text-on-accent"
                    >
                      {t('simple.devices.renameDone')}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-dark-100">{displayName}</p>
                      {subtitleParts.length > 0 && (
                        <p className="mt-0.5 text-sm text-dark-400">{subtitleParts.join(' · ')}</p>
                      )}
                    </div>
                    {!selectionMode && (
                      <button
                        type="button"
                        onClick={() => startEdit(device)}
                        className="shrink-0 rounded-lg border border-dark-700/50 px-2.5 py-1 text-xs font-semibold text-dark-300"
                      >
                        {t('simple.devices.renameButton')}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </SimpleGroup>
      )}

      {selectionMode && devices.length > 0 && (
        <button
          type="button"
          onClick={selectAll}
          className="text-center text-sm font-medium text-accent-400"
        >
          {t('simple.devices.selectAll')}
        </button>
      )}

      {!selectionMode && <p className="text-xs text-dark-500">{t('simple.devices.hint')}</p>}

      {!selectionMode && devices.length > 0 && (
        <button
          type="button"
          onClick={() => deleteAllMutation.mutate()}
          disabled={deleteAllMutation.isPending}
          className="rounded-xl bg-error-500/10 py-2.5 text-center text-sm font-semibold text-error-400"
        >
          {t('simple.devices.disconnectAll')}
        </button>
      )}

      {selectionMode && (
        <>
          <Button
            variant="destructive"
            size="lg"
            fullWidth
            disabled={selectedHwids.size === 0}
            loading={batchDeleteMutation.isPending}
            onClick={() => batchDeleteMutation.mutate(Array.from(selectedHwids))}
          >
            {t('simple.devices.disconnectSelected', { count: selectedHwids.size })}
          </Button>
          <p className="text-center text-xs text-dark-500">
            {t('simple.devices.disconnectSelectedHint')}
          </p>
        </>
      )}
    </SimpleScreen>
  );
}
