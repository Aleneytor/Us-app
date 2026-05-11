import { Modal as NativeModal } from 'react-native';
import type { ModalProps } from 'react-native';

export function AppModal({ visible = true, ...props }: ModalProps) {
  return <NativeModal visible={visible} {...props} />;
}
