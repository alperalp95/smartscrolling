import { StyleSheet, View } from 'react-native';
import { type DialogAction, useDialogStore } from '../src/store/dialogStore';
import { space } from '../src/theme';
import { DangerButton } from './settings/danger-button';
import { BottomSheet } from './ui/bottom-sheet';
import { Button } from './ui/button';
import { GradientButton } from './ui/gradient';

export function AppDialog() {
  const current = useDialogStore((state) => state.current);
  const dismiss = useDialogStore((state) => state.dismiss);

  if (!current) {
    return null;
  }

  const run = (action?: DialogAction) => {
    dismiss();
    action?.onPress?.();
  };
  const cancelAction = current.actions.find((action) => action.style === 'cancel');

  return (
    <BottomSheet
      visible
      onClose={() => run(cancelAction)}
      title={current.title}
      subtitle={current.message}
      testID="app-dialog"
    >
      <View style={s.actions}>
        {current.actions.map((action, index) => {
          const testID = `app-dialog-action-${index}`;
          const onPress = () => run(action);
          const key = `${index}-${action.label}`;
          if (action.style === 'destructive') {
            return (
              <DangerButton key={key} label={action.label} onPress={onPress} testID={testID} />
            );
          }
          if (action.style === 'cancel') {
            return (
              <Button
                key={key}
                label={action.label}
                variant="ghost"
                onPress={onPress}
                testID={testID}
              />
            );
          }
          return (
            <GradientButton key={key} label={action.label} onPress={onPress} testID={testID} />
          );
        })}
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  actions: { gap: space.md, marginTop: space.md },
});
