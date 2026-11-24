import { type DialogAction, type DialogOptions, useDialogStore } from '../store/dialogStore';

export type { DialogAction };

export function showDialog(opts: DialogOptions): void {
  const actions =
    opts.actions && opts.actions.length > 0
      ? opts.actions
      : [{ label: 'Tamam', style: 'primary' as const }];
  useDialogStore.getState().enqueue({ title: opts.title, message: opts.message, actions });
}
