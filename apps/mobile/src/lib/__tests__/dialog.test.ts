import { useDialogStore } from '../../store/dialogStore';
import { showDialog } from '../dialog';

beforeEach(() => {
  useDialogStore.setState({ current: null, queue: [] });
});

describe('showDialog', () => {
  it('store a yazar', () => {
    showDialog({ title: 'Başlık', message: 'Mesaj' });
    expect(useDialogStore.getState().current?.title).toBe('Başlık');
    expect(useDialogStore.getState().current?.message).toBe('Mesaj');
  });

  it('actions yoksa tek Tamam butonu olur', () => {
    showDialog({ title: 'Başlık' });
    const actions = useDialogStore.getState().current?.actions;
    expect(actions).toHaveLength(1);
    expect(actions?.[0].label).toBe('Tamam');
  });

  it('ikinci çağrı kuyruğa girer ve kapanınca gösterilir', () => {
    showDialog({ title: 'Bir' });
    showDialog({ title: 'İki' });
    expect(useDialogStore.getState().current?.title).toBe('Bir');
    expect(useDialogStore.getState().queue).toHaveLength(1);
    useDialogStore.getState().dismiss();
    expect(useDialogStore.getState().current?.title).toBe('İki');
    useDialogStore.getState().dismiss();
    expect(useDialogStore.getState().current).toBeNull();
  });
});
